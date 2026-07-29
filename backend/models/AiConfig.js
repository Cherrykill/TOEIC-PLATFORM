const mongoose = require('mongoose');

/**
 * Cấu hình NHÀ CUNG CẤP AI đang dùng — singleton, admin đổi được trong
 * dashboard mà không phải sửa .env rồi khởi động lại server.
 *
 * API key vẫn nằm trong .env (không bao giờ lưu DB); ở đây chỉ chọn dùng hãng
 * nào + model nào. Đổi hãng là đổi cả giá lẫn chất lượng nên để admin quyết,
 * không hardcode.
 */
const aiConfigSchema = new mongoose.Schema(
    {
        key: { type: String, default: 'default', unique: true },

        // Nhà cung cấp mặc định cho mọi tính năng AI.
        provider: {
            type: String,
            enum: ['openai', 'anthropic', 'deepseek', 'google'],
            default: 'openai',
        },
        model: { type: String, default: '' },   // rỗng = dùng model mặc định của hãng

        // Ghi đè riêng cho từng tính năng, vd:
        //   { 'toeic-answer-key-scan': { provider: 'google', model: 'gemini-2.5-pro' } }
        // Quét ảnh cần model đọc ảnh tốt, trong khi điền từ vựng thì model rẻ là đủ.
        overrides: { type: mongoose.Schema.Types.Mixed, default: {} },

        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true, collection: 'ai_config' },
);

module.exports = mongoose.model('AiConfig', aiConfigSchema);
