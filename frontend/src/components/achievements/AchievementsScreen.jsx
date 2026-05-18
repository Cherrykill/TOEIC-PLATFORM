import { useState, useEffect, useCallback } from 'react';
import { useGame } from '@game/GameContext.jsx';
import { Notification } from '@ui/Toaster.jsx';
import { getToken } from '@/auth/token.js';
import { AuthAPI } from '@api/auth.js';
import { AchievementsAPI } from '@api/achievements.js';

const CATEGORIES = [
    { key: 'all',      label: 'Tất cả',    icon: 'fa-star' },
    { key: 'learning', label: 'Học tập',   icon: 'fa-book' },
    { key: 'practice', label: 'Luyện tập', icon: 'fa-gamepad' },
    { key: 'social',   label: 'Xã hội',    icon: 'fa-users' },
    { key: 'special',  label: 'Đặc biệt',  icon: 'fa-gem' },
];

function calculateProgress(ach) {
    const state = window.GameState?.state || {};
    const type = (ach.conditionType || '').toLowerCase().replace(/_/g, '-');
    const target = ach.conditionValue || 1;
    let current = 0;
    switch (type) {
        case 'words-learned':   current = (state.progress?.wordsLearned || []).length; break;
        case 'sessions':
        case 'total-sessions':  current = state.progress?.totalSessions || state.progress?.totalGamesPlayed || 0; break;
        case 'perfect-rounds':  current = state.progress?.perfectRounds || 0; break;
        case 'correct-answers':
        case 'total-answers':   current = state.progress?.totalCorrectAnswers || 0; break;
        case 'streak':          current = state.streak?.current || 0; break;
        case 'level':           current = state.user?.level || 1; break;
        default:                current = 0;
    }
    current = Math.min(current, target);
    return { current, pct: Math.round((current / target) * 100) };
}

export default function AchievementsScreen({ active }) {
    const { showScreen, syncFromState } = useGame();
    const [achievements, setAchievements] = useState([]);
    const [category, setCategory] = useState('all');
    const [loading, setLoading] = useState(false);

    const loadAchievements = useCallback(async () => {
        setLoading(true);

        const gsAchs = window.GameState?.state?.achievements;
        if (gsAchs?.length > 0) {
            setAchievements([...gsAchs]);
            setLoading(false);
            return;
        }

        if (!getToken()) { setLoading(false); return; }

        const res = await AuthAPI.me();

        if (res.success) {
            const achs = res.data?.achievements
                || res.data?.gameState?.achievements
                || res.data?.user?.achievements
                || [];
            setAchievements(achs);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (active) loadAchievements();
    }, [active, loadAchievements]);

    async function handleClaim(achievementId) {
        const res = await AchievementsAPI.claim(achievementId);
        if (res.success) {
            Notification.success('Nhận thưởng thành công!');
            syncFromState();
            loadAchievements();
        } else {
            Notification.error(res.message || 'Không thể nhận thưởng');
        }
    }

    const filtered = category === 'all' ? achievements : achievements.filter(a => a.category === category);
    const unlocked = achievements.filter(a => a.unlocked).length;
    const progressPct = achievements.length > 0 ? Math.round((unlocked / achievements.length) * 100) : 0;

    return (
        <div id="achievements-screen" className={`screen ${active ? 'active' : ''}`}>
            <div className="screen-header">
                <button className="back-btn-screen icon-btn" onClick={() => showScreen('home-screen')}>
                    <i className="fas fa-arrow-left"></i>
                </button>
                <h2><i className="fas fa-medal"></i> Thành tích</h2>
            </div>
            <div className="achievements-content">
                <div className="achievement-progress-card">
                    <h3>🏆 Tiến độ thành tích</h3>
                    <div className="progress-stats">
                        <div className="progress-item">
                            <span className="progress-label">Đã mở khóa</span>
                            <span className="progress-value" id="unlocked-achievements">{unlocked}/{achievements.length}</span>
                        </div>
                        <span className="progress-label">Khóa</span>
                        <div className="progress-bar-container">
                            <div className="progress-bar-fill" id="achievement-progress" style={{ width: `${progressPct}%` }}></div>
                        </div>
                    </div>
                </div>

                <div className="achievement-tabs">
                    {CATEGORIES.map(cat => (
                        <button key={cat.key} className={`achievement-tab ${category === cat.key ? 'active' : ''}`} data-category={cat.key} onClick={() => setCategory(cat.key)}>
                            <i className={`fas ${cat.icon}`}></i> {cat.label}
                        </button>
                    ))}
                </div>

                <div className="achievements-grid" id="achievements-grid">
                    {loading ? (
                        <div className="loading-state"><i className="fas fa-spinner fa-spin"></i> Đang tải...</div>
                    ) : filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                            <i className="fas fa-trophy" style={{ fontSize: 48, marginBottom: 16, opacity: .3, display: 'block' }}></i>
                            <p>Chưa có thành tích nào trong danh mục này.</p>
                        </div>
                    ) : filtered.map((ach, i) => {
                        const isUnlocked = !!ach.unlocked;
                        const prog = calculateProgress(ach);
                        const isClaimable = !isUnlocked && prog.current >= (ach.conditionValue || 1);
                        const iconIsEmoji = ach.icon && ach.icon.length <= 4;

                        return (
                            <div key={ach.id || ach._id || i} className={`achievement-card ${isUnlocked ? 'unlocked' : isClaimable ? 'claimable' : 'locked'}`}>
                                <div className={`achievement-icon ${isUnlocked || isClaimable ? 'gold' : ''}`}>
                                    {iconIsEmoji
                                        ? <span style={{ fontSize: 28 }}>{ach.icon}</span>
                                        : <i className={`fas ${ach.icon || (isUnlocked || isClaimable ? 'fa-trophy' : 'fa-lock')}`}></i>
                                    }
                                </div>
                                <div className="achievement-info">
                                    <h4>{ach.name}</h4>
                                    <p>{ach.description}</p>
                                    {isUnlocked ? (
                                        <span className="unlocked-badge">✓ Đã mở khóa</span>
                                    ) : isClaimable ? (
                                        <button className="btn btn-primary btn-sm" onClick={() => handleClaim(ach.id || ach._id)}>
                                            Nhận thưởng
                                        </button>
                                    ) : (
                                        <>
                                            <div className="achievement-progress-bar">
                                                <div className="progress-fill" style={{ width: `${prog.pct}%`, height: '100%', background: 'var(--primary-color)', borderRadius: 6 }}></div>
                                            </div>
                                            <span className="achievement-progress-text">{prog.current}/{ach.conditionValue || ach.target || 1}</span>
                                        </>
                                    )}
                                </div>
                                {(ach.rewardCoins || ach.rewardXp || ach.rewardGems || ach.reward) && (
                                    <div className="achievement-reward">
                                        {(ach.rewardCoins || ach.reward?.coins) > 0 && <span><i className="fas fa-coins"></i> {ach.rewardCoins || ach.reward?.coins}</span>}
                                        {(ach.rewardXp || ach.reward?.xp) > 0 && <span><i className="fas fa-star"></i> {ach.rewardXp || ach.reward?.xp} XP</span>}
                                        {(ach.rewardGems || ach.reward?.gems) > 0 && <span><i className="fas fa-gem"></i> {ach.rewardGems || ach.reward?.gems}</span>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
