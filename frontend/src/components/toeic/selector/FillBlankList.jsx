import FillBlankCard from './FillBlankCard.jsx';

const FILL_BLANK_TYPES = ['mini-part1', 'mini-part2', 'mini-part3', 'mini-part4'];

export default function FillBlankList({ tests, loading, onStart, partFilter = 'all', search = '' }) {
    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 40 }}>
                <i className="fas fa-spinner fa-spin fa-2x"></i>
            </div>
        );
    }

    const q = search.trim().toLowerCase();
    const fillBlankTests = tests.filter(t =>
        t.isPublished === true && FILL_BLANK_TYPES.includes(t.testType)
        && (partFilter === 'all' || t.testType === `mini-part${partFilter}`)
        && (!q || (t.testName || t.title || '').toLowerCase().includes(q))
    );

    if (fillBlankTests.length === 0) {
        return (
            <div className="toeic-empty-state">
                <div className="toeic-empty-icon">
                    <i className="fas fa-pen-square"></i>
                </div>
                <h3 className="toeic-empty-title">Chưa có bài thi Đục lỗ</h3>
                <p className="toeic-empty-text">
                    Chế độ này áp dụng cho các Mini Test Part 1-4 (Listening) có định nghĩa keyword.
                </p>
                <p
                    className="toeic-empty-text"
                    style={{ marginTop: 10, fontSize: '0.9rem', color: 'var(--text-tertiary)' }}
                >
                    Admin cần thêm keyword cho các câu hỏi trong Dashboard để sử dụng chế độ này.
                </p>
            </div>
        );
    }

    return (
        <div className="toeic-tests-grid">
            {fillBlankTests.map(test => (
                <FillBlankCard key={test._id} test={test} onStart={onStart} />
            ))}
        </div>
    );
}
