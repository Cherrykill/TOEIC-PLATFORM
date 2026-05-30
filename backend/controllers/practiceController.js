const UserProfile = require('../models/UserProfile');
const UserStats = require('../models/UserStats');
const PracticeSession = require('../models/PracticeSession');
const { applyLevelUp } = require('../utils/userStateHelper');

const MAX_XP_PER_Q = 100;
const MAX_COINS_PER_Q = 30;

exports.startSession = async (req, res, next) => {
    try {
        const { mode, energyCost = 10 } = req.body;
        if (!mode) return res.status(400).json({ success: false, message: 'Mode is required' });

        const updated = await UserStats.findOneAndUpdate(
            { userId: req.user.id, energy: { $gte: energyCost } },
            { $inc: { energy: -energyCost }, $set: { lastEnergyUpdate: new Date() } },
            { new: true }
        );

        if (!updated) {
            const stats = await UserStats.findOne({ userId: req.user.id });
            return res.status(400).json({
                success: false,
                message: 'Not enough energy',
                energyNeeded: energyCost,
                currentEnergy: stats?.energy ?? 0,
            });
        }

        res.json({ success: true, message: 'Practice session started', energyRemaining: updated.energy });
    } catch (error) {
        next(error);
    }
};

exports.submitSession = async (req, res, next) => {
    try {
        const {
            mode, questionsCount, correctAnswers, wrongAnswers,
            score, duration, energyUsed, xpEarned, coinsEarned,
            wordsLearned = [], answers = [],
            skipStats = false,
        } = req.body;

        if (!mode || questionsCount === undefined) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // skipStats: log session + cập nhật streak, nhưng bỏ qua XP/coins/stats
        // (XP/coins đã được saveState xử lý phía client)
        if (skipStats) {
            const [newSession, stats] = await Promise.all([
                PracticeSession.create({
                    user: req.user.id,
                    mode, questionsCount, correctAnswers: correctAnswers || 0,
                    wrongAnswers: wrongAnswers || 0, score: score || 0,
                    duration: duration || 0, isPerfect: (wrongAnswers || 0) === 0,
                    xpEarned: xpEarned || 0, coinsEarned: coinsEarned || 0,
                    wordsLearned, answers,
                }),
                UserStats.findOne({ userId: req.user.id }),
            ]);

            if (stats) {
                const today = new Date().setHours(0, 0, 0, 0);
                const lastPlay = stats.streakLastPlayDate
                    ? new Date(stats.streakLastPlayDate).setHours(0, 0, 0, 0)
                    : null;

                if (!lastPlay || today > lastPlay) {
                    const daysDiff = lastPlay ? Math.floor((today - lastPlay) / 86400000) : null;
                    if (!lastPlay || daysDiff === 1) {
                        stats.streakCurrent += 1;
                        if (stats.streakCurrent > stats.streakLongest) stats.streakLongest = stats.streakCurrent;
                    } else if (daysDiff > 1 && (stats.shields || 0) >= daysDiff - 1) {
                        stats.shields -= daysDiff - 1;
                        stats.streakShieldsUsed = (stats.streakShieldsUsed || 0) + daysDiff - 1;
                        stats.streakCurrent += 1;
                        if (stats.streakCurrent > stats.streakLongest) stats.streakLongest = stats.streakCurrent;
                    } else {
                        stats.streakCurrent = 1;
                    }
                    stats.streakLastPlayDate = new Date();
                    await stats.save();
                } else if (stats.streakCurrent < 1) {
                    // Đã chơi hôm nay nhưng streak = 0 (data cũ bị lỗi) → sửa lên 1
                    stats.streakCurrent = 1;
                    if (stats.streakCurrent > stats.streakLongest) stats.streakLongest = stats.streakCurrent;
                    await stats.save();
                }

                return res.status(201).json({
                    success: true,
                    session: { id: newSession._id },
                    user: {
                        streak: {
                            current: stats.streakCurrent,
                            longest: stats.streakLongest,
                            lastPlayDate: stats.streakLastPlayDate,
                            shieldsUsed: stats.streakShieldsUsed,
                        },
                        resources: { shields: stats.shields },
                    },
                });
            }

            return res.status(201).json({ success: true, session: { id: newSession._id } });
        }

        const [profile, stats] = await Promise.all([
            UserProfile.findOne({ userId: req.user.id }),
            UserStats.findOne({ userId: req.user.id }),
        ]);

        if (!profile || !stats) return res.status(404).json({ success: false, message: 'User not found' });

        // Save session record
        const newSession = await PracticeSession.create({
            user: req.user.id,
            mode, questionsCount, correctAnswers, wrongAnswers,
            score, duration, isPerfect: wrongAnswers === 0,
            energyUsed, xpEarned, coinsEarned, wordsLearned, answers,
        });

        // Update aggregate stats
        stats.totalGamesPlayed += 1;
        stats.totalCorrectAnswers += correctAnswers;
        stats.totalWrongAnswers += wrongAnswers;
        if (wrongAnswers === 0) stats.perfectRounds += 1;
        if (score > stats.highestScore) stats.highestScore = score;
        if (duration) stats.totalPlayTime = (stats.totalPlayTime || 0) + duration;

        // Mode stats
        const modeEntry = stats.modeStats.get(mode) || { played: 0, score: 0, correct: 0, total: 0 };
        modeEntry.played += 1;
        modeEntry.score = Math.max(modeEntry.score, score);
        modeEntry.correct += correctAnswers;
        modeEntry.total += questionsCount;
        stats.modeStats.set(mode, modeEntry);

        // XP (capped + boost)
        const safeXp = Math.min(Math.max(0, xpEarned), questionsCount * MAX_XP_PER_Q);
        const finalXp = Math.floor(safeXp * (stats.xpBoostActive ? stats.xpBoostMultiplier : 1));
        stats.xp += finalXp;
        stats.totalXp += finalXp;

        const levelUpResult = applyLevelUp(profile, stats);
        if (levelUpResult.leveledUp) stats.coins += levelUpResult.coinsReward;

        // Coins (capped + boost)
        const safeCoins = Math.min(Math.max(0, coinsEarned), questionsCount * MAX_COINS_PER_Q);
        const finalCoins = Math.floor(safeCoins * (stats.coinsBoostActive ? stats.coinsBoostMultiplier : 1));
        stats.coins += finalCoins;

        // Words learned
        if (wordsLearned.length > 0) {
            const learned = new Set(stats.wordsLearned);
            wordsLearned.forEach(w => learned.add(w));
            stats.wordsLearned = [...learned];
        }

        // Streak
        const today = new Date().setHours(0, 0, 0, 0);
        const lastPlay = stats.streakLastPlayDate
            ? new Date(stats.streakLastPlayDate).setHours(0, 0, 0, 0)
            : null;

        if (!lastPlay || today > lastPlay) {
            const daysDiff = lastPlay ? Math.floor((today - lastPlay) / 86400000) : 0;
            if (daysDiff === 1) {
                stats.streakCurrent += 1;
                if (stats.streakCurrent > stats.streakLongest) stats.streakLongest = stats.streakCurrent;
            } else if (daysDiff > 1) {
                // Bỏ qua N ngày. Mỗi shield "đỡ" được 1 ngày — đốt tới khi
                // đủ bù khoảng nghỉ hoặc hết shield. Nếu shield đủ → streak
                // giữ nguyên. Thiếu → reset về 1.
                const skipped = daysDiff - 1;
                const shieldsAvail = stats.shields || 0;
                if (shieldsAvail >= skipped) {
                    stats.shields = shieldsAvail - skipped;
                    stats.streakShieldsUsed = (stats.streakShieldsUsed || 0) + skipped;
                    stats.streakCurrent += 1; // hôm nay vẫn là ngày tiếp theo của chuỗi
                    if (stats.streakCurrent > stats.streakLongest) stats.streakLongest = stats.streakCurrent;
                } else {
                    // Không đủ shield → đốt sạch số có và reset
                    if (shieldsAvail > 0) {
                        stats.streakShieldsUsed = (stats.streakShieldsUsed || 0) + shieldsAvail;
                        stats.shields = 0;
                    }
                    stats.streakCurrent = 1;
                }
            }
            stats.streakLastPlayDate = new Date();
        }

        await Promise.all([profile.save(), stats.save()]);

        const accuracy = questionsCount > 0 ? Math.round((correctAnswers / questionsCount) * 100) : 0;
        let performance = 'poor';
        if (accuracy >= 90) performance = 'excellent';
        else if (accuracy >= 70) performance = 'good';
        else if (accuracy >= 50) performance = 'average';

        res.status(201).json({
            success: true,
            message: 'Practice session submitted successfully',
            session: { id: newSession._id, score: newSession.score, accuracy, performance },
            rewards: {
                xp: finalXp,
                coins: finalCoins + levelUpResult.coinsReward,
                leveledUp: levelUpResult.leveledUp,
                newLevel: profile.level,
            },
            user: {
                id: req.user.id,
                username: profile.username,
                level: profile.level,
                xp: stats.xp,
                resources: {
                    energy: stats.energy, maxEnergy: stats.maxEnergy,
                    coins: stats.coins, gems: stats.gems,
                    hints: stats.hints, shields: stats.shields,
                    lastEnergyUpdate: stats.lastEnergyUpdate,
                },
                streak: {
                    current: stats.streakCurrent, longest: stats.streakLongest,
                    lastPlayDate: stats.streakLastPlayDate, shieldsUsed: stats.streakShieldsUsed,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

exports.getHistory = async (req, res, next) => {
    try {
        const { limit = 20, page = 1, mode } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const query = { user: req.user.id };
        if (mode) query.mode = mode;

        const [sessions, total] = await Promise.all([
            PracticeSession.find(query).sort({ completedAt: -1 }).skip(skip).limit(parseInt(limit)).select('-answers'),
            PracticeSession.countDocuments(query),
        ]);

        res.json({ success: true, count: sessions.length, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), data: sessions });
    } catch (error) {
        next(error);
    }
};

exports.getSessionById = async (req, res, next) => {
    try {
        const session = await PracticeSession.findOne({ _id: req.params.id, user: req.user.id });
        if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
        res.json({ success: true, data: session });
    } catch (error) {
        next(error);
    }
};

exports.getStats = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const [overallStats, modeStatsArray] = await Promise.all([
            PracticeSession.getUserStats(userId),
            PracticeSession.getModeStats(userId),
        ]);

        const byMode = {};
        modeStatsArray.forEach(s => {
            byMode[s._id] = { played: s.played, totalScore: s.totalScore, highestScore: s.highestScore, accuracy: Math.round(s.accuracy) };
        });

        res.json({ success: true, data: { overall: overallStats, byMode } });
    } catch (error) {
        next(error);
    }
};

exports.getRecentSessions = async (req, res, next) => {
    try {
        const { limit = 10 } = req.query;
        const sessions = await PracticeSession.find({ user: req.user.id })
            .sort({ completedAt: -1 })
            .limit(parseInt(limit))
            .select('mode score correctAnswers wrongAnswers completedAt');
        res.json({ success: true, count: sessions.length, data: sessions });
    } catch (error) {
        next(error);
    }
};

// ── ADMIN ─────────────────────────────────────────────────────────────────────
const User = require('../models/User');

exports.adminGetHistory = async (req, res, next) => {
    try {
        const { userId, mode, page = 1, limit = 20, search = '' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const query = {};
        if (userId) query.user = userId;
        if (mode)   query.mode = mode;

        const [sessions, total] = await Promise.all([
            PracticeSession.find(query)
                .populate('user', 'email')
                .sort({ completedAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .select('-answers')
                .lean(),
            PracticeSession.countDocuments(query),
        ]);

        // Filter by email search after populate
        const filtered = search
            ? sessions.filter(s => s.user?.email?.toLowerCase().includes(search.toLowerCase()))
            : sessions;

        res.json({ success: true, data: filtered, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
    } catch (error) {
        next(error);
    }
};

exports.adminGetUsersList = async (req, res, next) => {
    try {
        const users = await User.find({ isActive: true }).select('email').limit(200).lean();
        res.json({ success: true, data: users });
    } catch (error) {
        next(error);
    }
};

exports.adminDeleteSession = async (req, res, next) => {
    try {
        await PracticeSession.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
};
