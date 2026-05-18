// ===================================
// HTTP CLIENT - API Wrapper (FIXED)
// ===================================

const Http = {

    // ✅ FIX: Dùng absolute URL từ Config
    get baseURL() {
        // Check if Config exists and has api.baseUrl
        if (typeof Config !== 'undefined' && Config.api && Config.api.baseUrl) {
            return Config.api.baseUrl;
        }
        // Fallback to default
        return 'http://localhost:5000/api';
    },

    // Default headers
    defaultHeaders: {
        'Content-Type': 'application/json'
    },

    // Request timeout
    timeout: 30000,

    /**
     * Make HTTP request
     */
    async request(url, options = {}) {
        // ✅ Nếu url không bắt đầu bằng http, thêm baseURL
        const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;

        const config = {
            method: options.method || 'GET',
            headers: { ...this.defaultHeaders, ...options.headers },
            ...options
        };

        // ✅ FIX: Token is now passed directly from ServerStorage, not fetched here.
        const token = options.token || (typeof ServerStorage !== 'undefined' ? ServerStorage.token : null);
        if (token && token.length > 20) {
            config.headers['Authorization'] = `Bearer ${token}`;
            console.log('🔑 Token attached:', token.substring(0, 30) + '...');
        } else {
            console.warn('⚠️ No token found! Token:', token);
        }

        // Add body if present
        if (options.body && typeof options.body === 'object') {
            config.body = JSON.stringify(options.body);
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            config.signal = controller.signal;

            console.log('🌐 HTTP Request:', config.method, fullUrl);

            const response = await fetch(fullUrl, config);

            clearTimeout(timeoutId);

            // Parse response
            const contentType = response.headers.get('content-type');
            let data;

            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            // Tài khoản bị khóa — emit event để app tự đăng xuất
            if (response.status === 423) {
                const lockType = data.lockType || 'unknown';
                if (typeof EventBus !== 'undefined') {
                    EventBus.emit('account:locked', { lockType, message: data.message });
                }
                return { success: false, error: data.message, code: 'ACCOUNT_LOCKED', locked: true, lockType, data };
            }

            if (!response.ok) {
                throw new Error(data.message || `HTTP Error: ${response.status}`);
            }

            console.log('✅ HTTP Response:', response.status);

            return { success: true, data, status: response.status };

        } catch (error) {
            console.error('❌ HTTP Request Error:', error);

            if (error.name === 'AbortError') {
                return { success: false, error: 'Request timeout', code: 'TIMEOUT' };
            }

            return { success: false, error: error.message, code: 'ERROR' };
        }
    },

    /**
     * GET request
     */
    async get(url, options = {}) {
        return this.request(url, { ...options, method: 'GET' });
    },

    /**
     * POST request
     */
    async post(url, data, options = {}) {
        return this.request(url, { ...options, method: 'POST', body: data });
    },

    /**
     * PUT request
     */
    async put(url, data, options = {}) {
        return this.request(url, { ...options, method: 'PUT', body: data });
    },

    /**
     * PATCH request
     */
    async patch(url, data, options = {}) {
        return this.request(url, { ...options, method: 'PATCH', body: data });
    },

    /**
     * DELETE request
     */
    async delete(url, options = {}) {
        return this.request(url, { ...options, method: 'DELETE' });
    },

    /**
     * Load JSON file (từ frontend folder)
     */
    async loadJSON(path) {
        try {
            // Add cache-busting parameter to avoid stale data
            const cacheBuster = `?_t=${Date.now()}`;
            const url = path + cacheBuster;

            console.log(`📂 Loading JSON: ${path}`);

            const response = await fetch(url, {
                cache: 'no-store' // Force fresh request
            });

            if (!response.ok) {
                throw new Error(`Failed to load ${path}: ${response.status}`);
            }

            const data = await response.json();
            console.log(`✅ Loaded ${path}: ${Array.isArray(data) ? data.length + ' items' : 'object'}`);
            return { success: true, data };

        } catch (error) {
            console.error('JSON Load Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Load vocabulary data
     */
    async loadVocabulary() {
        if (typeof Config !== 'undefined' && Config.data && Config.data.vocabulary) {
            return this.loadJSON(Config.data.vocabulary);
        }
        return this.loadJSON('data/vocabulary.json');
    }
};

// ===================================
// API ENDPOINTS (for backend)
// ===================================

const API = {

    /**
     * Auth endpoints
     */
    auth: {
        async register(userData) {
            return Http.post('/auth/register', userData);
        },

        async login(credentials) {
            return Http.post('/auth/login', credentials);
        },

        async logout() {
            return Http.post('/auth/logout');
        },

        async getMe() {
            return Http.get('/auth/me');
        },

        async updateProfile(updates) {
            return Http.put('/auth/profile', updates);
        },

        async changePassword(passwords) {
            return Http.put('/auth/password', passwords);
        },

        async syncProgress(progressData) {
            return Http.post('/auth/sync', progressData);
        }
    },

    /**
     * User state endpoints
     */
    user: {
        async getState() {
            return Http.get('/user/state');
        },

        async saveState(state) {
            // ⚡️ FIX: Đảm bảo dailyQuests luôn là một mảng object trước khi gửi
            // Vấn đề: Đôi khi state.quests.daily bị biến thành chuỗi không hợp lệ.
            if (state && state.quests && typeof state.quests.daily === 'string') {
                console.warn('⚠️ Detected stringified dailyQuests on client. Attempting to parse...');
                try {
                    // Chuyển chuỗi JS thành chuỗi JSON hợp lệ để parse
                    const jsonString = state.quests.daily
                        .replace(/'/g, '"') // Thay thế ' bằng "
                        .replace(/(\w+):/g, '"$1":') // Thêm "" cho key
                        .replace(/undefined/g, 'null'); // Thay thế undefined bằng null

                    state.quests.daily = JSON.parse(jsonString);
                    console.log('✅ Successfully parsed dailyQuests back to array.');
                } catch (e) {
                    console.error('❌ Failed to parse dailyQuests string on client before sending:', e);
                }
            }
            // ✅ FIX: Don't wrap state in another object
            return Http.post('/user/state', state);
        },

        async updateResources(resources) {
            return Http.patch('/user/resources', resources);
        },

        async updateProgress(progress) {
            return Http.patch('/user/progress', progress);
        },

        async addXp(amount) {
            return Http.post('/user/xp', { amount });
        },

        async unlockAchievement(achievementId, rewards = {}) {
            return Http.post('/user/achievement', { achievementId, ...rewards });
        },

        async updateQuests(quests) {
            return Http.patch('/user/quests', { quests });
        }
    },

    /**
     * Shop endpoints
     */
    shop: {
        async purchase(itemId) {
            return Http.post('/user/shop/purchase', { itemId });
        }
    },

    /**
     * Vocabulary endpoints
     */
    vocabulary: {
        async getAll(params = {}) {
            const query = new URLSearchParams(params).toString();
            return Http.get(`/vocabulary${query ? '?' + query : ''}`);
        },

        async getByPart(part) {
            return Http.get(`/vocabulary/part/${part}`);
        },

        async getById(id) {
            return Http.get(`/vocabulary/${id}`);
        },

        async getRandom(count, params = {}) {
            const query = new URLSearchParams(params).toString();
            return Http.get(`/vocabulary/random/${count}${query ? '?' + query : ''}`);
        },

        async search(query) {
            return Http.get(`/vocabulary/search?q=${encodeURIComponent(query)}`);
        },

        async getStats() {
            return Http.get('/vocabulary/stats');
        }
    },

    /**
     * AI endpoints
     */
    ai: {
        async explainWord(wordEn) {
            return Http.post('/ai/explain', { wordEn });
        },

        async generateQuestions(wordEn, count = 5, type = 'multiple-choice') {
            return Http.post('/ai/generate-questions', { wordEn, count, type });
        },

        async checkGrammar(sentence) {
            return Http.post('/ai/check-grammar', { sentence });
        },

        async chat(message, conversationHistory = []) {
            return Http.post('/ai/chat', { message, conversationHistory });
        }
    },

    /**
     * Leaderboard endpoints (if implemented)
     */
    leaderboard: {
        async getDaily() {
            return Http.get('/leaderboard/daily');
        },

        async getWeekly() {
            return Http.get('/leaderboard/weekly');
        },

        async getAllTime() {
            return Http.get('/leaderboard/all-time');
        },

        async submitScore(scoreData) {
            return Http.post('/leaderboard/submit', scoreData);
        }
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Http, API };
}