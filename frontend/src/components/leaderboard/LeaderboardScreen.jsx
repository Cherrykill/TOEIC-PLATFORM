import { useState, useEffect } from 'react';
import { useGame } from '@game/GameContext.jsx';
import { GameState } from '@game/state.js';

export default function LeaderboardScreen({ active }) {
    const { showScreen } = useGame();
    const [period, setPeriod] = useState('daily');
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [fallbackNotice, setFallbackNotice] = useState('');

    useEffect(() => {
        if (active) loadLeaderboard(period);
    }, [active, period]);

    async function loadLeaderboard(p) {
        setLoading(true);
        setFallbackNotice('');
        const res = await fetch(`/api/leaderboard/${p}`).then(r => r.json()).catch(() => ({ success: false }));
        const data = res.success ? (res.data || []) : [];

        // If daily/weekly returns empty, auto-fallback to all-time
        if (data.length === 0 && p !== 'all-time') {
            const fallback = await fetch('/api/leaderboard/all-time').then(r => r.json()).catch(() => ({ success: false }));
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

    const filtered = entries.filter(e =>
        !search || e.username?.toLowerCase().includes(search.toLowerCase()) || e.userId?.includes(search)
    );
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
                    return (
                        <div key={i} className={`leaderboard-item${isMe ? ' leaderboard-item--me' : ''}`}>
                            <div className="leaderboard-rank">{rank}</div>
                            <div className="leaderboard-avatar-wrap">
                                <div className="leaderboard-avatar">{entry.avatar || entry.username?.charAt(0)?.toUpperCase() || 'P'}</div>
                                {isMe && <span className="online-dot online-dot--on" />}
                            </div>
                            <div className="leaderboard-info">
                                <div className="leaderboard-name">
                                    {entry.username || 'Ẩn danh'}
                                    {isMe && <span className="leaderboard-you-badge">Bạn</span>}
                                </div>
                                <div className="leaderboard-level"><i className="fas fa-star"></i> Level {entry.level || 1}</div>
                            </div>
                            <span className="leaderboard-score">{(entry.totalXp || entry.xp || entry.score || 0).toLocaleString()} XP</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
