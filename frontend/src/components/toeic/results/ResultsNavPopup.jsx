import { useState } from 'react';
import { toeicQuestionNumber } from '../toeicPartTime.js';

// Lưới điều hướng câu cho màn XEM LẠI. Dùng chung bộ class .toeic-nav-* với
// popup lúc làm bài để hai màn nhìn như một; khác ở chỗ tô màu theo ĐÚNG/SAI
// (lúc làm bài là đã trả lời / đánh dấu) vì xem lại thì đáp án đã lộ hết.
const PART_LABEL = {
    1: 'Part 1 · Photographs',
    2: 'Part 2 · Question-Response',
    3: 'Part 3 · Conversations',
    4: 'Part 4 · Talks',
    5: 'Part 5 · Incomplete Sentences',
    6: 'Part 6 · Text Completion',
    7: 'Part 7 · Reading Comprehension',
};

function groupByPart(questions) {
    const groups = [];
    let cur = null;
    questions.forEach((q, i) => {
        const part = q?.part ?? 0;
        if (!cur || cur.part !== part) { cur = { part, items: [] }; groups.push(cur); }
        cur.items.push({ q, i });
    });
    return groups;
}

export default function ResultsNavPopup({ open, questions, onSelect, onClose }) {
    const [filterPart, setFilterPart] = useState(null);
    if (!open) return null;

    const groups = groupByPart(questions);
    const shownGroups = filterPart == null ? groups : groups.filter(g => g.part === filterPart);

    const renderBtn = ({ q, i }) => {
        const answered = !!q.userAnswer;
        const isCorrect = q.userAnswer === q.correctAnswer;
        const classes = ['toeic-nav-btn'];
        // Bỏ qua giữ nguyên nền trắng để phân biệt với câu làm sai.
        if (answered) classes.push(isCorrect ? 'res-correct' : 'res-wrong');
        return (
            <button
                key={i}
                className={classes.join(' ')}
                title={answered ? (isCorrect ? 'Đúng' : `Sai — bạn chọn ${q.userAnswer}`) : 'Bỏ qua'}
                onClick={() => { onSelect(i); onClose(); }}
            >
                {toeicQuestionNumber(q, i)}
            </button>
        );
    };

    return (
        <div className="toeic-nav-popup" onClick={onClose}>
            <div className="toeic-nav-popup-inner" onClick={(e) => e.stopPropagation()}>
                <div className="toeic-nav-popup-header">
                    <span className="toeic-nav-title">
                        <i className="fas fa-list"></i> Danh sách câu hỏi
                    </span>
                    {groups.length > 1 && (
                        <div className="toeic-nav-partfilter">
                            <button
                                className={`toeic-nav-partchip${filterPart == null ? ' active' : ''}`}
                                onClick={() => setFilterPart(null)}
                            >
                                Tất cả
                            </button>
                            {groups.map((g) => (
                                <button
                                    key={g.part}
                                    className={`toeic-nav-partchip${filterPart === g.part ? ' active' : ''}`}
                                    title={PART_LABEL[g.part] || `Part ${g.part}`}
                                    onClick={() => setFilterPart(filterPart === g.part ? null : g.part)}
                                >
                                    P{g.part}
                                </button>
                            ))}
                        </div>
                    )}
                    <button className="toeic-nav-popup-close" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <div className="toeic-nav-body">
                    <div className="toeic-nav-left" style={{ width: '100%' }}>
                        <div className="toeic-nav-legend">
                            <span className="toeic-legend-item"><span className="toeic-legend-dot res-correct"></span>Đúng</span>
                            <span className="toeic-legend-item"><span className="toeic-legend-dot res-wrong"></span>Sai</span>
                            <span className="toeic-legend-item"><span className="toeic-legend-dot"></span>Bỏ qua</span>
                        </div>
                        <div className="toeic-nav-groups">
                            {shownGroups.map((g) => (
                                <div key={`${g.part}-${g.items[0]?.i}`} className="toeic-nav-part-group">
                                    <div className="toeic-nav-part-label">
                                        {PART_LABEL[g.part] || `Part ${g.part}`}
                                        <span className="toeic-nav-part-count">{g.items.length} câu</span>
                                    </div>
                                    <div className="toeic-nav-grid">
                                        {g.items.map(renderBtn)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
