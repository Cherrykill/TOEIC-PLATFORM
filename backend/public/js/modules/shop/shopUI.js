// ===================================
// SHOP MODULE - UI
// ===================================

const ShopUI = {
    
    // DOM elements
    elements: {
        container: null,
        content: null
    },
    
    /**
     * Initialize UI
     */
    init() {
        this.elements.container = document.getElementById('shop-screen');
        this.elements.content = document.getElementById('shop-content');
        
        // Render shop when screen becomes active
        EventBus.on(GameEvents.SCREEN_CHANGED, (data) => {
            if (data.screen === 'shop-screen') {
                this.render();
            }
        });
        
        // Update shop when purchase happens
        EventBus.on(GameEvents.ITEM_PURCHASED, () => {
            this.render();
        });
        
        // Update when currency changes
        EventBus.on(GameEvents.COINS_CHANGED, () => {
            this.updateAffordability();
        });
        
        EventBus.on(GameEvents.GEMS_CHANGED, () => {
            this.updateAffordability();
        });
    },
    
    /**
     * Render shop items
     */
    render() {
        if (!this.elements.content) return;
        
        const items = Shop.getItems();
        
        if (items.length === 0) {
            this.elements.content.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-shopping-cart"></i>
                    <p>Cửa hàng đang cập nhật...</p>
                </div>
            `;
            return;
        }
        
        const html = items.map(item => this.renderItem(item)).join('');
        this.elements.content.innerHTML = html;
        
        // Attach event listeners
        this.attachEventListeners();
    },
    
    /**
     * Render single shop item
     */
    renderItem(item) {
        const canAfford = Shop.canAfford(item.id);
        const effectivePrice = Shop.getEffectivePrice(item);
        const hasDiscount = item.discountPercent > 0;

        const currencyIcon = item.currency === 'coins'
            ? '<i class="fas fa-coins"></i>'
            : '<i class="fas fa-gem"></i>';

        const priceHtml = hasDiscount
            ? `<div class="shop-item-price ${item.currency}">
                   <s class="price-original">${currencyIcon} ${item.price}</s>
                   <span class="price-sale">${currencyIcon} ${effectivePrice}</span>
                   <span class="discount-badge">-${item.discountPercent}%</span>
               </div>`
            : `<div class="shop-item-price ${item.currency}">
                   ${currencyIcon}
                   <span class="price-amount">${item.price}</span>
               </div>`;

        const affordableClass = canAfford ? 'can-afford' : 'cannot-afford';

        return `
            <div class="shop-item ${affordableClass}${hasDiscount ? ' on-sale' : ''}" data-item-id="${item.id}">
                ${hasDiscount ? '<div class="sale-ribbon">SALE</div>' : ''}
                <div class="shop-item-icon">${item.icon}</div>
                <div class="shop-item-title">${item.name}</div>
                <div class="shop-item-description">${item.description}</div>
                ${priceHtml}
                ${item.purchaseCount > 0 ? `
                    <div class="purchase-count">Đã mua: ${item.purchaseCount} lần</div>
                ` : ''}
                <button class="buy-btn ${canAfford ? '' : 'btn-disabled'}"
                        data-item-id="${item.id}"
                        ${!canAfford ? 'disabled' : ''}>
                    ${canAfford ? 'Mua ngay' : 'Không đủ tiền'}
                </button>
            </div>
        `;
    },
    
    /**
     * Attach event listeners
     */
    attachEventListeners() {
        const buyButtons = this.elements.content.querySelectorAll('.buy-btn');
        
        buyButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemId = button.dataset.itemId;
                this.onBuyClick(itemId);
            });
        });
        
        // Click on item card to show details
        const itemCards = this.elements.content.querySelectorAll('.shop-item');
        
        itemCards.forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't trigger if clicking on buy button
                if (e.target.classList.contains('buy-btn')) return;
                
                const itemId = card.dataset.itemId;
                this.showItemDetails(itemId);
            });
        });
    },
    
    /**
     * Handle buy button click
     */
    onBuyClick(itemId) {
        Shop.showPurchaseDialog(itemId);
    },
    
    /**
     * Show item details
     */
    showItemDetails(itemId) {
        const item = Shop.getItem(itemId);
        if (!item) return;
        
        const canAfford = Shop.canAfford(itemId);
        const resources = GameState.getResources();
        const currentAmount = item.currency === 'coins' ? resources.coins : resources.gems;
        
        const currencyIcon = item.currency === 'coins' ? '🪙' : '💎';
        const effectivePrice = Shop.getEffectivePrice(item);
        const hasDiscount = item.discountPercent > 0;

        const priceDisplay = hasDiscount
            ? `<s style="color:#999;font-size:14px">${currencyIcon} ${item.price}</s>
               <strong style="color:#e53e3e;font-size:20px"> ${currencyIcon} ${effectivePrice}</strong>
               <span style="background:#fed7d7;color:#c53030;padding:2px 6px;border-radius:4px;font-size:12px;font-weight:700">-${item.discountPercent}%</span>`
            : `<strong>${currencyIcon} ${item.price} ${item.currency}</strong>`;

        Modal.show({
            title: item.name,
            content: `
                <div class="shop-item-details">
                    <div class="item-icon-large">${item.icon}</div>
                    <p class="item-description">${item.description}</p>
                    <div class="item-price-display">
                        <span class="label">Giá:</span>
                        <span class="price">${priceDisplay}</span>
                    </div>
                    <div class="item-balance">
                        <span class="label">Bạn có:</span>
                        <span class="balance">${currencyIcon} ${currentAmount} ${item.currency}</span>
                    </div>
                    ${item.purchaseCount > 0 ? `
                        <div class="item-stats">Đã mua ${item.purchaseCount} lần</div>
                    ` : ''}
                </div>
            `,
            buttons: [
                {
                    text: 'Đóng',
                    className: 'btn-secondary',
                    onClick: () => Modal.close()
                },
                {
                    text: 'Mua ngay',
                    className: canAfford ? 'btn-primary' : 'btn-disabled',
                    disabled: !canAfford,
                    onClick: () => {
                        Modal.close();
                        Shop.showPurchaseDialog(itemId);
                    }
                }
            ]
        });
    },
    
    /**
     * Update affordability status
     */
    updateAffordability() {
        if (!this.elements.content) return;
        
        const items = this.elements.content.querySelectorAll('.shop-item');
        
        items.forEach(itemElement => {
            const itemId = itemElement.dataset.itemId;
            const canAfford = Shop.canAfford(itemId);
            
            if (canAfford) {
                itemElement.classList.add('can-afford');
                itemElement.classList.remove('cannot-afford');
            } else {
                itemElement.classList.add('cannot-afford');
                itemElement.classList.remove('can-afford');
            }
            
            const buyButton = itemElement.querySelector('.buy-btn');
            if (buyButton) {
                if (canAfford) {
                    buyButton.disabled = false;
                    buyButton.classList.remove('btn-disabled');
                    buyButton.textContent = 'Mua ngay';
                } else {
                    buyButton.disabled = true;
                    buyButton.classList.add('btn-disabled');
                    buyButton.textContent = 'Không đủ tiền';
                }
            }
        });
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShopUI;
}