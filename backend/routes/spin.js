const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const UserSpin = require('../models/UserSpin');
const UserStats = require('../models/UserStats');
const logger = require('../utils/logger');

const SPIN_COST = { coin: 100, gem: 5 };

// Phải khớp thứ tự với PRIZES trong SpinWheelModal.jsx
const PRIZES = [
    { type: 'coins',  amount: 50,  label: '50 Xu'   },
    { type: 'gems',   amount: 5,   label: '5 Đá'    },
    { type: 'xp',     amount: 100, label: '100 XP'  },
    { type: 'coins',  amount: 100, label: '100 Xu'  },
    { type: 'coins',  amount: 200, label: '200 Xu'  },
    { type: 'gems',   amount: 10,  label: '10 Đá'   },
    { type: 'energy', amount: 100, label: 'Nạp NL'  },
    { type: 'hints',  amount: 2,   label: '2 Gợi ý' },
];

// Tỷ lệ theo chế độ quay — index khớp với PRIZES
const PROBS = {
    free: [0.28, 0.18, 0.18, 0.14, 0.10, 0.06, 0.04, 0.02],
    coin: [0.25, 0.15, 0.18, 0.16, 0.12, 0.07, 0.05, 0.02],
    gem:  [0.05, 0.10, 0.15, 0.20, 0.20, 0.15, 0.10, 0.05],
};

function pickPrize(mode) {
    const probs = PROBS[mode] || PROBS.free;
    const r = Math.random();
    let cumulative = 0;
    for (let i = 0; i < PRIZES.length; i++) {
        cumulative += probs[i];
        if (r < cumulative) return i;
    }
    return PRIZES.length - 1;
}

function msUntilMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return midnight - now;
}

router.get('/status', protect, async (req, res) => {
    try {
        const [spin, stats] = await Promise.all([
            UserSpin.findOne({ userId: req.user.id }).lean(),
            UserStats.findOne({ userId: req.user.id }).select('coins gems').lean(),
        ]);

        let canFreeSpin = true, nextSpinAt = null;
        if (spin?.lastSpinAt) {
            const lastMidnight = new Date(spin.lastSpinAt);
            lastMidnight.setHours(0, 0, 0, 0);
            const todayMidnight = new Date();
            todayMidnight.setHours(0, 0, 0, 0);
            canFreeSpin = lastMidnight < todayMidnight;
            if (!canFreeSpin) nextSpinAt = new Date(Date.now() + msUntilMidnight());
        }

        res.json({
            success: true,
            canSpin: canFreeSpin,  // backward compat
            canFreeSpin,
            nextSpinAt,
            totalSpins: spin?.totalSpins || 0,
            coins: stats?.coins || 0,
            gems: stats?.gems || 0,
            costs: SPIN_COST,
        });
    } catch (err) {
        logger.error('Spin status error:', err);
        res.status(500).json({ success: false, message: 'Lỗi kiểm tra trạng thái' });
    }
});

router.post('/', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const mode = ['free', 'coin', 'gem'].includes(req.body.mode) ? req.body.mode : 'free';

        const [spin, stats] = await Promise.all([
            UserSpin.findOne({ userId }),
            UserStats.findOne({ userId }),
        ]);

        if (mode === 'free') {
            if (spin?.lastSpinAt) {
                const lastMidnight = new Date(spin.lastSpinAt);
                lastMidnight.setHours(0, 0, 0, 0);
                const todayMidnight = new Date();
                todayMidnight.setHours(0, 0, 0, 0);
                if (lastMidnight >= todayMidnight) {
                    return res.status(429).json({ success: false, message: 'Bạn đã quay miễn phí hôm nay rồi!' });
                }
            }
        } else if (mode === 'coin') {
            if ((stats?.coins || 0) < SPIN_COST.coin) {
                return res.status(400).json({ success: false, message: `Không đủ xu! Cần ${SPIN_COST.coin} xu.` });
            }
        } else if (mode === 'gem') {
            if ((stats?.gems || 0) < SPIN_COST.gem) {
                return res.status(400).json({ success: false, message: `Không đủ đá quý! Cần ${SPIN_COST.gem} đá.` });
            }
        }

        const prizeIndex = pickPrize(mode);
        const prize = PRIZES[prizeIndex];

        // Áp dụng phần thưởng + trừ chi phí
        const rewardUpdate = {};
        if (prize.type === 'coins')  rewardUpdate.$inc = { coins: prize.amount };
        if (prize.type === 'gems')   rewardUpdate.$inc = { gems: prize.amount };
        if (prize.type === 'xp')     rewardUpdate.$inc = { xp: prize.amount, totalXp: prize.amount };
        if (prize.type === 'hints')  rewardUpdate.$inc = { hints: prize.amount };
        if (prize.type === 'energy') rewardUpdate.$set = { energy: 100, lastEnergyUpdate: new Date() };

        // Trừ chi phí (merge vào $inc)
        if (mode === 'coin') {
            rewardUpdate.$inc = { ...(rewardUpdate.$inc || {}), coins: (rewardUpdate.$inc?.coins || 0) - SPIN_COST.coin };
        }
        if (mode === 'gem') {
            rewardUpdate.$inc = { ...(rewardUpdate.$inc || {}), gems: (rewardUpdate.$inc?.gems || 0) - SPIN_COST.gem };
        }

        await UserStats.findOneAndUpdate({ userId }, rewardUpdate);

        if (mode === 'free') {
            await UserSpin.findOneAndUpdate(
                { userId },
                { lastSpinAt: new Date(), $inc: { totalSpins: 1 } },
                { upsert: true }
            );
        } else {
            await UserSpin.findOneAndUpdate({ userId }, { $inc: { totalSpins: 1 } }, { upsert: true });
        }

        const nextSpinAt = mode === 'free' ? new Date(Date.now() + msUntilMidnight()) : null;
        res.json({ success: true, prizeIndex, prize, mode, nextSpinAt });
    } catch (err) {
        logger.error('Spin error:', err);
        res.status(500).json({ success: false, message: 'Lỗi quay thưởng' });
    }
});

module.exports = router;
