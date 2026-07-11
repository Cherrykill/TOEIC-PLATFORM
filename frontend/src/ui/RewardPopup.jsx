import { Modal } from '@ui/Modal.jsx';
import ItemThumb from '@ui/ItemThumb.jsx';

// Popup "nhận thưởng" dùng chung: tiền tệ (xp/coins/gems) + vật phẩm (icon/ảnh + số lượng).
// rewards: { coins, xp, gems, items: [{ itemId, quantity, name, icon, image }] }
function RewardContent({ subtitle, rewards }) {
    const r = rewards || {};
    const chips = [];
    if (r.xp) chips.push({ k: 'xp', icon: '⭐', text: `+${r.xp} XP`, color: '#06b6d4' });
    if (r.coins) chips.push({ k: 'coins', icon: '🪙', text: `+${r.coins}`, color: '#f59e0b' });
    if (r.gems) chips.push({ k: 'gems', icon: '💎', text: `+${r.gems}`, color: '#a855f7' });
    const items = Array.isArray(r.items) ? r.items : [];

    return (
        <div style={{ textAlign: 'center', padding: '4px 0' }}>
            {subtitle && <div style={{ color: 'var(--text-secondary)', fontSize: '0.9em', marginBottom: 12 }}>{subtitle}</div>}
            {chips.length > 0 && (
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: items.length ? 16 : 0 }}>
                    {chips.map(c => (
                        <span key={c.k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'var(--bg-secondary)', fontWeight: 700, color: c.color }}>
                            <span>{c.icon}</span>{c.text}
                        </span>
                    ))}
                </div>
            )}
            {items.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)`, gap: 12, justifyItems: 'center' }}>
                    {items.map((it, i) => {
                        const iconNode = it.icon && it.icon.startsWith('fa-')
                            ? <i className={`fas ${it.icon}`} style={{ fontSize: 28, color: '#8b5cf6' }}></i>
                            : <span style={{ fontSize: 28 }}>{it.icon || '🎁'}</span>;
                        return (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 84 }}>
                                <div style={{ width: 64, height: 64, borderRadius: 12, background: 'var(--bg-secondary)', display: 'grid', placeItems: 'center', position: 'relative' }}>
                                    <ItemThumb image={it.image} imgClassName="cell-img">{iconNode}</ItemThumb>
                                    {it.quantity > 1 && (
                                        <span style={{ position: 'absolute', right: -4, bottom: -4, background: '#111827', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '1px 6px' }}>×{it.quantity}</span>
                                    )}
                                </div>
                                <span style={{ fontSize: '0.75em', color: 'var(--text-secondary)', lineHeight: 1.2 }}>{it.name}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function showRewardPopup({ title = '🎉 Nhận thưởng', subtitle, rewards }) {
    Modal.show({
        title,
        contentJsx: <RewardContent subtitle={subtitle} rewards={rewards} />,
        buttons: [{ text: 'Tuyệt vời!', className: 'btn-primary' }],
    });
}
