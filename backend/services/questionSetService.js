/**
 * Cầu nối giữa mô hình MỚI (ToeicQuestionSet: 1 doc = 1 màn, câu nằm trong
 * mảng questions[]) và phần còn lại của hệ thống vốn làm việc theo TỪNG CÂU.
 *
 * Ý tưởng then chốt: sub-document Mongo có `_id` duy nhất toàn cục, nên một
 * `questionId` vẫn trỏ đúng một câu như mô hình cũ. Ở đây chỉ đổi CÁCH TRA CỨU.
 *
 * `flattenQuestion` trả về đúng hình dạng mà controller/frontend đang dùng
 * (kèm groupId = id của set) → đấu nối được mà không phải sửa runner.
 */
const ToeicQuestionSet = require('../models/ToeicQuestionSet');

/**
 * Dàn một câu con thành object "câu hỏi" đầy đủ: gộp ngữ cảnh CHUNG của màn
 * (audio/ảnh/đoạn văn) vào từng câu, đúng như dữ liệu cũ từng lưu lặp.
 */
function flattenQuestion(set, q, index = 0) {
    return {
        _id: q._id,
        part: set.part,
        source: set.source,
        questionNumber: q.number,
        questionText: q.questionText || '',
        questionTranslate: q.questionTranslate || '',
        options: (q.options || []).map(o => ({ label: o.label, text: o.text })),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || {},
        // Ngữ cảnh chung của cả màn
        audioUrl: set.audioUrl || '',
        audioText: set.audioText || '',
        audioTranslate: set.audioTranslate || '',
        imageUrls: set.imageUrls || [],
        passages: set.passages || [],
        passageCount: set.passageCount,
        // Gom nhóm: cả màn dùng chung id của set. Runner đang gom theo groupId
        // nên giữ tên này để không phải sửa frontend ở giai đoạn này.
        groupId: String(set._id),
        questionIndex: index + 1,
        setSize: (set.questions || []).length,
    };
}

/** Dàn phẳng cả một màn thành mảng câu. */
function flattenSet(set) {
    return (set.questions || []).map((q, i) => flattenQuestion(set, q, i));
}

/** Dàn phẳng nhiều màn, giữ nguyên thứ tự màn và thứ tự câu trong màn. */
function flattenSets(sets) {
    return sets.flatMap(flattenSet);
}

/** Tổng số CÂU của một danh sách màn (khác số lượng document). */
function countQuestions(sets) {
    return sets.reduce((n, s) => n + (s.questions?.length || 0), 0);
}

/** Tra một câu theo id câu con. Trả về câu đã dàn phẳng, hoặc null. */
async function findQuestionById(subId) {
    const set = await ToeicQuestionSet.findOne({ 'questions._id': subId }).lean();
    if (!set) return null;
    const idx = set.questions.findIndex(q => String(q._id) === String(subId));
    if (idx < 0) return null;
    return flattenQuestion(set, set.questions[idx], idx);
}

/**
 * Tra NHIỀU câu cùng lúc (1 query) → Map(subId → câu đã dàn phẳng).
 * Dùng cho chấm điểm và màn xem lại, tránh N truy vấn.
 */
async function findQuestionsByIds(subIds) {
    const ids = [...new Set(subIds.filter(Boolean).map(String))];
    if (!ids.length) return new Map();
    const sets = await ToeicQuestionSet.find({ 'questions._id': { $in: ids } }).lean();
    const map = new Map();
    for (const set of sets) {
        set.questions.forEach((q, i) => {
            const key = String(q._id);
            if (ids.includes(key)) map.set(key, flattenQuestion(set, q, i));
        });
    }
    return map;
}

/**
 * Ghi thống kê cho MỘT câu (sub-document). Cập nhật nguyên tử bằng toán tử
 * vị trí `$` — không tải cả màn về rồi save, tránh ghi đè lẫn nhau khi nhiều
 * người nộp bài cùng lúc.
 */
async function recordAnswerStat(subId, isCorrect) {
    if (!subId) return;
    await ToeicQuestionSet.updateOne(
        { 'questions._id': subId },
        {
            $inc: {
                'questions.$.timesUsed': 1,
                [`questions.$.${isCorrect ? 'correctCount' : 'wrongCount'}`]: 1,
            },
        }
    );
}

module.exports = {
    recordAnswerStat,
    flattenQuestion,
    flattenSet,
    flattenSets,
    countQuestions,
    findQuestionById,
    findQuestionsByIds,
};
