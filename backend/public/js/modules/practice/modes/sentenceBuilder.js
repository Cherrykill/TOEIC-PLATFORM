// ===================================
// SENTENCE BUILDER MODE - Xếp từ thành câu
// ===================================

const SentenceBuilder = {

    config: null,
    questions: [],
    currentIndex: 0,
    selectedWords: [],
    correctSentence: '',
    hintUsed: false,

    /**
     * Start mode
     */
    async start(config) {
        this.config = config;
        this.currentIndex = 0;

        // Generate questions
        await this.generateQuestions();

        // Setup hint and skip event listeners
        this.setupHintSkipListeners();

        // Show first question
        if (this.questions.length > 0) {
            this.showQuestion();
        }
    },

    /**
     * Generate questions
     */
    async generateQuestions() {
        const words = GameLogic.getRandomWords(this.config.questionsPerRound);

        this.questions = words.filter(word => {
            // CHỈ LẤY các từ có key example
            return word.example && word.example.length > 0;
        }).map(word => {
            // Lấy câu từ key example (nếu example là mảng thì lấy phần tử đầu)
            let sentence;
            if (Array.isArray(word.example)) {
                sentence = word.example[0];
            } else {
                sentence = word.example;
            }

            // Cắt câu từ example thành các cụm từ (phrases)
            const phrases = this.splitIntoPhrases(sentence);

            // Shuffle phrases (dùng Fisher-Yates algorithm để xáo trộn tốt hơn)
            const shuffledPhrases = this.shuffleArray([...phrases]);

            return {
                word: word,
                correctSentence: sentence, // Câu gốc từ example
                correctPhrases: phrases, // Thứ tự đúng của các cụm
                shuffledPhrases: shuffledPhrases, // Các cụm đã đảo
                wordVn: word.vn,
                wordEn: word.en,
                translation: this.getVietnameseTranslation(word)
            };
        });

        // Nếu không đủ câu hỏi (do filter), lấy thêm từ các từ khác
        if (this.questions.length < this.config.questionsPerRound) {
            console.warn(`Chỉ có ${this.questions.length} từ có example. Cần ${this.config.questionsPerRound} câu hỏi.`);
        }
    },

    /**
     * Cắt câu thành các cụm từ (phrases)
     */
    splitIntoPhrases(sentence) {
        // Loại bỏ dấu câu ở cuối
        const cleanSentence = sentence.replace(/[.,!?;:]$/, '');
        const words = cleanSentence.split(' ');

        // Nếu câu quá ngắn (dưới 4 từ), trả về từng từ
        if (words.length <= 4) {
            return words;
        }

        const phrases = [];
        let i = 0;

        while (i < words.length) {
            // Quyết định độ dài cụm (2-3 từ)
            let phraseLength;
            const remainingWords = words.length - i;

            if (remainingWords <= 2) {
                // Nếu còn 1-2 từ, lấy hết
                phraseLength = remainingWords;
            } else if (remainingWords === 3) {
                // Nếu còn 3 từ, lấy 2 hoặc 3
                phraseLength = Math.random() > 0.5 ? 2 : 3;
            } else {
                // Ngẫu nhiên 2-3 từ
                phraseLength = Math.random() > 0.5 ? 2 : 3;
            }

            // Lấy cụm từ
            const phrase = words.slice(i, i + phraseLength).join(' ');
            phrases.push(phrase);
            i += phraseLength;
        }

        return phrases;
    },

    /**
     * Lấy bản dịch tiếng Việt của toàn bộ câu example
     */
    getVietnameseTranslation(word) {
        // Nếu có exampleVn trong dữ liệu, dùng luôn (đây là bản dịch của example)
        if (word.exampleVn) {
            return word.exampleVn;
        }

        // TODO: Tích hợp API dịch tự động để dịch toàn bộ câu example
        // Hiện tại chưa có API dịch, trả về null để không hiển thị box "Nghĩa của câu"
        return null;
    },


    /**
     * Xáo trộn mảng bằng Fisher-Yates algorithm
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    },

    /**
     * Show current question
     */
    showQuestion() {
        if (this.currentIndex >= this.questions.length) {
            this.finish();
            return;
        }

        const question = this.questions[this.currentIndex];
        this.selectedWords = [];
        this.correctSentence = question.correctSentence;
        this.hintUsed = false;

        // Update progress
        PracticeManager.updateProgress(
            this.currentIndex + 1,
            this.questions.length
        );

        // Render question
        this.render(question);
    },

    /**
     * Render question UI
     */
    render(question) {
        const container = document.getElementById('practice-content');
        if (!container) return;

        container.innerHTML = `
            <div class="question-container sentence-builder-container">
                <div class="question-prompt">
                    <h3>🧩 Sắp xếp các cụm từ thành câu hoàn chỉnh</h3>
                    <div class="instruction-box">
                        <p><i class="fas fa-info-circle"></i> <strong>Cách chơi:</strong> Click vào các cụm từ bên dưới theo thứ tự đúng để ghép thành câu tiếng Anh có nghĩa</p>
                    </div>

                    <!-- Hiển thị bản dịch của câu cần xếp -->
                    ${question.translation ? `
                        <div class="translation-hint-box">
                            <div class="translation-label">
                                <i class="fas fa-language"></i>
                                <strong>Nghĩa của câu:</strong>
                            </div>
                            <div class="translation-text">${question.translation}</div>
                        </div>
                    ` : ''}

                    <!-- Gợi ý từ vựng chính -->
                    <div class="word-hint-box">
                        <div class="word-hint-label">
                            <i class="fas fa-lightbulb"></i>
                            <strong>Gợi ý từ vựng chính:</strong>
                        </div>
                        <div class="word-meaning">
                            <span class="highlight-word">${question.word.en}</span>
                            <span class="word-translation">= ${question.wordVn}</span>
                        </div>
                    </div>
                </div>

                <!-- Selected words area -->
                <div class="sentence-area" id="sentence-area">
                    <div class="sentence-placeholder">
                        <i class="fas fa-hand-pointer"></i>
                        Click vào các từ bên dưới để xếp thành câu...
                    </div>
                </div>

                <!-- Available phrases pool -->
                <div class="words-pool-container">
                    <div class="words-pool" id="words-pool">
                        ${question.shuffledPhrases.map((phrase, index) => `
                            <button class="word-btn phrase-btn" data-phrase="${phrase}" data-index="${index}">
                                ${phrase}
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- Actions -->
                <div class="sentence-actions">
                    <button class="btn btn-secondary" id="clear-btn">
                        <i class="fas fa-redo"></i> Làm lại
                    </button>
                    <button class="btn btn-primary" id="check-btn" disabled>
                        <i class="fas fa-check"></i> Kiểm tra
                    </button>
                </div>

                <!-- Hint area -->
                <div class="hint-area" id="hint-area" style="display: none;">
                    <i class="fas fa-lightbulb"></i>
                    <span id="hint-text"></span>
                </div>
            </div>
        `;

        // Attach listeners
        this.attachListeners();
    },

    /**
     * Attach event listeners
     */
    attachListeners() {
        const phraseBtns = document.querySelectorAll('.phrase-btn');
        const clearBtn = document.getElementById('clear-btn');
        const checkBtn = document.getElementById('check-btn');

        phraseBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectPhrase(btn.dataset.phrase, btn);
            });
        });

        clearBtn?.addEventListener('click', () => {
            this.clearSentence();
        });

        checkBtn?.addEventListener('click', () => {
            this.checkAnswer();
        });
    },

    /**
     * Select a phrase
     */
    selectPhrase(phrase, btn) {
        if (btn.disabled) return;

        this.selectedWords.push(phrase); // Vẫn dùng selectedWords nhưng lưu cụm
        btn.disabled = true;
        btn.classList.add('selected');

        this.updateSentenceArea();
        this.updateCheckButton();
    },

    /**
     * Update sentence area
     */
    updateSentenceArea() {
        const sentenceArea = document.getElementById('sentence-area');
        if (!sentenceArea) return;

        if (this.selectedWords.length === 0) {
            sentenceArea.innerHTML = `
                <div class="sentence-placeholder">
                    <i class="fas fa-hand-pointer"></i>
                    <div>
                        <div>Click vào các cụm từ bên dưới theo thứ tự đúng</div>
                        <small style="opacity: 0.7; margin-top: 4px; display: block;">Ví dụ: Click "She had to" → "search in" → "her handbag" → "for her keys"</small>
                    </div>
                </div>
            `;
        } else {
            sentenceArea.innerHTML = `
                <div class="selected-sentence">
                    ${this.selectedWords.map((phrase, index) => `
                        <span class="selected-word selected-phrase animate-pop" data-index="${index}">
                            ${phrase}
                            <button class="remove-word" onclick="SentenceBuilder.removeWord(${index})" title="Xóa cụm">
                                <i class="fas fa-times"></i>
                            </button>
                        </span>
                    `).join(' ')}
                </div>
            `;
        }
    },

    /**
     * Remove a phrase from selected
     */
    removeWord(index) {
        const phrase = this.selectedWords[index];
        this.selectedWords.splice(index, 1);

        // Re-enable the button
        const phraseBtns = document.querySelectorAll('.phrase-btn');
        phraseBtns.forEach(btn => {
            if (btn.dataset.phrase === phrase && btn.disabled) {
                btn.disabled = false;
                btn.classList.remove('selected');
            }
        });

        this.updateSentenceArea();
        this.updateCheckButton();
    },

    /**
     * Clear all selected phrases
     */
    clearSentence() {
        this.selectedWords = [];

        const phraseBtns = document.querySelectorAll('.phrase-btn');
        phraseBtns.forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('selected');
        });

        this.updateSentenceArea();
        this.updateCheckButton();
    },

    /**
     * Update check button state
     */
    updateCheckButton() {
        const checkBtn = document.getElementById('check-btn');
        if (!checkBtn) return;

        const question = this.questions[this.currentIndex];
        checkBtn.disabled = this.selectedWords.length !== question.correctPhrases.length;
    },

    /**
     * Chuẩn hóa câu để so sánh (loại bỏ dấu câu, khoảng trắng thừa, không phân biệt hoa thường)
     */
    normalizeSentence(sentence) {
        return sentence
            .trim()                          // Loại bỏ khoảng trắng đầu/cuối
            .replace(/\s+/g, ' ')           // Chuẩn hóa nhiều khoảng trắng thành 1
            .replace(/[.,!?;:]+$/g, '')     // Loại bỏ tất cả dấu câu ở cuối
            .toLowerCase();                  // Chuyển thành chữ thường để không phân biệt hoa/thường
    },

    /**
     * Check answer
     */
    checkAnswer() {
        // Ghép các cụm đã chọn thành câu
        const userSentence = this.selectedWords.join(' ');

        // So sánh thông minh: chuẩn hóa cả 2 câu trước khi so sánh
        const normalizedUserSentence = this.normalizeSentence(userSentence);
        const normalizedCorrectSentence = this.normalizeSentence(this.correctSentence);
        const isCorrect = normalizedUserSentence === normalizedCorrectSentence;

        const question = this.questions[this.currentIndex];

        // Disable all buttons
        const phraseBtns = document.querySelectorAll('.phrase-btn');
        phraseBtns.forEach(btn => btn.disabled = true);

        const checkBtn = document.getElementById('check-btn');
        if (checkBtn) checkBtn.disabled = true;

        const clearBtn = document.getElementById('clear-btn');
        if (clearBtn) clearBtn.disabled = true;

        // Show result
        const sentenceArea = document.getElementById('sentence-area');
        if (sentenceArea) {
            if (isCorrect) {
                sentenceArea.innerHTML = `
                    <div class="result-sentence correct animate-pop">
                        <i class="fas fa-check-circle"></i>
                        <strong>Chính xác!</strong><br>
                        "${userSentence}"
                    </div>
                `;
            } else {
                sentenceArea.innerHTML = `
                    <div class="result-sentence wrong animate-pop">
                        <i class="fas fa-times-circle"></i>
                        <strong>Chưa đúng</strong><br>
                        Câu của bạn: "${userSentence}"
                    </div>
                    <div class="result-sentence correct" style="margin-top: 10px; animation-delay: 0.3s;">
                        <i class="fas fa-check-circle"></i>
                        <strong>Đáp án đúng:</strong><br>
                        "${this.correctSentence}"
                    </div>
                `;
            }
        }

        // Record answer
        PracticeManager.recordAnswer(isCorrect, question.word);

        // Play sound
        if (GameState.state.settings.soundEnabled) {
            Utils.playSound(isCorrect ? Config.sounds.correct : Config.sounds.wrong, 0.5);
        }

        // Show notification
        if (isCorrect) {
            Notification.show({
                type: 'success',
                title: '🎉 Chính xác!',
                message: 'Câu của bạn hoàn toàn đúng!',
                duration: 2000
            });
        } else {
            Notification.show({
                type: 'error',
                title: '❌ Chưa đúng',
                message: `Đáp án: ${this.correctSentence}`,
                duration: 3000
            });
        }

        // Pronounce the sentence (always pronounce - independent of sound effects setting)
        setTimeout(() => {
            GameLogic.speakWord(this.correctSentence, 'en-US');
        }, 500);

        // Move to next question
        setTimeout(() => {
            this.nextQuestion();
        }, 3500);
    },

    /**
     * Move to next question
     */
    nextQuestion() {
        this.currentIndex++;
        this.showQuestion();
    },

    /**
     * Setup hint and skip buttons
     */
    setupHintSkipListeners() {
        // Dùng EventBus để nhận hint từ practiceManager (đảm bảo trừ tài nguyên đúng)
        EventBus.on(GameEvents.HINT_USED, () => {
            if (!this.hintUsed && this.currentIndex < this.questions.length) {
                this.showHint();
            }
        });

        const skipBtn = document.getElementById('skip-btn');
        if (skipBtn) {
            skipBtn.onclick = () => this.skipQuestion();
        }
    },

    /**
     * Show hint
     */
    showHint() {
        const question = this.questions[this.currentIndex];
        if (!question || this.hintUsed) return;

        const hintArea = document.getElementById('hint-area');
        const hintText = document.getElementById('hint-text');

        if (hintArea && hintText) {
            hintArea.style.display = 'flex';
            hintText.textContent = `Câu bắt đầu bằng: "${question.words[0]} ${question.words[1]}"`;
        }

        this.hintUsed = true;

        Notification.show({
            type: 'info',
            title: '💡 Gợi ý',
            message: 'Đã hiển thị 2 từ đầu tiên'
        });
    },

    /**
     * Skip question
     */
    skipQuestion() {
        const question = this.questions[this.currentIndex];

        // Record as wrong
        PracticeManager.recordAnswer(false, question.word);

        // Show correct answer
        Notification.show({
            type: 'info',
            title: 'Đã bỏ qua',
            message: `Đáp án: ${this.correctSentence}`
        });

        // Move to next
        setTimeout(() => {
            this.nextQuestion();
        }, 1500);
    },

    /**
     * Finish mode
     */
    finish() {
        console.log('✅ Sentence Builder mode completed');
        PracticeManager.complete();
    },

    /**
     * Cleanup
     */
    cleanup() {
        console.log('🧹 SentenceBuilder cleanup: Clearing state');
        EventBus.off(GameEvents.HINT_USED);
        this.questions = [];
        this.currentIndex = 0;
        this.selectedWords = [];
        this.correctSentence = '';
        this.hintUsed = false;
    }
};

// Make global
window.SentenceBuilder = SentenceBuilder;

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SentenceBuilder;
}
