/**
 * Smoke test — shop effect application (money/reward path). Locks the
 * behaviour before/while extracting it out of userStateController so a
 * future refactor that changes payouts is caught. Pure, no DB.
 */
const { applyShopEffect } = require('../services/shopEffects');

const baseStats = () => ({
    energy: 80, maxEnergy: 100,
    hints: 1, shields: 0, timeFreezes: 2,
    coins: 100, gems: 5,
    xpBoostActive: false, xpBoostMultiplier: 1, xpBoostExpiresAt: null,
    coinsBoostActive: false, coinsBoostMultiplier: 1, coinsBoostExpiresAt: null,
});

describe('applyShopEffect', () => {
    test('energy is added but clamped at maxEnergy', () => {
        const s = baseStats();
        applyShopEffect(s, { type: 'energy', amount: 50 });
        expect(s.energy).toBe(100); // 80+50 clamped to 100
        const s2 = { ...baseStats(), energy: 30 };
        applyShopEffect(s2, { type: 'energy', amount: 40 });
        expect(s2.energy).toBe(70);
    });

    test('energy_full nạp tới trần HIỆN TẠI, không phải con số ghi cứng', () => {
        const s = { ...baseStats(), energy: 2, maxEnergy: 60 };
        applyShopEffect(s, { type: 'energy_full' });
        expect(s.energy).toBe(60);

        // Trần cao hơn (người chơi level cao) thì nạp lên đúng trần đó.
        const s2 = { ...baseStats(), energy: 0, maxEnergy: 150 };
        applyShopEffect(s2, { type: 'energy_full' });
        expect(s2.energy).toBe(150);
    });

    test('energy_full áp nhiều lần không vượt trần (mua nhầm 2 gói vẫn chỉ đầy)', () => {
        const s = { ...baseStats(), energy: 10, maxEnergy: 100 };
        applyShopEffect(s, { type: 'energy_full' });
        applyShopEffect(s, { type: 'energy_full' });
        expect(s.energy).toBe(100);
    });

    test('thẻ hồi ⚡ bật boost tốc độ, KHÔNG cộng thẳng năng lượng', () => {
        const s = { ...baseStats(), energy: 10 };
        applyShopEffect(s, { type: 'boost', boostType: 'energy', multiplier: 2, duration: 3600 });
        expect(s.energyBoostActive).toBe(true);
        expect(s.energyBoostMultiplier).toBe(2);
        expect(s.energy).toBe(10); // trần & số ⚡ giữ nguyên, chỉ tốc độ đổi
    });

    test('dùng thẻ x3 khi đang chạy x2 → giữ hệ số CAO NHẤT, không bị hạ cấp', () => {
        const s = baseStats();
        applyShopEffect(s, { type: 'boost', boostType: 'energy', multiplier: 3, duration: 7200 });
        const until = new Date(s.energyBoostExpiresAt).getTime();

        applyShopEffect(s, { type: 'boost', boostType: 'energy', multiplier: 2, duration: 60 });
        expect(s.energyBoostMultiplier).toBe(3);                       // không tụt về 2
        expect(new Date(s.energyBoostExpiresAt).getTime()).toBe(until); // không rút ngắn hạn
    });

    test('consumable counters add by amount', () => {
        const s = baseStats();
        applyShopEffect(s, { type: 'hints', amount: 3 });
        applyShopEffect(s, { type: 'shield', amount: 2 });
        applyShopEffect(s, { type: 'timeFreeze', amount: 1 });
        applyShopEffect(s, { type: 'coins', amount: 250 });
        applyShopEffect(s, { type: 'gems', amount: 10 });
        expect(s.hints).toBe(4);
        expect(s.shields).toBe(2);
        expect(s.timeFreezes).toBe(3);
        expect(s.coins).toBe(350);
        expect(s.gems).toBe(15);
    });

    test('xp boost sets active/multiplier + future expiry', () => {
        const s = baseStats();
        const before = Date.now();
        applyShopEffect(s, { type: 'boost', boostType: 'xp', multiplier: 2, duration: 3600 });
        expect(s.xpBoostActive).toBe(true);
        expect(s.xpBoostMultiplier).toBe(2);
        expect(s.xpBoostExpiresAt.getTime()).toBeGreaterThan(before);
        expect(s.coinsBoostActive).toBe(false); // untouched
    });

    test('coins boost sets the coins-boost fields only', () => {
        const s = baseStats();
        applyShopEffect(s, { type: 'boost', boostType: 'coins', multiplier: 3, duration: 1800 });
        expect(s.coinsBoostActive).toBe(true);
        expect(s.coinsBoostMultiplier).toBe(3);
        expect(s.xpBoostActive).toBe(false);
    });

    test('combo recursively applies sub-effects', () => {
        const s = baseStats();
        applyShopEffect(s, {
            type: 'combo',
            items: [
                { type: 'coins', amount: 100 },
                { type: 'hints', amount: 5 },
                { type: 'boost', boostType: 'xp', multiplier: 2, duration: 60 },
            ],
        });
        expect(s.coins).toBe(200);
        expect(s.hints).toBe(6);
        expect(s.xpBoostActive).toBe(true);
    });

    test('unknown effect type is a no-op', () => {
        const s = baseStats();
        const snapshot = JSON.stringify(s);
        applyShopEffect(s, { type: 'nope', amount: 999 });
        expect(JSON.stringify(s)).toBe(snapshot);
    });
});
