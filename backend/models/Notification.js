const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        type: {
            type: String,
            enum: ['achievement', 'quest', 'system', 'reminder', 'test_result', 'level_up', 'violation'],
            required: true,
        },
        title: { type: String, required: true },
        body: { type: String, default: '' },
        // Flexible payload, e.g. { achievementId, testId, levelGained }
        data: { type: mongoose.Schema.Types.Mixed, default: {} },

        read: { type: Boolean, default: false },
        readAt: { type: Date, default: null },

        // Auto-delete after this date (TTL)
        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        },
    },
    {
        timestamps: true,
        collection: 'notifications',
        versionKey: false,
    }
);

// Newest-first per user
notificationSchema.index({ userId: 1, createdAt: -1 });
// Fast unread count
notificationSchema.index({ userId: 1, read: 1 });
// TTL auto-delete
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Notification', notificationSchema);
