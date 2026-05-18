// ===================================
// GAME LOOP & TIMER MANAGER
// ===================================

const GameLoop = {
    
    // Active timers
    timers: {},
    
    // Animation frame ID
    animationFrameId: null,
    
    // Update callbacks
    updateCallbacks: [],
    
    // Game running state
    isRunning: false,
    
    // Delta time tracking
    lastTime: 0,
    
    /**
     * Start game loop
     */
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastTime = performance.now();
        this.loop();
    },
    
    /**
     * Stop game loop
     */
    stop() {
        this.isRunning = false;
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    },
    
    /**
     * Main game loop
     */
    loop(currentTime = 0) {
        if (!this.isRunning) return;
        
        // Calculate delta time
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // Update all registered callbacks
        this.updateCallbacks.forEach(callback => {
            try {
                callback(deltaTime);
            } catch (error) {
                console.error('Update callback error:', error);
            }
        });
        
        // Update all active timers
        this.updateTimers(deltaTime);
        
        // Continue loop
        this.animationFrameId = requestAnimationFrame((time) => this.loop(time));
    },
    
    /**
     * Register update callback
     */
    onUpdate(callback) {
        this.updateCallbacks.push(callback);
        
        // Return unregister function
        return () => {
            this.updateCallbacks = this.updateCallbacks.filter(cb => cb !== callback);
        };
    },
    
    /**
     * Update all timers
     */
    updateTimers(deltaTime) {
        Object.keys(this.timers).forEach(id => {
            const timer = this.timers[id];
            
            if (timer.paused) return;
            
            timer.elapsed += deltaTime / 1000; // Convert to seconds
            
            if (timer.countdown) {
                timer.remaining = Math.max(0, timer.duration - timer.elapsed);
            } else {
                timer.remaining = timer.elapsed;
            }
            
            // Call tick callback
            if (timer.onTick) {
                timer.onTick(timer.remaining, timer.elapsed);
            }
            
            // Check if timer finished
            if (timer.countdown && timer.remaining <= 0) {
                if (timer.onComplete) {
                    timer.onComplete();
                }
                this.removeTimer(id);
            }
        });
    },
    
    /**
     * Create a new timer
     */
    createTimer(id, options = {}) {
        const timer = {
            id: id,
            duration: options.duration || 0,
            countdown: options.countdown !== false,
            elapsed: 0,
            remaining: options.countdown !== false ? options.duration : 0,
            paused: false,
            onTick: options.onTick || null,
            onComplete: options.onComplete || null,
            onPause: options.onPause || null,
            onResume: options.onResume || null
        };
        
        this.timers[id] = timer;
        
        EventBus.emit(GameEvents.TIMER_STARTED, { id, duration: timer.duration });
        
        return timer;
    },
    
    /**
     * Remove timer
     */
    removeTimer(id) {
        if (this.timers[id]) {
            delete this.timers[id];
            EventBus.emit(GameEvents.TIMER_ENDED, { id });
        }
    },
    
    /**
     * Pause timer
     */
    pauseTimer(id) {
        const timer = this.timers[id];
        if (timer && !timer.paused) {
            timer.paused = true;
            if (timer.onPause) {
                timer.onPause();
            }
        }
    },
    
    /**
     * Resume timer
     */
    resumeTimer(id) {
        const timer = this.timers[id];
        if (timer && timer.paused) {
            timer.paused = false;
            if (timer.onResume) {
                timer.onResume();
            }
        }
    },
    
    /**
     * Get timer
     */
    getTimer(id) {
        return this.timers[id];
    },
    
    /**
     * Get timer remaining time
     */
    getTimerRemaining(id) {
        const timer = this.timers[id];
        return timer ? timer.remaining : 0;
    },
    
    /**
     * Check if timer exists
     */
    hasTimer(id) {
        return !!this.timers[id];
    },
    
    /**
     * Clear all timers
     */
    clearTimers() {
        Object.keys(this.timers).forEach(id => {
            this.removeTimer(id);
        });
    }
};

// ===================================
// ENERGY REGENERATION
// ===================================

const EnergySystem = {
    
    regenIntervalId: null,
    
    /**
     * Start energy regeneration
     */
    startRegeneration() {
        if (this.regenIntervalId) return;
        
        // Regenerate 1 energy per minute
        this.regenIntervalId = setInterval(() => {
            this.regenerateEnergy();
        }, Config.game.energyRegenInterval);
        
        console.log('Energy regeneration started');
    },
    
    /**
     * Stop energy regeneration
     */
    stopRegeneration() {
        if (this.regenIntervalId) {
            clearInterval(this.regenIntervalId);
            this.regenIntervalId = null;
        }
    },
    
    /**
     * Regenerate energy
     */
    regenerateEnergy() {
        const resources = GameState.getResources();
        
        if (resources.energy < resources.maxEnergy) {
            GameState.addEnergy(Config.game.energyRegenRate);
            
            if (resources.energy >= resources.maxEnergy) {
                EventBus.emit(GameEvents.ENERGY_FULL);
            }
        }
    }
};

// ===================================
// DAILY QUEST RESET TIMER
// ===================================

const DailyQuestTimer = {
    
    checkIntervalId: null,
    
    /**
     * Start daily quest check
     */
    start() {
        if (this.checkIntervalId) return;
        
        // Check every minute
        this.checkIntervalId = setInterval(() => {
            this.checkReset();
        }, 60000);
        
        // Also check immediately
        this.checkReset();
    },
    
    /**
     * Stop daily quest check
     */
    stop() {
        if (this.checkIntervalId) {
            clearInterval(this.checkIntervalId);
            this.checkIntervalId = null;
        }
    },
    
    /**
     * Check if quests need reset
     */
    checkReset() {
        GameState.checkDailyQuestsReset();
    },
    
    /**
     * Get time until next reset
     */
    getTimeUntilReset() {
        return Utils.getTimeUntilMidnight();
    }
};

// ===================================
// BOOST EXPIRY CHECKER
// ===================================

const BoostChecker = {
    
    checkIntervalId: null,
    
    /**
     * Start boost checking
     */
    start() {
        if (this.checkIntervalId) return;
        
        // Check every second
        this.checkIntervalId = setInterval(() => {
            this.checkBoosts();
        }, 1000);
    },
    
    /**
     * Stop boost checking
     */
    stop() {
        if (this.checkIntervalId) {
            clearInterval(this.checkIntervalId);
            this.checkIntervalId = null;
        }
    },
    
    /**
     * Check boost expiry
     */
    checkBoosts() {
        GameState.updateBoosts();
    }
};

// ===================================
// AUTO SAVE
// ===================================

const AutoSave = {
    
    saveIntervalId: null,
    
    /**
     * Start auto save
     */
    start() {
        if (this.saveIntervalId) return;
        
        this.saveIntervalId = setInterval(() => {
            this.save();
        }, Config.ui.autoSaveInterval);
        
        console.log('Auto-save started');
    },
    
    /**
     * Stop auto save
     */
    stop() {
        if (this.saveIntervalId) {
            clearInterval(this.saveIntervalId);
            this.saveIntervalId = null;
        }
    },
    
    /**
     * Save game state
     */
    save() {
        // ✅ FIX: Don't auto-save during practice mode
        // Only save when not in practice, or when practice session completes
        const currentScreen = GameState.state.session?.currentScreen;
        const isPracticing = currentScreen === 'practice-screen';

        if (isPracticing) {
            console.log('⏸️ Auto-save skipped: Practice mode active');
            return;
        }

        GameState.save();
    }
};

// ===================================
// GAME SYSTEMS MANAGER
// ===================================

const GameSystems = {
    
    /**
     * Initialize all game systems
     */
    init() {
        // Start game loop
        GameLoop.start();
        
        // Start energy regeneration
        EnergySystem.startRegeneration();
        
        // Start daily quest timer
        DailyQuestTimer.start();
        
        // Start boost checker
        BoostChecker.start();
        
        // Start auto save
        AutoSave.start();
        
        console.log('All game systems initialized');
    },
    
    /**
     * Stop all game systems
     */
    stop() {
        GameLoop.stop();
        EnergySystem.stopRegeneration();
        DailyQuestTimer.stop();
        BoostChecker.stop();
        AutoSave.stop();
        
        console.log('All game systems stopped');
    },
    
    /**
     * Pause game systems
     */
    pause() {
        GameLoop.stop();
        EventBus.emit(GameEvents.GAME_PAUSED);
    },
    
    /**
     * Resume game systems
     */
    resume() {
        GameLoop.start();
        EventBus.emit(GameEvents.GAME_RESUMED);
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GameLoop,
        EnergySystem,
        DailyQuestTimer,
        BoostChecker,
        AutoSave,
        GameSystems
    };
}