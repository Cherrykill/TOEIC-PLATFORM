// ===================================
// FLASHCARD MODE (ĐÃ SỬA LỖI ASYNC/AWAIT)
// ===================================

const Flashcard = {
    
    config: null,
    words: [],
    currentIndex: 0,
    isFlipped: false,
    knownWords: [],
    unknownWords: [],
    
    /**
     * Start mode
     */
    async start(config) { // THÊM ASYNC
        console.log("🃏 Bắt đầu chế độ Flashcard...");
        this.config = config;
        this.currentIndex = 0;
        this.isFlipped = false;
        this.knownWords = [];
        this.unknownWords = [];
        
        // Get words
        await this.loadWords(); // THÊM AWAIT

        // [FIX] Kiểm tra nếu không có từ nào được tải
        if (this.words.length === 0) {
            console.warn("🃏 Không có từ vựng nào để luyện tập. Kết thúc chế độ.");
            Notification.show({
                type: 'warning',
                message: 'Không tìm thấy từ vựng phù hợp cho phần luyện tập này.'
            });
            PracticeManager.complete(); // Quay về màn hình chính
            return;
        }
        
        // Show first card
        this.showCard();
    },
    
    /**
     * Load words for flashcard
     */
    async loadWords() {
        // ✅ Kiểm tra xem có chọn Part không (từ GameState)
        const selectedPart = GameState.state?.settings?.selectedPart || null;

        // 🔍 DEBUG LOG
        console.log('🔍 [FLASHCARD DEBUG]');
        console.log('   - GameState.state:', GameState.state);
        console.log('   - GameState.state.settings:', GameState.state?.settings);
        console.log('   - selectedPart:', selectedPart);
        console.log('   - config.questionsPerRound:', this.config.questionsPerRound);

        // Nếu ĐÃ chọn Part → Request 9999 để lấy TẤT CẢ từ (PartSelector sẽ trả về toàn bộ)
        // Nếu CHƯA chọn Part → Request theo config để lấy random
        const requestCount = selectedPart ? 9999 : (this.config.questionsPerRound || 20);

        console.log('   - requestCount:', requestCount);

        const words = await PartSelector.getWordsForPractice(requestCount);

        console.log('   - words.length received:', words?.length);

        if (!Array.isArray(words)) {
             console.error("Lỗi: PartSelector không trả về mảng từ vựng.");
             this.words = [];
             return;
        }

        // ✅ Nếu chọn Part → Dùng TẤT CẢ từ
        // Nếu không chọn Part → Giới hạn theo config
        if (selectedPart) {
            this.words = words; // Lấy tất cả
            console.log(`🃏 Loaded ${this.words.length} flashcards (Part: ${selectedPart}, ALL words)`);
        } else {
            const limit = this.config.questionsPerRound || 20;
            this.words = words.slice(0, limit);
            console.log(`🃏 Loaded ${this.words.length} flashcards (Random mode, limited to ${limit})`);
        }
    },
    
    /**
     * Show current card
     */
    showCard() {
        if (this.currentIndex >= this.words.length) {
            this.finish();
            return;
        }
        
        const word = this.words[this.currentIndex];
        this.isFlipped = false;
        
        // Update progress
        PracticeManager.updateProgress(
            this.currentIndex + 1,
            this.words.length
        );
        
        // Render card
        this.render(word);
    },
    
    /**
     * Render flashcard UI (ĐÃ ĐƯỢC NÂNG CẤP: +Tiếng Trung + Tự động phát âm khi lật)
     */
    render(word) {
        const container = document.getElementById('practice-content');
        if (!container) return;

        const hasChinese = false;

        container.innerHTML = `
            <div class="flashcard-container">
                <div class="flashcard-progress">
                    <div class="progress-indicator">
                        <span class="progress-current">${this.currentIndex + 1}</span>
                        <span class="progress-separator">/</span>
                        <span class="progress-total">${this.words.length}</span>
                    </div>
                    <div class="progress-stats">
                        <span class="stat-known">
                            Known ${this.knownWords.length}
                        </span>
                        <span class="stat-unknown">
                            Unknown ${this.unknownWords.length}
                        </span>
                    </div>
                </div>
                
                <div class="flashcard" id="flashcard">
                    <div class="flashcard-inner" id="flashcard-inner">
                        <div class="flashcard-front">
                            <div class="card-corner-badge">EN</div>
                            <div class="card-content card-content--split">
                                ${word.image ? `
                                    <div class="card-image-col">
                                        <img src="${word.image}" class="card-image" alt="${word.en}"
                                             onerror="this.closest('.card-image-col').style.display='none'">
                                    </div>
                                ` : ''}
                                <div class="card-text-col">
                                    <h2 class="card-word">${word.en}</h2>
                                    <p class="card-phonetic">${word.phonetic || ''}</p>
                                    <span class="card-type">${word.type || ''}</span>
                                </div>
                            </div>
                            <div class="card-hint">
                                Click / Space để lật thẻ
                            </div>
                        </div>
                        
                        <div class="flashcard-back">
                            <div class="card-corner-badge">VI</div>
                            <div class="card-content">
                                <h2 class="card-meaning">${word.vi || word.vn}</h2>
                                
                                ${hasChinese ? `
                                    <div class="card-chinese-section">
                                        <div class="chinese-lang-badge">
                                            <span class="flag">CN</span> Tiếng Trung
                                        </div>
                                        <h3 class="card-chinese">${word.zh}</h3>
                                        <p class="card-pinyin">${word.pinyin}</p>
                                    </div>
                                ` : ''}

                                ${word.example ? `
                                    <div class="card-example">
                                        <strong>Ví dụ:</strong>
                                        <p>${word.example}</p>
                                    </div>
                                ` : ''}
                                
                                ${word.synonyms ? `
                                    <div class="card-synonyms">
                                        <strong>Từ đồng nghĩa:</strong>
                                        <p>${word.synonyms}</p>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="flashcard-actions">
                    <button class="rating-btn btn-unknown" id="unknown-btn">
                        <span>Chưa biết</span>
                        </button>
                    <button class="flashcard-btn flip-btn" id="flip-btn">
                        <span>Lật thẻ</span>
                    </button>
                    <button class="flashcard-btn pronounce-btn" id="pronounce-btn">
                        <span>Phát âm</span>
                    </button>
                    <button class="rating-btn btn-known" id="known-btn">
                        <span>Đã biết</span>
                    </button>
                </div>
                
            </div>
        `;

        // Gắn sự kiện
        this.attachListeners(word);

        // TỰ ĐỘNG PHÁT ÂM KHI LẬT THẺ (nếu đang ở mặt sau)
        const inner = document.getElementById('flashcard-inner');
        if (inner && this.isFlipped) {
            setTimeout(() => this.pronounce(word.en), 300); // phát âm sau khi lật xong
        }

        // Auto pronounce khi mới vào thẻ (nếu bật cài đặt)
        if (!this.isFlipped && GameState.state.settings.autoPronunciation) {
            setTimeout(() => this.pronounce(word.en), 500);
        }
    },
    
    /**
     * Attach event listeners
     */
    attachListeners(word) {
        // Flip button
        const flipBtn = document.getElementById('flip-btn');
        flipBtn?.addEventListener('click', () => {
            this.flipCard();
        });

        // Click on card to flip
        const flashcard = document.getElementById('flashcard');
        flashcard?.addEventListener('click', () => {
            this.flipCard();
        });

        // Pronounce button
        const pronounceBtn = document.getElementById('pronounce-btn');
        pronounceBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.pronounce(word.en);
        });

        // Known button
        const knownBtn = document.getElementById('known-btn');
        knownBtn?.addEventListener('click', () => {
            this.markAsKnown(word);
        });

        // Unknown button
        const unknownBtn = document.getElementById('unknown-btn');
        unknownBtn?.addEventListener('click', () => {
            this.markAsUnknown(word);
        });

        // Keyboard shortcuts - Lưu reference để có thể remove sau
        if (!this.boundKeyboardHandler) {
            this.boundKeyboardHandler = this.handleKeyboard.bind(this);
        }
        document.addEventListener('keydown', this.boundKeyboardHandler);
    },
    
    /**
     * Handle keyboard shortcuts
     */
    handleKeyboard(e) {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            this.flipCard();
        } else if (e.key === 'ArrowLeft' || e.key === '1') {
            this.markAsUnknown(this.words[this.currentIndex]);
        } else if (e.key === 'ArrowRight' || e.key === '2') {
            this.markAsKnown(this.words[this.currentIndex]);
        } else if (e.key === 'p' || e.key === 'P') {
            this.pronounce(this.words[this.currentIndex].en);
        }
    },
    
    /**
     * Flip the card + TỰ ĐỘNG PHÁT ÂM khi lật sang mặt nghĩa
     */
    flipCard() {
        const inner = document.getElementById('flashcard-inner');
        if (!inner) return;

        this.isFlipped = !this.isFlipped;

        if (this.isFlipped) {
            inner.classList.add('flipped');
            // TỰ ĐỘNG PHÁT ÂM KHI LẬT SANG MẶT SAU
            const currentWord = this.words[this.currentIndex];
            setTimeout(() => {
                this.pronounce(currentWord.en);
            }, 350); // chờ animation lật xong
            // Tự thu phần tiếng Trung sau 2 giây
            setTimeout(() => {
                const chineseSection = document.querySelector('.card-chinese-section');
                if (chineseSection) chineseSection.classList.add('chinese-collapsed');
            }, 2000);
        } else {
            inner.classList.remove('flipped');
            // Reset khi lật lại
            const chineseSection = document.querySelector('.card-chinese-section');
            if (chineseSection) chineseSection.classList.remove('chinese-collapsed');
        }
    },
    
    /**
     * Mark as known
     */
    markAsKnown(word) {
        this.knownWords.push(word);
        
        // Record as correct
        PracticeManager.recordAnswer(true, word);
        
        // Mark word as learned
        GameState.learnWord(word.en);
        
        // Play sound
        if (GameState.state.settings.soundEnabled) {
            Utils.playSound(Config.sounds.correct, 0.3);
        }
        
        // Show animation
        this.showFeedback('known');
        
        // Next card
        setTimeout(() => {
            this.nextCard();
        }, 500);
    },
    
    /**
     * Phát âm từ tiếng Anh
     */
    pronounce(text) {
        if (!text) return;
        GameLogic.speakWord(text, 'en-US');

        // Hiệu ứng nút phát âm
        const btn = document.getElementById('pronounce-btn');
        if (btn) {
            btn.classList.add('active');
            setTimeout(() => btn.classList.remove('active'), 500);
        }
    },

    /**
     * Mark as unknown
     */
    markAsUnknown(word) {
        this.unknownWords.push(word);
        
        // Record as incorrect
        PracticeManager.recordAnswer(false, word);
        
        // Play sound
        if (GameState.state.settings.soundEnabled) {
            Utils.playSound(Config.sounds.wrong, 0.3);
        }
        
        // Show animation
        this.showFeedback('unknown');
        
        // Next card
        setTimeout(() => {
            this.nextCard();
        }, 500);
    },
    
    /**
     * Show feedback animation
     */
    showFeedback(type) {
        const flashcard = document.getElementById('flashcard');
        if (!flashcard) return;
        
        if (type === 'known') {
            flashcard.classList.add('feedback-known');
            setTimeout(() => {
                flashcard.classList.remove('feedback-known');
            }, 500);
        } else {
            flashcard.classList.add('feedback-unknown');
            setTimeout(() => {
                flashcard.classList.remove('feedback-unknown');
            }, 500);
        }
    },
    
    /**
     * Next card
     */
    nextCard() {
        // Remove keyboard listener before moving to next card
        if (this.boundKeyboardHandler) {
            document.removeEventListener('keydown', this.boundKeyboardHandler);
        }

        this.currentIndex++;
        this.showCard();
    },
    
    /**
     * Finish flashcard session
     */
    finish() {
        // Remove keyboard listener
        if (this.boundKeyboardHandler) {
            document.removeEventListener('keydown', this.boundKeyboardHandler);
        }

        // Show summary
        this.showSummary();
    },
    
    /**
     * Show summary with review option
     */
    showSummary() {
        const accuracy = this.words.length > 0 ? 
            Math.round((this.knownWords.length / this.words.length) * 100) : 0;
        
        Modal.show({
            title: '🃏 Hoàn thành Flashcard!',
            content: `
                <div class="flashcard-summary">
                    <div class="summary-stats">
                        <div class="summary-stat known">
                            <i class="fas fa-check-circle"></i>
                            <h3>${this.knownWords.length}</h3>
                            <p>Đã biết</p>
                        </div>
                        <div class="summary-stat unknown">
                            <i class="fas fa-times-circle"></i>
                            <h3>${this.unknownWords.length}</h3>
                            <p>Chưa biết</p>
                        </div>
                    </div>
                    
                    <div class="summary-accuracy">
                        <div class="accuracy-circle">
                            <span class="accuracy-value">${accuracy}%</span>
                            <span class="accuracy-label">Độ thuộc</span>
                        </div>
                    </div>
                    
                    ${this.unknownWords.length > 0 ? `
                        <div class="review-suggestion">
                            <i class="fas fa-info-circle"></i>
                            <p>Bạn có <strong>${this.unknownWords.length} từ chưa biết</strong>. Muốn ôn lại không?</p>
                        </div>
                    ` : `
                        <div class="perfect-message">
                            <i class="fas fa-trophy"></i>
                            <p>Xuất sắc! Bạn đã biết tất cả từ vựng!</p>
                        </div>
                    `}
                </div>
            `,
            buttons: [
                ...(this.unknownWords.length > 0 ? [{
                    text: 'Ôn lại từ chưa biết',
                    className: 'btn-secondary',
                    onClick: () => {
                        Modal.close();
                        this.reviewUnknown();
                    }
                }] : []),
                {
                    text: 'Học tiếp',
                    className: 'btn-primary',
                    onClick: () => {
                        Modal.close();
                        this.start(this.config); // Restart with new words
                    }
                },
                {
                    text: 'Về trang chủ',
                    className: 'btn-secondary',
                    onClick: () => {
                        // Cleanup trước khi về trang chủ
                        this.cleanup();
                        Modal.close();
                        // Đợi modal đóng xong rồi mới chuyển màn hình
                        setTimeout(() => {
                            // Clear session và về trang chủ trực tiếp
                            if (PracticeManager.currentSession) {
                                PracticeManager.currentSession.completed = true;
                                PracticeManager.currentSession = null;
                            }
                            // Stop all sounds
                            if (typeof Utils !== 'undefined' && Utils.stopAllSounds) {
                                Utils.stopAllSounds();
                            }
                            // Navigate to home
                            UI.showScreen('home-screen');
                        }, 300);
                    }
                }
            ]
        });
    },
    
    /**
     * Review unknown words
     */
    reviewUnknown() {
        // Reset and use only unknown words
        this.words = [...this.unknownWords];
        this.currentIndex = 0;
        this.knownWords = [];
        this.unknownWords = [];

        Notification.show({
            type: 'info',
            title: 'Ôn tập',
            message: `Bắt đầu ôn lại ${this.words.length} từ chưa biết`,
        });

        this.showCard();
    },

    /**
     * Cleanup resources (called when exiting practice)
     */
    cleanup() {
        console.log('🧹 Flashcard cleanup: Removing keyboard listener and clearing state');
        // Remove keyboard listener properly
        if (this.boundKeyboardHandler) {
            document.removeEventListener('keydown', this.boundKeyboardHandler);
            this.boundKeyboardHandler = null;
        }
        this.words = [];
        this.currentIndex = 0;
        this.knownWords = [];
        this.unknownWords = [];
        this.isFlipped = false;
    }
};

// Make global
window.Flashcard = Flashcard;

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Flashcard;
}