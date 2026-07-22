// ===================================
// TOEIC QUESTIONS CONTROLLER
// ===================================
// Split out of toeicController (P4). Self-contained question-bank CRUD +
// AI generation. LETTERS and the aiQuestionGenerator require are local to
// their handlers. Verbatim move; behaviour unchanged. routes/toeic.js
// imports these from here now.

const ToeicQuestion = require('../models/ToeicQuestion'); // legacy — gỡ ở GĐ5
const ToeicQuestionSet = require('../models/ToeicQuestionSet');
const logger = require('../utils/logger');

// Số câu MỞ ĐẦU của từng Part theo chuẩn TOEIC — trùng với partRanges dùng lúc
// dựng bài thi. Trước đây câu hỏi đánh số 1,2,3… trong TỪNG Part nên Part 6 ra
// 1–16 thay vì 131–146, lệch hẳn với số ghi trong ảnh đề scan.
const PART_START = { 1: 1, 2: 7, 3: 32, 4: 71, 5: 101, 6: 131, 7: 147 };
// Mốc KẾT THÚC — thiếu nó thì Part đầy sẽ tràn sang dải của Part sau
// (vd Part 5 đủ 30 câu 101-130, câu thứ 31 nhảy lên 131 = dải Part 6).
const PART_END = { 1: 6, 2: 31, 3: 70, 4: 100, 5: 130, 6: 146, 7: 200 };

/**
 * Số câu kế tiếp — đánh theo TỪNG BỘ ĐỀ (source), không phải toàn ngân hàng.
 * DB chứa nhiều bộ đề (ets26t1…ets26t10); mỗi bộ có số riêng theo chuẩn TOEIC
 * (P1 1–6, P2 7–31, P6 131–146…). Không lọc theo source thì bộ thứ hai sẽ nối
 * tiếp bộ thứ nhất (Part 1 ra 7,8,9… thay vì 1,2,3…).
 */
async function nextQuestionNumber(part, source) {
    const start = PART_START[part] || 1;
    const filter = { part };
    if (source) filter.source = source;
    const sets = await ToeicQuestionSet.find(filter).select('questions.number').lean();
    let max = 0;
    for (const set of sets) for (const q of (set.questions || [])) {
        if (Number.isFinite(q.number) && q.number > max) max = q.number;
    }
    const next = Math.max(start, max + 1);
    // Vượt dải của Part → bộ đề này đã đủ câu cho Part đó.
    return next > (PART_END[part] || 200) ? null : next;
}

/**
 * Chuẩn hoá payload admin thành MỘT MÀN.
 * Nhận cả hai dạng để giao diện cũ chạy tiếp:
 *   • dạng NHÓM: { questions: [ {...}, ... ] }
 *   • dạng CÂU ĐƠN (phẳng): { questionText, options, correctAnswer, ... }
 * Part 1/2/5 chỉ là màn có đúng 1 câu — không có nhánh riêng theo part.
 */
/** Đếm SỐ CÂU (không phải số màn) khớp một điều kiện. */
async function countQuestionsIn(filter) {
    const rows = await ToeicQuestionSet.aggregate([
        { $match: filter },
        { $group: { _id: null, n: { $sum: { $size: '$questions' } } } },
    ]);
    return rows[0]?.n || 0;
}

function buildSetPayload(body) {
    const part = parseInt(body.part);
    const raw = (Array.isArray(body.questions) && body.questions.length)
        ? body.questions
        : [{
            number: body.questionNumber,
            questionText: body.questionText,
            questionTranslate: body.questionTranslate,
            options: body.options,
            correctAnswer: body.correctAnswer,
            explanation: body.explanation,
        }];

    const questions = raw.map((q, i) => {
        const options = (Array.isArray(q.options) ? q.options : [])
            .map((o, idx) => ({ label: o.label || String.fromCharCode(65 + idx), text: String(o.text ?? '').trim() }))
            .filter(o => o.text);
        if (options.length < 3) throw Object.assign(new Error(`Câu #${i + 1}: cần tối thiểu 3 đáp án.`), { status: 400 });
        if (!q.correctAnswer || !options.some(o => o.label === q.correctAnswer)) {
            throw Object.assign(new Error(`Câu #${i + 1}: correctAnswer không khớp đáp án nào.`), { status: 400 });
        }
        return {
            number: Number.isFinite(Number(q.number)) ? Number(q.number) : undefined,
            questionText: q.questionText ? String(q.questionText).trim() : undefined,
            questionTranslate: q.questionTranslate ? String(q.questionTranslate).trim() : undefined,
            options,
            correctAnswer: q.correctAnswer,
            explanation: (q.explanation && typeof q.explanation === 'object') ? q.explanation
                : (q.explanation ? { note: String(q.explanation).trim() } : {}),
        };
    });

    return {
        part,
        source: body.source ? String(body.source).trim() : undefined,
        audioUrl: body.audioUrl ? String(body.audioUrl).trim() : undefined,
        audioText: body.audioText ? String(body.audioText).trim() : undefined,
        audioTranslate: body.audioTranslate ? String(body.audioTranslate).trim() : undefined,
        imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls.filter(Boolean) : [],
        passages: Array.isArray(body.passages) ? body.passages.filter(Boolean) : [],
        passageCount: body.passageCount ? parseInt(body.passageCount) : undefined,
        questions,
    };
}

/**
 * @desc    Get all TOEIC questions (Admin)
 * @route   GET /api/toeic/questions
 * @access  Private/Admin
 */
exports.getQuestions = async (req, res, next) => {
    try {
        const { part, topic, source, page = 1, limit = 20 } = req.query;
        const query = {};
        if (part) query.part = parseInt(part);
        if (topic) query.topic = topic;
        if (source) query.source = source;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        // Một dòng = một MÀN (Part 1/2/5 là màn 1 câu).
        const sets = await ToeicQuestionSet.find(query)
            .sort({ source: 1, part: 1, 'questions.0.number': 1 })
            .limit(parseInt(limit)).skip(skip).lean();
        const total = await ToeicQuestionSet.countDocuments(query);

        res.json({
            success: true,
            count: sets.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            data: sets,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get single question
 * @route   GET /api/toeic/questions/:id
 * @access  Private/Admin
 */
exports.getQuestion = async (req, res, next) => {
    try {
        const set = await ToeicQuestionSet.findById(req.params.id).lean();
        if (!set) return res.status(404).json({ success: false, message: 'Không tìm thấy màn hỏi' });
        res.json({ success: true, data: set });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Create new question (Admin)
 * @route   POST /api/toeic/questions
 * @access  Private/Admin
 */
exports.createQuestion = async (req, res, next) => {
    try {
        const payload = buildSetPayload(req.body);
        // Câu nào chưa có số → đánh tiếp theo chuẩn TOEIC của Part trong bộ đề đó.
        let next = await nextQuestionNumber(payload.part, payload.source);
        for (const q of payload.questions) {
            if (Number.isFinite(q.number)) continue;
            if (next === null || next > (PART_END[payload.part] || 200)) {
                return res.status(400).json({
                    success: false,
                    message: `Part ${payload.part} của bộ đề "${payload.source || '(không có)'}" đã đủ câu `
                        + `(${PART_START[payload.part]}–${PART_END[payload.part]}). `
                        + 'Hãy nhập "Số câu" thủ công nếu muốn ghi đè, hoặc dùng bộ đề khác.',
                });
            }
            q.number = next++;
        }

        const set = await ToeicQuestionSet.create({ ...payload, createdBy: req.user.id });
        res.status(201).json({
            success: true,
            message: `✅ Đã tạo màn ${set.questions.length} câu (Part ${set.part}).`,
            data: set,
        });
    } catch (error) {
        if (error.status === 400) return res.status(400).json({ success: false, message: error.message });
        next(error);
    }
};

/**
 * @desc    Tạo cả một NHÓM câu hỏi cùng lúc (Part 3/4/6/7): 1 ngữ cảnh, nhiều câu.
 *          Tự sinh groupId, tự đánh questionIndex 1..N, media chung gắn ở câu ĐẦU.
 * @route   POST /api/toeic/questions/group
 * @access  Private/Admin
 */
exports.createQuestionGroup = async (req, res, next) => {
    // Nhóm câu hỏi CHÍNH LÀ một màn nhiều câu → dùng chung đường tạo màn.
    // Giữ endpoint riêng để giao diện trình dựng nhóm không phải đổi.
    const p = parseInt(req.body?.part);
    if (![3, 4, 6, 7].includes(p)) {
        return res.status(400).json({ success: false, message: 'Nhóm câu hỏi chỉ dùng cho Part 3/4/6/7.' });
    }
    if (!Array.isArray(req.body?.questions) || req.body.questions.length < 2) {
        return res.status(400).json({ success: false, message: 'Nhóm cần ít nhất 2 câu hỏi.' });
    }
    if (!req.body?.source || !String(req.body.source).trim()) {
        return res.status(400).json({ success: false, message: 'Thiếu "source" (mã đề) cho nhóm.' });
    }
    return exports.createQuestion(req, res, next);
};

/**
 * @desc    Update question (Admin)
 * @route   PUT /api/toeic/questions/:id
 * @access  Private/Admin
 */
exports.updateQuestion = async (req, res, next) => {
    try {
        const payload = buildSetPayload(req.body);
        const current = await ToeicQuestionSet.findById(req.params.id).select('questions.number').lean();
        if (!current) return res.status(404).json({ success: false, message: 'Không tìm thấy màn hỏi' });

        // Thiếu số thì giữ số cũ theo vị trí, không đánh lại từ đầu.
        payload.questions.forEach((q, i) => {
            if (!Number.isFinite(q.number)) q.number = current.questions[i]?.number;
        });
        let next = await nextQuestionNumber(payload.part, payload.source);
        payload.questions.forEach(q => { if (!Number.isFinite(q.number)) q.number = next++; });

        const set = await ToeicQuestionSet.findByIdAndUpdate(req.params.id, payload,
            { new: true, runValidators: true });
        res.json({ success: true, message: 'Đã cập nhật màn hỏi', data: set });
    } catch (error) {
        if (error.status === 400) return res.status(400).json({ success: false, message: error.message });
        next(error);
    }
};

/**
 * @desc    Delete question (Admin)
 * @route   DELETE /api/toeic/questions/:id
 * @access  Private/Admin
 */
exports.deleteQuestion = async (req, res, next) => {
    try {
        const set = await ToeicQuestionSet.findByIdAndDelete(req.params.id);
        if (!set) return res.status(404).json({ success: false, message: 'Không tìm thấy màn hỏi' });
        res.json({ success: true, message: `Đã xoá màn (${set.questions.length} câu)` });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete all questions (Admin)
 * @route   DELETE /api/toeic/questions/delete-all
 * @access  Private/Admin
 */
exports.deleteAllQuestions = async (req, res, next) => {
    try {
        const result = await ToeicQuestionSet.deleteMany({});
        res.json({
            success: true,
            message: 'Đã xoá toàn bộ câu hỏi TOEIC',
            deletedCount: result.deletedCount,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Danh sách các nguồn (source) đang có — để form tạo đề chọn thay vì gõ tay.
 * @route   GET /api/toeic/questions/sources
 * @access  Private/Admin
 */
exports.getQuestionSources = async (req, res, next) => {
    try {
        // distinct đã bỏ trùng; lọc rỗng/null rồi sắp xếp cho dễ nhìn.
        const sources = (await ToeicQuestionSet.distinct('source'))
            .filter(s => s && s.trim())
            .sort((a, b) => a.localeCompare(b));
        res.json({ success: true, data: sources });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get questions statistics by part (Admin)
 * @route   GET /api/toeic/questions/statistics
 * @access  Private/Admin
 */
exports.getQuestionsStatistics = async (req, res, next) => {
    try {
        const partNames = {
            1: 'Photographs',
            2: 'Question-Response',
            3: 'Conversations',
            4: 'Talks',
            5: 'Incomplete Sentences',
            6: 'Text Completion',
            7: 'Reading Comprehension'
        };

        const partRequirements = {
            1: 6, 2: 25, 3: 39, 4: 30, 5: 30, 6: 16, 7: 54
        };

        const statistics = [];
        let totalAvailable = 0;
        let totalRequired = 0;
        let canCreateFullTest = true;

        for (let part = 1; part <= 7; part++) {
            const total = await countQuestionsIn({ part, isActive: true, isPublished: true });

            const required = partRequirements[part];
            const missing = Math.max(0, required - total);
            const canCreate = total >= required;

            if (!canCreate) canCreateFullTest = false;

            totalAvailable += total;
            totalRequired += required;

            statistics.push({
                part,
                partName: partNames[part],
                available: total,
                required,
                missing,
                canCreate
            });
        }

        // Section breakdown
        const listeningCount = await countQuestionsIn({
            part: { $in: [1, 2, 3, 4] },
            isActive: true,
            isPublished: true,
        });

        const readingCount = await countQuestionsIn({
            part: { $in: [5, 6, 7] },
            isActive: true,
            isPublished: true,
        });

        res.json({
            success: true,
            data: {
                parts: statistics,
                summary: {
                    totalAvailable,
                    totalRequired,
                    missing: totalRequired - totalAvailable,
                    progress: ((totalAvailable / totalRequired) * 100).toFixed(1),
                    canCreateFullTest
                },
                sections: {
                    listening: {
                        count: listeningCount,
                        required: 100
                    },
                    reading: {
                        count: readingCount,
                        required: 100
                    }
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Generate questions using AI (Admin)
 * @route   POST /api/toeic/questions/ai-generate
 * @access  Private/Admin
 */
exports.generateQuestionsWithAI = async (req, res, next) => {
    try {
        const { part, count = 5, autoSave = false } = req.body;

        // Validate part
        if (!part || part < 1 || part > 7) {
            return res.status(400).json({
                success: false,
                message: 'Invalid part number. Must be between 1 and 7.',
            });
        }

        // Validate count
        if (count < 1 || count > 50) {
            return res.status(400).json({
                success: false,
                message: 'Count must be between 1 and 50.',
            });
        }

        logger.debug(`AI generating ${count} questions for Part ${part}`);

        const aiGenerator = require('../services/aiQuestionGenerator');
        const generatedQuestions = await aiGenerator.generateQuestions(part, count);

        // Optionally save to database
        let savedQuestions = [];
        if (autoSave) {
            for (let i = 0; i < generatedQuestions.length; i++) {
                const qData = generatedQuestions[i];

                const LETTERS = ['A', 'B', 'C', 'D'];
                const transformedOptions = qData.options.map((opt, idx) => ({
                    label: LETTERS[idx] || LETTERS[0],
                    text: opt.optionText,
                    isCorrect: opt.isCorrect,
                }));

                const correctIdx = qData.options.findIndex(opt => opt.isCorrect);
                const correctAnswer = LETTERS[correctIdx >= 0 ? correctIdx : 0];

                // AI sinh từng câu rời → mỗi câu là một MÀN 1 câu.
                const setToSave = {
                    part: qData.part,
                    audioText: qData.audioTranscript || undefined,
                    passages: qData.passage ? [qData.passage] : [],
                    topic: qData.passageType || 'general',
                    tags: ['ai-generated'],
                    isPublished: false,
                    isActive: true,
                    createdBy: req.user.id,
                    questions: [{
                        number: await nextQuestionNumber(qData.part, undefined),
                        questionText: qData.questionText,
                        options: transformedOptions,
                        correctAnswer,
                        explanation: qData.explanation || {},
                    }],
                };

                const savedQuestion = await ToeicQuestionSet.create(setToSave);
                savedQuestions.push(savedQuestion);
            }

            logger.debug(`✅ Saved ${savedQuestions.length} AI-generated questions to database`);
        }

        res.status(201).json({
            success: true,
            message: autoSave
                ? `Generated and saved ${generatedQuestions.length} questions successfully`
                : `Generated ${generatedQuestions.length} questions successfully (not saved)`,
            data: autoSave ? savedQuestions : generatedQuestions,
            metadata: {
                part,
                count: generatedQuestions.length,
                autoSaved: autoSave,
                needsReview: autoSave,
            },
        });

    } catch (error) {
        logger.error('AI generation error:', error);
        next(error);
    }
};

module.exports = exports;
