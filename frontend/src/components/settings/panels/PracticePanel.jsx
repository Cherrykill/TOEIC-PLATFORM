// "Practice" panel. Presentational — state/handlers passed from SettingsScreen.
import Toggle from './Toggle.jsx';

export default function PracticePanel({ s, handleQPS, updateSetting, handleDifficulty }) {
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
