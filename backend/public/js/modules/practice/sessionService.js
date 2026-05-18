// ===================================
// SESSION SERVICE
// Pure business logic — không đụng DOM
// ===================================

const SessionService = {

    /**
     * Tính toán kết quả cuối session
     * @returns {{ scoreData, xpReward, coinsReward, gemsBonus, isPerfect, totalQuestions, duration }}
     */
    calculateResults(session) {
        const duration = (session.endTime - session.startTime) / 1000;
        const mode = session.mode;
        const config = Config.practice[mode] || {};
        const totalQuestions = session.correctAnswers + session.wrongAnswers;
        const isPerfect = session.wrongAnswers === 0;

        const scoreData = GameLogic.calculateScore(
            session.correctAnswers,
            totalQuestions,
            duration,
            config.timeLimit || 300,
            mode
        );

        const xpReward = GameLogic.calculateXpReward(
            session.correctAnswers,
            totalQuestions,
            isPerfect
        );

        const coinsReward = GameLogic.calculateCoinsReward(
            session.correctAnswers,
            totalQuestions,
            isPerfect
        );

        const gemsBonus = this.calculateGemsBonus(totalQuestions, GameState.state.settings.randomQuestions !== false);

        return { scoreData, xpReward, coinsReward, gemsBonus, isPerfect, totalQuestions, duration };
    },

    /**
     * Tính gems thưởng theo số câu
     */
    calculateGemsBonus(totalQuestions, isRandomMode) {
        if (!isRandomMode) return 0;
        if (totalQuestions >= 200) return 100;
        if (totalQuestions >= 150) return 50;
        if (totalQuestions >= 100) return 30;
        if (totalQuestions >= 75)  return 15;
        if (totalQuestions >= 50)  return 10;
        return 0;
    },

    /**
     * Lưu kết quả vào GameState (không save DB, không UI)
     */
    applyResultsToState(session, results) {
        const { scoreData, xpReward, coinsReward, gemsBonus, isPerfect } = results;
        const mode = session.mode;

        GameState.addXp(xpReward, true);
        GameState.addCoins(coinsReward, true);
        if (gemsBonus > 0) GameState.addGems(gemsBonus, true);

        GameState.state.progress.totalGamesPlayed++;
        GameState.state.progress.totalCorrectAnswers += session.correctAnswers;
        GameState.state.progress.totalWrongAnswers += session.wrongAnswers;

        if (isPerfect) {
            GameState.state.progress.perfectRounds++;
        }

        if (scoreData.totalScore > GameState.state.progress.highestScore) {
            GameState.state.progress.highestScore = scoreData.totalScore;
        }

        if (!GameState.state.progress.modeStats[mode]) {
            GameState.state.progress.modeStats[mode] = { played: 0, score: 0, correct: 0, total: 0 };
        }

        const stats = GameState.state.progress.modeStats[mode];
        stats.played++;
        stats.score = Math.max(stats.score, scoreData.totalScore);
        stats.correct += session.correctAnswers;
        stats.total += session.correctAnswers + session.wrongAnswers;
    },

    /**
     * Ghi lịch sử luyện tập hôm nay
     */
    recordHistory(session, xpReward, coinsReward, duration) {
        const today = new Date().toISOString().split('T')[0];
        let entry = GameState.state.practiceHistory?.find(e => e.date === today);

        if (!entry) {
            if (!GameState.state.practiceHistory) GameState.state.practiceHistory = [];
            entry = {
                date: today,
                sessionsCompleted: 0,
                questionsAnswered: 0,
                correctAnswers: 0,
                totalXpEarned: 0,
                totalCoinsEarned: 0,
                timeSpent: 0,
            };
            GameState.state.practiceHistory.push(entry);
        }

        entry.sessionsCompleted++;
        entry.questionsAnswered += session.correctAnswers + session.wrongAnswers;
        entry.correctAnswers += session.correctAnswers;
        entry.totalXpEarned += xpReward;
        entry.totalCoinsEarned += coinsReward;
        entry.timeSpent += Math.round(duration);
    },
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionService;
}
