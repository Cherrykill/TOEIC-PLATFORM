import Timer from './Timer.jsx';

export default function RunnerHeader({
    testName, currentIndex, totalQuestions,
    timer, isMarked,
    onBack, onToggleNav, onToggleMark, onPause, onSubmit,
    onPrev, onNext, canPrev, canNext,
}) {
    return (
        <div className="toeic-test-header-bar">
            {/* Trái: quay lại + tên đề */}
            <div className="toeic-header-left">
                <button className="toeic-back-btn" title="Quay lại" onClick={onBack}>
                    <i className="fas fa-arrow-left"></i>
                </button>
                <div className="toeic-test-name">{testName}</div>
            </div>

            {/* Giữa: điều hướng câu + đồng hồ */}
            <div className="toeic-header-center">
                <div className="toeic-progress-info">
                    <button className="toeic-qnav-arrow" title="Câu trước" disabled={!canPrev} onClick={onPrev}>
                        <i className="fas fa-chevron-left"></i>
                    </button>
                    Câu <span id="current-question-num">{currentIndex + 1}</span>/{totalQuestions}
                    <button className="toeic-qnav-arrow" title="Câu sau" disabled={!canNext} onClick={onNext}>
                        <i className="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>

            {/* Phải: điều hướng câu hỏi + đồng hồ + hành động */}
            <div className="toeic-test-actions">
                {onToggleNav && (
                    <button className="toeic-action-btn" title="Điều hướng câu hỏi" onClick={onToggleNav}>
                        <i className="fas fa-th"></i> Câu hỏi
                    </button>
                )}
                {timer && <Timer display={timer.display} warning={timer.warning} isUnlimited={timer.isUnlimited} />}
                <button className={`toeic-action-btn${isMarked ? ' active' : ''}`} onClick={onToggleMark}>
                    <i className="fas fa-bookmark"></i> Đánh dấu
                </button>
                <button className="toeic-action-btn primary" onClick={onSubmit}>
                    <i className="fas fa-check"></i> Nộp bài
                </button>
            </div>
        </div>
    );
}
