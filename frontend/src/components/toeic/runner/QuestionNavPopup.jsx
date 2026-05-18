export default function QuestionNavPopup({ open, questions, currentIndex, answers, markedQuestions, onSelect, onClose }) {
    if (!open) return null;

    return (
        <div className="toeic-nav-popup" style={{ display: 'flex' }}>
            <div className="toeic-nav-popup-inner">
                <div className="toeic-nav-popup-header">
                    <span className="toeic-nav-title">
                        <i className="fas fa-list"></i> Điều hướng câu hỏi
                    </span>
                    <button className="toeic-nav-popup-close" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="toeic-nav-legend">
                    <span className="toeic-legend-item"><span className="toeic-legend-dot current"></span>Hiện tại</span>
                    <span className="toeic-legend-item"><span className="toeic-legend-dot answered"></span>Đã trả lời</span>
                    <span className="toeic-legend-item"><span className="toeic-legend-dot marked"></span>Đánh dấu</span>
                </div>
                <div className="toeic-nav-grid">
                    {questions.map((q, i) => {
                        const classes = ['toeic-nav-btn'];
                        if (i === currentIndex) classes.push('current');
                        if (answers[i] !== undefined) classes.push('answered');
                        if (markedQuestions.has(i)) classes.push('marked');
                        return (
                            <button
                                key={i}
                                className={classes.join(' ')}
                                onClick={() => { onSelect(i); onClose(); }}
                            >
                                {i + 1}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
