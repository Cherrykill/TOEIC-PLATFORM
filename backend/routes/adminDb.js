const express = require('express');
const router  = express.Router();
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');

const admin = [protect, authorize('admin')];

// ── Danh sách collections + doc count ─────────────────────────
router.get('/collections', admin, async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();

        const counts = await Promise.all(
            collections.map(async c => ({
                name: c.name,
                count: await db.collection(c.name).countDocuments(),
            }))
        );

        counts.sort((a, b) => a.name.localeCompare(b.name));
        res.json({ success: true, data: counts });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── Documents trong 1 collection (phân trang + search) ─────────
router.get('/collections/:name', admin, async (req, res) => {
    try {
        const { name } = req.params;
        const page    = Math.max(1, parseInt(req.query.page)  || 1);
        const limit   = Math.min(100, parseInt(req.query.limit) || 20);
        const search  = (req.query.search || '').trim();
        const skip    = (page - 1) * limit;

        const db  = mongoose.connection.db;
        const col = db.collection(name);

        // Text search: thử tìm trong tất cả field kiểu string qua $regex
        let filter = {};
        if (search) {
            // Tìm field string chứa giá trị search (regex case-insensitive)
            // Lấy mẫu 1 doc để biết keys
            const sample = await col.findOne({});
            if (sample) {
                const stringFields = Object.entries(sample)
                    .filter(([, v]) => typeof v === 'string')
                    .map(([k]) => k);
                if (stringFields.length) {
                    filter = {
                        $or: stringFields.map(f => ({
                            [f]: { $regex: search, $options: 'i' }
                        }))
                    };
                }
            }
        }

        const [docs, total] = await Promise.all([
            col.find(filter).skip(skip).limit(limit).toArray(),
            col.countDocuments(filter),
        ]);

        res.json({
            success: true,
            data: docs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── Insert document vào collection ─────────────────────────────
router.post('/collections/:name', admin, async (req, res) => {
    try {
        const col = mongoose.connection.db.collection(req.params.name);
        const doc = req.body;
        delete doc._id; // không cho client chỉ định _id
        const result = await col.insertOne(doc);
        res.status(201).json({ success: true, data: { _id: result.insertedId } });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// ── Update document ─────────────────────────────────────────────
router.put('/collections/:name/:id', admin, async (req, res) => {
    try {
        const { name, id } = req.params;
        const col = mongoose.connection.db.collection(name);
        const update = { ...req.body };
        delete update._id;

        const { ObjectId } = require('mongodb');
        const _id = ObjectId.isValid(id) ? new ObjectId(id) : id;

        const result = await col.updateOne({ _id }, { $set: update });
        if (result.matchedCount === 0)
            return res.status(404).json({ success: false, message: 'Document không tồn tại' });

        res.json({ success: true, message: 'Đã cập nhật' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// ── Xóa 1 document ─────────────────────────────────────────────
router.delete('/collections/:name/:id', admin, async (req, res) => {
    try {
        const { name, id } = req.params;
        const col = mongoose.connection.db.collection(name);

        const { ObjectId } = require('mongodb');
        const _id = ObjectId.isValid(id) ? new ObjectId(id) : id;

        const result = await col.deleteOne({ _id });
        if (result.deletedCount === 0)
            return res.status(404).json({ success: false, message: 'Document không tồn tại' });

        res.json({ success: true, message: 'Đã xóa document' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── Drop cả collection ──────────────────────────────────────────
router.delete('/collections/:name', admin, async (req, res) => {
    try {
        const { name } = req.params;
        const PROTECTED = ['users']; // collection không được drop
        if (PROTECTED.includes(name))
            return res.status(403).json({ success: false, message: `Collection "${name}" được bảo vệ, không thể xóa` });

        await mongoose.connection.db.collection(name).drop();
        res.json({ success: true, message: `Đã drop collection "${name}"` });
    } catch (err) {
        // MongoDB trả lỗi ns not found nếu collection rỗng/không tồn tại
        if (err.message?.includes('ns not found'))
            return res.json({ success: true, message: 'Collection đã trống hoặc không tồn tại' });
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
