import { useState, useEffect } from 'react';
import { useGame } from '@game/GameContext.jsx';
import { GameState } from '@game/state.js';
import { RankingsAPI } from '@api/rankings.js';
import { bgKeyForUser, bgStyle } from '@game/backgrounds.js';
import { frameStyle } from '@game/frames.js';

export default function LeaderboardScreen({ active }) {
    const { showScreen } = useGame();
    const [period, setPeriod] = useState('daily');
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [fallbackNotice, setFallbackNotice] = useState('');
    const [selected, setSelected] = useState(null);  // entry để hiện popup chi tiết

    // ESC để đóng popup
    useEffect(() => {
        if (!selected) return;
        const onKey = (e) => { if (e.key === 'Escape') setSelected(null); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [selected]);

    async function copyId(id) {
        if (!id) return;
        try {
            await navigator.clipboard.writeText(String(id));
            window._reactNotification?.success?.('Đã sao chép ID');
        } catch {
            window._reactNotification?.error?.('Không sao chép được');
        }
    }

    useEffect(() => {
        if (active) loadLeaderboard(period);
    }, [active, period]);

    async function loadLeaderboard(p) {
        setLoading(true);
        setFallbackNotice('');
        const res = await RankingsAPI.byPeriod(p);
        const data = res.success ? (res.data || []) : [];

        // If daily/weekly returns empty, auto-fallback to all-time
        if (data.length === 0 && p !== 'all-time') {
            const fallback = await RankingsAPI.byPeriod('all-time');
            const fallbackData = fallback.success ? (fallback.data || []) : [];
            setEntries(fallbackData);
            if (fallbackData.length > 0) {
                setFallbackNotice(p === 'daily' ? 'Chưa có hoạt động hôm nay — hiển thị xếp hạng toàn thời gian' : 'Chưa có hoạt động tuần này — hiển thị xếp hạng toàn thời gian');
            }
        } else {
            setEntries(data);
        }
        setLoading(false);
    }

    const filtered = entries.filter(e => {
        if (!search) return true;
        const kw = search.trim().toLowerCase();
        if (!kw) return true;
        // Backend trả về field `id` (= userId), không có `userId`. Trước
        // đây chỉ check `e.userId` nên copy ID từ popup vào ô tìm là tịt.
        const id = String(e.id || e.userId || '').toLowerCase();
        const name = String(e.username || '').toLowerCase();
        return name.includes(kw) || id.includes(kw);
    });
    const onlineCount = entries.filter(e => e.isOnline).length;
    const totalCount = entries.length;

    return (
        <div id="leaderboard-screen" className={`screen ${active ? 'active' : ''}`}>
            <div className="screen-header">
                <button className="back-btn-screen icon-btn" onClick={() => showScreen('home-screen')}>
                    <i className="fas fa-arrow-left"></i>
                </button>
                <h2><i className="fas fa-trophy"></i> Bảng xếp hạng</h2>
                {!loading && totalCount > 0 && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.82em', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 6px #22c55e' }} />
                        <span><strong style={{ color: '#22c55e' }}>{onlineCount}</strong> / {totalCount} trực tuyến</span>
                    </span>
                )}
                <button id="refresh-leaderboard-btn" className="icon-btn" title="Làm mới" onClick={() => loadLeaderboard(period)}>
                    <i className="fas fa-rotate-right"></i>
                </button>
            </div>
            <div className="leaderboard-tabs">
                {[['daily', 'Hôm nay'], ['weekly', 'Tuần này'], ['all-time', 'Mọi lúc']].map(([p, label]) => (
                    <button key={p} className={`tab-btn ${period === p ? 'active' : ''}`} data-period={p} onClick={() => setPeriod(p)}>
                        {label}
                    </button>
                ))}
            </div>
            <div className="search-bar" style={{ margin: '0 0 var(--spacing-md)' }}>
                <i className="fas fa-search"></i>
                <input
                    type="text"
                    id="leaderboard-search-input"
                    placeholder="Tìm theo tên hoặc ID người chơi..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>
            {fallbackNotice && (
                <div style={{ textAlign: 'center', padding: '8px 16px', color: 'var(--text-secondary)', fontSize: '0.85em', fontStyle: 'italic' }}>
                    <i className="fas fa-info-circle"></i> {fallbackNotice}
                </div>
            )}
            <div id="leaderboard-content" className="leaderboard-content">
                {loading ? (
                    <div className="loading-state"><i className="fas fa-spinner fa-spin"></i> Đang tải...</div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state">Chưa có dữ liệu</div>
                ) : filtered.map((entry, i) => {
                    const rank = entry.rank || i + 1;
                    const myId = GameState.state.user?.id || GameState.state.user?._id;
                    const myName = GameState.state.user?.username;
                    const isMe = (myId && entry.userId === myId) || (myName && entry.username === myName);
                    const myVip = GameState.state?.vip;
                    const myVipActive = !!(myVip?.active && myVip.expiresAt && Date.now() < myVip.expiresAt);
                    const rowVip = entry.isVip || (isMe && myVipActive);
                    const bgKey = bgKeyForUser({ isVip: rowVip, background: entry.background });
                    const rowStyle = { cursor: 'pointer', ...(bgStyle(bgKey) || {}) };
                    return (
                        <div
                            key={i}
                            className={`leaderboard-item${isMe ? ' leaderboard-item--me' : ''}${bgKey ? ' leaderboard-item--custom-bg' : ''}${rowVip ? ' leaderboard-item--vip' : ''}`}
                            onClick={() => setSelected(entry)}
                            style={rowStyle}
                        >
                            <div className="leaderboard-rank">{rank}</div>
                            <div className="leaderboard-avatar-wrap">
                                <div className="leaderboard-avatar" style={frameStyle(entry.frame) || undefined}>
                                    {entry.avatar && (entry.avatar.startsWith('data:image') || entry.avatar.startsWith('http') || entry.avatar.startsWith('/'))
                                        ? <img src={entry.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                        : (entry.avatar || entry.username?.charAt(0)?.toUpperCase() || 'P')
                                    }
                                </div>
                                {entry.isOnline && <span className="online-dot online-dot--on" />}
                            </div>
                            <div className="leaderboard-info">
                                <div className="leaderboard-name">
                                    {entry.username || 'Ẩn danh'}
                                    {rowVip && <span className="leaderboard-vip-badge">👑 VIP</span>}
                                    {isMe && <span className="leaderboard-you-badge">Bạn</span>}
                                </div>
                                <div className="leaderboard-level"><i className="fas fa-star"></i> Level {entry.level || 1}</div>
                            </div>
                            <span className="leaderboard-score">{(entry.totalXp || entry.xp || entry.score || 0).toLocaleString()} XP</span>
                        </div>
                    );
                })}
            </div>

            {selected && (
                <div className="player-popup-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
                    <div className="player-popup">
                        <button className="player-popup-close" onClick={() => setSelected(null)} title="Đóng (Esc)">
                            <i className="fas fa-times"></i>
                        </button>
                        <div className="player-popup-avatar" style={frameStyle(selected.frame) || undefined}>
                            {selected.avatar && (selected.avatar.startsWith('data:image') || selected.avatar.startsWith('http') || selected.avatar.startsWith('/'))
                                ? <img src={selected.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                : (selected.avatar || selected.username?.[0]?.toUpperCase() || '?')
                            }
                        </div>
                        <h3 className="player-popup-name">{selected.username || 'Ẩn danh'}</h3>
                        <div className="player-popup-id">
                            <span>ID: {String(selected.id || selected.userId || '—').slice(0, 24)}</span>
                            <button className="player-popup-copy" onClick={() => copyId(selected.id || selected.userId)} title="Sao chép ID">
                                <i className="fas fa-copy"></i>
                            </button>
                        </div>
                        <div className="player-popup-stats">
                            <div className="player-stat">
                                <div className="player-stat-value">Level {selected.level || 1}</div>
                                <div className="player-stat-label">Cấp độ</div>
                            </div>
                            <div className="player-stat">
                                <div className="player-stat-value">{(selected.totalXp || selected.xp || selected.score || 0).toLocaleString()}</div>
                                <div className="player-stat-label">Điểm số</div>
                            </div>
                            {selected.streak != null && (
                                <div className="player-stat">
                                    <div className="player-stat-value">🔥 {selected.streak}</div>
                                    <div className="player-stat-label">Chuỗi ngày</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
