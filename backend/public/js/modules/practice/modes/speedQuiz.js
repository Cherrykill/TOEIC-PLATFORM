// ===================================
// SPEED QUIZ MODE (ĐÃ SỬA LỖI ASYNC/AWAIT)
// ===================================

const SpeedQuiz = {
    
    config: null,
    questions: [],
    currentIndex: 0,
    timeRemaining: 0,
    timerId: null,
    // Biến để giữ tham chiếu hàm handleKeyboard đã được bind
    boundHandleKeyboard: null, 
    
    /**
     * Start mode
     */
    async start(config) { // THÊM ASYNC
        this.config = config;
        this.currentIndex = 0;
        
        // Generate questions
        await this.generateQuestions(); // THÊM AWAIT
        
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

        this.questions = selectedWords.map(word =>
            GameLogic.generateSpeedQuiz(word)
        );
        
        console.log(`📝 Generated ${this.questions.length} speed quiz questions`);
    },
    
    /**
     * Show current question
     */
    showQuestion() {
        // Loại bỏ listener bàn phím cũ trước khi hiển thị câu hỏi mới
        if (this.boundHandleKeyboard) {
            document.removeEventListener('keydown', this.boundHandleKeyboard);
            this.boundHandleKeyboard = null;
        }

        if (this.currentIndex >= this.questions.length) {
            this.finish();
            return;
        }
        
        const question = this.questions[this.currentIndex];
        
        // Update progress
        PracticeManager.updateProgress(
            this.currentIndex + 1,
            this.questions.length
        );
        
        // Reset timer
        this.timeRemaining = this.config.timePerQuestion;
        
        // Render question
        this.render(question);
        
        // Start countdown
        this.startTimer();
    },
    
    /**
     * Render question UI
     */
    render(question) {
        const container = document.getElementById('practice-content');
        if (!container) return;
        
        container.innerHTML = `
            <div class="speed-quiz-container">
                <div class="countdown-timer" id="countdown-timer">
                    ${this.timeRemaining}
                </div>

                <div class="speed-question">
                    <div class="word-display">
                        ${question.question}
                        <button class="btn-speak" id="speak-word-btn" title="Nghe phát âm">
                            <i class="fas fa-volume-up"></i>
                        </button>
                    </div>
                    <div class="arrow">→</div>
                    <div class="shown-answer">${question.shownAnswer}</div>
                </div>

                <div class="question-prompt">
                    Đây có phải nghĩa đúng không?
                </div>
                
                <div class="speed-choices">
                    <button class="speed-choice-btn correct-btn" data-answer="true">
                        <i class="fas fa-check"></i>
                        Đúng
                    </button>
                    <button class="speed-choice-btn wrong-btn" data-answer="false">
                        <i class="fas fa-times"></i>
                        Sai
                    </button>
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
        const buttons = document.querySelectorAll('.speed-choice-btn');

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const userAnswer = btn.dataset.answer === 'true';
                this.checkAnswer(userAnswer, question);
            });
        });

        // Thêm listener cho nút nghe âm thanh
        const speakBtn = document.getElementById('speak-word-btn');
        if (speakBtn) {
            speakBtn.addEventListener('click', () => {
                if (question && question.question) {
                    GameLogic.speakWord(question.question, 'en-US');
                }
            });
        }

        // Keyboard shortcuts
        // SỬA LỖI: Bind 'this' và truyền câu hỏi để xử lý bàn phím đúng cách
        this.boundHandleKeyboard = this.handleKeyboard.bind(this, question);
        document.addEventListener('keydown', this.boundHandleKeyboard);
    },
    
    /**
     * Handle keyboard input
     */
    handleKeyboard(question, e) {
        // Vô hiệu hóa phím tắt nếu đã trả lời
        const buttons = document.querySelectorAll('.speed-choice-btn');
        if (buttons.length > 0 && buttons[0].disabled) return; 

        let userAnswer = null;
        
        if (e.key === 'ArrowLeft' || e.key === '1') {
            userAnswer = true;
        } else if (e.key === 'ArrowRight' || e.key === '2') {
            userAnswer = false;
        }

        if (userAnswer !== null) {
            // Ngăn chặn hành vi mặc định (ví dụ: cuộn trang bằng Arrow keys)
            e.preventDefault(); 
            this.checkAnswer(userAnswer, question);
        }
    },
    
    /**
     * Start countdown timer
     */
    startTimer() {
        const timerEl = document.getElementById('countdown-timer');
        
        // Đảm bảo màu được đặt lại
        if (timerEl) {
             timerEl.style.color = 'inherit';
        }

        this.timerId = setInterval(() => {
            this.timeRemaining--;
            
            if (timerEl) {
                timerEl.textContent = this.timeRemaining;
                
                // Change color when time is low
                if (this.timeRemaining <= 3) {
                    timerEl.style.color = 'var(--error-color)';
                }
            }
            
            if (this.timeRemaining <= 0) {
                this.stopTimer();
                this.timeOut();
            }
        }, 1000);
    },
    
    /**
     * Stop timer
     */
    stopTimer() {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    },
    
    /**
     * Time out handler
     */
    timeOut() {
        const question = this.questions[this.currentIndex];
        
        // Vô hiệu hóa các nút
        const buttons = document.querySelectorAll('.speed-choice-btn');
        buttons.forEach(btn => btn.disabled = true);

        // Loại bỏ listener bàn phím
        if (this.boundHandleKeyboard) {
            document.removeEventListener('keydown', this.boundHandleKeyboard);
        }
        
        PracticeManager.recordAnswer(false, question.word);
        
        Notification.show({
            type: 'warning',
            title: 'Hết giờ!',
            message: `Đáp án đúng: ${question.correctAnswer}`
        });
        
        setTimeout(() => {
            this.nextQuestion();
        }, 1000);
    },
    
    /**
     * Check answer
     */
    checkAnswer(userAnswer, question) {
        this.stopTimer();
        
        // Loại bỏ listener bàn phím ngay lập tức
        if (this.boundHandleKeyboard) {
            document.removeEventListener('keydown', this.boundHandleKeyboard);
        }

        // Disable buttons
        const buttons = document.querySelectorAll('.speed-choice-btn');
        buttons.forEach(btn => btn.disabled = true);
        
        const isCorrect = GameLogic.checkSpeedQuiz(userAnswer, question.isCorrect);
        
        if (isCorrect) {
            // Correct
            PracticeManager.recordAnswer(true, question.word);
            
            // Highlight correct button
            if (userAnswer) {
                document.querySelector('.correct-btn')?.classList.add('selected', 'correct');
            } else {
                document.querySelector('.wrong-btn')?.classList.add('selected', 'correct');
            }
            
            // Play sound
            if (GameState.state.settings.soundEnabled) {
                Utils.playSound(Config.sounds.correct, 0.5);
            }
        } else {
            // Wrong
            PracticeManager.recordAnswer(false, question.word);
            
            // Highlight câu trả lời đúng (màu xanh) và câu trả lời sai của người dùng (màu đỏ)
            if (question.isCorrect) {
                // Đáp án đúng là 'Đúng' -> 'Đúng' xanh, người dùng chọn 'Sai' -> 'Sai' đỏ
                document.querySelector('.correct-btn')?.classList.add('correct');
                document.querySelector('.wrong-btn')?.classList.add('wrong');
            } else {
                // Đáp án đúng là 'Sai' -> 'Sai' xanh, người dùng chọn 'Đúng' -> 'Đúng' đỏ
                document.querySelector('.wrong-btn')?.classList.add('correct');
                document.querySelector('.correct-btn')?.classList.add('wrong');
            }
            
            // Play sound
            if (GameState.state.settings.soundEnabled) {
                Utils.playSound(Config.sounds.wrong, 0.5);
            }
        }
        
        // Next question after delay
        setTimeout(() => {
            this.nextQuestion();
        }, 1000);
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
        this.stopTimer();
        // Loại bỏ listener bàn phím cuối cùng
        if (this.boundHandleKeyboard) {
            document.removeEventListener('keydown', this.boundHandleKeyboard);
        }
        PracticeManager.complete();
    },

    /**
     * Cleanup resources (called when exiting practice)
     */
    cleanup() {
        console.log('🧹 SpeedQuiz cleanup: Stopping timer and removing listeners');
        this.stopTimer();
        if (this.boundHandleKeyboard) {
            document.removeEventListener('keydown', this.boundHandleKeyboard);
            this.boundHandleKeyboard = null;
        }
        this.questions = [];
        this.currentIndex = 0;
        this.timeRemaining = 0;
    }
};

// Make global
window.SpeedQuiz = SpeedQuiz;

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpeedQuiz;
}