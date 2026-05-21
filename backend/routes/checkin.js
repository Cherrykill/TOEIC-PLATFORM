const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getCheckin, claim } = require('../controllers/checkinController');

router.get('/', protect, getCheckin);
router.post('/claim', protect, claim);

module.exports = router;
