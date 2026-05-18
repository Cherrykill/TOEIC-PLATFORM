export default function TestCard({ test, onStart }) {
    const isFullTest = test.testType === 'full-test';
    const badge = isFullTest ? 'full' : 'mini';
    const difficulty = test.difficulty || 'medium';

    return (
        <div className="toeic-test-card" data-test-id={test._id}>
            <div className="toeic-test-header">
                <div className="toeic-test-icon">
                    <i className="fas fa-file-alt"></i>
                </div>
                <div>
                    <span className={`toeic-test-badge ${badge}`}>
                        {isFullTest ? 'Full Test' : 'Mini Test'}
                    </span>
                    <span className={`toeic-test-badge ${difficulty}`}>{difficulty}</span>
                </div>
            </div>

            <h3 className="toeic-test-title">{test.testName}</h3>
            <p className="toeic-test-description">
                {test.description || 'Bài thi TOEIC chuẩn quốc tế'}
            </p>

            <div className="toeic-test-stats">
                <div className="toeic-stat">
                    <span className="toeic-stat-value">{test.totalQuestions}</span>
                    <span className="toeic-stat-label">Câu hỏi</span>
                </div>
                <div className="toeic-stat">
                    <span className="toeic-stat-value">{Math.floor((test.totalTime || 0) / 60)}</span>
                    <span className="toeic-stat-label">Phút</span>
                </div>
                <div className="toeic-stat">
                    <span className="toeic-stat-value">{test.averageScore || '-'}</span>
                    <span className="toeic-stat-label">Trung bình</span>
                </div>
            </div>

            <div className="toeic-test-footer">
                <span className="toeic-test-attempts">
                    <i className="fas fa-users"></i> {test.timesAttempted || 0} lượt thi
                </span>
                <button
                    className="toeic-start-btn"
                    disabled={!test.canAccess}
                    onClick={(e) => { e.stopPropagation(); onStart?.(test._id); }}
                >
                    {test.canAccess ? 'Bắt đầu' : 'Locked'}
                </button>
            </div>
        </div>
    );
}
