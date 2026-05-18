/**
 * Quest period math — which period a moment falls in, and when the next
 * reset happens. Pure (takes `now`, returns string|null), no DB. Extracted
 * verbatim from questController so it can be unit-tested: a bug here makes
 * daily/weekly/monthly quests reset at the wrong time.
 */

function getPeriodKey(type, now = new Date()) {
    if (type === 'daily') {
        return now.toISOString().slice(0, 10); // YYYY-MM-DD
    }
    if (type === 'weekly') {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay() + 1); // Monday
        const y = d.getFullYear();
        const week = Math.ceil(((d - new Date(y, 0, 1)) / 86400000 + 1) / 7);
        return `${y}-W${String(week).padStart(2, '0')}`;
    }
    if (type === 'monthly') {
        return now.toISOString().slice(0, 7); // YYYY-MM
    }
    return 'special';
}

function getNextReset(type, now = new Date()) {
    const d = new Date(now);
    if (type === 'daily') {
        d.setDate(d.getDate() + 1);
        d.setHours(0, 0, 0, 0);
    } else if (type === 'weekly') {
        const daysUntilMonday = (8 - d.getDay()) % 7 || 7;
        d.setDate(d.getDate() + daysUntilMonday);
        d.setHours(0, 0, 0, 0);
    } else if (type === 'monthly') {
        d.setMonth(d.getMonth() + 1, 1);
        d.setHours(0, 0, 0, 0);
    } else {
        return null;
    }
    return d.toISOString();
}

module.exports = { getPeriodKey, getNextReset };
