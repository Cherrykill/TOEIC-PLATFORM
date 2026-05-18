// ===================================
// SHOP MODULE - Logic
// ===================================

const Shop = {
    
    // Shop items cache
    items: [],
    
    /**
     * Initialize shop — fetch items from API, fall back to Config
     */
    async init() {
        EventBus.on(GameEvents.ITEM_PURCHASED, (data) => {
            this.onItemPurchased(data);
        });
        await this.loadItems();
    },

    async loadItems() {
        try {
            const token = typeof AuthManager !== 'undefined' && AuthManager.getToken
                ? AuthManager.getToken()
                : (localStorage.getItem('authToken') || localStorage.getItem('token'));
            const headers = token ? { Authorization: 'Bearer ' + token } : {};
            const res = await fetch('/api/shop/items', { headers });
            const data = await res.json();
            if (data.success && Array.isArray(data.items) && data.items.length > 0) {
                this.items = data.items.map(item => ({
                    id:              item.itemId,
                    name:            item.name,
                    description:     item.description || '',
                    icon:            item.icon || '🛒',
                    price:           item.price,
                    currency:        item.currency,
                    discountPercent: item.discountPercent || 0,
                    effect:          item.effect,
                    category:        item.category,
                    purchased:       false,
                    purchaseCount:   0,
                }));
                return;
            }
        } catch (e) {
            console.warn('[Shop] API fetch failed, using config fallback:', e.message);
        }
        // Fallback to hardcoded config
        this.items = Config.shopItems.map(item => ({
            ...item,
            discountPercent: 0,
            purchased: false,
            purchaseCount: 0,
        }));
    },

    /**
     * Get effective (after-discount) price of an item
     */
    getEffectivePrice(item) {
        if (item.discountPercent > 0) {
            return Math.floor(item.price * (1 - item.discountPercent / 100));
        }
        return item.price;
    },
    
    /**
     * Get all shop items
     */
    getItems() {
        return [...this.items];
    },
    
    /**
     * Get item by id
     */
    getItem(itemId) {
        return this.items.find(item => item.id === itemId);
    },
    
    /**
     * Check if can afford item (uses effective/discounted price)
     */
    canAfford(itemId) {
        const item = this.getItem(itemId);
        if (!item) return false;

        const resources = GameState.getResources();
        const price = this.getEffectivePrice(item);

        if (item.currency === 'coins') {
            return resources.coins >= price;
        } else if (item.currency === 'gems') {
            return resources.gems >= price;
        }

        return false;
    },
    
    /**
     * Purchase item
     */
    purchase(itemId) {
        const item = this.getItem(itemId);
        
        if (!item) {
            console.error('Item not found:', itemId);
            return { success: false, error: 'Item not found' };
        }
        
        // Check if can afford
        if (!this.canAfford(itemId)) {
            EventBus.emit(GameEvents.PURCHASE_FAILED, {
                itemId,
                reason: 'insufficient_funds'
            });
            
            return {
                success: false,
                error: 'Không đủ tiền'
            };
        }
        
        // Deduct currency (using effective/discounted price)
        const effectivePrice = this.getEffectivePrice(item);
        let deducted = false;
        if (item.currency === 'coins') {
            deducted = GameState.useCoins(effectivePrice);
        } else if (item.currency === 'gems') {
            deducted = GameState.useGems(effectivePrice);
        }
        
        if (!deducted) {
            return {
                success: false,
                error: 'Failed to deduct currency'
            };
        }
        
        // Apply item effect
        const effectResult = this.applyEffect(item);
        
        if (!effectResult.success) {
            // Refund if effect failed
            if (item.currency === 'coins') {
                GameState.addCoins(item.price);
            } else if (item.currency === 'gems') {
                GameState.addGems(item.price);
            }
            
            return effectResult;
        }
        
        // Update purchase record
        item.purchaseCount++;
        item.purchased = true;
        
        // Emit event
        EventBus.emit(GameEvents.ITEM_PURCHASED, {
            item,
            effect: effectResult.effect
        });
        
        return {
            success: true,
            item,
            effect: effectResult.effect
        };
    },
    
    /**
     * Apply item effect
     */
    applyEffect(item) {
        const effect = item.effect;

        try {
            switch (effect.type) {
                case 'energy':
                    GameState.addEnergy(effect.amount);
                    return {
                        success: true,
                        effect: `Đã nạp ${effect.amount} năng lượng`
                    };

                case 'hints':
                    const resources = GameState.getResources();
                    GameState.state.resources.hints = (resources.hints || 0) + effect.amount;
                    GameState.save();
                    return {
                        success: true,
                        effect: `Đã nhận ${effect.amount} gợi ý`
                    };

                case 'boost':
                    GameState.activateBoost(
                        effect.boostType,
                        effect.multiplier,
                        effect.duration
                    );
                    return {
                        success: true,
                        effect: `Đã kích hoạt x${effect.multiplier} ${effect.boostType.toUpperCase()}`
                    };

                case 'shield':
                    const currentShields = GameState.getResources().shields || 0;
                    GameState.state.resources.shields = currentShields + effect.amount;
                    GameState.save();
                    return {
                        success: true,
                        effect: `Đã nhận ${effect.amount} khiên bảo vệ`
                    };

                case 'timeFreeze':
                    const currentTimeFreezes = GameState.getResources().timeFreezes || 0;
                    GameState.state.resources.timeFreezes = currentTimeFreezes + effect.amount;
                    GameState.save();
                    return {
                        success: true,
                        effect: `Đã nhận ${effect.amount} lượt dừng thời gian`
                    };

                case 'coins':
                    GameState.addCoins(effect.amount);
                    return {
                        success: true,
                        effect: `Đã nhận ${effect.amount} coins`
                    };

                case 'gems':
                    GameState.addGems(effect.amount);
                    return {
                        success: true,
                        effect: `Đã nhận ${effect.amount} gems`
                    };

                case 'combo':
                    // Apply multiple effects
                    const results = [];
                    for (const comboItem of effect.items) {
                        const comboEffect = this.applyEffect({ effect: comboItem });
                        if (comboEffect.success) {
                            results.push(comboEffect.effect);
                        }
                    }
                    return {
                        success: true,
                        effect: `Đã nhận: ${results.join(', ')}`
                    };

                case 'vip':
                    // Activate VIP status
                    const expiresAt = Date.now() + (effect.duration * 1000);
                    GameState.state.vip = {
                        active: true,
                        expiresAt: expiresAt
                    };
                    GameState.save();

                    const days = Math.floor(effect.duration / 86400);
                    return {
                        success: true,
                        effect: `Đã kích hoạt VIP trong ${days} ngày`
                    };

                case 'permanent':
                    // Handle permanent features
                    if (effect.feature === 'noAds') {
                        GameState.state.settings.adsRemoved = true;
                        GameState.save();
                        return {
                            success: true,
                            effect: 'Đã tắt quảng cáo vĩnh viễn'
                        };
                    }
                    break;

                default:
                    console.warn('Unknown effect type:', effect.type);
                    return {
                        success: false,
                        error: 'Unknown effect type'
                    };
            }
        } catch (error) {
            console.error('Error applying effect:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    /**
     * Get purchase confirmation message
     */
    getConfirmationMessage(itemId) {
        const item = this.getItem(itemId);
        if (!item) return '';
        
        const currencyIcon = item.currency === 'coins' ? '🪙' : '💎';
        
        return `
            <div class="purchase-confirmation">
                <div class="item-icon">${item.icon}</div>
                <h3>${item.name}</h3>
                <p>${item.description}</p>
                <div class="price">
                    ${currencyIcon} ${item.price} ${item.currency}
                </div>
            </div>
        `;
    },
    
    /**
     * Handler: Item purchased
     */
    onItemPurchased(data) {
        console.log('Item purchased:', data);
        
        // Show success notification
        Notification.show({
            type: 'success',
            title: 'Mua thành công!',
            message: data.effect
        });
        
        // Play sound
        if (GameState.state.settings.soundEnabled) {
            Utils.playSound(Config.sounds.coin, 0.5);
        }
    },
    
    /**
     * Show purchase dialog
     */
    showPurchaseDialog(itemId) {
        const item = this.getItem(itemId);
        
        if (!item) {
            Notification.show({
                type: 'error',
                title: 'Lỗi',
                message: 'Không tìm thấy sản phẩm'
            });
            return;
        }
        
        // Check if can afford
        if (!this.canAfford(itemId)) {
            const currency = item.currency === 'coins' ? 'coins' : 'gems';
            
            Notification.show({
                type: 'warning',
                title: 'Không đủ tiền!',
                message: `Bạn cần ${item.price} ${currency} để mua.`
            });
            return;
        }
        
        // Show confirmation modal
        Modal.show({
            title: 'Xác nhận mua',
            content: this.getConfirmationMessage(itemId),
            buttons: [
                {
                    text: 'Hủy',
                    className: 'btn-secondary',
                    onClick: () => Modal.close()
                },
                {
                    text: 'Mua ngay',
                    className: 'btn-primary',
                    onClick: () => {
                        const result = this.purchase(itemId);
                        
                        if (result.success) {
                            Modal.close();
                        } else {
                            Notification.show({
                                type: 'error',
                                title: 'Lỗi',
                                message: result.error
                            });
                        }
                    }
                }
            ]
        });
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Shop;
}