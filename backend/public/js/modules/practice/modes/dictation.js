// ===================================
// DICTATION MODE - NGHE VÀ ĐIỀN CÂU
// Nghe phát âm cả câu ví dụ → điền 1-2 từ còn thiếu vào câu
// Luyện nghe trong ngữ cảnh thực tế - TOEIC 850
// ===================================

const Dictation = {

    config: null,
    questions: [],
    currentIndex: 0,
    answered: false,
    currentBlanks: null, // { display, blanks: [{start,end,word}], answers: string[] }
    _translateCache: {}, // cache dịch câu để tránh gọi API lặp

    /**
     * Start mode
     */
    async start(config) {
        this.config = config;
        this.currentIndex = 0;
        this.answered = false;
        this.currentBlanks = null;

        await this.generateQuestions();

        if (this.questions.length > 0) {
            this.showQuestion();
        } else {
            PracticeManager.complete();
            Notification.show({
                type: 'warning',
                title: 'Không đủ dữ liệu',
                message: 'Không tìm thấy từ vựng nào có câu ví dụ tiếng Anh.',
            });
        }
    },

    /**
     * Generate questions - chỉ lấy từ có English example chứa key word
     */
    async generateQuestions() {
        const selectedPart = GameState.state?.settings?.selectedPart || null;
        const requestCount = selectedPart ? 9999 : (this.config.questionsPerRound || 10) * 3;

        const words = await PartSelector.getWordsForPractice(requestCount);
        if (!words || words.length === 0) return;

        // Lọc từ có câu ví dụ tiếng Anh chứa key word
        const valid = words.filter(w => this._hasValidExample(w));

        // Giới hạn số câu hỏi
        const limit = this.config.questionsPerRound || 10;
        this.questions = valid.slice(0, limit).map(word => ({ word }));
    },

    /**
     * Kiểm tra từ có câu ví dụ tiếng Anh hợp lệ
     */
    _hasValidExample(word) {
        if (!word.example) return false;
        if (!/[a-zA-Z]{3,}/.test(word.example)) return false; // Không phải tiếng Anh
        // Câu phải chứa ít nhất 4 từ tiếng Anh
        const wordCount = (word.example.match(/\b[a-zA-Z]+\b/g) || []).length;
        return wordCount >= 4;
    },

    /**
     * Tạo lỗ trống trong câu ví dụ
     * - Lỗ chính: từ key (word.en) nếu tìm thấy trong câu
     * - Lỗ phụ (tùy chọn, 50%): 1 từ ngẫu nhiên khác trong câu (≥4 ký tự)
     */
    createBlanks(sentence, keyWord) {
        const blanks = [];

        // Escape special regex chars
        const escaped = keyWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const keyRegex = new RegExp(`\\b${escaped}\\b`, 'i');
        const keyMatch = keyRegex.exec(sentence);

        if (keyMatch) {
            blanks.push({
                start: keyMatch.index,
                end: keyMatch.index + keyMatch[0].length,
                word: keyMatch[0]
            });
        }

        // 50% thêm lỗ phụ nếu câu đủ dài
        const wordCount = (sentence.match(/\b[a-zA-Z]+\b/g) || []).length;
        if (wordCount >= 6 && Math.random() > 0.5) {
            const wordRegex = /\b[a-zA-Z]{4,}\b/g;
            let match;
            const candidates = [];
            while ((match = wordRegex.exec(sentence)) !== null) {
                const overlaps = blanks.some(b => match.index < b.end && match.index + match[0].length > b.start);
                if (!overlaps) {
                    candidates.push({ start: match.index, end: match.index + match[0].length, word: match[0] });
                }
            }
            if (candidates.length > 0) {
                blanks.push(candidates[Math.floor(Math.random() * candidates.length)]);
            }
        }

        // Nếu key không có trong câu, dùng 1 từ ngẫu nhiên dài nhất làm lỗ chính
        if (blanks.length === 0) {
            const wordRegex = /\b[a-zA-Z]{4,}\b/g;
            let match;
            let best = null;
            while ((match = wordRegex.exec(sentence)) !== null) {
                if (!best || match[0].length > best.word.length) {
                    best = { start: match.index, end: match.index + match[0].length, word: match[0] };
                }
            }
            if (best) blanks.push(best);
        }

        if (blanks.length === 0) return null;

        // Sắp xếp theo vị trí trong câu
        blanks.sort((a, b) => a.start - b.start);

        // Build display với lỗ trống đánh số
        let display = '';
        let lastEnd = 0;
        blanks.forEach((blank, i) => {
            display += this._escapeHtml(sentence.substring(lastEnd, blank.start));
            display += `<span class="dictation-blank-slot" data-index="${i}">[${i + 1}]</span>`;
            lastEnd = blank.end;
        });
        display += this._escapeHtml(sentence.substring(lastEnd));

        return {
            display,
            blanks,
            answers: blanks.map(b => b.word.toLowerCase())
        };
    },

    _escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    /**
     * Show current question
     */
    showQuestion() {
        if (this.currentIndex >= this.questions.length) {
            PracticeManager.complete();
            return;
        }

        this.answered = false;
        const question = this.questions[this.currentIndex];
        this.currentBlanks = this.createBlanks(question.word.example, question.word.en);

        if (!this.currentBlanks) {
            // Câu không tạo được lỗ - bỏ qua
            this.currentIndex++;
            this.showQuestion();
            return;
        }

        PracticeManager.updateProgress(this.currentIndex + 1, this.questions.length);
        this.render(question);

        setTimeout(() => this.playAudio(question.word.example), 600);
    },

    /**
     * Render question UI
     */
    render(question) {
        const container = document.getElementById('practice-content');
        if (!container) return;

        const { display, blanks } = this.currentBlanks;

        const inputsHtml = blanks.map((_, i) => `
            <div class="dictation-input-row">
                <span class="dictation-blank-label">[${i + 1}]</span>
                <input
                    type="text"
                    id="dictation-input-${i}"
                    class="dictation-input"
                    placeholder="Từ còn thiếu..."
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                    data-index="${i}"
                />
            </div>
        `).join('');

        container.innerHTML = `
            <div class="dictation-container">
                <div class="dictation-two-col">

                    <!-- CỘT TRÁI: Audio + Câu hỏi -->
                    <div class="dictation-col-question">
                        <div class="dictation-audio-area">
                            <button class="dictation-play-btn" id="dictation-play-btn" title="Nghe lại câu">
                                <i class="fas fa-volume-up"></i>
                            </button>
                            <div class="dictation-audio-info">
                                <span class="dictation-audio-title">Nhấn để nghe câu ví dụ</span>
                                <span class="dictation-audio-sub">${question.word.vn}</span>
                            </div>
                        </div>
                        <div class="dictation-sentence-display">${display}</div>
                    </div>

                    <!-- CỘT PHẢI: Input + Submit -->
                    <div class="dictation-col-answer">
                        <div class="dictation-inputs-area">
                            ${inputsHtml}
                        </div>
                        <button class="btn btn-primary dictation-submit-btn" id="dictation-submit-btn">
                            <i class="fas fa-check"></i> Kiểm tra
                        </button>
                    </div>

                </div>

                <div class="dictation-result" id="dictation-result" style="display:none;"></div>
            </div>
        `;

        this.attachListeners(question);
    },

    /**
     * Attach event listeners
     */
    attachListeners(question) {
        document.getElementById('dictation-play-btn')?.addEventListener('click', () => {
            this.playAudio(question.word.example);
        });

        document.getElementById('dictation-submit-btn')?.addEventListener('click', () => {
            this.checkAnswer(question);
        });

        // Enter trên input cuối → submit
        const lastInput = document.getElementById(`dictation-input-${this.currentBlanks.blanks.length - 1}`);
        lastInput?.addEventListener('keydown', e => {
            if (e.key === 'Enter') this.checkAnswer(question);
        });

        setTimeout(() => document.getElementById('dictation-input-0')?.focus(), 300);
    },

    /**
     * Play audio cho cả câu - luôn dùng Edge Neural TTS để đọc liền mạch tự nhiên
     */
    playAudio(text) {
        const savedVoice = localStorage.getItem('toeic_voice') || '';
        const voiceKey = savedVoice.startsWith('__gtts_') ? savedVoice : '__gtts_us__';
        GameLogic._speakGoogleTTS(text, voiceKey, null);

        const btn = document.getElementById('dictation-play-btn');
        if (btn) {
            btn.classList.add('playing');
            setTimeout(() => btn.classList.remove('playing'), 2500);
        }
    },

    /**
     * Kiểm tra đáp án - so sánh từng ô input với đáp án tương ứng
     */
    checkAnswer(question) {
        if (this.answered) return;

        const { answers } = this.currentBlanks;
        const userAnswers = answers.map((_, i) => {
            const input = document.getElementById(`dictation-input-${i}`);
            return (input?.value.trim().toLowerCase()) || '';
        });

        if (userAnswers.every(a => !a)) {
            Notification.show({ type: 'warning', title: 'Chưa nhập', message: 'Vui lòng điền ít nhất một từ.', duration: 1500 });
            return;
        }

        this.answered = true;

        // Disable tất cả inputs và nút
        answers.forEach((_, i) => {
            const input = document.getElementById(`dictation-input-${i}`);
            if (input) input.disabled = true;
        });
        document.getElementById('dictation-submit-btn').disabled = true;

        const results = answers.map((correct, i) => ({
            correct,
            userAnswer: userAnswers[i],
            isCorrect: userAnswers[i] === correct
        }));
        const allCorrect = results.every(r => r.isCorrect);

        PracticeManager.recordAnswer(allCorrect, question.word, this.config.pointsPerCorrect || 150);

        if (GameState.state.settings.soundEnabled) {
            Utils.playSound(allCorrect ? Config.sounds.correct : Config.sounds.wrong, 0.5);
        }

        // Style từng input
        results.forEach((r, i) => {
            const input = document.getElementById(`dictation-input-${i}`);
            if (input) input.classList.add(r.isCorrect ? 'dictation-correct' : 'dictation-wrong');
        });

        this.showResult(question, results, allCorrect);

        // Timer được kiểm soát bởi _translateExample (chờ dịch xong mới next)
        const readDelay = allCorrect ? 2500 : 3200;
        this._translateExample(word.example, readDelay);
    },

    /**
     * Show result feedback
     */
    showResult(question, results, allCorrect) {
        const resultEl = document.getElementById('dictation-result');
        if (!resultEl) return;

        const word = question.word;
        const answersHtml = results.map((r, i) =>
            `<span class="dictation-answer-chip ${r.isCorrect ? 'correct' : 'wrong'}">
                [${i + 1}] ${r.isCorrect
                    ? `<i class="fas fa-check"></i> <strong>${r.correct}</strong>`
                    : `<i class="fas fa-times"></i> Đúng: <strong>${r.correct}</strong>`
                }
            </span>`
        ).join('');

        resultEl.style.display = 'block';
        resultEl.className = `dictation-result ${allCorrect ? 'correct' : 'wrong'}`;
        resultEl.innerHTML = `
            <div class="dictation-result-word">
                ${allCorrect
                    ? `<i class="fas fa-check-circle"></i> Chính xác!`
                    : `<i class="fas fa-times-circle"></i> Chưa đúng`
                }
            </div>
            <div class="dictation-answers-row">${answersHtml}</div>
            <div class="dictation-result-info">
                ${word.phonetic ? `<span class="dictation-phonetic">/${word.phonetic}/</span>` : ''}
                <span class="dictation-meaning"><strong>${word.en}</strong> — ${word.vn}</span>
            </div>
            <div class="dictation-full-sentence">
                <i class="fas fa-quote-left"></i>
                <em>${this._escapeHtml(word.example)}</em>
                <button class="btn-speak-mini" onclick="GameLogic.speakWord('${word.example.replace(/'/g, "\\'")}', 'en-US')" title="Nghe lại">
                    <i class="fas fa-volume-up"></i>
                </button>
            </div>
            <div class="dictation-translation" id="dictation-translation">
                <i class="fas fa-spinner fa-spin"></i> Đang dịch...
            </div>
        `;

        if (!allCorrect) {
            setTimeout(() => GameLogic.speakWord(word.example, 'en-US'), 700);
        }

        // Dịch câu ví dụ async
        this._translateExample(word.example);
    },

    /**
     * Dịch câu example → hiện dưới kết quả, sau đó mới chuyển câu tiếp
     * readDelay: thời gian đọc sau khi translation hiện ra
     * Fallback: nếu API quá 5s thì tự next luôn
     */
    async _translateExample(sentence, readDelay = 2500) {
        const el = document.getElementById('dictation-translation');
        if (!el) { setTimeout(() => this.nextQuestion(), readDelay); return; }

        let done = false;

        // Fallback: tối đa 5s chờ API
        const fallback = setTimeout(() => {
            if (done) return;
            done = true;
            if (el.isConnected) el.remove();
            this.nextQuestion();
        }, 5000);

        const finish = () => {
            clearTimeout(fallback);
            setTimeout(() => this.nextQuestion(), readDelay);
        };

        // Lấy từ cache nếu đã dịch rồi
        if (this._translateCache[sentence]) {
            done = true;
            el.innerHTML = `<i class="fas fa-language"></i> ${this._escapeHtml(this._translateCache[sentence])}`;
            finish();
            return;
        }

        try {
            const result = await window.AIHelper.translateSentence(sentence);
            if (!el.isConnected) { clearTimeout(fallback); return; }

            done = true;
            if (result.success && result.translation) {
                this._translateCache[sentence] = result.translation;
                el.innerHTML = `<i class="fas fa-language"></i> ${this._escapeHtml(result.translation)}`;
            } else {
                el.remove();
            }
        } catch {
            done = true;
            if (el.isConnected) el.remove();
        }

        finish();
    },

    /**
     * Move to next question
     */
    nextQuestion() {
        this.currentIndex++;
        this.showQuestion();
    },

    /**
     * Cleanup
     */
    cleanup() {
        this.questions = [];
        this.currentIndex = 0;
        this.answered = false;
        this.currentBlanks = null;
    }
};

// Make global
window.Dictation = Dictation;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Dictation;
}
