const mongoose = require('mongoose');

// Danh mục dùng chung, tách theo domain (shop / achievement / quest). Admin tự
// quản (thêm/sửa/xoá) → không phải sửa enum trong code. Shop/Quest/Achievement
// tham chiếu bằng `key`; frontend dựng tab từ danh sách này.
const categorySchema = new mongoose.Schema(
    {
        domain: { type: String, enum: ['shop', 'quest', 'achievement'], required: true },
        key: { type: String, required: true, trim: true }, // slug, duy nhất trong domain
        label: { type: String, required: true, trim: true },
        icon: { type: String, default: '' }, // FA class ('fa-store') hoặc emoji
        order: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true, collection: 'categories' }
);

categorySchema.index({ domain: 1, key: 1 }, { unique: true });
categorySchema.index({ domain: 1, order: 1 });

module.exports = mongoose.model('Category', categorySchema);
