const Topic = require('../models/Topic');
const Vocabulary = require('../models/Vocabulary');

// Parse sourceKeys từ string hoặc array, lowercase + dedupe
function parseSourceKeys(raw) {
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : String(raw).split(',');
    return [...new Set(arr.map((s) => s.trim().toLowerCase()).filter(Boolean))];
}

// Đếm số từ public match bất kỳ sourceKey nào (loại trừ private uploads)
async function countWords(sourceKeys) {
    return Vocabulary.countDocuments({
        source: { $in: sourceKeys },
        scope: { $ne: 'private' },
    });
}

// GET /api/topics — public, dùng cho frontend chọn đề
exports.getTopics = async (req, res) => {
    try {
        const topics = await Topic.find({ isPublic: true }).sort({ order: 1, displayName: 1 });
        res.json({ success: true, data: topics });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/topics/all — admin, bao gồm cả isPublic: false
exports.getAllTopics = async (req, res) => {
    try {
        const topics = await Topic.find().sort({ order: 1, displayName: 1 });
        res.json({ success: true, data: topics });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/topics — tạo topic mới
exports.createTopic = async (req, res) => {
    try {
        const { sourceKeys: rawKeys, displayName, description, icon, color, order, isPublic } = req.body;

        const sourceKeys = parseSourceKeys(rawKeys);
        if (!sourceKeys.length || !displayName) {
            return res.status(400).json({ success: false, message: 'sourceKeys và displayName là bắt buộc' });
        }

        const wordCount = await countWords(sourceKeys);

        const topic = await Topic.create({
            sourceKeys,
            displayName,
            description: description || '',
            icon: icon || '📚',
            color: color || '#3b82f6',
            order: order ?? 0,
            isPublic: isPublic ?? true,
            wordCount,
        });

        res.status(201).json({ success: true, data: topic });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/topics/:id — cập nhật topic
exports.updateTopic = async (req, res) => {
    try {
        const { sourceKeys: rawKeys, displayName, description, icon, color, order, isPublic } = req.body;

        const update = { displayName, description, icon, color, order, isPublic };
        if (rawKeys !== undefined) {
            const sourceKeys = parseSourceKeys(rawKeys);
            if (!sourceKeys.length) {
                return res.status(400).json({ success: false, message: 'Phải có ít nhất một sourceKey' });
            }
            update.sourceKeys = sourceKeys;
        }

        const topic = await Topic.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });

        if (!topic) return res.status(404).json({ success: false, message: 'Không tìm thấy topic' });

        res.json({ success: true, data: topic });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/topics/:id
exports.deleteTopic = async (req, res) => {
    try {
        const topic = await Topic.findByIdAndDelete(req.params.id);
        if (!topic) return res.status(404).json({ success: false, message: 'Không tìm thấy topic' });
        res.json({ success: true, message: 'Đã xóa topic' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/topics/:id/sync-count
exports.syncWordCount = async (req, res) => {
    try {
        const topic = await Topic.findById(req.params.id);
        if (!topic) return res.status(404).json({ success: false, message: 'Không tìm thấy topic' });

        topic.wordCount = await countWords(topic.sourceKeys);
        await topic.save();

        res.json({ success: true, data: topic });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/topics/sync-all
exports.syncAllWordCounts = async (req, res) => {
    try {
        const topics = await Topic.find();
        const updates = await Promise.all(
            topics.map(async (t) => {
                t.wordCount = await countWords(t.sourceKeys);
                await t.save();
                return { sourceKeys: t.sourceKeys, displayName: t.displayName, wordCount: t.wordCount };
            })
        );
        res.json({ success: true, data: updates });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
