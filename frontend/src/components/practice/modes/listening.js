import { GameLogic } from '@game/gameLogic.js';
import { GameState } from '@game/state.js';
import { Config } from '@game/config.js';
import { Utils } from '@lib/utils.js';
import { Notification } from '@ui/Toaster.jsx';
import { EventBus, GameEvents } from '@game/eventBus.js';
import { PartSelector } from '@components/vocab/part/partSelector.js';

export const Listening = {

    config: null,
    questions: [],
    currentIndex: 0,
    selectedAnswer: null,
    hintUsed: false,

    async start(config) {
        this.config = config;
        this.currentIndex = 0;
        this.hintUsed = false;

        await this.generateQuestions();

        this.setupHintSkipListeners();

        if (this.questions.length > 0) {
            this.showQuestion();
        } else {
            PracticeManager.complete();
            Notification.show({
                type: 'warning',
                title: 'Không có từ vựng',
                message: 'Không tìm thấy từ vựng nào để luyện tập.',
            });
        }
    },

    async generateQuestions() {
        const selectedPart = GameState.state?.settings?.selectedPart || null;
        const requestCount = selectedPart ? 9999 : (this.config.questionsPerRound || 20);

        const words = await PartSelector.getWordsForPractice(requestCount);

        if (!Array.isArray(words)) {
            this.questions = [];
            return;
        }

        const selectedWords = selectedPart
            ? words
            : words.slice(0, this.config.questionsPerRound || 20);

        this.questions = selectedWords.map(word =>
            GameLogic.generateListening(word, this.config.optionsCount)
        );
    },

    showQuestion() {
        if (this.currentIndex >= this.questions.length) {
            this.finish();
            return;
        }

        const question = this.questions[this.currentIndex];
        this.selectedAnswer = null;
        this.hintUsed = false;

        PracticeManager.updateProgress(
            this.currentIndex + 1,
            this.questions.length
        );
        PracticeManager.setCurrentWord(question.word);

        this.render(question);

        if (!question.reversed) {
            setTimeout(() => {
                this.playAudio(question.word.en);
            }, 500);
        }
    },

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
                        ${question.word.example ? `
                            <div class="word-info-example" style="margin-top:10px">
                                <i class="fas fa-quote-left" style="opacity:.5;margin-right:6px"></i>${this.maskTarget(question.word.example, question.word.en)}
                            </div>
                        ` : ''}
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

        this.attachListeners(question);
    },

    // Hide the target word in the example so showing it upfront doesn't
    // give away the listening answer (case-insensitive, whole-word).
    maskTarget(text, word) {
        if (!text || !word) return text || '';
        const esc = String(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return String(text).replace(new RegExp(`\\b${esc}\\b`, 'gi'), '______');
    },

    attachListeners(question) {
        const playBtn = document.getElementById('play-audio-btn');
        playBtn?.addEventListener('click', () => {
            this.playAudio(question.word.en);
        });

        const choices = document.querySelectorAll('.choice-btn');
        choices.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                this.selectAnswer(index);
            });
        });
    },

    playAudio(text) {
        GameLogic.speakWord(text, 'en-US');

        const playBtn = document.getElementById('play-audio-btn');
        if (playBtn) {
            playBtn.classList.add('playing');
            setTimeout(() => {
                playBtn.classList.remove('playing');
            }, 1000);
        }
    },

    selectAnswer(index) {
        const question = this.questions[this.currentIndex];
        this.selectedAnswer = index;

        const choices = document.querySelectorAll('.choice-btn');
        choices.forEach(btn => btn.disabled = true);

        const isCorrect = index === question.correctIndex;

        if (isCorrect) {
            choices[index].classList.add('correct');
            PracticeManager.recordAnswer(true, question.word);

            if (GameState.state.settings.soundEnabled) {
                Utils.playSound(Config.sounds.correct, 0.5);
            }
        } else {
            choices[index].classList.add('wrong');
            choices[question.correctIndex].classList.add('correct');
            PracticeManager.recordAnswer(false, question.word);

            if (GameState.state.settings.soundEnabled) {
                Utils.playSound(Config.sounds.wrong, 0.5);
            }
        }

        this.showWordInfo(question.word);

        const delay = question.word.example ? 3500 : 1500;
        setTimeout(() => {
            this.nextQuestion();
        }, delay);
    },

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

        const speakBtn = document.getElementById('speak-example-btn');
        if (speakBtn) {
            speakBtn.addEventListener('click', () => {
                GameLogic.speakWord(word.example, 'en-US');
            });
        }
    },

    nextQuestion() {
        this.currentIndex++;
        this.showQuestion();
    },

    setupHintSkipListeners() {
        EventBus.on(GameEvents.HINT_USED, () => {
            if (!this.hintUsed && this.currentIndex < this.questions.length) {
                this.showHint();
            }
        });
    },

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

    cleanup() {
        EventBus.off(GameEvents.HINT_USED);
        this.questions = [];
        this.currentIndex = 0;
        this.selectedAnswer = null;
        this.hintUsed = false;
    }
};

