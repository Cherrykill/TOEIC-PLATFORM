const UserProfile = require('../models/UserProfile');
const UserStats = require('../models/UserStats');
const UserAchievement = require('../models/UserAchievement');
const UserDailyQuest = require('../models/UserDailyQuest');
const AchievementDefinition = require('../models/AchievementDefinition');
const Notification = require('../models/Notification');
const User = require('../models/User');
const logger = require('../utils/logger');
const { buildFullState, applyEnergyRegen, applyLevelUp } = require('../utils/userStateHelper');

function expireBoosts(stats) {
    const now = Date.now();
    if (stats.xpBoostActive && stats.xpBoostExpiresAt && new Date(stats.xpBoostExpiresAt).getTime() <= now) {
        stats.xpBoostActive = false;
        stats.xpBoostMultiplier = 1;
        stats.xpBoostExpiresAt = null;
    }
    if (stats.coinsBoostActive && stats.coinsBoostExpiresAt && new Date(stats.coinsBoostExpiresAt).getTime() <= now) {
        stats.coinsBoostActive = false;
        stats.coinsBoostMultiplier = 1;
        stats.coinsBoostExpiresAt = null;
    }
}

// getShopItems / purchaseItem moved to controllers/shopController.js (P4).

exports.getState = async (req, res, next) => {
    try {
        const userId = req.user.id;
        let [profile, stats] = await Promise.all([
            UserProfile.findOne({ userId }),
            UserStats.findOne({ userId }),
        ]);

        if (!profile || !stats) {
            const user = await User.findById(userId).select('email').lean();
            if (!user) return res.status(404).json({ success: false, message: 'User not found' });
            const base = user.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').substring(0, 18) || 'user';
            if (!profile) {
                const exists = await UserProfile.findOne({ username: base }).lean();
                const username = exists ? base + '_' + Date.now().toString().slice(-4) : base;
                profile = await UserProfile.create({ userId, username, displayName: username, avatar: username.charAt(0).toUpperCase() });
            }
            if (!stats) stats = await UserStats.create({ userId });
        }

        applyEnergyRegen(stats);
        expireBoosts(stats);
        await stats.save();

        const gameState = await buildFullState(req.user.id);
        res.json({ success: true, data: gameState });
    } catch (error) {
        logger.error('Error in getState:', error);
        next(error);
    }
};

exports.saveState = async (req, res, next) => {
    try {
        const state = req.body;
        const userId = req.user.id;

        let [profile, stats] = await Promise.all([
            UserProfile.findOne({ userId }),
            UserStats.findOne({ userId }),
        ]);

        // Auto-create for accounts that pre-date the schema restructure
        if (!profile || !stats) {
            const user = await User.findById(userId).select('email').lean();
            if (!user) return res.status(404).json({ success: false, message: 'User not found' });

            if (!profile) {
                const base = (state.user?.username || user.email.split('@')[0])
                    .replace(/[^a-zA-Z0-9_]/g, '').substring(0, 18) || 'user';
                const exists = await UserProfile.findOne({ username: base }).lean();
                const username = exists ? base + '_' + Date.now().toString().slice(-4) : base;
                profile = await UserProfile.create({
                    userId,
                    username,
                    displayName: state.user?.displayName || username,
                    avatar: state.user?.avatar || username.charAt(0).toUpperCase(),
                });
            }
            if (!stats) {
                stats = await UserStats.create({ userId });
            }
        }

        // User / profile fields
        // avatar intentionally excluded — only POST /api/auth/avatar may change it
        if (state.user) {
            if (state.user.level !== undefined) profile.level = state.user.level;
            if (state.user.xp !== undefined) stats.xp = state.user.xp;
            if (state.user.totalXp !== undefined) stats.totalXp = state.user.totalXp;
        }

        // Resources
        if (state.resources) {
            if (state.resources.energy !== undefined) stats.energy = state.resources.energy;
            if (state.resources.maxEnergy !== undefined) stats.maxEnergy = state.resources.maxEnergy;
            if (state.resources.coins !== undefined) stats.coins = state.resources.coins;
            if (state.resources.gems !== undefined) stats.gems = state.resources.gems;
            if (state.resources.hints !== undefined) stats.hints = state.resources.hints;
            if (state.resources.shields !== undefined) stats.shields = state.resources.shields;
            if (state.resources.timeFreezes !== undefined) stats.timeFreezes = state.resources.timeFreezes;
            if (state.resources.lastEnergyUpdate) stats.lastEnergyUpdate = new Date(state.resources.lastEnergyUpdate);
        }

        // Progress
        if (state.progress) {
            if (state.progress.wordsLearned) stats.wordsLearned = state.progress.wordsLearned;
            if (state.progress.wordsMastered) stats.wordsMastered = state.progress.wordsMastered;
            if (state.progress.totalGamesPlayed !== undefined) stats.totalGamesPlayed = state.progress.totalGamesPlayed;
            if (state.progress.totalCorrectAnswers !== undefined) stats.totalCorrectAnswers = state.progress.totalCorrectAnswers;
            if (state.progress.totalWrongAnswers !== undefined) stats.totalWrongAnswers = state.progress.totalWrongAnswers;
            if (state.progress.perfectRounds !== undefined) stats.perfectRounds = state.progress.perfectRounds;
            if (state.progress.highestScore !== undefined) stats.highestScore = state.progress.highestScore;
            if (state.progress.totalPlayTime !== undefined) stats.totalPlayTime = state.progress.totalPlayTime;
            if (state.progress.modeStats) stats.modeStats = new Map(Object.entries(state.progress.modeStats));
        }

        // Streak
        if (state.streak) {
            if (state.streak.current !== undefined) stats.streakCurrent = state.streak.current;
            if (state.streak.longest !== undefined) stats.streakLongest = state.streak.longest;
            if (state.streak.lastPlayDate) stats.streakLastPlayDate = new Date(state.streak.lastPlayDate);
            if (state.streak.shieldsUsed !== undefined) stats.streakShieldsUsed = state.streak.shieldsUsed;
        }

        // Quests — upsert today's UserDailyQuest
        if (state.quests?.daily && Array.isArray(state.quests.daily)) {
            const today = new Date().toISOString().split('T')[0];
            const completed = state.quests.daily.filter(q => q.completed);
            await UserDailyQuest.findOneAndUpdate(
                { userId, date: today },
                {
                    $set: {
                        quests: state.quests.daily,
                        totalCompleted: completed.length,
                    },
                },
                { upsert: true }
            );
        }

        // Achievements — upsert newly unlocked ones
        if (state.achievements && Array.isArray(state.achievements)) {
            // Accept both new-style (unlocked: true) and old-style (only unlockedAt set)
            const unlocked = state.achievements.filter(a => a.unlocked || a.unlockedAt);
            if (unlocked.length) {
                const codes = unlocked.map(a => a.id);
                const defs = await AchievementDefinition.find({ code: { $in: codes } });
                const defMap = new Map(defs.map(d => [d.code, d]));

                await Promise.all(
                    unlocked.map(a => {
                        const def = defMap.get(a.id);
                        if (!def) return null;
                        return UserAchievement.findOneAndUpdate(
                            { userId, code: a.id },
                            {
                                $setOnInsert: {
                                    userId,
                                    achievementDefinitionId: def._id,
                                    code: a.id,
                                    unlockedAt: a.unlockedAt ? new Date(a.unlockedAt) : new Date(),
                                    claimedRewards: { xp: def.rewardXp, coins: def.rewardCoins, gems: def.rewardGems },
                                },
                            },
                            { upsert: true, new: false }
                        );
                    }).filter(Boolean)
                );
            }
        }

        // Boosts
        if (state.boosts) {
            if (state.boosts.xp) {
                stats.xpBoostActive = state.boosts.xp.active || false;
                stats.xpBoostMultiplier = state.boosts.xp.multiplier || 1;
                stats.xpBoostExpiresAt = state.boosts.xp.expiresAt || null;
            }
            if (state.boosts.coins) {
                stats.coinsBoostActive = state.boosts.coins.active || false;
                stats.coinsBoostMultiplier = state.boosts.coins.multiplier || 1;
                stats.coinsBoostExpiresAt = state.boosts.coins.expiresAt || null;
            }
        }

        // Settings
        if (state.settings) {
            Object.assign(profile.settings, state.settings);
            profile.markModified('settings');
        }

        // Practice history
        if (state.practiceHistory && Array.isArray(state.practiceHistory)) {
            stats.practiceHistory = state.practiceHistory;
        }

        await Promise.all([profile.save(), stats.save()]);

        const gameState = await buildFullState(userId);
        res.json({ success: true, message: 'State saved successfully', data: gameState });
    } catch (error) {
        logger.error('Error in saveState:', error);
        next(error);
    }
};

exports.updateResources = async (req, res, next) => {
    try {
        const { energy, coins, gems, hints, shields, timeFreezes, lastEnergyUpdate } = req.body;

        const stats = await UserStats.findOne({ userId: req.user.id });
        if (!stats) return res.status(404).json({ success: false, message: 'User not found' });

        if (energy !== undefined) stats.energy = energy;
        if (coins !== undefined) stats.coins = coins;
        if (gems !== undefined) stats.gems = gems;
        if (hints !== undefined) stats.hints = hints;
        if (shields !== undefined) stats.shields = shields;
        if (timeFreezes !== undefined) stats.timeFreezes = timeFreezes;
        if (lastEnergyUpdate) stats.lastEnergyUpdate = new Date(lastEnergyUpdate);

        await stats.save();

        res.json({
            success: true,
            message: 'Resources updated successfully',
            data: {
                energy: stats.energy, maxEnergy: stats.maxEnergy, coins: stats.coins,
                gems: stats.gems, hints: stats.hints, shields: stats.shields,
                timeFreezes: stats.timeFreezes, lastEnergyUpdate: stats.lastEnergyUpdate,
            },
        });
    } catch (error) {
        logger.error('Error in updateResources:', error);
        next(error);
    }
};

exports.updateProgress = async (req, res, next) => {
    try {
        const progress = req.body;
        const stats = await UserStats.findOne({ userId: req.user.id });
        if (!stats) return res.status(404).json({ success: false, message: 'User not found' });

        if (progress.wordsLearned) stats.wordsLearned = progress.wordsLearned;
        if (progress.wordsMastered) stats.wordsMastered = progress.wordsMastered;
        if (progress.totalGamesPlayed !== undefined) stats.totalGamesPlayed = progress.totalGamesPlayed;
        if (progress.totalCorrectAnswers !== undefined) stats.totalCorrectAnswers = progress.totalCorrectAnswers;
        if (progress.totalWrongAnswers !== undefined) stats.totalWrongAnswers = progress.totalWrongAnswers;
        if (progress.perfectRounds !== undefined) stats.perfectRounds = progress.perfectRounds;
        if (progress.highestScore !== undefined) stats.highestScore = progress.highestScore;
        if (progress.totalPlayTime !== undefined) stats.totalPlayTime = progress.totalPlayTime;
        if (progress.modeStats) stats.modeStats = new Map(Object.entries(progress.modeStats));

        await stats.save();

        res.json({ success: true, message: 'Progress updated successfully', data: progress });
    } catch (error) {
        logger.error('Error in updateProgress:', error);
        next(error);
    }
};

exports.addXp = async (req, res, next) => {
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid XP amount' });

        const [profile, stats] = await Promise.all([
            UserProfile.findOne({ userId: req.user.id }),
            UserStats.findOne({ userId: req.user.id }),
        ]);
        if (!profile || !stats) return res.status(404).json({ success: false, message: 'User not found' });

        // Apply XP boost
        let finalAmount = amount;
        if (stats.xpBoostActive && stats.xpBoostMultiplier > 1) {
            finalAmount = Math.floor(amount * stats.xpBoostMultiplier);
        }

        stats.xp += finalAmount;
        stats.totalXp += finalAmount;

        const levelUpResult = applyLevelUp(profile, stats);
        if (levelUpResult.leveledUp) {
            stats.coins += levelUpResult.coinsReward;
        }

        await Promise.all([profile.save(), stats.save()]);

        res.json({
            success: true,
            message: levelUpResult.leveledUp ? 'Level up!' : 'XP added successfully',
            data: {
                xpAdded: finalAmount,
                leveledUp: levelUpResult.leveledUp,
                newLevel: profile.level,
                newXp: stats.xp,
                totalXp: stats.totalXp,
                coinsReward: levelUpResult.coinsReward,
            },
        });
    } catch (error) {
        logger.error('Error in addXp:', error);
        next(error);
    }
};

exports.unlockAchievement = async (req, res, next) => {
    try {
        const { achievementId } = req.body;
        if (!achievementId) return res.status(400).json({ success: false, message: 'Achievement ID is required' });

        const userId = req.user.id;

        // Check already unlocked
        const existing = await UserAchievement.findOne({ userId, code: achievementId });
        if (existing) return res.status(400).json({ success: false, message: 'Achievement already unlocked' });

        // Find definition
        const def = await AchievementDefinition.findOne({ code: achievementId, isActive: true });
        if (!def) return res.status(404).json({ success: false, message: 'Achievement not found' });

        const stats = await UserStats.findOne({ userId });
        if (!stats) return res.status(404).json({ success: false, message: 'User not found' });

        // Grant rewards
        if (def.rewardCoins) stats.coins += def.rewardCoins;
        if (def.rewardXp) { stats.xp += def.rewardXp; stats.totalXp += def.rewardXp; }
        if (def.rewardGems) stats.gems += def.rewardGems;

        const [userAch] = await Promise.all([
            UserAchievement.create({
                userId,
                achievementDefinitionId: def._id,
                code: achievementId,
                claimedRewards: { xp: def.rewardXp, coins: def.rewardCoins, gems: def.rewardGems },
            }),
            stats.save(),
            Notification.create({
                userId,
                type: 'achievement',
                title: `Thành tích mới: ${def.name}`,
                body: def.description,
                data: { achievementCode: achievementId },
            }),
        ]);

        res.json({
            success: true,
            message: 'Achievement unlocked!',
            data: {
                achievement: { id: def.code, name: def.name, description: def.description, icon: def.icon },
                rewards: { coins: def.rewardCoins, xp: def.rewardXp, gems: def.rewardGems },
            },
        });
    } catch (error) {
        logger.error('Error in unlockAchievement:', error);
        next(error);
    }
};

exports.updateQuests = async (req, res, next) => {
    try {
        const { daily, lastResetDate } = req.body;
        const userId = req.user.id;

        if (daily && Array.isArray(daily)) {
            const today = new Date().toISOString().split('T')[0];
            const completed = daily.filter(q => q.completed);
            await UserDailyQuest.findOneAndUpdate(
                { userId, date: today },
                { $set: { quests: daily, totalCompleted: completed.length } },
                { upsert: true }
            );
        }

        res.json({ success: true, message: 'Quests updated successfully', data: { daily, lastResetDate } });
    } catch (error) {
        logger.error('Error in updateQuests:', error);
        next(error);
    }
};

// applyShopEffect moved to services/shopEffects.js (Phase 3).

// purchaseItem moved to controllers/shopController.js (P4).
