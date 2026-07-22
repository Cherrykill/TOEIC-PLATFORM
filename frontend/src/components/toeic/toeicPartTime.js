// Thời gian mỗi câu (giây) cho bài thi TOEIC.
//
// Part 1-4 (Nghe): đặt TAY theo từng Part — nhịp do audio quyết định, chia đều
//   thời gian đề ra không có ý nghĩa gì.
// Part 5-7 (Đọc): TỰ TÍNH theo từng đề — lấy thời gian của chính đề đó chia đều
//   cho số câu, rồi TRỪ thời gian chuyển câu (khoảng chết giữa hai câu) để tổng
//   thời gian thực tế không vượt quá thời gian đề cho.
//
// Part nhóm (3/4/6/7) hiển thị CẢ NHÓM trên một màn → thời gian màn đó
// = số câu trong nhóm × thời gian mỗi câu (xem getToeicScreenTime).
import { GameState } from '@game/state.js';

// Part Đọc: thời gian mỗi câu suy ra từ đề, không cho đặt tay.
export const AUTO_TIME_PARTS = [5, 6, 7];

export const TOEIC_PART_TIMES = [
    { id: 1, name: 'Part 1 — Mô tả tranh',     def: 25 },
    { id: 2, name: 'Part 2 — Hỏi & đáp',       def: 20 },
    { id: 3, name: 'Part 3 — Hội thoại',       def: 30 },
    { id: 4, name: 'Part 4 — Bài nói',         def: 30 },
    { id: 5, name: 'Part 5 — Hoàn thành câu',  def: 25, auto: true },
    { id: 6, name: 'Part 6 — Hoàn thành đoạn', def: 30, auto: true },
    { id: 7, name: 'Part 7 — Đọc hiểu',        def: 45, auto: true },
];

const DEFAULTS = Object.fromEntries(TOEIC_PART_TIMES.map(p => [p.id, p.def]));

// Chặn dưới: dù đề có eo hẹp đến đâu cũng phải kịp đọc xong câu hỏi.
const MIN_AUTO_SECONDS = 5;
const DEFAULT_TRANSITION = 1; // giây

/** Đồng hồ từng câu cho TOEIC có đang bật không. */
export function isToeicQuestionTimerOn() {
    return GameState.state?.settings?.toeicPerQuestionTimer === true;
}

/** Hết giờ một câu thì có tự nhảy sang câu kế không (mặc định CÓ). */
export function isToeicAutoAdvanceOn() {
    return GameState.state?.settings?.toeicAutoAdvance !== false;
}

/** Khoảng chết giữa hai câu, tính bằng giây. */
export function getToeicTransition() {
    const v = GameState.state?.settings?.toeicTransition;
    return (typeof v === 'number' && v >= 0) ? v : DEFAULT_TRANSITION;
}

export function isAutoTimePart(part) {
    return AUTO_TIME_PARTS.includes(Number(part));
}

export function getToeicPartTimeDefault(part) {
    return DEFAULTS[part] ?? 30;
}

/**
 * Thời gian mỗi câu TỰ TÍNH từ một đề: chia đều thời gian đề cho số câu rồi
 * trừ khoảng chuyển câu. Trả về null nếu đề thiếu dữ liệu để tính.
 *
 * Vì sao trừ: mỗi câu thực tế ngốn (thời gian làm + thời gian chuyển), nên
 *   soCau × (moiCau + chuyen) ≤ tongThoiGian  →  moiCau ≤ tong/soCau − chuyen
 * Không trừ thì làm hết bài sẽ lố giờ đúng bằng tổng thời gian chuyển câu.
 */
export function getToeicAutoPerQuestion(test) {
    const total = Number(test?.totalTime);
    const count = Number(test?.totalQuestions);
    if (!Number.isFinite(total) || !Number.isFinite(count) || count <= 0 || total <= 0) return null;
    const per = Math.floor(total / count) - getToeicTransition();
    return Math.max(MIN_AUTO_SECONDS, per);
}

/**
 * Số giây cho MỘT câu của một Part.
 * @param {number} part
 * @param {object} [test] đề đang làm — bắt buộc để tính được Part 5/6/7
 */
export function getToeicPartTime(part, test) {
    if (isAutoTimePart(part)) {
        const auto = getToeicAutoPerQuestion(test);
        if (auto !== null) return auto;
        // Không có dữ liệu đề (vd xem trước trong Cài đặt) → rơi về mặc định.
        return getToeicPartTimeDefault(part);
    }
    const v = GameState.state?.settings?.toeicPartTime?.[part];
    return (typeof v === 'number' && v > 0) ? v : getToeicPartTimeDefault(part);
}

/**
 * Số giây cho MỘT MÀN. Part nhóm hiện nhiều câu cùng lúc nên nhân theo số câu.
 * @param {number} part
 * @param {number} questionCount số câu đang hiển thị trên màn (1 với Part đơn)
 * @param {object} [test] đề đang làm
 */
export function getToeicScreenTime(part, questionCount = 1, test) {
    return getToeicPartTime(part, test) * Math.max(1, questionCount);
}
