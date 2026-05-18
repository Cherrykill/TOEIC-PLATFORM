const mongoose = require('mongoose');

const achievementDefinitionSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        name: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        icon: { type: String, default: '' },
        category: {
            type: String,
            enum: ['learning', 'practice', 'streak', 'skill', 'speed'],
            required: true,
        },

        conditionType: { type: String, required: true },
        conditionValue: { type: Number, required: true },
        conditionMode: { type: String, default: '' },

        rewardCoins: { type: Number, default: 0 },
        rewardXp: { type: Number, default: 0 },
        rewardGems: { type: Number, default: 0 },

        isActive: { type: Boolean, default: true },
        order: { type: Number, default: 0 },
    },
    {
        timestamps: true,
        collection: 'achievement_definitions',
    }
);

achievementDefinitionSchema.index({ category: 1, order: 1 });
achievementDefinitionSchema.index({ isActive: 1 });

module.exports = mongoose.model('AchievementDefinition', achievementDefinitionSchema);
