// "Sound" panel. Presentational — state/handlers passed from SettingsScreen.
// JSX moved verbatim (including the practiceSoundEnabled localStorage write).
import Toggle from './Toggle.jsx';

export default function SoundPanel({
    s,
    updateSetting,
    selectedVoice,
    handleVoiceChange,
    voices,
    handleTestVoice,
    speechRate,
    handleSpeechRate,
}) {
    return (
        <>
            <div className="settings-section">
                <h3>Âm thanh</h3>
                <div className="setting-item">
                    <div className="setting-info"><h4>Hiệu ứng âm thanh</h4><p>Bật/tắt âm thanh khi trả lời</p></div>
                    <Toggle checked={s.soundEnabled !== false} onChange={v => updateSetting('soundEnabled', v)} />
                </div>
                <div className="setting-item">
                    <div className="setting-info"><h4>Âm nhạc luyện tập</h4><p>Nhạc nền khi luyện tập</p></div>
                    <Toggle checked={s.practiceSoundEnabled !== false} onChange={v => {
                        updateSetting('practiceSoundEnabled', v);
                        localStorage.setItem('practiceSoundEnabled', JSON.stringify(v));
                    }} />
                </div>
                <div className="setting-item">
                    <div className="setting-info"><h4>Phát âm tự động</h4><p>Tự động phát âm từ mới</p></div>
                    <Toggle checked={s.autoPronunciation === true} onChange={v => updateSetting('autoPronunciation', v)} />
                </div>
            </div>

            <div className="settings-section">
                <h3>Giọng đọc</h3>
                <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                    <div className="setting-info"><h4>Giọng phát âm</h4><p>Chọn giọng đọc tiếng Anh</p></div>
                    <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                        <select value={selectedVoice} onChange={e => handleVoiceChange(e.target.value)} style={{ flex: 1 }}>
                            <optgroup label="🇬🇧 Giọng Neural TOEIC (Tiếng Anh)">
                                <option value="__gtts_random__">TOEIC Tự động — Random 4 giọng</option>
                                <option value="__gtts_us__">Aria — American (US)</option>
                                <option value="__gtts_uk__">Sonia — British (UK)</option>
                                <option value="__gtts_au__">Natasha — Australian (AU)</option>
                                <option value="__gtts_ca__">Clara — Canadian (CA)</option>
                            </optgroup>
                            <optgroup label="🇨🇳 Giọng Neural Tiếng Trung">
                                <option value="__gtts_zh_random__">Tự động — Random 3 giọng TQ</option>
                                <option value="__gtts_zh_xiaoxiao__">Xiaoxiao — Nữ tự nhiên (CN)</option>
                                <option value="__gtts_zh_yunxi__">Yunxi — Nam trẻ (CN)</option>
                                <option value="__gtts_zh_xiaoyi__">Xiaoyi — Nữ trẻ (CN)</option>
                                <option value="__gtts_zh_tw__">Hsiao-Chen — Đài Loan (TW)</option>
                            </optgroup>
                        </select>
                        <button className="btn btn-secondary btn-sm" onClick={handleTestVoice}>
                            <i className="fas fa-volume-up"></i> Thử
                        </button>
                    </div>
                </div>
                <div className="setting-item">
                    <div className="setting-info"><h4>Tốc độ phát âm</h4><p>{(speechRate / 100).toFixed(1)}x</p></div>
                    <input type="range" min="50" max="150" step="10" value={speechRate}
                        onChange={e => handleSpeechRate(parseInt(e.target.value))}
                        className="volume-slider" style={{ width: 140 }} />
                </div>
            </div>
        </>
    );
}
