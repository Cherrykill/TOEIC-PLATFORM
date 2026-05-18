// ===================================
// USER MODULE - Profile UI
// ===================================

const ProfileUI = {
    
    // DOM elements
    elements: {
        container: null,
        content: null
    },
    
    /**
     * Initialize UI
     */
    init() {
        this.elements.container = document.getElementById('profile-screen');
        this.elements.content = document.getElementById('profile-content');
        
        // Listen to screen change
        EventBus.on(GameEvents.SCREEN_CHANGED, (data) => {
            if (data.screen === 'profile-screen') {
                this.render();
            }
        });
        
        // Listen to user updates
        EventBus.on('user:usernameChanged', () => {
            this.render();
        });
        
        EventBus.on(GameEvents.USER_LEVEL_UP, () => {
            this.render();
        });
    },
    
    /**
     * Render profile
     */
    render() {
        if (!this.elements.content) return;
        
        const user = GameState.getUser();
        const resources = GameState.getResources();
        const stats = GameState.getStatistics();
        const streak = GameState.state.streak;
        const xpInfo = Utils.getLevelFromXp(user.totalXp);
        
        this.elements.content.innerHTML = `
            ${this.renderProfileHeader(user, xpInfo)}
            ${this.renderResourcesSection(resources)}
            ${this.renderStatsSection(stats, streak)}
            ${this.renderAchievementsSection()}
        `;
        
        // Attach event listeners
        this.attachEventListeners();
    },
    
    /**
     * Render profile header
     */
    renderProfileHeader(user, xpInfo) {
        const maxLevel = Config?.game?.maxLevel || 100;
        const isMaxLevel = xpInfo.isMaxLevel || user.level >= maxLevel;

        const xpBarContent = isMaxLevel
            ? `<div class="xp-bar">
                   <div class="xp-progress max-level" style="width: 100%"></div>
               </div>
               <div class="xp-text max-level-text">✨ MAX LEVEL ✨</div>`
            : `<div class="xp-bar">
                   <div class="xp-progress" style="width: ${Utils.percentage(xpInfo.currentXp, xpInfo.neededXp)}%"></div>
               </div>
               <div class="xp-text">
                   ${xpInfo.currentXp} / ${xpInfo.neededXp} XP
               </div>`;

        const userId = user.id || user._id || '—';
        return `
            <div class="profile-header">
                <div class="profile-avatar">${user.avatar}</div>
                <div class="profile-details">
                    <h2>${user.username}</h2>
                    <div class="profile-user-id">
                        <i class="fas fa-fingerprint"></i>
                        <span id="profile-id-text">ID: ${userId}</span>
                        <button class="btn-copy-id" id="copy-user-id-btn" data-copy="${userId}" title="Sao chép ID">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                    <div class="profile-level ${isMaxLevel ? 'max-level' : ''}">
                        <i class="fas fa-star"></i>
                        Level ${user.level}${isMaxLevel ? ' (MAX)' : ''}
                    </div>
                    <div class="profile-xp">
                        ${xpBarContent}
                    </div>
                    <button class="btn btn-secondary btn-sm" id="change-username-btn">
                        <i class="fas fa-edit"></i> Đổi tên
                    </button>
                </div>
            </div>
        `;
    },
    
    /**
     * Render resources section
     */
    renderResourcesSection(resources) {
        return `
            <section class="profile-section">
                <h3><i class="fas fa-wallet"></i> Tài nguyên</h3>
                <div class="resources-grid">
                    <div class="resource-card">
                        <div class="resource-icon energy">⚡</div>
                        <div class="resource-value">${resources.energy}</div>
                        <div class="resource-label">Năng lượng</div>
                        <small class="resource-max">Max: ${resources.maxEnergy}</small>
                    </div>
                    <div class="resource-card">
                        <div class="resource-icon coins">🪙</div>
                        <div class="resource-value">${Utils.formatNumber(resources.coins)}</div>
                        <div class="resource-label">Coins</div>
                    </div>
                    <div class="resource-card">
                        <div class="resource-icon gems">💎</div>
                        <div class="resource-value">${Utils.formatNumber(resources.gems)}</div>
                        <div class="resource-label">Gems</div>
                    </div>
                    <div class="resource-card">
                        <div class="resource-icon hints">💡</div>
                        <div class="resource-value">${resources.hints || 0}</div>
                        <div class="resource-label">Gợi ý</div>
                    </div>
                </div>
            </section>
        `;
    },
    
    /**
     * Render stats section
     */
    renderStatsSection(stats, streak) {
        return `
            <section class="profile-section">
                <h3><i class="fas fa-chart-bar"></i> Thống kê</h3>
                <div class="profile-stats">
                    <div class="profile-stat-card">
                        <div class="stat-icon">📚</div>
                        <div class="profile-stat-value">${stats.wordsLearned}</div>
                        <div class="profile-stat-label">Từ đã học</div>
                    </div>
                    <div class="profile-stat-card">
                        <div class="stat-icon">🎮</div>
                        <div class="profile-stat-value">${stats.totalGamesPlayed}</div>
                        <div class="profile-stat-label">Lượt chơi</div>
                    </div>
                    <div class="profile-stat-card">
                        <div class="stat-icon">🎯</div>
                        <div class="profile-stat-value">${stats.accuracy}%</div>
                        <div class="profile-stat-label">Độ chính xác</div>
                    </div>
                    <div class="profile-stat-card">
                        <div class="stat-icon">⭐</div>
                        <div class="profile-stat-value">${stats.perfectRounds}</div>
                        <div class="profile-stat-label">Vòng hoàn hảo</div>
                    </div>
                    <div class="profile-stat-card">
                        <div class="stat-icon">🏆</div>
                        <div class="profile-stat-value">${Utils.formatNumber(stats.highestScore)}</div>
                        <div class="profile-stat-label">Điểm cao nhất</div>
                    </div>
                    <div class="profile-stat-card">
                        <div class="stat-icon">🔥</div>
                        <div class="profile-stat-value">${streak.current}</div>
                        <div class="profile-stat-label">Streak hiện tại</div>
                        <small>Dài nhất: ${streak.longest}</small>
                    </div>
                </div>
            </section>
        `;
    },
    
    /**
     * Render achievements section
     */
    renderAchievementsSection() {
        const achievements = GameState.state.achievements;
        const unlockedCount = achievements.filter(a => a.unlocked).length;
        const totalCount = achievements.length;
        
        return `
            <section class="profile-section">
                <h3>
                    <i class="fas fa-medal"></i> 
                    Thành tích 
                    <span class="achievement-count">(${unlockedCount}/${totalCount})</span>
                </h3>
                <div class="achievements-preview">
                    ${achievements.slice(0, 6).map(achievement => `
                        <div class="achievement-badge ${achievement.unlocked ? 'unlocked' : 'locked'}">
                            <div class="achievement-icon">${achievement.icon}</div>
                            <div class="achievement-name">${achievement.name}</div>
                        </div>
                    `).join('')}
                </div>
                <button class="btn btn-secondary btn-block" id="view-all-achievements-btn">
                    Xem tất cả thành tích
                </button>
            </section>
        `;
    },
    
    /**
     * Render settings section
     */
    renderSettingsSection() {
        const settings = GameState.state.settings;
        
        return `
            <section class="profile-section">
                <h3><i class="fas fa-cog"></i> Cài đặt</h3>
                <div class="settings-list">
                    <div class="setting-item">
                        <div class="setting-info">
                            <i class="fas fa-volume-up"></i>
                            <span>Âm thanh</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" id="sound-toggle" ${settings.soundEnabled ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div class="setting-item">
                        <div class="setting-info">
                            <i class="fas fa-music"></i>
                            <span>Nhạc nền</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" id="music-toggle" ${settings.musicEnabled ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div class="setting-item">
                        <div class="setting-info">
                            <i class="fas fa-mobile-alt"></i>
                            <span>Rung</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" id="vibration-toggle" ${settings.vibrationEnabled ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div class="setting-item">
                        <div class="setting-info">
                            <i class="fas fa-bell"></i>
                            <span>Thông báo</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" id="notification-toggle" ${settings.notificationsEnabled ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </section>
            
            <section class="profile-section">
                <h3><i class="fas fa-database"></i> Dữ liệu</h3>
                <div class="data-actions">
                    <button class="btn btn-secondary btn-block" id="export-data-btn">
                        <i class="fas fa-download"></i> Export dữ liệu
                    </button>
                    <button class="btn btn-secondary btn-block" id="import-data-btn">
                        <i class="fas fa-upload"></i> Import dữ liệu
                    </button>
                    <input type="file" id="import-file-input" accept=".json" style="display: none;">
                    <button class="btn btn-error btn-block" id="reset-data-btn">
                        <i class="fas fa-trash"></i> Reset tất cả dữ liệu
                    </button>
                </div>
            </section>
        `;
    },
    
    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Change username
        const changeUsernameBtn = document.getElementById('change-username-btn');
        changeUsernameBtn?.addEventListener('click', () => {
            Auth.showUsernameChangeDialog();
        });

        // Copy user ID
        document.getElementById('copy-user-id-btn')?.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.copy;
            navigator.clipboard?.writeText(id).then(() => {
                Notification.show({ type: 'success', message: '✅ Đã sao chép ID!' });
            });
        });
        
        // View all achievements
        const viewAchievementsBtn = document.getElementById('view-all-achievements-btn');
        viewAchievementsBtn?.addEventListener('click', () => {
            this.showAllAchievements();
        });
    },
    
    /**
     * Show all achievements modal
     */
    showAllAchievements() {
        const achievements = GameState.state.achievements;
        
        const achievementsHtml = achievements.map(achievement => `
            <div class="achievement-item ${achievement.unlocked ? 'unlocked' : 'locked'}">
                <div class="achievement-icon-large">${achievement.icon}</div>
                <div class="achievement-details">
                    <h4>${achievement.name}</h4>
                    <p>${achievement.description}</p>
                    ${achievement.unlocked ? `
                        <div class="achievement-unlocked-date">
                            <i class="fas fa-check-circle"></i>
                            Mở khóa: ${new Date(achievement.unlockedAt).toLocaleDateString('vi-VN')}
                        </div>
                    ` : `
                        <div class="achievement-locked-message">
                            <i class="fas fa-lock"></i>
                            Chưa mở khóa
                        </div>
                    `}
                    <div class="achievement-rewards">
                        ${achievement.reward.coins ? `<span><i class="fas fa-coins"></i> ${achievement.reward.coins}</span>` : ''}
                        ${achievement.reward.xp ? `<span><i class="fas fa-star"></i> ${achievement.reward.xp} XP</span>` : ''}
                        ${achievement.reward.gems ? `<span><i class="fas fa-gem"></i> ${achievement.reward.gems}</span>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
        
        Modal.show({
            title: '🏆 Tất cả thành tích',
            content: `
                <div class="all-achievements">
                    ${achievementsHtml}
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
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProfileUI;
}