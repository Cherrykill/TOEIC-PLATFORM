// Quy tắc hiển thị danh sách đề, để ở đây (không phải ToeicScreen) vì cả
// MiniTestList lẫn FillBlankList đều cần — nhập ngược từ ToeicScreen sẽ tạo
// vòng import, lúc đó hằng số có thể là undefined ngay khi module vừa nạp.
export const NEW_TESTS_LIMIT = 9;

// Gom đề theo BỘ (ETS 2026, ETS 2025…). Tên đề đặt theo mẫu
// "<bộ> TEST <n>" / "<bộ> FULL TEST <n>" nên cắt phần đuôi là ra tên bộ —
// không cần thêm trường mới trong DB.
const SERIES_RE = /^(.*?)\s*(?:FULL\s+)?TEST\s*\d+\s*$/i;

export function testSeriesName(test) {
    const name = (test?.testName || test?.title || '').trim();
    if (!name) return '';
    return (name.match(SERIES_RE)?.[1] || name).trim();
}

/** Danh sách bộ đề có mặt trong `tests`, mới nhất trước (ETS 2026 → 2022). */
export function listTestSeries(tests = []) {
    const set = new Set(tests.map(testSeriesName).filter(Boolean));
    return [...set].sort((a, b) =>
        b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }),
    );
}
