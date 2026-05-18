// ===================================
// SEARCH MODULE
// ===================================

const Search = {
    
    searchInput: null,
    clearBtn: null,
    resultsContainer: null,
    isOpen: false,
    
    /**
     * Initialize search
     */
    init() {
        this.searchInput = document.getElementById('search-input');
        this.clearBtn = document.getElementById('clear-search-btn');
        this.resultsContainer = document.getElementById('search-results');
        
        if (!this.searchInput || !this.resultsContainer) {
            console.warn('Search elements not found');
            return;
        }
        
        // Attach event listeners
        this.attachListeners();

        // Vô hiệu hóa khi đang luyện tập, mở lại khi thoát hoặc hoàn thành
        EventBus.on(GameEvents.PRACTICE_STARTED, () => this.setDisabled(true));
        EventBus.on(GameEvents.PRACTICE_COMPLETED, () => this.setDisabled(false));
        EventBus.on(GameEvents.SCREEN_CHANGED, ({ screenId } = {}) => {
            if (screenId !== 'practice-screen') this.setDisabled(false);
        });
    },

    setDisabled(disabled) {
        if (!this.searchInput) return;
        this.searchInput.disabled = disabled;
        this.searchInput.placeholder = disabled ? 'Đang luyện tập...' : 'Tìm từ vựng...';
        const bar = this.searchInput.closest('.search-bar');
        if (bar) bar.style.opacity = disabled ? '0.45' : '';
        if (disabled) this.hideResults();
    },
    
    /**
     * Attach event listeners
     */
    attachListeners() {
        // Input event with debounce
        this.searchInput.addEventListener('input', Utils.debounce((e) => {
            this.handleSearch(e.target.value);
        }, 300));

        // Focus - show results if has value
        this.searchInput.addEventListener('focus', () => {
            document.querySelector('.top-nav')?.classList.add('search-active');
            if (this.searchInput.value.trim()) {
                this.showResults();
            }
        });

        this.searchInput.addEventListener('blur', () => {
            document.querySelector('.top-nav')?.classList.remove('search-active');
        });

        // Clear button
        this.clearBtn?.addEventListener('click', () => {
            this.clearSearch();
        });

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!this.searchInput.contains(e.target) &&
                !this.resultsContainer.contains(e.target)) {
                this.hideResults();
            }
        });

        // ESC to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.hideResults();
                this.searchInput.blur();
            }
        });

        // Listen for topic change to refresh search results
        EventBus.on('topic:changed', () => {
            console.log('🔄 Topic changed - refreshing search...');
            // If there's a search query, re-run search with new vocabulary
            if (this.searchInput && this.searchInput.value.trim()) {
                this.handleSearch(this.searchInput.value);
            }
        });
    },
    
    /**
     * Handle search
     */
    handleSearch(query) {
        const trimmed = query.trim();
        
        // Show/hide clear button
        if (this.clearBtn) {
            this.clearBtn.style.display = trimmed ? 'flex' : 'none';
        }
        
        if (!trimmed) {
            this.hideResults();
            return;
        }
        
        // Search vocabulary
        const results = this.searchVocabulary(trimmed);
        
        // Display results
        this.displayResults(results, trimmed);
    },
    
    /**
     * Search vocabulary
     */
    searchVocabulary(query) {
        const vocabulary = GameLogic.getVocabulary();
        const lowerQuery = query.toLowerCase();

        // Debug: log current vocabulary source
        const currentTopic = TopicSelector?.getCurrentTopic?.();
        console.log(`🔍 Search Debug:`, {
            topic: currentTopic?.name || 'Unknown',
            topicFile: currentTopic?.file || 'Unknown',
            vocabularyCount: vocabulary.length,
            gameLogicCount: GameLogic.vocabularyData?.length,
            sampleWords: vocabulary.slice(0, 3).map(w => w.en)
        });

        return vocabulary.filter(word => {
            // Search in English
            if (word.en.toLowerCase().includes(lowerQuery)) return true;
            
            // Search in Vietnamese
            if (word.vn.toLowerCase().includes(lowerQuery)) return true;
            
            // Search in synonyms
            if (word.synonyms && word.synonyms.toLowerCase().includes(lowerQuery)) return true;
            
            return false;
        }).slice(0, 20); // Limit to 20 results
    },
    
    /**
     * Display search results
     */
    displayResults(results, query) {
        // Get current topic name
        const currentTopic = TopicSelector?.getCurrentTopic?.();
        const topicName = currentTopic?.name || 'Từ vựng';

        // Header showing search context
        const headerHtml = `
            <div class="search-results-header">
                <span class="search-topic-badge">
                    <i class="fas fa-book"></i> ${topicName}
                </span>
                <span class="search-count">${results.length} kết quả</span>
            </div>
        `;

        if (results.length === 0) {
            this.resultsContainer.innerHTML = `
                ${headerHtml}
                <div class="search-no-results">
                    <i class="fas fa-search"></i>
                    <p>Không tìm thấy từ nào với "<strong>${query}</strong>"</p>
                </div>
            `;
        } else {
            const html = results.map(word => this.renderResult(word, query)).join('');
            this.resultsContainer.innerHTML = headerHtml + html;

            // Attach click handlers
            this.attachResultListeners();
        }

        this.showResults();
    },
    
    /**
     * Render single result
     */
    renderResult(word, query) {
        // Highlight matching text
        const highlightText = (text, query) => {
            const regex = new RegExp(`(${query})`, 'gi');
            return text.replace(regex, '<mark>$1</mark>');
        };

        return `
            <div class="search-result-item" data-word-en="${word.en}">
                <div class="search-result-word">
                    <span class="search-result-en">${highlightText(word.en, query)}</span>
                    <span class="search-result-phonetic">${word.phonetic || ''}</span>
                </div>
                <div class="search-result-vn">${highlightText(word.vn, query)}</div>
                <div class="search-result-meta">
                    <span class="search-result-type">${word.type || ''}</span>
                    ${word.part ? `<span class="search-result-part">${word.part}</span>` : ''}
                </div>
                <button class="search-result-speak-btn" data-word="${word.en}" title="Phát âm">
                    <i class="fas fa-volume-up"></i>
                </button>
            </div>
        `;
    },
    
    /**
     * Attach listeners to result items
     */
    attachResultListeners() {
        const items = this.resultsContainer.querySelectorAll('.search-result-item');

        items.forEach(item => {
            item.addEventListener('click', (e) => {
                // Nếu click vào nút phát âm thì không mở detail
                if (e.target.closest('.search-result-speak-btn')) return;

                const wordEn = item.dataset.wordEn;
                this.showWordDetail(wordEn);
            });
        });

        // Nút phát âm
        const speakBtns = this.resultsContainer.querySelectorAll('.search-result-speak-btn');
        speakBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const word = btn.dataset.word;
                if (word && typeof GameLogic !== 'undefined') {
                    GameLogic.speakWord(word, 'en-US');
                }
            });
        });
    },
    
    /**
     * Show word detail modal
     */
    showWordDetail(wordEn) {
        const vocabulary = GameLogic.getVocabulary();
        const word = vocabulary.find(w => w.en === wordEn);
        
        if (!word) return;
        
        // Close search results
        this.hideResults();
        this.clearSearch();
        
        // Show modal
        Modal.show({
            title: word.en,
            content: `
                <div class="word-detail">
                    ${word.image ? `
                        <img src="${word.image}" class="word-detail-image" alt="${word.en}"
                             onerror="this.style.display='none'">
                    ` : ''}

                    <div class="word-detail-phonetic">${word.phonetic}</div>

                    <div class="word-detail-type">
                        <span class="badge">${word.type}</span>
                        ${word.part ? `<span class="badge">${word.part}</span>` : ''}
                    </div>

                    <div class="word-detail-meaning">
                        <h4>Nghĩa tiếng Việt:</h4>
                        <p>${word.vn}</p>
                    </div>

                    ${word.synonyms ? `
                        <div class="word-detail-synonyms">
                            <h4>Từ đồng nghĩa:</h4>
                            <p>${word.synonyms}</p>
                        </div>
                    ` : ''}

                    <button class="btn btn-primary btn-block" id="play-pronunciation-btn">
                        <i class="fas fa-volume-up"></i> Phát âm
                    </button>
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

        // Play pronunciation button
        setTimeout(() => {
            const playBtn = document.getElementById('play-pronunciation-btn');
            playBtn?.addEventListener('click', () => {
                GameLogic.speakWord(word.en, 'en-US');
            });
        }, 100);
    },
    
    /**
     * Show results dropdown
     */
    showResults() {
        this.resultsContainer.classList.add('active');
        this.isOpen = true;
    },
    
    /**
     * Hide results dropdown
     */
    hideResults() {
        this.resultsContainer.classList.remove('active');
        this.isOpen = false;
    },
    
    /**
     * Clear search
     */
    clearSearch() {
        if (this.searchInput) {
            this.searchInput.value = '';
        }
        if (this.clearBtn) {
            this.clearBtn.style.display = 'none';
        }
        this.hideResults();
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Search;
}