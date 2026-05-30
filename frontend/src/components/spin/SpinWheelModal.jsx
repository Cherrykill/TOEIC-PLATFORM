import { useState, useEffect, useRef, useCallback } from 'react';
import { useGame } from '@game/GameContext.jsx';
import { GameState } from '@game/state.js';
import { Notification } from '@ui/Toaster.jsx';
import { getToken } from '@/auth/token.js';

function playSound(file, { loop = false, volume = 0.6 } = {}) {
    if (GameState.state?.settings?.soundEnabled === false) return null;
    const audio = new Audio(`/assets/sounds/${file}`);
    audio.volume = volume;
    audio.loop = loop;
    audio.play().catch(() => {});
    return audio;
}

// Phải khớp thứ tự với PRIZES trong backend/routes/spin.js
const PRIZES = [
    { label: '50 Xu',   icon: '🪙', type: 'coins',  amount: 50,  color: '#f59e0b' },
    { label: '5 Đá',    icon: '💎', type: 'gems',   amount: 5,   color: '#8b5cf6' },
    { label: '100 XP',  icon: '⭐', type: 'xp',     amount: 100, color: '#06b6d4' },
    { label: '100 Xu',  icon: '🪙', type: 'coins',  amount: 100, color: '#f97316' },
    { label: '200 Xu',  icon: '🪙', type: 'coins',  amount: 200, color: '#ef4444' },
    { label: '10 Đá',   icon: '💎', type: 'gems',   amount: 10,  color: '#ec4899' },
    { label: 'Nạp NL',  icon: '⚡', type: 'energy', amount: 100, color: '#10b981' },
    { label: '2 Gợi ý', icon: '💡', type: 'hints',  amount: 2,   color: '#3b82f6' },
];

const SEG = 360 / PRIZES.length;

function drawWheel(canvas, rotationDeg) {
    const ctx = canvas.getContext('2d');
    const S = canvas.width;
    const cx = S / 2, cy = S / 2;
    const R = cx - 4;
    const rot = (rotationDeg * Math.PI) / 180;

    ctx.clearRect(0, 0, S, S);

    PRIZES.forEach((prize, i) => {
        const start = rot + (i * 2 * Math.PI) / PRIZES.length - Math.PI / 2;
        const end = start + (2 * Math.PI) / PRIZES.length;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, start, end);
        ctx.closePath();
        ctx.fillStyle = prize.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(start + Math.PI / PRIZES.length);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 3;
        ctx.fillText(prize.icon + ' ' + prize.label, R - 10, 5);
        ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 2 * Math.PI);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0;
    ctx.fillText('🌟', cx, cy);
}

export default function SpinWheelModal({ open, onClose }) {
    const { syncFromState } = useGame();
    const canvasRef = useRef(null);
    const rotRef = useRef(0);
    const animRef = useRef(null);
    const spinSoundRef = useRef(null);
    const [spinning, setSpinning] = useState(false);
    const [result, setResult] = useState(null);
    const [spinSummary, setSpinSummary] = useState(null);
    const [canFreeSpin, setCanFreeSpin] = useState(true);
    const [nextSpinAt, setNextSpinAt] = useState(null);
    const [countdown, setCountdown] = useState('');
    const [coins, setCoins] = useState(0);
    const [gems, setGems] = useState(0);
    const [costs, setCosts] = useState({ coin: 100, gem: 5 });
    const [qty, setQty] = useState(1);

    useEffect(() => {
        if (!open || !canvasRef.current) return;
        drawWheel(canvasRef.current, rotRef.current);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const token = getToken();
        if (!token) return;
        fetch('/api/spin/status', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    setCanFreeSpin(data.canFreeSpin ?? data.canSpin);
                    setNextSpinAt(data.nextSpinAt ? new Date(data.nextSpinAt) : null);
                    setCoins(data.coins || 0);
                    setGems(data.gems || 0);
                    if (data.costs) setCosts(data.costs);
                }
            })
            .catch(() => {});
    }, [open]);

    useEffect(() => {
        if (!nextSpinAt) return;
        const tick = () => {
            const diff = nextSpinAt - Date.now();
            if (diff <= 0) { setCanFreeSpin(true); setNextSpinAt(null); setCountdown(''); return; }
            const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
            const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
            const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
            setCountdown(`${h}:${m}:${s}`);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [nextSpinAt]);

    const doSpin = useCallback(async (mode) => {
        if (spinning) return;
        setSpinning(true);
        setResult(null);
        setSpinSummary(null);

        const token = getToken();
        // Free spin is always qty=1
        const spins = mode === 'free' ? 1 : Math.max(1, qty);
        const results = [];

        for (let i = 0; i < spins; i++) {
            try {
                const res = await fetch('/api/spin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ mode }),
                }).then(r => r.json());

                if (!res.success) {
                    if (i === 0) {
                        Notification.error(res.message || 'Không thể quay');
                        setSpinning(false);
                        return;
                    }
                    break; // hết tiền/đá ở lượt sau → dừng
                }
                results.push(res);
            } catch {
                if (i === 0) { Notification.error('Lỗi kết nối'); setSpinning(false); return; }
                break;
            }
        }

        if (results.length === 0) { setSpinning(false); return; }

        const lastResult = results[results.length - 1];
        const prizeIndex = lastResult.prizeIndex;
        const nextAt = lastResult.nextSpinAt ? new Date(lastResult.nextSpinAt) : null;

        spinSoundRef.current = playSound('spin.mp3', { loop: true, volume: 0.7 });

        const segCenter = prizeIndex * SEG + SEG / 2;
        const jitter = (Math.random() - 0.5) * 20;
        const targetRot = rotRef.current + 5 * 360 + (360 - segCenter) + jitter;
        const startRot = rotRef.current;
        const delta = targetRot - startRot;
        const duration = 4000;
        const startTime = performance.now();
        const easeOut = t => 1 - Math.pow(1 - t, 3);

        const animate = (now) => {
            const elapsed = now - startTime;
            const t = Math.min(elapsed / duration, 1);
            rotRef.current = startRot + delta * easeOut(t);
            if (canvasRef.current) drawWheel(canvasRef.current, rotRef.current);
            if (t < 1) {
                animRef.current = requestAnimationFrame(animate);
            } else {
                if (spinSoundRef.current) { spinSoundRef.current.pause(); spinSoundRef.current = null; }
                playSound('achieve.mp3', { volume: 0.7 });
                rotRef.current = targetRot;
                setSpinning(false);
                setResult(lastResult.prize);

                // Tổng hợp phần thưởng
                let totalCoinsWon = 0, totalGemsWon = 0, totalXpWon = 0, totalHints = 0;
                let totalCoinCost = 0, totalGemCost = 0;
                for (const r of results) {
                    if (mode === 'coin') totalCoinCost += costs.coin;
                    if (mode === 'gem')  totalGemCost  += costs.gem;
                    if (r.prize.type === 'coins')  totalCoinsWon += r.prize.amount;
                    if (r.prize.type === 'gems')   totalGemsWon  += r.prize.amount;
                    if (r.prize.type === 'xp')     totalXpWon    += r.prize.amount;
                    if (r.prize.type === 'hints')  totalHints    += r.prize.amount;
                }

                if (results.length > 1) {
                    setSpinSummary({ spins: results.length, coins: totalCoinsWon, gems: totalGemsWon, xp: totalXpWon, hints: totalHints });
                }

                if (mode === 'free') { setCanFreeSpin(false); setNextSpinAt(nextAt); }
                setCoins(c => c - totalCoinCost + totalCoinsWon);
                setGems(g  => g - totalGemCost  + totalGemsWon);

                const rs = GameState.state?.resources;
                if (rs) {
                    if (mode === 'coin') rs.coins  = (rs.coins  || 0) - totalCoinCost;
                    if (mode === 'gem')  rs.gems   = (rs.gems   || 0) - totalGemCost;
                    for (const r of results) {
                        if (r.prize.type === 'coins')  rs.coins  = (rs.coins  || 0) + r.prize.amount;
                        if (r.prize.type === 'gems')   rs.gems   = (rs.gems   || 0) + r.prize.amount;
                        if (r.prize.type === 'hints')  rs.hints  = (rs.hints  || 0) + r.prize.amount;
                        if (r.prize.type === 'energy') rs.energy = 100;
                        if (r.prize.type === 'xp' && GameState.state?.user)
                            GameState.state.user.xp = (GameState.state.user.xp || 0) + r.prize.amount;
                    }
                }
                syncFromState();
            }
        };
        animRef.current = requestAnimationFrame(animate);
    }, [spinning, qty, costs, syncFromState]);

    useEffect(() => () => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
        if (spinSoundRef.current) { spinSoundRef.current.pause(); spinSoundRef.current = null; }
    }, []);

    if (!open) return null;

    const resultPrize = result ? PRIZES.find(p => p.type === result.type && p.amount === result.amount) : null;
    const totalCoinCost = costs.coin * qty;
    const totalGemCost  = costs.gem  * qty;

    return (
        <div className="spin-overlay" onClick={(e) => { if (e.target === e.currentTarget && !spinning) onClose(); }}>
            <div className="spin-modal spin-modal-wide">
                <button className="spin-close-btn" onClick={onClose} disabled={spinning}>
                    <i className="fas fa-times"></i>
                </button>

                {/* ── 2-column layout ── */}
                <div className="spin-layout">

                    {/* COL 1: wheel + qty input */}
                    <div className="spin-col-left">
                        <h2 className="spin-title">🎰 Vòng Quay</h2>
                        <div className="spin-wheel-container">
                            <div className="spin-pointer">▼</div>
                            <canvas ref={canvasRef} width={260} height={260} className="spin-canvas" />
                        </div>
                        <div className="spin-qty-row">
                            <label className="spin-qty-label">Số lượt quay</label>
                            <div className="spin-qty-controls">
                                <button
                                    className="spin-qty-btn"
                                    onClick={() => setQty(q => Math.max(1, q - 1))}
                                    disabled={spinning || qty <= 1}
                                >−</button>
                                <input
                                    type="number"
                                    className="spin-qty-input"
                                    min={1} max={50}
                                    value={qty}
                                    disabled={spinning}
                                    onChange={e => {
                                        const v = parseInt(e.target.value) || 1;
                                        setQty(Math.min(50, Math.max(1, v)));
                                    }}
                                />
                                <button
                                    className="spin-qty-btn"
                                    onClick={() => setQty(q => Math.min(50, q + 1))}
                                    disabled={spinning || qty >= 50}
                                >+</button>
                            </div>
                        </div>
                    </div>

                    {/* COL 2: prizes + result + all spin buttons */}
                    <div className="spin-col-right">
                        <h3 className="spin-prizes-title">🎁 Phần thưởng</h3>
                        <div className="spin-prizes-grid">
                            {PRIZES.map((p, i) => (
                                <div key={i} className="spin-prize-row" style={{ borderLeftColor: p.color }}>
                                    <span>{p.icon}</span>
                                    <span>{p.label}</span>
                                </div>
                            ))}
                        </div>

                        {spinSummary ? (
                            <div className="spin-result spin-result-summary">
                                <span className="spin-result-icon">🎊</span>
                                <div className="spin-result-text">
                                    <strong>{spinSummary.spins} lượt</strong> —{' '}
                                    {[
                                        spinSummary.coins  && `+${spinSummary.coins} Xu`,
                                        spinSummary.gems   && `+${spinSummary.gems} Đá`,
                                        spinSummary.xp     && `+${spinSummary.xp} XP`,
                                        spinSummary.hints  && `+${spinSummary.hints} Gợi ý`,
                                    ].filter(Boolean).join(', ') || 'Phần thưởng nhận được'}
                                </div>
                            </div>
                        ) : result ? (
                            <div className="spin-result">
                                <span className="spin-result-icon">{resultPrize?.icon || '🎁'}</span>
                                <span className="spin-result-text">Nhận được <strong>{result.label}</strong>!</span>
                            </div>
                        ) : null}

                        <div className="spin-paid-btns">
                            {canFreeSpin ? (
                                <button
                                    className={`spin-action-btn spin-free-btn${spinning ? ' spinning' : ''}`}
                                    onClick={() => doSpin('free')}
                                    disabled={spinning}
                                >
                                    {spinning ? <><i className="fas fa-spinner fa-spin"></i> Đang quay...</> : '🎁 Quay Miễn Phí'}
                                </button>
                            ) : (
                                <div className="spin-cooldown">
                                    <i className="fas fa-clock"></i>
                                    {countdown ? ` Miễn phí sau: ${countdown}` : ' Hết lượt miễn phí hôm nay'}
                                </div>
                            )}
                            <button
                                className="spin-action-btn spin-coin-btn"
                                onClick={() => doSpin('coin')}
                                disabled={spinning || coins < totalCoinCost}
                                title={`Số dư: ${coins} xu`}
                            >
                                🪙 {totalCoinCost} Xu
                                <span className="spin-balance">({coins} xu)</span>
                            </button>
                            <button
                                className="spin-action-btn spin-gem-btn"
                                onClick={() => doSpin('gem')}
                                disabled={spinning || gems < totalGemCost}
                                title={`Số dư: ${gems} đá · Tỷ lệ cao hơn!`}
                            >
                                💎 {totalGemCost} Đá
                                <span className="spin-balance">({gems} đá) ✨</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
