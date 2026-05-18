// routes/userState.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth'); // ← đúng cách

const {
    getState,
    saveState,
    updateResources,
    updateProgress,
    addXp,
    unlockAchievement,
    updateQuests,
    purchaseItem,
} = require('../controllers/userStateController');

router.use(protect); // ← áp dụng cho tất cả route bên dưới

// Heartbeat — cập nhật lastLoginAt để leaderboard biết user đang online
router.post('/heartbeat', async (req, res) => {
    await require('../models/User').findByIdAndUpdate(req.user.id, { lastLoginAt: Date.now() });
    res.json({ success: true });
});

router.get('/state', getState);
router.post('/state', saveState);
router.patch('/resources', updateResources);
router.patch('/progress', updateProgress);
router.patch('/quests', updateQuests);
router.post('/xp', addXp);
router.post('/achievement', unlockAchievement);

module.exports = router;