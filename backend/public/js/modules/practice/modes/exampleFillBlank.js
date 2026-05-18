// ===================================
// EXAMPLE FILL BLANK MODE - Điền từ vào câu ví dụ
// ===================================

const ExampleFillBlank = {

    config: null,
    questions: [],
    currentIndex: 0,
    hintUsed: false,

    /**
     * Start mode
     */
    async start(config) {
        this.config = config;
        this.currentIndex = 0;
        this.hintUsed = false;

        // Generate questions
        await this.generateQuestions();

        // Setup hint listener
        this.setupHintSkipListeners();

        // Show first question
        if (this.questions.length > 0) {
            this.showQuestion();
        } else {
            PracticeManager.complete();
            Notification.show({
                type: 'warning',
                title: 'Không có từ vựng',
                message: 'Không tìm thấy từ vựng có câu ví dụ để luyện tập.',
            });
        }
    },

    /**
     * Generate questions
     */
    async generateQuestions() {
        // ✅ Kiểm tra xem có chọn Part không
        const selectedPart = GameState.state?.settings?.selectedPart || null;
        const requestCount = selectedPart ? 9999 : (this.config.questionsPerRound || 20);

        const words = await PartSelector.getWordsForPractice(requestCount);

        if (!Array.isArray(words)) {
            console.error("Lỗi: PartSelector không trả về mảng từ vựng.");
            this.questions = [];
            return;
        }

        // Lọc chỉ những từ có example
        const wordsWithExample = words.filter(word => word.example && word.example.trim() !== '');

        if (wordsWithExample.length === 0) {
            console.warn("Không có từ nào có example.");
            this.questions = [];
            return;
        }

        // ✅ Nếu chọn Part → Dùng TẤT CẢ từ, Nếu không → Giới hạn theo config
        const selectedWords = selectedPart
            ? wordsWithExample // Lấy tất cả khi chọn part
            : wordsWithExample.slice(0, this.config.questionsPerRound || 20); // Giới hạn khi random

        // Tạo câu hỏi với example
        this.questions = selectedWords.map(word => {
            const question = this.createQuestionFromExample(word);
            return question;
        }).filter(q => q !== null); // Loại bỏ các câu hỏi null

        console.log(`📝 Generated ${this.questions.length} example fill-blank questions`);
    },

    /**
     * Tạo câu hỏi từ example sentence
     */
    createQuestionFromExample(word) {
        if (!word.example || !word.en) return null;

        const example = word.example;
        const targetWord = word.en;

        // Tìm vị trí từ trong câu (case-insensitive)
        const regex = new RegExp(`\\b${targetWord}\\b`, 'gi');
        const match = example.match(regex);

        if (!match) {
            console.warn(`Từ "${targetWord}" không có trong example: "${example}"`);
            return null;
        }

        // Thay thế từ bằng dấu gạch dưới
        const blankedSentence = example.replace(regex, '______');

        // Lấy 3 từ khác làm đáp án sai
        const allWords = GameLogic.getVocabulary();
        const otherWords = allWords.filter(w =>
            w.en !== word.en &&
            w.type === word.type // Cùng loại từ để khó hơn
        );

        // Random 3 đáp án sai
        const wrongAnswers = Utils.shuffleArray(otherWords)
            .slice(0, 3)
            .map(w => w.en);

        // Trộn đáp án
        const allOptions = Utils.shuffleArray([targetWord, ...wrongAnswers]);

        return {
            word: word,
            sentence: blankedSentence,
            correctAnswer: targetWord,
            options: allOptions,
            originalExample: example
        };
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

        const hintInfo = `
            <div class="word-hint">
                <i class="fas fa-lightbulb"></i>
                <span>${question.word.vn}</span>
            </div>
        `;

        container.innerHTML = `
            <div class="example-fill-blank-container">
                <div class="question-header">
                    <h3>Điền từ đúng vào chỗ trống</h3>
                    ${hintInfo}
                </div>

                <div class="sentence-with-blank">
                    ${question.sentence}
                </div>

                <div class="options-grid">
                    ${question.options.map((option, index) => `
                        <button class="option-btn" data-answer="${option}">
                            ${option}
                        </button>
                    `).join('')}
                </div>

                <div class="feedback-area" id="feedback-area"></div>
            </div>
        `;

        // Attach listeners
        this.attachListeners();
    },

    /**
     * Attach event listeners
     */
    attachListeners() {
        const optionBtns = document.querySelectorAll('.option-btn');

        optionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const selectedAnswer = e.target.dataset.answer;
                this.checkAnswer(selectedAnswer, e.target);
            });
        });
    },

    /**
     * Check answer
     */
    async checkAnswer(selectedAnswer, btnElement) {
        const question = this.questions[this.currentIndex];
        const allBtns = document.querySelectorAll('.option-btn');
        const feedbackArea = document.getElementById('feedback-area');

        // Disable all buttons
        allBtns.forEach(btn => btn.disabled = true);

        const isCorrect = selectedAnswer === question.correctAnswer;

        // Pronounce the complete sentence
        if (GameState.state.settings.soundEnabled) {
            setTimeout(() => {
                GameLogic.speakWord(question.originalExample, 'en-US');
            }, 300);
        }

        // Get translation
        feedbackArea.innerHTML = `
            <div class="feedback ${isCorrect ? 'correct' : 'wrong'}">
                <i class="fas fa-${isCorrect ? 'check' : 'times'}-circle"></i>
                <span>${isCorrect ? 'Chính xác!' : `Sai rồi! Đáp án đúng là: <strong>${question.correctAnswer}</strong>`}</span>
                <div class="full-sentence">${question.originalExample}</div>
                <div class="translation-loading"><i class="fas fa-spinner fa-spin"></i> Đang dịch...</div>
            </div>
        `;

        if (isCorrect) {
            btnElement.classList.add('correct');
            PracticeManager.recordAnswer(true, question.word);

            // Play sound
            if (GameState.state.settings.soundEnabled) {
                Utils.playSound(Config.sounds.correct, 0.5);
            }
        } else {
            btnElement.classList.add('wrong');

            // Highlight correct answer
            allBtns.forEach(btn => {
                if (btn.dataset.answer === question.correctAnswer) {
                    btn.classList.add('correct');
                }
            });

            PracticeManager.recordAnswer(false, question.word);

            // Play sound
            if (GameState.state.settings.soundEnabled) {
                Utils.playSound(Config.sounds.wrong, 0.5);
            }
        }

        // Fetch translation — next question chỉ chạy SAU KHI translation hiện ra
        const READ_DELAY = 2500; // ms đọc sau khi thấy bản dịch
        let done = false;

        // Fallback: tối đa 5s chờ API rồi next luôn
        const fallback = setTimeout(() => {
            if (done) return;
            done = true;
            const d = feedbackArea.querySelector('.translation-loading');
            if (d) d.innerHTML = '';
            this.nextQuestion();
        }, 5000);

        try {
            const translation = await AiAPI.translate(question.originalExample);
            const translationDiv = feedbackArea.querySelector('.translation-loading');

            if (translation && translationDiv) {
                translationDiv.innerHTML = `<div class="translation"><i class="fas fa-language"></i> ${translation}</div>`;
                translationDiv.classList.remove('translation-loading');
                translationDiv.classList.add('translation-success');
            } else if (translationDiv) {
                translationDiv.innerHTML = '';
            }
        } catch (error) {
            console.error('Translation error:', error);
            const d = feedbackArea.querySelector('.translation-loading');
            if (d) d.innerHTML = '';
        }

        if (!done) {
            done = true;
            clearTimeout(fallback);
            setTimeout(() => this.nextQuestion(), READ_DELAY);
        }
    },

    /**
     * Next question
     */
    nextQuestion() {
        this.currentIndex++;
        this.showQuestion();
    },

    /**
     * Finish mode
     */
    /**
     * Setup hint listener
     */
    setupHintSkipListeners() {
        EventBus.on(GameEvents.HINT_USED, () => {
            if (!this.hintUsed && this.currentIndex < this.questions.length) {
                this.showHint();
            }
        });
    },

    /**
     * Show hint - loại bỏ 2 đáp án sai
     */
    showHint() {
        const question = this.questions[this.currentIndex];
        if (!question || this.hintUsed) return;

        const options = document.querySelectorAll('.option-btn');
        let removed = 0;

        options.forEach((btn) => {
            if (btn.dataset.answer !== question.correctAnswer && removed < 2) {
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

    finish() {
        PracticeManager.complete();
    },

    /**
     * Cleanup resources
     */
    cleanup() {
        console.log('🧹 ExampleFillBlank cleanup: Clearing state');
        EventBus.off(GameEvents.HINT_USED);
        this.questions = [];
        this.currentIndex = 0;
        this.hintUsed = false;
    }
};

// Make global
window.ExampleFillBlank = ExampleFillBlank;

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExampleFillBlank;
}