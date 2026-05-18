// ===================================
// ENERGY MODULE - UI
// ===================================

const EnergyUI = {
    
    // DOM elements
    elements: {
        energyCount: null,
        energyMax: null
    },
    
    /**
     * Initialize UI
     */
    init() {
        // Get DOM elements
        this.elements.energyCount = document.getElementById('energy-count');
        this.elements.energyMax = this.elements.energyCount?.nextElementSibling;
        
        // Listen to energy events
        EventBus.on(GameEvents.ENERGY_CHANGED, (data) => {
            this.updateDisplay(data.current, data.max);
        });
        
        // Initial update
        this.updateDisplay();
    },
    
    /**
     * Update energy display
     */
    updateDisplay(current = null, max = null) {
        if (current === null || max === null) {
            const resources = GameState.getResources();
            current = resources.energy;
            max = resources.maxEnergy;
        }
        
        if (this.elements.energyCount) {
            // Animate count change
            this.animateCount(this.elements.energyCount, current);
        }
        
        // Update color based on energy level
        this.updateColor(current, max);
    },
    
    /**
     * Animate number change
     */
    animateCount(element, targetValue) {
        const currentValue = parseInt(element.textContent) || 0;
        
        if (currentValue === targetValue) return;
        
        const duration = 300;
        const steps = 20;
        const stepDuration = duration / steps;
        const increment = (targetValue - currentValue) / steps;
        
        let step = 0;
        const interval = setInterval(() => {
            step++;
            const newValue = Math.round(currentValue + (increment * step));
            element.textContent = newValue;
            
            if (step >= steps) {
                clearInterval(interval);
                element.textContent = targetValue;
            }
        }, stepDuration);
    },
    
    /**
     * Update color based on energy level
     */
    updateColor(current, max) {
        if (!this.elements.energyCount) return;
        
        const percentage = (current / max) * 100;
        const parent = this.elements.energyCount.closest('.energy-display');
        
        if (!parent) return;
        
        // Remove existing classes
        parent.classList.remove('energy-low', 'energy-medium', 'energy-high');
        
        // Add appropriate class
        if (percentage <= 20) {
            parent.classList.add('energy-low');
        } else if (percentage <= 50) {
            parent.classList.add('energy-medium');
        } else {
            parent.classList.add('energy-high');
        }
    },
    
    /**
     * Show energy tooltip
     */
    showTooltip() {
        const resources = GameState.getResources();
        const timeUntilFull = Energy.getTimeUntilFull();
        const timeText = Utils.formatTime(timeUntilFull);
        
        const tooltipContent = `
            <div class="energy-tooltip">
                <div class="tooltip-row">
                    <span>Năng lượng hiện tại:</span>
                    <strong>${resources.energy}/${resources.maxEnergy}</strong>
                </div>
                ${resources.energy < resources.maxEnergy ? `
                    <div class="tooltip-row">
                        <span>Đầy sau:</span>
                        <strong>${timeText}</strong>
                    </div>
                ` : `
                    <div class="tooltip-row">
                        <span class="text-success">Năng lượng đầy!</span>
                    </div>
                `}
                <div class="tooltip-row">
                    <span>Hồi phục:</span>
                    <strong>1 năng lượng/phút</strong>
                </div>
            </div>
        `;
        
        // Show tooltip (will be implemented in UI helper)
        Tooltip.show(this.elements.energyCount, tooltipContent);
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnergyUI;
}