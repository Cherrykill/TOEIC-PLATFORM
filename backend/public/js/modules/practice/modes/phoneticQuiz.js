// ===================================
// ĐỌC PHIÊN ÂM - IPA → TỪ TIẾNG ANH
// Nhìn ký hiệu phiên âm IPA → chọn từ tiếng Anh tương ứng
// Luyện kỹ năng đọc & hiểu phiên âm quốc tế - TOEIC 850+
// ===================================

const PhoneticQuiz = {

    config: null,
    questions: [],
    currentIndex: 0,
    hintUsed: false,
    audioUsed: 0,

    /**
     * Start mode
     */
    async start(config) {
        this.config = config;
        this.currentIndex = 0;
        this.hintUsed = false;
        this.audioUsed = 0;

        await this.generateQuestions();

        this.setupHintSkipListeners();

        if (this.questions.length > 0) {
            this.showQuestion();
        } else {
            PracticeManager.complete();
            Notification.show({
                type: 'warning',
                title: 'Không đủ dữ liệu',
                message: 'Không tìm thấy đủ từ có phiên âm IPA để luyện tập.',
            });
        }
    },

    /**
     * Generate questions: hiện IPA → chọn từ tiếng Anh đúng
     */
    async generateQuestions() {
        const selectedPart = GameState.state?.settings?.selectedPart || null;
        const requestCount = selectedPart ? 9999 : (this.config.questionsPerRound || 10) * 4;

        const allWords = await PartSelector.getWordsForPractice(requestCount);
        if (!allWords || allWords.length === 0) return;

        const withPhonetic = allWords.filter(w => w.phonetic && w.phonetic.trim().length > 0);

        if (withPhonetic.length < 4) {
            this._buildFallbackQuestions(allWords);
            return;
        }

        const limit = selectedPart
            ? withPhonetic.length
            : Math.min(this.config.questionsPerRound || 10, withPhonetic.length);
        const selected = withPhonetic.slice(0, limit);

        this.questions = selected.map(word => {
            // IPA shown → options are English WORDS (not IPA strings)
            const distractorPool = withPhonetic.filter(w => w.en !== word.en);
            const distractors = distractorPool
                .sort(() => Math.random() - 0.5)
                .slice(0, 3);

            const options = [word, ...distractors].sort(() => Math.random() - 0.5);
            const correctIndex = options.findIndex(o => o.en === word.en);

            return { word, options, correctIndex, mode: 'ipa-to-word' };
        });
    },

    /**
     * Fallback khi không đủ phonetic: nghe từ → chọn nghĩa tiếng Việt
     */
    _buildFallbackQuestions(allWords) {
        const limit = Math.min(this.config.questionsPerRound || 10, allWords.length);
        const selected = allWords.slice(0, limit);

        this.questions = selected.map(word => {
            const distractors = allWords
                .filter(w => w.en !== word.en)
                .sort(() => Math.random() - 0.5)
                .slice(0, 3);

            const options = [word, ...distractors].sort(() => Math.random() - 0.5);
            const correctIndex = options.findIndex(o => o.en === word.en);

            return { word, options, correctIndex, mode: 'meaning' };
        });
    },

    /**
     * Show current question
     */
    showQuestion() {
        if (this.currentIndex >= this.questions.length) {
            PracticeManager.complete();
            return;
        }

        this.hintUsed = false;
        this.audioUsed = 0;
        const question = this.questions[this.currentIndex];
        PracticeManager.updateProgress(this.currentIndex + 1, this.questions.length);
        this.render(question);

        // Fallback mode: auto-play the word audio
        if (question.mode === 'meaning') {
            setTimeout(() => this.playAudio(question.word.en), 600);
        }
    },

    /**
     * Render question UI
     */
    render(question) {
        const container = document.getElementById('practice-content');
        if (!container) return;

        const isIpaMode = question.mode === 'ipa-to-word';

        container.innerHTML = `
            <div class="phonetic-quiz-container">
                <div class="pq-ipa-display">
                    ${isIpaMode
                        ? `<div class="pq-ipa-big">/${question.word.phonetic}/</div>
                           <div class="pq-ipa-side">
                               <div class="pq-ipa-label"><i class="fas fa-language"></i> Phiên âm IPA</div>
                               <div class="pq-ipa-hint-area">
                                   <button class="pq-play-btn" id="pq-play-btn" title="Nghe gợi ý (${2} lượt)">
                                       <i class="fas fa-volume-up"></i>
                                   </button>
                                   <span class="pq-audio-left" id="pq-audio-left">×2 gợi ý</span>
                               </div>
                           </div>`
                        : `<div class="pq-word">${question.word.en}</div>
                           <button class="pq-play-btn" id="pq-play-btn" title="Nghe lại">
                               <i class="fas fa-volume-up"></i>
                           </button>`
                    }
                </div>

                <div class="pq-instruction">
                    ${isIpaMode
                        ? '<i class="fas fa-search"></i> Từ tiếng Anh nào có phiên âm trên?'
                        : '<i class="fas fa-headphones"></i> Nghe từ và chọn nghĩa đúng:'
                    }
                </div>

                <div class="choices-container pq-options" id="pq-choices">
                    ${question.options.map((opt, i) => `
                        <button class="choice-btn pq-word-choice-btn" data-index="${i}">
                            <span class="pq-choice-word">${opt.en}</span>
                            ${opt.vn ? `<span class="pq-choice-vn">${opt.vn}</span>` : ''}
                        </button>
                    `).join('')}
                </div>

                <div class="pq-result" id="pq-result" style="display:none;"></div>
            </div>
        `;

        this.attachListeners(question);
    },

    /**
     * Attach event listeners
     */
    attachListeners(question) {
        const playBtn = document.getElementById('pq-play-btn');
        playBtn?.addEventListener('click', () => {
            if (question.mode === 'ipa-to-word') {
                if (this.audioUsed >= 2) {
                    Notification.show({ type: 'warning', title: 'Hết lượt nghe', message: 'Bạn đã dùng hết 2 lượt nghe gợi ý.', duration: 1500 });
                    return;
                }
                this.audioUsed++;
                const leftEl = document.getElementById('pq-audio-left');
                if (leftEl) leftEl.textContent = `×${2 - this.audioUsed} gợi ý`;
                if (this.audioUsed >= 2 && leftEl) leftEl.style.opacity = '0.4';
            }
            this.playAudio(question.word.en);
        });

        document.querySelectorAll('#pq-choices .choice-btn').forEach((btn, i) => {
            btn.addEventListener('click', () => this.selectAnswer(i, question));
        });
    },

    /**
     * Play audio
     */
    playAudio(text) {
        GameLogic.speakWord(text, 'en-US');
        const btn = document.getElementById('pq-play-btn');
        if (btn) {
            btn.classList.add('playing');
            setTimeout(() => btn.classList.remove('playing'), 1200);
        }
    },

    /**
     * Handle answer selection
     */
    selectAnswer(index, question) {
        const buttons = document.querySelectorAll('#pq-choices .choice-btn');
        buttons.forEach(b => b.disabled = true);

        const isCorrect = index === question.correctIndex;

        buttons[index].classList.add(isCorrect ? 'correct' : 'wrong');
        if (!isCorrect) buttons[question.correctIndex].classList.add('correct');

        PracticeManager.recordAnswer(isCorrect, question.word, this.config.pointsPerCorrect || 140);

        if (GameState.state.settings.soundEnabled) {
            Utils.playSound(isCorrect ? Config.sounds.correct : Config.sounds.wrong, 0.5);
        }

        // Always play correct pronunciation after answer
        setTimeout(() => this.playAudio(question.word.en), 400);

        this.showResult(question, isCorrect);

        const delay = question.word.example ? 2000 : 1500;
        setTimeout(() => this.nextQuestion(), delay);
    },

    /**
     * Show result
     */
    showResult(question, isCorrect) {
        const resultEl = document.getElementById('pq-result');
        if (!resultEl) return;

        const word = question.word;
        resultEl.style.display = 'block';
        resultEl.innerHTML = `
            <div class="pq-result-header ${isCorrect ? 'correct' : 'wrong'}">
                <i class="fas fa-${isCorrect ? 'check-circle' : 'times-circle'}"></i>
                ${isCorrect ? 'Chính xác!' : `Đáp án đúng: <strong>${word.en}</strong>`}
            </div>
            <div class="pq-word-full">
                <strong style="color: var(--primary-color); font-size: 1.3rem;">${word.en}</strong>
                ${word.phonetic ? `<span class="dictation-phonetic" style="font-size: 1rem;">/${word.phonetic}/</span>` : ''}
                ${word.type ? `<span class="word-type-badge">${word.type}</span>` : ''}
            </div>
            <div class="pq-meaning">${word.vn}</div>
            ${word.example ? `
                <div class="dictation-example">
                    <i class="fas fa-quote-left" style="color: var(--primary-color); margin-right: 6px;"></i>
                    <em>${word.example}</em>
                </div>
            ` : ''}
        `;
    },

    /**
     * Next question
     */
    nextQuestion() {
        this.currentIndex++;
        this.showQuestion();
    },

    /**
     * Hint: loại 2 đáp án sai
     */
    setupHintSkipListeners() {
        this._hintHandler = () => {
            if (this.hintUsed) return;
            const question = this.questions[this.currentIndex];
            if (!question) return;

            this.hintUsed = true;
            const buttons = document.querySelectorAll('#pq-choices .choice-btn');
            let eliminated = 0;
            buttons.forEach((btn, i) => {
                if (i !== question.correctIndex && eliminated < 2 && !btn.disabled) {
                    btn.style.opacity = '0.3';
                    btn.disabled = true;
                    eliminated++;
                }
            });
            Notification.show({ type: 'info', title: 'Gợi ý', message: 'Đã loại bỏ 2 đáp án sai.', duration: 1500 });
        };

        EventBus.on(GameEvents.HINT_USED, this._hintHandler);
    },

    /**
     * Cleanup
     */
    cleanup() {
        if (this._hintHandler) {
            EventBus.off(GameEvents.HINT_USED, this._hintHandler);
            this._hintHandler = null;
        }
        this.questions = [];
        this.currentIndex = 0;
        this.hintUsed = false;
        this.audioUsed = 0;
    }
};

// Make global
window.PhoneticQuiz = PhoneticQuiz;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PhoneticQuiz;
}
