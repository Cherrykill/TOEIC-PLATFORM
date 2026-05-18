// ===================================
// PART SELECTOR MODULE - FIXED
// ===================================

const PartSelector = {
    parts: [],
    selectedPart: null,
    practiceMode: 'random-all', // 'sequential' | 'random-part' | 'random-all'
    partCounts: {},
    retryWords: null, // Khi set, getWordsForPractice sẽ trả về danh sách này (retry câu sai)
    pendingMode: null, // Mode chờ start sau khi chọn part

    /**
     * Initialize Part Selector
     */
    async init() {
        console.log('🎯 Initializing Part Selector...');
        await this.loadParts();
        this.attachListeners();
        this.loadSelectedPart();
        this.updateSessionBadge();
    },

    /**
     * Load available parts from vocabulary
     */
    async loadParts() {
        try {
            const vocabulary = GameLogic.vocabularyData || [];

            // Get unique parts
            const partSet = new Set();
            vocabulary.forEach(word => {
                if (word.part) {
                    partSet.add(word.part);
                }
            });

            // Convert to array and sort
            this.parts = Array.from(partSet).sort();

            // Count words per part
            this.partCounts = {};
            this.parts.forEach(part => {
                this.partCounts[part] = vocabulary.filter(w => w.part === part).length;
            });

            console.log(`✅ Loaded ${this.parts.length} parts`);

        } catch (error) {
            console.error('Error loading parts:', error);
            this.parts = [];
        }
    },

    /**
     * Load selected part and practice mode from storage
     */
    async loadSelectedPart() {
        const [savedPart, savedMode] = await Promise.all([
            Storage.get('selectedPart'),
            Storage.get('practiceMode'),
        ]);

        console.log('🔄 Restoring selected part:', savedPart, '| mode:', savedMode);

        if (savedPart && this.parts.includes(savedPart)) {
            this.selectedPart = savedPart;
            GameState.state.settings.selectedPart = savedPart;
            this.updatePartBadge();
            console.log('✅ Part restored:', savedPart);
        } else if (savedPart) {
            console.warn('⚠️ Saved part not found in current vocabulary:', savedPart);
        }

        if (savedMode) {
            this.practiceMode = savedMode;
            // Sync randomQuestions to match saved mode
            GameState.state.settings.randomQuestions = savedMode !== 'sequential';
        }

        this.updateSessionBadge();
    },

    /**
     * Attach event listeners
     */
    attachListeners() {
        const partBtn = document.getElementById('part-selector-btn');
        if (partBtn) {
            partBtn.addEventListener('click', () => {
                this.showPartSelectionModal();
            });
        }

        // Clear part button
        const clearPartBtn = document.getElementById('clear-part-btn');
        if (clearPartBtn) {
            clearPartBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.clearPart();
            });
        }
    },

    /**
     * Show Part Selection Modal
     */
    showPartSelectionModal() {
        let currentMode = this.practiceMode || 'random-all';

        const getLevelBar = (part) => {
            const words = GameLogic.vocabularyData.filter(w => w.part === part);
            const total = words.length;
            if (!total) return '';
            const a = words.filter(w => w.level && (w.level.startsWith('A'))).length;
            const b = words.filter(w => w.level && (w.level.startsWith('B'))).length;
            const c = words.filter(w => w.level && (w.level.startsWith('C'))).length;
            const pA = Math.round(a / total * 100);
            const pB = Math.round(b / total * 100);
            const pC = 100 - pA - pB;
            const segments = [
                a ? `<div style="flex:${pA};background:#22c55e;height:100%;border-radius:${b||c?'3px 0 0 3px':'3px'}" title="A1-A2: ${a} từ"></div>` : '',
                b ? `<div style="flex:${pB};background:#f59e0b;height:100%" title="B1-B2: ${b} từ"></div>` : '',
                c ? `<div style="flex:${pC};background:#ef4444;height:100%;border-radius:${a||b?'0 3px 3px 0':'3px'}" title="C1-C2: ${c} từ"></div>` : '',
            ].join('');
            const labels = [
                a ? `<span style="color:#22c55e">A: ${a}</span>` : '',
                b ? `<span style="color:#f59e0b">B: ${b}</span>` : '',
                c ? `<span style="color:#ef4444">C: ${c}</span>` : '',
            ].filter(Boolean).join(' · ');
            return `
                <div style="margin-top:6px">
                    <div style="display:flex;height:5px;border-radius:3px;overflow:hidden;gap:1px">${segments}</div>
                    <div style="display:flex;gap:6px;font-size:10px;margin-top:3px;opacity:0.85">${labels}</div>
                </div>`;
        };

        const renderModal = () => {
            const partsHTML = this.parts.map(part => {
                const isSelected = this.selectedPart === part;
                const disabled = currentMode === 'random-all';
                const levelBar = !disabled ? getLevelBar(part) : '';
                return `
                    <div class="topic-card ${isSelected ? 'selected' : ''} ${disabled ? 'part-card-disabled' : ''}"
                         data-part="${part}" style="cursor: ${disabled ? 'not-allowed' : 'pointer'};">
                        <div class="topic-icon"><i class="fas fa-layer-group"></i></div>
                        <div class="topic-info">
                            <h3>${part}</h3>
                            <p>${this.partCounts[part]} từ vựng</p>
                            ${levelBar}
                        </div>
                        ${isSelected ? '<div class="topic-action"><i class="fas fa-check-circle" style="color:#10b981;font-size:20px;"></i></div>' : ''}
                    </div>
                `;
            }).join('');

            const modes = [
                { id: 'sequential',  icon: 'fa-list-ol',  label: 'Tuần tự',           sub: 'Học lần lượt từ đầu đến cuối Part' },
                { id: 'random-part', icon: 'fa-shuffle',  label: 'Ngẫu nhiên 1 Part',  sub: 'Lấy ngẫu nhiên trong Part đã chọn' },
                { id: 'random-all',  icon: 'fa-globe',    label: 'Ngẫu nhiên tất cả',  sub: 'Lấy ngẫu nhiên từ toàn bộ Parts' },
            ];

            const modesHTML = modes.map(m => `
                <button class="pmode-btn ${currentMode === m.id ? 'pmode-btn--active' : ''}" data-mode="${m.id}">
                    <i class="fas ${m.icon}"></i>
                    <span class="pmode-label">${m.label}</span>
                    <span class="pmode-sub">${m.sub}</span>
                </button>
            `).join('');

            return `
                <div class="part-selector-modal">
                    <div class="pmode-group">${modesHTML}</div>
                    ${currentMode === 'random-all' ? `
                        <p class="pmode-hint pmode-hint--disabled"><i class="fas fa-lock"></i> Chế độ này không cần chọn Part</p>
                    ` : (!this.selectedPart ? `
                        <p class="pmode-hint pmode-hint--warn"><i class="fas fa-triangle-exclamation"></i> Chưa chọn Part — sẽ lấy ngẫu nhiên toàn bộ từ vựng</p>
                    ` : `
                        <p class="pmode-hint"><i class="fas fa-info-circle"></i> Chọn Part bên dưới để áp dụng</p>
                    `)}
                    <div class="topics-grid ${currentMode === 'random-all' ? 'topics-grid--disabled' : ''}">
                        ${partsHTML || '<p style="text-align:center;color:#999;">Không có Parts</p>'}
                    </div>
                </div>
            `;
        };

        Modal.show({
            title: '📚 Chọn Part để luyện tập',
            content: renderModal(),
            onClose: () => { this.pendingMode = null; },
        });

        const attachListeners = () => {
            // Mode buttons
            document.querySelectorAll('.pmode-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const mode = btn.dataset.mode;
                    currentMode = mode;
                    this.practiceMode = mode;
                    await Storage.set('practiceMode', mode);

                    if (mode === 'sequential') {
                        await this._saveSetting('randomQuestions', false);
                    } else {
                        await this._saveSetting('randomQuestions', true);
                    }

                    if (mode === 'random-all') {
                        this.selectedPart = null;
                        GameState.state.settings.selectedPart = null;
                        await Storage.remove('selectedPart');
                        this.updatePartBadge();
                        await GameState.save();
                    }

                    // Re-render modal content
                    const body = document.querySelector('.modal-body');
                    if (body) {
                        body.innerHTML = renderModal();
                        attachListeners();
                    }
                });
            });

            // Part cards
            document.querySelectorAll('.topic-card[data-part]').forEach(card => {
                card.addEventListener('click', async () => {
                    if (currentMode === 'random-all') {
                        // Tự động chuyển sang random-part khi click part trong mode random-all
                        currentMode = 'random-part';
                        this.practiceMode = 'random-part';
                        await Storage.set('practiceMode', 'random-part');
                        await this._saveSetting('randomQuestions', true);
                        const body = document.querySelector('.modal-body');
                        if (body) { body.innerHTML = renderModal(); attachListeners(); }
                        return;
                    }
                    this.selectPart(card.dataset.part);
                });
            });
        };

        attachListeners();
    },

    async _saveSetting(key, value) {
        GameState.state.settings[key] = value;
        await GameState.save();
        if (typeof SettingsUI !== 'undefined') {
            const toggle = document.getElementById('random-questions-toggle');
            if (toggle) toggle.checked = GameState.state.settings.randomQuestions !== false;
            PartSelector.updateSessionBadge();
        }
    },

    /**
     * Set random mode (clear part selection)
     */
    async setRandomMode() {
        this.selectedPart = null;
        GameState.state.settings.selectedPart = null;
        await Storage.remove('selectedPart');
        this.updatePartBadge();

        // Save state
        await GameState.save();

        // Close modal
        Modal.close();

        // Show notification
        Notification.show({
            type: 'success',
            title: '🎲 Chế độ ngẫu nhiên',
            message: 'Đã chuyển sang luyện tập từ vựng ngẫu nhiên từ tất cả Parts',
        });
    },

    /**
     * Select a part
     */
    async selectPart(part) {
        this.selectedPart = part;
        // ✅ Update the setting in GameState. GameState.save() will handle persistence.
        GameState.state.settings.selectedPart = part;

        // ✅ ALSO save directly to localStorage for redundancy
        await Storage.set('selectedPart', part);

        // ✅ REUSE: Use the existing GameLogic function to get words
        const partWords = GameLogic.getWordsByPart(part);

        console.log(`✅ Selected Part: ${part} (${partWords.length} words)`);

        // Update badge
        this.updatePartBadge();

        // Save the entire game state
        await GameState.save();

        // Close modal
        Modal.close();

        // Auto-start pending mode if exists
        if (this.pendingMode) {
            const mode = this.pendingMode;
            this.pendingMode = null;
            Notification.show({
                type: 'success',
                title: `✅ Đã chọn ${part}`,
                message: `Bắt đầu luyện tập với ${partWords.length} từ...`,
                duration: 1500,
            });
            setTimeout(() => PracticeManager.start(mode), 300);
        } else {
            Notification.show({
                type: 'success',
                title: `✅ Đã chọn ${part}`,
                message: `${partWords.length} từ vựng sẵn sàng!`,
            });
        }
    },

    /**
     * Update part badge display
     */
    updatePartBadge() {
        const badge = document.getElementById('part-badge');
        const badgeText = document.getElementById('part-badge-text');

        if (this.selectedPart) {
            if (badge) badge.style.display = 'flex';
            if (badgeText) badgeText.textContent = this.selectedPart;
        } else {
            if (badge) badge.style.display = 'none';
        }

        this.updateSessionBadge();
    },

    updateSessionBadge() {
        const el = document.getElementById('session-info-text');
        if (!el) return;
        const settings = GameState.state?.settings || {};
        const count = settings.questionsPerSession || 20;
        const modeLabels = { sequential: 'Tuần tự', 'random-part': 'Ngẫu nhiên Part', 'random-all': 'Ngẫu nhiên' };
        const modeLabel = modeLabels[this.practiceMode] || 'Ngẫu nhiên';
        el.textContent = `${count} câu • ${modeLabel}`;
    },

    /**
     * Clear selected part
     */
    async clearPart() {
        this.selectedPart = null;
        await Storage.remove('selectedPart');
        this.updatePartBadge();

        Notification.show({
            type: 'info',
            title: 'Đã xóa Part',
            message: 'Quay về chế độ ngẫu nhiên',
        });
    },

    /**
     * Clear selection (called when topic changes)
     */
    clearSelection() {
        this.selectedPart = null;
        this.updatePartBadge();
        Storage.remove('selectedPart');
        console.log('✅ Part selection cleared due to topic change');
    },

    /**
     * Reload parts (called when vocabulary changes)
     */
    async reloadParts() {
        await this.loadParts();
        console.log('✅ Parts reloaded after vocabulary change');
    },

    /**
     * ✅ FIXED: Get words for practice (based on settings with level filter)
     */
    async getWordsForPractice(requestedCount) {
        // ✅ Retry mode: trả về danh sách câu sai từ session trước
        if (this.retryWords && this.retryWords.length > 0) {
            const words = [...this.retryWords];
            this.retryWords = null;
            console.log(`🔁 Retry mode: returning ${words.length} wrong words from last session`);
            return words;
        }

        // ✅ Đọc settings và selectedPart từ GameState để đảm bảo tính nhất quán
        const settings = GameState.state.settings;
        const isRandomQuestions = settings.randomQuestions !== false; // Default: true
        this.selectedPart = settings.selectedPart || null; // ✅ Cập nhật selectedPart từ GameState

        console.log('');
        console.log('%c╔══════════════════════════════════════════════════════╗', 'color: cyan');
        console.log('%c║          🎯 GET WORDS FOR PRACTICE                   ║', 'color: cyan; font-weight: bold');
        console.log('%c╠══════════════════════════════════════════════════════╣', 'color: cyan');
        console.log('%c║ Selected Part:', 'color: yellow', this.selectedPart || 'NONE');
        console.log('%c║ Random Questions:', 'color: yellow', isRandomQuestions);
        console.log('%c║ Requested Count:', 'color: yellow', requestedCount);
        console.log('%c║ Level Filter:', 'color: yellow', settings.levelFilter || 'NONE (all levels)');

        // ✅ Lấy pool từ Part hoặc toàn bộ vocab (có level filter)
        let pool;
        if (this.selectedPart) {
            pool = GameLogic.getWordsByPart(this.selectedPart);
        } else {
            const levelFilter = settings.levelFilter;
            pool = (levelFilter && levelFilter.length > 0)
                ? GameLogic.vocabularyData.filter(w => w.level && levelFilter.includes(w.level))
                : [...GameLogic.vocabularyData];
        }

        // Áp dụng questionsPerSession cho cả 2 trường hợp (chọn part hay không)
        const rawQPS = settings.questionsPerSession;
        const isAutoMode = rawQPS === 'auto';
        const limit = isAutoMode ? null : (rawQPS || requestedCount || 20);
        const effectiveLimit = limit !== null ? limit : pool.length;

        // ✅ Ngẫu nhiên hoặc tuần tự, luôn giới hạn theo limit
        let result;
        if (isRandomQuestions) {
            result = Utils.randomSample(pool, Math.min(effectiveLimit, pool.length));
            console.log('%c║ 🔀 Mode: RANDOM', 'color: orange; font-weight: bold', `${result.length}/${pool.length} words`);
        } else {
            result = pool.slice(0, effectiveLimit);
            console.log('%c║ 📋 Mode: SEQUENTIAL', 'color: lime; font-weight: bold', `${result.length}/${pool.length} words`);
        }

        console.log('%c╚══════════════════════════════════════════════════════╝', 'color: cyan');
        console.log('');
        return result;
    },

    /**
     * Reset to all vocabulary
     */
    reset() {
        this.clearPart();
    },
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PartSelector;
}