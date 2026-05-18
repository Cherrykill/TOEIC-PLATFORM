const PART_NAMES = {
    1: 'Part 1: Photographs',
    2: 'Part 2: Question-Response',
    3: 'Part 3: Conversations',
    4: 'Part 4: Talks',
    5: 'Part 5: Incomplete Sentences',
    6: 'Part 6: Text Completion',
    7: 'Part 7: Reading Comprehension',
};

export default function PartTransitionModal({ fromPart, toPart, onContinue, onPauseForBreak }) {
    const isListeningToReading = fromPart === 4 && toPart === 5;
    const title = isListeningToReading
        ? 'Hoàn thành phần Listening!'
        : `Hoàn thành ${PART_NAMES[fromPart]}!`;

    return (
        <div
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
            }}
        >
            <div
                style={{
                    background: 'var(--bg-primary)', borderRadius: 'var(--border-radius-large)',
                    padding: 'var(--spacing-xxl)', maxWidth: 500, textAlign: 'center',
                    boxShadow: 'var(--shadow-xl)',
                }}
            >
                <div
                    style={{
                        width: 80, height: 80, margin: '0 auto var(--spacing-lg)',
                        background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <i className="fas fa-check" style={{ fontSize: 40, color: 'white' }}></i>
                </div>

                <h2 style={{ fontSize: '1.8rem', marginBottom: 'var(--spacing-md)', color: 'var(--text-primary)' }}>
                    {title}
                </h2>

                <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xl)', lineHeight: 1.6 }}>
                    {isListeningToReading ? (
                        <>Chuẩn bị chuyển sang phần <strong style={{ color: 'var(--success-color)' }}>Reading</strong></>
                    ) : (
                        <>Chuyển sang <strong style={{ color: 'var(--primary-color)' }}>{PART_NAMES[toPart]}</strong></>
                    )}
                </p>

                <div
                    style={{
                        padding: 'var(--spacing-lg)', background: 'var(--bg-secondary)',
                        borderRadius: 'var(--border-radius-medium)', marginBottom: 'var(--spacing-xl)',
                    }}
                >
                    <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                        <i className="fas fa-info-circle" style={{ color: 'var(--info-color)' }}></i>{' '}
                        {isListeningToReading
                            ? 'Bạn có thể tạm dừng để nghỉ ngơi hoặc tiếp tục làm bài'
                            : 'Sẵn sàng tiếp tục?'}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'center' }}>
                    {isListeningToReading && (
                        <button
                            className="toeic-action-btn"
                            style={{ padding: 'var(--spacing-md) var(--spacing-xl)', fontSize: '1rem' }}
                            onClick={onPauseForBreak}
                        >
                            <i className="fas fa-pause"></i> Tạm dừng nghỉ
                        </button>
                    )}
                    <button
                        className="toeic-action-btn primary"
                        style={{ padding: 'var(--spacing-md) var(--spacing-xl)', fontSize: '1rem' }}
                        onClick={onContinue}
                    >
                        <i className="fas fa-arrow-right"></i> Tiếp tục
                    </button>
                </div>
            </div>
        </div>
    );
}
