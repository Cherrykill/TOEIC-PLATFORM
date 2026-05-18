// ===================================
// VOCABULARY API SERVICE
// ===================================

export const VocabularyAPI = {
    /**
     * Get list of available vocabulary sources from MongoDB
     */
    async getFiles() {
        const res = await fetch('/api/vocabulary/files');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return json.data || [];
    },

    /**
     * Get all words for a given source from MongoDB
     */
    async getWordsBySource(source) {
        const res = await fetch(`/api/vocabulary?source=${encodeURIComponent(source)}&limit=9999&page=1`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return json.data || [];
    },

    /**
     * Search vocabulary. Resolves to `{ success:false }` on network error
     * (never throws) — matches the previous inline behaviour in
     * SearchResults.jsx.
     * @returns {Promise<{success:boolean,data?:any[]}>}
     */
    async search(query, limit = 20) {
        return fetch(`/api/vocabulary/search?q=${encodeURIComponent(query)}&limit=${limit}`)
            .then(r => r.json())
            .catch(() => ({ success: false }));
    },
};

if (typeof window !== 'undefined') {
    window.VocabularyAPI = VocabularyAPI;
}
