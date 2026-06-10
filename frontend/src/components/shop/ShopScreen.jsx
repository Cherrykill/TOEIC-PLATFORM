import { useState, useEffect } from 'react';
import { useGame } from '@game/GameContext.jsx';
import { GameState } from '@game/state.js';
import { API } from '@api/http.js';
import { ShopCatalogAPI } from '@api/shopCatalog.js';
import { Config } from '@game/config.js';
import { Notification } from '@ui/Toaster.jsx';
import { Modal } from '@ui/Modal.jsx';

export default function ShopScreen({ active }) {
    const { showScreen, resources, syncFromState } = useGame();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

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

    return (
        <div id="shop-screen" className={`screen ${active ? 'active' : ''}`}>
            <div className="screen-header">
                <button className="back-btn-screen icon-btn" onClick={() => showScreen('home-screen')}>
                    <i className="fas fa-arrow-left"></i>
                </button>
                <h2><i className="fas fa-shopping-cart"></i> Cửa hàng</h2>
                <button
                    className="checkin-trigger-btn"
                    style={{ marginLeft: 'auto' }}
                    title="Vòng quay may mắn"
                    onClick={() => window._openSpinWheel?.()}
                >
                    <i className="fas fa-dharmachakra"></i> Vòng quay
                </button>
                <button className="icon-btn" title="Làm mới" onClick={loadItems}>
                    <i className="fas fa-rotate-right"></i>
                </button>
            </div>
            <div id="shop-content" className="shop-content">
                {loading ? (
                    <div className="loading-state"><i className="fas fa-spinner fa-spin"></i> Đang tải...</div>
                ) : items.map(item => {
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
