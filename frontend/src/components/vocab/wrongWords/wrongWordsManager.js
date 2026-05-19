import { GameState } from '@game/state.js';
import { Notification } from '@ui/Toaster.jsx';

export const WrongWordsManager = {
    baseURL: '/api/wrong-words',
    cache: null,
    lastFetch: 0,
    cacheDuration: 60000,

    getToken() {
        const tokenData = localStorage.getItem('authToken');
        if (!tokenData) return null;

        try {
            const parsed = JSON.parse(tokenData);
            return parsed.token || tokenData;
        } catch {
            return tokenData;
        }
    },

    async request(endpoint, options = {}) {
        const token = this.getToken();

        console.log('🔑 WrongWordsManager.request() DEBUG:');
        console.log('   Endpoint:', endpoint);
        console.log('   Token exists:', !!token);
        console.log('   Token value:', token ? token.substring(0, 30) + '...' : 'NULL');

        if (!token) {
            console.error('❌ NO AUTH TOKEN - Request aborted!');
            console.error('   localStorage authToken:', localStorage.getItem('authToken'));
            return { success: false, error: 'Not authenticated' };
        }

        const url = `${this.baseURL}${endpoint}`;

        const config = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...options.headers
            }
        };

        console.log('📤 Sending fetch request to:', url);

        try {
            const response = await fetch(url, config);
            console.log('📥 Response status:', response.status, response.statusText);

            const data = await response.json();
            console.log('📥 Response data:', data);

            if (!response.ok) {
                console.error(`API Error [${response.status}]:`, data);
                return { success: false, error: data.message || 'API Error' };
            }

            return data;
        } catch (error) {
            console.error('Network error:', error);
            return { success: false, error: error.message };
        }
    },

    async addWrongWord(word) {
        console.log('📝 Adding wrong word - Full object:', word);

        const wordId = word.id || word.wordId || word.en;
        const wordText = word.en || word.word;
        const meaning = word.vn || word.vi || word.meaning || word.meanings?.[0];

        if (!wordId || !wordText || !meaning) {
            console.error('❌ Missing required fields:', { wordId, wordText, meaning });
            console.error('   Full word object:', word);
            return { success: false, error: 'Missing required fields' };
        }

        const payload = {
            wordId: wordId,
            en: wordText,
            vn: meaning,
            phonetic: word.phonetic,
            type: word.type,
            level: word.level,
            part: word.part,
            source: word.source || word.topic || '',
            example: word.example,
            image: word.image
        };

        console.log('📤 Sending payload:', payload);

        const result = await this.request('/', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (result.success) {
            this.invalidateCache();
            this.updateUI();
        }

        return result;
    },

    async recordCorrect(wordId) {
        console.log('✅ Recording correct:', wordId);

        const result = await this.request(`/${wordId}/correct`, {
            method: 'POST'
        });

        if (result.success) {
            this.invalidateCache();
            this.updateUI();

            if (result.data?.status === 'mastered') {
                Notification.show({
                    type: 'success',
                    title: 'Tuyệt vời!',
                    message: `Bạn đã thuộc từ "${result.data.word}"!`,
                    duration: 3000
                });
            }
        }

        return result;
    },

    async getWordsToReview(limit = 10) {
        const result = await this.request(`/review?limit=${limit}`);

        if (result.success) {
            return result.data || [];
        }

        return [];
    },

    async getAllWrongWords(forceRefresh = false) {
        console.log('🔍 getAllWrongWords() called, forceRefresh:', forceRefresh);
        const now = Date.now();

        if (!forceRefresh && this.cache && (now - this.lastFetch < this.cacheDuration)) {
            console.log('   Using cached data:', this.cache);
            return this.cache;
        }

        console.log('   Calling API GET /api/wrong-words...');
        const result = await this.request('/');
        console.log('   API Response:', result);

        if (result.success) {
            this.cache = result.data || [];
            this.lastFetch = now;
            return this.cache;
        }

        return [];
    },

    async deleteWrongWord(wordId) {
        const result = await this.request(`/${wordId}`, {
            method: 'DELETE'
        });

        if (result.success) {
            this.invalidateCache();
            this.updateUI();
        }

        return result;
    },

    async getStats() {
        const result = await this.request('/stats');

        if (result.success) {
            return result.data;
        }

        return null;
    },

    async bulkUpdate(words) {
        console.log(`📦 Bulk updating ${words.length} words...`);

        const result = await this.request('/bulk', {
            method: 'POST',
            body: JSON.stringify({ words })
        });

        if (result.success) {
            this.invalidateCache();
            console.log('✅ Bulk update complete');
        }

        return result;
    },

    async migrateFromGameState() {
        const oldWrongWords = GameState.state?.progress?.wrongWords;

        if (!oldWrongWords || oldWrongWords.length === 0) {
            console.log('ℹ️ No old wrong words to migrate');
            return;
        }

        console.log(`🔄 Migrating ${oldWrongWords.length} words from GameState...`);

        const result = await this.bulkUpdate(oldWrongWords);

        if (result.success) {
            GameState.state.progress.wrongWords = [];
            await GameState.save();

            Notification.show({
                type: 'success',
                title: 'Đã chuyển đổi dữ liệu',
                message: `Đã chuyển ${oldWrongWords.length} từ sang hệ thống mới`,
                duration: 4000
            });
        }

        return result;
    },

    invalidateCache() {
        this.cache = null;
        this.lastFetch = 0;
    },

    async updateUI() {
        try {
            console.log('🎨 updateUI() called');
            const words = await this.getAllWrongWords(true);
            console.log(`   Found ${words.length} words to display`);

            const wrongWordsCountEl = document.querySelector('#wrong-words-count span');
            console.log('   wrongWordsCountEl:', wrongWordsCountEl);

            if (wrongWordsCountEl) {
                wrongWordsCountEl.textContent = words.length;
                console.log(`   ✅ Updated UI: ${words.length} words`);
            } else {
                console.error('   ❌ Element #wrong-words-count span NOT FOUND in DOM!');
            }

            const reviewCard = document.querySelector('.game-mode-card[data-mode="review-mistakes"]');
            console.log('   reviewCard:', reviewCard);

            if (reviewCard && words.length > 0) {
                reviewCard.style.border = '2px solid #f39c12';
                console.log('   ✅ Updated card border (has words)');
            } else if (reviewCard) {
                reviewCard.style.border = '2px solid #ddd';
                console.log('   ⚪ Updated card border (no words)');
            }
        } catch (error) {
            console.error('Error updating UI:', error);
        }
    },

    async init() {
        console.log('🔧 Initializing WrongWordsManager...');

        const token = this.getToken();
        if (!token) {
            console.log('👤 Guest mode - WrongWords disabled');
            return;
        }

        const oldWrongWords = GameState.state?.progress?.wrongWords;
        if (oldWrongWords && oldWrongWords.length > 0) {
            await this.migrateFromGameState();
        }

        const wrongWords = await this.getAllWrongWords(true);
        console.log(`📦 Preloaded ${wrongWords.length} wrong words from MongoDB`);

        console.log('⏭️ Skipping updateUI() - will be called by main.js after DOM ready');

        console.log('✅ WrongWordsManager initialized');
    }
};

