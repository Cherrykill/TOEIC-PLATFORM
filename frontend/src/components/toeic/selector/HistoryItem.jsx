export default function HistoryItem({ attempt, onView }) {
    const date = new Date(attempt.completedAt).toLocaleDateString('vi-VN');
    const score = attempt.totalScore;
    const levelClass = score >= 700 ? 'success' : score >= 400 ? 'warning' : 'error';

    return (
        <div className="toeic-history-item" data-attempt-id={attempt._id}>
            <div className="history-left">
                <h4>{attempt.testName}</h4>
                <p>{date}</p>
            </div>
            <div className="history-right">
                <div className={`history-score ${levelClass}`}>
                    <span className="score-value">{score}</span>
                    <span className="score-label">/ 990</span>
                </div>
                <button
                    className="toeic-action-btn view-result-btn"
                    onClick={() => onView?.(attempt._id)}
                >
                    <i className="fas fa-eye"></i> Xem
                </button>
            </div>
        </div>
    );
}
