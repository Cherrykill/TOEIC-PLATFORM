const mongoose = require('mongoose');

/**
 * Transaction — lịch sử chi tiêu (mua shop / đổi gems / VIP…). Collection riêng,
 * không giới hạn (thay cho mảng cap-50 trong UserStats). Server-authoritative.
 */
const transactionSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        type: { type: String, enum: ['purchase', 'exchange', 'spin', 'other'], default: 'purchase' },
        name: { type: String, required: true },       // vd "Mua Gói Gợi Ý ×3"
        itemId: { type: String, default: '' },
        amount: { type: Number, default: 0 },          // số tiền chi (dương)
        currency: { type: String, enum: ['coins', 'gems'], default: 'coins' },
        balanceAfter: { type: Number, default: 0 },    // số dư sau giao dịch (cùng loại currency)
        at: { type: Date, default: Date.now },
    },
    { collection: 'transactions', versionKey: false }
);

transactionSchema.index({ userId: 1, at: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
