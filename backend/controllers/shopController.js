// ===================================
// SHOP CONTROLLER
// ===================================
// Split out of userStateController (P4). Self-contained: ShopItem +
// UserStats models, the shopEffects service, and logger — no userState
// helpers. Verbatim move; behaviour unchanged. routes/shop.js imports
// these from here now.

const ShopItem = require('../models/ShopItem');
const UserStats = require('../models/UserStats');
const logger = require('../utils/logger');
const { applyShopEffect } = require('../services/shopEffects');

exports.getShopItems = async (req, res, next) => {
    try {
        const items = await ShopItem.find({ isActive: true }).sort({ order: 1 }).lean();
        res.json({ success: true, items });
    } catch (error) {
        logger.error('Error in getShopItems:', error);
        next(error);
    }
};

exports.purchaseItem = async (req, res, next) => {
    try {
        const { itemId } = req.body;
        if (!itemId) return res.status(400).json({ success: false, message: 'Item ID is required' });

        const item = await ShopItem.findOne({ itemId, isActive: true }).lean();
        if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

        const stats = await UserStats.findOne({ userId: req.user.id });
        if (!stats) return res.status(404).json({ success: false, message: 'User not found' });

        const effectivePrice = item.discountPercent > 0
            ? Math.floor(item.price * (1 - item.discountPercent / 100))
            : item.price;

        if (item.currency === 'coins' && stats.coins < effectivePrice) {
            return res.status(400).json({ success: false, message: 'Not enough coins' });
        }
        if (item.currency === 'gems' && stats.gems < effectivePrice) {
            return res.status(400).json({ success: false, message: 'Not enough gems' });
        }

        if (item.currency === 'coins') stats.coins -= effectivePrice;
        else stats.gems -= effectivePrice;

        applyShopEffect(stats, item.effect);

        await stats.save();

        res.json({
            success: true,
            message: 'Item purchased successfully',
            data: { item, newBalance: { coins: stats.coins, gems: stats.gems } },
        });
    } catch (error) {
        logger.error('Error in purchaseItem:', error);
        next(error);
    }
};
