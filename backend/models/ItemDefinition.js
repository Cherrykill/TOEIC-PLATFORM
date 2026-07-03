const mongoose = require('mongoose');

/**
 * ItemDefinition — CATALOG: một item "LÀ GÌ" (bất biến, admin định nghĩa).
 * Tách khỏi sở hữu (InventoryItem = "ai CÓ gì"). Không chứa số lượng.
 */
const itemDefinitionSchema = new mongoose.Schema(
    {
        itemId: { type: String, required: true, unique: true, trim: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        icon: { type: String, default: '' },

        type: {
            type: String,
            enum: [
                'consumable',            // hint, shield, time-freeze
                'boost',                 // x2 XP/Coins có hạn
                'cosmetic_background',   // nền hồ sơ / leaderboard
                'cosmetic_avatar',
                'cosmetic_frame',
                'currency',              // (không dùng cho ví chính; dự phòng)
            ],
            required: true,
        },
        rarity: {
            type: String,
            enum: ['common', 'rare', 'epic', 'legendary'],
            default: 'common',
        },

        stackable: { type: Boolean, default: true },
        maxStack: { type: Number, default: null },

        // Ngữ nghĩa hiệu ứng (vd { slot:'background', key:'vip-royal' }
        // hoặc { boostType:'xp', multiplier:2, duration:604800 }).
        effect: { type: mongoose.Schema.Types.Mixed, default: {} },

        tradable: { type: Boolean, default: false }, // dự phòng tương lai
        isActive: { type: Boolean, default: true },
        order: { type: Number, default: 0 },
    },
    { timestamps: true, collection: 'item_definitions' }
);

itemDefinitionSchema.index({ isActive: 1, type: 1, order: 1 });

module.exports = mongoose.model('ItemDefinition', itemDefinitionSchema);
