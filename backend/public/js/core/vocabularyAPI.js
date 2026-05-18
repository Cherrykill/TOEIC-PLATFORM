// ===================================
// VOCABULARY API SERVICE
// ===================================

const VocabularyAPI = {
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
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VocabularyAPI;
}
