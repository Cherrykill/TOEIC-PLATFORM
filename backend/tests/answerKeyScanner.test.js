/**
 * Unit test cho phần THUẦN của tính năng quét bảng đáp án (không gọi API,
 * không chạm DB): đọc dải câu, lọc kết quả AI, và đối chiếu với đề.
 *
 * Chốt lại điểm dễ hỏng nhất: AI đọc lẫn số câu ngoài dải. Giữ lại những số đó
 * là ghi đè nhầm sang phần đề khác — hỏng dữ liệu mà không ai biết.
 */
const sharp = require('sharp');
const { parseRange, normalizeAnswers, toSupportedPng } = require('../services/answerKeyScanner');
const { compareAnswers } = require('../controllers/answerKeyController');

// Ảnh đặc, kích thước tuỳ ý — đủ để kiểm tra khâu nắn định dạng.
const makeImage = (fmt, w = 300, h = 200) =>
    sharp({ create: { width: w, height: h, channels: 3, background: { r: 255, g: 255, b: 255 } } })[fmt]().toBuffer();

describe('toSupportedPng', () => {
    test('TIFF (đặt tên .png) được nắn về PNG — OpenAI đọc header nên không nhận TIFF', async () => {
        const tiff = await makeImage('tiff');
        const { buffer, sourceFormat } = await toSupportedPng(tiff);
        expect(sourceFormat).toBe('tiff');
        expect((await sharp(buffer).metadata()).format).toBe('png');
    });

    test('WebP cũng nắn về PNG', async () => {
        const { buffer } = await toSupportedPng(await makeImage('webp'));
        expect((await sharp(buffer).metadata()).format).toBe('png');
    });

    test('ảnh quá to bị thu nhỏ để khỏi phình token', async () => {
        const { buffer } = await toSupportedPng(await makeImage('png', 5000, 3000));
        const m = await sharp(buffer).metadata();
        expect(Math.max(m.width, m.height)).toBeLessThanOrEqual(2200);
        expect(m.width / m.height).toBeCloseTo(5000 / 3000, 1); // giữ tỉ lệ
    });

    test('ảnh nhỏ không bị phóng to', async () => {
        const { buffer } = await toSupportedPng(await makeImage('png', 400, 300));
        const m = await sharp(buffer).metadata();
        expect(m.width).toBe(400);
    });

    test('file không phải ảnh → báo lỗi dễ hiểu, không ném lỗi thư viện', async () => {
        await expect(toSupportedPng(Buffer.from('day khong phai anh')))
            .rejects.toThrow(/không phải ảnh đọc được/);
    });
});

describe('parseRange', () => {
    test('đọc được các kiểu gạch nối thường gặp', () => {
        expect(parseRange('1-100')).toEqual({ from: 1, to: 100 });
        expect(parseRange('101 – 200')).toEqual({ from: 101, to: 200 });
        expect(parseRange('1,50')).toEqual({ from: 1, to: 50 });
    });

    test('nhập một số = đúng câu đó', () => {
        expect(parseRange('7')).toEqual({ from: 7, to: 7 });
    });

    test('từ chối dải vô lý', () => {
        expect(parseRange('100-1')).toBeNull();   // ngược
        expect(parseRange('0-50')).toBeNull();    // câu 0
        expect(parseRange('1-500')).toBeNull();   // quá 200
        expect(parseRange('abc')).toBeNull();
        expect(parseRange('')).toBeNull();
    });
});

describe('normalizeAnswers', () => {
    const range = { from: 101, to: 103 };

    test('giữ đáp án hợp lệ trong dải, chữ thường cũng nhận', () => {
        const { answers } = normalizeAnswers({ 101: 'A', 102: 'b', 103: 'C' }, range);
        expect(answers).toEqual({ 101: 'A', 102: 'B', 103: 'C' });
    });

    test('LOẠI câu ngoài dải — tránh ghi đè nhầm phần đề khác', () => {
        const { answers, skipped } = normalizeAnswers({ 101: 'A', 55: 'B', 199: 'C' }, range);
        expect(answers).toEqual({ 101: 'A' });
        expect(skipped.map(s => s.number)).toEqual([55, 199]);
        expect(skipped[0].reason).toMatch(/ngoài dải/);
    });

    test('loại giá trị không phải A-D (AI đọc mờ)', () => {
        const { answers, skipped } = normalizeAnswers({ 101: 'E', 102: '', 103: 'D' }, range);
        expect(answers).toEqual({ 103: 'D' });
        expect(skipped).toHaveLength(2);
    });

    test('không có dải thì không lọc theo dải', () => {
        const { answers } = normalizeAnswers({ 1: 'A', 200: 'D' }, null);
        expect(answers).toEqual({ 1: 'A', 200: 'D' });
    });
});

describe('compareAnswers', () => {
    const questions = [
        { setId: 's1', index: 0, part: 5, number: 101, correctAnswer: 'A' },
        { setId: 's1', index: 1, part: 5, number: 102, correctAnswer: 'B' },
        { setId: 's2', index: 0, part: 5, number: 103, correctAnswer: 'C' },
    ];

    test('tách đúng 4 nhóm: khớp / lệch / đề chưa có / chưa quét', () => {
        const key = { 101: 'A', 102: 'D', 999: 'B' }; // 103 chưa quét
        const r = compareAnswers(key, questions);

        expect(r.matched.map(x => x.number)).toEqual([101]);
        expect(r.mismatched).toHaveLength(1);
        expect(r.mismatched[0]).toMatchObject({ number: 102, current: 'B', expected: 'D' });
        expect(r.notInTest.map(x => x.number)).toEqual([999]);
        expect(r.notInKey.map(x => x.number)).toEqual([103]);
    });

    test('câu lệch mang theo setId + index để ghi ngược đúng chỗ', () => {
        const r = compareAnswers({ 103: 'A' }, questions);
        expect(r.mismatched[0]).toMatchObject({ setId: 's2', index: 0 });
    });

    test('bộ đáp án rỗng → không có gì lệch, mọi câu là chưa quét', () => {
        const r = compareAnswers({}, questions);
        expect(r.mismatched).toHaveLength(0);
        expect(r.notInKey).toHaveLength(3);
    });
});
