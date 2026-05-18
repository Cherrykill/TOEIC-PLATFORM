// ===================================
// LEADERBOARD (RANKINGS) API SERVICE
// ===================================
// ESM raw-fetch wrapper, shape preserved (pure move from LeaderboardScreen).
// Replaced the legacy non-ESM api/leaderboard.js (deleted — was unused).

export const RankingsAPI = {
    /** @returns parsed JSON, {success:false} on error. */
    async byPeriod(period) {
        return fetch(`/api/leaderboard/${period}`)
            .then(r => r.json())
            .catch(() => ({ success: false }));
    },
};
