const logger = require('../utils/logger');

/**
 * Quét ảnh BẢNG ĐÁP ÁN đề TOEIC → map { số câu: 'A'|'B'|'C'|'D' }.
 *
 * Tách hàm thuần (parseRange, normalizeAnswers) khỏi phần gọi API để test được
 * mà không tốn tiền token.
 */

/** "1-100" / "1 – 100" / "1,100" → { from: 1, to: 100 }. Sai định dạng → null. */
function parseRange(text) {
    const s = String(text || '').trim();
    if (!s) return null;
    const m = s.match(/^(\d{1,3})\s*[-–—,]\s*(\d{1,3})$/);
    if (!m) {
        // Nhập một số → coi là đúng câu đó.
        const one = s.match(/^(\d{1,3})$/);
        if (!one) return null;
        const n = parseInt(one[1], 10);
        return n >= 1 && n <= 200 ? { from: n, to: n } : null;
    }
    const from = parseInt(m[1], 10);
    const to = parseInt(m[2], 10);
    if (from < 1 || to > 200 || from > to) return null;
    return { from, to };
}

/**
 * Lọc & chuẩn hoá kết quả AI trả về: chỉ giữ câu nằm TRONG dải đã khai báo và
 * đáp án hợp lệ. AI đọc nhầm số câu ngoài dải là chuyện thường — giữ lại thì
 * sẽ ghi đè nhầm sang phần đề khác.
 */
function normalizeAnswers(raw, range) {
    const out = {};
    const skipped = [];
    for (const [k, v] of Object.entries(raw || {})) {
        const num = parseInt(String(k).replace(/\D/g, ''), 10);
        const ans = String(v || '').trim().toUpperCase();
        if (!Number.isFinite(num) || !['A', 'B', 'C', 'D'].includes(ans)) {
            skipped.push({ number: k, answer: v, reason: 'không đọc được' });
            continue;
        }
        if (range && (num < range.from || num > range.to)) {
            skipped.push({ number: num, answer: ans, reason: `ngoài dải ${range.from}-${range.to}` });
            continue;
        }
        out[num] = ans;
    }
    return { answers: out, skipped };
}

const SCAN_PROMPT = `Bạn đang đọc BẢNG ĐÁP ÁN của một đề thi TOEIC.
Nhiệm vụ: đọc TOÀN BỘ cặp "số câu → đáp án" nhìn thấy trong ảnh.

QUY TẮC:
- Trả về DUY NHẤT một object JSON, key là số câu (chuỗi số), value là "A"/"B"/"C"/"D".
- KHÔNG bọc trong markdown, KHÔNG giải thích gì thêm.
- Chỉ đọc thứ NHÌN THẤY RÕ. Ô nào mờ/không chắc thì BỎ QUA, tuyệt đối không đoán.
- Part 2 của TOEIC chỉ có A/B/C — không bịa ra D.

Ví dụ kết quả: {"101":"A","102":"C","103":"B"}`;

/**
 * Gọi model đọc ảnh. `imageBuffer` là Buffer ảnh (jpg/png).
 * @returns {Promise<{answers: object, skipped: array, usage: object}>}
 */
async function scanAnswerKeyImage(imageBuffer, mimeType, range, { userId } = {}) {
    const { OpenAI } = require('openai');
    const { logUsage } = require('./aiUsageLogger');

    if (!process.env.OPENAI_API_KEY) {
        throw new Error('Chưa cấu hình OPENAI_API_KEY — không quét ảnh được');
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const dataUrl = `data:${mimeType || 'image/png'};base64,${imageBuffer.toString('base64')}`;

    const rangeHint = range
        ? `\n\nChỉ lấy các câu trong khoảng ${range.from} đến ${range.to}.`
        : '';

    const res = await openai.chat.completions.create({
        model,
        temperature: 0, // đọc số liệu: cần lặp lại y hệt, không sáng tạo
        max_tokens: 4000,
        response_format: { type: 'json_object' },
        messages: [{
            role: 'user',
            content: [
                { type: 'text', text: SCAN_PROMPT + rangeHint },
                { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
            ],
        }],
    });

    try {
        await logUsage({
            feature: 'toeic-answer-key-scan',
            model,
            usage: res.usage,
            userId,
        });
    } catch (err) {
        logger.warn('Không ghi được log token quét đáp án', { error: err.message });
    }

    let parsed = {};
    try {
        parsed = JSON.parse(res.choices?.[0]?.message?.content || '{}');
    } catch (err) {
        throw new Error('AI trả về dữ liệu không phải JSON hợp lệ');
    }

    // Model đôi khi bọc thêm một lớp {"answers": {...}}.
    if (parsed.answers && typeof parsed.answers === 'object') parsed = parsed.answers;

    const { answers, skipped } = normalizeAnswers(parsed, range);
    return { answers, skipped, usage: res.usage || {} };
}

module.exports = { scanAnswerKeyImage, parseRange, normalizeAnswers, SCAN_PROMPT };
