// ===================================
// LEADERBOARD MODULE - UI
// ===================================

const LeaderboardUI = {
    
    // DOM elements
    elements: {
        container: null,
        content: null,
        tabs: []
    },
    
    // Current period
    currentPeriod: 'daily',
    
    /**
     * Initialize UI
     */
    init() {
        this.elements.container = document.getElementById('leaderboard-screen');
        this.elements.content = document.getElementById('leaderboard-content');
        
        // Get tab buttons
        const tabButtons = document.querySelectorAll('.leaderboard-tabs .tab-btn');
        this.elements.tabs = Array.from(tabButtons);
        
        // Attach tab event listeners
        this.elements.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const period = tab.dataset.period;
                this.switchPeriod(period);
            });
        });
        
        // Refresh button
        document.getElementById('refresh-leaderboard-btn')?.addEventListener('click', async () => {
            const btn = document.getElementById('refresh-leaderboard-btn');
            const icon = btn?.querySelector('i');
            if (icon) icon.classList.add('fa-spin');
            await this.render();
            if (icon) icon.classList.remove('fa-spin');
        });

        // Share button
        document.getElementById('share-leaderboard-btn')?.addEventListener('click', () => this.share());

        // Search input
        document.getElementById('leaderboard-search-input')?.addEventListener('input', (e) => {
            const q = e.target.value.trim().toLowerCase();
            if (!this._leaderboardData) return;
            const filtered = q
                ? this._leaderboardData.filter(en =>
                    (en.username || '').toLowerCase().includes(q) ||
                    String(en.id || '').toLowerCase().includes(q))
                : this._leaderboardData;
            this._renderFiltered(filtered, this._currentUser);
            this._attachItemClicks();
        });

        // Listen to screen change
        EventBus.on(GameEvents.SCREEN_CHANGED, (data) => {
            if (data.screen === 'leaderboard-screen') {
                this.render();
            }
        });
        
        // Listen to score updates
        EventBus.on(GameEvents.HIGH_SCORE, (data) => {
            this.onHighScore(data);
        });
    },
    
    /**
     * Switch period tab
     */
    switchPeriod(period) {
        this.currentPeriod = period;
        
        // Update tab active state
        this.elements.tabs.forEach(tab => {
            if (tab.dataset.period === period) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // Render leaderboard
        this.render();
    },
    
    /**
     * Render leaderboard
     */
    async render() {
        if (!this.elements.content) return;

        // Show loading
        this.elements.content.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Đang tải bảng xếp hạng...</p>
            </div>
        `;

        // Fetch leaderboard from backend
        const leaderboard = await LeaderboardAPI.getLeaderboard(this.currentPeriod, {
            limit: 100,
            sortBy: 'totalXp'
        });

        if (!leaderboard || leaderboard.length === 0) {
            this.elements.content.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-trophy"></i>
                    <p>Chưa có dữ liệu xếp hạng</p>
                    <p class="text-secondary">Hãy chơi và đạt điểm cao để xuất hiện trên bảng xếp hạng!</p>
                </div>
            `;
            return;
        }

        const user = GameState.getUser();
        this._leaderboardData = leaderboard;
        this._currentUser = user;

        this._renderFiltered(leaderboard, user);

        // Fetch user's rank separately
        const userRankData = await LeaderboardAPI.getUserRank(user.id, this.currentPeriod, 'totalXp');

        // Add user's position if not in top list
        if (userRankData && userRankData.rank > leaderboard.length) {
            this.elements.content.innerHTML += this.renderUserPosition(userRankData);
        }

        // Attach click handlers cho từng item
        this._attachItemClicks();
    },
    
    _renderFiltered(list, user) {
        if (!this.elements.content) return;
        if (!list || list.length === 0) {
            this.elements.content.innerHTML = `<div class="empty-state"><i class="fas fa-search"></i><p>Không tìm thấy người chơi</p></div>`;
            return;
        }
        this.elements.content.innerHTML = list.map((entry, i) =>
            this.renderLeaderboardItem(entry, i + 1, entry.id === user?.id)
        ).join('');
    },

    _attachItemClicks() {
        this.elements.content?.querySelectorAll('.leaderboard-item[data-entry-id]').forEach(el => {
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => {
                const id = el.dataset.entryId;
                const entry = (this._leaderboardData || []).find(e => String(e.id) === String(id));
                if (entry) this.showPlayerPopup(entry);
            });
        });
    },

    showPlayerPopup(entry) {
        const existing = document.getElementById('player-popup-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'player-popup-modal';
        modal.className = 'player-popup-overlay';
        modal.innerHTML = `
            <div class="player-popup">
                <button class="player-popup-close" id="player-popup-close"><i class="fas fa-times"></i></button>
                <div class="player-popup-avatar">${entry.avatar || entry.username?.[0]?.toUpperCase() || '?'}</div>
                <h3 class="player-popup-name">${entry.username}</h3>
                <div class="player-popup-id">
                    <span>ID: ${entry.id || '—'}</span>
                    <button class="player-popup-copy" data-copy="${entry.id || ''}" title="Sao chép ID">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <div class="player-popup-stats">
                    <div class="player-stat">
                        <div class="player-stat-value">Level ${entry.level || '—'}</div>
                        <div class="player-stat-label">Cấp độ</div>
                    </div>
                    <div class="player-stat">
                        <div class="player-stat-value">${Utils.formatNumber(entry.score || entry.totalXp || 0)}</div>
                        <div class="player-stat-label">Điểm số</div>
                    </div>
                    ${entry.streak != null ? `<div class="player-stat">
                        <div class="player-stat-value">🔥 ${entry.streak}</div>
                        <div class="player-stat-label">Chuỗi ngày</div>
                    </div>` : ''}
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        document.getElementById('player-popup-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.player-popup-copy')?.addEventListener('click', (e) => {
            const text = e.currentTarget.dataset.copy;
            navigator.clipboard?.writeText(text).then(() => {
                Notification.show({ type: 'success', message: '✅ Đã sao chép ID!' });
            });
        });

        requestAnimationFrame(() => modal.classList.add('open'));
    },

    /**
     * Render leaderboard item
     */
    renderLeaderboardItem(entry, rank, isCurrentUser) {
        const medalClass = rank <= 3 ? 'medal-rank' : '';
        const currentUserClass = isCurrentUser ? 'current-user' : '';

        const onlineDot = `<span class="online-dot ${entry.isOnline ? 'online-dot--on' : 'online-dot--off'}" title="${entry.isOnline ? 'Đang online' : 'Offline'}"></span>`;

        return `
            <div class="leaderboard-item ${medalClass} ${currentUserClass}" data-entry-id="${entry.id || ''}">
                <div class="leaderboard-rank">${rank}</div>
                <div class="leaderboard-avatar-wrap">
                    <div class="leaderboard-avatar">${entry.avatar}</div>
                    ${onlineDot}
                </div>
                <div class="leaderboard-info">
                    <div class="leaderboard-name">
                        ${entry.username}
                        ${isCurrentUser ? '<span class="you-badge">(Bạn)</span>' : ''}
                    </div>
                    <div class="leaderboard-level">
                        <i class="fas fa-star"></i> Level ${entry.level}
                    </div>
                </div>
                <div class="leaderboard-score">
                    ${Utils.formatNumber(entry.score)}
                </div>
            </div>
        `;
    },
    
    /**
     * Render user position (if not in top list)
     */
    renderUserPosition(userRankData) {
        const user = GameState.getUser();

        if (!userRankData) {
            return `
                <div class="user-position-separator">...</div>
                <div class="leaderboard-item current-user">
                    <div class="leaderboard-rank">-</div>
                    <div class="leaderboard-avatar">${user.avatar}</div>
                    <div class="leaderboard-info">
                        <div class="leaderboard-name">
                            ${user.username}
                            <span class="you-badge">(Bạn)</span>
                        </div>
                        <div class="leaderboard-level">
                            <i class="fas fa-star"></i> Level ${user.level}
                        </div>
                    </div>
                    <div class="leaderboard-score">
                        Chưa có điểm
                    </div>
                </div>
            `;
        }

        const entry = {
            id: user.id,
            username: userRankData.username,
            avatar: user.avatar,
            level: user.level,
            xp: user.xp,
            totalXp: user.totalXp,
            score: user.progress?.highestScore || 0,
            streak: user.streak?.current || 0,
            gamesPlayed: user.progress?.totalGamesPlayed || 0
        };

        return `
            <div class="user-position-separator">...</div>
            ${this.renderLeaderboardItem(entry, userRankData.rank, true)}
        `;
    },
    
    /**
     * Handler: High score achieved
     */
    onHighScore(data) {
        // Show congratulations
        Modal.show({
            title: '🏆 Điểm cao mới!',
            content: `
                <div class="high-score-modal">
                    <div class="trophy-icon-large">🏆</div>
                    <h3>Chúc mừng!</h3>
                    <p>Bạn đã đạt xếp hạng <strong>#${data.rank}</strong></p>
                    <p class="score-display">${Utils.formatNumber(data.score)} điểm</p>
                    <p class="encourage-text">Tiếp tục cố gắng để leo lên top đầu!</p>
                </div>
            `,
            buttons: [
                {
                    text: 'Xem bảng xếp hạng',
                    className: 'btn-primary',
                    onClick: () => {
                        Modal.close();
                        UI.showScreen('leaderboard-screen');
                    }
                },
                {
                    text: 'Đóng',
                    className: 'btn-secondary',
                    onClick: () => Modal.close()
                }
            ]
        });
        
        // Play sound
        if (GameState.state.settings.soundEnabled) {
            Utils.playSound(Config.sounds.achievement, 0.8);
        }
    },
    
    /**
     * Show period info
     */
    showPeriodInfo() {
        const stats = Leaderboard.getStats(this.currentPeriod);
        
        const periodNames = {
            daily: 'Hôm nay',
            weekly: 'Tuần này',
            'all-time': 'Mọi lúc'
        };
        
        Modal.show({
            title: `Thống kê - ${periodNames[this.currentPeriod]}`,
            content: `
                <div class="leaderboard-stats">
                    <div class="stat-item">
                        <div class="stat-label">Tổng người chơi</div>
                        <div class="stat-value">${stats.totalPlayers}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Điểm trung bình</div>
                        <div class="stat-value">${Utils.formatNumber(stats.averageScore)}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Điểm cao nhất</div>
                        <div class="stat-value">${Utils.formatNumber(stats.highestScore)}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Điểm thấp nhất</div>
                        <div class="stat-value">${Utils.formatNumber(stats.lowestScore)}</div>
                    </div>
                </div>
            `,
            buttons: [
                {
                    text: 'Đóng',
                    className: 'btn-primary',
                    onClick: () => Modal.close()
                }
            ]
        });
    },

    /**
     * Share leaderboard rank with image
     */
    share() {
        const user = GameState.getUser();
        const periodNames = { daily: 'Hôm nay', weekly: 'Tuần này', 'all-time': 'Mọi lúc' };
        const period = periodNames[this.currentPeriod] || '';
        const name = user?.username || user?.name || 'Người dùng';
        const userId = user?.id || user?._id || '—';
        const xp = user?.totalXp ?? (GameState.state?.stats?.totalXp ?? 0);
        const rank = GameState.state?.stats?.rank ?? '?';

        const dataUrl = ShareCard.drawLeaderboard({ name, userId, xp, rank, period });
        const text = `🏆 ${name} đạt ${xp.toLocaleString()} XP trên bảng xếp hạng ${period.toLowerCase()}! Cùng luyện từ vựng TOEIC nào! 💪`;
        ShareCard.doShare(dataUrl, 'leaderboard.png', text, 'Bảng xếp hạng');
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LeaderboardUI;
}