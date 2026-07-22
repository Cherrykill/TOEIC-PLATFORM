// "Practice" panel. Presentational — state/handlers passed from SettingsScreen.
import { useState } from 'react';
import Toggle from './Toggle.jsx';
import { QUESTION_TIME_MODES, getQuestionTimeDefault } from '@components/practice/questionTime.js';
import { TOEIC_PART_TIMES, getToeicPartTimeDefault } from '@components/toeic/toeicPartTime.js';

const GOAL_PRESETS = [10, 15, 30, 60, 90, 120, 180];
const SEC_OPTIONS = [10, 15, 20, 25, 30, 45, 60, 90, 120];

// Thụt lề + vạch trái cho cài đặt PHỤ THUỘC một toggle phía trên → nhìn ra quan hệ cha–con.
const NESTED = { paddingLeft: 14, borderLeft: '2px solid var(--border-color)' };

export default function PracticePanel({ s, handleQPS, updateSetting, handleDifficulty }) {
    const goalVal = s.dailyStudyGoalMin ?? 15;
    const [goalCustom, setGoalCustom] = useState(false);
    const isGoalCustom = goalCustom || !GOAL_PRESETS.includes(goalVal);

    // Thời gian mỗi câu (per-mode). Select 1 chọn chế độ ("all" = toàn bộ).
    // Fallback: giá trị cũ timePerQuestion (dùng chung) nếu chế độ chưa có riêng.
    const [tmMode, setTmMode] = useState('all');
    const qt = s.questionTime || {};
    const legacy = (typeof s.timePerQuestion === 'number' && s.timePerQuestion > 0) ? s.timePerQuestion : null;
    const effSec = (id) => (typeof qt[id] === 'number' ? qt[id] : (legacy ?? getQuestionTimeDefault(id)));
    const firstSec = effSec(QUESTION_TIME_MODES[0].id);
    const allSame = QUESTION_TIME_MODES.every(m => effSec(m.id) === firstSec) ? firstSec : null;
    const tmVal = tmMode === 'all' ? (allSame ?? '') : effSec(tmMode);
    const tmOptions = (typeof tmVal === 'number' && !SEC_OPTIONS.includes(tmVal))
        ? [tmVal, ...SEC_OPTIONS].sort((a, b) => a - b) : SEC_OPTIONS;
    const applyTmTime = (secStr) => {
        const sec = parseInt(secStr);
        if (!Number.isFinite(sec)) return;
        if (tmMode === 'all') {
            const next = {};
            QUESTION_TIME_MODES.forEach(m => { next[m.id] = sec; });
            updateSetting('questionTime', next);
        } else {
            // Ghi kèm giá trị đang hiệu lực của các chế độ khác để không rơi về mặc định.
            const base = {};
            QUESTION_TIME_MODES.forEach(m => { base[m.id] = effSec(m.id); });
            updateSetting('questionTime', { ...base, [tmMode]: sec });
        }
    };

    // ── Thời gian mỗi câu cho bài thi TOEIC (theo Part) ──────────────────────
    const [tpMode, setTpMode] = useState('all');
    const tp = s.toeicPartTime || {};
    const effPart = (id) => (typeof tp[id] === 'number' ? tp[id] : getToeicPartTimeDefault(id));
    const firstPart = effPart(TOEIC_PART_TIMES[0].id);
    const partAllSame = TOEIC_PART_TIMES.every(p => effPart(p.id) === firstPart) ? firstPart : null;
    const tpVal = tpMode === 'all' ? (partAllSame ?? '') : effPart(Number(tpMode));
    const tpOptions = (typeof tpVal === 'number' && !SEC_OPTIONS.includes(tpVal))
        ? [tpVal, ...SEC_OPTIONS].sort((a, b) => a - b) : SEC_OPTIONS;
    const applyPartTime = (secStr) => {
        const sec = parseInt(secStr);
        if (!Number.isFinite(sec)) return;
        const base = {};
        TOEIC_PART_TIMES.forEach(p => { base[p.id] = effPart(p.id); });
        if (tpMode === 'all') TOEIC_PART_TIMES.forEach(p => { base[p.id] = sec; });
        else base[Number(tpMode)] = sec;
        updateSetting('toeicPartTime', base);
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
            {/* Phụ thuộc "Giới hạn thời gian" — đặt riêng cho từng chế độ. */}
            {s.timeLimitEnabled !== false && (
                <div className="setting-item" style={{ display: 'block', ...NESTED }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div className="setting-info">
                            <h4>Thời gian mỗi câu</h4>
                            <p>Chọn chế độ (hoặc “Toàn bộ”) rồi đặt số giây cho mỗi câu hỏi</p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <select value={tmMode} onChange={e => setTmMode(e.target.value)} title="Áp dụng cho chế độ nào">
                                <option value="all">Toàn bộ</option>
                                {QUESTION_TIME_MODES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                            <select value={tmVal} onChange={e => applyTmTime(e.target.value)} title="Số giây mỗi câu">
                                {/* Rỗng = các chế độ đang KHÁC nhau, không phải "chưa đặt". */}
                                {tmVal === '' && <option value="" disabled>— đang khác nhau —</option>}
                                {tmOptions.map(sec => <option key={sec} value={sec}>{sec}s</option>)}
                            </select>
                        </div>
                    </div>
                    <div style={{ marginTop: 10, borderTop: '1px solid var(--border-color)', paddingTop: 8 }}>
                        {QUESTION_TIME_MODES.map(m => {
                            const isDef = typeof qt[m.id] !== 'number';
                            return (
                                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '3px 0', color: 'var(--text-secondary)' }}>
                                    <span>{m.name}</span>
                                    <span style={{ color: isDef ? 'var(--text-tertiary, #94a3b8)' : 'var(--primary-color)', fontWeight: 600 }}>
                                        {effSec(m.id)}s{isDef ? ' (mặc định)' : ''}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            <div className="setting-item">
                <div className="setting-info">
                    <h4>Tự động chuyển câu</h4>
                    <p>Tắt để tự bấm ← Trước / Tiếp → sau mỗi câu</p>
                </div>
                <Toggle checked={s.autoAdvance !== false} onChange={v => updateSetting('autoAdvance', v)} />
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

            {/* ── Bài thi TOEIC ─────────────────────────────────────────────── */}
            <h3 style={{ marginTop: 24 }}>Bài thi TOEIC</h3>
            <div className="setting-item">
                <div className="setting-info">
                    <h4>Đếm ngược từng câu</h4>
                    <p>Hết giờ tự chuyển sang câu kế. Đồng hồ tổng cả bài vẫn chạy song song</p>
                </div>
                <Toggle
                    checked={s.toeicPerQuestionTimer === true}
                    onChange={v => updateSetting('toeicPerQuestionTimer', v)}
                />
            </div>
            {s.toeicPerQuestionTimer === true && (
                <div className="setting-item" style={{ display: 'block', ...NESTED }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div className="setting-info">
                            <h4>Thời gian mỗi câu (theo Part)</h4>
                            <p>Part 3/4/6/7 hiện cả nhóm một màn → thời gian màn đó nhân theo số câu</p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <select value={tpMode} onChange={e => setTpMode(e.target.value)} title="Áp dụng cho Part nào">
                                <option value="all">Toàn bộ</option>
                                {TOEIC_PART_TIMES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <select value={tpVal} onChange={e => applyPartTime(e.target.value)} title="Số giây mỗi câu">
                                {tpVal === '' && <option value="" disabled>— đang khác nhau —</option>}
                                {tpOptions.map(sec => <option key={sec} value={sec}>{sec}s</option>)}
                            </select>
                        </div>
                    </div>
                    <div style={{ marginTop: 10, borderTop: '1px solid var(--border-color)', paddingTop: 8 }}>
                        {TOEIC_PART_TIMES.map(p => {
                            const isDef = typeof tp[p.id] !== 'number';
                            return (
                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '3px 0', color: 'var(--text-secondary)' }}>
                                    <span>{p.name}</span>
                                    <span style={{ color: isDef ? 'var(--text-tertiary, #94a3b8)' : 'var(--primary-color)', fontWeight: 600 }}>
                                        {effPart(p.id)}s{isDef ? ' (mặc định)' : ''}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
