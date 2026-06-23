export default function ReadingQuestion({ question }) {
    return (
        <>
            {question.imageUrls?.length > 0 && question.imageUrls.map((url, i) => (
                <img
                    key={i}
                    src={url}
                    className="toeic-question-image"
                    alt="Question"
                    style={{ maxWidth: '100%', marginBottom: '1rem' }}
                />
            ))}
            {question.passages?.length > 0 && question.passages.map((p, i) => (
                <div
                    key={i}
                    className="toeic-passage"
                    dangerouslySetInnerHTML={{ __html: String(p).replace(/\n/g, '<br>') }}
                />
            ))}
            {question.questionText && (
                <div className="toeic-question-text" dangerouslySetInnerHTML={{ __html: question.questionText }} />
            )}
        </>
    );
}
