// ===================================
// ACHIEVEMENTS UI MODULE
// ===================================

const AchievementsUI = {

    currentCategory: 'all',

    init() {
        this.attachListeners();
        this.loadAchievements();
    },

    attachListeners() {
        document.querySelectorAll('.achievement-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchCategory(e.currentTarget.dataset.category);
            });
        });
        document.getElementById('share-achievements-btn')?.addEventListener('click', () => this.share());
    },

    switchCategory(category) {
        this.currentCategory = category;
        document.querySelectorAll('.achievement-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === category);
        });
        this.loadAchievements();
    },

    /**
     * Load achievements from GameState (which comes from MongoDB via buildFullState)
     */
    loadAchievements() {
        const state = GameState.state;
        const allAchs = state.achievements || [];

        const filtered = this.currentCategory === 'all'
            ? allAchs
            : allAchs.filter(a => a.category === this.currentCategory);

        const total    = allAchs.length;
        const unlocked = allAchs.filter(a => a.unlocked).length;
        const pct      = total > 0 ? Math.round((unlocked / total) * 100) : 0;

        const el = document.getElementById('unlocked-achievements');
        if (el) el.textContent = `${unlocked}/${total}`;
        const bar = document.getElementById('achievement-progress');
        if (bar) bar.style.width = pct + '%';

        this.displayAchievements(filtered, state);
    },

    /**
     * Calculate progress for a single achievement based on conditionType
     */
    calculateProgress(ach, state) {
        const type = (ach.conditionType || '').toLowerCase().replace(/_/g, '-');
        const target = ach.conditionValue || 1;
        let current = 0;

        switch (type) {
            case 'words-learned':
                current = (state.progress?.wordsLearned || []).length;
                break;
            case 'sessions':
            case 'total-sessions':
                current = state.progress?.totalSessions || state.progress?.totalGamesPlayed || 0;
                break;
            case 'perfect-rounds':
                current = state.progress?.perfectRounds || 0;
                break;
            case 'correct-answers':
            case 'total-answers':
                current = state.progress?.totalCorrectAnswers || 0;
                break;
            case 'streak':
                current = state.streak?.current || 0;
                break;
            case 'level':
                current = state.user?.level || 1;
                break;
            case 'leaderboard':
                current = 0;
                break;
            default:
                current = 0;
        }

        current = Math.min(current, target);
        return { current, percentage: Math.round((current / target) * 100) };
    },

    displayAchievements(achievements, state) {
        const grid = document.getElementById('achievements-grid');
        if (!grid) return;

        if (!achievements.length) {
            grid.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-secondary)">
                <i class="fas fa-trophy" style="font-size:48px;margin-bottom:16px;opacity:.3"></i>
                <p>Chưa có thành tích nào trong danh mục này.</p>
            </div>`;
            return;
        }

        grid.innerHTML = achievements.map(ach => {
            const isUnlocked = !!ach.unlocked;
            const progress   = this.calculateProgress(ach, state);
            const isClaimable = !isUnlocked && progress.current >= (ach.conditionValue || 1);

            // Icon: could be emoji or FontAwesome class
            const iconHtml = ach.icon && ach.icon.length <= 4
                ? `<span style="font-size:28px">${ach.icon}</span>`
                : `<i class="fas ${ach.icon || (isUnlocked || isClaimable ? 'fa-trophy' : 'fa-lock')}"></i>`;

            // Reward display
            const rewardParts = [];
            if (ach.rewardCoins) rewardParts.push(`<i class="fas fa-coins"></i> ${ach.rewardCoins}`);
            if (ach.rewardXp)    rewardParts.push(`<i class="fas fa-star"></i> ${ach.rewardXp} XP`);
            if (ach.rewardGems)  rewardParts.push(`<i class="fas fa-gem"></i> ${ach.rewardGems}`);

            let bodyHtml, rewardHtml;

            if (isUnlocked) {
                bodyHtml   = `<span class="unlocked-badge">✓ Đã mở khóa</span>`;
                rewardHtml = `<div class="achievement-reward earned"><i class="fas fa-check-circle"></i> Đã nhận</div>`;
            } else if (isClaimable) {
                bodyHtml = `
                    <span class="achievement-progress-text" style="color:var(--success-color);font-weight:600">
                        ${progress.current}/${ach.conditionValue} — Hoàn thành!
                    </span>`;
                rewardHtml = `
                    <button class="btn btn-primary btn-sm claim-achievement-btn"
                        data-ach-id="${ach.id}"
                        style="margin-top:8px;animation:pulse 1.5s infinite">
                        <i class="fas fa-gift"></i> Nhận thưởng
                    </button>`;
            } else {
                bodyHtml = `
                    <div class="achievement-progress-bar">
                        <div class="progress-fill" style="width:${progress.percentage}%"></div>
                    </div>
                    <span class="achievement-progress-text">${progress.current}/${ach.conditionValue}</span>`;
                rewardHtml = `
                    <div class="achievement-reward">
                        ${rewardParts.join(' ')}
                    </div>`;
            }

            return `
                <div class="achievement-card ${isUnlocked ? 'unlocked' : isClaimable ? 'claimable' : 'locked'}">
                    <div class="achievement-icon ${isUnlocked || isClaimable ? 'gold' : ''}">
                        ${iconHtml}
                    </div>
                    <div class="achievement-info">
                        <h4>${ach.name}</h4>
                        <p>${ach.description}</p>
                        ${bodyHtml}
                    </div>
                    ${rewardHtml}
                </div>
            `;
        }).join('');

        grid.querySelectorAll('.claim-achievement-btn').forEach(btn => {
            btn.addEventListener('click', () => this.claimAchievement(btn.dataset.achId, btn));
        });
    },

    /**
     * Claim achievement — calls backend API to persist to MongoDB
     */
    async claimAchievement(achId, btn) {
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

        try {
            const data = await Http.api.unlockAchievement(achId);

            if (!data.success) {
                throw new Error(data.message || 'Lỗi không xác định');
            }

            // Update local state immediately so UI refreshes without full reload
            const achs = GameState.state.achievements || [];
            const idx  = achs.findIndex(a => a.id === achId);
            if (idx !== -1) {
                achs[idx].unlocked   = true;
                achs[idx].unlockedAt = new Date().toISOString();
            }

            // Update balance from server response
            if (data.data?.newBalance) {
                const bal = data.data.newBalance;
                if (bal.coins !== undefined) GameState.state.resources.coins = bal.coins;
                if (bal.gems  !== undefined) GameState.state.resources.gems  = bal.gems;
                if (bal.xp    !== undefined) GameState.state.user.xp         = bal.xp;
            }

            // Refresh UI
            this.loadAchievements();
            EventBus.emit(GameEvents.COINS_CHANGED, GameState.state.resources.coins);

            Notification.show({
                type: 'achievement',
                title: '🏆 Thành tích mới!',
                message: `Đã nhận thưởng: ${data.data?.achievement?.name || achId}`,
            });

        } catch (err) {
            console.error('[AchievementsUI] claimAchievement error:', err);
            Notification.show({ type: 'error', title: 'Lỗi', message: err.message });
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-gift"></i> Nhận thưởng'; }
        }
    },

    checkAchievements() {
        this.loadAchievements();
    },

    async share() {
        const state    = GameState.state;
        const unlocked = (state.achievements || []).filter(a => a.unlocked).length;
        const total    = (state.achievements || []).length;
        const user     = GameState.getUser();
        const name     = user?.username || user?.name || 'Người dùng';
        const userId   = user?.id || user?._id || '—';
        const xp       = user?.totalXp ?? (state?.stats?.totalXp ?? 0);

        const dataUrl = ShareCard.drawAchievements({ name, userId, unlocked, total, xp });
        const text    = `🏅 ${name} đã mở khóa ${unlocked}/${total} thành tích! Cùng luyện từ vựng TOEIC nào! 💪`;
        ShareCard.doShare(dataUrl, 'achievements.png', text, 'Thành tích của tôi');
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AchievementsUI;
}
