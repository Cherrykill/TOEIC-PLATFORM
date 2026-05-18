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

    async function handleBuy(item) {
        Modal.show({
            title: 'Xác nhận mua',
            content: `<p>Mua <strong>${item.name}</strong> với giá <strong>${item.price} ${item.currency === 'gems' ? '💎 Gems' : '🪙 Coins'}</strong>?</p>`,
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
                                if (typeof nb.coins === 'number') GameState.state.resources.coins = nb.coins;
                                if (typeof nb.gems === 'number') GameState.state.resources.gems = nb.gems;
                            }
                            Notification.success(`Mua ${item.name} thành công!`);
                            syncFromState();
                        } else {
                            Notification.error(res.error || 'Mua thất bại');
                        }
                    },
                },
            ],
        });
    }

    const canAfford = (item) => {
        if (item.currency === 'gems') return resources.gems >= item.price;
        return resources.coins >= item.price;
    };

    return (
        <div id="shop-screen" className={`screen ${active ? 'active' : ''}`}>
            <div className="screen-header">
                <button className="back-btn-screen icon-btn" onClick={() => showScreen('home-screen')}>
                    <i className="fas fa-arrow-left"></i>
                </button>
                <h2><i className="fas fa-shopping-cart"></i> Cửa hàng</h2>
            </div>
            <div id="shop-content" className="shop-content">
                {loading ? (
                    <div className="loading-state"><i className="fas fa-spinner fa-spin"></i> Đang tải...</div>
                ) : items.map(item => {
                    const onSale = item.originalPrice && item.originalPrice > item.price;
                    const discountPct = onSale ? Math.round((1 - item.price / item.originalPrice) * 100) : 0;
                    const currIcon = item.currency === 'gems' ? '💎' : '🪙';
                    return (
                        <div key={item.id} className={`shop-item${onSale ? ' on-sale' : ''}`}>
                            {onSale && <div className="sale-ribbon">SALE</div>}
                            <div className="shop-item-icon">{item.icon}</div>
                            <div className="shop-item-title">{item.name}</div>
                            {item.description && <div className="shop-item-description">{item.description}</div>}
                            <div className="shop-item-price">
                                {onSale ? (
                                    <>
                                        <span className="price-original">{currIcon}{item.originalPrice}</span>
                                        <span className="price-sale">{currIcon}{item.price}</span>
                                        <span className="discount-badge">-{discountPct}%</span>
                                    </>
                                ) : (
                                    <>
                                        <span className={`price-amount ${item.currency === 'gems' ? 'gems' : 'coins'}`}>{currIcon}{item.price}</span>
                                    </>
                                )}
                            </div>
                            <button
                                className={`buy-btn${!canAfford(item) ? ' disabled' : ''}`}
                                disabled={!canAfford(item)}
                                onClick={() => handleBuy(item)}
                            >
                                Mua ngay
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
