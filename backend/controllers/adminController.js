const User            = require('../models/User');
const UserProfile     = require('../models/UserProfile');
const UserStats       = require('../models/UserStats');
const UserAchievement = require('../models/UserAchievement');
const AchievementDefinition = require('../models/AchievementDefinition');
const Notification    = require('../models/Notification');

// ── GET /api/admin/users-stats  ──────────────────────────────────────────────
// Danh sách user kèm profile + stats (cho tab "User Stats" trong dashboard)
exports.getUsersStats = async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 30);
        const search = (req.query.search || '').trim().toLowerCase();

        // Lấy users từ MongoDB (User model dùng Mongoose)
        const userQuery = search
            ? { $or: [
                { email: { $regex: search, $options: 'i' } },
              ] }
            : {};

        const total = await User.countDocuments(userQuery);
        const users = await User.find(userQuery)
            .select('email role isActive createdAt lastLoginAt')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        const userIds = users.map(u => u._id);

        // Batch-fetch profiles + stats
        const [profiles, stats] = await Promise.all([
            UserProfile.find({ userId: { $in: userIds } })
                .select('userId username displayName avatar level currentLevelXp')
                .lean(),
            UserStats.find({ userId: { $in: userIds } })
                .select('userId xp totalXp coins gems streakCurrent streakLongest totalSessions totalCorrectAnswers')
                .lean(),
        ]);

        const profileMap = Object.fromEntries(profiles.map(p => [String(p.userId), p]));
        const statsMap   = Object.fromEntries(stats.map(s => [String(s.userId), s]));

        const data = users.map(u => {
            const id = String(u._id);
            const p  = profileMap[id] || {};
            const s  = statsMap[id]   || {};
            return {
                _id:         u._id,
                email:       u.email,
                role:        u.role,
                isActive:    u.isActive,
                createdAt:   u.createdAt,
                lastLoginAt: u.lastLoginAt,
                username:    p.username    || '',
                displayName: p.displayName || '',
                level:       p.level       || 1,
                xp:          s.xp          || 0,
                totalXp:     s.totalXp     || 0,
                coins:       s.coins       || 0,
                gems:        s.gems        || 0,
                streakCurrent:  s.streakCurrent  || 0,
                streakLongest:  s.streakLongest  || 0,
                totalSessions:  s.totalSessions  || 0,
                totalCorrect:   s.totalCorrectAnswers || 0,
            };
        });

        res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── GET /api/admin/user-achievements  ───────────────────────────────────────
// Thành tích của 1 user cụ thể
exports.getUserAchievements = async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

        const unlocked = await UserAchievement.find({ userId })
            .select('achievementDefinitionId unlockedAt claimedRewards')
            .lean();

        const defIds = unlocked.map(u => u.achievementDefinitionId);
        const defs   = await AchievementDefinition.find({ _id: { $in: defIds } })
            .select('name description icon category rewardXp rewardCoins rewardGems')
            .lean();
        const defMap = Object.fromEntries(defs.map(d => [String(d._id), d]));

        const data = unlocked.map(u => ({
            ...defMap[String(u.achievementDefinitionId)] || { name: 'Unknown', icon: '🏆' },
            unlockedAt:    u.unlockedAt,
            claimedRewards: u.claimedRewards,
        }));

        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── GET /api/admin/notifications  ───────────────────────────────────────────
// Xem tất cả notification trong hệ thống
exports.listNotifications = async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 30);
        const type  = req.query.type || '';

        const filter = type ? { type } : {};
        const total  = await Notification.countDocuments(filter);
        const items  = await Notification.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('userId', 'email')
            .lean();

        res.json({ success: true, data: items, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── POST /api/admin/notifications/broadcast  ────────────────────────────────
// Gửi thông báo đến TẤT CẢ user hoặc 1 user cụ thể
exports.broadcastNotification = async (req, res) => {
    try {
        const { title, body, type = 'system', userId, userEmail } = req.body;
        if (!title) return res.status(400).json({ success: false, message: 'title required' });

        let userIds;
        if (userId) {
            userIds = [userId];
        } else if (userEmail) {
            const user = await User.findOne({ email: userEmail.toLowerCase().trim() }).select('_id').lean();
            if (!user) return res.status(404).json({ success: false, message: `Không tìm thấy user: ${userEmail}` });
            userIds = [user._id];
        } else {
            const users = await User.find({ isActive: { $ne: false } }).select('_id').lean();
            userIds = users.map(u => u._id);
        }

        if (!userIds.length) return res.json({ success: true, sent: 0 });

        // Tạo notification docs (insertMany cho hiệu quả)
        const docs = userIds.map(uid => ({
            userId: uid,
            type,
            title,
            body: body || '',
            read: false,
        }));

        await Notification.insertMany(docs, { ordered: false });

        res.json({ success: true, sent: docs.length });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── DELETE /api/admin/notifications/:id  ────────────────────────────────────
exports.deleteNotification = async (req, res) => {
    try {
        await Notification.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
