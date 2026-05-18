// ===================================
// LISTENING MODE (ĐÃ SỬA LỖI ASYNC/AWAIT)
// ===================================

const Listening = {

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
        this.hintUsed = false;

        // Generate questions
        await this.generateQuestions(); // THÊM AWAIT

        // Setup hint listener
        this.setupHintSkipListeners();

        // Show first question
        if (this.questions.length > 0) {
            this.showQuestion();
        } else {
             // Xử lý trường hợp không có từ vựng nào được tìm thấy
             PracticeManager.complete(); 
             Notification.show({
                 type: 'warning',
                 title: 'Không có từ vựng',
                 message: 'Không tìm thấy từ vựng nào để luyện tập.',
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
            GameLogic.generateListening(word, this.config.optionsCount)
        );
        
        console.log(`📝 Generated ${this.questions.length} listening questions`);
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
        
        // Auto play audio (chỉ khi không reversed)
        if (!question.reversed) {
            setTimeout(() => {
                this.playAudio(question.word.en);
            }, 500);
        }
    },
    
    /**
     * Render question UI
     */
    render(question) {
        const container = document.getElementById('practice-content');
        if (!container) return;
        
        const isReversed = question.reversed;
        container.innerHTML = `
            <div class="listening-container">
                <div class="question-word question-word--split">
                    <div class="question-text-col">
                        ${isReversed ? `
                            <div class="word-display">${question.word.vn}</div>
                            <div class="word-type">${question.word.type}</div>
                        ` : `
                            <div class="audio-player">
                                <button class="play-audio-btn" id="play-audio-btn">
                                    <i class="fas fa-volume-up"></i>
                                </button>
                            </div>
                        `}
                    </div>
                    <div class="question-synonyms-col">
                        ${question.word.synonyms ? `
                            <div class="synonyms-label">Đồng nghĩa</div>
                            <div class="synonyms-list">${question.word.synonyms}</div>
                        ` : `<div class="synonyms-prompt">${isReversed ? 'Chọn từ tiếng Anh tương ứng:' : 'Chọn nghĩa đúng của từ bạn vừa nghe:'}</div>`}
                    </div>
                    ${question.word.image ? `
                        <div class="question-image-col">
                            <img src="${question.word.image}" class="word-image" alt="Vocabulary"
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
        this.attachListeners(question);
    },
    
    /**
     * Attach event listeners
     */
    attachListeners(question) {
        // Play button (chỉ có khi không reversed)
        const playBtn = document.getElementById('play-audio-btn');
        playBtn?.addEventListener('click', () => {
            this.playAudio(question.word.en);
        });

        
        // Choice buttons
        const choices = document.querySelectorAll('.choice-btn');
        choices.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                this.selectAnswer(index);
            });
        });
    },
    
    /**
     * Play audio
     */
    playAudio(text) {
        GameLogic.speakWord(text, 'en-US');
        
        // Animate play button
        const playBtn = document.getElementById('play-audio-btn');
        if (playBtn) {
            playBtn.classList.add('playing');
            // Giả sử âm thanh dài 1000ms
            setTimeout(() => {
                playBtn.classList.remove('playing');
            }, 1000); 
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

        // Show word info (word text + example) after answering
        this.showWordInfo(question.word);

        // Next question after delay (longer to read info)
        const delay = question.word.example ? 3500 : 1500;
        setTimeout(() => {
            this.nextQuestion();
        }, delay);
    },
    
    /**
     * Show word info (word + example + pronunciation) after answering
     */
    showWordInfo(word) {
        const container = document.querySelector('.listening-container');
        if (!container) return;

        const infoPanel = document.createElement('div');
        infoPanel.className = 'word-info-panel';
        infoPanel.innerHTML = `
            <div class="word-info-reveal">
                <strong>${word.en}</strong> - ${word.vn}
                <span class="word-info-phonetic">${word.phonetic || ''}</span>
            </div>
            ${word.example ? `
                <div class="word-info-example">
                    <i class="fas fa-quote-left" style="color: var(--primary-color); margin-right: 6px;"></i>
                    <span>${word.example}</span>
                    <button class="btn-speak-mini" id="speak-example-btn" title="Nghe phát âm câu ví dụ">
                        <i class="fas fa-volume-up"></i>
                    </button>
                </div>
            ` : ''}
        `;
        const questionPrompt = container.querySelector('.question-prompt');
        if (questionPrompt) {
            container.insertBefore(infoPanel, questionPrompt);
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
        console.log('🧹 Listening cleanup: Clearing state');
        EventBus.off(GameEvents.HINT_USED);
        this.questions = [];
        this.currentIndex = 0;
        this.selectedAnswer = null;
        this.hintUsed = false;
    }
};

// Make global
window.Listening = Listening;

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Listening;
}