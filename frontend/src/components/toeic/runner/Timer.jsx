export default function Timer({ display, warning, isUnlimited }) {
    const className = `toeic-timer${warning ? ' warning' : ''}`;
    const style = isUnlimited ? { color: 'var(--success-color)' } : undefined;

    return (
        <div className={className} id="toeic-timer" style={style}>
            <i className="fas fa-clock"></i>
            <span id="timer-display">{display}</span>
        </div>
    );
}
