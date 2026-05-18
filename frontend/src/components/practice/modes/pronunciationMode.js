import { GameLogic } from '@game/gameLogic.js';
import { GameState } from '@game/state.js';
import { Config } from '@game/config.js';
import { Utils } from '@lib/utils.js';
import { Notification } from '@ui/Toaster.jsx';

export const PronunciationMode = {

    config: null,
    questions: [],
    currentIndex: 0,
    currentAttempts: 0,
    recognition: null,
    isListening: false,
    currentWord: null,
    wordCompleted: false,

    async start(config) {
        this.config = config;
        this.currentIndex = 0;

        if (!this.checkBrowserSupport()) {
            Notification.show({
                type: 'error',
                title: 'Không hỗ trợ',
                message: 'Trình duyệt của bạn không hỗ trợ nhận dạng giọng nói. Vui lòng sử dụng Chrome hoặc Edge.',
                duration: 5000
            });
            PracticeManager.exitPractice();
            return;
        }

        this.initSpeechRecognition();

        await this.generateQuestions();

        if (this.questions.length > 0) {
            this.showQuestion();
        }
    },

    checkBrowserSupport() {
        return ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
    },

    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();

        this.recognition.lang = this.config.recognitionLang || 'en-US';
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.maxAlternatives = 5;

        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateMicButton(true);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.updateMicButton(false);
        };

        this.recognition.onresult = (event) => {
            const results = Array.from(event.results[0]);
            const transcript = event.results[0][0].transcript.toLowerCase().trim();
            this.handleRecognitionResult(transcript, results);
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;
            this.updateMicButton(false);

            if (event.error === 'no-speech') {
                Notification.show({
                    type: 'warning',
                    title: 'Không nghe thấy',
                    message: 'Vui lòng nói rõ hơn và thử lại',
                    duration: 2000
                });
            } else if (event.error === 'not-allowed') {
                Notification.show({
                    type: 'error',
                    title: 'Không có quyền truy cập',
                    message: 'Vui lòng cho phép truy cập microphone',
                    duration: 3000
                });
            }
        };
    },

    async generateQuestions() {
        const words = GameLogic.getRandomWords(this.config.questionsPerRound);
        this.questions = words.map(word => ({
            word: word,
            wordEn: word.en.toLowerCase().trim(),
            wordVn: word.vn,
            wordType: word.type || ''
        }));
    },

    showQuestion() {
        if (this.currentIndex >= this.questions.length) {
            this.finish();
            return;
        }

        const question = this.questions[this.currentIndex];
        this.currentWord = question.wordEn;
        this.currentAttempts = 0;
        this.wordCompleted = false;

        PracticeManager.updateProgress(
            this.currentIndex + 1,
            this.questions.length
        );

        this.render(question);

        setTimeout(() => {
            GameLogic.speakWord(question.wordEn, this.config.recognitionLang);
        }, 500);
    },

    render(question) {
        const container = document.getElementById('practice-content');
        if (!container) return;

        container.innerHTML = `
            <div class="question-container pronunciation-container">
                <div class="question-prompt">
                    <h3>🎤 Phát âm từ tiếng Anh</h3>
                    <div class="instruction-box">
                        <p><i class="fas fa-info-circle"></i> <strong>Cách chơi:</strong> Click vào mic và phát âm từ tiếng Anh. Bạn có tối đa ${this.config.maxAttempts} lần thử.</p>
                    </div>
                </div>

                <div class="pronunciation-word-display">
                    <div class="word-to-pronounce">
                        <div class="word-label">Từ cần phát âm:</div>
                        <div class="word-text" id="word-text-speak" title="Nhấn để nghe phát âm" style="cursor:pointer;">${question.wordEn} <i class="fas fa-volume-up" style="font-size:0.65em;opacity:0.5;margin-left:4px;"></i></div>
                        <div class="word-meaning">
                            <span class="word-type-badge">${question.wordType}</span>
                            <span class="word-translation">${question.wordVn}</span>
                        </div>
                    </div>
                </div>

                <div class="pronunciation-mic-container">
                    <button class="mic-button" id="mic-btn" title="Click để bắt đầu phát âm">
                        <i class="fas fa-microphone"></i>
                    </button>
                    <div class="mic-status" id="mic-status">Click vào mic để bắt đầu</div>
                </div>

                <div class="attempts-counter">
                    <div class="attempts-label">Số lần thử:</div>
                    <div class="attempts-dots" id="attempts-dots">
                        ${Array(this.config.maxAttempts).fill(0).map((_, i) =>
                            `<span class="attempt-dot ${i < this.currentAttempts ? 'used' : ''}"></span>`
                        ).join('')}
                    </div>
                </div>

                <div class="pronunciation-actions">
                    <button class="btn btn-secondary" id="replay-btn">
                        <i class="fas fa-volume-up"></i> Nghe lại
                    </button>
                    <button class="btn btn-danger" id="skip-btn">
                        <i class="fas fa-forward"></i> Bỏ qua
                    </button>
                </div>

                <div class="recognition-result" id="recognition-result" style="display: none;"></div>
            </div>
        `;

        this.attachListeners();
    },

    attachListeners() {
        const micBtn = document.getElementById('mic-btn');
        const replayBtn = document.getElementById('replay-btn');
        const skipBtn = document.getElementById('skip-btn');

        micBtn?.addEventListener('click', () => {
            this.toggleListening();
        });

        document.getElementById('word-text-speak')?.addEventListener('click', () => {
            GameLogic.speakWord(this.currentWord, this.config.recognitionLang);
        });

        replayBtn?.addEventListener('click', () => {
            this.replayWord();
        });

        skipBtn?.addEventListener('click', () => {
            this.skipQuestion();
        });
    },

    toggleListening() {
        if (this.isListening) {
            this.recognition.stop();
        } else {
            if (this.currentAttempts >= this.config.maxAttempts) {
                Notification.show({
                    type: 'warning',
                    title: 'Hết lượt thử',
                    message: 'Đang chuyển sang câu tiếp theo...',
                    duration: 2000
                });
                return;
            }
            this.startListening();
        }
    },

    startListening() {
        try {
            this.recognition.start();
            const micStatus = document.getElementById('mic-status');
            if (micStatus) {
                micStatus.textContent = 'Đang nghe... Hãy nói!';
                micStatus.className = 'mic-status listening';
            }
        } catch (error) {
            console.error('Failed to start recognition:', error);
            Notification.show({
                type: 'error',
                title: 'Lỗi',
                message: 'Không thể khởi động nhận dạng giọng nói',
                duration: 2000
            });
        }
    },

    updateMicButton(listening) {
        const micBtn = document.getElementById('mic-btn');
        if (!micBtn) return;

        if (listening) {
            micBtn.classList.add('listening');
            micBtn.innerHTML = '<i class="fas fa-stop"></i>';
        } else {
            micBtn.classList.remove('listening');
            micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        }
    },

    handleRecognitionResult(transcript, alternatives) {
        if (this.wordCompleted) return;
        this.currentAttempts++;
        this.updateAttemptsDisplay();

        const normalizedTranscript = this.normalizeText(transcript);
        const normalizedTarget = this.normalizeText(this.currentWord);

        const isCorrect = normalizedTranscript === normalizedTarget;

        const isAlternativeCorrect = alternatives.some(alt =>
            this.normalizeText(alt.transcript.toLowerCase().trim()) === normalizedTarget
        );

        const finalCorrect = isCorrect || isAlternativeCorrect;

        this.showRecognitionResult(transcript, finalCorrect);

        if (finalCorrect) {
            this.handleCorrectAnswer();
        } else {
            this.handleWrongAnswer(transcript);
        }
    },

    normalizeText(text) {
        return text
            .toLowerCase()
            .replace(/[.,!?;:'"]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    },

    showRecognitionResult(transcript, isCorrect) {
        const resultDiv = document.getElementById('recognition-result');
        if (!resultDiv) return;

        resultDiv.style.display = 'block';
        resultDiv.className = `recognition-result ${isCorrect ? 'correct' : 'wrong'}`;
        resultDiv.innerHTML = `
            <div class="result-icon">
                <i class="fas fa-${isCorrect ? 'check-circle' : 'times-circle'}"></i>
            </div>
            <div class="result-text">
                <strong>${isCorrect ? 'Chính xác!' : 'Chưa đúng'}</strong><br>
                Bạn nói: "<span class="heard-text">${transcript}</span>"
            </div>
        `;

        const micStatus = document.getElementById('mic-status');
        if (micStatus) {
            micStatus.textContent = isCorrect ? '✓ Chính xác!' : '✗ Thử lại';
            micStatus.className = `mic-status ${isCorrect ? 'correct' : 'wrong'}`;
        }
    },

    updateAttemptsDisplay() {
        const attemptsDotsContainer = document.getElementById('attempts-dots');
        if (!attemptsDotsContainer) return;

        attemptsDotsContainer.innerHTML = Array(this.config.maxAttempts)
            .fill(0)
            .map((_, i) =>
                `<span class="attempt-dot ${i < this.currentAttempts ? 'used' : ''}"></span>`
            )
            .join('');
    },

    handleCorrectAnswer() {
        this.wordCompleted = true;
        if (this.recognition && this.isListening) this.recognition.stop();
        const question = this.questions[this.currentIndex];

        const micBtn = document.getElementById('mic-btn');
        if (micBtn) micBtn.disabled = true;

        PracticeManager.recordAnswer(true, question.word);

        if (GameState.state.settings.soundEnabled) {
            Utils.playSound(Config.sounds.correct, 0.5);
        }

        Notification.show({
            type: 'success',
            title: '🎉 Chính xác!',
            message: `Phát âm của bạn rất tốt!`,
            duration: 2000
        });

        setTimeout(() => {
            this.nextQuestion();
        }, 2500);
    },

    handleWrongAnswer(_transcript) {
        const question = this.questions[this.currentIndex];

        if (GameState.state.settings.soundEnabled) {
            Utils.playSound(Config.sounds.wrong, 0.3);
        }

        if (this.currentAttempts >= this.config.maxAttempts) {
            this.wordCompleted = true;
            if (this.recognition && this.isListening) this.recognition.stop();
            const micBtn = document.getElementById('mic-btn');
            if (micBtn) micBtn.disabled = true;

            PracticeManager.recordAnswer(false, question.word);

            Notification.show({
                type: 'error',
                title: '❌ Hết lượt thử',
                message: `Đáp án đúng: "${this.currentWord}"`,
                duration: 3000
            });

            setTimeout(() => {
                GameLogic.speakWord(this.currentWord, this.config.recognitionLang);
            }, 500);

            setTimeout(() => {
                this.nextQuestion();
            }, 3500);
        } else {
            const remainingAttempts = this.config.maxAttempts - this.currentAttempts;
            Notification.show({
                type: 'warning',
                title: 'Chưa đúng',
                message: `Còn ${remainingAttempts} lần thử. Hãy thử lại!`,
                duration: 2000
            });

            const micStatus = document.getElementById('mic-status');
            if (micStatus) {
                micStatus.textContent = `Còn ${remainingAttempts} lần thử - Click mic để thử lại`;
                micStatus.className = 'mic-status';
            }
        }
    },

    replayWord() {
        GameLogic.speakWord(this.currentWord, this.config.recognitionLang);

        Notification.show({
            type: 'info',
            title: '🔊 Phát lại',
            message: 'Đang phát âm từ...',
            duration: 1000
        });
    },

    skipQuestion() {
        const question = this.questions[this.currentIndex];

        PracticeManager.recordAnswer(false, question.word);

        Notification.show({
            type: 'info',
            title: 'Đã bỏ qua',
            message: `Đáp án: "${this.currentWord}"`,
            duration: 2000
        });

        setTimeout(() => {
            GameLogic.speakWord(this.currentWord, this.config.recognitionLang);
        }, 500);

        setTimeout(() => {
            this.nextQuestion();
        }, 2500);
    },

    nextQuestion() {
        this.currentIndex++;
        this.showQuestion();
    },

    finish() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }

        PracticeManager.complete();
    },

    cleanup() {
        if (this.recognition) {
            if (this.isListening) {
                this.recognition.stop();
            }
            this.recognition.onstart = null;
            this.recognition.onend = null;
            this.recognition.onresult = null;
            this.recognition.onerror = null;
            this.recognition = null;
        }

        this.questions = [];
        this.currentIndex = 0;
        this.currentAttempts = 0;
        this.isListening = false;
        this.currentWord = null;
    }
};

