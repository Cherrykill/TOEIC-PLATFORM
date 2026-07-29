import EmptyState from './EmptyState.jsx';
import TestCard from './TestCard.jsx';
import { isFullTestType } from '../toeicPartTime.js';

export default function FullTestList({ tests, loading, onStart, search = '' }) {
    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 40 }}>
                <i className="fas fa-spinner fa-spin fa-2x"></i>
            </div>
        );
    }

    const q = search.trim().toLowerCase();
    // isFullTestType: backend đặt cả 'full' lẫn 'full-test', so tay một chuỗi sẽ sót.
    const fullTests = tests.filter(t =>
        isFullTestType(t)
        && (!q || (t.testName || t.title || '').toLowerCase().includes(q))
    );

    if (fullTests.length === 0) {
        // Rỗng vì TÌM KIẾM khác hẳn rỗng vì chưa có đề — nói đúng nguyên nhân
        // thì người dùng biết xoá ô tìm, không tưởng hệ thống chưa có bài.
        return q ? (
            <EmptyState
                title={`Không có Full Test nào khớp "${search.trim()}"`}
                text="Thử từ khoá khác hoặc xoá ô tìm kiếm"
            />
        ) : (
            <EmptyState
                title="Chưa có bài thi Full Test"
                text="Hệ thống đang cập nhật các bài thi mới"
            />
        );
    }

    return (
        <div className="toeic-tests-grid">
            {fullTests.map(test => (
                <TestCard key={test._id} test={test} onStart={onStart} />
            ))}
        </div>
    );
}
