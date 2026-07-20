import { useState, useEffect, useCallback } from 'react';
import { useGame } from '@game/GameContext.jsx';
import { GameState } from '@game/state.js';
import { EventBus, GameEvents } from '@game/eventBus.js';
import { Utils } from '@lib/utils.js';
import { Energy } from '@game/energy.js';
import FlagIcon from '@ui/FlagIcon.jsx';
import { Notification } from '@ui/Toaster.jsx';
import { loadUnlocks, lockInfo } from '@game/featureUnlocks.js';

// Cấp độ → dải level thực tế dùng để LỌC từ vựng (phải khớp SettingsScreen).
const LEVEL_MAP = { easy: ['A1', 'A2'], medium: ['B1', 'B2'], hard: ['C1', 'C2'], adaptive: null };
const LEVEL_LABEL = { easy: 'Dễ (A1-A2)', medium: 'Trung bình (B1-B2)', hard: 'Khó (C1-C2)', adaptive: 'Toàn bộ' };

function computeSessionLabel() {
    const s = GameState.state?.settings || {};
    let mode;
    if (s.randomQuestions === false) mode = 'Tuần tự';
    else if (s.selectedPart) mode = 'Ngẫu nhiên Part';
    else mode = 'Ngẫu nhiên';
    const count = s.questionsPerSession === 'auto' ? '' : `${s.questionsPerSession || 20} câu • `;
    return `${count}${mode}`;
}

export default function StatusBar() {
    const { user, resources } = useGame();
    const [questionsPerSession, setQuestionsPerSession] = useState('auto');
    const [difficulty, setDifficulty] = useState('adaptive');
    const [sessionLabel, setSessionLabel] = useState(computeSessionLabel);

    const refreshSessionLabel = useCallback(() => setSessionLabel(computeSessionLabel()), []);

    useEffect(() => {
        const settings = GameState.state?.settings || {};
        setQuestionsPerSession(settings.questionsPerSession ?? 'auto');
        setDifficulty(settings.difficulty || 'adaptive');
        refreshSessionLabel();
    }, [refreshSessionLabel]);

    useEffect(() => {
        const unsubs = [
            EventBus.on(GameEvents.SESSION_BADGE_UPDATED, refreshSessionLabel),
            EventBus.on(GameEvents.GAME_INITIALIZED, refreshSessionLabel),
        ];
        return () => unsubs.forEach(fn => fn());
    }, [refreshSessionLabel]);

    const [vocabLang, setVocabLang] = useState(() => {
        try {
            return localStorage.getItem('vocabLang') || window.GameState?.state?.settings?.vocabLang || 'en';
        } catch {
            return window.GameState?.state?.settings?.vocabLang || 'en';
        }
    });

    // Mốc mở khoá — nạp 1 lần, làm mới khi lên cấp.
    const [, setUnlockTick] = useState(0);
    useEffect(() => {
        const reload = () => loadUnlocks(true).then(() => setUnlockTick(t => t + 1));
        reload();
        const unsub = EventBus.on(GameEvents.USER_LEVEL_UP, reload);
        return () => unsub?.();
    }, []);
    const zhLock = lockInfo('feature:lang-zh');

    const handleToggleVocabLang = () => {
        const next = vocabLang === 'en' ? 'zh' : 'en';
        // Chỉ khoá chiều SANG tiếng Trung — luôn cho quay về tiếng Anh
        // (tránh kẹt nếu đang ở 'zh' mà mốc bị nâng lên).
        if (next === 'zh' && zhLock.locked) {
            Notification.show({
                type: 'warning',
                title: `🔒 Cần Level ${zhLock.requiredLevel}`,
                message: `Học tiếng Trung mở khi bạn đạt Level ${zhLock.requiredLevel}.`,
                duration: 3500,
            });
            return;
        }
        setVocabLang(next);
        try {
            localStorage.setItem('vocabLang', next);
        } catch {}
        if (window.GameState?.state?.settings) {
            window.GameState.state.settings.vocabLang = next;
            window.GameState.save?.();
        }
        window.location.reload();
    };

    const energyFull = resources.energy >= resources.maxEnergy;
    const energyTitle = energyFull
        ? 'Năng lượng đã đầy'
        : `Năng lượng sẽ đầy sau ${Utils.formatTime(Energy.getSecondsUntilFull())}`;

    const level = user?.level || 1;
    const neededXp = Utils.getXpForLevel(level) || 100;
    const currentXp = Math.min(user?.xp || 0, neededXp);
    const xpPercent = Math.round((currentXp / neededXp) * 100);

    const handleQuestionsChange = (e) => {
        const val = e.target.value;
        setQuestionsPerSession(val);
        GameState.state.settings.questionsPerSession = val === 'auto' ? 'auto' : parseInt(val);
        GameState.save?.();
        EventBus.emit(GameEvents.SESSION_BADGE_UPDATED);
        Notification.info(val === 'auto'
            ? 'Số câu mỗi lượt: Toàn bộ từ trong bộ lọc'
            : `Số câu mỗi lượt: ${val} câu`);
    };

    const handleDifficultyChange = (e) => {
        const val = e.target.value;
        setDifficulty(val);
        const s = GameState.state.settings;
        s.difficulty = val;
        // BẮT BUỘC: bộ lọc từ vựng đọc `levelFilter`, không đọc `difficulty`.
        // Thiếu dòng này thì đổi cấp độ ở thanh trạng thái sẽ không có tác dụng.
        s.levelFilter = LEVEL_MAP[val] ?? null;
        GameState.save?.();
        Notification.info(val === 'adaptive'
            ? 'Cấp độ: Toàn bộ — không lọc theo trình độ'
            : `Cấp độ: ${LEVEL_LABEL[val]} — chỉ lấy từ ${LEVEL_MAP[val].join('/')}`);
    };

    return (
        <div className="status-bar" id="status-bar">
            <div className="status-bar-left">
                {/* Always rendered so vanilla JS can show/hide via style.display */}
                <div id="part-badge" className="part-badge" style={{ display: 'none' }}>
                    <i className="fas fa-layer-group"></i>
                    <span id="part-badge-text"></span>
                    <button className="part-badge-close" id="clear-part-btn" title="Xóa Part">
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="status-bar-divider"></div>
                <div className="resource energy-display" title={energyTitle}>
                    <i className="fas fa-bolt"></i>
                    <span id="energy-count">{resources.energy}</span>
                    <span className="resource-max">/{resources.maxEnergy}</span>
                </div>
                <div className="resource coins-display">
                    <i className="fas fa-coins"></i>
                    <span id="coins-count">{resources.coins}</span>
                </div>
                <div className="resource gems-display">
                    <i className="fas fa-gem"></i>
                    <span id="gems-count">{resources.gems}</span>
                </div>
            </div>

            <div className="status-bar-center">
                <div className="xp-bar-mini">
                    <div id="xp-progress" className="xp-progress" style={{ width: `${xpPercent}%` }}></div>
                </div>
                <span className="xp-text-mini">
                    <span id="current-xp">{currentXp}</span>/
                    <span id="needed-xp">{neededXp}</span> XP
                </span>
            </div>

            <div className="status-bar-right">
                <div className="quick-difficulty-selector" title="Số câu hỏi mỗi lượt">
                    <select id="quick-questions-select" value={questionsPerSession} onChange={handleQuestionsChange}>
                        <option value={5}>5 — Khởi động</option>
                        <option value={10}>10 — Dễ</option>
                        <option value={20}>20 — Bình thường</option>
                        <option value={30}>30 — Tập trung</option>
                        <option value={50}>50 — Khó</option>
                        <option value={100}>100 — Rất khó</option>
                        <option value={200}>200 — Thử thách</option>
                        <option value="auto">Toàn bộ</option>
                    </select>
                </div>
                <div className="quick-difficulty-selector" title="Độ khó câu hỏi">
                    <select id="quick-difficulty-select" value={difficulty} onChange={handleDifficultyChange}>
                        <option value="easy">Dễ (A1-A2)</option>
                        <option value="medium">Trung bình (B1-B2)</option>
                        <option value="hard">Khó (C1-C2)</option>
                        <option value="adaptive">Toàn bộ</option>
                    </select>
                </div>
                {(() => {
                    const zhBlocked = vocabLang === 'en' && zhLock.locked; // chỉ khoá chiều sang tiếng Trung
                    return (
                        <button
                            onClick={handleToggleVocabLang}
                            title={zhBlocked
                                ? `Học tiếng Trung mở ở Level ${zhLock.requiredLevel}`
                                : (vocabLang === 'en' ? 'Đang học Tiếng Anh — bấm để chuyển Tiếng Trung' : 'Đang học Tiếng Trung — bấm để chuyển Tiếng Anh')}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', border: '1px solid var(--border-color)', borderRadius: '20px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 500, cursor: zhBlocked ? 'not-allowed' : 'pointer', opacity: zhBlocked ? 0.55 : 1 }}
                        >
                            <FlagIcon lang={vocabLang} size={18} />
                            <span>{vocabLang === 'en' ? 'Tiếng Anh' : 'Tiếng Trung'}</span>
                            {zhBlocked && <i className="fas fa-lock" style={{ fontSize: 10, marginLeft: 2 }}></i>}
                        </button>
                    );
                })()}
            </div>
        </div>
    );
}
