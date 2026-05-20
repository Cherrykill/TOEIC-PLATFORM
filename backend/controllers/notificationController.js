const Notification = require('../models/Notification');

const TAB_TYPES = {
    system:    ['system', 'reminder'],
    account:   ['achievement', 'quest', 'level_up', 'test_result'],
    violation: ['violation'],
};

// GET /api/notifications?tab=system|account|violation — 30 thông báo mới nhất
exports.list = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const tab    = req.query.tab;
        const filter = { userId };
        if (tab && TAB_TYPES[tab]) filter.type = { $in: TAB_TYPES[tab] };

        const [notifications, tabCounts] = await Promise.all([
            Notification.find(filter).sort({ createdAt: -1 }).limit(30).lean(),
            Notification.aggregate([
                { $match: { userId: require('mongoose').Types.ObjectId.createFromHexString(String(userId)), read: false } },
                { $group: { _id: '$type', count: { $sum: 1 } } },
            ]),
        ]);

        // Map counts per tab
        const countMap = {};
        tabCounts.forEach(({ _id, count }) => { countMap[_id] = count; });
        const counts = {
            all:       Object.values(countMap).reduce((a, b) => a + b, 0),
            system:    (countMap.system || 0) + (countMap.reminder || 0),
            account:   (countMap.achievement || 0) + (countMap.quest || 0) + (countMap.level_up || 0) + (countMap.test_result || 0),
            violation: countMap.violation || 0,
        };

        res.json({ success: true, data: notifications, counts });
    } catch (err) {
        next(err);
    }
};

// GET /api/notifications/unread-count
exports.unreadCount = async (req, res, next) => {
    try {
        const count = await Notification.countDocuments({ userId: req.user.id, read: false });
        res.json({ success: true, data: { count } });
    } catch (err) {
        next(err);
    }
};

// PUT /api/notifications/read-all
exports.readAll = async (req, res, next) => {
    try {
        await Notification.updateMany(
            { userId: req.user.id, read: false },
            { $set: { read: true, readAt: new Date() } }
        );
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

// DELETE /api/notifications — xoá TẤT CẢ thông báo của user hiện tại
exports.deleteAll = async (req, res, next) => {
    try {
        const result = await Notification.deleteMany({ userId: req.user.id });
        res.json({ success: true, deletedCount: result.deletedCount || 0 });
    } catch (err) {
        next(err);
    }
};

// PUT /api/notifications/:id/read
exports.readOne = async (req, res, next) => {
    try {
        await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { $set: { read: true, readAt: new Date() } }
        );
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};
