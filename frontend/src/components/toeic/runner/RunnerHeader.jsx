import Timer from './Timer.jsx';

export default function RunnerHeader({
    testName, currentIndex, totalQuestions,
    timer, isMarked,
    onBack, onToggleNav, onToggleMark, onPause, onSubmit,
}) {
    return (
        <div className="toeic-test-header-bar">
            <button className="toeic-back-btn" title="Quay lại" onClick={onBack}>
                <i className="fas fa-arrow-left"></i>
            </button>

            <div className="toeic-test-info">
                <div className="toeic-test-name">{testName}</div>
                <div className="toeic-progress-info">
                    Câu <span id="current-question-num">{currentIndex + 1}</span>/{totalQuestions}
                </div>
            </div>

            <div className="toeic-timer-group">
                <Timer display={timer.display} warning={timer.warning} isUnlimited={timer.isUnlimited} />
                <button className="toeic-nav-toggle-btn" title="Điều hướng câu hỏi" onClick={onToggleNav}>
                    <i className="fas fa-th"></i>
                    <span>Câu hỏi</span>
                </button>
            </div>

            <div className="toeic-test-actions">
                <button className={`toeic-action-btn${isMarked ? ' active' : ''}`} onClick={onToggleMark}>
                    <i className="fas fa-bookmark"></i> Đánh dấu
                </button>
                <button className="toeic-action-btn" onClick={onPause}>
                    <i className="fas fa-pause"></i> Tạm dừng
                </button>
                <button className="toeic-action-btn primary" onClick={onSubmit}>
                    <i className="fas fa-check"></i> Nộp bài
                </button>
            </div>
        </div>
    );
}
