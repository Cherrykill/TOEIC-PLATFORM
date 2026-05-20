const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getQuests, syncProgress, claimReward, seedDefaults, resetUserQuests } = require('../controllers/questController');

router.get('/',                protect, getQuests);
router.post('/sync',           protect, syncProgress);
router.post('/claim',          protect, claimReward);
router.post('/seed',           protect, authorize('admin'), seedDefaults);
router.post('/reset-user-quests', protect, authorize('admin'), resetUserQuests);

module.exports = router;
