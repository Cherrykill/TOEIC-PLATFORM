// ===================================
// GAME STATE MANAGER (FIXED - FULL ASYNC)
// ===================================

const GameState = {

    // Debounce timer for save operations
    _saveTimeout: null,
    _isSaving: false,
    _pendingSave: false,
    _justInitialized: false,  // Prevent saves immediately after init
    _initBlockUntil: 0,       // Timestamp until which saves are blocked

    state: {
        user: {
            id: null,
            username: 'Player',
            avatar: 'P',
            level: 1,
            xp: 0,
            totalXp: 0,
            createdAt: Date.now(),
            lastLoginAt: Date.now()
        },

        resources: {
            energy: 100,
            maxEnergy: 100,
            coins: 0,
            gems: 0,
            hints: 0,
            shields: 0,
            timeFreezes: 0,
            lastEnergyUpdate: Date.now()
        },

        progress: {
            wordsLearned: [],
            wordsMastered: [],
            wrongWords: [], // Danh sách từ đã làm sai để luyện lại
            totalGamesPlayed: 0,
            totalCorrectAnswers: 0,
            totalWrongAnswers: 0,
            perfectRounds: 0,
            highestScore: 0,
            totalPlayTime: 0,
            modeStats: {
                'multiple-choice': { played: 0, score: 0, correct: 0, total: 0 },
                'fill-blank': { played: 0, score: 0, correct: 0, total: 0 },
                'listening': { played: 0, score: 0, correct: 0, total: 0 },
                'matching': { played: 0, score: 0, correct: 0, total: 0 },
                'word-scramble': { played: 0, score: 0, correct: 0, total: 0 },
                'speed-quiz': { played: 0, score: 0, correct: 0, total: 0 },
                'flashcard': { played: 0, score: 0, correct: 0, total: 0 },
                'review-mistakes': { played: 0, score: 0, correct: 0, total: 0 }
            }
        },

        streak: {
            current: 0,
            longest: 0,
            lastPlayDate: null,
            shieldsUsed: 0
        },

        quests: {
            daily: [],
            lastResetDate: null
        },

        achievements: [],

        boosts: {
            xp: { active: false, multiplier: 1, expiresAt: null },
            coins: { active: false, multiplier: 1, expiresAt: null }
        },

        settings: {
            randomQuestions: true,
            soundEnabled: true,
            soundEffects: true,
            autoPronunciation: false,
            practiceSoundEnabled: true, // Âm thanh phát âm trong luyện tập
            notificationsEnabled: true,
            volume: 70,
            questionsPerSession: 10,
            timeLimitEnabled: true,
            timePerQuestion: 30,
            difficulty: "adaptive", // ✅ Mặc định: tất cả levels
            levelFilter: null, // null = tất cả levels, hoặc mảng như ['A1', 'A2']
            autoSync: true,
            soundVolume: 1.0,
            musicVolume: 0.7
        },


        session: {
            currentScreen: 'home-screen',
            practiceMode: null,
            practiceData: null,
            isPaused: false
        }
    },

    // ============================
    // INIT
    // ============================
    async init() {
        console.log('🎮 Initializing GameState...');

        // Đảm bảo Storage đã init
        await Storage.init();

        // Load saved state
        const savedState = await Storage.get('gameState');

        let needsSave = false;

        if (savedState) {
            console.log('📦 Loading saved state...');
            console.log('🔍 DEBUG: savedState type:', typeof savedState, 'has success:', !!savedState.success, 'has data:', !!savedState.data);
            console.log('🔍 DEBUG: savedState.resources?.coins:', savedState.resources?.coins);
            console.log('🔍 DEBUG: savedState.data?.resources?.coins:', savedState.data?.resources?.coins);

            // ✅ FIX: Clean up response wrapper if exists
            // Server responses có format: { success: true, data: {...} }
            // Chỉ lấy data, không merge response fields
            let cleanState = savedState;
            if (savedState.success && savedState.data) {
                console.log('⚠️ Detected response wrapper, extracting data...');
                cleanState = savedState.data;
            }

            console.log('🔍 DEBUG: cleanState.resources?.coins:', cleanState.resources?.coins);
            this.state = Utils.deepMerge(this.state, cleanState);

            // ✅ Server đã tính energy regen trước khi trả data về.
            // Reset lastEnergyUpdate về hiện tại để frontend không tính thêm lần nữa.
            if (cleanState.resources?.energy !== undefined) {
                this.state.resources.lastEnergyUpdate = Date.now();
            }

            // ✅ Ensure new settings fields exist (for backward compatibility)
            // ONLY add if truly missing from SAVED state, not if it's false
            const defaultSettings = {
                practiceSoundEnabled: true,
                levelFilter: null
            };

            for (const [key, defaultValue] of Object.entries(defaultSettings)) {
                // Check in cleanState (saved data), not merged state
                const existsInSavedState = cleanState.settings && (key in cleanState.settings);

                if (!existsInSavedState && this.state.settings[key] === undefined) {
                    this.state.settings[key] = defaultValue;
                    console.log(`✅ Added missing setting: ${key} = ${defaultValue}`);
                    needsSave = true;
                } else if (existsInSavedState) {
                    console.log(`ℹ️ Setting "${key}" exists in saved state:`, cleanState.settings[key]);
                }
            }
        } else {
            console.log('🆕 Initializing new user...');
            this.initializeNewUser();
            needsSave = true;
        }

        // Update timestamps
        this.state.user.lastLoginAt = Date.now();

        // Check if streak/energy/boosts changed
        const oldEnergy = this.state.resources.energy;
        const oldStreak = this.state.streak.current;

        // ✅ FIX 2: Await các async operations
        this.updateStreak(); // No need to save individually
        this.regenerateEnergy(); // No need to save individually
        this.updateBoosts(); // Sync operation, không cần await
        this.checkDailyQuestsReset(); // Sync operation

        // Achievements are now loaded from the server via buildFullState.
        // Only initialize locally if the array is completely empty AND user is offline.
        if (this.state.achievements.length === 0 && !navigator.onLine) {
            console.log('📜 Offline: initializing achievements from config...');
            this.initializeAchievements();
            needsSave = true;
        }

        // Check if anything actually changed
        if (this.state.resources.energy !== oldEnergy || this.state.streak.current !== oldStreak) {
            needsSave = true;
        }

        // ✅ FIX: NEVER save immediately after init to prevent overwriting server data
        // Let the server be the source of truth on init
        // Auto-save will kick in later (every 30s) if there are changes
        console.log('⏭️ Skipping initial save to preserve server data');
        needsSave = false;

        // 🚫 BLOCK ALL SAVES for 5 seconds after init to prevent race conditions
        // This ensures that any auto-save or other save triggers don't overwrite
        // the fresh data we just loaded from the server
        this._justInitialized = true;
        this._initBlockUntil = Date.now() + 5000; // Block for 5 seconds
        console.log('🚫 Save operations BLOCKED for 5 seconds after init');

        setTimeout(() => {
            this._justInitialized = false;
            console.log('✅ Save operations UNBLOCKED - auto-save can now proceed normally');
        }, 5000);

        EventBus.emit(GameEvents.GAME_INITIALIZED, this.state);
        console.log('✅ GameState initialized successfully');
    },

    initializeNewUser() {
        this.state.user.id = Utils.generateId();
        this.state.user.createdAt = Date.now();
        this.generateDailyQuests();
    },

    initializeAchievements() {
        this.state.achievements = Config.achievements.map(a => ({
            ...a,
            unlocked: false,
            unlockedAt: null
        }));
    },

    // ============================
    // SAVE / SYNC
    // ============================
    async save() {
        // 🚫 CRITICAL FIX: Block saves for 5 seconds after init to prevent overwriting fresh server data
        if (this._justInitialized || Date.now() < this._initBlockUntil) {
            const timeRemaining = Math.ceil((this._initBlockUntil - Date.now()) / 1000);
            console.warn(`🚫 SAVE BLOCKED! Recently initialized (${timeRemaining}s remaining). Preventing data overwrite.`);
            console.warn('   This save would overwrite fresh data from server. Ignoring.');
            return false; // Return false to indicate save failed
        }

        // ✅ FIX: Debounce save to prevent race conditions
        // Clear any pending save timeout
        if (this._saveTimeout) {
            clearTimeout(this._saveTimeout);
        }

        // If already saving, mark that we need to save again after current save completes
        if (this._isSaving) {
            this._pendingSave = true;
            console.log('⏳ Save in progress, will retry after completion...');
            return;
        }

        // Debounce: wait 100ms before actually saving
        this._saveTimeout = setTimeout(async () => {
            await this._performSave();
        }, 100);
    },

    async _performSave() {
        try {
            this._isSaving = true;
            this._pendingSave = false;

            // ✅ FIX: Clean state before saving - remove response wrapper fields
            const cleanState = { ...this.state };
            delete cleanState.success;  // Remove response field if exists
            delete cleanState.data;     // Remove response field if exists

            // ✅ DEBUG: Log what we're about to save
            console.log('💾 GameState._performSave() - About to save:');
            console.log('   cleanState.resources.coins:', cleanState.resources?.coins);
            console.log('   cleanState.resources.gems:', cleanState.resources?.gems);
            console.log('   cleanState.user.level:', cleanState.user?.level);

            // Giao toàn bộ việc lưu trữ cho Storage module
            await Storage.set('gameState', cleanState);
            EventBus.emit(GameEvents.DATA_SAVED, cleanState);

            this._isSaving = false;

            // If there was a pending save request during our save, do it now
            if (this._pendingSave) {
                console.log('🔄 Performing pending save...');
                this._pendingSave = false;
                await this._performSave();
            }
        } catch (error) {
            console.error('❌ Failed to save state:', error);
            EventBus.emit(GameEvents.SAVE_FAILED, error);
            this._isSaving = false;
        }
    },

    getState() {
        return Utils.deepClone(this.state);
    },

    getUser() {
        return { ...this.state.user };
    },

    setUser(user) {
        this.state.user = { ...this.state.user, ...user };
    },

    async updateUser(updates) {
        this.state.user = { ...this.state.user, ...updates };
        await this.save();
    },

    getResources() {
        return { ...this.state.resources };
    },

    // ============================
    // XP / LEVEL
    // ============================
    async addXp(amount, skipSave = false) {
        let multiplier = this.state.boosts.xp.active ? this.state.boosts.xp.multiplier : 1;

        // VIP gets additional x2 multiplier
        if (this.isVIPActive()) {
            multiplier *= 2;
        }

        const actualAmount = Math.floor(amount * multiplier);

        this.state.user.xp += actualAmount;
        this.state.user.totalXp += actualAmount;

        EventBus.emit(GameEvents.USER_XP_GAINED, { amount: actualAmount, multiplier });

        await this.checkLevelUp();

        // ✅ FIX: Only save if not explicitly skipped (to avoid saving incomplete state during practice completion)
        if (!skipSave) {
            await this.save();
        }

        return actualAmount;
    },

    async checkLevelUp() {
        const maxLevel = Config.game?.maxLevel || 100;

        // If already at max level, don't level up
        if (this.state.user.level >= maxLevel) {
            return;
        }

        const xpNeeded = Utils.getXpForLevel(this.state.user.level);

        // If xpNeeded is 0, we're at max level
        if (xpNeeded === 0) {
            return;
        }

        if (this.state.user.xp >= xpNeeded) {
            this.state.user.xp -= xpNeeded;
            this.state.user.level++;

            // Cap at max level
            if (this.state.user.level > maxLevel) {
                this.state.user.level = maxLevel;
            }

            const coinsReward = Config.coinsRewards.levelUp;
            const gemsReward = Math.floor(this.state.user.level / 2); // 1 gem every 2 levels

            // ✅ FIX: Check if we're in practice mode
            const isPracticing = this.state.session?.currentScreen === 'practice-screen';
            await this.addCoins(coinsReward, isPracticing);  // skipSave if practicing
            await this.addGems(gemsReward, isPracticing);  // skipSave if practicing

            EventBus.emit(GameEvents.USER_LEVEL_UP, {
                level: this.state.user.level,
                coinsReward,
                gemsReward,
                isMaxLevel: this.state.user.level >= maxLevel
            });

            this.checkAchievements();

            // ✅ FIX: Don't save during practice mode
            if (!isPracticing) {
                await this.save();
            }
        }
    },

    // ============================
    // ENERGY (FIXED)
    // ============================
    async addEnergy(amount) {
        const before = this.state.resources.energy;
        this.state.resources.energy = Math.min(
            this.state.resources.energy + amount,
            this.state.resources.maxEnergy
        );
        const added = this.state.resources.energy - before;

        if (added > 0) {
            EventBus.emit(GameEvents.ENERGY_CHANGED, {
                current: this.state.resources.energy,
                max: this.state.resources.maxEnergy,
                added
            });

            // await this.save(); // ❌ REMOVE: Don't save here, let the caller decide when to save.
        }

        return added;
    },

    async useEnergy(amount) {
        if (this.state.resources.energy < amount) {
            EventBus.emit(GameEvents.ENERGY_DEPLETED);
            return false;
        }

        this.state.resources.energy -= amount;

        EventBus.emit(GameEvents.ENERGY_CHANGED, {
            current: this.state.resources.energy,
            max: this.state.resources.maxEnergy,
            used: amount
        });

        // await this.save(); // ❌ REMOVE: Let the caller decide.

        return true;
    },

    // ✅ FIX 2: Regenerate Energy - Async đầy đủ
    async regenerateEnergy() {
        const now = Date.now();
        const lastUpdate = this.state.resources.lastEnergyUpdate;
        const minutesPassed = Math.floor((now - lastUpdate) / 60000);

        if (minutesPassed > 0 && this.state.resources.energy < this.state.resources.maxEnergy) {
            console.log(`⚡ Regenerating ${minutesPassed} energy...`);

            await this.addEnergy(minutesPassed);
            this.state.resources.lastEnergyUpdate = now;

            // await this.save(); // ❌ REMOVE: This is part of init, save will be called at the end.
        }
    },

    // ============================
    // COINS / GEMS
    // ============================
    async addCoins(amount, skipSave = false) {
        // 🔍 DEBUG: Log WHERE coins are being added from
        console.log('💰💰💰 ADD COINS CALLED:');
        console.log('   Amount:', amount);
        console.log('   Stack trace:', new Error().stack);

        let multiplier = this.state.boosts.coins.active ? this.state.boosts.coins.multiplier : 1;

        // VIP gets additional x2 multiplier
        if (this.isVIPActive()) {
            multiplier *= 2;
        }

        const actualAmount = Math.floor(amount * multiplier);
        this.state.resources.coins += actualAmount;

        EventBus.emit(GameEvents.COINS_CHANGED, {
            amount: this.state.resources.coins,
            added: actualAmount
        });

        // ✅ FIX: Only save if not explicitly skipped (to avoid saving incomplete state during practice completion)
        if (!skipSave) {
            await this.save();
        }

        return actualAmount;
    },

    async useCoins(amount) {
        if (this.state.resources.coins < amount) return false;

        this.state.resources.coins -= amount;

        EventBus.emit(GameEvents.COINS_CHANGED, {
            amount: this.state.resources.coins,
            used: amount
        });

        await this.save();

        return true;
    },

    async addGems(amount, skipSave = false) {
        this.state.resources.gems += amount;

        EventBus.emit(GameEvents.GEMS_CHANGED, {
            amount: this.state.resources.gems,
            added: amount
        });

        // ✅ FIX: Only save if not explicitly skipped
        if (!skipSave) {
            await this.save();
        }
    },

    async useGems(amount) {
        if (this.state.resources.gems < amount) return false;

        this.state.resources.gems -= amount;

        EventBus.emit(GameEvents.GEMS_CHANGED, {
            amount: this.state.resources.gems,
            used: amount
        });

        await this.save();

        return true;
    },

    // ============================
    // STREAK (FIXED - Async)
    // ============================
    async updateStreak() {
        const today = Utils.getStartOfDay();
        const lastPlay = this.state.streak.lastPlayDate;

        if (!lastPlay) {
            this.state.streak.current = 1;
            this.state.streak.lastPlayDate = today;
            EventBus.emit(GameEvents.STREAK_UPDATED, this.state.streak);
            if (typeof Quest !== 'undefined') Quest.updateProgress('daily-streak', 1);
            return;
        }

        const lastPlayDay = Utils.getStartOfDay(lastPlay);
        const daysDiff = Math.floor((today - lastPlayDay) / 86400000);

        if (daysDiff === 0) {
            // Same day, no action needed
            return;
        } else if (daysDiff === 1) {
            // Next day - continue streak
            this.state.streak.current++;
            this.state.streak.lastPlayDate = today;

            if (this.state.streak.current > this.state.streak.longest) {
                this.state.streak.longest = this.state.streak.current;
            }

            EventBus.emit(GameEvents.STREAK_UPDATED, this.state.streak);
            if (typeof Quest !== 'undefined') Quest.updateProgress('daily-streak', 1);
            this.checkAchievements();
        } else {
            // Streak broken
            if (this.state.resources.shields > 0) {
                // Use shield to protect streak
                this.state.resources.shields--;
                this.state.streak.shieldsUsed++;
                this.state.streak.lastPlayDate = today;
                EventBus.emit(GameEvents.STREAK_PROTECTED, this.state.streak);
            } else {
                // Reset streak
                this.state.streak.current = 1;
                this.state.streak.lastPlayDate = today;
                EventBus.emit(GameEvents.STREAK_BROKEN);
            }
        }

        // await this.save(); // ❌ REMOVE
    },

    // ============================
    // DAILY QUESTS
    // ============================
    generateDailyQuests() {
        const templates = Utils.shuffleArray([...Config.dailyQuestsTemplates]);
        const selected = templates.slice(0, 3);

        this.state.quests.daily = selected.map(q => ({
            ...Utils.deepClone(q),
            id: Utils.generateId(),
            progress: 0,
            completed: false
        }));

        this.state.quests.lastResetDate = Utils.getStartOfDay();
        this.save();
    },

    checkDailyQuestsReset() {
        const today = Utils.getStartOfDay();
        const lastReset = this.state.quests.lastResetDate;

        if (!lastReset || today > lastReset) {
            this.generateDailyQuests();
            EventBus.emit(GameEvents.QUESTS_RESET);
        }
    },

    async updateQuestProgress(type, amount = 1, mode = null) {
        let updated = false;

        this.state.quests.daily.forEach(quest => {
            if (quest.completed) return;
            if (quest.type === type) {
                if (quest.mode && quest.mode !== mode) return;

                quest.progress += amount;

                if (quest.progress >= quest.target) {
                    quest.progress = quest.target;
                    quest.completed = true;

                    if (quest.reward.coins) this.addCoins(quest.reward.coins);
                    if (quest.reward.xp) this.addXp(quest.reward.xp);
                    if (quest.reward.gems) this.addGems(quest.reward.gems);

                    EventBus.emit(GameEvents.QUEST_COMPLETED, quest);
                } else {
                    EventBus.emit(GameEvents.QUEST_PROGRESS, quest);
                }

                updated = true;
            }
        });

        if (updated) {
            await this.save();
        }
    },

    // ============================
    // ACHIEVEMENTS
    // ============================
    checkAchievements() {
        // Achievements are claim-based: user clicks "Nhận thưởng" button.
        // Just refresh the UI so claimable achievements show the claim button.
        if (typeof AchievementsUI !== 'undefined') {
            AchievementsUI.loadAchievements();
        }
    },

    // ============================
    // BOOSTS
    // ============================
    updateBoosts() {
        const now = Date.now();
        let updated = false;

        Object.keys(this.state.boosts).forEach(type => {
            const boost = this.state.boosts[type];

            if (boost.active && boost.expiresAt && now >= boost.expiresAt) {
                boost.active = false;
                boost.multiplier = 1;
                boost.expiresAt = null;

                EventBus.emit(GameEvents.BOOST_EXPIRED, { type });
                updated = true;
            }
        });

        if (updated) {
            this.save();
        }
    },

    async activateBoost(type, multiplier, duration) {
        this.state.boosts[type] = {
            active: true,
            multiplier,
            expiresAt: Date.now() + duration * 1000
        };

        EventBus.emit(GameEvents.BOOST_ACTIVATED, { type, multiplier, duration });
        await this.save();
    },

    // ============================
    // WORD PROGRESS
    // ============================
    async learnWord(wordId) {
        if (!this.state.progress.wordsLearned.includes(wordId)) {
            this.state.progress.wordsLearned.push(wordId);

            EventBus.emit(GameEvents.WORD_LEARNED, { wordId });

            if (typeof Quest !== 'undefined') Quest.updateProgress('learn-words', 1);

            this.checkAchievements();
            // ✅ FIX: Don't save here - will save once when practice session completes
            // await this.save();
        }
    },

    /**
     * Thêm từ vào danh sách từ sai
     * @param {Object} word - Object từ vựng đã làm sai
     */
    addWrongWord(word) {
        if (!word || !word.id) return;

        // Tìm xem từ này đã có trong danh sách chưa
        const existingIndex = this.state.progress.wrongWords.findIndex(w => w.id === word.id);

        if (existingIndex !== -1) {
            // Nếu đã có, tăng số lần sai
            this.state.progress.wrongWords[existingIndex].wrongCount =
                (this.state.progress.wrongWords[existingIndex].wrongCount || 1) + 1;
            this.state.progress.wrongWords[existingIndex].lastWrongAt = Date.now();
        } else {
            // Nếu chưa có, thêm mới
            this.state.progress.wrongWords.push({
                ...word,
                wrongCount: 1,
                lastWrongAt: Date.now()
            });
        }

        // Giới hạn tối đa 100 từ sai gần nhất
        if (this.state.progress.wrongWords.length > 100) {
            // Sắp xếp theo thời gian, giữ lại 100 từ gần nhất
            this.state.progress.wrongWords.sort((a, b) => b.lastWrongAt - a.lastWrongAt);
            this.state.progress.wrongWords = this.state.progress.wrongWords.slice(0, 100);
        }
    },

    /**
     * Xóa từ khỏi danh sách từ sai (khi đã làm đúng trong review mode)
     * @param {string} wordId - ID của từ vựng
     */
    removeWrongWord(wordId) {
        const index = this.state.progress.wrongWords.findIndex(w => w.id === wordId);
        if (index !== -1) {
            this.state.progress.wrongWords.splice(index, 1);
        }
    },

    /**
     * Lấy danh sách từ sai
     */
    getWrongWords() {
        return this.state.progress.wrongWords || [];
    },

    /**
     * Xóa toàn bộ danh sách từ sai
     */
    clearWrongWords() {
        this.state.progress.wrongWords = [];
    },

    // ============================
    // VIP STATUS
    // ============================
    isVIPActive() {
        const vip = this.state.vip;
        if (!vip || !vip.active) return false;

        // Check if VIP has expired
        if (Date.now() > vip.expiresAt) {
            // VIP expired, deactivate
            this.state.vip.active = false;
            this.save();
            return false;
        }

        return true;
    },

    // ============================
    // STATISTICS
    // ============================
    getStatistics() {
        const total = this.state.progress.totalCorrectAnswers + this.state.progress.totalWrongAnswers;
        const accuracy = total > 0 ? Utils.percentage(this.state.progress.totalCorrectAnswers, total) : 0;

        return {
            wordsLearned: this.state.progress.wordsLearned.length,
            totalGamesPlayed: this.state.progress.totalGamesPlayed,
            accuracy,
            highestScore: this.state.progress.highestScore,
            perfectRounds: this.state.progress.perfectRounds,
            streak: this.state.streak.current,
            longestStreak: this.state.streak.longest,
            level: this.state.user.level,
            totalPlayTime: this.state.progress.totalPlayTime
        };
    },

    resetToGuest() {
        this.state.user = {
            id: null,
            username: "Player",
            avatar: "P",
            level: 1,
            xp: 0,
            totalXp: 0,
            createdAt: Date.now(),
            lastLoginAt: Date.now()
        };
    },

    async reset() {
        await Storage.remove('gameState');
        await this.init();
        EventBus.emit(GameEvents.GAME_RESET);
    },

    applyServerState(serverData) {
        if (!serverData) return;

        // Merge từng phần để tránh mất cấu trúc
        if (serverData.user) {
            this.state.user = { ...this.state.user, ...serverData.user };
        }

        if (serverData.resources) {
            this.state.resources = { ...this.state.resources, ...serverData.resources };
        }

        if (serverData.progress) {
            this.state.progress = Utils.deepMerge(this.state.progress, serverData.progress);
        }

        if (serverData.streak) {
            this.state.streak = { ...this.state.streak, ...serverData.streak };
        }

        if (serverData.quests) {
            this.state.quests = Utils.deepMerge(this.state.quests, serverData.quests);
        }

        if (serverData.achievements) {
            this.state.achievements = serverData.achievements;
        }

        if (serverData.boosts) {
            this.state.boosts = Utils.deepMerge(this.state.boosts, serverData.boosts);
        }
    }

};



// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameState;
}