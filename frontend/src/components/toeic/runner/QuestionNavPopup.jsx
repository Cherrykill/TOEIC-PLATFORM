import { useState } from 'react';

export default function QuestionNavPopup({ open, questions, currentIndex, answers, markedQuestions, onSelect, onClose }) {
    const [hover, setHover] = useState(null);
    if (!open) return null;

    // Preview theo câu đang hover; không hover thì lấy câu hiện tại.
    const previewIdx = hover != null ? hover : currentIndex;
    const pq = questions[previewIdx];

    return (
        <div className="toeic-nav-popup" onClick={onClose}>
            <div className="toeic-nav-popup-inner" onClick={(e) => e.stopPropagation()}>
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
                                onMouseEnter={() => setHover(i)}
                                onMouseLeave={() => setHover(null)}
                            >
                                {i + 1}
                            </button>
                        );
                    })}
                </div>

                {/* Preview: câu hỏi + đáp án của câu đang xem */}
                {pq && (
                    <div className="toeic-nav-preview">
                        <div className="toeic-nav-preview-title">Câu {previewIdx + 1}</div>
                        {pq.questionText
                            ? <div className="toeic-nav-preview-q" dangerouslySetInnerHTML={{ __html: pq.questionText }} />
                            : <div className="toeic-nav-preview-q toeic-nav-preview-muted">(Câu nghe — không có đề chữ)</div>}
                        <div className="toeic-nav-preview-opts">
                            {pq.options?.map(o => (
                                <div
                                    key={o.label}
                                    className={`toeic-nav-preview-opt${answers[previewIdx] === o.label ? ' chosen' : ''}`}
                                >
                                    <b>{o.label}.</b> {o.text}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
