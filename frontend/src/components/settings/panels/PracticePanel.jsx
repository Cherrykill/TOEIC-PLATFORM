// "Practice" panel. Presentational — state/handlers passed from SettingsScreen.
import { useState } from 'react';
import Toggle from './Toggle.jsx';
import { TRANSITION_MODES, getTransitionDefault } from '@components/practice/transitionDelay.js';

const GOAL_PRESETS = [10, 15, 30, 60, 90, 120, 180];
const TIME_OPTIONS = [500, 1000, 1500, 2000, 3000, 4000];
const fmtDelay = (ms) => `${ms / 1000}s`;

export default function PracticePanel({ s, handleQPS, updateSetting, handleDifficulty }) {
    const goalVal = s.dailyStudyGoalMin ?? 15;
    const [goalCustom, setGoalCustom] = useState(false);
    const isGoalCustom = goalCustom || !GOAL_PRESETS.includes(goalVal);

    // Thời gian chuyển câu (per-mode). Select 1 chọn chế độ ("all" = toàn bộ).
    const [tmMode, setTmMode] = useState('all');
    const qt = s.questionTransition || {};
    const effDelay = (id) => (typeof qt[id] === 'number' ? qt[id] : getTransitionDefault(id));
    const firstDelay = effDelay(TRANSITION_MODES[0].id);
    const allSame = TRANSITION_MODES.every(m => effDelay(m.id) === firstDelay) ? firstDelay : null;
    const tmVal = tmMode === 'all' ? (allSame ?? '') : effDelay(tmMode);
    const tmOptions = (typeof tmVal === 'number' && !TIME_OPTIONS.includes(tmVal))
        ? [tmVal, ...TIME_OPTIONS] : TIME_OPTIONS;
    const applyTmTime = (msStr) => {
        const ms = parseInt(msStr);
        if (!Number.isFinite(ms)) return;
        if (tmMode === 'all') {
            const next = {};
            TRANSITION_MODES.forEach(m => { next[m.id] = ms; });
            updateSetting('questionTransition', next);
        } else {
            updateSetting('questionTransition', { ...qt, [tmMode]: ms });
        }
    };

    return (
        <div className="settings-section">
            <h3>Cài đặt luyện tập</h3>
            <div className="setting-item">
                <label>Số câu mỗi lượt</label>
                <select value={s.questionsPerSession ?? 'auto'} onChange={e => handleQPS(e.target.value)}>
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
            <div className="setting-item">
                <div className="setting-info"><h4>Giới hạn thời gian</h4><p>Đếm ngược cho mỗi câu hỏi</p></div>
                <Toggle checked={s.timeLimitEnabled !== false} onChange={v => updateSetting('timeLimitEnabled', v)} />
            </div>
            <div className="setting-item">
                <label>Thời gian mỗi câu (giây)</label>
                <select value={s.timePerQuestion || 30} onChange={e => updateSetting('timePerQuestion', parseInt(e.target.value))}>
                    {[10, 15, 20, 30, 45, 60].map(n => <option key={n} value={n}>{n}s</option>)}
                </select>
            </div>
            <div className="setting-item">
                <div className="setting-info">
                    <h4>Tự động chuyển câu</h4>
                    <p>Tắt để tự bấm ← Trước / Tiếp → sau mỗi câu</p>
                </div>
                <Toggle checked={s.autoAdvance !== false} onChange={v => updateSetting('autoAdvance', v)} />
            </div>
            <div className="setting-item" style={{ display: s.autoAdvance !== false ? 'block' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div className="setting-info">
                        <h4>Thời gian chuyển câu</h4>
                        <p>Thời gian chờ trước khi sang câu tiếp (theo từng chế độ)</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <select value={tmMode} onChange={e => setTmMode(e.target.value)}>
                            <option value="all">Toàn bộ</option>
                            {TRANSITION_MODES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        <select value={tmVal} onChange={e => applyTmTime(e.target.value)}>
                            {tmVal === '' && <option value="" disabled>— chọn —</option>}
                            {tmOptions.map(ms => <option key={ms} value={ms}>{fmtDelay(ms)}</option>)}
                        </select>
                    </div>
                </div>
                <div style={{ marginTop: 10, borderTop: '1px solid var(--border-color)', paddingTop: 8 }}>
                    {TRANSITION_MODES.map(m => {
                        const isDef = typeof qt[m.id] !== 'number';
                        return (
                            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '3px 0', color: 'var(--text-secondary)' }}>
                                <span>{m.name}</span>
                                <span style={{ color: isDef ? 'var(--text-tertiary, #94a3b8)' : 'var(--primary-color)', fontWeight: 600 }}>
                                    {fmtDelay(effDelay(m.id))}{isDef ? ' (mặc định)' : ''}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="setting-item">
                <label>Mục tiêu thời gian học mỗi ngày</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                        value={isGoalCustom ? 'custom' : goalVal}
                        onChange={e => {
                            if (e.target.value === 'custom') { setGoalCustom(true); }
                            else { setGoalCustom(false); updateSetting('dailyStudyGoalMin', parseInt(e.target.value)); }
                        }}
                    >
                        <option value={10}>10 phút — Nhẹ nhàng</option>
                        <option value={15}>15 phút — Khuyên dùng ⭐</option>
                        <option value={30}>30 phút — Chăm chỉ</option>
                        <option value={60}>60 phút — Cường độ cao</option>
                        <option value={90}>90 phút — Bứt phá</option>
                        <option value={120}>120 phút — Cày cuốc</option>
                        <option value={180}>180 phút — Khổ luyện</option>
                        <option value="custom">⚙️ Tùy chỉnh…</option>
                    </select>
                    {isGoalCustom && (
                        <input
                            type="number"
                            min={5}
                            max={600}
                            value={goalVal}
                            style={{ width: 90 }}
                            placeholder="phút"
                            onChange={e => {
                                const v = Math.max(5, Math.min(600, parseInt(e.target.value) || 5));
                                updateSetting('dailyStudyGoalMin', v);
                            }}
                        />
                    )}
                    {isGoalCustom && <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>phút</span>}
                </div>
            </div>
            <div className="setting-item">
                <label>Độ khó</label>
                <select value={s.difficulty || 'adaptive'} onChange={e => handleDifficulty(e.target.value)}>
                    <option value="easy">Dễ (A1-A2)</option>
                    <option value="medium">Trung bình (B1-B2)</option>
                    <option value="hard">Khó (C1-C2)</option>
                    <option value="adaptive">Toàn bộ</option>
                </select>
            </div>
            <div className="setting-item">
                <div className="setting-info">
                    <h4>Ngôn ngữ từ vựng</h4>
                    <p>Chọn bộ từ vựng để luyện tập</p>
                </div>
                <select value={s.vocabLang || 'en'} onChange={e => {
                    const next = e.target.value;
                    updateSetting('vocabLang', next);
                    try {
                        localStorage.setItem('vocabLang', next);
                    } catch {}
                    window.location.reload();
                }}>
                    <option value="en">🇬🇧 Tiếng Anh (EN)</option>
                    <option value="zh">🇨🇳 Tiếng Trung (ZH)</option>
                </select>
            </div>
        </div>
    );
}
