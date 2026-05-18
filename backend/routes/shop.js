const express = require('express');
const router = express.Router();
const { getShopItems, purchaseItem } = require('../controllers/userStateController'); // getShopItems cần được tạo
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { shopPurchase } = require('../validators/schemas');

// The logic for shop items is now in userStateController.
// This route file now just points to the correct controller functions.

// Get all shop items (Public)
router.get('/items', getShopItems);

// Purchase item (Private)
router.post('/purchase', protect, validate(shopPurchase), purchaseItem);

module.exports = router;