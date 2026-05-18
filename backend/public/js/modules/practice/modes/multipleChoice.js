// ===================================
// MULTIPLE CHOICE MODE (ĐÃ SỬA LỖI ASYNC/AWAIT)
// ===================================

const MultipleChoice = {

    config: null,
    questions: [],
    currentIndex: 0,
    selectedAnswer: null,
    hintUsed: false,
    
    /**
     * Start mode
     */
    async start(config) { // THÊM ASYNC
        this.config = config;
        this.currentIndex = 0;

        // Generate questions
        await this.generateQuestions(); // THÊM AWAIT

        // Setup hint and skip event listeners
        this.setupHintSkipListeners();

        // Show first question (Chỉ hiển thị khi đã tạo xong questions)
        if (this.questions.length > 0) {
            this.showQuestion();
        } else {
             // Xử lý trường hợp không có từ vựng nào được tìm thấy
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

        // Tạo câu hỏi từ các từ đã chọn
        this.questions = selectedWords.map(word =>
            GameLogic.generateMultipleChoice(word, this.config.optionsCount)
        );
        
        console.log(`📝 Generated ${this.questions.length} questions`);
    },
    
    // ... (Các hàm showQuestion, render, attachListeners, selectAnswer, nextQuestion, finish GIỮ NGUYÊN)
    
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
        
        const isReversed = question.reversed;
        container.innerHTML = `
            <div class="question-container">
                <div class="question-word question-word--split">
                    <div class="question-text-col">
                        <div class="word-display">
                            ${question.question}
                            ${!isReversed ? `<button class="btn-speak" id="speak-word-btn" title="Nghe phát âm">
                                <i class="fas fa-volume-up"></i>
                            </button>` : ''}
                        </div>
                        ${!isReversed && question.word.phonetic ? `<div class="word-phonetic">/${question.word.phonetic}/</div>` : ''}
                        <div class="word-type">${question.word.type}</div>
                    </div>
                    <div class="question-synonyms-col">
                        ${isReversed ? `<div class="synonyms-prompt">Từ tiếng Anh tương ứng là gì?</div>` : question.word.synonyms ? `
                            <div class="synonyms-label">Đồng nghĩa</div>
                            <div class="synonyms-list">${question.word.synonyms}</div>
                            ${question.word.synonyms_vn ? `<div class="synonyms-list-vn">${question.word.synonyms_vn}</div>` : ''}
                        ` : ''}
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

        // Auto pronounce khi hiển thị câu hỏi (nếu bật cài đặt, chỉ khi EN hiển thị)
        if (!question.reversed && GameState.state?.settings?.autoPronunciation) {
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

        // Thêm listener cho nút nghe âm thanh
        const speakBtn = document.getElementById('speak-word-btn');
        if (speakBtn) {
            speakBtn.addEventListener('click', () => {
                const q = this.questions[this.currentIndex];
                if (q && q.word) GameLogic.speakWord(q.word.en, 'en-US');
            });
        }
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

        setTimeout(() => {
            this.nextQuestion();
        }, 2000);
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
    finish() {
        PracticeManager.complete();
    },

    /**
     * Setup hint and skip event listeners
     */
    setupHintSkipListeners() {
        // Listen for hint event
        EventBus.on(GameEvents.HINT_USED, () => {
            if (!this.hintUsed && this.currentIndex < this.questions.length) {
                this.showHint();
            }
        });

        // Listen for skip event
        EventBus.on(GameEvents.QUESTION_SKIPPED, () => {
            if (this.currentIndex < this.questions.length) {
                this.skipCurrentQuestion();
            }
        });
    },

    /**
     * Show hint for current question
     */
    showHint() {
        const question = this.questions[this.currentIndex];
        if (!question || this.hintUsed) return;

        this.hintUsed = true;

        // Remove 2 wrong answers (50/50 style hint)
        const choices = document.querySelectorAll('.choice-btn');
        const wrongIndexes = [];

        choices.forEach((btn, index) => {
            if (index !== question.correctIndex) {
                wrongIndexes.push(index);
            }
        });

        // Randomly remove 2 wrong answers
        const shuffled = wrongIndexes.sort(() => Math.random() - 0.5);
        const toRemove = shuffled.slice(0, 2);

        toRemove.forEach(index => {
            choices[index].style.opacity = '0.3';
            choices[index].style.pointerEvents = 'none';
            choices[index].disabled = true;
        });

        Notification.show({
            type: 'info',
            title: '💡 Gợi ý',
            message: 'Đã loại bỏ 2 đáp án sai',
            duration: 2000
        });
    },

    /**
     * Skip current question
     */
    skipCurrentQuestion() {
        const question = this.questions[this.currentIndex];
        if (!question) return;

        // Disable all buttons
        const choices = document.querySelectorAll('.choice-btn');
        choices.forEach(btn => btn.disabled = true);

        // Show correct answer
        choices[question.correctIndex].classList.add('correct');

        // Record as wrong answer
        PracticeManager.recordAnswer(false, question.word);

        // Move to next question after delay
        setTimeout(() => {
            this.nextQuestion();
        }, 1500);
    },

    /**
     * Cleanup resources (called when exiting practice)
     */
    cleanup() {
        console.log('🧹 MultipleChoice cleanup: Clearing state');

        // Remove event listeners
        EventBus.off(GameEvents.HINT_USED);
        EventBus.off(GameEvents.QUESTION_SKIPPED);

        this.questions = [];
        this.currentIndex = 0;
        this.selectedAnswer = null;
        this.hintUsed = false;
    }
};

// Make global
window.MultipleChoice = MultipleChoice;

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MultipleChoice;
}