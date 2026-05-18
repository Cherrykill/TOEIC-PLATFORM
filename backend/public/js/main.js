// ===================================
// MAIN ENTRY POINT (FIXED - Proper Init Order)
// ===================================

// Global UI helpers that will be used across modules
const UI = {
    currentScreen: 'home-screen',

    showScreen(screenId) {
        // ===========================================
        // FIX: CHẶN ĐIỀU HƯỚNG KHI ĐANG LUYỆN TẬP
        // ===========================================
        const isPracticing = PracticeManager.currentSession && !PracticeManager.currentSession.completed;

        // Nếu đang ở màn hình luyện tập, VÀ đang muốn chuyển sang màn hình khác, VÀ session chưa hoàn thành
        if (this.currentScreen === 'practice-screen' && screenId !== 'practice-screen' && isPracticing) {
            // Thay vì chuyển màn hình thẳng, gọi PracticeManager.exit() để hiển thị modal xác nhận.
            PracticeManager.exit(screenId);
            return; // Dừng hàm, không thực hiện chuyển màn hình
        }
        // ===========================================

        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Dừng tất cả âm thanh khi rời practice/toeic screen
        if (this.currentScreen !== screenId &&
            (this.currentScreen === 'practice-screen' || this.currentScreen === 'toeic-screen')) {
            if (typeof Utils !== 'undefined' && Utils.stopAllSounds) Utils.stopAllSounds();
        }

        // Show target screen
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenId;

            EventBus.emit(GameEvents.SCREEN_CHANGED, { screen: screenId });
        }
    },

    toggleMenu() {
        const menu = document.getElementById('side-menu');
        const overlay = document.getElementById('menu-overlay');

        if (menu && overlay) {
            menu.classList.toggle('active');
            overlay.classList.toggle('active');
        }
    },

    closeMenu() {
        const menu = document.getElementById('side-menu');
        const overlay = document.getElementById('menu-overlay');

        if (menu && overlay) {
            menu.classList.remove('active');
            overlay.classList.remove('active');
        }
        // Also close settings nav if open
        const settingsNav = document.querySelector('.settings-nav');
        settingsNav?.classList.remove('open');
    },

    toggleSettingsNav() {
        const nav = document.querySelector('.settings-nav');
        const overlay = document.getElementById('menu-overlay');
        if (nav && overlay) {
            const isOpen = nav.classList.toggle('open');
            overlay.classList.toggle('active', isOpen);
        }
    },

    closeSettingsNav() {
        const nav = document.querySelector('.settings-nav');
        const overlay = document.getElementById('menu-overlay');
        nav?.classList.remove('open');
        overlay?.classList.remove('active');
    }
};

// Global Modal helper
const Modal = {
    container: null,
    _closeTimer: null,

    init() {
        this.container = document.getElementById('modal-container');
    },

    show(options) {
        if (!this.container) return;

        // Cancel any pending close animation so previous timer doesn't wipe new content
        if (this._closeTimer) {
            clearTimeout(this._closeTimer);
            this._closeTimer = null;
        }

        const buttonsHtml = options.buttons?.map(btn => `
            <button class="btn ${btn.className || 'btn-primary'}" data-action="${btn.text}">
                ${btn.text}
            </button>
        `).join('') || '';

        this.container.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal">
                <div class="modal-header">
                    <h3>${options.title || 'Modal'}</h3>
                    ${options.headerSearch ? `
                        <div class="modal-header-search">
                            <i class="fas fa-search"></i>
                            <input type="text" id="modal-header-search-input"
                                placeholder="${options.headerSearch.placeholder || 'Tìm kiếm...'}"
                                autocomplete="off" spellcheck="false" />
                        </div>
                    ` : ''}
                    <button class="icon-btn modal-close-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    ${options.content || ''}
                </div>
                ${buttonsHtml ? `
                    <div class="modal-footer">
                        ${buttonsHtml}
                    </div>
                ` : ''}
            </div>
        `;

        this.container.classList.add('active');
        document.body.classList.add('modal-open');

        // Attach event listeners
        const closeBtn = this.container.querySelector('.modal-close-btn');
        closeBtn?.addEventListener('click', () => { this.close(); if (options.onClose) options.onClose(); });

        const backdrop = this.container.querySelector('.modal-backdrop');
        if (options.closeOnBackdrop !== false) {
            backdrop?.addEventListener('click', () => { this.close(); if (options.onClose) options.onClose(); });
        }

        // Header search
        if (options.headerSearch?.onSearch) {
            const searchWrap = this.container.querySelector('.modal-header-search');
            const searchInput = this.container.querySelector('#modal-header-search-input');

            if (searchInput) {
                searchInput.addEventListener('input', (e) => options.headerSearch.onSearch(e.target.value));
            }

            // Mobile: icon-only → tap to expand
            if (searchWrap && window.innerWidth <= 640) {
                searchWrap.addEventListener('click', (e) => {
                    if (!searchWrap.classList.contains('expanded')) {
                        searchWrap.classList.add('expanded');
                        searchInput?.focus();
                        e.stopPropagation();
                    }
                });
                document.addEventListener('click', function collapseSearch(e) {
                    if (!searchWrap.contains(e.target)) {
                        searchWrap.classList.remove('expanded');
                        if (searchInput) {
                            searchInput.value = '';
                            options.headerSearch.onSearch('');
                        }
                        document.removeEventListener('click', collapseSearch);
                    }
                });
            }
        }

        // Button actions
        if (options.buttons) {
            options.buttons.forEach(btn => {
                const buttonElement = this.container.querySelector(`[data-action="${btn.text}"]`);
                buttonElement?.addEventListener('click', () => {
                    if (btn.onClick) btn.onClick();
                    // Close the modal unless explicitly prevented
                    if (!btn.stayOpen) this.close();
                });
            });
        }

        EventBus.emit(GameEvents.MODAL_OPENED, options);
    },

    close() {
        if (this.container) {
            this.container.classList.remove('active');
            document.body.classList.remove('modal-open');
            if (this._closeTimer) clearTimeout(this._closeTimer);
            this._closeTimer = setTimeout(() => {
                this.container.innerHTML = '';
                this._closeTimer = null;
            }, 200);

            EventBus.emit(GameEvents.MODAL_CLOSED);
        }
    }
};

// Global Notification helper
const Notification = {
    container: null,

    init() {
        this.container = document.getElementById('notification-container');
    },

    show(options) {
        if (!this.container) return;

        const notification = document.createElement('div');
        notification.className = `notification ${options.type || 'info'}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getIcon(options.type)}"></i>
            <div class="notification-content">
                <div class="notification-title">${options.title || ''}</div>
                <div class="notification-message">${options.message || ''}</div>
            </div>
            <button class="icon-btn notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        this.container.appendChild(notification);

        // Close button
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn?.addEventListener('click', () => {
            this.remove(notification);
        });

        // Auto remove after duration
        const duration = options.duration || Config.ui.notificationDuration;
        setTimeout(() => {
            this.remove(notification);
        }, duration);

        EventBus.emit(GameEvents.NOTIFICATION_SHOWN, options);
    },

    remove(notification) {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            notification.remove();
        }, 300);
    },

    getIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || icons.info;
    }
};

// Global Tooltip helper (simple implementation)
const Tooltip = {
    show(element, content) {
        // Simple tooltip - can be enhanced later
        console.log('Tooltip:', content);
    }
};

// ===================================
// APPLICATION INITIALIZATION
// ===================================

class ToeicGame {
    constructor() {
        this.initialized = false;
    }

    async init() {
        console.log('🎮 Initializing TOEIC Game...');
        console.log('⏰ Start time:', new Date().toISOString());

        try {
            // Show loading screen
            this.showLoadingScreen();

            // ✅ FIX 3: Proper initialization order
            console.log('📦 Step 1: Initialize core systems...');
            await this.initCore();

            console.log('📦 Step 2: Initialize modules...');
            await this.initModules();

            console.log('🎨 Step 3: Initialize UI...');
            await this.initUI();

            console.log('🎧 Step 4: Setup event listeners...');
            this.setupEventListeners();

            console.log('⚙️ Step 5: Start game systems...');
            this.startSystems();

            // Hide loading, show game
            this.hideLoadingScreen();

            this.initialized = true;

            EventBus.emit(GameEvents.GAME_READY);

            console.log('✅ Game initialized successfully!');
            console.log('⏰ End time:', new Date().toISOString());

        } catch (error) {
            console.error('❌ Game initialization failed:', error);
            this.showError(error);
        }
    }

    showLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        const gameContainer = document.getElementById('game-container');

        if (loadingScreen && gameContainer) {
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                gameContainer.style.display = 'flex';
            }, 500);
        }
    }

    // ✅ FIX 3: Proper initialization order - Storage → Auth → GameState
    async initCore() {
        console.log('🔧 Initializing core systems...');

        // STEP 1: Initialize Storage FIRST (required by everything)
        if (typeof Storage !== 'undefined') {
            console.log('  📦 Initializing Storage...');
            await Storage.init();
            console.log('  ✅ Storage initialized');
        } else {
            throw new Error('Storage module not found');
        }

        // STEP 2: Initialize ServerStorage (required by Auth)
        if (typeof ServerStorage !== 'undefined') {
            console.log('  🌐 Initializing ServerStorage...');
            ServerStorage.init();
            console.log('  ✅ ServerStorage initialized');
        }

        // STEP 3: Initialize Auth (sets up token)
        if (typeof Auth !== 'undefined') {
            console.log('  🔐 Initializing Auth...');
            await Auth.init(); // ✅ NOW AWAITING - ensures token is ready
            console.log('  ✅ Auth initialized');
        } else {
            console.warn('  ⚠️ Auth module not found');
        }

        // STEP 4: Initialize GameState (needs Storage + Auth ready)
        if (typeof GameState !== 'undefined') {
            console.log('  🎮 Initializing GameState...');
            await GameState.init(); // This will use token from Auth
            console.log('  ✅ GameState initialized');
        } else {
            throw new Error('GameState module not found');
        }

        // STEP 5: Initialize GameLogic
        if (typeof GameLogic !== 'undefined') {
            console.log('  🎯 Initializing GameLogic...');
            await GameLogic.init();
            console.log('  ✅ GameLogic initialized');
        }

        // STEP 6: Initialize TopicSelector
        if (typeof TopicSelector !== 'undefined') {
            console.log('  📚 Initializing TopicSelector...');
            await TopicSelector.init();
            console.log('  ✅ TopicSelector initialized');

            // Restore last selected topic from localStorage
            console.log('  🔄 Restoring last selected topic...');
            await TopicSelector.restoreLastTopic();
            console.log('  ✅ Topic restored');
        }

        // STEP 7: Initialize PartSelector
        if (typeof PartSelector !== 'undefined') {
            console.log('  🔢 Initializing PartSelector...');
            await PartSelector.init();
            console.log('  ✅ PartSelector initialized');
        }

        // STEP 8: Initialize Shop
        if (typeof Shop !== 'undefined') {
            console.log('  🛒 Initializing Shop...');
            Shop.init();
            console.log('  ✅ Shop initialized');
        }

        // STEP 9: Initialize Quest
        if (typeof Quest !== 'undefined') {
            console.log('  📋 Initializing Quest...');
            Quest.init();
            console.log('  ✅ Quest initialized');
        }

        // STEP 10: Initialize Leaderboard
        if (typeof Leaderboard !== 'undefined') {
            console.log('  🏆 Initializing Leaderboard...');
            Leaderboard.init();
            console.log('  ✅ Leaderboard initialized');
        }

        // STEP 11: Initialize WrongWordsManager (spaced repetition)
        if (typeof WrongWordsManager !== 'undefined') {
            console.log('  📚 Initializing WrongWordsManager...');
            await WrongWordsManager.init();
            console.log('  ✅ WrongWordsManager initialized');
        }

        console.log('✅ Core systems initialized');
    }

    async initModules() {
        console.log('📦 Initializing modules...');

        // Initialize energy module
        if (typeof Energy !== 'undefined') {
            console.log('  ⚡ Initializing Energy...');
            Energy.init();
            console.log('  ✅ Energy initialized');
        }

        console.log('✅ Modules initialized');
    }

    async initUI() {
        console.log('🎨 Initializing UI...');

        // Initialize global UI helpers
        Modal.init();
        Notification.init();

        // Initialize module UIs
        if (typeof EnergyUI !== 'undefined') EnergyUI.init();
        if (typeof ShopUI !== 'undefined') ShopUI.init();
        if (typeof QuestUI !== 'undefined') QuestUI.init();
        if (typeof LeaderboardUI !== 'undefined') LeaderboardUI.init();
        if (typeof ProfileUI !== 'undefined') ProfileUI.init();
        if (typeof StatisticsUI !== 'undefined') StatisticsUI.init();
        if (typeof AchievementsUI !== 'undefined') AchievementsUI.init();
        if (typeof SettingsUI !== 'undefined') SettingsUI.init();
        if (typeof ToeicUI !== 'undefined') ToeicUI.init();
        if (typeof FavoritesUI !== 'undefined') FavoritesUI.init();
        // ✅ KHÔNG CẦN AuthUI.init() nữa vì đã merge vào Auth.init()

        // Update initial UI
        await this.updateUI();

        // Hiện thông báo chào sau khi UI đã load xong
        const welcomeName = sessionStorage.getItem('login_welcome');
        const welcomeType = sessionStorage.getItem('login_welcome_type');
        if (welcomeName) {
            sessionStorage.removeItem('login_welcome');
            sessionStorage.removeItem('login_welcome_type');
            setTimeout(() => {
                const isNew = welcomeType === 'new';
                Notification.show({
                    type: 'success',
                    title: isNew ? '🎉 Chào mừng đến với TOEIC App!' : '👋 Chào mừng trở lại!',
                    message: isNew
                        ? `Xin chào ${welcomeName}! Hãy bắt đầu hành trình học TOEIC cùng chúng tôi nhé 🚀`
                        : `Rất vui được gặp lại bạn, ${welcomeName}! Tiếp tục luyện tập thôi 💪`,
                });
            }, 800);
        }

        console.log('✅ UI initialized');
    }

    /**
     * FIX: Tách ra để chỉ cập nhật tài nguyên khi có sự kiện thay đổi Coin/Energy/Gem
     */
    _updateMenuLockState() {
        const loggedIn = typeof Auth !== 'undefined' && Auth.isLoggedIn;
        const locked = ['leaderboard-screen', 'achievements-screen', 'statistics-screen', 'settings-screen', 'toeic-screen'];
        document.querySelectorAll('.menu-item[data-screen]').forEach(item => {
            const needsLogin = locked.includes(item.dataset.screen);
            item.classList.toggle('menu-item--locked', needsLogin && !loggedIn);
        });
    }

    async updateResourcesUI() {
        const resources = GameState.getResources();
        const energyCountEl = document.getElementById('energy-count');
        const coinsCountEl = document.getElementById('coins-count');
        const gemsCountEl = document.getElementById('gems-count');

        if (energyCountEl) energyCountEl.textContent = resources.energy;
        // Dòng này sẽ được gọi lại tự động khi Coin thay đổi
        if (coinsCountEl) coinsCountEl.textContent = Utils.formatNumber(resources.coins);
        if (gemsCountEl) gemsCountEl.textContent = Utils.formatNumber(resources.gems);
    }

    setupEventListeners() {
        console.log('🎧 Setting up event listeners...');

        // Initialize Search (after DOM is ready)
        if (typeof Search !== 'undefined') {
            Search.init();
        }

        // 🔔 FIX: Listen for GameState changes and update UI
        if (typeof EventBus !== 'undefined' && typeof GameEvents !== 'undefined') {
            // Lắng nghe sự kiện Coin thay đổi (FIX lỗi của bạn)
            EventBus.on(GameEvents.COINS_CHANGED, async (data) => {
                console.log('EventBus: COINS_CHANGED detected, updating Coins UI...');
                await this.updateResourcesUI();
            });

            // Lắng nghe sự kiện Gems thay đổi
            EventBus.on(GameEvents.GEMS_CHANGED, async (data) => {
                console.log('EventBus: GEMS_CHANGED detected, updating Gems UI...');
                await this.updateResourcesUI();
            });

            // Lắng nghe sự kiện XP/Level thay đổi
            EventBus.on(GameEvents.USER_XP_GAINED, async (data) => {
                console.log('EventBus: USER_XP_GAINED detected, updating XP/Level/Resources UI...');
                await this.updateUI();
            });
            EventBus.on(GameEvents.USER_LEVEL_UP, async (data) => {
                console.log('EventBus: USER_LEVEL_UP detected, updating UI...');
                await this.updateUI();
            });
            EventBus.on(GameEvents.ENERGY_CHANGED, async (data) => {
                console.log('EventBus: ENERGY_CHANGED detected, updating Energy UI...');
                await this.updateResourcesUI();
            });
            EventBus.on(GameEvents.PRACTICE_COMPLETED, () => {
                this.updateModeCards();
            });
        }

        // Click avatar/user info → go home
        const userInfo = document.querySelector('.user-info');
        if (userInfo) {
            userInfo.style.cursor = 'pointer';
            userInfo.addEventListener('click', () => {
                UI.showScreen('home-screen');
                UI.closeMenu();
            });
        }

        // Theme toggle button
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        if (themeToggleBtn) {
            const updateThemeIcon = () => {
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                themeToggleBtn.querySelector('i').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
                themeToggleBtn.title = isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối';
            };
            updateThemeIcon();
            themeToggleBtn.addEventListener('click', () => {
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                SettingsUI.changeTheme(isDark ? 'light' : 'dark');
                updateThemeIcon();
            });
        }

        // Menu button
        const menuBtn = document.getElementById('menu-btn');
        menuBtn?.addEventListener('click', () => {
            if (UI.currentScreen === 'settings-screen' && window.innerWidth > 640) {
                UI.toggleSettingsNav();
            } else {
                UI.toggleMenu();
            }
        });

        const closeMenuBtn = document.getElementById('close-menu-btn');
        closeMenuBtn?.addEventListener('click', () => UI.closeMenu());

        const menuOverlay = document.getElementById('menu-overlay');
        menuOverlay?.addEventListener('click', () => UI.closeMenu());

        // Menu items
        // Screens requiring login
        const LOGIN_REQUIRED_SCREENS = new Set([
            'leaderboard-screen',
            'achievements-screen',
            'statistics-screen',
            'settings-screen',
            'toeic-screen',
        ]);

        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();

                const screenId = item.dataset.screen;

                // Guard: require login for certain screens
                if (screenId && LOGIN_REQUIRED_SCREENS.has(screenId) && !Auth.isLoggedIn) {
                    UI.closeMenu();
                    // Show login modal with a hint message
                    Notification.show({ type: 'warning', message: '🔒 Vui lòng đăng nhập để sử dụng tính năng này' });
                    Auth.showLogin();
                    return;
                }

                // Update active state
                menuItems.forEach(mi => mi.classList.remove('active'));
                item.classList.add('active');

                if (screenId) {
                    UI.showScreen(screenId);
                    UI.closeMenu();
                }
            });
        });

        // Home button
        const homeBtn = document.getElementById('home-btn');
        homeBtn?.addEventListener('click', () => {
            UI.showScreen('home-screen');
        });

        // Notification center
        NotificationCenter.init();

        // Shop button
        const shopBtn = document.getElementById('shop-btn');
        shopBtn?.addEventListener('click', () => {
            UI.showScreen('shop-screen');
            UI.closeMenu();
        });

        // Settings button
        const settingsBtn = document.getElementById('settings-btn');
        settingsBtn?.addEventListener('click', () => {
            UI.showScreen('settings-screen');
        });

        // Topic selector button
        const topicBtn = document.getElementById('topic-selector-btn');
        topicBtn?.addEventListener('click', () => {
            TopicSelector.showTopicSelectionModal();
        });

        // Upload button
        const uploadBtn = document.getElementById('upload-btn');
        uploadBtn?.addEventListener('click', () => {
            if (typeof UploadUI !== 'undefined') {
                UploadUI.showUploadModal();
            }
        });

        // Back buttons
        const backBtns = document.querySelectorAll('.back-btn-screen');
        backBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                UI.showScreen('home-screen');
            });
        });

        // Practice Screen back button
        const practiceBackBtn = document.getElementById('back-btn');
        if (practiceBackBtn) {
            practiceBackBtn.addEventListener('click', () => {
                console.log('🔙 Back button clicked - exiting practice mode');
                PracticeManager.exit('home-screen');
            });
        }

        // Game mode cards
        const gameModeCards = document.querySelectorAll('.game-mode-card');
        gameModeCards.forEach(card => {
            card.addEventListener('click', async () => { // ✅ Make this async
                const mode = card.dataset.mode;
                const energyCost = Config.energyCosts[mode] || 8;

                if (!Energy.hasEnough(energyCost)) {
                    Energy.showRefillModal();
                    return;
                }

                // Nếu mode yêu cầu chọn Part mà chưa chọn → mở modal chọn Part trước
                const needsPart = PartSelector.practiceMode === 'sequential' || PartSelector.practiceMode === 'random-part';
                if (needsPart && !PartSelector.selectedPart) {
                    PartSelector.pendingMode = mode;
                    PartSelector.showPartSelectionModal();
                    return;
                }

                await PracticeManager.start(mode); // ✅ Await the start
            });
        });

        console.log('✅ Event listeners setup complete');
    }

    startSystems() {
        console.log('⚙️ Starting game systems...');

        // Start all game systems
        if (typeof GameSystems !== 'undefined') {
            GameSystems.init();
        }

        console.log('✅ Game systems started');
    }

    async updateUI() {
        // Update locked menu items visual state
        this._updateMenuLockState();

        // Update user display
        const user = GameState.getUser();
        const usernameEl = document.getElementById('username');
        const userLevelEl = document.getElementById('user-level');
        const userAvatarEl = document.getElementById('user-avatar');

        if (usernameEl) usernameEl.textContent = user.username;
        if (userLevelEl) userLevelEl.textContent = user.level;
        if (userAvatarEl) userAvatarEl.textContent = user.avatar;

        // Update resources
        await this.updateResourcesUI(); // <-- Dùng hàm riêng đã được fix

        // Update XP bar
        const xpInfo = Utils.getLevelFromXp(user.totalXp);
        const xpProgressEl = document.getElementById('xp-progress');
        const currentXpEl = document.getElementById('current-xp');
        const neededXpEl = document.getElementById('needed-xp');
        const xpTextContainer = document.querySelector('.xp-text');

        if (xpInfo.isMaxLevel) {
            // Max level reached - show full bar and "MAX" text
            if (xpProgressEl) xpProgressEl.style.width = '100%';
            if (xpTextContainer) {
                xpTextContainer.innerHTML = '<span class="max-level-text">✨ MAX LEVEL ✨</span>';
            }
        } else {
            if (xpProgressEl) {
                const percentage = Utils.percentage(xpInfo.currentXp, xpInfo.neededXp);
                xpProgressEl.style.width = `${percentage}%`;
            }
            if (currentXpEl) currentXpEl.textContent = xpInfo.currentXp;
            if (neededXpEl) neededXpEl.textContent = xpInfo.neededXp;
        }

        // Update streak
        const streak = GameState.state.streak;
        const streakCountEl = document.getElementById('streak-count');
        if (streakCountEl) streakCountEl.textContent = streak.current;

        // Update stats
        const stats = GameState.getStatistics();
        const wordsLearnedEl = document.getElementById('words-learned');
        const totalScoreEl = document.getElementById('total-score');
        const accuracyRateEl = document.getElementById('accuracy-rate');
        const rankPositionEl = document.getElementById('rank-position');

        if (wordsLearnedEl) wordsLearnedEl.textContent = stats.wordsLearned;
        if (totalScoreEl) totalScoreEl.textContent = Utils.formatNumber(GameState.state.progress.totalXp ?? GameState.state.user?.totalXp ?? 0);
        if (accuracyRateEl) accuracyRateEl.textContent = `${stats.accuracy}%`;

        // Fetch rank từ server
        if (rankPositionEl) {
            const user = GameState.getUser();
            if (user?.id && typeof LeaderboardAPI !== 'undefined') {
                LeaderboardAPI.getUserRank(user.id, 'all-time', 'totalXp').then(data => {
                    rankPositionEl.textContent = data?.rank ? `#${data.rank}` : '-';
                }).catch(() => {
                    rankPositionEl.textContent = '-';
                });
            }
        }

        // Update wrong words count on review-mistakes card
        if (typeof WrongWordsManager !== 'undefined') {
            // Dùng WrongWordsManager để cập nhật UI
            WrongWordsManager.updateUI().catch(err => {
                console.error('Failed to update wrong words UI:', err);
            });
        } else {
            // Fallback: Dùng GameState cũ
            const wrongWords = GameState.getWrongWords();
            const wrongWordsCountEl = document.querySelector('#wrong-words-count span');
            if (wrongWordsCountEl) {
                wrongWordsCountEl.textContent = wrongWords.length;
            }
        }

        // Update mode completion badges on each mode card
        this.updateModeCards();
    }

    updateModeCards() {
        const modeStats = GameState.state?.progress?.modeStats || {};

        document.querySelectorAll('.game-mode-card[data-mode]').forEach(card => {
            const mode = card.dataset.mode;
            if (mode === 'review-mistakes') return; // has its own display

            // Remove old badge if exists
            card.querySelector('.mode-stats-badge')?.remove();

            const stats = modeStats[mode];
            const badge = document.createElement('div');
            badge.className = 'mode-stats-badge';

            if (!stats || stats.played === 0) {
                badge.classList.add('mode-stats-badge--new');
                badge.innerHTML = `<span class="mode-badge-new"><i class="fas fa-circle-play"></i> Chưa chơi</span>`;
            } else {
                const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                badge.innerHTML = `
                    <span class="mode-badge-played" title="Đã chơi ${stats.played} lần">
                        <i class="fas fa-check-circle"></i> ${stats.played}
                    </span>
                    <span class="mode-badge-accuracy" title="Độ chính xác">
                        ${accuracy}%
                    </span>
                `;
            }

            card.appendChild(badge);
        });
    }

    startPracticeMode(mode) {
        // Nếu mode yêu cầu chọn Part mà chưa chọn → mở modal chọn Part trước
        const needsPart = PartSelector.practiceMode === 'sequential' || PartSelector.practiceMode === 'random-part';
        if (needsPart && !PartSelector.selectedPart) {
            Notification.show({
                type: 'warning',
                title: '⚠️ Chưa chọn Part',
                message: 'Vui lòng chọn Part trước khi bắt đầu luyện tập.',
            });
            PartSelector.showPartSelectionModal();
            return;
        }

        if (typeof PracticeManager !== 'undefined') {
            PracticeManager.start(mode);
        }
    }

    showError(error) {
        const loadingScreen = document.getElementById('loading-screen');

        if (loadingScreen) {
            loadingScreen.innerHTML = `
                <div class="loading-content">
                    <i class="fas fa-exclamation-triangle" style="font-size: 64px; color: var(--error-color);"></i>
                    <h2>Lỗi khởi động game</h2>
                    <p>${error.message}</p>
                    <button class="btn btn-primary"">
                        Tải lại trang
                    </button>
                </div>
            `;
        }
    }
}

// ===================================
// START THE GAME
// ===================================

// ===================================
// STATUS BAR: Hide on scroll down, show on scroll up
// ===================================
(function initStatusBarScroll() {
    let lastScrollY = 0;
    let ticking = false;

    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                const statusBar = document.getElementById('status-bar');
                if (statusBar) {
                    const currentScrollY = window.scrollY;
                    if (currentScrollY > lastScrollY && currentScrollY > 40) {
                        statusBar.classList.add('status-bar--hidden');
                    } else {
                        statusBar.classList.remove('status-bar--hidden');
                    }
                    lastScrollY = currentScrollY;
                }
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });
})();

document.addEventListener('DOMContentLoaded', async () => {
    console.log('='.repeat(60));
    console.log('🎮 TOEIC GAME - Starting initialization...');
    console.log('='.repeat(60));

    try {
        const game = new ToeicGame();

        // ✅ SET WINDOW.GAME TRƯỚC KHI INIT (để AuthUI có thể dùng)
        window.game = game;
        window.GameState = GameState;
        window.Utils = Utils;
        window.UI = UI;

        // Preload feedback sounds to eliminate playback delay
        Utils.preloadSounds([
            Config.sounds.correct,
            Config.sounds.wrong,
            Config.sounds.complete,
        ]);

        // Giờ mới init
        await game.init();

        // Tự động đăng xuất khi server trả về tài khoản bị khóa (423)
        EventBus.on('account:locked', ({ lockType }) => {
            if (typeof Auth !== 'undefined' && Auth.isLoggedIn) {
                Auth.forceLogout(lockType);
            }
        });

        // Heartbeat: ping ngay khi load, sau đó mỗi 2 phút
        const sendHeartbeat = () => Http.post('/user/heartbeat', {}).catch(() => {});
        sendHeartbeat();
        setInterval(sendHeartbeat, 2 * 60 * 1000);

        console.log('='.repeat(60));
        console.log('✅ GAME READY - All systems operational');
        console.log('='.repeat(60));
    } catch (error) {
        console.error('='.repeat(60));
        console.error('❌ FATAL ERROR during initialization:', error);
        console.error('='.repeat(60));
    }
});