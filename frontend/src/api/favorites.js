// ===================================
// FAVORITES API SERVICE
// ===================================
// Thin wrappers over the favorites endpoints. Behaviour is intentionally
// identical to the previous inline fetch calls in useFavorites.js
// (same error-swallowing semantics) — this is a pure move, not a redesign.

import { authHeaders } from '@/auth/token.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const FavoritesAPI = {
    /**
     * @returns {Promise<{success:boolean,data?:any[]}>}
     * Resolves to `{ success:false }` on network error (never throws).
     */
    async list() {
        return fetch('/api/vocabulary/favorites', { headers: authHeaders() })
            .then(r => r.json())
            .catch(() => ({ success: false }));
    },

    /** Fire-and-forget add; errors are swallowed (offline-tolerant). */
    async add(entry) {
        await fetch('/api/vocabulary/favorites', {
            method: 'POST',
            headers: { ...JSON_HEADERS, ...authHeaders() },
            body: JSON.stringify({ word: entry }),
        }).catch(() => {});
    },

    /** Fire-and-forget remove; errors are swallowed (offline-tolerant). */
    async remove(en) {
        await fetch('/api/vocabulary/favorites', {
            method: 'DELETE',
            headers: { ...JSON_HEADERS, ...authHeaders() },
            body: JSON.stringify({ en }),
        }).catch(() => {});
    },
};
