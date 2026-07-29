import { describe, test, expect } from 'vitest';
import { testSeriesName, listTestSeries } from './testSeries.js';

const t = (testName) => ({ testName });

describe('testSeriesName', () => {
    test('cắt đuôi "TEST <n>" để lấy tên bộ đề', () => {
        expect(testSeriesName(t('ETS 2026 TEST 10'))).toBe('ETS 2026');
        expect(testSeriesName(t('ETS 2025 TEST 3'))).toBe('ETS 2025');
    });

    test('cắt được cả dạng "FULL TEST <n>"', () => {
        expect(testSeriesName(t('ETS 2024 FULL TEST 1'))).toBe('ETS 2024');
    });

    test('tên không theo mẫu thì giữ nguyên', () => {
        expect(testSeriesName(t('Đề luyện nghe cấp tốc'))).toBe('Đề luyện nghe cấp tốc');
    });

    test('thiếu tên → chuỗi rỗng', () => {
        expect(testSeriesName(t(''))).toBe('');
        expect(testSeriesName(null)).toBe('');
    });
});

describe('listTestSeries', () => {
    test('bỏ trùng và xếp bộ mới nhất lên đầu', () => {
        const tests = [
            t('ETS 2024 TEST 1'), t('ETS 2026 TEST 9'), t('ETS 2025 TEST 2'),
            t('ETS 2026 TEST 10'), t('ETS 2024 FULL TEST 3'),
        ];
        expect(listTestSeries(tests)).toEqual(['ETS 2026', 'ETS 2025', 'ETS 2024']);
    });

    test('danh sách rỗng → mảng rỗng", không phải lỗi', () => {
        expect(listTestSeries([])).toEqual([]);
        expect(listTestSeries()).toEqual([]);
    });
});
