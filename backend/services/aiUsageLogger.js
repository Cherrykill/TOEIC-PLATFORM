/**
 * Logger cho mỗi lần gọi OpenAI. Tính cost USD ước lượng theo model.
 * Fail-soft: nếu insert DB lỗi cũng không throw — không được làm vỡ
 * tính năng AI chỉ vì log không ghi được.
 */
const AiUsageLog = require('../models/AiUsageLog');

// USD per 1K tokens — cập nhật theo bảng giá OpenAI 2024-2025.
// {prompt, completion}. Model lạ rơi vào DEFAULT (ước tính an toàn).
const PRICE = {
    'gpt-4':              { p: 0.03,    c: 0.06 },
    'gpt-4-turbo':        { p: 0.01,    c: 0.03 },
    'gpt-4o':             { p: 0.0025,  c: 0.01 },
    'gpt-4o-mini':        { p: 0.00015, c: 0.0006 },
    'gpt-3.5-turbo':      { p: 0.0005,  c: 0.0015 },
};
const DEFAULT_PRICE = { p: 0.002, c: 0.006 };

function priceOf(model) {
    if (!model) return DEFAULT_PRICE;
    // Strip date suffix (vd gpt-4o-mini-2024-07-18 → gpt-4o-mini)
    const key = Object.keys(PRICE).find(k => model.startsWith(k));
    return PRICE[key] || DEFAULT_PRICE;
}

function calcCost(model, prompt, completion) {
    const { p, c } = priceOf(model);
    return ((prompt / 1000) * p) + ((completion / 1000) * c);
}

/**
 * Log 1 lần gọi AI vào DB.
 * @param {object} opts
 * @param {string} [opts.userId]        Có thể null (admin chạy không context user).
 * @param {string} [opts.feature]       Nhãn chức năng (vd 'vocab-ai-fill').
 * @param {string} [opts.model]
 * @param {object} [opts.usage]         { prompt_tokens, completion_tokens, total_tokens }
 * @param {boolean} [opts.success]
 */
async function logUsage(opts = {}) {
    try {
        const usage = opts.usage || {};
        const prompt = usage.prompt_tokens || 0;
        const completion = usage.completion_tokens || 0;
        const total = usage.total_tokens || (prompt + completion);
        await AiUsageLog.create({
            userId: opts.userId || null,
            feature: opts.feature || 'unknown',
            model: opts.model || 'gpt-3.5-turbo',
            promptTokens: prompt,
            completionTokens: completion,
            totalTokens: total,
            costUsd: calcCost(opts.model, prompt, completion),
            success: opts.success !== false,
        });
    } catch (_) { /* fail-soft */ }
}

module.exports = { logUsage, calcCost, priceOf };
