// ===================================
// TOEIC QUESTIONS CONTROLLER
// ===================================
// Split out of toeicController (P4). Self-contained question-bank CRUD +
// AI generation. LETTERS and the aiQuestionGenerator require are local to
// their handlers. Verbatim move; behaviour unchanged. routes/toeic.js
// imports these from here now.

const ToeicQuestion = require('../models/ToeicQuestion');
const logger = require('../utils/logger');

// Số câu MỞ ĐẦU của từng Part theo chuẩn TOEIC — trùng với partRanges dùng lúc
// dựng bài thi. Trước đây câu hỏi đánh số 1,2,3… trong TỪNG Part nên Part 6 ra
// 1–16 thay vì 131–146, lệch hẳn với số ghi trong ảnh đề scan.
const PART_START = { 1: 1, 2: 7, 3: 32, 4: 71, 5: 101, 6: 131, 7: 147 };

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
    const last = await ToeicQuestion.findOne(filter).sort({ questionNumber: -1 }).select('questionNumber');
    return Math.max(start, (last?.questionNumber || 0) + 1);
}

/**
 * @desc    Get all TOEIC questions (Admin)
 * @route   GET /api/toeic/questions
 * @access  Private/Admin
 */
exports.getQuestions = async (req, res, next) => {
    try {
        const {
            part,
            topic,
            source,
            groupId,
            page = 1,
            limit = 20,
        } = req.query;

        const query = {};

        if (part) query.part = parseInt(part);
        if (topic) query.topic = topic;
        if (source) query.source = source;
        if (groupId) query.groupId = groupId;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const questions = await ToeicQuestion.find(query)
            .sort({ createdAt: -1, _id: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .lean();

        const total = await ToeicQuestion.countDocuments(query);

        res.json({
            success: true,
            count: questions.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            data: questions,
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
        const question = await ToeicQuestion.findById(req.params.id).lean();

        if (!question) {
            return res.status(404).json({
                success: false,
                message: 'Question not found',
            });
        }

        res.json({
            success: true,
            data: question,
        });
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
        req.body.createdBy = req.user.id;

        // Auto-generate questionNumber if not provided
        if (!req.body.questionNumber) {
            req.body.questionNumber = await nextQuestionNumber(req.body.part, req.body.source);
        }

        const question = await ToeicQuestion.create(req.body);

        res.status(201).json({
            success: true,
            message: 'Question created successfully',
            data: question,
        });
    } catch (error) {
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
    try {
        const { part, source, audioUrl, imageUrls, passageCount, questions } = req.body;

        const p = parseInt(part);
        if (![3, 4, 6, 7].includes(p)) {
            return res.status(400).json({ success: false, message: 'Nhóm câu hỏi chỉ dùng cho Part 3/4/6/7.' });
        }
        if (!source || !String(source).trim()) {
            return res.status(400).json({ success: false, message: 'Thiếu "source" (mã đề) cho nhóm.' });
        }
        if (!Array.isArray(questions) || questions.length < 2) {
            return res.status(400).json({ success: false, message: 'Nhóm cần ít nhất 2 câu hỏi.' });
        }

        // Chuẩn hoá + kiểm tra từng câu con TRƯỚC khi ghi (không tạo nửa vời).
        const cleaned = [];
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i] || {};
            const options = Array.isArray(q.options)
                ? q.options
                    .map((o, idx) => ({ label: o.label || String.fromCharCode(65 + idx), text: (o.text != null ? String(o.text) : '').trim() }))
                    .filter(o => o.text)
                : [];
            if (options.length < 3) {
                return res.status(400).json({ success: false, message: `Câu #${i + 1}: cần tối thiểu 3 đáp án có nội dung.` });
            }
            if (!q.correctAnswer || !options.some(o => o.label === q.correctAnswer)) {
                return res.status(400).json({ success: false, message: `Câu #${i + 1}: correctAnswer không khớp đáp án nào.` });
            }
            cleaned.push({
                questionText: q.questionText ? String(q.questionText).trim() : undefined,
                options,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation && typeof q.explanation === 'object' ? q.explanation
                    : (q.explanation ? { note: String(q.explanation).trim() } : undefined),
            });
        }

        // questionNumber tăng dần theo chuẩn TOEIC của Part (P6 bắt đầu 131…).
        let nextNumber = await nextQuestionNumber(p, String(source).trim());

        const groupId = `p${p}_grp_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
        // Media CHUNG gắn vào MỌI câu trong nhóm → mỗi câu tự đủ ngữ cảnh
        // (hiện đúng ở cả màn làm bài, sửa tay lẫn màn xem lại).
        const sharedMedia = {
            audioUrl: audioUrl ? String(audioUrl).trim() : undefined,
            imageUrls: Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : [],
            passageCount: passageCount ? parseInt(passageCount) : undefined,
        };

        const docs = cleaned.map((c, i) => ({
            part: p,
            questionNumber: nextNumber++,
            groupId,
            questionIndex: i + 1,
            source: String(source).trim(),
            questionText: c.questionText,
            options: c.options,
            correctAnswer: c.correctAnswer,
            explanation: c.explanation,
            createdBy: req.user.id,
            ...sharedMedia,
        }));

        const created = await ToeicQuestion.insertMany(docs);

        res.status(201).json({
            success: true,
            message: `✅ Đã tạo nhóm ${created.length} câu (Part ${p}).`,
            data: { groupId, count: created.length },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update question (Admin)
 * @route   PUT /api/toeic/questions/:id
 * @access  Private/Admin
 */
exports.updateQuestion = async (req, res, next) => {
    try {
        const question = await ToeicQuestion.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!question) {
            return res.status(404).json({
                success: false,
                message: 'Question not found',
            });
        }

        res.json({
            success: true,
            message: 'Question updated successfully',
            data: question,
        });
    } catch (error) {
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
        const question = await ToeicQuestion.findByIdAndDelete(req.params.id);

        if (!question) {
            return res.status(404).json({
                success: false,
                message: 'Question not found',
            });
        }

        res.json({
            success: true,
            message: 'Question deleted successfully',
        });
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
        // Delete all TOEIC questions
        const result = await ToeicQuestion.deleteMany({});

        res.json({
            success: true,
            message: `Successfully deleted all TOEIC questions`,
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
        const sources = (await ToeicQuestion.distinct('source'))
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
            const total = await ToeicQuestion.countDocuments({ part, isActive: true, isPublished: true });

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
        const listeningCount = await ToeicQuestion.countDocuments({
            part: { $in: [1, 2, 3, 4] },
            isActive: true,
            isPublished: true,
        });

        const readingCount = await ToeicQuestion.countDocuments({
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

                const questionToSave = {
                    part: qData.part,
                    questionNumber: i + 1,
                    questionText: qData.questionText,
                    options: transformedOptions,
                    correctAnswer,
                    explanation: qData.explanation || {},
                    audioText: qData.audioTranscript || null,
                    passages: qData.passage ? [qData.passage] : [],
                    passageType: qData.passageType || null,
                    topic: qData.passageType || 'general',
                    tags: ['ai-generated'],
                    isPublished: false,
                    isActive: true,
                    createdBy: req.user.id,
                };

                const savedQuestion = await ToeicQuestion.create(questionToSave);
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
