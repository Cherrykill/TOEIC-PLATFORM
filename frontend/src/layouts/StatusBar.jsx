import { useState, useEffect, useCallback } from 'react';
import { useGame } from '@game/GameContext.jsx';
import { GameState } from '@game/state.js';
import { EventBus, GameEvents } from '@game/eventBus.js';

function computeSessionLabel() {
    const s = GameState.state?.settings || {};
    const count = s.questionsPerSession === 'auto' ? 'Toàn bộ' : (s.questionsPerSession || 20);
    let mode;
    if (s.randomQuestions === false) mode = 'Tuần tự';
    else if (s.selectedPart) mode = 'Ngẫu nhiên Part';
    else mode = 'Ngẫu nhiên';
    return `${count} câu • ${mode}`;
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

    const [vocabLang, setVocabLang] = useState(() => window.GameState?.state?.settings?.vocabLang || 'en');

    const handleToggleVocabLang = () => {
        const next = vocabLang === 'en' ? 'zh' : 'en';
        setVocabLang(next);
        if (window.GameState?.state?.settings) {
            window.GameState.state.settings.vocabLang = next;
            window.GameState.save?.();
        }
    };

    const xpPercent = user ? Math.min(100, Math.round((user.xp / (user.neededXp || 100)) * 100)) : 0;

    const handleQuestionsChange = (e) => {
        const val = e.target.value;
        setQuestionsPerSession(val);
        GameState.state.settings.questionsPerSession = val === 'auto' ? 'auto' : parseInt(val);
    };

    const handleDifficultyChange = (e) => {
        const val = e.target.value;
        setDifficulty(val);
        GameState.state.settings.difficulty = val;
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
                <div id="session-info-badge" className="session-info-badge">
                    <i className="fas fa-list-ol"></i>
                    <span id="session-info-text">{sessionLabel}</span>
                </div>
                <div className="status-bar-divider"></div>
                <div className="resource energy-display">
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
                    <span id="current-xp">{user?.xp || 0}</span>/
                    <span id="needed-xp">{user?.neededXp || 100}</span> XP
                </span>
            </div>

            <div className="status-bar-right">
                <div className="quick-difficulty-selector" title="Số câu hỏi mỗi lượt">
                    <select id="quick-questions-select" value={questionsPerSession} onChange={handleQuestionsChange}>
                        {[5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200].map(n => (
                            <option key={n} value={n}>{n} câu</option>
                        ))}
                        <option value="auto">Toàn bộ</option>
                    </select>
                </div>
                <div className="quick-difficulty-selector" title="Độ khó câu hỏi">
                    <select id="quick-difficulty-select" value={difficulty} onChange={handleDifficultyChange}>
                        <option value="easy">Dễ (A1-A2)</option>
                        <option value="medium">TB (B1-B2)</option>
                        <option value="hard">Khó (C1-C2)</option>
                        <option value="adaptive">Toàn bộ</option>
                    </select>
                </div>
                <button
                    onClick={handleToggleVocabLang}
                    title={vocabLang === 'en' ? 'Đang học Tiếng Anh — bấm để chuyển Tiếng Trung' : 'Đang học Tiếng Trung — bấm để chuyển Tiếng Anh'}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
                >
                    <span>{vocabLang === 'en' ? '🇬🇧' : '🇨🇳'}</span>
                    <span>{vocabLang === 'en' ? 'Tiếng Anh' : 'Tiếng Trung'}</span>
                </button>
            </div>
        </div>
    );
}
