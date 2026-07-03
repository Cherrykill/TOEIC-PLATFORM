const mongoose = require('mongoose');

const shopItemSchema = new mongoose.Schema(
    {
        itemId: {
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
            enum: ['energy', 'resource', 'boost', 'exchange', 'bundle', 'vip', 'cosmetic'],
            required: true,
        },
        price: { type: Number, required: true },
        currency: { type: String, enum: ['coins', 'gems'], required: true },
        discountPercent: { type: Number, default: 0, min: 0, max: 100 },
        effect: { type: mongoose.Schema.Types.Mixed, required: true },
        isActive: { type: Boolean, default: true },
        order: { type: Number, default: 0 },
    },
    {
        timestamps: true,
        collection: 'shop_items',
    }
);

shopItemSchema.index({ isActive: 1, order: 1 });
shopItemSchema.index({ category: 1 });

module.exports = mongoose.model('ShopItem', shopItemSchema);
