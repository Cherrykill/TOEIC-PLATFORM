const Notification = require('../models/Notification');

const TAB_TYPES = {
    system:    ['system', 'reminder'],
    account:   ['achievement', 'quest', 'level_up', 'test_result'],
    violation: ['violation'],
};

// GET /api/notifications?tab=system|account|violation — 30 thông báo mới nhất.
// Trả CẢ thông báo cá nhân (userId=user) LẪN broadcast global (userId=null).
// Broadcast được gắn isGlobal=true để frontend biết xoá là localStorage-hide
// (không hard-delete server, vì user khác cũng đang dùng doc đó).
exports.list = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const tab    = req.query.tab;
        const filter = {
            $or: [{ userId }, { userId: null }],
        };
        if (tab && TAB_TYPES[tab]) filter.type = { $in: TAB_TYPES[tab] };

        const [raw, tabCounts] = await Promise.all([
            Notification.find(filter).sort({ createdAt: -1 }).limit(60).lean(),
            Notification.aggregate([
                { $match: { userId: require('mongoose').Types.ObjectId.createFromHexString(String(userId)), read: false } },
                { $group: { _id: '$type', count: { $sum: 1 } } },
            ]),
        ]);

        const notifications = raw.map(n => ({ ...n, isGlobal: n.userId == null }));

        // Map counts per tab (chỉ đếm notif cá nhân — broadcast không tính
        // vào unread badge để khỏi kẹt số "1" mãi cho mọi user).
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

// GET /api/notifications/unread-count — CHỈ đếm notif cá nhân
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

// DELETE /api/notifications/:id — xoá 1 notif CÁ NHÂN.
// LƯU Ý: không xoá broadcast (userId=null) qua endpoint này — broadcast
// dùng chung cho mọi user, frontend tự ẩn qua localStorage thay vì DB.
exports.deleteOne = async (req, res, next) => {
    try {
        const result = await Notification.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id, // chỉ match notif cá nhân
        });
        if (!result) return res.status(404).json({ success: false, message: 'Notification not found or is a global broadcast' });
        res.json({ success: true });
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
