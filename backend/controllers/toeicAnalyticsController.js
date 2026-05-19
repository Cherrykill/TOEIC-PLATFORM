// ===================================
// TOEIC ANALYTICS CONTROLLER
// ===================================
// Split out of toeicController (P4). Self-contained read-only analytics
// over ToeicAttempt — no exam-engine helpers. Verbatim move; behaviour
// unchanged. routes/toeic.js imports these from here now.

const ToeicAttempt = require('../models/ToeicAttempt');

/**
 * @desc    Get user analytics overview
 * @route   GET /api/toeic/analytics/overview
 * @access  Private
 */
exports.getAnalyticsOverview = async (req, res, next) => {
    try {
        const analytics = await ToeicAttempt.getUserAnalytics(req.user.id);

        res.json({
            success: true,
            data: analytics,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get score progression
 * @route   GET /api/toeic/analytics/progress
 * @access  Private
 */
exports.getScoreProgress = async (req, res, next) => {
    try {
        const { limit = 10 } = req.query;

        const progression = await ToeicAttempt.getScoreProgression(
            req.user.id,
            parseInt(limit)
        );

        res.json({
            success: true,
            data: progression,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get part-by-part analysis
 * @route   GET /api/toeic/analytics/parts
 * @access  Private
 */
exports.getPartAnalysis = async (req, res, next) => {
    try {
        const attempts = await ToeicAttempt.find({
            userId: req.user.id,
            status: 'completed',
        }).select('partScores').lean();

        // Aggregate part scores
        const partStats = {};

        for (const attempt of attempts) {
            for (const partScore of attempt.partScores) {
                const part = partScore.partNumber;

                if (!partStats[part]) {
                    partStats[part] = {
                        partNumber: part,
                        attempts: 0,
                        totalAccuracy: 0,
                        avgAccuracy: 0,
                    };
                }

                partStats[part].attempts += 1;
                partStats[part].totalAccuracy += partScore.accuracy;
            }
        }

        // Calculate averages
        const analysis = Object.values(partStats).map(stat => ({
            ...stat,
            avgAccuracy: Math.round(stat.totalAccuracy / stat.attempts),
        }));

        res.json({
            success: true,
            data: analysis,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = exports;
