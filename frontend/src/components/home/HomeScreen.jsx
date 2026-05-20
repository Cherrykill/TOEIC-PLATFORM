import { Fragment, useState, useEffect, useCallback } from 'react';
import { useGame } from '@game/GameContext.jsx';
import { GameState } from '@game/state.js';
import { EventBus, GameEvents } from '@game/eventBus.js';
import { PracticeManager } from '@components/practice/practiceManager.js';
import { TopicSelector } from '@components/vocab/topic/topicSelector.js';
import { QuestsAPI } from '@api/quests.js';
import { Quest } from '@components/quest/quest.js';

const gameModes = [
    { group: 'Học & Nhận diện từ', icon: 'fa-book-open', modes: [
        { mode: 'flashcard', icon: 'fa-layer-group', label: 'Flashcard', desc: 'Học từ vựng theo thẻ ghi nhớ', cost: 8, color: '#10b981, #059669' },
        { mode: 'multiple-choice', icon: 'fa-circle-check', label: 'Trắc nghiệm', desc: 'Chọn nghĩa đúng của từ', cost: 10, color: '#10b981, #059669' },
        { mode: 'matching', icon: 'fa-link', label: 'Nối từ', desc: 'Nối từ với nghĩa tương ứng', cost: 10, color: '#10b981, #059669' },
        { mode: 'word-type-check', icon: 'fa-tag', label: 'Từ loại', desc: 'Xác định từ loại của từ', cost: 10, color: '#10b981, #059669' },
    ]},
    { group: 'Nghe & Phát âm', icon: 'fa-headphones', modes: [
        { mode: 'listening', icon: 'fa-headphones', label: 'Nghe và chọn', desc: 'Nghe từ, chọn từ đúng trong 4 lựa chọn', cost: 12, color: '#3b82f6, #2563eb' },
        { mode: 'pronunciation', icon: 'fa-microphone', label: 'Phát âm', desc: 'Nói đúng từ tiếng Anh để ghi điểm', cost: 15, color: '#3b82f6, #2563eb' },
        { mode: 'dictation', icon: 'fa-keyboard', label: 'Chép chính tả', desc: 'Nghe từ và gõ lại chính xác tiếng Anh', cost: 15, color: '#3b82f6, #2563eb' },
        { mode: 'sentence-listening', icon: 'fa-ear-listen', label: 'Nghe chuỗi từ', desc: 'Nghe 3 từ đọc liên tiếp, chọn đúng trong lưới 8 từ', cost: 12, color: '#3b82f6, #2563eb' },
    ]},
    { group: 'Đọc & Viết', icon: 'fa-pen-nib', modes: [
        { mode: 'fill-blank', icon: 'fa-pen', label: 'Điền từ', desc: 'Điền từ tiếng Anh vào chỗ trống', cost: 15, color: '#f59e0b, #d97706' },
        { mode: 'example-fill-blank', icon: 'fa-pen-to-square', label: 'Điền vào câu', desc: 'Điền từ đúng vào câu ví dụ', cost: 12, color: '#f59e0b, #d97706' },
        { mode: 'sentence-builder', icon: 'fa-puzzle-piece', label: 'Xếp câu', desc: 'Sắp xếp cụm từ thành câu hoàn chỉnh', cost: 15, color: '#f59e0b, #d97706' },
        { mode: 'phonetic-quiz', icon: 'fa-spell-check', label: 'Đọc phiên âm', desc: 'Nhìn ký hiệu IPA, tìm từ tiếng Anh tương ứng', cost: 12, color: '#f59e0b, #d97706' },
    ]},
    { group: 'Nâng cao & Thử thách', icon: 'fa-brain', modes: [
        { mode: 'context-learning', icon: 'fa-book-reader', label: 'Hiểu qua câu', desc: 'Đọc câu ví dụ, suy luận nghĩa tiếng Việt', cost: 10, color: '#8b5cf6, #7c3aed' },
        { mode: 'synonym-check', icon: 'fa-equals', label: 'Từ đồng nghĩa', desc: 'Tìm từ đồng nghĩa với từ cho sẵn', cost: 10, color: '#8b5cf6, #7c3aed' },
        { mode: 'speed-quiz', icon: 'fa-clock', label: 'Tốc độ', desc: 'Trả lời nhanh nhất trong giới hạn thời gian', cost: 20, color: '#8b5cf6, #7c3aed' },
        { mode: 'review-mistakes', icon: 'fa-repeat', label: 'Ôn lại từ sai', desc: 'Luyện lại các từ đã làm sai', cost: 10, color: '#8b5cf6, #7c3aed', special: true },
    ]},
];

function getTimeUntilMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight - now;
    const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

export default function HomeScreen({ active }) {
    const { showScreen, streak, syncFromState } = useGame();
    const [quests, setQuests] = useState([]);
    const [timer, setTimer] = useState(getTimeUntilMidnight());
    const [stats, setStats] = useState({});
    const [wrongWordsCount, setWrongWordsCount] = useState(0);

    const loadLocalData = useCallback(() => {
        const s = GameState.state;
        // Quest.init đã nạp 4 loại vào _cache; lấy thẳng từ đó (đầy đủ 5
        // daily quest sau Phase A). Fallback GameState legacy nếu rỗng.
        const cached = Quest.getQuests?.('daily') || [];
        setQuests(cached.length ? cached : (s.quests?.daily || []));
        setWrongWordsCount(s.progress?.wrongWords?.length || 0);
        setStats(GameState.getStatistics?.() || {});
    }, []);

    useEffect(() => {
        if (active) loadLocalData();
    }, [active, loadLocalData]);

    useEffect(() => {
        const unsub1 = EventBus.on(GameEvents.QUEST_UPDATED, loadLocalData);
        const unsub2 = EventBus.on(GameEvents.PRACTICE_REQUESTED, ({ mode }) => PracticeManager.start(mode));
        return () => { unsub1(); unsub2(); };
    }, [loadLocalData]);

    useEffect(() => {
        if (!active) return;
        setTimer(getTimeUntilMidnight());
        const id = setInterval(() => setTimer(getTimeUntilMidnight()), 1000);
        return () => clearInterval(id);
    }, [active]);

    const handleModeClick = (mode) => {
        // Chưa chọn đề → mở popup chọn đề, nhớ mode để tự start sau khi chọn
        if (!TopicSelector.getCurrentTopic()) {
            EventBus.emit(GameEvents.TOPIC_MODAL_REQUESTED, { pendingMode: mode });
            return;
        }
        PracticeManager.start(mode);
    };

    const handleClaimQuest = async (quest) => {
        const code = quest.code || quest.id;
        if (!code || !quest.completed || quest.claimedAt || quest.claimed) return;

        // Backend expect { type, code } — bug cũ gửi { questId } → 400.
        // Đi qua Quest.claimReward để có optimistic claimedAt + flush sync
        // (khớp với QuestScreen).
        let rewards = null;
        if (Quest?.claimReward) {
            rewards = await Quest.claimReward('daily', code);
            if (rewards != null) {
                GameState.creditServerRewards(rewards);
                loadLocalData();
                syncFromState();
                return;
            }
        }
        const res = await QuestsAPI.claim({ type: 'daily', code });
        if (res.success) {
            GameState.creditServerRewards(res.rewards || {});
            loadLocalData();
            syncFromState();
        }
    };

    return (
        <div id="home-screen" className={`screen ${active ? 'active' : ''}`}>
            <div className="streak-card">
                <div className="streak-flame">
                    <i className="fas fa-fire"></i>
                </div>
                <div className="streak-info">
                    <h3><span id="streak-count">{streak.current}</span> ngày liên tục</h3>
                    <p>Học mỗi ngày để giữ streak!</p>
                </div>
            </div>

            <section className="quests-section">
                <div className="section-header">
                    <h2><i className="fas fa-tasks"></i> Nhiệm vụ hàng ngày</h2>
                    <span id="quest-timer" className="timer">{timer}</span>
                </div>
                <div id="daily-quests" className="quests-container">
                    {quests.length === 0 ? (
                        <div className="empty-state"><i className="fas fa-tasks"></i><p>Không có nhiệm vụ nào</p></div>
                    ) : quests.map((quest, i) => {
                        const progress = quest.progress ?? quest.current ?? 0;
                        const target = quest.target || 1;
                        const pct = Math.min(100, Math.round((progress / target) * 100));
                        const isCompleted = quest.completed;
                        const isClaimed = !!(quest.claimedAt || quest.claimed);
                        const name = (quest.name || '').replace('{target}', target);
                        return (
                            <div key={quest.code || quest.id || i} className={`quest-card${isCompleted ? ' completed' : ''}${isClaimed ? ' claimed' : ''}`} data-code={quest.code}>
                                <div className="quest-header">
                                    <div className="quest-title">
                                        <div className="quest-icon">{quest.icon || '🎯'}</div>
                                        <span>{name}</span>
                                    </div>
                                    <div className="quest-reward">
                                        {quest.rewardCoins > 0 && <span><i className="fas fa-coins"></i> {quest.rewardCoins}</span>}
                                        {quest.rewardXp > 0 && <span><i className="fas fa-star"></i> {quest.rewardXp} XP</span>}
                                        {quest.rewardGems > 0 && <span><i className="fas fa-gem"></i> {quest.rewardGems}</span>}
                                        {!quest.rewardXp && quest.reward?.xp > 0 && <span><i className="fas fa-star"></i> {quest.reward.xp} XP</span>}
                                    </div>
                                </div>
                                {quest.description && <div className="quest-description">{quest.description}</div>}
                                <div className="quest-progress">
                                    <div className="quest-progress-bar">
                                        <div className="quest-progress-fill" style={{ width: `${pct}%` }}></div>
                                    </div>
                                    <div className="quest-progress-text">{progress} / {target}</div>
                                </div>
                                {isCompleted && !isClaimed && (
                                    <button className="quest-claim-btn btn btn-primary btn-sm" onClick={() => handleClaimQuest(quest)}>
                                        Nhận thưởng
                                    </button>
                                )}
                                {isClaimed && (
                                    <div className="quest-claimed-badge"><i className="fas fa-check-circle"></i> Đã nhận</div>
                                )}
                                {!isCompleted && (
                                    <div className="quest-pending-badge"><i className="fas fa-hourglass-half"></i> Chưa đạt</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="game-modes-section">
                <h2><i className="fas fa-gamepad"></i> Chọn chế độ chơi</h2>
                <div className="game-modes-grid">
                    {gameModes.map(group => (
                        <Fragment key={group.group}>
                            <div className="mode-group-label">
                                <i className={`fas ${group.icon}`}></i> {group.group}
                            </div>
                            {group.modes.map(m => (
                                <div
                                    key={m.mode}
                                    className="game-mode-card"
                                    data-mode={m.mode}
                                    style={m.special ? { border: '2px solid #8b5cf6' } : {}}
                                    onClick={() => handleModeClick(m.mode)}
                                >
                                    <div className="mode-icon" style={{ background: `linear-gradient(135deg, ${m.color})` }}>
                                        <i className={`fas ${m.icon}`}></i>
                                    </div>
                                    <h3>{m.label}</h3>
                                    <p>{m.desc}</p>
                                    <div className="mode-cost">
                                        <i className="fas fa-bolt"></i> {m.cost}
                                    </div>
                                    {m.mode === 'review-mistakes' && (
                                        <div className="wrong-words-count" style={{ marginTop: 8, color: '#a855f7', fontWeight: 'bold', fontSize: '0.9em' }}>
                                            <i className="fas fa-exclamation-circle"></i> <span>{wrongWordsCount}</span> từ cần ôn
                                        </div>
                                    )}
                                </div>
                            ))}
                        </Fragment>
                    ))}
                </div>
            </section>

            <section className="stats-section">
                <h2><i className="fas fa-chart-line"></i> Thống kê của bạn</h2>
                <div className="stats-grid">
                    <div className="stat-card">
                        <i className="fas fa-book"></i>
                        <div className="stat-value">{stats.wordsLearned || 0}</div>
                        <div className="stat-label">Từ đã học</div>
                    </div>
                    <div className="stat-card">
                        <i className="fas fa-trophy"></i>
                        <div className="stat-value">{stats.totalXp || 0}</div>
                        <div className="stat-label">Tổng XP</div>
                    </div>
                    <div className="stat-card">
                        <i className="fas fa-chart-line"></i>
                        <div className="stat-value">{stats.accuracy || 0}%</div>
                        <div className="stat-label">Độ chính xác</div>
                    </div>
                    <div className="stat-card">
                        <i className="fas fa-crown"></i>
                        <div className="stat-value">-</div>
                        <div className="stat-label">Xếp hạng</div>
                    </div>
                </div>
            </section>
        </div>
    );
}
