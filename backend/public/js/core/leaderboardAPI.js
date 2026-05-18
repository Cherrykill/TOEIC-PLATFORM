// ===================================
// LEADERBOARD API - Backend Integration
// ===================================

const LeaderboardAPI = {

    /**
     * Get leaderboard by period from backend
     * @param {string} period - 'daily', 'weekly', or 'all-time'
     * @param {object} options - { limit, sortBy }
     */
    async getLeaderboard(period = 'all-time', options = {}) {
        try {
            const { limit = 100, sortBy = 'totalXp' } = options;

            const response = await Http.get(`/leaderboard/${period}?limit=${limit}&sortBy=${sortBy}`);

            console.log('Leaderboard API response:', response);

            if (response.success && response.data) {
                // Response structure: { success, data: { data: [...] } }
                // We need response.data.data
                if (response.data.data && Array.isArray(response.data.data)) {
                    return response.data.data;
                }
                // Or maybe it's directly response.data
                if (Array.isArray(response.data)) {
                    return response.data;
                }
            }

            console.error('Failed to fetch leaderboard:', response.message);
            return [];
        } catch (error) {
            console.error('Leaderboard API error:', error);
            return [];
        }
    },

    /**
     * Get user's rank in leaderboard
     * @param {string} userId - User ID
     * @param {string} period - 'daily', 'weekly', or 'all-time'
     * @param {string} sortBy - 'score', 'xp', or 'totalXp'
     */
    async getUserRank(userId, period = 'all-time', sortBy = 'totalXp') {
        try {
            const response = await Http.get(`/leaderboard/rank/${userId}/${period}?sortBy=${sortBy}`);

            if (response.success) {
                return response.data;
            }

            console.error('Failed to fetch user rank:', response.message);
            return null;
        } catch (error) {
            console.error('User rank API error:', error);
            return null;
        }
    },

    /**
     * Get leaderboard statistics
     * @param {string} period - 'daily', 'weekly', or 'all-time'
     */
    async getStats(period = 'all-time') {
        try {
            const response = await Http.get(`/leaderboard/stats/${period}`);

            if (response.success) {
                return response.data;
            }

            console.error('Failed to fetch leaderboard stats:', response.message);
            return null;
        } catch (error) {
            console.error('Leaderboard stats API error:', error);
            return null;
        }
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LeaderboardAPI;
}
