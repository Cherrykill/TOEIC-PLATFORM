import { useState, useEffect, useCallback } from 'react';
import { useGame } from '@game/GameContext.jsx';
import { Notification } from '@ui/Toaster.jsx';
import { getToken } from '@/auth/token.js';
import { AuthAPI } from '@api/auth.js';
import { AchievementsAPI } from '@api/achievements.js';
import { Utils } from '@lib/utils.js';
import { Config } from '@game/config.js';

const CATEGORIES = [
    { key: 'all',      label: 'Tất cả',    icon: 'fa-star' },
    { key: 'learning', label: 'Học tập',   icon: 'fa-book' },
    { key: 'practice', label: 'Luyện tập', icon: 'fa-gamepad' },
    { key: 'social',   label: 'Xã hội',    icon: 'fa-users' },
    { key: 'special',  label: 'Đặc biệt',  icon: 'fa-gem' },
];

// ===================================================================
// CATALOG METRIC THÀNH TÍCH — NGUỒN SỰ THẬT DUY NHẤT
// Admin (backend/public/admin) phải dùng ĐÚNG các `key` này cho
// conditionType. Khoá chuẩn là kebab-case; chấp nhận cả underscore
// và vài alias cũ (normalize bên dưới) để không vỡ data đã seed.
// `needsMode: true` → cần chọn thêm conditionMode (chế độ game).
// ===================================================================
export const ACHIEVEMENT_METRICS = [
    { key: 'words-learned',     label: 'Số từ đã học' },
    { key: 'words-mastered',    label: 'Số từ đã thuộc' },
    { key: 'sessions',          label: 'Số lượt luyện tập (session)' },
    { key: 'games-played',      label: 'Số lượt chơi (game)' },
    { key: 'perfect-rounds',    label: 'Số vòng hoàn hảo' },
    { key: 'correct-answers',   label: 'Tổng số câu trả lời đúng' },
    { key: 'wrong-answers',     label: 'Tổng số câu trả lời sai' },
    { key: 'questions-answered', label: 'Tổng số câu đã trả lời' },
    { key: 'streak',            label: 'Streak hiện tại (ngày)' },
    { key: 'streak-longest',    label: 'Streak dài nhất (ngày)' },
    { key: 'level',             label: 'Cấp độ (level)' },
    { key: 'total-xp',          label: 'Tổng XP tích luỹ' },
    { key: 'coins',             label: 'Số coins đang có' },
    { key: 'gems',              label: 'Số gems đang có' },
    { key: 'highest-score',     label: 'Điểm cao nhất' },
    { key: 'play-time',         label: 'Tổng thời gian luyện (giây)' },
    { key: 'accuracy',          label: 'Độ chính xác (%)' },
    { key: 'mode-plays',        label: 'Số lượt chơi 1 chế độ', needsMode: true },
];

// Alias cũ → khoá chuẩn (sau khi đã thay _ thành -)
const METRIC_ALIASES = {
    'total-sessions': 'sessions',
    'total-answers': 'correct-answers',
    'total-questions': 'questions-answered',
    'words-mastered': 'words-mastered',
    'longest-streak': 'streak-longest',
    'xp': 'total-xp',
    'xp-total': 'total-xp',
    'score': 'highest-score',
    'playtime': 'play-time',
    'time': 'play-time',
};

function calculateProgress(ach) {
    const state = window.GameState?.state || {};
    const p = state.progress || {};
    const raw = (ach.conditionType || '').toLowerCase().replace(/_/g, '-');
    const type = METRIC_ALIASES[raw] || raw;
    const target = ach.conditionValue || 1;

    const correct = p.totalCorrectAnswers || 0;
    const wrong = p.totalWrongAnswers || 0;

    let current = 0;
    switch (type) {
        case 'words-learned':    current = (p.wordsLearned || []).length; break;
        case 'words-mastered':   current = (p.wordsMastered || []).length; break;
        case 'sessions':         current = p.totalSessions || p.totalGamesPlayed || 0; break;
        case 'games-played':     current = p.totalGamesPlayed || 0; break;
        case 'perfect-rounds':   current = p.perfectRounds || 0; break;
        case 'correct-answers':  current = correct; break;
        case 'wrong-answers':    current = wrong; break;
        case 'questions-answered': current = p.totalQuestionsAnswered || (correct + wrong); break;
        case 'streak':           current = state.streak?.current || 0; break;
        case 'streak-longest':   current = state.streak?.longest || 0; break;
        case 'level':            current = state.user?.level || 1; break;
        case 'total-xp':         current = state.user?.totalXp || 0; break;
        case 'coins':            current = state.resources?.coins || 0; break;
        case 'gems':             current = state.resources?.gems || 0; break;
        case 'highest-score':    current = p.highestScore || 0; break;
        case 'play-time':        current = p.totalPlayTime || 0; break;
        case 'accuracy':
            current = (correct + wrong) > 0 ? Math.round((correct / (correct + wrong)) * 100) : 0;
            break;
        case 'mode-plays': {
            const mode = (ach.conditionMode || '').trim();
            current = mode ? (p.modeStats?.[mode]?.played || 0) : 0;
            break;
        }
        default:                 current = 0;
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
            Utils.playSound(Config.sounds.achievement, 0.6, { ignoreSettings: true });
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
