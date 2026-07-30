// "Practice" panel. Presentational — state/handlers passed from SettingsScreen.
import { useState } from 'react';
import Toggle from './Toggle.jsx';
import { QUESTION_TIME_MODES, getQuestionTimeDefault } from '@components/practice/questionTime.js';

const GOAL_PRESETS = [10, 15, 30, 60, 90, 120, 180];
const SEC_OPTIONS = [10, 15, 20, 25, 30, 45, 60, 90, 120];
const TARGET_PRESETS = [0, 450, 600, 700, 800, 900];

/** Điểm TOEIC hợp lệ: bội của 5, trong 10–990. */
const clampTarget = (n) => Math.max(10, Math.min(990, Math.round(n / 5) * 5));

/**
 * Ô nhập số CHỐT KHI RỜI Ô (blur/Enter), không chốt theo từng phím.
 *
 * Kẹp giá trị ngay trong onChange thì mỗi phím bấm lại bị làm tròn/kẹp rồi ghi
 * ngược vào ô: gõ "700" sẽ chạy 7→10, 100→100, 1000→990. Người dùng thấy số
 * nhảy loạn mà không hiểu vì sao. Giữ bản nháp dạng CHUỖI trong lúc gõ, chỉ quy
 * về số hợp lệ khi người ta gõ xong.
 */
function CommitNumberInput({ value, onCommit, clamp, ...rest }) {
    const [draft, setDraft] = useState(null);   // null = không gõ dở
    // `??` chứ không `||`: chuỗi rỗng (vừa xoá sạch ô) là bản nháp hợp lệ.
    const shown = draft ?? (value ? String(value) : '');

    const commit = () => {
        if (draft === null) return;
        const raw = parseInt(draft, 10);
        onCommit(Number.isFinite(raw) ? clamp(raw) : 0);  // xoá trắng = bỏ đặt
        setDraft(null);
    };

    return (
        <input
            {...rest}
            type="number"
            value={shown}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        />
    );
}

// Thụt lề + vạch trái cho cài đặt PHỤ THUỘC một toggle phía trên → nhìn ra quan hệ cha–con.
const NESTED = { paddingLeft: 14, borderLeft: '2px solid var(--border-color)' };

export default function PracticePanel({ s, handleQPS, updateSetting, handleDifficulty }) {
    const goalVal = s.dailyStudyGoalMin ?? 15;
    const [goalCustom, setGoalCustom] = useState(false);
    const isGoalCustom = goalCustom || !GOAL_PRESETS.includes(goalVal);

    const targetVal = s.toeicTargetScore ?? 0;
    const [targetCustom, setTargetCustom] = useState(false);
    const isTargetCustom = targetCustom || !TARGET_PRESETS.includes(targetVal);

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

    // ── Thời gian tổng tùy chỉnh cho TỪNG Part Đọc (phút) ────────────────────
    // Mức "Tùy chỉnh" ở popup. Mỗi Part một ngân sách riêng vì độ dài mỗi câu
    // khác nhau; hệ thống chia ngân sách đó ra giây/câu. Part Nghe do audio dẫn.
    const READ_PARTS = [
        { id: 5, name: 'Part 5 — Hoàn thành câu', def: 15 },
        { id: 6, name: 'Part 6 — Hoàn thành đoạn', def: 8 },
        { id: 7, name: 'Part 7 — Đọc hiểu', def: 36 },
    ];
    const partMin = s.toeicCustomPartMin || {};
    const setPartMin = (id, val) => {
        const v = Math.max(1, Math.min(180, parseInt(val) || 1));
        updateSetting('toeicCustomPartMin', { ...partMin, [id]: v });
    };
    // Phần Đọc của TOEIC thật chỉ có 75' cho cả Part 5·6·7 — đặt quá mức đó là
    // luyện sai nhịp, đến khi thi thật sẽ không kịp giờ. Chỉ CẢNH BÁO chứ không
    // chặn: có người muốn tập chậm lúc mới bắt đầu.
    const READING_BUDGET_MIN = 75;
    const partMinValue = (p) => (typeof partMin[p.id] === 'number' ? partMin[p.id] : p.def);
    const totalReadMin = READ_PARTS.reduce((sum, p) => sum + partMinValue(p), 0);
    const overBudget = totalReadMin - READING_BUDGET_MIN;

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
                        // Cùng lỗi "số nhảy loạn" như ô mục tiêu điểm: gõ "30" từng
                        // bị kẹp thành 5 rồi 50. Chốt khi rời ô.
                        <CommitNumberInput
                            min={5}
                            max={600}
                            value={goalVal}
                            clamp={v => Math.max(5, Math.min(600, v))}
                            onCommit={v => updateSetting('dailyStudyGoalMin', v || 15)}
                            style={{ width: 90 }}
                            placeholder="phút"
                        />
                    )}
                    {isGoalCustom && <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>phút</span>}
                </div>
            </div>
            {/* Mục tiêu điểm TOEIC — không chỉ để trưng: màn Phân tích lấy con số
                này đối chiếu với điểm ước lượng từ các bài đã làm, ra khoảng cách
                còn thiếu. 0 = chưa đặt (không hiện đối chiếu). */}
            <div className="setting-item">
                <div className="setting-info">
                    <h4>Mục tiêu điểm TOEIC</h4>
                    <p>Phân tích sẽ đối chiếu điểm ước lượng của bạn với mốc này</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                        value={isTargetCustom ? 'custom' : targetVal}
                        onChange={e => {
                            if (e.target.value === 'custom') { setTargetCustom(true); }
                            else { setTargetCustom(false); updateSetting('toeicTargetScore', parseInt(e.target.value)); }
                        }}
                    >
                        <option value={0}>Chưa đặt</option>
                        <option value={450}>450 — Đầu ra phổ biến</option>
                        <option value={600}>600 — Tuyển dụng cơ bản ⭐</option>
                        <option value={700}>700 — Khá</option>
                        <option value={800}>800 — Giỏi</option>
                        <option value={900}>900 — Xuất sắc</option>
                        <option value="custom">⚙️ Tùy chỉnh…</option>
                    </select>
                    {isTargetCustom && (
                        // Điểm TOEIC là bội của 5, thang 10–990 — nhưng chỉ ép về
                        // mốc hợp lệ KHI GÕ XONG, không phải sau mỗi phím.
                        <CommitNumberInput
                            min={10}
                            max={990}
                            step={5}
                            value={targetVal}
                            clamp={clampTarget}
                            onCommit={v => updateSetting('toeicTargetScore', v)}
                            style={{ width: 90 }}
                            placeholder="điểm"
                        />
                    )}
                    {isTargetCustom && <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>/ 990</span>}
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
                    <h4>Giới hạn giờ từng câu (Part Đọc)</h4>
                    <p>Thanh nhịp trên mỗi câu Part 5·6·7 — chia từ tổng thời gian. Part Nghe do audio dẫn, không đếm</p>
                </div>
                <Toggle
                    checked={s.toeicPerQuestionTimer === true}
                    onChange={v => updateSetting('toeicPerQuestionTimer', v)}
                />
            </div>
            {s.toeicPerQuestionTimer === true && (
                <>
                    <div className="setting-item" style={NESTED}>
                        <div className="setting-info">
                            <h4>Tự động chuyển câu</h4>
                            <p>Hết giờ một câu thì tự sang câu kế. Tắt thì đồng hồ dừng ở 0, bạn tự bấm Tiếp</p>
                        </div>
                        <Toggle
                            checked={s.toeicAutoAdvance !== false}
                            onChange={v => updateSetting('toeicAutoAdvance', v)}
                        />
                    </div>

                    {s.toeicAutoAdvance !== false && (
                        <div className="setting-item" style={NESTED}>
                            <div className="setting-info">
                                <h4>Thời gian chuyển câu</h4>
                                <p>Khoảng nghỉ giữa hai câu — đã được trừ khỏi thời gian mỗi câu</p>
                            </div>
                            <select
                                value={typeof s.toeicTransition === 'number' ? s.toeicTransition : 1}
                                onChange={e => updateSetting('toeicTransition', parseInt(e.target.value))}
                            >
                                {[0, 1, 2, 3, 5].map(sec => (
                                    <option key={sec} value={sec}>{sec === 0 ? 'Không nghỉ' : `${sec}s`}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="setting-item" style={{ display: 'block', ...NESTED }}>
                        <div className="setting-info" style={{ marginBottom: 8 }}>
                            <h4>Thời gian tổng tùy chỉnh — theo Part Đọc</h4>
                            <p>Mức "Tùy chỉnh" ở popup. Mỗi Part một ngân sách riêng (chia ra giây/câu); Part Nghe do audio dẫn</p>
                        </div>
                        {READ_PARTS.map(p => {
                            const val = partMinValue(p);
                            return (
                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
                                    <span style={{ fontSize: '0.9rem' }}>{p.name}</span>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                        <input
                                            type="number" min="1" max="180"
                                            value={val}
                                            onChange={e => setPartMin(p.id, e.target.value)}
                                            style={{ width: 76, textAlign: 'right' }}
                                        />
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>phút</span>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Tổng 3 Part Đọc so với 75' của đề thi thật */}
                        <div
                            style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                marginTop: 10, paddingTop: 10,
                                borderTop: '1px solid var(--border-color, rgba(0,0,0,.08))',
                                fontSize: '0.9rem', fontWeight: 600,
                                color: overBudget > 0 ? 'var(--danger-color, #dc2626)' : 'var(--text-primary)',
                            }}
                        >
                            <span>Tổng phần Đọc</span>
                            <span>{totalReadMin} / {READING_BUDGET_MIN} phút</span>
                        </div>

                        {overBudget > 0 && (
                            <p
                                style={{
                                    margin: '8px 0 0', fontSize: '0.85rem', lineHeight: 1.5,
                                    color: 'var(--danger-color, #dc2626)',
                                }}
                            >
                                <i className="fas fa-triangle-exclamation"></i>{' '}
                                Vượt <strong>{overBudget} phút</strong> so với đề thi thật (Part 5·6·7 chỉ có {READING_BUDGET_MIN} phút).
                                Hãy giảm bớt thời gian một trong các Part để luyện đúng nhịp thi.
                            </p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
