// ===================================
// LEADERBOARD MODULE - Logic (Local)
// ===================================

const Leaderboard = {
    
    /**
     * Initialize leaderboard
     */
    init() {
        // Create initial leaderboard data if not exists
        if (!Storage.has('leaderboard')) {
            this.initializeLeaderboard();
        }
    },
    
    /**
     * Initialize leaderboard with sample data
     */
    initializeLeaderboard() {
        const sampleData = {
            daily: this.generateSamplePlayers(10),
            weekly: this.generateSamplePlayers(10),
            allTime: this.generateSamplePlayers(10)
        };
        
        Storage.set('leaderboard', sampleData);
    },
    
    /**
     * Generate sample players for leaderboard
     */
    generateSamplePlayers(count) {
        const names = [
            'Nguyễn Văn A', 'Trần Thị B', 'Lê Văn C', 'Phạm Thị D',
            'Hoàng Văn E', 'Vũ Thị F', 'Đặng Văn G', 'Bùi Thị H',
            'Đỗ Văn I', 'Ngô Thị K', 'Dương Văn L', 'Lý Thị M'
        ];
        
        const players = [];
        
        for (let i = 0; i < count; i++) {
            players.push({
                id: Utils.generateId(),
                username: Utils.randomElement(names),
                level: Utils.randomInt(1, 20),
                score: Utils.randomInt(1000, 50000),
                avatar: Utils.randomElement(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
            });
        }
        
        // Sort by score descending
        return players.sort((a, b) => b.score - a.score);
    },
    
    /**
     * Get leaderboard by period
     */
    getLeaderboard(period = 'daily') {
        const data = Storage.get('leaderboard', {});
        return data[period] || [];
    },
    
    /**
     * Submit score to leaderboard
     */
    submitScore(score) {
        const user = GameState.getUser();
        const stats = GameState.getStatistics();
        
        const entry = {
            id: user.id,
            username: user.username,
            level: user.level,
            score: score,
            avatar: user.avatar,
            timestamp: Date.now()
        };
        
        // Update all leaderboards
        this.updateLeaderboard('daily', entry);
        this.updateLeaderboard('weekly', entry);
        this.updateLeaderboard('allTime', entry);
        
        // Check if new high score
        const rank = this.getUserRank('allTime');
        
        if (rank !== -1 && rank <= 10) {
            EventBus.emit(GameEvents.HIGH_SCORE, { rank, score });
        }
    },
    
    /**
     * Update specific leaderboard
     */
    updateLeaderboard(period, entry) {
        const leaderboards = Storage.get('leaderboard', {});
        let leaderboard = leaderboards[period] || [];
        
        // Find existing entry for this user
        const existingIndex = leaderboard.findIndex(e => e.id === entry.id);
        
        if (existingIndex !== -1) {
            // Update if new score is higher
            if (entry.score > leaderboard[existingIndex].score) {
                leaderboard[existingIndex] = entry;
            }
        } else {
            // Add new entry
            leaderboard.push(entry);
        }
        
        // Sort by score descending
        leaderboard.sort((a, b) => b.score - a.score);
        
        // Keep top 100
        leaderboard = leaderboard.slice(0, 100);
        
        leaderboards[period] = leaderboard;
        Storage.set('leaderboard', leaderboards);
    },
    
    /**
     * Get user rank in leaderboard
     */
    getUserRank(period = 'daily') {
        const leaderboard = this.getLeaderboard(period);
        const user = GameState.getUser();
        
        const index = leaderboard.findIndex(e => e.id === user.id);
        return index !== -1 ? index + 1 : -1;
    },
    
    /**
     * Get user entry in leaderboard
     */
    getUserEntry(period = 'daily') {
        const leaderboard = this.getLeaderboard(period);
        const user = GameState.getUser();
        
        return leaderboard.find(e => e.id === user.id) || null;
    },
    
    /**
     * Get top N players
     */
    getTopPlayers(period = 'daily', count = 10) {
        const leaderboard = this.getLeaderboard(period);
        return leaderboard.slice(0, count);
    },
    
    /**
     * Reset daily leaderboard
     */
    resetDaily() {
        const leaderboards = Storage.get('leaderboard', {});
        leaderboards.daily = [];
        Storage.set('leaderboard', leaderboards);
        
        console.log('Daily leaderboard reset');
    },
    
    /**
     * Reset weekly leaderboard
     */
    resetWeekly() {
        const leaderboards = Storage.get('leaderboard', {});
        leaderboards.weekly = [];
        Storage.set('leaderboard', leaderboards);
        
        console.log('Weekly leaderboard reset');
    },
    
    /**
     * Check if should reset daily
     */
    checkDailyReset() {
        const lastReset = Storage.get('leaderboard_daily_reset');
        const today = Utils.getStartOfDay();
        
        if (!lastReset || today > lastReset) {
            this.resetDaily();
            Storage.set('leaderboard_daily_reset', today);
        }
    },
    
    /**
     * Check if should reset weekly
     */
    checkWeeklyReset() {
        const lastReset = Storage.get('leaderboard_weekly_reset');
        const now = Date.now();
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        
        if (!lastReset || now - lastReset >= oneWeek) {
            this.resetWeekly();
            Storage.set('leaderboard_weekly_reset', now);
        }
    },
    
    /**
     * Get statistics
     */
    getStats(period = 'daily') {
        const leaderboard = this.getLeaderboard(period);
        
        if (leaderboard.length === 0) {
            return {
                totalPlayers: 0,
                averageScore: 0,
                highestScore: 0,
                lowestScore: 0
            };
        }
        
        const scores = leaderboard.map(e => e.score);
        const total = scores.reduce((sum, score) => sum + score, 0);
        
        return {
            totalPlayers: leaderboard.length,
            averageScore: Math.floor(total / leaderboard.length),
            highestScore: Math.max(...scores),
            lowestScore: Math.min(...scores)
        };
    },
    
    /**
     * Clear all leaderboards (for testing)
     */
    clearAll() {
        Storage.remove('leaderboard');
        Storage.remove('leaderboard_daily_reset');
        Storage.remove('leaderboard_weekly_reset');
        this.initializeLeaderboard();
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Leaderboard;
}