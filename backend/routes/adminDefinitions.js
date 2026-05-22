const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const AchievementDefinition = require('../models/AchievementDefinition');
const QuestDefinition = require('../models/QuestDefinition');
const ShopItem = require('../models/ShopItem');
const adminCtrl = require('../controllers/adminController');

const admin = [protect, authorize('admin')];

// ── User Stats & Achievements ────────────────────────────────
router.get('/users-stats',         admin, adminCtrl.getUsersStats);
router.get('/user-achievements',   admin, adminCtrl.getUserAchievements);

// ── Notifications (admin) ────────────────────────────────────
router.get('/notifications',              admin, adminCtrl.listNotifications);
router.post('/notifications/broadcast',   admin, adminCtrl.broadcastNotification);
router.delete('/notifications/:id',       admin, adminCtrl.deleteNotification);

// ── Achievement Definitions ──────────────────────────────────
router.get('/achievements', admin, async (req, res) => {
    const data = await AchievementDefinition.find().sort({ order: 1, createdAt: 1 });
    res.json({ success: true, data });
});

router.get('/achievements/:id', admin, async (req, res) => {
    const data = await AchievementDefinition.findById(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
});

router.post('/achievements', admin, async (req, res) => {
    try {
        const data = await AchievementDefinition.create(req.body);
        res.status(201).json({ success: true, message: 'Đã tạo thành tích', data });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

router.put('/achievements/:id', admin, async (req, res) => {
    try {
        const data = await AchievementDefinition.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Đã cập nhật thành tích', data });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

router.delete('/achievements/delete-all', admin, async (req, res) => {
    const result = await AchievementDefinition.deleteMany({});
    res.json({ success: true, message: `Đã xóa ${result.deletedCount} thành tích`, deletedCount: result.deletedCount });
});

router.delete('/achievements/:id', admin, async (req, res) => {
    const data = await AchievementDefinition.findByIdAndDelete(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Đã xóa thành tích' });
});

// ── Quest Definitions ────────────────────────────────────────
router.get('/quests', admin, async (req, res) => {
    const data = await QuestDefinition.find().sort({ type: 1, createdAt: 1 });
    res.json({ success: true, data });
});

router.get('/quests/:id', admin, async (req, res) => {
    const data = await QuestDefinition.findById(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
});

router.post('/quests', admin, async (req, res) => {
    try {
        const data = await QuestDefinition.create(req.body);
        res.status(201).json({ success: true, message: 'Đã tạo nhiệm vụ', data });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

router.put('/quests/:id', admin, async (req, res) => {
    try {
        const data = await QuestDefinition.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Đã cập nhật nhiệm vụ', data });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

router.delete('/quests/delete-all', admin, async (req, res) => {
    const result = await QuestDefinition.deleteMany({});
    res.json({ success: true, message: `Đã xóa ${result.deletedCount} nhiệm vụ`, deletedCount: result.deletedCount });
});

router.delete('/quests/:id', admin, async (req, res) => {
    const data = await QuestDefinition.findByIdAndDelete(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Đã xóa nhiệm vụ' });
});

// ── Shop Items ───────────────────────────────────────────────
router.get('/shop-items', admin, async (req, res) => {
    const data = await ShopItem.find().sort({ order: 1 });
    res.json({ success: true, data });
});

router.get('/shop-items/:id', admin, async (req, res) => {
    const data = await ShopItem.findById(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
});

router.post('/shop-items', admin, async (req, res) => {
    try {
        const data = await ShopItem.create(req.body);
        res.status(201).json({ success: true, message: 'Đã tạo item', data });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

router.put('/shop-items/:id', admin, async (req, res) => {
    try {
        const { itemId, _id, __v, ...fields } = req.body;
        if (fields.discountPercent !== undefined) fields.discountPercent = Number(fields.discountPercent) || 0;
        if (fields.price !== undefined) fields.price = Number(fields.price);
        if (fields.order !== undefined) fields.order = Number(fields.order);
        const data = await ShopItem.findByIdAndUpdate(
            req.params.id,
            { $set: fields },
            { new: true, runValidators: true }
        );
        if (!data) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Đã cập nhật item', data });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

router.delete('/shop-items/:id', admin, async (req, res) => {
    const data = await ShopItem.findByIdAndDelete(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Đã xóa item' });
});

// ── Seed defaults ─────────────────────────────────────────────
router.post('/seed-achievements', admin, async (req, res) => {
    const defaults = [
        { code: 'learning1', name: 'Người mới bắt đầu', description: 'Học 10 từ vựng đầu tiên',      icon: '📖', category: 'learning', conditionType: 'words_learned', conditionValue: 10,  rewardCoins: 100, rewardXp: 50,  rewardGems: 0,  order: 1 },
        { code: 'learning2', name: 'Học sinh chăm chỉ', description: 'Học 50 từ vựng',               icon: '🎓', category: 'learning', conditionType: 'words_learned', conditionValue: 50,  rewardCoins: 300, rewardXp: 150, rewardGems: 5,  order: 2 },
        { code: 'learning3', name: 'Bậc thầy từ vựng', description: 'Học 200 từ vựng',              icon: '🏆', category: 'learning', conditionType: 'words_learned', conditionValue: 200, rewardCoins: 1000,rewardXp: 500, rewardGems: 20, order: 3 },
        { code: 'learning4', name: 'Từ điển sống',      description: 'Học 500 từ vựng',              icon: '📚', category: 'learning', conditionType: 'words_learned', conditionValue: 500, rewardCoins: 2000,rewardXp: 1000,rewardGems: 50, order: 4 },
        { code: 'practice1', name: 'Tay mơ',            description: 'Hoàn thành 5 bài luyện tập',  icon: '🎮', category: 'practice', conditionType: 'sessions',      conditionValue: 5,   rewardCoins: 50,  rewardXp: 25,  rewardGems: 0,  order: 10 },
        { code: 'practice2', name: 'Điểm số hoàn hảo',  description: 'Đạt 10 vòng hoàn hảo',        icon: '⭐', category: 'practice', conditionType: 'perfect_rounds',conditionValue: 10,  rewardCoins: 500, rewardXp: 250, rewardGems: 10, order: 11 },
        { code: 'practice3', name: 'Tốc độ ánh sáng',   description: 'Trả lời 100 câu đúng',        icon: '⚡', category: 'practice', conditionType: 'correct_answers',conditionValue: 100, rewardCoins: 300, rewardXp: 150, rewardGems: 0,  order: 12 },
        { code: 'practice4', name: 'Chiến binh',         description: 'Hoàn thành 50 bài luyện tập', icon: '⚔️', category: 'practice', conditionType: 'sessions',      conditionValue: 50,  rewardCoins: 800, rewardXp: 400, rewardGems: 15, order: 13 },
        { code: 'streak1',   name: 'Streaker',           description: 'Học liên tục 7 ngày',         icon: '🔥', category: 'streak',   conditionType: 'streak',        conditionValue: 7,   rewardCoins: 500, rewardXp: 250, rewardGems: 15, order: 20 },
        { code: 'streak2',   name: 'Ngọn lửa bất diệt', description: 'Duy trì streak 30 ngày',      icon: '🌟', category: 'streak',   conditionType: 'streak',        conditionValue: 30,  rewardCoins: 2000,rewardXp: 1000,rewardGems: 50, order: 21 },
        { code: 'social1',   name: 'Top 10',             description: 'Lọt vào top 10 bảng xếp hạng',icon: '🥇', category: 'social',   conditionType: 'leaderboard',   conditionValue: 10,  rewardCoins: 0,   rewardXp: 0,   rewardGems: 50, order: 30 },
        { code: 'special1',  name: 'Huyền thoại',        description: 'Đạt level 50',                icon: '👑', category: 'skill',    conditionType: 'level',         conditionValue: 50,  rewardCoins: 0,   rewardXp: 0,   rewardGems: 100,order: 40 },
    ];

    let created = 0, skipped = 0;
    for (const d of defaults) {
        const exists = await AchievementDefinition.findOne({ code: d.code });
        if (exists) { skipped++; continue; }
        await AchievementDefinition.create({ ...d, isActive: true });
        created++;
    }
    res.json({ success: true, message: `Seeded ${created} achievements (${skipped} already existed)` });
});

router.post('/seed-quests', admin, async (req, res) => {
    const { seedDefaults } = require('../controllers/questController');
    return seedDefaults(req, res);
});

// ── AI Token Usage (admin) ────────────────────────────────────
// Tổng hợp token đã dùng + cost USD theo từng feature, theo ngày,
// theo user. Phục vụ tab "Token Management" trong admin dashboard.
router.get('/ai-usage', admin, async (req, res) => {
    const AiUsageLog = require('../models/AiUsageLog');
    const User = require('../models/User');

    try {
        const days = Math.max(1, Math.min(parseInt(req.query.days) || 30, 90));
        const since = new Date(Date.now() - days * 86400000);
        const matchRecent = { createdAt: { $gte: since } };

        const [overall, byFeature, byDay, recent, allTime] = await Promise.all([
            // Tổng trong khoảng days
            AiUsageLog.aggregate([
                { $match: matchRecent },
                { $group: {
                    _id: null,
                    totalTokens: { $sum: '$totalTokens' },
                    promptTokens: { $sum: '$promptTokens' },
                    completionTokens: { $sum: '$completionTokens' },
                    totalCost: { $sum: '$costUsd' },
                    calls: { $sum: 1 },
                    users: { $addToSet: '$userId' },
                }},
            ]),
            // Theo feature
            AiUsageLog.aggregate([
                { $match: matchRecent },
                { $group: {
                    _id: '$feature',
                    tokens: { $sum: '$totalTokens' },
                    cost: { $sum: '$costUsd' },
                    calls: { $sum: 1 },
                }},
                { $sort: { tokens: -1 } },
            ]),
            // Theo ngày (chart)
            AiUsageLog.aggregate([
                { $match: matchRecent },
                { $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    tokens: { $sum: '$totalTokens' },
                    cost: { $sum: '$costUsd' },
                    calls: { $sum: 1 },
                }},
                { $sort: { _id: 1 } },
            ]),
            // 30 lần gọi gần nhất
            AiUsageLog.find(matchRecent).sort({ createdAt: -1 }).limit(30).lean(),
            // Tổng all-time
            AiUsageLog.aggregate([
                { $group: { _id: null, totalTokens: { $sum: '$totalTokens' }, totalCost: { $sum: '$costUsd' }, calls: { $sum: 1 } } },
            ]),
        ]);

        // Đính email cho recent calls
        const userIds = [...new Set(recent.map(r => String(r.userId)).filter(Boolean))];
        const users = userIds.length ? await User.find({ _id: { $in: userIds } }).select('email').lean() : [];
        const userMap = new Map(users.map(u => [String(u._id), u.email]));
        const recentWithEmail = recent.map(r => ({
            ...r,
            email: r.userId ? (userMap.get(String(r.userId)) || '—') : '(system)',
        }));

        const o = overall[0] || {};
        res.json({
            success: true,
            data: {
                days,
                totalTokens: o.totalTokens || 0,
                promptTokens: o.promptTokens || 0,
                completionTokens: o.completionTokens || 0,
                totalCost: o.totalCost || 0,
                calls: o.calls || 0,
                users: (o.users || []).filter(Boolean).length,
                byFeature,
                byDay,
                recent: recentWithEmail,
                allTime: allTime[0] || { totalTokens: 0, totalCost: 0, calls: 0 },
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
