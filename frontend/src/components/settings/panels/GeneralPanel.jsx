// "General" panel: theme mode, reverse mode, color theme.
// Presentational — state/handlers passed from SettingsScreen. JSX verbatim.
import Toggle from './Toggle.jsx';

const COLOR_PRESETS = [
    { name: 'Hồng đỏ',    primary: '#E11D48', secondary: '#F97316' },
    { name: 'Tím hồng',   primary: '#7C3AED', secondary: '#EC4899' },
    { name: 'Xanh biển',  primary: '#0EA5E9', secondary: '#6366F1' },
    { name: 'Xanh lá',    primary: '#16A34A', secondary: '#0D9488' },
    { name: 'Cam vàng',   primary: '#F97316', secondary: '#EAB308' },
    { name: 'Tím đậm',    primary: '#9333EA', secondary: '#C026D3' },
    { name: 'Ngọc lam',   primary: '#0D9488', secondary: '#06B6D4' },
    { name: 'Đậm xanh',   primary: '#1D4ED8', secondary: '#7C3AED' },
];

export default function GeneralPanel({
    s,
    canCustomizeColor = true,
    handleTheme,
    reverseMode,
    handleReverseMode,
    colorPrimary,
    setColorPrimary,
    colorSecondary,
    setColorSecondary,
    handleColorPreset,
    handleCustomColor,
    savedColor,
}) {
    return (
        <>
            <div className="settings-section">
                <h3>Giao diện</h3>
                <div className="setting-item">
                    <label>Chế độ màu sắc</label>
                    <select value={s.theme || 'dark'} onChange={e => handleTheme(e.target.value)}>
                        <option value="dark">🌙 Tối</option>
                        <option value="light">☀️ Sáng</option>
                        <option value="auto">🔄 Tự động</option>
                    </select>
                </div>
                <div className="setting-item">
                    <div className="setting-info">
                        <h4>Đảo chiều luyện tập</h4>
                        <p>Chuyển EN→VN ⇄ VN→EN. Áp dụng cho: Trắc nghiệm, Điền từ, Nghe &amp; chọn, Thẻ từ vựng, Tốc độ, Ôn lại từ sai.</p>
                    </div>
                    <Toggle checked={reverseMode} onChange={handleReverseMode} />
                </div>
            </div>

            <div className="settings-section">
                <h3>Màu chủ đề</h3>
                {!canCustomizeColor && (
                    <div className="settings-locked-note">
                        <i className="fas fa-lock"></i> Đăng nhập để tùy chỉnh màu sắc. Khách dùng màu mặc định.
                    </div>
                )}
                <div
                    className="setting-item-block"
                    style={!canCustomizeColor ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
                >
                    <div id="color-presets-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                        {COLOR_PRESETS.map((p, i) => {
                            const isActive = savedColor
                                ? savedColor.primary === p.primary && savedColor.secondary === p.secondary
                                : i === 0;
                            return (
                                <button key={i} className={`color-swatch${isActive ? ' active' : ''}`}
                                    title={p.name}
                                    style={{ background: `linear-gradient(135deg,${p.primary},${p.secondary})` }}
                                    onClick={() => handleColorPreset(p.primary, p.secondary)} />
                            );
                        })}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <label style={{ fontSize: '0.82em', color: 'var(--text-secondary)' }}>Chính</label>
                            <input type="color" value={colorPrimary} onChange={e => setColorPrimary(e.target.value)} style={{ width: 36, height: 30, border: 'none', borderRadius: 6, cursor: 'pointer' }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <label style={{ fontSize: '0.82em', color: 'var(--text-secondary)' }}>Phụ</label>
                            <input type="color" value={colorSecondary} onChange={e => setColorSecondary(e.target.value)} style={{ width: 36, height: 30, border: 'none', borderRadius: 6, cursor: 'pointer' }} />
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={handleCustomColor}>Áp dụng</button>
                    </div>
                </div>
            </div>
        </>
    );
}
