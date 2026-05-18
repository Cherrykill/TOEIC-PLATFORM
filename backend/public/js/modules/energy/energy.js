// ===================================
// ENERGY MODULE - Logic
// ===================================

const Energy = {
    
    /**
     * Initialize energy module
     */
    init() {
        // Listen to energy events
        EventBus.on(GameEvents.ENERGY_CHANGED, (data) => {
            this.onEnergyChanged(data);
        });
        
        EventBus.on(GameEvents.ENERGY_DEPLETED, () => {
            this.onEnergyDepleted();
        });
        
        EventBus.on(GameEvents.ENERGY_FULL, () => {
            this.onEnergyFull();
        });
    },
    
    /**
     * Get current energy
     */
    getCurrent() {
        return GameState.getResources().energy;
    },
    
    /**
     * Get max energy
     */
    getMax() {
        return GameState.getResources().maxEnergy;
    },
    
    /**
     * Get energy percentage
     */
    getPercentage() {
        const resources = GameState.getResources();
        return Utils.percentage(resources.energy, resources.maxEnergy);
    },
    
    /**
     * Check if has enough energy
     */
    hasEnough(amount) {
        // VIP users have unlimited energy
        if (this.isVIPActive()) {
            return true;
        }
        return this.getCurrent() >= amount;
    },

    /**
     * Check if VIP is active
     */
    isVIPActive() {
        const vip = GameState.state.vip;
        if (!vip || !vip.active) return false;

        // Check if VIP has expired
        if (Date.now() > vip.expiresAt) {
            // VIP expired, deactivate
            GameState.state.vip.active = false;
            GameState.save();
            return false;
        }

        return true;
    },
    
    /**
     * Use energy
     */
    use(amount) {
        return GameState.useEnergy(amount);
    },
    
    /**
     * Add energy
     */
    add(amount) {
        return GameState.addEnergy(amount);
    },
    
    /**
     * Refill energy to max
     */
    refillFull() {
        const resources = GameState.getResources();
        const needed = resources.maxEnergy - resources.energy;
        
        if (needed > 0) {
            this.add(needed);
            return true;
        }
        
        return false;
    },
    
    /**
     * Get time until next energy regen
     */
    getTimeUntilNextRegen() {
        const resources = GameState.getResources();
        const now = Date.now();
        const lastUpdate = resources.lastEnergyUpdate;
        const timePassed = now - lastUpdate;
        const timeToNext = Config.game.energyRegenInterval - (timePassed % Config.game.energyRegenInterval);
        
        return Math.floor(timeToNext / 1000);
    },
    
    /**
     * Get time until full energy
     */
    getTimeUntilFull() {
        const resources = GameState.getResources();
        
        if (resources.energy >= resources.maxEnergy) {
            return 0;
        }
        
        const needed = resources.maxEnergy - resources.energy;
        const minutes = needed * (Config.game.energyRegenInterval / 60000);
        
        return Math.floor(minutes * 60); // Return in seconds
    },
    
    /**
     * Check if can play mode
     */
    canPlayMode(mode) {
        const cost = Config.energyCosts[mode];
        
        if (!cost) {
            console.warn(`Unknown mode: ${mode}`);
            return false;
        }
        
        return this.hasEnough(cost);
    },
    
    /**
     * Get mode cost
     */
    getModeCost(mode) {
        return Config.energyCosts[mode] || 0;
    },
    
    /**
     * Handler: Energy changed
     */
    onEnergyChanged(data) {
        // Update UI will be handled by energyUI.js
        console.log('Energy changed:', data);
    },
    
    /**
     * Handler: Energy depleted
     */
    onEnergyDepleted() {
        console.log('Energy depleted!');
        
        // Show notification
        Notification.show({
            type: 'warning',
            title: 'Hết năng lượng!',
            message: 'Bạn cần mua thêm năng lượng hoặc đợi hồi phục.'
        });
        
        // Show energy refill modal
        this.showRefillModal();
    },
    
    /**
     * Handler: Energy full
     */
    onEnergyFull() {
        console.log('Energy full!');
        
        // Show notification
        Notification.show({
            type: 'success',
            title: 'Năng lượng đầy!',
            message: 'Bạn đã có đủ năng lượng để chơi.'
        });
    },
    
    /**
     * Show refill modal
     */
    showRefillModal() {
        const timeUntilFull = this.getTimeUntilFull();
        const timeText = Utils.formatTime(timeUntilFull);

        Modal.show({
            title: 'Hết năng lượng',
            content: `
                <div class="energy-refill-modal">
                    <div class="energy-icon">⚡</div>
                    <p>Bạn đã hết năng lượng!</p>
                    <p class="energy-info">Năng lượng sẽ đầy sau: <strong>${timeText}</strong></p>
                    <div class="refill-options">
                        <button class="btn btn-primary" id="buy-energy-coins-btn">
                            <i class="fas fa-coins"></i>
                            Mua 50 năng lượng (100 coins)
                        </button>
                        <button class="btn btn-secondary" id="buy-energy-gems-btn">
                            <i class="fas fa-gem"></i>
                            Đầy năng lượng (50 gems)
                        </button>
                    </div>
                </div>
            `,
            buttons: [
                {
                    text: 'Đóng',
                    className: 'btn-secondary',
                    onClick: () => Modal.close()
                }
            ]
        });

        // ✅ Attach event listeners after modal is shown (fix CSP violation)
        setTimeout(() => {
            const coinsBtn = document.getElementById('buy-energy-coins-btn');
            const gemsBtn = document.getElementById('buy-energy-gems-btn');

            if (coinsBtn) {
                coinsBtn.addEventListener('click', () => this.buyRefillCoins());
            }

            if (gemsBtn) {
                gemsBtn.addEventListener('click', () => this.buyRefillGems());
            }
        }, 100);
    },
    
    /**
     * Buy energy refill with coins
     */
    buyRefillCoins() {
        const cost = 100;
        const refillAmount = 50;
        
        if (GameState.useCoins(cost)) {
            this.add(refillAmount);
            
            Notification.show({
                type: 'success',
                title: 'Mua thành công!',
                message: `Đã nạp ${refillAmount} năng lượng.`
            });
            
            Modal.close();
        } else {
            Notification.show({
                type: 'error',
                title: 'Không đủ coins!',
                message: 'Bạn cần 100 coins để mua.'
            });
        }
    },
    
    /**
     * Buy energy refill with gems
     */
    buyRefillGems() {
        const cost = 50;
        
        if (GameState.useGems(cost)) {
            this.refillFull();
            
            Notification.show({
                type: 'success',
                title: 'Mua thành công!',
                message: 'Đã đầy năng lượng.'
            });
            
            Modal.close();
        } else {
            Notification.show({
                type: 'error',
                title: 'Không đủ gems!',
                message: 'Bạn cần 50 gems để mua.'
            });
        }
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Energy;
}