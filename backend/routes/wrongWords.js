const express = require('express');
const router = express.Router();

const {
    addWrongWord,
    recordCorrect,
    getWordsToReview,
    getAllWrongWords,
    deleteWrongWord,
    getStats,
    bulkUpdate
} = require('../controllers/wrongWordsController');

const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// POST /api/wrong-words - Thêm từ sai mới hoặc cập nhật
router.post('/', addWrongWord);

// POST /api/wrong-words/:wordId/correct - Đánh dấu làm đúng
router.post('/:wordId/correct', recordCorrect);

// GET /api/wrong-words/review - Lấy từ cần ôn (theo priority và nextReviewDate)
router.get('/review', getWordsToReview);

// GET /api/wrong-words - Lấy tất cả từ sai đang active
router.get('/', getAllWrongWords);

// GET /api/wrong-words/stats - Thống kê
router.get('/stats', getStats);

// DELETE /api/wrong-words/:wordId - Xóa từ
router.delete('/:wordId', deleteWrongWord);

// POST /api/wrong-words/bulk - Bulk update (để migrate data cũ)
router.post('/bulk', bulkUpdate);

module.exports = router;
