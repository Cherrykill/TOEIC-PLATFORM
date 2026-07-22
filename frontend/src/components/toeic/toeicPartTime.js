// Thời gian mỗi câu (giây) cho bài thi TOEIC, đặt RIÊNG theo từng Part.
// Lưu ở settings.toeicPartTime dạng { [part]: seconds }; bật/tắt bằng
// settings.toeicPerQuestionTimer.
//
// Part nhóm (3/4/6/7) hiển thị CẢ NHÓM trên một màn → thời gian của màn đó
// = số câu trong nhóm × thời gian mỗi câu (xem toeicScreenTime).
import { GameState } from '@game/state.js';

export const TOEIC_PART_TIMES = [
    { id: 1, name: 'Part 1 — Mô tả tranh',        def: 25 },
    { id: 2, name: 'Part 2 — Hỏi & đáp',          def: 20 },
    { id: 3, name: 'Part 3 — Hội thoại',          def: 30 },
    { id: 4, name: 'Part 4 — Bài nói',            def: 30 },
    { id: 5, name: 'Part 5 — Hoàn thành câu',     def: 25 },
    { id: 6, name: 'Part 6 — Hoàn thành đoạn',    def: 30 },
    { id: 7, name: 'Part 7 — Đọc hiểu',           def: 45 },
];

const DEFAULTS = Object.fromEntries(TOEIC_PART_TIMES.map(p => [p.id, p.def]));

/** Đồng hồ từng câu cho TOEIC có đang bật không. */
export function isToeicQuestionTimerOn() {
    return GameState.state?.settings?.toeicPerQuestionTimer === true;
}

export function getToeicPartTimeDefault(part) {
    return DEFAULTS[part] ?? 30;
}

/** Số giây cho MỘT câu của một Part. */
export function getToeicPartTime(part) {
    const v = GameState.state?.settings?.toeicPartTime?.[part];
    return (typeof v === 'number' && v > 0) ? v : getToeicPartTimeDefault(part);
}

/**
 * Số giây cho MỘT MÀN. Part nhóm hiện nhiều câu cùng lúc nên nhân theo số câu.
 * @param {number} part
 * @param {number} questionCount số câu đang hiển thị trên màn (1 với Part đơn)
 */
export function getToeicScreenTime(part, questionCount = 1) {
    return getToeicPartTime(part) * Math.max(1, questionCount);
}
