import EmptyState from './EmptyState.jsx';
import TestCard from './TestCard.jsx';

export default function MiniTestList({ tests, loading, onStart, partFilter = 'all', search = '' }) {
    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 40 }}>
                <i className="fas fa-spinner fa-spin fa-2x"></i>
            </div>
        );
    }

    const q = search.trim().toLowerCase();
    const miniTests = tests.filter(t =>
        t.testType?.startsWith('mini-part') && t.isPublished === true
        && (partFilter === 'all' || t.testType === `mini-part${partFilter}`)
        && (!q || (t.testName || t.title || '').toLowerCase().includes(q))
    );

    if (miniTests.length === 0) {
        return (
            <EmptyState
                title="Chưa có Mini Test nào được xuất bản"
                text="Admin cần tạo và xuất bản Mini Test trước"
            />
        );
    }

    return (
        <div className="toeic-tests-grid">
            {miniTests.map(test => (
                <TestCard key={test._id} test={test} onStart={onStart} />
            ))}
        </div>
    );
}
