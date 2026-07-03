/**
 * Seed catalog item_definitions (idempotent — upsert theo itemId).
 * Chạy: node scripts/seedItemDefinitions.js
 */
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const ItemDefinition = require('../models/ItemDefinition');

const ITEMS = [
    // ===== Tiêu hao =====
    { itemId: 'hint', name: 'Gợi ý', description: 'Dùng khi luyện tập để loại đáp án sai', icon: 'fa-lightbulb', type: 'consumable', rarity: 'common', stackable: true, effect: { type: 'hint' }, order: 1 },
    { itemId: 'shield', name: 'Khiên bảo vệ streak', description: 'Giữ streak khi bạn nghỉ 1 ngày', icon: 'fa-shield-halved', type: 'consumable', rarity: 'rare', stackable: true, effect: { type: 'streak_shield' }, order: 2 },
    { itemId: 'time-freeze', name: 'Dừng thời gian', description: 'Tạm dừng đồng hồ khi luyện tập', icon: 'fa-pause', type: 'consumable', rarity: 'rare', stackable: true, effect: { type: 'time_freeze' }, order: 3 },
    { itemId: 'spin-ticket', name: 'Vé quay may mắn', description: 'Dùng để quay Vòng quay may mắn (không tốn lượt/xu)', icon: 'fa-ticket', type: 'consumable', rarity: 'epic', stackable: true, effect: { type: 'spin' }, order: 4 },

    // ===== Cosmetic — nền =====
    { itemId: 'bg-vip-week', name: 'Nền Hoàng gia VIP', description: 'Nền hồ sơ & bảng xếp hạng dành cho VIP', icon: 'fa-crown', type: 'cosmetic_background', rarity: 'legendary', stackable: false, effect: { slot: 'background', key: 'vip-royal' }, order: 1 },
];

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    let ok = 0;
    for (const it of ITEMS) {
        await ItemDefinition.updateOne({ itemId: it.itemId }, { $set: it }, { upsert: true });
        ok++;
    }
    console.log(`Seeded ${ok} item definitions.`);
    const total = await ItemDefinition.countDocuments();
    console.log(`Tong item_definitions: ${total}`);
    await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
