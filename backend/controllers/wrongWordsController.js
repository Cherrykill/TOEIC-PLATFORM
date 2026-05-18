const WrongWord = require('../models/WrongWord');
const logger = require('../utils/logger');

/**
 * @desc    Thêm từ sai mới hoặc cập nhật nếu đã tồn tại
 * @route   POST /api/wrong-words
 * @access  Private
 */
exports.addWrongWord = async (req, res) => {
    try {
        const { wordId, en, vn, phonetic, type, level, part, example, image } = req.body;
        const userId = req.user.id || req.user._id;

        // ✅ Debug logging
        logger.debug('📝 addWrongWord - Received data:', {
            wordId,
            en,
            vn,
            hasUserId: !!userId
        });

        // ✅ Validate required fields
        if (!wordId) {
            return res.status(400).json({
                success: false,
                message: 'wordId is required'
            });
        }

        if (!en) {
            return res.status(400).json({
                success: false,
                message: 'en is required'
            });
        }

        if (!vn) {
            return res.status(400).json({
                success: false,
                message: 'vn is required'
            });
        }

        // Tìm xem từ này đã tồn tại chưa
        let wrongWord = await WrongWord.findOne({ userId, wordId });

        if (wrongWord) {
            // Nếu đã tồn tại, gọi recordWrong để cập nhật
            wrongWord.recordWrong();
            await wrongWord.save();

            return res.status(200).json({
                success: true,
                message: 'Đã cập nhật từ sai',
                data: wrongWord
            });
        }

        // Tạo mới
        wrongWord = await WrongWord.create({
            userId,
            wordId,
            en,
            vn,
            phonetic,
            type,
            level,
            part,
            example,
            image
        });

        // Tính priority ban đầu
        wrongWord.calculatePriority();
        await wrongWord.save();

        res.status(201).json({
            success: true,
            message: 'Đã thêm từ sai',
            data: wrongWord
        });
    } catch (error) {
        logger.error('Error in addWrongWord:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi thêm từ sai',
            error: error.message
        });
    }
};

/**
 * @desc    Đánh dấu làm đúng
 * @route   POST /api/wrong-words/:wordId/correct
 * @access  Private
 */
exports.recordCorrect = async (req, res) => {
    try {
        const { wordId } = req.params;
        const userId = req.user.id || req.user._id;

        const wrongWord = await WrongWord.findOne({ userId, wordId });

        if (!wrongWord) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy từ'
            });
        }

        // Gọi recordCorrect
        wrongWord.recordCorrect();
        await wrongWord.save();

        res.status(200).json({
            success: true,
            message: wrongWord.status === 'mastered' ? 'Đã thuộc từ này!' : 'Đã cập nhật',
            data: wrongWord
        });
    } catch (error) {
        logger.error('Error in recordCorrect:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật',
            error: error.message
        });
    }
};

/**
 * @desc    Lấy từ cần ôn (TẤT CẢ từ active, không check nextReviewDate)
 * @route   GET /api/wrong-words/review?limit=10
 * @access  Private
 */
exports.getWordsToReview = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        const limit = parseInt(req.query.limit) || 10;

        // ✅ Lấy TẤT CẢ từ active, sắp xếp theo priority (không check nextReviewDate)
        const words = await WrongWord.find({
            userId,
            status: 'active'
        })
        .sort({ priorityScore: -1, wrongCount: -1 })
        .limit(limit);

        logger.debug(`📚 getWordsToReview: Found ${words.length} active words for user ${userId}`);

        res.status(200).json({
            success: true,
            count: words.length,
            data: words
        });
    } catch (error) {
        logger.error('Error in getWordsToReview:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy từ cần ôn',
            error: error.message
        });
    }
};

/**
 * @desc    Lấy tất cả từ sai đang active
 * @route   GET /api/wrong-words?limit=100
 * @access  Private
 */
exports.getAllWrongWords = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        const limit = parseInt(req.query.limit) || 100;

        logger.debug(`📚 getAllWrongWords: Fetching active words for user ${userId}, limit=${limit}`);

        const words = await WrongWord.getActiveWords(userId, limit);

        logger.debug(`✅ getAllWrongWords: Found ${words.length} active words`);

        res.status(200).json({
            success: true,
            count: words.length,
            data: words
        });
    } catch (error) {
        logger.error('Error in getAllWrongWords:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách từ sai',
            error: error.message
        });
    }
};

/**
 * @desc    Xóa từ
 * @route   DELETE /api/wrong-words/:wordId
 * @access  Private
 */
exports.deleteWrongWord = async (req, res) => {
    try {
        const { wordId } = req.params;
        const userId = req.user.id || req.user._id;

        const wrongWord = await WrongWord.findOneAndDelete({ userId, wordId });

        if (!wrongWord) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy từ'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Đã xóa từ'
        });
    } catch (error) {
        logger.error('Error in deleteWrongWord:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa từ',
            error: error.message
        });
    }
};

/**
 * @desc    Thống kê
 * @route   GET /api/wrong-words/stats
 * @access  Private
 */
exports.getStats = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;

        const stats = await WrongWord.getStats(userId);

        // Đếm số từ cần ôn hôm nay
        const now = new Date();
        const todayCount = await WrongWord.countDocuments({
            userId,
            status: 'active',
            nextReviewDate: { $lte: now }
        });

        res.status(200).json({
            success: true,
            data: {
                stats,
                todayReviewCount: todayCount
            }
        });
    } catch (error) {
        logger.error('Error in getStats:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy thống kê',
            error: error.message
        });
    }
};

/**
 * @desc    Bulk update (để migrate data từ GameState.wrongWords cũ)
 * @route   POST /api/wrong-words/bulk
 * @access  Private
 */
exports.bulkUpdate = async (req, res) => {
    try {
        const { words } = req.body;
        const userId = req.user.id || req.user._id;

        if (!Array.isArray(words)) {
            return res.status(400).json({
                success: false,
                message: 'words phải là mảng'
            });
        }

        const results = [];

        for (const wordData of words) {
            try {
                let wrongWord = await WrongWord.findOne({
                    userId,
                    wordId: wordData.id || wordData.wordId
                });

                if (wrongWord) {
                    // Cập nhật wrongCount nếu từ data cũ nhiều hơn
                    if (wordData.wrongCount && wordData.wrongCount > wrongWord.wrongCount) {
                        wrongWord.wrongCount = wordData.wrongCount;
                        wrongWord.calculatePriority();
                        await wrongWord.save();
                    }
                } else {
                    // Tạo mới
                    wrongWord = await WrongWord.create({
                        userId,
                        wordId: wordData.id || wordData.wordId,
                        en: wordData.en || wordData.word,
                        vn: wordData.vn || wordData.vi || wordData.meaning,
                        phonetic: wordData.phonetic,
                        type: wordData.type,
                        level: wordData.level,
                        part: wordData.part,
                        example: wordData.example,
                        image: wordData.image,
                        wrongCount: wordData.wrongCount || 1,
                        lastWrongAt: wordData.lastWrongAt || new Date()
                    });
                    wrongWord.calculatePriority();
                    await wrongWord.save();
                }

                results.push({ wordId: wrongWord.wordId, success: true });
            } catch (err) {
                results.push({
                    wordId: wordData.id || wordData.wordId,
                    success: false,
                    error: err.message
                });
            }
        }

        res.status(200).json({
            success: true,
            message: 'Bulk update hoàn tất',
            data: results
        });
    } catch (error) {
        logger.error('Error in bulkUpdate:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi bulk update',
            error: error.message
        });
    }
};
