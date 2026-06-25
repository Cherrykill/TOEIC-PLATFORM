import EmptyState from './EmptyState.jsx';
import TestCard from './TestCard.jsx';

export default function FullTestList({ tests, loading, onStart, search = '' }) {
    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 40 }}>
                <i className="fas fa-spinner fa-spin fa-2x"></i>
            </div>
        );
    }

    const q = search.trim().toLowerCase();
    const fullTests = tests.filter(t =>
        t.testType === 'full-test'
        && (!q || (t.testName || t.title || '').toLowerCase().includes(q))
    );

    if (fullTests.length === 0) {
        return (
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
