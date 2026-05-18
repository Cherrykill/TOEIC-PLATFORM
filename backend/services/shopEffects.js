/**
 * Apply a purchased shop item's effect onto a mutable stats object.
 * Pure domain logic (no DB / no req-res) — extracted verbatim from
 * userStateController so it can be unit-tested and reused. The money path:
 * behaviour MUST stay identical.
 *
 * @param {object} stats   user stats (mutated in place)
 * @param {object} effect  { type, amount?, duration?, boostType?, multiplier?, items? }
 */
function applyShopEffect(stats, effect) {
    switch (effect.type) {
        case 'energy':
            stats.energy = Math.min(stats.energy + effect.amount, stats.maxEnergy);
            break;
        case 'hints':
            stats.hints += effect.amount;
            break;
        case 'shield':
            stats.shields += effect.amount;
            break;
        case 'timeFreeze':
            stats.timeFreezes += effect.amount;
            break;
        case 'coins':
            stats.coins += effect.amount;
            break;
        case 'gems':
            stats.gems += effect.amount;
            break;
        case 'boost': {
            const expiresAt = new Date(Date.now() + effect.duration * 1000);
            if (effect.boostType === 'xp') {
                stats.xpBoostActive = true;
                stats.xpBoostMultiplier = effect.multiplier;
                stats.xpBoostExpiresAt = expiresAt;
            } else if (effect.boostType === 'coins') {
                stats.coinsBoostActive = true;
                stats.coinsBoostMultiplier = effect.multiplier;
                stats.coinsBoostExpiresAt = expiresAt;
            }
            break;
        }
        case 'combo':
            for (const sub of effect.items) applyShopEffect(stats, sub);
            break;
        default:
            break;
    }
}

module.exports = { applyShopEffect };
