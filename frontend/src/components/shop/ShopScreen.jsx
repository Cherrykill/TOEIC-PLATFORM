import { useState, useEffect } from 'react';
import { useGame } from '@game/GameContext.jsx';
import { GameState } from '@game/state.js';
import { API } from '@api/http.js';
import { ShopCatalogAPI } from '@api/shopCatalog.js';
import { Config } from '@game/config.js';
import { Utils } from '@lib/utils.js';
import { Notification } from '@ui/Toaster.jsx';
import { Modal } from '@ui/Modal.jsx';
import InventoryWardrobe from '@components/inventory/InventoryWardrobe.jsx';
import ItemThumb from '@ui/ItemThumb.jsx';
import { InventoryAPI } from '@api/inventory.js';
import { authHeaders } from '@/auth/token.js';

// Gộp 6 category trong DB thành 5 tab cho gọn. `cats` = các category map vào tab.
const SHOP_TABS = [
    { key: 'all',      label: 'Tất cả',   icon: 'fa-store' },
    { key: 'items',    label: 'Vật phẩm', icon: 'fa-box',  cats: ['energy', 'resource'] },
    { key: 'boost',    label: 'Tăng tốc', icon: 'fa-bolt', cats: ['boost'] },
    { key: 'exchange', label: 'Quy đổi',  icon: 'fa-gem',  cats: ['exchange'] },
    { key: 'cosmetic', label: 'Giao diện',icon: 'fa-shirt',cats: ['cosmetic'] },
    { key: 'premium',  label: 'Gói & VIP',icon: 'fa-crown',cats: ['bundle', 'vip'] },
];

export default function ShopScreen({ active }) {
    const { showScreen, resources, syncFromState } = useGame();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    // itemId các cosmetic user đã sở hữu — để hiện "Đã mua" & khoá nút mua.
    const [ownedCosmetics, setOwnedCosmetics] = useState(() => new Set());

    useEffect(() => {
        if (active) { loadItems(); loadOwned(); }
    }, [active]);

    async function loadOwned() {
        const res = await InventoryAPI.get().catch(() => null);
        const owned = new Set(
            (res?.data || [])
                .filter(i => String(i.definition?.type || '').startsWith('cosmetic'))
                .map(i => i.itemId)
        );
        setOwnedCosmetics(owned);
    }

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
        const unitPrice = effectivePrice(item);
        // Cho chọn số lượng với đồ stackable không cooldown (vật phẩm tiêu hao, đổi gems).
        const allowQty = !item.cooldownDays && ['resource', 'exchange', 'boost'].includes(item.category);

        const doPurchase = async (qty) => {
            const res = await API.shop.purchase(item.id, qty);
            if (res.success) {
                if (GameState.state.settings?.soundEnabled !== false) {
                    Utils.playSound(Config.sounds.buyItem, 0.6, { ignoreSettings: true });
                }
                const body = res.data;
                const nb = body?.newBalance || body?.data?.newBalance;
                if (nb && GameState.state?.resources) {
                    for (const k of ['coins', 'gems', 'energy', 'hints', 'shields', 'timeFreezes']) {
                        if (typeof nb[k] === 'number') GameState.state.resources[k] = nb[k];
                    }
                }
                const vip = body?.vip || body?.data?.vip;
                if (vip && GameState.state) GameState.state.vip = { active: !!vip.active, expiresAt: vip.expiresAt || 0 };
                const boosts = body?.boosts || body?.data?.boosts;
                if (boosts && GameState.state?.boosts) {
                    if (boosts.xp) GameState.state.boosts.xp = boosts.xp;
                    if (boosts.coins) GameState.state.boosts.coins = boosts.coins;
                }
                const txn = body?.transaction || body?.data?.transaction;
                if (txn && GameState.state) {
                    if (!Array.isArray(GameState.state.transactions)) GameState.state.transactions = [];
                    GameState.state.transactions.unshift(txn);
                    if (GameState.state.transactions.length > 50) GameState.state.transactions = GameState.state.transactions.slice(0, 50);
                }
                Notification.success(`Mua ${item.name}${qty > 1 ? ` ×${qty}` : ''} thành công!`);
                syncFromState();
                loadItems();
                loadOwned();
            } else {
                Notification.error(res.message || res.data?.message || res.error || 'Mua thất bại');
            }
        };

        Modal.show({
            title: 'Xác nhận mua',
            contentJsx: (
                <PurchaseConfirm
                    item={item}
                    unitPrice={unitPrice}
                    currency={item.currency}
                    allowQty={allowQty}
                    onConfirm={doPurchase}
                />
            ),
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

    // Túi đồ: bố cục tủ đồ (sidebar category + lưới + preview/trang bị).
    function openInventory() {
        const r = GameState.state.resources || {};
        // Tiền tệ nằm cùng dòng tiêu đề (headerActionHtml của Modal).
        const currencyHtml = `<span class="inventory-currency-inline">
            <span><i class="fas fa-coins" style="color:#f59e0b"></i> ${r.coins || 0}</span>
            <span><i class="fas fa-gem" style="color:#a855f7"></i> ${r.gems || 0}</span>
            <span><i class="fas fa-bolt" style="color:#22c55e"></i> ${r.energy || 0}/${r.maxEnergy || 100}</span>
        </span>`;
        Modal.show({ title: '🎒 Túi đồ', wide: true, headerActionHtml: currencyHtml, contentJsx: <InventoryWardrobe /> });
    }

    // Lịch sử chi tiêu (mua shop / đổi gems / VIP) — đọc state.transactions.
    function openHistory() {
        Modal.show({ title: '📜 Lịch sử giao dịch', wide: true, contentJsx: <TransactionHistory /> });
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
                    title="Lịch sử giao dịch"
                    onClick={openHistory}
                >
                    <i className="fas fa-receipt"></i> Lịch sử
                </button>
                <button
                    className="inventory-btn"
                    title="Túi đồ — vật phẩm đang có"
                    onClick={openInventory}
                >
                    <i className="fas fa-briefcase"></i> Túi đồ
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
                    // Cosmetic mua 1 lần — đã sở hữu thì hiện "Đã mua" & khoá nút.
                    const owned = item.category === 'cosmetic' && ownedCosmetics.has(item.effect?.itemId);
                    const disabled = owned || onCooldown || !canAfford(item);
                    return (
                        <div key={item.id} className={`shop-item${onSale ? ' on-sale' : ''}${owned ? ' owned' : ''}`}>
                            {onSale && <div className="sale-ribbon">SALE</div>}
                            <div className="shop-item-icon">
                                <ItemThumb image={item.image} imgClassName="shop-item-img">{item.icon}</ItemThumb>
                            </div>
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
                                className={`buy-btn${disabled ? ' disabled' : ''}${owned ? ' owned' : ''}`}
                                disabled={disabled}
                                onClick={() => handleBuy(item)}
                                title={owned ? 'Đã sở hữu — trang bị trong Túi đồ' : (onCooldown ? `Có thể mua lại sau ${cdDaysLeft} ngày` : undefined)}
                            >
                                {owned ? <><i className="fas fa-check"></i> Đã mua</> : onCooldown ? `Chờ ${cdDaysLeft} ngày` : 'Mua ngay'}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// Popup xác nhận mua — có bộ chọn số lượng cho đồ stackable.
function PurchaseConfirm({ item, unitPrice, currency, allowQty, onConfirm }) {
    const [qty, setQty] = useState(1);
    const [busy, setBusy] = useState(false);
    const icon = currency === 'gems' ? '💎 Gems' : '🪙 Coins';
    const clamp = (n) => Math.max(1, Math.min(99, n || 1));
    const total = unitPrice * qty;
    return (
        <div className="buy-confirm">
            <p>Mua <strong>{item.name}</strong>{!allowQty && <> với giá <strong>{unitPrice} {icon}</strong></>}?</p>
            {allowQty && (
                <div className="buy-qty">
                    <span>Số lượng</span>
                    <div className="buy-qty-stepper">
                        <button type="button" onClick={() => setQty(q => clamp(q - 1))} disabled={qty <= 1}>−</button>
                        <input type="number" min={1} max={99} value={qty}
                            onChange={e => setQty(clamp(parseInt(e.target.value, 10)))} />
                        <button type="button" onClick={() => setQty(q => clamp(q + 1))} disabled={qty >= 99}>+</button>
                    </div>
                </div>
            )}
            {allowQty && <p className="buy-total">Tổng: <strong>{total} {icon}</strong></p>}
            <div className="buy-confirm-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => Modal.close()} disabled={busy}>Hủy</button>
                <button className="btn btn-primary btn-sm" disabled={busy}
                    onClick={async () => { setBusy(true); await onConfirm(qty); setBusy(false); Modal.close(); }}>
                    {busy ? 'Đang mua...' : 'Mua'}
                </button>
            </div>
        </div>
    );
}

// Lịch sử giao dịch — đọc từ collection transactions (server, không giới hạn).
function TransactionHistory() {
    const [txns, setTxns] = useState(null);
    useEffect(() => {
        fetch('/api/user/transactions', { headers: authHeaders() })
            .then(r => r.json())
            .then(res => setTxns(res.success ? (res.data || []) : []))
            .catch(() => setTxns([]));
    }, []);
    const fmtDate = (d) => new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    if (txns === null) {
        return <div className="txn-modal"><p style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}><i className="fas fa-spinner fa-spin"></i> Đang tải...</p></div>;
    }
    return (
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
}
