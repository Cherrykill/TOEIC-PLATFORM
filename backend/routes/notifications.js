const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/notificationController');

router.get('/',             protect, ctrl.list);
router.get('/unread-count', protect, ctrl.unreadCount);
router.put('/read-all',     protect, ctrl.readAll);
router.delete('/',          protect, ctrl.deleteAll);
router.put('/:id/read',     protect, ctrl.readOne);

module.exports = router;
