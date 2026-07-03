const User = require('../models/User');
const UserProfile = require('../models/UserProfile');
const UserStats = require('../models/UserStats');
const UserAchievement = require('../models/UserAchievement');
const UserQuest = require('../models/UserQuest');
const AchievementDefinition = require('../models/AchievementDefinition');
const ItemDefinition = require('../models/ItemDefinition');

const XP_FORMULA = (level) => Math.floor(100 * Math.pow(level, 1.5));
const ENERGY_REGEN_PER_MIN = 1;

/**
 * Regenerate energy based on time elapsed since last update.
 * Mutates stats object in place (does not save).
 */
function applyEnergyRegen(stats) {
    const now = Date.now();
    const lastUpdate = new Date(stats.lastEnergyUpdate).getTime();
    const minutesPassed = Math.floor((now - lastUpdate) / 60000);

    if (minutesPassed > 0 && stats.energy < stats.maxEnergy) {
        stats.energy = Math.min(
            stats.maxEnergy,
            stats.energy + minutesPassed * ENERGY_REGEN_PER_MIN
        );
        stats.lastEnergyUpdate = new Date(now);
    }
}

/**
 * Check and apply level-up based on current xp.
 * Mutates profile + stats in place (does not save).
 * Returns { leveledUp, newLevel, coinsReward }
 */
function applyLevelUp(profile, stats) {
    let xpNeeded = XP_FORMULA(profile.level);
    let leveledUp = false;
    let coinsReward = 0;

    while (stats.xp >= xpNeeded) {
        leveledUp = true;
        profile.level += 1;
        profile.currentLevelXp = xpNeeded;
        stats.xp -= xpNeeded;
        coinsReward += 100;
        xpNeeded = XP_FORMULA(profile.level);
    }

    return { leveledUp, newLevel: profile.level, coinsReward };
}

/**
 * Build the full game state response (same shape as old User.getPublicProfile).
 * Fetches from all relevant collections.
 */
async function buildFullState(userId) {
    const today = new Date().toISOString().split('T')[0];

    const [user, profile, stats, userAchs, defs, todayQuests] = await Promise.all([
        User.findById(userId),
        UserProfile.findOne({ userId }),
        UserStats.findOne({ userId }),
        UserAchievement.find({ userId }),
        AchievementDefinition.find({ isActive: true }).sort({ order: 1 }),
        UserQuest.findOne({ userId, questType: 'daily', periodKey: today }),
    ]);

    if (!user || !profile || !stats) return null;

    // Merge achievement definitions with user unlock status
    const unlockedMap = new Map(userAchs.map(a => [a.code, a]));
    const achievements = defs.map(def => ({
        id: def.code,
        name: def.name,
        description: def.description,
        icon: def.icon,
        category: def.category,
        conditionType: def.conditionType,
        conditionValue: def.conditionValue,
        conditionMode: def.conditionMode,
        rewardCoins: def.rewardCoins,
        rewardXp: def.rewardXp,
        rewardGems: def.rewardGems,
        unlocked: unlockedMap.has(def.code),
        unlockedAt: unlockedMap.get(def.code)?.unlockedAt || null,
    }));

    // Ảnh cosmetic đang trang bị — lấy TỪ DB (admin sửa được ở catalog vật phẩm),
    // KHÔNG hardcode ở frontend. equippedImages: { avatar, background, frame }.
    const equipped = profile.equipped || {};
    const equippedIds = [...new Set(Object.values(equipped).filter(Boolean))];
    const equippedImages = {};
    if (equippedIds.length) {
        const defs = await ItemDefinition.find({ itemId: { $in: equippedIds } }).select('itemId image').lean();
        const imgById = new Map(defs.map(d => [d.itemId, d.image || '']));
        for (const [slot, id] of Object.entries(equipped)) {
            const img = imgById.get(id);
            if (img) equippedImages[slot] = img;
        }
    }

    return {
        user: {
            id: user._id,
            username: profile.username,
            usernameChangedAt: profile.usernameChangedAt || null,
            email: user.email,
            role: user.role,
            avatar: profile.avatar,
            level: profile.level,
            xp: stats.xp,
            totalXp: stats.totalXp,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt,
            isActive: user.isActive,
            isLocked: user.isLocked,
            lockUntil: user.lockUntil,
            loginAttempts: user.loginAttempts,
        },
        resources: {
            energy: stats.energy,
            maxEnergy: stats.maxEnergy,
            coins: stats.coins,
            gems: stats.gems,
            hints: stats.hints,
            shields: stats.shields,
            timeFreezes: stats.timeFreezes,
            lastEnergyUpdate: stats.lastEnergyUpdate,
        },
        streak: {
            current: stats.streakCurrent,
            longest: stats.streakLongest,
            lastPlayDate: stats.streakLastPlayDate,
            shieldsUsed: stats.streakShieldsUsed,
        },
        progress: {
            wordsLearned: stats.wordsLearned,
            wordsMastered: stats.wordsMastered,
            totalGamesPlayed: stats.totalGamesPlayed,
            totalCorrectAnswers: stats.totalCorrectAnswers,
            totalWrongAnswers: stats.totalWrongAnswers,
            perfectRounds: stats.perfectRounds,
            highestScore: stats.highestScore,
            totalPlayTime: stats.totalPlayTime,
            modeStats: Object.fromEntries(stats.modeStats || new Map()),
        },
        quests: {
            daily: todayQuests?.quests || [],
            lastResetDate: todayQuests?.createdAt || null,
            totalCompleted: todayQuests?.totalCompleted || 0,
        },
        achievements,
        boosts: {
            xp: {
                active: stats.xpBoostActive,
                multiplier: stats.xpBoostMultiplier,
                expiresAt: stats.xpBoostExpiresAt,
            },
            coins: {
                active: stats.coinsBoostActive,
                multiplier: stats.coinsBoostMultiplier,
                expiresAt: stats.coinsBoostExpiresAt,
            },
        },
        vip: {
            active: !!(stats.vipExpiresAt && new Date(stats.vipExpiresAt) > new Date()),
            expiresAt: stats.vipExpiresAt ? new Date(stats.vipExpiresAt).getTime() : 0,
        },
        equipped, // cosmetic đang trang bị (itemId theo slot: background, frame, avatar)
        equippedImages, // ảnh cosmetic đang trang bị (từ DB, admin sửa được)
        transactions: stats.transactions || [],
        settings: profile.settings,
        practiceHistory: stats.practiceHistory || [],
    };
}

/**
 * Create User + UserProfile + UserStats atomically for a new user.
 * @param {object} opts - { email, passwordHash, username, role, skipPasswordHash }
 * @returns {{ user, profile, stats }}
 */
async function createUserWithDependents(opts) {
    const { email, passwordHash, username, role = 'user', skipPasswordHash = false, googleId } = opts;

    const user = new User({ email, password: passwordHash, role, ...(googleId ? { googleId } : {}) });
    if (skipPasswordHash) user.$skipPasswordHash = true;
    await user.save();

    const [profile, stats] = await Promise.all([
        UserProfile.create({
            userId: user._id,
            username,
            avatar: username.charAt(0).toUpperCase(),
        }),
        UserStats.create({ userId: user._id }),
    ]);

    return { user, profile, stats };
}

module.exports = {
    buildFullState,
    applyEnergyRegen,
    applyLevelUp,
    createUserWithDependents,
    XP_FORMULA,
};
