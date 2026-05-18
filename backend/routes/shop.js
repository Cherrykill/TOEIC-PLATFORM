const express = require('express');
const router = express.Router();
const { getShopItems, purchaseItem } = require('../controllers/userStateController'); // getShopItems cần được tạo
const { protect } = require('../middleware/auth');

// The logic for shop items is now in userStateController.
// This route file now just points to the correct controller functions.

// Get all shop items (Public)
router.get('/items', getShopItems);

// Purchase item (Private)
router.post('/purchase', protect, purchaseItem);

module.exports = router;