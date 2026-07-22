export default function ReadingQuestion({ question, hideQuestionText = false }) {
    return (
        <>
            {/* Ảnh đề Part 6/7 CHÍNH LÀ nội dung đọc → cho tràn hết bề ngang khung,
                bấm vào mở cỡ thật ở tab mới để soi chữ nhỏ. */}
            {question.imageUrls?.length > 0 && question.imageUrls.map((url, i) => (
                <img
                    key={i}
                    src={url}
                    className="toeic-passage-image"
                    alt={`Đoạn đọc ${i + 1}`}
                    title="Bấm để xem ảnh cỡ thật"
                    onClick={() => window.open(url, '_blank', 'noopener')}
                />
            ))}
            {question.passages?.length > 0 && question.passages.map((p, i) => (
                <div
                    key={i}
                    className="toeic-passage"
                    dangerouslySetInnerHTML={{ __html: String(p).replace(/\n/g, '<br>') }}
                />
            ))}
            {!hideQuestionText && question.questionText && (
                <div className="toeic-question-text" dangerouslySetInnerHTML={{ __html: question.questionText }} />
            )}
        </>
    );
}
