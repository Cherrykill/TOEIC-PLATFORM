import { GameLogic } from '@game/gameLogic.js';
import { GameState } from '@game/state.js';
import { Config } from '@game/config.js';
import { Utils } from '@lib/utils.js';
import { Notification } from '@ui/Toaster.jsx';
import { EventBus, GameEvents } from '@game/eventBus.js';
import { PartSelector } from '@components/vocab/part/partSelector.js';

export const MultipleChoice = {

    config: null,
    questions: [],
    currentIndex: 0,
    selectedAnswer: null,
    hintUsed: false,

    async start(config) {
        this.config = config;
        this.currentIndex = 0;

        await this.generateQuestions();

        this.setupHintSkipListeners();

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
            GameLogic.generateMultipleChoice(word, this.config.optionsCount)
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
    },

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

        this.attachListeners();

        if (!question.reversed && GameState.state?.settings?.autoPronunciation) {
            setTimeout(() => {
                GameLogic.speakWord(question.word.en, 'en-US');
            }, 300);
        }
    },

    attachListeners() {
        const choices = document.querySelectorAll('.choice-btn');

        choices.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                this.selectAnswer(index);
            });
        });

        const speakBtn = document.getElementById('speak-word-btn');
        if (speakBtn) {
            speakBtn.addEventListener('click', () => {
                const q = this.questions[this.currentIndex];
                if (q && q.word) GameLogic.speakWord(q.word.en, 'en-US');
            });
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

        setTimeout(() => {
            this.nextQuestion();
        }, 2000);
    },

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

    finish() {
        PracticeManager.complete();
    },

    setupHintSkipListeners() {
        EventBus.on(GameEvents.HINT_USED, () => {
            if (!this.hintUsed && this.currentIndex < this.questions.length) {
                this.showHint();
            }
        });

        EventBus.on(GameEvents.QUESTION_SKIPPED, () => {
            if (this.currentIndex < this.questions.length) {
                this.skipCurrentQuestion();
            }
        });
    },

    showHint() {
        const question = this.questions[this.currentIndex];
        if (!question || this.hintUsed) return;

        this.hintUsed = true;

        const choices = document.querySelectorAll('.choice-btn');
        const wrongIndexes = [];

        choices.forEach((btn, index) => {
            if (index !== question.correctIndex) {
                wrongIndexes.push(index);
            }
        });

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

    skipCurrentQuestion() {
        const question = this.questions[this.currentIndex];
        if (!question) return;

        const choices = document.querySelectorAll('.choice-btn');
        choices.forEach(btn => btn.disabled = true);

        choices[question.correctIndex].classList.add('correct');

        PracticeManager.recordAnswer(false, question.word);

        setTimeout(() => {
            this.nextQuestion();
        }, 1500);
    },

    cleanup() {
        EventBus.off(GameEvents.HINT_USED);
        EventBus.off(GameEvents.QUESTION_SKIPPED);

        this.questions = [];
        this.currentIndex = 0;
        this.selectedAnswer = null;
        this.hintUsed = false;
    }
};

