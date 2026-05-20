const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const User = require('../models/User');
const UserProfile = require('../models/UserProfile');
const UserStats = require('../models/UserStats');

const SORT_FIELD_MAP = { score: 'highestScore', xp: 'xp', totalXp: 'totalXp' };
const ONLINE_THRESHOLD_MS = 15 * 60 * 1000;

function getPeriodQuery(period) {
    const now = new Date();
    if (period === 'daily') {
        return { lastLoginAt: { $gte: new Date(now.setHours(0, 0, 0, 0)) } };
    } else if (period === 'weekly') {
        const start = new Date(now);
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        return { lastLoginAt: { $gte: start } };
    }
    return {};
}

// Số user "online" — lastLoginAt trong vòng ONLINE_THRESHOLD_MS gần nhất.
// Đặt TRƯỚC route ':period?' không sẽ bị nuốt thành period='online-count'.
router.get('/online-count', async (req, res) => {
    try {
        const onlineThreshold = new Date(Date.now() - ONLINE_THRESHOLD_MS);
        const count = await User.countDocuments({
            isActive: true,
            role: { $ne: 'admin' },
            lastLoginAt: { $gte: onlineThreshold },
        });
        res.json({ success: true, count });
    } catch (error) {
        logger.error('Online count error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch online count' });
    }
});

router.get('/:period?', async (req, res) => {
    try {
        const { period = 'all-time' } = req.params;
        const { limit = 100, sortBy = 'totalXp' } = req.query;
        const limitNum = Math.min(parseInt(limit) || 100, 100);
        const sortField = SORT_FIELD_MAP[sortBy] || 'totalXp';
        const onlineThreshold = new Date(Date.now() - ONLINE_THRESHOLD_MS);

        // Eligible userIds from User (filter inactive + admin + period)
        const userQuery = { isActive: true, role: { $ne: 'admin' }, ...getPeriodQuery(period) };
        const eligibleUsers = await User.find(userQuery).select('_id lastLoginAt').lean();
        const eligibleIds = eligibleUsers.map(u => u._id);
        const lastLoginMap = new Map(eligibleUsers.map(u => [u._id.toString(), u.lastLoginAt]));

        const topStats = await UserStats.find({ userId: { $in: eligibleIds } })
            .sort({ [sortField]: -1 })
            .limit(limitNum)
            .lean();

        const profileMap = await fetchProfileMap(topStats.map(s => s.userId));

        const leaderboard = topStats.map((s, i) => {
            const p = profileMap.get(s.userId.toString()) || {};
            const lastLogin = lastLoginMap.get(s.userId.toString());
            return {
                rank: i + 1,
                id: s.userId,
                username: p.username || '—',
                avatar: p.avatar || '?',
                level: p.level || 1,
                xp: s.xp || 0,
                totalXp: s.totalXp || 0,
                score: s.highestScore || 0,
                streak: s.streakCurrent || 0,
                gamesPlayed: s.totalGamesPlayed || 0,
                isOnline: lastLogin && new Date(lastLogin) >= onlineThreshold,
            };
        });

        res.json({ success: true, period, sortBy: sortField, count: leaderboard.length, data: leaderboard });
    } catch (error) {
        logger.error('Leaderboard error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch leaderboard', error: error.message });
    }
});

router.get('/rank/:userId/:period?', async (req, res) => {
    try {
        const { userId, period = 'all-time' } = req.params;
        const { sortBy = 'totalXp' } = req.query;
        const sortField = SORT_FIELD_MAP[sortBy] || 'totalXp';

        // Reject non-ObjectId userId (e.g. guest localStorage IDs)
        if (!userId.match(/^[a-f\d]{24}$/i)) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const user = await User.findById(userId).lean();
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const stats = await UserStats.findOne({ userId }).lean();
        const profile = await UserProfile.findOne({ userId }).lean();

        const baseQuery = { isActive: true, role: { $ne: 'admin' }, ...getPeriodQuery(period) };
        const eligibleUsers = await User.find(baseQuery).select('_id').lean();
        const eligibleIds = eligibleUsers.map(u => u._id);

        const userValue = stats?.[sortField] || 0;

        const [betterCount, totalUsers] = await Promise.all([
            UserStats.countDocuments({ userId: { $in: eligibleIds }, [sortField]: { $gt: userValue } }),
            UserStats.countDocuments({ userId: { $in: eligibleIds } }),
        ]);

        const rank = betterCount + 1;

        const [aboveStats, belowStats] = await Promise.all([
            UserStats.find({ userId: { $in: eligibleIds }, [sortField]: { $gte: userValue }, userId: { $ne: userId } })
                .sort({ [sortField]: -1 }).limit(3).lean(),
            UserStats.find({ userId: { $in: eligibleIds }, [sortField]: { $lt: userValue } })
                .sort({ [sortField]: -1 }).limit(3).lean(),
        ]);

        const allNearbyIds = [...aboveStats, ...belowStats].map(s => s.userId);
        const nearbyProfiles = await fetchProfileMap(allNearbyIds);

        const formatNearby = (s) => {
            const p = nearbyProfiles.get(s.userId.toString()) || {};
            return { _id: s.userId, username: p.username || '—', avatar: p.avatar || '?', level: p.level || 1, [sortField]: s[sortField] || 0 };
        };

        res.json({
            success: true,
            data: {
                userId: user._id,
                username: profile?.username,
                rank,
                totalUsers,
                percentile: rank > 0 ? Math.round((1 - (rank / totalUsers)) * 100) : 0,
                value: userValue,
                nearbyAbove: aboveStats.map(formatNearby),
                nearbyBelow: belowStats.map(formatNearby),
            },
        });
    } catch (error) {
        logger.error('User rank error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user rank', error: error.message });
    }
});

router.get('/stats/:period?', async (req, res) => {
    try {
        const { period = 'all-time' } = req.params;

        const baseQuery = { isActive: true, role: { $ne: 'admin' }, ...getPeriodQuery(period) };
        const eligibleUsers = await User.find(baseQuery).select('_id').lean();
        const eligibleIds = eligibleUsers.map(u => u._id);

        const [statAgg] = await UserStats.aggregate([
            { $match: { userId: { $in: eligibleIds } } },
            {
                $group: {
                    _id: null,
                    totalPlayers: { $sum: 1 },
                    averageXp: { $avg: '$totalXp' },
                    highestXp: { $max: '$totalXp' },
                    lowestXp: { $min: '$totalXp' },
                    averageScore: { $avg: '$highestScore' },
                    highestScore: { $max: '$highestScore' },
                },
            },
        ]);

        const profileAgg = await UserProfile.aggregate([
            { $match: { userId: { $in: eligibleIds } } },
            { $group: { _id: null, averageLevel: { $avg: '$level' }, maxLevel: { $max: '$level' } } },
        ]);

        const data = statAgg ? {
            totalPlayers: statAgg.totalPlayers,
            averageXp: Math.round(statAgg.averageXp || 0),
            highestXp: statAgg.highestXp || 0,
            lowestXp: statAgg.lowestXp || 0,
            averageScore: Math.round(statAgg.averageScore || 0),
            highestScore: statAgg.highestScore || 0,
            averageLevel: Math.round(profileAgg[0]?.averageLevel || 0),
            maxLevel: profileAgg[0]?.maxLevel || 0,
        } : { totalPlayers: 0, averageXp: 0, highestXp: 0, lowestXp: 0, averageScore: 0, highestScore: 0, averageLevel: 0, maxLevel: 0 };

        res.json({ success: true, period, data });
    } catch (error) {
        logger.error('Leaderboard stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch statistics', error: error.message });
    }
});

async function fetchProfileMap(userIds) {
    const profiles = await UserProfile.find({ userId: { $in: userIds } }).lean();
    return new Map(profiles.map(p => [p.userId.toString(), p]));
}

module.exports = router;
