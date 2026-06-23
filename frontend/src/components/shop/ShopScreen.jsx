import { useState, useEffect } from 'react';
import { useGame } from '@game/GameContext.jsx';
import { GameState } from '@game/state.js';
import { API } from '@api/http.js';
import { ShopCatalogAPI } from '@api/shopCatalog.js';
import { Config } from '@game/config.js';
import { Utils } from '@lib/utils.js';
import { Notification } from '@ui/Toaster.jsx';
import { Modal } from '@ui/Modal.jsx';

// Gộp 6 category trong DB thành 5 tab cho gọn. `cats` = các category map vào tab.
const SHOP_TABS = [
    { key: 'all',      label: 'Tất cả',   icon: 'fa-store' },
    { key: 'items',    label: 'Vật phẩm', icon: 'fa-box',  cats: ['energy', 'resource'] },
    { key: 'boost',    label: 'Tăng tốc', icon: 'fa-bolt', cats: ['boost'] },
    { key: 'exchange', label: 'Quy đổi',  icon: 'fa-gem',  cats: ['exchange'] },
    { key: 'premium',  label: 'Gói & VIP',icon: 'fa-crown',cats: ['bundle', 'vip'] },
];

export default function ShopScreen({ active }) {
    const { showScreen, resources, syncFromState } = useGame();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');

    useEffect(() => {
        if (active) loadItems();
    }, [active]);

    async function loadItems() {
        setLoading(true);
        const res = await ShopCatalogAPI.items();
        const raw = res.success ? (res.items || res.data || []) : [];
        const normalized = raw.map(it => {
            const id = it.id || it.itemId || it._id;
            const configItem = Config.shopItems.find(c => c.id === id) || {};
            const merged = { ...configItem, ...it, id };
            // Config defines frontend discounts — server price is the undiscounted price
            if (configItem.originalPrice) {
                merged.price = configItem.price;
                merged.originalPrice = configItem.originalPrice;
            }
            return merged;
        });
        setItems(normalized.length > 0 ? normalized : Config.shopItems);
        setLoading(false);
    }

    function effectivePrice(item) {
        if (item.discountPercent > 0) {
            return Math.floor(item.price * (1 - item.discountPercent / 100));
        }
        // Legacy: Config.shopItems có thể đặt originalPrice + price (price = sale).
        return item.price;
    }

    async function handleBuy(item) {
        const finalPrice = effectivePrice(item);
        Modal.show({
            title: 'Xác nhận mua',
            content: `<p>Mua <strong>${item.name}</strong> với giá <strong>${finalPrice} ${item.currency === 'gems' ? '💎 Gems' : '🪙 Coins'}</strong>?</p>`,
            buttons: [
                {
                    text: 'Hủy',
                    className: 'btn-secondary',
                    onClick: () => {},
                },
                {
                    text: 'Mua',
                    className: 'btn-primary',
                    onClick: async () => {
                        const res = await API.shop.purchase(item.id);
                        if (res.success) {
                            // Âm thanh mua thành công (tôn trọng setting âm thanh chung).
                            if (GameState.state.settings?.soundEnabled !== false) {
                                Utils.playSound(Config.sounds.buyItem, 0.6, { ignoreSettings: true });
                            }
                            // Server already deducted/awarded — mirror the new
                            // balance into GameState so the StatusBar updates
                            // without needing an F5. Http wraps the backend
                            // body under res.data, so newBalance is nested.
                            const body = res.data;
                            const nb = body?.newBalance || body?.data?.newBalance;
                            if (nb && GameState.state?.resources) {
                                // Đồng bộ MỌI tài nguyên server trả về (gồm cả
                                // shields/hints/timeFreezes/energy) để local không
                                // bị lệch → save() sau không ghi đè mất đồ vừa mua.
                                for (const k of ['coins', 'gems', 'energy', 'hints', 'shields', 'timeFreezes']) {
                                    if (typeof nb[k] === 'number') GameState.state.resources[k] = nb[k];
                                }
                            }
                            // Mirror VIP + boosts (vd mua VIP → bật ngay unlimited energy + x2).
                            const vip = body?.vip || body?.data?.vip;
                            if (vip && GameState.state) GameState.state.vip = { active: !!vip.active, expiresAt: vip.expiresAt || 0 };
                            const boosts = body?.boosts || body?.data?.boosts;
                            if (boosts && GameState.state?.boosts) {
                                if (boosts.xp) GameState.state.boosts.xp = boosts.xp;
                                if (boosts.coins) GameState.state.boosts.coins = boosts.coins;
                            }
                            // Ghi vào lịch sử chi tiêu local (newest first, cap 50).
                            const txn = body?.transaction || body?.data?.transaction;
                            if (txn && GameState.state) {
                                if (!Array.isArray(GameState.state.transactions)) GameState.state.transactions = [];
                                GameState.state.transactions.unshift(txn);
                                if (GameState.state.transactions.length > 50) GameState.state.transactions = GameState.state.transactions.slice(0, 50);
                            }
                            Notification.success(`Mua ${item.name} thành công!`);
                            syncFromState();
                            // Tải lại danh sách để nút vào trạng thái cooldown ngay.
                            loadItems();
                        } else {
                            // Hiện đúng thông báo từ server (vd giới hạn mua theo tuần).
                            Notification.error(res.message || res.data?.message || res.error || 'Mua thất bại');
                        }
                    },
                },
            ],
        });
    }

    const canAfford = (item) => {
        const p = effectivePrice(item);
        if (item.currency === 'gems') return resources.gems >= p;
        return resources.coins >= p;
    };

    // Lọc theo tab đang chọn (client-side, dùng field category từ API).
    const activeTabDef = SHOP_TABS.find(t => t.key === activeTab);
    const visibleItems = (!activeTabDef || activeTab === 'all')
        ? items
        : items.filter(it => activeTabDef.cats?.includes(it.category));

    // Túi đồ: hiện vật phẩm tiêu hao + boost đang chạy + số dư (đọc thẳng state).
    function openInventory() {
        const r = GameState.state.resources || {};
        const b = GameState.state.boosts || {};
        const now = Date.now();
        const boostLeft = (boost) => {
            if (!boost?.active || !boost.expiresAt) return null;
            const ms = new Date(boost.expiresAt).getTime() - now;
            if (ms <= 0) return null;
            const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
            return h > 0 ? `${h}h ${m}m` : `${m}m`;
        };
        const xpLeft = boostLeft(b.xp);
        const coinsLeft = boostLeft(b.coins);
        const vip = GameState.state.vip;
        const vipActive = !!(vip?.active && vip.expiresAt > now);
        const vipLeft = vipActive ? (() => {
            const ms = vip.expiresAt - now;
            const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
            return d > 0 ? `${d} ngày ${h}h` : `${h}h`;
        })() : null;

        const consumables = [
            { icon: 'fa-shield-alt', color: '#3b82f6', name: 'Khiên bảo vệ streak', count: r.shields || 0, desc: 'Giữ streak khi bạn nghỉ 1 ngày' },
            { icon: 'fa-lightbulb', color: '#f59e0b', name: 'Gợi ý', count: r.hints || 0, desc: 'Dùng khi luyện tập' },
            { icon: 'fa-snowflake', color: '#06b6d4', name: 'Dừng thời gian', count: r.timeFreezes || 0, desc: 'Tạm dừng đồng hồ câu hỏi' },
        ];
        const allEmpty = consumables.every(c => c.count <= 0) && !xpLeft && !coinsLeft && !vipActive;

        const body = (
            <div className="inventory-modal">
                <div className="inventory-currency">
                    <span><i className="fas fa-coins" style={{ color: '#f59e0b' }}></i> {r.coins || 0}</span>
                    <span><i className="fas fa-gem" style={{ color: '#a855f7' }}></i> {r.gems || 0}</span>
                    <span><i className="fas fa-bolt" style={{ color: '#22c55e' }}></i> {r.energy || 0}/{r.maxEnergy || 100}</span>
                </div>

                {vipActive && (
                    <div className="inventory-vip">
                        <i className="fas fa-crown"></i>
                        <div className="inv-info">
                            <span className="inv-name">VIP đang kích hoạt</span>
                            <span className="inv-desc">Năng lượng không giới hạn + x2 XP/Coins · còn {vipLeft}</span>
                        </div>
                    </div>
                )}

                <div className="inventory-section-title">Vật phẩm</div>
                <ul className="inventory-list">
                    {consumables.map(it => (
                        <li key={it.name} className={`inventory-item${it.count <= 0 ? ' inventory-item--empty' : ''}`}>
                            <i className={`fas ${it.icon} inv-icon`} style={{ color: it.color }}></i>
                            <div className="inv-info">
                                <span className="inv-name">{it.name}</span>
                                <span className="inv-desc">{it.desc}</span>
                            </div>
                            <span className="inv-count">×{it.count}</span>
                        </li>
                    ))}
                </ul>

                {(xpLeft || coinsLeft) && (
                    <>
                        <div className="inventory-section-title">Tăng tốc đang chạy</div>
                        <ul className="inventory-list">
                            {xpLeft && (
                                <li className="inventory-item">
                                    <i className="fas fa-bolt inv-icon" style={{ color: '#8b5cf6' }}></i>
                                    <div className="inv-info"><span className="inv-name">x{b.xp.multiplier} XP</span><span className="inv-desc">Còn {xpLeft}</span></div>
                                </li>
                            )}
                            {coinsLeft && (
                                <li className="inventory-item">
                                    <i className="fas fa-coins inv-icon" style={{ color: '#f59e0b' }}></i>
                                    <div className="inv-info"><span className="inv-name">x{b.coins.multiplier} Coins</span><span className="inv-desc">Còn {coinsLeft}</span></div>
                                </li>
                            )}
                        </ul>
                    </>
                )}

                {allEmpty && (
                    <p className="inventory-empty-note">Túi còn trống — mua vật phẩm ở cửa hàng nhé!</p>
                )}
            </div>
        );

        Modal.show({ title: '🎒 Túi đồ', wide: true, contentJsx: body });
    }

    // Lịch sử chi tiêu (mua shop / đổi gems / VIP) — đọc state.transactions.
    function openHistory() {
        const txns = GameState.state.transactions || [];
        const fmtDate = (d) => new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const body = (
            <div className="txn-modal">
                {txns.length === 0 ? (
                    <div className="empty-state" style={{ padding: 24, textAlign: 'center' }}>
                        <i className="fas fa-receipt" style={{ fontSize: 32, opacity: 0.3 }}></i>
                        <p style={{ marginTop: 8 }}>Chưa có giao dịch nào</p>
                    </div>
                ) : (
                    <ul className="txn-list">
                        {txns.map((t, i) => (
                            <li key={i} className="txn-item">
                                <div className="txn-info">
                                    <span className="txn-name">{t.name}</span>
                                    <span className="txn-time">{fmtDate(t.at)}</span>
                                </div>
                                <div className="txn-amount">
                                    <span className="txn-spent">−{t.amount} {t.currency === 'gems' ? '💎' : '🪙'}</span>
                                    <span className="txn-balance">còn {t.balanceAfter}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        );
        Modal.show({ title: '📜 Lịch sử giao dịch', wide: true, contentJsx: body });
    }

    return (
        <div id="shop-screen" className={`screen ${active ? 'active' : ''}`}>
            <div className="screen-header">
                <button className="back-btn-screen icon-btn" onClick={() => showScreen('home-screen')}>
                    <i className="fas fa-arrow-left"></i>
                </button>
                <h2><i className="fas fa-shopping-cart"></i> Cửa hàng</h2>
                <button
                    className="inventory-btn"
                    style={{ marginLeft: 'auto' }}
                    title="Túi đồ — vật phẩm đang có"
                    onClick={openInventory}
                >
                    <i className="fas fa-briefcase"></i> Túi đồ
                </button>
                <button
                    className="inventory-btn"
                    title="Lịch sử giao dịch"
                    onClick={openHistory}
                >
                    <i className="fas fa-receipt"></i> Lịch sử
                </button>
                <button
                    className="checkin-trigger-btn"
                    title="Vòng quay may mắn"
                    onClick={() => window._openSpinWheel?.()}
                >
                    <i className="fas fa-dharmachakra"></i> Vòng quay
                </button>
                <button className="icon-btn" title="Làm mới" onClick={loadItems}>
                    <i className="fas fa-rotate-right"></i>
                </button>
            </div>

            <div className="shop-tabs">
                {SHOP_TABS.map(tab => (
                    <button
                        key={tab.key}
                        className={`shop-tab ${activeTab === tab.key ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        <i className={`fas ${tab.icon}`}></i> {tab.label}
                    </button>
                ))}
            </div>

            <div id="shop-content" className="shop-content">
                {loading ? (
                    <div className="loading-state"><i className="fas fa-spinner fa-spin"></i> Đang tải...</div>
                ) : visibleItems.length === 0 ? (
                    <div className="empty-state" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 32 }}>
                        <i className="fas fa-store-slash" style={{ fontSize: 36, opacity: 0.3 }}></i>
                        <p style={{ marginTop: 8 }}>Chưa có vật phẩm trong nhóm này</p>
                    </div>
                ) : visibleItems.map(item => {
                    // 2 nguồn discount: (1) admin set discountPercent trong DB
                    // → giá hiển thị bị gạch = item.price; giá sale = price*(1-%).
                    // (2) Legacy Config.shopItems set originalPrice + price
                    // (price là giá sale rồi). Ưu tiên (1) — khớp backend.
                    const adminDiscount = item.discountPercent > 0;
                    const legacyOriginal = item.originalPrice && item.originalPrice > item.price;
                    const onSale = adminDiscount || legacyOriginal;
                    const originalPriceDisplay = adminDiscount ? item.price : item.originalPrice;
                    const salePriceDisplay = adminDiscount
                        ? Math.floor(item.price * (1 - item.discountPercent / 100))
                        : item.price;
                    const discountPct = adminDiscount
                        ? item.discountPercent
                        : (legacyOriginal ? Math.round((1 - item.price / item.originalPrice) * 100) : 0);
                    const currIcon = item.currency === 'gems' ? '💎' : '🪙';
                    // Cooldown theo chu kỳ (vd khiên 7 ngày/lần): server trả
                    // nextAvailableAt nếu còn trong thời gian chờ.
                    const cdMs = item.nextAvailableAt ? new Date(item.nextAvailableAt).getTime() - Date.now() : 0;
                    const onCooldown = cdMs > 0;
                    const cdDaysLeft = onCooldown ? Math.ceil(cdMs / 86400000) : 0;
                    const disabled = onCooldown || !canAfford(item);
                    return (
                        <div key={item.id} className={`shop-item${onSale ? ' on-sale' : ''}`}>
                            {onSale && <div className="sale-ribbon">SALE</div>}
                            <div className="shop-item-icon">{item.icon}</div>
                            <div className="shop-item-title">{item.name}</div>
                            {item.description && <div className="shop-item-description">{item.description}</div>}
                            <div className="shop-item-price">
                                {onSale ? (
                                    <>
                                        <span className="price-original">{currIcon}{originalPriceDisplay}</span>
                                        <span className="price-sale">{currIcon}{salePriceDisplay}</span>
                                        <span className="discount-badge">-{discountPct}%</span>
                                    </>
                                ) : (
                                    <>
                                        <span className={`price-amount ${item.currency === 'gems' ? 'gems' : 'coins'}`}>{currIcon}{item.price}</span>
                                    </>
                                )}
                            </div>
                            <button
                                className={`buy-btn${disabled ? ' disabled' : ''}`}
                                disabled={disabled}
                                onClick={() => handleBuy(item)}
                                title={onCooldown ? `Có thể mua lại sau ${cdDaysLeft} ngày` : undefined}
                            >
                                {onCooldown ? `Chờ ${cdDaysLeft} ngày` : 'Mua ngay'}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
