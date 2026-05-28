import { useState, useEffect, useCallback, useRef } from 'react';
import { useGame } from '@game/GameContext.jsx';
import { useAuth } from '@components/auth/AuthContext.jsx';
import { API } from '@api/http.js';
import { GameState } from '@game/state.js';
import { Notification } from '@ui/Toaster.jsx';
import { Utils } from '@lib/utils.js';

export default function ProfileScreen({ active }) {
    const { showScreen, user, resources, streak, syncFromState } = useGame();
    const { isLoggedIn, setAuthModal } = useAuth();
    const [editing, setEditing] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [stats, setStats] = useState(null);
    const [achievements, setAchievements] = useState([]);
    const [showAllAchievements, setShowAllAchievements] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const avatarInputRef = useRef(null);

    useEffect(() => {
        if (active) {
            setStats(GameState.getStatistics());
            setAchievements(GameState.state.achievements || []);
        }
    }, [active]);

    async function handleSaveUsername() {
        if (!newUsername.trim()) return;
        const res = await API.auth.updateProfile({ username: newUsername });
        if (res.success) {
            Notification.success('Cập nhật tên thành công!');
            setEditing(false);
            syncFromState();
        } else {
            Notification.error(res.error || 'Cập nhật thất bại');
        }
    }

    function resizeToBlob(file, maxSize) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(url);
                let w = img.width, h = img.height;
                if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; } }
                else { if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; } }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')), 'image/jpeg', 0.85);
            };
            img.onerror = reject;
            img.src = url;
        });
    }

    async function handleAvatarChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { Notification.error('Chỉ hỗ trợ file ảnh'); return; }
        setUploadingAvatar(true);
        try {
            const blob = await resizeToBlob(file, 300);
            const res = await API.auth.uploadAvatar(blob);
            if (res.success) {
                // Thêm cache-buster để browser fetch lại ảnh mới (filename không đổi)
                GameState.state.user.avatar = res.avatar + '?v=' + Date.now();
                syncFromState();
                Notification.success('Đã cập nhật ảnh đại diện!');
            } else {
                Notification.error(res.message || 'Cập nhật thất bại');
            }
        } catch {
            Notification.error('Không thể tải ảnh lên');
        } finally {
            setUploadingAvatar(false);
            e.target.value = '';
        }
    }

    const handleCopyId = useCallback(() => {
        const id = user?.id || user?._id || '';
        if (!id) return;
        navigator.clipboard?.writeText(id).then(() => {
            Notification.success('Đã sao chép ID!');
        });
    }, [user]);

    const level = user?.level || 1;
    const xp = user?.xp || 0;
    const neededXp = Utils.getXpForLevel(level) || 100;
    const xpPercent = neededXp > 0 ? Math.min(100, Math.round((xp / neededXp) * 100)) : 100;
    const levelTitle = Utils.getLevelTitle(level);
    const userId = user?.id || user?._id || '—';

    const unlockedCount = achievements.filter(a => a.unlocked).length;

    if (!isLoggedIn) {
        return (
            <div id="profile-screen" className={`screen ${active ? 'active' : ''}`}>
                <div className="screen-header">
                    <button className="back-btn-screen icon-btn" onClick={() => showScreen('home-screen')}>
                        <i className="fas fa-arrow-left"></i>
                    </button>
                    <h2><i className="fas fa-user"></i> Hồ sơ</h2>
                </div>
                <div id="profile-content" className="profile-content">
                    <div className="not-logged-in">
                        <i className="fas fa-user-circle fa-5x"></i>
                        <p>Đăng nhập để xem hồ sơ của bạn</p>
                        <button className="btn btn-primary" onClick={() => setAuthModal('login')}>Đăng nhập</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div id="profile-screen" className={`screen ${active ? 'active' : ''}`}>
            <div className="screen-header">
                <button className="back-btn-screen icon-btn" onClick={() => showScreen('home-screen')}>
                    <i className="fas fa-arrow-left"></i>
                </button>
                <h2><i className="fas fa-user"></i> Hồ sơ</h2>
                <button className="icon-btn" style={{ marginLeft: 'auto' }} title="Làm mới" onClick={() => { setStats(GameState.getStatistics()); setAchievements(GameState.state.achievements || []); syncFromState(); }}>
                    <i className="fas fa-rotate-right"></i>
                </button>
            </div>
            <div id="profile-content" className="profile-content">

                <div className="profile-header">
                    <div
                        className="profile-avatar profile-avatar--clickable"
                        onClick={() => avatarInputRef.current?.click()}
                        title="Đổi ảnh đại diện"
                    >
                        {user?.avatar && (user.avatar.startsWith('data:image') || user.avatar.startsWith('http') || user.avatar.startsWith('/'))
                            ? <img src={user.avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                            : (user?.avatar || 'P')
                        }
                        <div className="profile-avatar-overlay">
                            {uploadingAvatar
                                ? <i className="fas fa-spinner fa-spin"></i>
                                : <i className="fas fa-camera"></i>
                            }
                        </div>
                    </div>
                    <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleAvatarChange}
                    />

                    <div className="profile-details">
                        {editing ? (
                            <div className="edit-username" style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                                <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="Tên mới..."
                                    style={{ flex: 1, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 8, padding: '4px 10px', color: '#fff', outline: 'none' }} />
                                <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', padding: '4px 12px' }} onClick={handleSaveUsername}>Lưu</button>
                                <button className="btn btn-sm" style={{ background: 'rgba(0,0,0,0.2)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', padding: '4px 12px' }} onClick={() => setEditing(false)}>Hủy</button>
                            </div>
                        ) : (
                            <div style={{ fontWeight: 700, fontSize: '1.15em', color: '#fff', marginBottom: 4 }}>
                                {user?.username || 'Player'}
                            </div>
                        )}

                        <div className="profile-info-row">
                            <i className="fas fa-envelope"></i>
                            <span>{user?.email || '—'}</span>
                        </div>

                        <div className="profile-info-row">
                            <i className="fas fa-fingerprint"></i>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.8em' }}>{userId}</span>
                            <button className="btn-copy-id" onClick={handleCopyId} title="Sao chép ID">
                                <i className="fas fa-copy"></i>
                            </button>
                        </div>

                        <div className="profile-info-row">
                            <i className="fas fa-star" style={{ color: '#fbbf24' }}></i>
                            <span style={{ fontWeight: 600 }}>Level {level}</span>
                            <span style={{ fontSize: '0.8em', background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '2px 10px', borderRadius: 10, fontWeight: 600 }}>
                                {levelTitle.full}
                            </span>
                            {user?.role === 'admin' && (
                                <span style={{ fontSize: '0.75em', background: '#ef4444', color: '#fff', padding: '1px 8px', borderRadius: 10, fontWeight: 600 }}>Admin</span>
                            )}
                            {!editing && (
                                <button className="btn-copy-id" onClick={() => { setEditing(true); setNewUsername(user?.username || ''); }}
                                    title="Đổi tên" style={{ marginLeft: 'auto' }}>
                                    <i className="fas fa-edit"></i> Đổi tên
                                </button>
                            )}
                        </div>

                        <div style={{ marginTop: 6 }}>
                            <div className="xp-bar">
                                <div className="xp-progress" style={{ width: `${xpPercent}%` }}></div>
                            </div>
                            <div className="xp-text" style={{ marginTop: 4 }}>{xp.toLocaleString()} / {neededXp.toLocaleString()} XP</div>
                        </div>
                    </div>
                </div>

                <section className="profile-section">
                    <h3><i className="fas fa-wallet"></i> Tài nguyên</h3>
                    <div className="resources-grid">
                        <div className="resource-card">
                            <div className="resource-icon energy">⚡</div>
                            <div className="resource-value">{resources.energy}</div>
                            <div className="resource-label">Năng lượng</div>
                            <small className="resource-max">Max: {resources.maxEnergy}</small>
                        </div>
                        <div className="resource-card">
                            <div className="resource-icon coins">🪙</div>
                            <div className="resource-value">{resources.coins?.toLocaleString()}</div>
                            <div className="resource-label">Coins</div>
                        </div>
                        <div className="resource-card">
                            <div className="resource-icon gems">💎</div>
                            <div className="resource-value">{resources.gems?.toLocaleString()}</div>
                            <div className="resource-label">Gems</div>
                        </div>
                        <div className="resource-card">
                            <div className="resource-icon hints">💡</div>
                            <div className="resource-value">{resources.hints || 0}</div>
                            <div className="resource-label">Gợi ý</div>
                        </div>
                    </div>
                </section>

                {stats && (
                    <section className="profile-section">
                        <h3><i className="fas fa-chart-bar"></i> Thống kê</h3>
                        <div className="profile-stats">
                            <div className="profile-stat-card">
                                <div className="stat-icon">📚</div>
                                <div className="profile-stat-value">{stats.wordsLearned}</div>
                                <div className="profile-stat-label">Từ đã học</div>
                            </div>
                            <div className="profile-stat-card">
                                <div className="stat-icon">🎮</div>
                                <div className="profile-stat-value">{stats.totalGamesPlayed}</div>
                                <div className="profile-stat-label">Lượt chơi</div>
                            </div>
                            <div className="profile-stat-card">
                                <div className="stat-icon">🎯</div>
                                <div className="profile-stat-value">{stats.accuracy}%</div>
                                <div className="profile-stat-label">Độ chính xác</div>
                            </div>
                            <div className="profile-stat-card">
                                <div className="stat-icon">⭐</div>
                                <div className="profile-stat-value">{stats.perfectRounds}</div>
                                <div className="profile-stat-label">Vòng hoàn hảo</div>
                            </div>
                            <div className="profile-stat-card">
                                <div className="stat-icon">🏆</div>
                                <div className="profile-stat-value">{stats.highestScore?.toLocaleString()}</div>
                                <div className="profile-stat-label">Điểm cao nhất</div>
                            </div>
                            <div className="profile-stat-card">
                                <div className="stat-icon">🔥</div>
                                <div className="profile-stat-value">{streak.current}</div>
                                <div className="profile-stat-label">Streak hiện tại</div>
                                <small>Dài nhất: {streak.longest}</small>
                            </div>
                        </div>
                    </section>
                )}

                {achievements.length > 0 && (
                    <section className="profile-section">
                        <h3>
                            <i className="fas fa-medal"></i> Thành tích
                            <span className="achievement-count"> ({unlockedCount}/{achievements.length})</span>
                        </h3>
                        {!showAllAchievements ? (
                            <>
                                <div className="achievements-preview">
                                    {achievements.slice(0, 6).map((a, i) => (
                                        <div key={i} className={`achievement-badge ${a.unlocked ? 'unlocked' : 'locked'}`}>
                                            <div className="achievement-icon">{a.icon}</div>
                                            <div className="achievement-name">{a.name}</div>
                                        </div>
                                    ))}
                                </div>
                                <button className="btn btn-secondary btn-block" onClick={() => setShowAllAchievements(true)}>
                                    Xem tất cả thành tích
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="all-achievements">
                                    {achievements.map((a, i) => (
                                        <div key={i} className={`achievement-item ${a.unlocked ? 'unlocked' : 'locked'}`}>
                                            <div className="achievement-icon-large">{a.icon}</div>
                                            <div className="achievement-details">
                                                <h4>{a.name}</h4>
                                                <p>{a.description}</p>
                                                {a.unlocked ? (
                                                    <div className="achievement-unlocked-date">
                                                        <i className="fas fa-check-circle"></i>
                                                        Mở khóa: {new Date(a.unlockedAt).toLocaleDateString('vi-VN')}
                                                    </div>
                                                ) : (
                                                    <div className="achievement-locked-message">
                                                        <i className="fas fa-lock"></i> Chưa mở khóa
                                                    </div>
                                                )}
                                                {(a.reward?.coins || a.reward?.xp || a.reward?.gems) && (
                                                    <div className="achievement-rewards">
                                                        {a.reward.coins ? <span><i className="fas fa-coins"></i> {a.reward.coins}</span> : null}
                                                        {a.reward.xp ? <span><i className="fas fa-star"></i> {a.reward.xp} XP</span> : null}
                                                        {a.reward.gems ? <span><i className="fas fa-gem"></i> {a.reward.gems}</span> : null}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button className="btn btn-secondary btn-block" onClick={() => setShowAllAchievements(false)}>
                                    Thu gọn
                                </button>
                            </>
                        )}
                    </section>
                )}
            </div>
        </div>
    );
}
