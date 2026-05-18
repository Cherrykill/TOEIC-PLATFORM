// ===================================
// SHOP CATALOG API SERVICE
// ===================================
// Item list (raw fetch, shape preserved). Purchase still goes through
// API.shop.purchase in http.js. Pure move from ShopScreen.

export const ShopCatalogAPI = {
    /** @returns parsed JSON, {success:false} on error. */
    async items() {
        return fetch('/api/shop/items')
            .then(r => r.json())
            .catch(() => ({ success: false }));
    },
};
