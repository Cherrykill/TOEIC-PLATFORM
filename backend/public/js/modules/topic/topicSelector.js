// ===================================
// TOPIC SELECTOR MODULE
// ===================================

const TopicSelector = {

    availableTopics: [],
    currentTopic: null,

    /**
     * Initialize topic selector
     */
    async init() {
        // Load available topics from data folder
        await this.loadAvailableTopics();

        // Set default topic if none selected
        if (!this.currentTopic && this.availableTopics.length > 0) {
            this.currentTopic = this.availableTopics[0];
        }
    },

    /**
     * Load available vocabulary files — quét động từ server, không hardcode
     */
    async loadAvailableTopics() {
        try {
            const res = await fetch('/api/topics');
            const data = await res.json();

            if (!data.success) throw new Error(data.message);

            this.availableTopics = data.data.map(t => ({
                id: t._id,
                name: t.displayName,
                source: t.sourceKeys[0],
                wordCount: t.wordCount || 0,
                icon: t.icon || '📚',
                color: t.color || '#3b82f6',
                description: t.description || '',
            }));
        } catch (err) {
            console.warn('Không thể tải topics từ server:', err);
            this.availableTopics = [];
        }

        console.log(`Loaded ${this.availableTopics.length} vocabulary topics`);
    },

    /**
     * Load vocabulary data from a specific file
     */
    async loadTopicData(filePath) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to load ${filePath}`);
            }
            const text = await response.text();

            // Check if response is empty
            if (!text || text.trim() === '') {
                throw new Error(`Empty file: ${filePath}`);
            }

            return JSON.parse(text);
        } catch (error) {
            console.warn(`Could not load ${filePath}:`, error.message);
            throw error;
        }
    },

    /**
     * Get all available topics
     */
    getAvailableTopics() {
        return this.availableTopics;
    },

    /**
     * Get current selected topic
     */
    getCurrentTopic() {
        return this.currentTopic;
    },

    /**
     * Select a topic
     */
    async selectTopic(topicId, options = {}) {
        console.log(`📚 TopicSelector: Selecting topic ${topicId}...`);

        const topic = this.availableTopics.find(t => t.id === topicId);

        if (!topic) {
            console.error(`❌ Topic ${topicId} not found in:`, this.availableTopics.map(t => t.id));
            throw new Error(`Topic ${topicId} not found`);
        }

        console.log(`📂 Topic found: ${topic.name} (${topic.source})`);

        this.currentTopic = topic;

        // Reset part selection when changing topic
        if (typeof PartSelector !== 'undefined' && PartSelector.clearSelection) {
            PartSelector.clearSelection();
        }

        // Reload vocabulary with selected topic
        console.log(`🔄 Loading vocabulary for source: ${topic.source}`);
        const loaded = await GameLogic.loadVocabularyBySource(topic.source);
        console.log(`✅ Vocabulary loaded: ${loaded}, Total words: ${GameLogic.vocabularyData.length}`);

        // Reload parts list after vocabulary change
        if (typeof PartSelector !== 'undefined' && PartSelector.reloadParts) {
            await PartSelector.reloadParts();
        }

        // Save selection to storage
        await Storage.set('selectedTopic', topicId);

        // Emit event
        EventBus.emit('topic:changed', { topic });

        // Only show notification if not restoring (silent mode)
        if (!options.silent) {
            Notification.show({
                type: 'success',
                title: 'Đã chọn đề',
                message: `${topic.name} - ${topic.wordCount} từ`
            });
        }

        return topic;
    },

    /**
     * Show topic selection modal
     */
    showTopicSelectionModal(onSelect) {
        const topics = this.getAvailableTopics();
        const currentTopicId = this.currentTopic?.id;

        if (topics.length === 0) {
            Notification.show({
                type: 'error',
                title: 'Không có đề nào',
                message: 'Không tìm thấy file vocabulary nào'
            });
            return;
        }

        const topicsHtml = topics.map(topic => `
            <div class="topic-card ${topic.id === currentTopicId ? 'selected' : ''}"
                 data-topic-id="${topic.id}"
                 data-source="${(topic.source || '').toLowerCase()}">
                <div class="topic-icon">${topic.icon}</div>
                <div class="topic-details">
                    <h4>${topic.name}</h4>
                    ${topic.description ? `<p class="topic-description">${topic.description}</p>` : ''}
                    <div class="topic-meta">
                        <span class="word-count">
                            <i class="fas fa-book"></i> ${topic.wordCount} từ
                        </span>
                    </div>
                </div>
                ${topic.id === currentTopicId ? `
                    <div class="current-badge">
                        <i class="fas fa-check-circle"></i> Đang chọn
                    </div>
                ` : ''}
            </div>
        `).join('');

        Modal.show({
            title: '📚 Chọn đề luyện tập',
            headerSearch: {
                placeholder: 'Tìm theo source...',
                onSearch: (q) => {
                    const kw = q.trim().toLowerCase();
                    document.querySelectorAll('.topic-card[data-source]').forEach(card => {
                        const src = card.dataset.source || '';
                        card.style.display = (!kw || src.includes(kw)) ? '' : 'none';
                    });
                },
            },
            content: `
                <div class="topic-selection-container">
                    <div class="topic-tabs">
                        <button class="tab-btn active" data-tab="shared">
                            <i class="fas fa-globe"></i> Từ vựng chung
                        </button>
                        <button class="tab-btn" data-tab="personal">
                            <i class="fas fa-user"></i> Từ vựng riêng
                        </button>
                    </div>

                    <div class="tab-content active" data-tab-content="shared">
                        <p class="topic-hint">Chọn bộ từ vựng bạn muốn luyện tập:</p>
                        <div class="topics-list">
                            ${topicsHtml}
                        </div>
                    </div>

                    <div class="tab-content" data-tab-content="personal">
                        <p class="topic-hint">Từ vựng bạn đã tải lên:</p>
                        <div class="topics-list" id="personal-topics-list">
                            <p style="text-align: center; color: var(--text-secondary); padding: 20px;">
                                <i class="fas fa-spinner fa-spin"></i> Đang tải...
                            </p>
                        </div>
                    </div>
                </div>
            `,
            buttons: [
                {
                    text: 'Đóng',
                    className: 'btn-secondary',
                    onClick: () => Modal.close()
                }
            ]
        });

        // Attach click handlers
        setTimeout(() => {
            // Tab switching
            const tabBtns = document.querySelectorAll('.topic-tabs .tab-btn');
            const tabContents = document.querySelectorAll('[data-tab-content]');

            tabBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const tabName = btn.dataset.tab;

                    tabBtns.forEach(b => b.classList.remove('active'));
                    tabContents.forEach(c => c.classList.remove('active'));

                    btn.classList.add('active');
                    const targetContent = document.querySelector(`[data-tab-content="${tabName}"]`);
                    if (targetContent) targetContent.classList.add('active');

                    if (tabName === 'personal') {
                        this.loadPersonalTopics(onSelect);
                    }
                });
            });

            // Attach card handlers for shared topics
            this.attachCardHandlers(onSelect, currentTopicId);
        }, 100);
    },

    attachCardHandlers(onSelect, currentTopicId) {
        const topicCards = document.querySelectorAll('.topic-card[data-topic-id]');
        topicCards.forEach(card => {
            if (card.dataset.handlerAttached) return;
            card.dataset.handlerAttached = 'true';

            card.addEventListener('click', async () => {
                const topicId = card.dataset.topicId;

                if (topicId === currentTopicId) {
                    Modal.close();
                    return;
                }

                card.classList.add('loading');

                try {
                    await this.selectTopic(topicId);
                    Modal.close();
                    if (onSelect) onSelect(this.getCurrentTopic());
                } catch (error) {
                    console.error('Failed to select topic:', error);
                    Notification.show({
                        type: 'error',
                        title: 'Lỗi',
                        message: 'Không thể chọn đề này'
                    });
                    card.classList.remove('loading');
                }
            });
        });
    },

    async loadPersonalTopics(onSelect) {
        const container = document.getElementById('personal-topics-list');
        if (!container) return;

        container.innerHTML = `
            <p style="text-align: center; color: var(--text-secondary); padding: 20px;">
                <i class="fas fa-spinner fa-spin"></i> Đang tải...
            </p>
        `;

        try {
            const response = await fetch('/api/upload/my-topics', {
                headers: { 'Authorization': `Bearer ${ServerStorage.getToken()}` }
            });
            const data = await response.json();
            if (!data.success) throw new Error(data.message);

            const topics = data.data || [];
            if (topics.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 30px 20px; color: var(--text-secondary);">
                        <i class="fas fa-cloud-upload-alt" style="font-size: 40px; opacity: 0.4; display: block; margin-bottom: 12px;"></i>
                        <p style="margin: 0 0 8px 0; font-weight: 600; color: var(--text-primary);">Chưa có từ vựng riêng</p>
                        <p style="margin: 0; font-size: 13px;">Bấm nút tải lên ☁️ ở thanh điều hướng để thêm từ vựng của bạn.</p>
                    </div>
                `;
                return;
            }

            const currentSource = this.currentTopic?.source;
            container.innerHTML = topics.map(t => {
                const isSelected = currentSource === t.source;
                return `
                    <div class="topic-card ${isSelected ? 'selected' : ''}" data-personal-source="${t.source}">
                        <div class="topic-icon">📤</div>
                        <div class="topic-details">
                            <h4>${t.source}</h4>
                            <div class="topic-meta">
                                <span class="word-count">
                                    <i class="fas fa-book"></i> ${t.wordCount} từ
                                </span>
                            </div>
                        </div>
                        ${isSelected ? `
                            <div class="current-badge">
                                <i class="fas fa-check-circle"></i> Đang chọn
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');

            container.querySelectorAll('[data-personal-source]').forEach(card => {
                card.addEventListener('click', async () => {
                    const source = card.dataset.personalSource;
                    card.classList.add('loading');
                    try {
                        await this.selectPersonalTopic(source);
                        Modal.close();
                        if (onSelect) onSelect(this.getCurrentTopic());
                    } catch (error) {
                        console.error('Failed to select personal topic:', error);
                        Notification.show({
                            type: 'error',
                            title: 'Lỗi',
                            message: 'Không thể tải từ vựng này'
                        });
                        card.classList.remove('loading');
                    }
                });
            });
        } catch (err) {
            container.innerHTML = `
                <p style="text-align: center; color: #ef4444; padding: 20px;">
                    Lỗi: ${err.message}
                </p>
            `;
        }
    },

    async selectPersonalTopic(source) {
        console.log(`📚 Loading personal vocabulary: ${source}`);
        const response = await fetch(`/api/upload/my-vocabulary/${encodeURIComponent(source)}`, {
            headers: { 'Authorization': `Bearer ${ServerStorage.getToken()}` }
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.message);

        const words = data.data || [];
        if (words.length === 0) {
            throw new Error('Source trống, không có từ nào');
        }

        GameLogic.vocabularyData = words;
        GameLogic.currentSource = source;

        const topic = {
            id: `personal:${source}`,
            name: source,
            source: source,
            wordCount: words.length,
            icon: '📤',
            isPersonal: true,
        };
        this.currentTopic = topic;

        if (typeof PartSelector !== 'undefined' && PartSelector.clearSelection) {
            PartSelector.clearSelection();
        }
        if (typeof PartSelector !== 'undefined' && PartSelector.reloadParts) {
            await PartSelector.reloadParts();
        }

        await Storage.set('selectedTopic', topic.id);
        EventBus.emit('topic:changed', { topic });

        Notification.show({
            type: 'success',
            title: 'Đã chọn đề riêng',
            message: `${source} - ${words.length} từ`
        });

        return topic;
    },

    /**
     * Add a new topic manually (for dynamic loading)
     */
    addTopic(topicConfig) {
        const exists = this.availableTopics.find(t => t.id === topicConfig.id);

        if (exists) {
            console.warn(`Topic ${topicConfig.id} already exists`);
            return false;
        }

        this.availableTopics.push(topicConfig);
        return true;
    },

    /**
     * Restore last selected topic
     */
    async restoreLastTopic() {
        const lastTopicId = await Storage.get('selectedTopic');
        console.log('🔄 Restoring last topic:', lastTopicId);

        if (lastTopicId && this.availableTopics.find(t => t.id === lastTopicId)) {
            try {
                await this.selectTopic(lastTopicId, { silent: true });
                console.log(`✅ Topic restored: ${lastTopicId} (${this.currentTopic.name})`);
            } catch (error) {
                console.warn('⚠️ Failed to restore last topic:', error);
                await this._loadDefaultTopic();
            }
        } else {
            // No saved topic or stale ID — load the first available source
            await this._loadDefaultTopic();
        }
    },

    async _loadDefaultTopic() {
        if (this.availableTopics.length === 0) return;
        const first = this.availableTopics[0];
        try {
            await this.selectTopic(first.id, { silent: true });
            console.log(`✅ Default topic loaded: ${first.name}`);
        } catch (error) {
            console.warn('⚠️ Failed to load default topic:', error);
        }
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TopicSelector;
}