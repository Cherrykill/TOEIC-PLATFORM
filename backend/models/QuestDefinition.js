const mongoose = require('mongoose');

const questDefinitionSchema = new mongoose.Schema(
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

        type: {
            type: String,
            enum: ['daily', 'weekly', 'monthly', 'special'],
            default: 'daily',
        },
        // Target game mode, or 'any' for cross-mode quests
        mode: { type: String, default: 'any' },

        target: { type: Number, required: true, min: 1 },

        rewardCoins: { type: Number, default: 0 },
        rewardXp:    { type: Number, default: 0 },
        rewardGems:  { type: Number, default: 0 },

        isActive: { type: Boolean, default: true },
        // Higher weight = more likely to be selected when generating daily quests
        weight: { type: Number, default: 1 },
    },
    {
        timestamps: true,
        collection: 'quest_definitions',
    }
);

questDefinitionSchema.index({ type: 1, isActive: 1 });

module.exports = mongoose.model('QuestDefinition', questDefinitionSchema);
