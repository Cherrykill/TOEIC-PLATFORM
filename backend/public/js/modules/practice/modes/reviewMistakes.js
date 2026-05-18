// ===================================
// REVIEW MISTAKES MODE - Luyện lại từ đã làm sai
// ===================================

const ReviewMistakes = {

    config: null,
    questions: [],
    currentIndex: 0,
    selectedAnswer: null,
    hintUsed: false,

    /**
     * Start mode
     */
    async start(config) {
        console.log('🚀 ReviewMistakes.start() called');
        console.log('   Config:', config);

        this.config = config;
        this.currentIndex = 0;

        // Generate questions từ wrongWords
        console.log('   Calling generateQuestions()...');
        await this.generateQuestions();
        console.log('   generateQuestions() completed, questions.length:', this.questions.length);

        // Setup hint and skip event listeners
        this.setupHintSkipListeners();

        // Show first question
        if (this.questions.length > 0) {
            this.showQuestion();
        } else {
            // Không có từ sai nào để luyện
            PracticeManager.complete();
            Notification.show({
                type: 'info',
                title: 'Tuyệt vời!',
                message: 'Bạn chưa có từ nào làm sai. Hãy tiếp tục luyện tập!',
                duration: 4000
            });
        }
    },

    /**
     * Generate questions từ danh sách từ sai (từ MongoDB API)
     */
    async generateQuestions() {
        console.log('🔍 ReviewMistakes.generateQuestions() - START');
        console.log('   Config:', this.config);

        // Lấy từ cần ôn từ WrongWordsManager (dùng spaced repetition)
        let wrongWords = [];

        if (typeof WrongWordsManager !== 'undefined') {
            console.log('   Calling WrongWordsManager.getWordsToReview()...');
            wrongWords = await WrongWordsManager.getWordsToReview(this.config.questionsPerRound);
            console.log(`🌐 Fetched ${wrongWords.length} words from API (spaced repetition)`);
            console.log('   Raw data from API:', wrongWords);
        } else {
            console.error('❌ WrongWordsManager is undefined!');
        }

        // Fallback: Nếu không có WrongWordsManager hoặc không có từ, dùng GameState cũ
        if (wrongWords.length === 0 && typeof GameState !== 'undefined') {
            const oldWrongWords = GameState.getWrongWords();
            if (oldWrongWords && oldWrongWords.length > 0) {
                console.log(`📦 Using ${oldWrongWords.length} words from old GameState`);
                wrongWords = oldWrongWords.slice(0, this.config.questionsPerRound);
            }
        }

        if (wrongWords.length === 0) {
            console.log('📝 Không có từ sai nào để luyện lại');
            this.questions = [];
            return;
        }

        console.log('   Converting to formatted words...');
        // Convert MongoDB format sang format của GameLogic
        const formattedWords = wrongWords.map(w => {
            const formatted = {
                id: w.wordId || w.id,
                en: w.en || w.word,
                vn: w.vn || w.meaning || w.vi,  // ✅ Dùng "vn" để match với GameLogic
                phonetic: w.phonetic,
                type: w.type,
                level: w.level,
                part: w.part,
                example: w.example,
                image: w.image,
                wrongCount: w.wrongCount,
                priorityScore: w.priorityScore,
                masteryLevel: w.masteryLevel
            };
            console.log('   Formatted word:', formatted);
            return formatted;
        });

        console.log('   Generating multiple choice questions...');
        // Tạo câu hỏi multiple choice cho mỗi từ
        this.questions = formattedWords.map(word => {
            const question = GameLogic.generateMultipleChoice(word, this.config.optionsCount);
            console.log('   Generated question:', question);
            return question;
        });

        console.log(`📝 Generated ${this.questions.length} review questions`);
        console.log('🔍 ReviewMistakes.generateQuestions() - END');
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
        this.selectedAnswer = null;
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

        const wrongCount = question.word.wrongCount || 1;

        container.innerHTML = `
            <div class="question-container">
                <div class="review-badge">
                    <span class="badge badge-warning">Luyện lại</span>
                    <span class="wrong-count">Đã sai ${wrongCount} lần</span>
                </div>

                <div class="question-word">
                    <div class="word-display">${question.word.en}</div>
                    <div class="word-phonetic">${question.word.phonetic || ''}</div>
                    <div class="word-type">${question.word.type || ''}</div>
                    ${question.word.image ? `
                        <img src="${question.word.image}" class="word-image" alt="${question.word.en}"
                              onerror="this.style.display='none'">
                    ` : ''}
                </div>

                <div class="question-prompt">
                    Nghĩa của từ này là gì?
                </div>

                <div class="choices-container">
                    ${question.options.map((option, index) => `
                        <button class="choice-btn" data-index="${index}">
                            ${option}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        // Attach listeners
        this.attachListeners();

        // Auto pronounce khi hiển thị câu hỏi (nếu bật cài đặt)
        if (GameState.state?.settings?.autoPronunciation) {
            setTimeout(() => {
                GameLogic.speakWord(question.word.en, 'en-US');
            }, 300);
        }
    },

    /**
     * Attach event listeners
     */
    attachListeners() {
        const choices = document.querySelectorAll('.choice-btn');

        choices.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                this.selectAnswer(index);
            });
        });
    },

    /**
     * Select answer
     */
    selectAnswer(index) {
        const question = this.questions[this.currentIndex];
        this.selectedAnswer = index;

        // Disable all buttons
        const choices = document.querySelectorAll('.choice-btn');
        choices.forEach(btn => btn.disabled = true);

        // Check if correct
        const isCorrect = question.options[index] === question.correctAnswer;

        // Highlight selection
        choices[index].classList.add(isCorrect ? 'correct' : 'wrong');

        // Show correct answer if wrong
        if (!isCorrect) {
            const correctIndex = question.options.indexOf(question.correctAnswer);
            if (correctIndex !== -1) {
                choices[correctIndex].classList.add('correct');
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
                title: 'Chính xác!',
                message: 'Từ này đã được xóa khỏi danh sách cần ôn lại',
                duration: 2000
            });
        } else {
            Notification.show({
                type: 'error',
                title: 'Chưa đúng',
                message: `Đáp án đúng: ${question.correctAnswer}`,
                duration: 3000
            });
        }

        // Pronounce the word
        if (GameState.state.settings.soundEnabled && question.word.en) {
            setTimeout(() => {
                GameLogic.speakWord(question.word.en, 'en-US');
            }, 500);
        }

        // Show example sentence if available
        this.showWordInfo(question.word);

        // Move to next question (longer delay to read example)
        const delay = question.word.example ? 4500 : 2500;
        setTimeout(() => {
            this.nextQuestion();
        }, delay);
    },

    /**
     * Show word info (example + pronunciation) after answering
     */
    showWordInfo(word) {
        if (!word.example) return;

        const container = document.querySelector('.question-container');
        if (!container) return;

        const infoPanel = document.createElement('div');
        infoPanel.className = 'word-info-panel';
        infoPanel.innerHTML = `
            <div class="word-info-example">
                <i class="fas fa-quote-left" style="color: var(--primary-color); margin-right: 6px;"></i>
                <span>${word.example}</span>
                <button class="btn-speak-mini" id="speak-example-btn" title="Nghe phát âm câu ví dụ">
                    <i class="fas fa-volume-up"></i>
                </button>
            </div>
        `;
        const prompt = container.querySelector('.question-prompt');
        if (prompt) {
            container.insertBefore(infoPanel, prompt);
        } else {
            container.appendChild(infoPanel);
        }

        // Attach speak listener
        const speakBtn = document.getElementById('speak-example-btn');
        if (speakBtn) {
            speakBtn.addEventListener('click', () => {
                GameLogic.speakWord(word.example, 'en-US');
            });
        }

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

        const correctIndex = question.options.indexOf(question.correctAnswer);

        // Loại bỏ 2 đáp án sai
        const choices = document.querySelectorAll('.choice-btn');
        let removed = 0;

        choices.forEach((btn, index) => {
            if (index !== correctIndex && removed < 2) {
                btn.style.opacity = '0.3';
                btn.disabled = true;
                removed++;
            }
        });

        this.hintUsed = true;

        Notification.show({
            type: 'info',
            title: '💡 Gợi ý',
            message: 'Đã loại bỏ 2 đáp án sai'
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
            message: `Đáp án: ${question.correctAnswer}`
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
        console.log('✅ Review Mistakes mode completed');
        PracticeManager.complete();
    },

    /**
     * Cleanup resources
     */
    cleanup() {
        console.log('🧹 ReviewMistakes cleanup: Clearing state');
        EventBus.off(GameEvents.HINT_USED);
        this.questions = [];
        this.currentIndex = 0;
        this.selectedAnswer = null;
        this.hintUsed = false;
    }
};

// Make global
window.ReviewMistakes = ReviewMistakes;

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReviewMistakes;
}
