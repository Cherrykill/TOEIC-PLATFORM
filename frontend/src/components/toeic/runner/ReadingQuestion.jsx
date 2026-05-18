export default function ReadingQuestion({ question }) {
    const showImage = (question.part === 6 || question.part === 7) && question.imageUrl;

    return (
        <>
            {showImage && (
                <img
                    src={question.imageUrl}
                    className="toeic-question-image"
                    alt="Question"
                    style={{ maxWidth: '100%', marginBottom: '1rem' }}
                />
            )}
            {question.passage && (
                <div className="toeic-passage" dangerouslySetInnerHTML={{ __html: question.passage }} />
            )}
            {question.questionText && (
                <div className="toeic-question-text" dangerouslySetInnerHTML={{ __html: question.questionText }} />
            )}
        </>
    );
}
