import { useState, useEffect, useCallback } from 'react';
import { useGame } from '@game/GameContext.jsx';
import { Notification } from '@ui/Toaster.jsx';
import { getToken } from '@/auth/token.js';
import { AuthAPI } from '@api/auth.js';
import { AchievementsAPI } from '@api/achievements.js';
import { Utils } from '@lib/utils.js';
import { Config } from '@game/config.js';
import { GameState } from '@game/state.js';

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

export function calculateProgress(ach) {
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
            // Cộng thưởng cục bộ + đánh dấu unlocked để UI đổi NGAY,
            // không phải F5 mới thấy. Backend đã ghi DB rồi.
            const rewards = res.data?.rewards || {};
            GameState.creditServerRewards(rewards);
            const now = new Date().toISOString();
            setAchievements(prev => prev.map(a =>
                (a.id || a._id) === achievementId
                    ? { ...a, unlocked: true, unlockedAt: now }
                    : a
            ));
            const gs = window.GameState?.state?.achievements;
            if (Array.isArray(gs)) {
                const i = gs.findIndex(a => (a.id || a._id) === achievementId);
                if (i >= 0) gs[i] = { ...gs[i], unlocked: true, unlockedAt: now };
            }
            Utils.playSound(Config.sounds.achievement, 0.6, { ignoreSettings: true });
            Notification.success('Nhận thưởng thành công!');
            syncFromState();
        } else {
            Notification.error(res.message || 'Không thể nhận thưởng');
        }
    }

    // Gom các category gốc (learning/practice/streak/skill/speed/social) về
    // 4 tab hiển thị. Mọi category lạ rơi vào "Đặc biệt" để không "tịt".
    const CATEGORY_BUCKETS = {
        learning: 'learning',
        practice: 'practice', speed: 'practice', skill: 'practice',
        social: 'social',
        streak: 'special', special: 'special',
    };
    const bucketOf = (cat) => CATEGORY_BUCKETS[String(cat || '').toLowerCase()] || 'special';
    const filtered = category === 'all'
        ? achievements
        : achievements.filter(a => bucketOf(a.category) === category);
    const unlocked = achievements.filter(a => a.unlocked).length;
    const progressPct = achievements.length > 0 ? Math.round((unlocked / achievements.length) * 100) : 0;

    return (
        <div id="achievements-screen" className={`screen ${active ? 'active' : ''}`}>
            <div className="screen-header">
                <button className="back-btn-screen icon-btn" onClick={() => showScreen('home-screen')}>
                    <i className="fas fa-arrow-left"></i>
                </button>
                <h2><i className="fas fa-medal"></i> Thành tích</h2>
                {achievements.length > 0 && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.82em', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', boxShadow: '0 0 6px #f59e0b' }} />
                        <span><strong style={{ color: '#f59e0b' }}>{unlocked}</strong> / {achievements.length} đã mở</span>
                    </span>
                )}
                <button className="icon-btn" title="Làm mới" onClick={loadAchievements}>
                    <i className="fas fa-rotate-right"></i>
                </button>
            </div>
            <div className="achievements-content">

                <div className="achievement-tabs">
                    {(() => {
                        // Đếm thành tích CLAIMABLE (chưa unlock + đã đạt target) theo bucket tab.
                        const claimable = { all: 0, learning: 0, practice: 0, social: 0, special: 0 };
                        for (const a of achievements) {
                            if (a.unlocked) continue;
                            const { current } = calculateProgress(a);
                            if (current < (a.conditionValue || 1)) continue;
                            claimable.all++;
                            const b = bucketOf(a.category);
                            if (claimable[b] !== undefined) claimable[b]++;
                        }
                        return CATEGORIES.map(cat => {
                            const n = claimable[cat.key] || 0;
                            return (
                                <button key={cat.key} className={`achievement-tab ${category === cat.key ? 'active' : ''}`} data-category={cat.key} onClick={() => setCategory(cat.key)}>
                                    <i className={`fas ${cat.icon}`}></i> {cat.label}
                                    {n > 0 && <span className="tab-badge">{n > 99 ? '99+' : n}</span>}
                                </button>
                            );
                        });
                    })()}
                </div>

                <div className="achievements-grid" id="achievements-grid">
                    {loading ? (
                        <div className="loading-state"><i className="fas fa-spinner fa-spin"></i> Đang tải...</div>
                    ) : filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                            <i className="fas fa-trophy" style={{ fontSize: 48, marginBottom: 16, opacity: .3, display: 'block' }}></i>
                            <p>Chưa có thành tích nào trong danh mục này.</p>
                        </div>
                    ) : [...filtered].sort((a, b) => {
                        const rank = x => {
                            if (x.unlocked) return 2;
                            const p = calculateProgress(x);
                            return p.current >= (x.conditionValue || x.target || 1) ? 0 : 1;
                        };
                        return rank(a) - rank(b);
                    }).map((ach, i) => {
                        const isUnlocked = !!ach.unlocked;
                        const prog = calculateProgress(ach);
                        const target = ach.conditionValue || ach.target || 1;
                        const isClaimable = !isUnlocked && prog.current >= target;
                        const iconIsEmoji = ach.icon && ach.icon.length <= 4;
                        // Khi đã mở khoá → hiển thị progress 100% cho đẹp.
                        const displayPct = isUnlocked ? 100 : prog.pct;
                        const displayCur = isUnlocked ? target : prog.current;

                        return (
                            <div key={ach.id || ach._id || i} className={`achievement-card ${isUnlocked ? 'unlocked' : isClaimable ? 'claimable' : 'locked'}`}>
                                <div className="achievement-card-top">
                                    <div className={`achievement-icon ${isUnlocked || isClaimable ? 'gold' : ''}`}>
                                        {iconIsEmoji
                                            ? <span style={{ fontSize: 28 }}>{ach.icon}</span>
                                            : <i className={`fas ${ach.icon || (isUnlocked || isClaimable ? 'fa-trophy' : 'fa-lock')}`}></i>
                                        }
                                    </div>
                                    <div className="achievement-info">
                                        <h4>{ach.name}</h4>
                                        <p>{ach.description}</p>
                                    </div>
                                    {(ach.rewardCoins || ach.rewardXp || ach.rewardGems || ach.reward) && (
                                        <div className="achievement-reward">
                                            {(ach.rewardCoins || ach.reward?.coins) > 0 && <span><i className="fas fa-coins"></i> {ach.rewardCoins || ach.reward?.coins}</span>}
                                            {(ach.rewardXp || ach.reward?.xp) > 0 && <span><i className="fas fa-star"></i> {ach.rewardXp || ach.reward?.xp} XP</span>}
                                            {(ach.rewardGems || ach.reward?.gems) > 0 && <span><i className="fas fa-gem"></i> {ach.rewardGems || ach.reward?.gems}</span>}
                                        </div>
                                    )}
                                </div>
                                <div className="achievement-card-bottom">
                                    <div className="achievement-progress">
                                        <div className="achievement-progress-bar">
                                            <div className="progress-fill" style={{ width: `${displayPct}%` }}></div>
                                        </div>
                                        <span className="achievement-progress-text">{displayCur}/{target}</span>
                                    </div>
                                    {isUnlocked ? (
                                        <span className="achievement-status unlocked-badge"><i className="fas fa-check-circle"></i> Đã mở khoá</span>
                                    ) : isClaimable ? (
                                        <button className="achievement-status btn btn-primary btn-sm" onClick={() => handleClaim(ach.id || ach._id)}>
                                            Nhận thưởng
                                        </button>
                                    ) : (
                                        <span className="achievement-status locked-badge"><i className="fas fa-lock"></i> Chưa mở khoá</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
