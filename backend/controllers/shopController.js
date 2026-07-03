// ===================================
// SHOP CONTROLLER
// ===================================
// Split out of userStateController (P4). Self-contained: ShopItem +
// UserStats models, the shopEffects service, and logger — no userState
// helpers. Verbatim move; behaviour unchanged. routes/shop.js imports
// these from here now.

const jwt = require('jsonwebtoken');
const ShopItem = require('../models/ShopItem');
const UserStats = require('../models/UserStats');
const logger = require('../utils/logger');
const { applyShopEffect } = require('../services/shopEffects');
const Inventory = require('../services/inventoryService');

// Grant vật phẩm inventory từ effect (đệ quy qua combo). Dùng chung: shop + quest.
async function grantItemsFromEffect(userId, effect, source = 'shop') {
    if (!effect) return;
    if (effect.type === 'item' && effect.itemId) {
        await Inventory.grant(userId, effect.itemId, effect.amount || 1, { source });
    } else if (effect.type === 'combo' && Array.isArray(effect.items)) {
        for (const sub of effect.items) await grantItemsFromEffect(userId, sub, source);
    }
}

// Vật phẩm giới hạn theo chu kỳ: itemId → số ngày phải chờ giữa 2 lần mua.
// (Cũng tôn trọng item.cooldownDays nếu được đặt trong DB.)
const COOLDOWN_DAYS = { 'shields-pack': 7 };

exports.getShopItems = async (req, res, next) => {
    try {
        const items = await ShopItem.find({ isActive: true }).sort({ order: 1 }).lean();

        // Route /items công khai (không bắt buộc đăng nhập). Nếu có token hợp lệ
        // thì đọc cooldown của user để client vô hiệu hoá nút + đếm ngược.
        let cooldownMap = null;
        try {
            const auth = req.headers.authorization || '';
            if (auth.startsWith('Bearer ')) {
                const decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
                const stats = await UserStats.findOne({ userId: decoded.id }).select('shopCooldowns').lean();
                cooldownMap = stats?.shopCooldowns || null; // lean → object thường
            }
        } catch (_) { /* token sai/hết hạn → coi như khách, bỏ qua cooldown */ }

        const now = Date.now();
        const withCd = items.map(it => {
            const days = it.cooldownDays || COOLDOWN_DAYS[it.itemId] || 0;
            if (!days) return it;
            const last = cooldownMap
                ? (cooldownMap instanceof Map ? cooldownMap.get(it.itemId) : cooldownMap[it.itemId])
                : null;
            let nextAvailableAt = null;
            if (last) {
                const t = new Date(last).getTime() + days * 86400000;
                if (t > now) nextAvailableAt = new Date(t);
            }
            return { ...it, cooldownDays: days, nextAvailableAt };
        });

        res.json({ success: true, items: withCd });
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

        // Giới hạn mua theo chu kỳ (vd Gói Khiên Bảo Vệ: 1 lần/tuần).
        const cooldownDays = item.cooldownDays || COOLDOWN_DAYS[itemId] || 0;
        if (cooldownDays > 0) {
            const last = stats.shopCooldowns?.get(itemId);
            if (last) {
                const nextAt = new Date(last).getTime() + cooldownDays * 86400000;
                if (Date.now() < nextAt) {
                    const daysLeft = Math.ceil((nextAt - Date.now()) / 86400000);
                    return res.status(429).json({
                        success: false,
                        message: `Vật phẩm này chỉ mua được ${cooldownDays} ngày/lần. Vui lòng chờ thêm ${daysLeft} ngày.`,
                        nextAvailableAt: new Date(nextAt),
                    });
                }
            }
        }

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

        // Ghi mốc thời gian mua để áp cooldown cho lần sau.
        if (cooldownDays > 0) {
            if (!stats.shopCooldowns) stats.shopCooldowns = new Map();
            stats.shopCooldowns.set(itemId, new Date());
        }

        await stats.save();

        // Grant vật phẩm inventory (effect type 'item' hoặc trong combo) — vd Vé quay.
        try {
            await grantItemsFromEffect(req.user.id, item.effect);
        } catch (e) {
            logger.error('Grant inventory item failed:', e.message);
        }

        // VIP → grant + tự trang bị nền cosmetic (hạn = VIP). Best-effort:
        // lỗi inventory không được làm hỏng giao dịch mua đã lưu.
        if (item.effect?.type === 'vip' || item.category === 'vip') {
            try {
                await Inventory.grant(req.user.id, 'bg-vip-week', 1, {
                    source: 'vip',
                    expiresAt: stats.vipExpiresAt || null,
                });
                await Inventory.equip(req.user.id, 'bg-vip-week');
            } catch (e) {
                logger.error('VIP cosmetic grant failed:', e.message);
            }
        }

        res.json({
            success: true,
            message: 'Item purchased successfully',
            // Trả về ĐẦY ĐỦ tài nguyên sau khi áp hiệu ứng, để client đồng bộ
            // local — tránh save() sau đó ghi đè số cũ làm mất đồ vừa mua
            // (vd khiên: DB +3 nhưng local cũ → saveState ghi đè về 0).
            data: {
                item,
                newBalance: {
                    coins: stats.coins,
                    gems: stats.gems,
                    energy: stats.energy,
                    hints: stats.hints,
                    shields: stats.shields,
                    timeFreezes: stats.timeFreezes,
                },
            },
        });
    } catch (error) {
        logger.error('Error in purchaseItem:', error);
        next(error);
    }
};
