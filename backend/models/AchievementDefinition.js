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
            // Khớp với 5 tab hiển thị frontend: learning→Học tập,
            // practice/speed/skill→Luyện tập, social→Xã hội, streak→Đặc biệt.
            enum: ['learning', 'practice', 'streak', 'skill', 'speed', 'social'],
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
