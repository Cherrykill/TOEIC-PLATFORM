const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema(
    {
        sourceKeys: {
            type: [String],
            required: true,
            validate: {
                validator: (v) => Array.isArray(v) && v.length > 0,
                message: 'Phải có ít nhất một sourceKey',
            },
            index: true,
        },
        displayName: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            default: '',
        },
        icon: {
            type: String,
            default: '📚',
        },
        color: {
            type: String,
            default: '#3b82f6',
        },
        order: {
            type: Number,
            default: 0,
        },
        isPublic: {
            type: Boolean,
            default: true,
        },
        wordCount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
        collection: 'vocabulary_topics',
    }
);

module.exports = mongoose.model('Topic', topicSchema);
