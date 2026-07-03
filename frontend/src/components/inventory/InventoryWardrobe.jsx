import { useState, useEffect, useMemo } from 'react';
import { GameState } from '@game/state.js';
import { EventBus, GameEvents } from '@game/eventBus.js';
import { InventoryAPI } from '@api/inventory.js';
import { BACKGROUNDS, bgStyle } from '@game/backgrounds.js';
import { Notification } from '@ui/Toaster.jsx';

const CATS = [
    { key: 'cosmetic', label: 'Trang bị', icon: 'fa-shirt' },
    { key: 'consumable', label: 'Tiêu hao', icon: 'fa-flask' },
    { key: 'boost', label: 'Tăng tốc', icon: 'fa-bolt' },
];

const CONSUMABLE_META = {
    hint: { name: 'Gợi ý', icon: 'fa-lightbulb', color: '#f59e0b', desc: 'Dùng khi luyện tập', field: 'hints' },
    shield: { name: 'Khiên bảo vệ streak', icon: 'fa-shield-halved', color: '#3b82f6', desc: 'Giữ streak khi nghỉ 1 ngày', field: 'shields' },
    'time-freeze': { name: 'Dừng thời gian', icon: 'fa-snowflake', color: '#06b6d4', desc: 'Tạm dừng đồng hồ câu hỏi', field: 'timeFreezes' },
};

export default function InventoryWardrobe() {
    const [cat, setCat] = useState('cosmetic');
    const [inv, setInv] = useState([]);
    const [equipped, setEquipped] = useState({});
    const [selected, setSelected] = useState(null);
    const [busy, setBusy] = useState(false);

    const reload = async () => {
        const res = await InventoryAPI.get();
        setInv(res.data || []);
        setEquipped(res.equipped || GameState.state?.equipped || {});
    };
    useEffect(() => { reload(); }, []);

    const r = GameState.state?.resources || {};
    const b = GameState.state?.boosts || {};
    const now = Date.now();
    const boostLeft = (x) => {
        if (!x?.active || !x.expiresAt) return null;
        const ms = new Date(x.expiresAt).getTime() - now;
        if (ms <= 0) return null;
        const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    // Item của tab đang chọn (định dạng thống nhất cho lưới).
    const items = useMemo(() => {
        if (cat === 'cosmetic') {
            return inv
                .filter(i => String(i.definition?.type || '').startsWith('cosmetic'))
                .map(i => ({
                    id: i.itemId,
                    kind: 'cosmetic',
                    name: BACKGROUNDS[i.itemId]?.label || i.definition?.name || i.itemId,
                    bg: BACKGROUNDS[i.itemId] || null,
                    slot: i.definition?.effect?.slot || 'background',
                    equipped: equipped[i.definition?.effect?.slot || 'background'] === i.itemId,
                    rarity: i.definition?.rarity,
                }));
        }
        if (cat === 'consumable') {
            // Từ UserStats (hint/shield/timeFreeze)
            const fromStats = Object.entries(CONSUMABLE_META).map(([id, m]) => ({
                id, kind: 'consumable', name: m.name, icon: m.icon, color: m.color, desc: m.desc,
                count: r[m.field] || 0,
            })).filter(x => x.count > 0);
            // Từ inventory (vd vé quay) — các consumable không nằm trong UserStats
            const known = new Set(Object.keys(CONSUMABLE_META));
            const fromInv = inv
                .filter(i => i.definition?.type === 'consumable' && !known.has(i.itemId) && i.quantity > 0)
                .map(i => ({
                    id: i.itemId, kind: 'consumable', name: i.definition.name,
                    icon: i.definition.icon || 'fa-cube', color: '#8b5cf6',
                    desc: i.definition.description, count: i.quantity,
                }));
            return [...fromStats, ...fromInv];
        }
        // boost
        const list = [];
        const xp = boostLeft(b.xp), co = boostLeft(b.coins);
        const vip = GameState.state?.vip;
        const vipActive = !!(vip?.active && vip.expiresAt > now);
        if (vipActive) {
            const ms = vip.expiresAt - now, d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
            list.push({ id: 'vip', kind: 'boost', name: 'VIP', icon: 'fa-crown', color: '#f59e0b', desc: 'Năng lượng ∞ + x2 XP/Coins', left: d > 0 ? `${d} ngày ${h}h` : `${h}h` });
        }
        if (xp) list.push({ id: 'xp', kind: 'boost', name: `x${b.xp.multiplier} XP`, icon: 'fa-bolt', color: '#8b5cf6', desc: 'Nhân đôi XP', left: xp });
        if (co) list.push({ id: 'coins', kind: 'boost', name: `x${b.coins.multiplier} Coins`, icon: 'fa-coins', color: '#f59e0b', desc: 'Nhân đôi Coins', left: co });
        return list;
    }, [cat, inv, equipped, r, b, now]);

    const equip = async (item) => {
        if (busy || item.equipped) return;
        setBusy(true);
        const res = await InventoryAPI.equip(item.id);
        setBusy(false);
        if (res?.success) {
            const slot = res.slot || item.slot || 'background';
            if (!GameState.state.equipped) GameState.state.equipped = {};
            GameState.state.equipped[slot] = item.id;
            EventBus.emit(GameEvents.STATE_CHANGED);
            await reload();
            setSelected({ ...item, equipped: true });
            Notification.show({ type: 'success', message: `Đã trang bị "${item.name}"`, duration: 1500 });
        } else {
            Notification.error(res?.message || 'Không trang bị được');
        }
    };

    return (
        <div className="wardrobe">
            {/* Sidebar category */}
            <div className="wardrobe-cats">
                {CATS.map(c => (
                    <button
                        key={c.key}
                        className={`wardrobe-cat${cat === c.key ? ' active' : ''}`}
                        onClick={() => { setCat(c.key); setSelected(null); }}
                    >
                        <i className={`fas ${c.icon}`}></i>
                        <span>{c.label}</span>
                    </button>
                ))}
            </div>

            {/* Lưới item */}
            <div className="wardrobe-grid">
                {items.length === 0 ? (
                    <div className="wardrobe-empty">Chưa có vật phẩm ở mục này</div>
                ) : items.map(it => (
                    <button
                        key={it.id}
                        className={`wardrobe-cell${selected?.id === it.id ? ' selected' : ''}${it.equipped ? ' equipped' : ''}${it.rarity ? ' rarity-' + it.rarity : ''}`}
                        onClick={() => setSelected(it)}
                    >
                        {it.kind === 'cosmetic' && it.bg ? (
                            <span className="cell-thumb" style={bgStyle(it.id) || undefined}></span>
                        ) : (
                            <span className="cell-thumb cell-thumb--icon"><i className={`fas ${it.icon}`} style={{ color: it.color }}></i></span>
                        )}
                        <span className="cell-name">{it.name}</span>
                        {it.kind === 'consumable' && <span className="cell-badge">×{it.count}</span>}
                        {it.kind === 'boost' && it.left && <span className="cell-badge">{it.left}</span>}
                        {it.equipped && <span className="cell-equipped"><i className="fas fa-check"></i></span>}
                    </button>
                ))}
            </div>

            {/* Preview + hành động */}
            <div className="wardrobe-preview">
                {!selected ? (
                    <div className="wardrobe-preview-empty"><i className="fas fa-hand-pointer"></i><p>Chọn một vật phẩm</p></div>
                ) : (
                    <>
                        <div className="preview-visual" style={selected.kind === 'cosmetic' ? (bgStyle(selected.id) || undefined) : undefined}>
                            {selected.kind !== 'cosmetic' && <i className={`fas ${selected.icon}`} style={{ color: selected.color }}></i>}
                        </div>
                        <div className="preview-name">{selected.name}</div>
                        {selected.desc && <div className="preview-desc">{selected.desc}</div>}
                        {selected.kind === 'consumable' && <div className="preview-desc">Số lượng: ×{selected.count}</div>}
                        {selected.kind === 'boost' && selected.left && <div className="preview-desc">Còn lại: {selected.left}</div>}
                        {selected.kind === 'cosmetic' && (
                            selected.equipped ? (
                                <button className="btn btn-secondary btn-sm preview-btn" disabled><i className="fas fa-check"></i> Đang dùng</button>
                            ) : (
                                <button className="btn btn-primary btn-sm preview-btn" disabled={busy} onClick={() => equip(selected)}>
                                    <i className="fas fa-check"></i> Trang bị
                                </button>
                            )
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
