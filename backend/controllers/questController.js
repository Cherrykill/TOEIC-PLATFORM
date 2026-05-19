const UserQuest = require('../models/UserQuest');
const UserStats = require('../models/UserStats');
const QuestDefinition = require('../models/QuestDefinition');
const logger = require('../utils/logger');
// Period math moved to services/questPeriod.js (Phase 3).
const { getPeriodKey, getNextReset } = require('../services/questPeriod');

// How many quests to assign per type
const QUEST_COUNT = { daily: 3, weekly: 3, monthly: 2, special: 5 };

async function generateQuests(userId, type, periodKey) {
    const defs = await QuestDefinition.find({ type, isActive: true }).lean();
    if (!defs.length) return [];

    // Weighted random selection
    const count = QUEST_COUNT[type] || 3;
    const selected = weightedSample(defs, count);

    const entries = selected.map(d => ({
        questDefinitionId: d._id,
        code:        d.code,
        name:        d.name,
        description: d.description || '',
        icon:        d.icon || '',
        mode:        d.mode || 'any',
        metric:      d.metric || '',
        target:      d.target,
        rewardCoins: d.rewardCoins || 0,
        rewardXp:    d.rewardXp || 0,
        rewardGems:  d.rewardGems || 0,
        progress:    0,
        completed:   false,
    }));

    const doc = await UserQuest.create({ userId, questType: type, periodKey, quests: entries });
    return doc;
}

function weightedSample(items, n) {
    if (items.length <= n) return [...items];
    const pool = [...items];
    const result = [];
    for (let i = 0; i < n; i++) {
        const totalWeight = pool.reduce((s, it) => s + (it.weight || 1), 0);
        let rnd = Math.random() * totalWeight;
        const idx = pool.findIndex(it => { rnd -= (it.weight || 1); return rnd <= 0; });
        result.push(pool.splice(idx === -1 ? 0 : idx, 1)[0]);
    }
    return result;
}

// ── Controllers ───────────────────────────────────────────────────────────────

const getQuests = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const type = ['daily', 'weekly', 'monthly', 'special'].includes(req.query.type)
            ? req.query.type : 'daily';

        const periodKey = getPeriodKey(type);
        let doc = await UserQuest.findOne({ userId, questType: type, periodKey }).lean();

        if (!doc) {
            doc = await generateQuests(userId, type, periodKey);
            if (!doc) {
                return res.json({ success: true, data: { type, periodKey, quests: [], nextReset: getNextReset(type) } });
            }
            doc = doc.toObject ? doc.toObject() : doc;
        }

        res.json({
            success: true,
            data: {
                type,
                periodKey,
                quests: doc.quests,
                totalCompleted: doc.totalCompleted,
                nextReset: getNextReset(type),
            },
        });
    } catch (err) {
        logger.error('getQuests error', { error: err.message });
        next(err);
    }
};

// Sync progress from client after a game session
// Body: { type, updates: [{ code, value }] }  — value is the NEW total, not delta
const syncProgress = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { type = 'daily', updates = [] } = req.body;
        if (!updates.length) return res.json({ success: true });

        const periodKey = getPeriodKey(type);
        let doc = await UserQuest.findOne({ userId, questType: type, periodKey });
        if (!doc) {
            doc = await generateQuests(userId, type, periodKey);
            if (!doc) return res.json({ success: true });
        }

        let changed = false;
        for (const { code, value } of updates) {
            const q = doc.quests.find(q => q.code === code);
            if (!q || q.completed) continue;
            const newProgress = Math.max(q.progress, value); // only go up
            if (newProgress !== q.progress) {
                q.progress = newProgress;
                changed = true;
            }
            if (!q.completed && q.progress >= q.target) {
                q.completed = true;
                q.completedAt = new Date();
                doc.totalCompleted += 1;
                changed = true;
            }
        }

        if (changed) await doc.save();

        res.json({ success: true, data: { quests: doc.quests, totalCompleted: doc.totalCompleted } });
    } catch (err) {
        logger.error('syncProgress error', { error: err.message });
        next(err);
    }
};

// Claim reward for a completed quest
// Body: { type, periodKey, code }
const claimReward = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { type = 'daily', code } = req.body;
        if (!code) return res.status(400).json({ success: false, message: 'Missing quest code' });

        const periodKey = getPeriodKey(type);
        const doc = await UserQuest.findOne({ userId, questType: type, periodKey });
        if (!doc) return res.status(404).json({ success: false, message: 'Quest period not found' });

        const q = doc.quests.find(q => q.code === code);
        if (!q) return res.status(404).json({ success: false, message: 'Quest not found' });
        if (!q.completed) return res.status(400).json({ success: false, message: 'Quest not completed yet' });
        if (q.claimedAt) return res.status(400).json({ success: false, message: 'Reward already claimed' });

        q.claimedAt = new Date();
        doc.totalRewards.coins += q.rewardCoins;
        doc.totalRewards.xp    += q.rewardXp;
        doc.totalRewards.gems  += q.rewardGems;

        const stats = await UserStats.findOne({ userId });
        if (stats) {
            stats.coins += q.rewardCoins;
            stats.xp    += q.rewardXp;
            stats.totalXp += q.rewardXp;
            stats.gems  += q.rewardGems;
            await stats.save();
        }

        await doc.save();

        res.json({
            success: true,
            message: 'Phần thưởng đã được nhận!',
            rewards: { coins: q.rewardCoins, xp: q.rewardXp, gems: q.rewardGems },
        });
    } catch (err) {
        logger.error('claimReward error', { error: err.message });
        next(err);
    }
};

// Seed default quest definitions (admin only)
const seedDefaults = async (req, res, next) => {
    try {
        const defaults = [
            // Daily
            { code: 'daily_complete_games',  name: 'Hoàn thành {target} lượt chơi', description: 'Chơi bất kỳ chế độ nào',             icon: '🎮', type: 'daily',   mode: 'any',        metric: 'complete-games',  target: 5,   rewardCoins: 50,  rewardXp: 25,  weight: 3 },
            { code: 'daily_correct_answers', name: 'Trả lời đúng {target} câu',     description: 'Trả lời đúng trong bất kỳ chế độ',  icon: '✅', type: 'daily',   mode: 'any',        metric: 'correct-answers', target: 20,  rewardCoins: 75,  rewardXp: 40,  weight: 3 },
            { code: 'daily_learn_words',     name: 'Học {target} từ mới',           description: 'Làm quen với từ vựng mới',           icon: '📚', type: 'daily',   mode: 'any',        metric: 'learn-words',     target: 15,  rewardCoins: 90,  rewardXp: 45,  weight: 3 },
            { code: 'daily_streak',          name: 'Duy trì streak hôm nay',        description: 'Chơi ít nhất 1 game hôm nay',        icon: '🔥', type: 'daily',   mode: 'any',        metric: 'daily-streak',    target: 1,   rewardCoins: 100, rewardXp: 50,  weight: 2 },
            { code: 'daily_earn_xp',         name: 'Kiếm {target} XP',             description: 'Tích lũy kinh nghiệm',              icon: '📈', type: 'daily',   mode: 'any',        metric: 'earn-xp',         target: 200, rewardCoins: 80,  rewardXp: 30,  weight: 2 },
            { code: 'daily_speed_quiz',      name: 'Chơi {target} lượt Speed Quiz', description: 'Hoàn thành chế độ tốc độ',          icon: '⚡', type: 'daily',   mode: 'speed-quiz', metric: 'play-mode',       target: 3,   rewardCoins: 60,  rewardXp: 35,  weight: 1 },
            { code: 'daily_perfect_rounds',  name: 'Đạt {target} vòng hoàn hảo',   description: 'Trả lời đúng toàn bộ trong 1 vòng', icon: '⭐', type: 'daily',   mode: 'any',        metric: 'perfect-rounds',  target: 2,   rewardCoins: 100, rewardXp: 50,  weight: 1 },
            // Weekly
            { code: 'weekly_learn_words',    name: 'Học {target} từ trong tuần',    description: 'Mục tiêu từ vựng cả tuần',          icon: '📖', type: 'weekly',  mode: 'any',        metric: 'learn-words',     target: 100, rewardCoins: 300, rewardXp: 150, rewardGems: 5,  weight: 3 },
            { code: 'weekly_play_sessions',  name: 'Hoàn thành {target} lượt chơi', description: 'Chơi đều đặn mỗi ngày trong tuần',  icon: '🎯', type: 'weekly',  mode: 'any',        metric: 'complete-games',  target: 30,  rewardCoins: 250, rewardXp: 120, rewardGems: 3,  weight: 3 },
            { code: 'weekly_streak',         name: 'Duy trì streak {target} ngày',  description: 'Không bỏ ngày nào trong tuần',      icon: '🔥', type: 'weekly',  mode: 'any',        metric: 'daily-streak',    target: 7,   rewardCoins: 500, rewardXp: 200, rewardGems: 10, weight: 2 },
            // Monthly
            { code: 'monthly_learn_words',   name: 'Học {target} từ trong tháng',   description: 'Chinh phục từ vựng cả tháng',       icon: '🏆', type: 'monthly', mode: 'any',        metric: 'learn-words',     target: 500, rewardCoins: 1000, rewardXp: 500, rewardGems: 20, weight: 2 },
            { code: 'monthly_perfect_games', name: 'Đạt {target} vòng hoàn hảo',   description: 'Thể hiện kỹ năng xuất sắc',         icon: '💎', type: 'monthly', mode: 'any',        metric: 'perfect-rounds',  target: 20,  rewardCoins: 800, rewardXp: 400, rewardGems: 15, weight: 2 },
            // Special
            { code: 'special_first_toeic',   name: 'Làm bài TOEIC đầu tiên',       description: 'Hoàn thành 1 bài thi TOEIC',        icon: '🎓', type: 'special', mode: 'toeic',      metric: '',                target: 1,   rewardCoins: 500, rewardXp: 300, rewardGems: 10, weight: 1 },
        ];

        let created = 0, skipped = 0;
        for (const d of defaults) {
            const exists = await QuestDefinition.findOne({ code: d.code });
            if (exists) { skipped++; continue; }
            await QuestDefinition.create(d);
            created++;
        }

        res.json({ success: true, message: `Seeded ${created} quest definitions (${skipped} already existed)` });
    } catch (err) {
        logger.error('seedDefaults error', { error: err.message });
        next(err);
    }
};

module.exports = { getQuests, syncProgress, claimReward, seedDefaults };
