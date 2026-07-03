import { GameState } from '@game/state.js';
import { Utils } from '@lib/utils.js';
import { Config } from '@game/config.js';
import { EventBus, GameEvents } from '@game/eventBus.js';
import { Notification } from '@ui/Toaster.jsx';
import { Modal } from '@ui/Modal.jsx';

export const Energy = {

    init() {
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

    getCurrent() {
        return GameState.getResources().energy;
    },

    getMax() {
        return GameState.getResources().maxEnergy;
    },

    getPercentage() {
        const resources = GameState.getResources();
        return Utils.percentage(resources.energy, resources.maxEnergy);
    },

    hasEnough(amount) {
        if (this.isVIPActive()) {
            return true;
        }
        return this.getCurrent() >= amount;
    },

    isVIPActive() {
        const vip = GameState.state.vip;
        if (!vip || !vip.active) return false;

        if (Date.now() > vip.expiresAt) {
            GameState.state.vip.active = false;
            GameState.save();
            return false;
        }

        return true;
    },

    use(amount) {
        return GameState.useEnergy(amount);
    },

    add(amount) {
        return GameState.addEnergy(amount);
    },

    refillFull() {
        const resources = GameState.getResources();
        const needed = resources.maxEnergy - resources.energy;

        if (needed > 0) {
            this.add(needed);
            return true;
        }

        return false;
    },

    getTimeUntilNextRegen() {
        const resources = GameState.getResources();
        const now = Date.now();
        const lastUpdate = resources.lastEnergyUpdate;
        const timePassed = now - lastUpdate;
        const timeToNext = Config.game.energyRegenInterval - (timePassed % Config.game.energyRegenInterval);

        return Math.floor(timeToNext / 1000);
    },

    getTimeUntilFull() {
        const resources = GameState.getResources();

        if (resources.energy >= resources.maxEnergy) {
            return 0;
        }

        const needed = resources.maxEnergy - resources.energy;
        const minutes = needed * (Config.game.energyRegenInterval / 60000);

        return Math.floor(minutes * 60);
    },

    canPlayMode(mode) {
        const cost = Config.energyCosts[mode];

        if (!cost) {
            console.warn(`Unknown mode: ${mode}`);
            return false;
        }

        return this.hasEnough(cost);
    },

    getModeCost(mode) {
        return Config.energyCosts[mode] || 0;
    },

    onEnergyChanged(data) {
        console.log('Energy changed:', data);
    },

    onEnergyDepleted() {
        console.log('Energy depleted!');

        Notification.show({
            type: 'warning',
            title: 'Hết năng lượng!',
            message: 'Bạn cần mua thêm năng lượng hoặc đợi hồi phục.'
        });

        this.showRefillModal();
    },

    onEnergyFull() {
        console.log('Energy full!');

        Notification.show({
            type: 'success',
            title: 'Năng lượng đầy!',
            message: 'Bạn đã có đủ năng lượng để chơi.'
        });
    },

    // Số giây chính xác đến khi năng lượng đầy (tính theo thời gian thực).
    getSecondsUntilFull() {
        const r = GameState.getResources();
        if (r.energy >= r.maxEnergy) return 0;
        const interval = Config.game.energyRegenInterval; // ms cho +1 năng lượng
        const needed = r.maxEnergy - r.energy;
        const sinceLast = Date.now() - (r.lastEnergyUpdate || Date.now());
        const timeToNext = interval - (((sinceLast % interval) + interval) % interval);
        const totalMs = timeToNext + (needed - 1) * interval;
        return Math.max(0, Math.ceil(totalMs / 1000));
    },

    showRefillModal() {
        const fmt = (sec) => Utils.formatTime(Math.max(0, sec));

        Modal.show({
            title: 'Hết năng lượng',
            content: `
                <div class="energy-refill-modal">
                    <div class="energy-icon">⚡</div>
                    <p>Bạn đã hết năng lượng!</p>
                    <p class="energy-info">Năng lượng sẽ đầy sau: <strong id="energy-countdown">${fmt(this.getSecondsUntilFull())}</strong></p>
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
            onClose: () => this.stopRefillCountdown(),
            buttons: [
                {
                    text: 'Đóng',
                    className: 'btn-secondary',
                    onClick: () => Modal.close()
                }
            ]
        });

        setTimeout(() => {
            const coinsBtn = document.getElementById('buy-energy-coins-btn');
            const gemsBtn = document.getElementById('buy-energy-gems-btn');

            if (coinsBtn) {
                coinsBtn.addEventListener('click', () => this.buyRefillCoins());
            }

            if (gemsBtn) {
                gemsBtn.addEventListener('click', () => this.buyRefillGems());
            }

            // Đếm ngược real-time (cập nhật mỗi giây).
            this.stopRefillCountdown();
            this._refillTimer = setInterval(() => {
                const el = document.getElementById('energy-countdown');
                if (!el) { this.stopRefillCountdown(); return; }
                const sec = this.getSecondsUntilFull();
                el.textContent = fmt(sec);
                if (sec <= 0) this.stopRefillCountdown();
            }, 1000);
        }, 100);
    },

    stopRefillCountdown() {
        if (this._refillTimer) {
            clearInterval(this._refillTimer);
            this._refillTimer = null;
        }
    },

    playSound(name, volume = 0.6) {
        if (GameState.state?.settings?.soundEnabled === false) return;
        Utils.playSound(Config.sounds[name], volume);
    },

    buyRefillCoins() {
        const cost = 100;
        const refillAmount = 50;

        if (GameState.useCoins(cost)) {
            this.add(refillAmount);
            this.playSound('buyItem');

            Notification.show({
                type: 'success',
                title: 'Mua thành công!',
                message: `Đã nạp ${refillAmount} năng lượng.`
            });

            Modal.close();
        } else {
            this.playSound('wrong', 0.5);
            Notification.show({
                type: 'error',
                title: 'Không đủ coins!',
                message: 'Bạn cần 100 coins để mua.'
            });
        }
    },

    buyRefillGems() {
        const cost = 50;

        if (GameState.useGems(cost)) {
            this.refillFull();
            this.playSound('buyItem');

            Notification.show({
                type: 'success',
                title: 'Mua thành công!',
                message: 'Đã đầy năng lượng.'
            });

            Modal.close();
        } else {
            this.playSound('wrong', 0.5);
            Notification.show({
                type: 'error',
                title: 'Không đủ gems!',
                message: 'Bạn cần 50 gems để mua.'
            });
        }
    }
};

