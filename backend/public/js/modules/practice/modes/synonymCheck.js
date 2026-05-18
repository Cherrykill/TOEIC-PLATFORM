// ===================================
// SYNONYM CHECK MODE - Kiểm tra từ đồng nghĩa
// ===================================

const SynonymCheck = {

    config: null,
    questions: [],
    currentIndex: 0,
    selectedAnswer: null,
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
                message: 'Không tìm thấy từ vựng nào để luyện tập trong Part này.',
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

        // ✅ Nếu chọn Part → Dùng TẤT CẢ từ, Nếu không → Giới hạn theo config
        const selectedWords = selectedPart
            ? words // Lấy tất cả khi chọn part
            : words.slice(0, this.config.questionsPerRound || 20); // Giới hạn khi random

        // Generate synonym check questions
        this.questions = selectedWords.map(word =>
            GameLogic.generateSynonymCheck(word, this.config.optionsCount)
        );

        console.log(`📝 Generated ${this.questions.length} synonym check questions`);
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

        container.innerHTML = `
            <div class="question-container">
                <div class="question-word question-word--split">
                    <div class="question-text-col">
                        <div class="synonyms-label">
                            Đồng nghĩa (EN)
                            <button class="btn-speak" id="speak-synonyms-btn" title="Nghe phát âm từ đồng nghĩa" style="margin-left:6px">
                                <i class="fas fa-volume-up"></i>
                            </button>
                        </div>
                        <div class="synonyms-list" style="font-size:1.05rem; font-weight:600; color:var(--primary-color)">
                            ${question.word.synonyms || ''}
                        </div>
                    </div>
                    <div class="question-synonyms-col">
                        <div class="synonyms-prompt">${question.question}</div>
                    </div>
                    ${question.word.image ? `
                        <div class="question-image-col">
                            <img src="${question.word.image}" class="word-image" alt="${question.word.en}"
                                 onerror="this.closest('.question-image-col').style.display='none'">
                        </div>
                    ` : ''}
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

        document.getElementById('speak-synonyms-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const q = this.questions?.[this.currentIndex];
            if (q?.word?.synonyms) this.speakSynonyms(q.word.synonyms);
        });
    },

    /**
     * Đọc từng từ đồng nghĩa, nghỉ nhẹ giữa các từ (không đọc dấu phẩy)
     */
    speakSynonyms(synonyms) {
        const words = synonyms.split(',').map(w => w.trim()).filter(Boolean);
        let i = 0;
        const speakNext = () => {
            if (i >= words.length) return;
            const word = words[i++];
            GameLogic.speakWord(word, 'en-US', () => {
                setTimeout(speakNext, 400);
            });
        };
        speakNext();
    },

    /**
     * Select answer
     */
    selectAnswer(index) {
        const question = this.questions[this.currentIndex];
        this.selectedAnswer = index;

        // Visual feedback
        const choices = document.querySelectorAll('.choice-btn');
        choices.forEach(btn => btn.disabled = true);

        const isCorrect = index === question.correctIndex;

        if (isCorrect) {
            choices[index].classList.add('correct');
            PracticeManager.recordAnswer(true, question.word);

            // Play sound
            if (GameState.state.settings.soundEnabled) {
                Utils.playSound(Config.sounds.correct, 0.5);
            }
        } else {
            choices[index].classList.add('wrong');
            choices[question.correctIndex].classList.add('correct');
            PracticeManager.recordAnswer(false, question.word);

            // Play sound
            if (GameState.state.settings.soundEnabled) {
                Utils.playSound(Config.sounds.wrong, 0.5);
            }
        }

        // Show example sentence if available
        this.showWordInfo(question.word);

        // Next question after delay (longer to read example)
        const delay = question.word.example ? 2000 : 1000;
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

        const choices = document.querySelectorAll('.choice-btn');
        let removed = 0;

        choices.forEach((btn, index) => {
            if (index !== question.correctIndex && removed < 2) {
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
     * Cleanup resources (called when exiting practice)
     */
    cleanup() {
        console.log('🧹 SynonymCheck cleanup: Clearing state');
        EventBus.off(GameEvents.HINT_USED);
        this.questions = [];
        this.currentIndex = 0;
        this.selectedAnswer = null;
        this.hintUsed = false;
    }
};

// Make global
window.SynonymCheck = SynonymCheck;

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SynonymCheck;
}
