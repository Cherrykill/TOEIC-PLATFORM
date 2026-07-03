const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ItemDefinition = require('../models/ItemDefinition');
const Inventory = require('../services/inventoryService');

// Catalog công khai — danh sách item đang bật.
router.get('/items', async (req, res, next) => {
    try {
        const items = await ItemDefinition.find({ isActive: true }).sort({ type: 1, order: 1 }).lean();
        res.json({ success: true, data: items });
    } catch (err) { next(err); }
});

// Túi đồ của tôi (kèm slot đang trang bị).
router.get('/', protect, async (req, res, next) => {
    try {
        const [items, equipped] = await Promise.all([
            Inventory.getInventory(req.user.id),
            Inventory.getEquipped(req.user.id),
        ]);
        res.json({ success: true, data: items, equipped });
    } catch (err) { next(err); }
});

// Dùng đồ tiêu hao.
router.post('/use', protect, async (req, res, next) => {
    try {
        const { itemId, quantity = 1 } = req.body;
        if (!itemId) return res.status(400).json({ success: false, message: 'Thiếu itemId' });
        const ok = await Inventory.consume(req.user.id, itemId, quantity);
        if (!ok) return res.status(400).json({ success: false, message: 'Không đủ số lượng' });
        res.json({ success: true });
    } catch (err) { next(err); }
});

// Trang bị cosmetic.
router.post('/equip', protect, async (req, res, next) => {
    try {
        const { itemId } = req.body;
        if (!itemId) return res.status(400).json({ success: false, message: 'Thiếu itemId' });
        const result = await Inventory.equip(req.user.id, itemId);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// Bỏ trang bị theo slot.
router.post('/unequip', protect, async (req, res, next) => {
    try {
        const { slot } = req.body;
        if (!slot) return res.status(400).json({ success: false, message: 'Thiếu slot' });
        const result = await Inventory.unequip(req.user.id, slot);
        res.json({ success: true, ...result });
    } catch (err) { next(err); }
});

module.exports = router;
