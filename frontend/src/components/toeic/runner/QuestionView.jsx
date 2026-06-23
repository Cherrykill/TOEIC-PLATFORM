import Timer from './Timer.jsx';
import ListeningQuestion from './ListeningQuestion.jsx';
import ReadingQuestion from './ReadingQuestion.jsx';
import OptionList from './OptionList.jsx';
import FillBlankOptions from './FillBlankOptions.jsx';

export default function QuestionView({
    question, currentIndex, fillInBlankMode, selectedAnswer,
    audioPlaying, onPlayAudio, onSelectAnswer,
    keywordAnswers, keywordStatus, onKeywordChange, onCheckKeywords,
    timer, onToggleNav,
}) {
    if (!question) return null;

    const isTwoCols = question.part <= 4;
    const hasKeywords = question.questionKeyword || question.answerKeyword || question.audioKeyword;

    // Hàng đầu: badge "Câu X" bên trái; nút "Câu hỏi" + đồng hồ căn phải.
    const qHeader = (
        <div className="toeic-q-row">
            <div className="toeic-question-number">Câu {currentIndex + 1}</div>
            <div className="toeic-q-row-right">
                {onToggleNav && (
                    <button className="toeic-action-btn" title="Điều hướng câu hỏi" onClick={onToggleNav}>
                        <i className="fas fa-th"></i> Câu hỏi
                    </button>
                )}
                {timer && <Timer display={timer.display} warning={timer.warning} isUnlimited={timer.isUnlimited} />}
            </div>
        </div>
    );

    const optionsBlock = fillInBlankMode ? (
        <>
            <FillBlankOptions
                question={question}
                currentIndex={currentIndex}
                keywordAnswers={keywordAnswers}
                keywordStatus={keywordStatus}
                onKeywordChange={onKeywordChange}
                onCheck={onCheckKeywords}
            />
            {hasKeywords && (
                <div className="fill-blank-actions" style={{ marginTop: 15, textAlign: 'center' }}>
                    <button
                        className="toeic-action-btn primary"
                        style={{ padding: '10px 25px' }}
                        onClick={onCheckKeywords}
                    >
                        <i className="fas fa-check"></i> Kiểm tra từ điền
                    </button>
                </div>
            )}
        </>
    ) : (
        <OptionList question={question} selected={selectedAnswer} onSelect={onSelectAnswer} />
    );

    if (isTwoCols) {
        return (
            <div className="toeic-two-col-layout">
                <div className="toeic-left-panel">
                    {qHeader}
                    <ListeningQuestion
                        question={question}
                        currentIndex={currentIndex}
                        fillInBlankMode={fillInBlankMode}
                        audioPlaying={audioPlaying}
                        onPlayAudio={onPlayAudio}
                        keywordAnswers={keywordAnswers}
                        keywordStatus={keywordStatus}
                        onKeywordChange={onKeywordChange}
                        onCheck={onCheckKeywords}
                    />
                </div>
                <div className="toeic-right-panel">
                    <div className="toeic-right-header">Chọn đáp án</div>
                    {optionsBlock}
                </div>
            </div>
        );
    }

    return (
        <>
            {qHeader}
            <ReadingQuestion question={question} />
            {optionsBlock}
        </>
    );
}
