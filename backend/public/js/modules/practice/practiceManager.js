// ===================================
// PRACTICE MANAGER
// ===================================

const PracticeManager = {

    // Current practice session
    currentSession: null,

    // Timer properties
    timerInterval: null,
    timeRemaining: 0,
    timeLimit: 0,

    /**
     * Start practice session
     */
    start(mode) {
        console.log('🚀 PracticeManager.start() called with mode:', mode);

        // ✅ Cleanup previous mode first to remove old event listeners
        if (this.currentSession && this.currentSession.mode) {
            this.cleanupMode(this.currentSession.mode);
        }

        // Check energy
        const energyCost = Config.energyCosts[mode];
        if (!Energy.hasEnough(energyCost)) {
            Energy.showRefillModal();
            return false;
        }

        // Use energy
        if (!Energy.use(energyCost)) {
            return false;
        }

        // ▶️ Play start sound (check if practice sound is enabled)
        const settings = GameState.state?.settings || {};
        if (settings.practiceSoundEnabled !== false) {
            Utils.playSound(Config.sounds.making, 0.5);
        }

        // Create session
        this.currentSession = {
            mode: mode,
            startTime: Date.now(),
            currentQuestionIndex: 0,
            correctAnswers: 0,
            wrongAnswers: 0,
            score: 0,
            completed: false,
            wrongWordsInSession: [] // Track từ sai để retry
        };

        // Show practice screen
        UI.showScreen('practice-screen');

        // Update header
        this.updateHeader(mode);

        // Setup hint and skip buttons
        this.setupHintSkipButtons();

        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Start mode
        this.loadMode(mode);

        EventBus.emit(GameEvents.PRACTICE_STARTED, { mode });

        return true;
    },

    /**
     * Load specific mode
     */
    async loadMode(mode) { // ✅ Make this function async
        // Get base config from Config
        const baseConfig = Config.practice[mode];

        // ========================================
        // ✅ CALCULATE DYNAMIC QUESTION COUNT AND TIME LIMIT
        // ========================================
        const settings = GameState.state?.settings || {};
        const isRandom = settings.randomQuestions !== false;

        const selectedPart = PartSelector.selectedPart;

        let actualQuestionsPerRound;
        let actualPairsCount;
        let actualTimeLimit;

        // Luôn dùng questionsPerSession từ settings (dù có chọn Part hay không)
        // Part chỉ ảnh hưởng đến pool nguồn, không override số câu
        const rawCount = settings.questionsPerSession || baseConfig.questionsPerRound || 10;
        let userQuestionCount;
        if (rawCount === 'auto') {
            // Auto: dùng toàn bộ pool (part hoặc toàn vocab, có level filter)
            const pool = selectedPart
                ? GameLogic.getWordsByPart(selectedPart)
                : (settings.levelFilter?.length > 0
                    ? GameLogic.vocabularyData.filter(w => w.level && settings.levelFilter.includes(w.level))
                    : GameLogic.vocabularyData);
            userQuestionCount = pool.length || 10;
            console.log(`🎲 Auto Mode: ${userQuestionCount} questions (full pool${selectedPart ? ' of ' + selectedPart : ''})`);
        } else {
            userQuestionCount = rawCount;
            console.log(`🎲 ${selectedPart ? 'Part' : 'Random'} Mode: ${userQuestionCount} questions`);
        }
        actualQuestionsPerRound = userQuestionCount;
        actualPairsCount = Math.min(Math.floor(userQuestionCount / 2), 20);

        // ✅ CALCULATE TIME LIMIT based on settings
        if (settings.timeLimitEnabled !== false) {
            // Time limit enabled: calculate based on number of questions * time per question
            const timePerQuestion = settings.timePerQuestion || 30; // Default 30 seconds per question
            actualTimeLimit = actualQuestionsPerRound * timePerQuestion;
            console.log(`⏱️ Time limit enabled: ${actualTimeLimit} seconds (${actualQuestionsPerRound} questions × ${timePerQuestion}s)`);
        } else {
            // Time limit disabled: set to 0 or very large number
            actualTimeLimit = 0;
            console.log(`⏱️ Time limit disabled`);
        }

        // Create dynamic config
        const config = {
            ...baseConfig,
            questionsPerRound: actualQuestionsPerRound,
            pairsCount: actualPairsCount,
            timeLimit: actualTimeLimit
        };
        // ========================================

        // ✅ START TIMER with calculated timeLimit
        this.startTimer(actualTimeLimit);

        switch (mode) {
            case 'multiple-choice':
                if (window.MultipleChoice) {
                    await window.MultipleChoice.start(config); // ✅ Await the result
                }
                break;
            case 'fill-blank':
                if (window.FillBlank) {
                    await window.FillBlank.start(config); // ✅ Await the result
                }
                break;
            case 'listening':
                if (window.Listening) {
                    await window.Listening.start(config); // ✅ Await the result
                }
                break;
            case 'matching':
                if (window.Matching) {
                    await window.Matching.start(config); // ✅ Await the result
                }
                break;
            case 'word-scramble':
                if (window.WordScramble) {
                    await window.WordScramble.start(config); // ✅ Await the result
                }
                break;
            case 'speed-quiz':
                if (window.SpeedQuiz) {
                    await window.SpeedQuiz.start(config); // ✅ Await the result
                }
                break;
            case 'flashcard':
                if (window.Flashcard) {
                    // Fix: Không truyền cardsPerRound khi luyện Part
                    const config = { ...baseConfig };
                    if (!isRandom) delete config.cardsPerRound;
                    await window.Flashcard.start(config); // ✅ Await the result
                }
                break;
            case 'synonym-check':
                if (window.SynonymCheck) {
                    await window.SynonymCheck.start(config); // ✅ Await the result
                }
                break;
            case 'word-type-check':
                if (window.WordTypeCheck) {
                    await window.WordTypeCheck.start(config); // ✅ Await the result
                }
                break;
            case 'example-fill-blank':
                if (window.ExampleFillBlank) {
                    await window.ExampleFillBlank.start(config); // ✅ Await the result
                }
                break;
            case 'review-mistakes':
                console.log('📍 Entered review-mistakes case');
                console.log('   window.ReviewMistakes exists?', !!window.ReviewMistakes);
                console.log('   config:', config);
                if (window.ReviewMistakes) {
                    console.log('   Calling ReviewMistakes.start()...');
                    await window.ReviewMistakes.start(config);
                    console.log('   ReviewMistakes.start() completed');
                } else {
                    console.error('   ❌ window.ReviewMistakes is undefined!');
                }
                break;
            case 'sentence-builder':
                if (window.SentenceBuilder) {
                    await window.SentenceBuilder.start(config);
                }
                break;
            case 'pronunciation':
                if (window.PronunciationMode) {
                    await window.PronunciationMode.start(config);
                } else {
                    console.error('   ❌ window.PronunciationMode is undefined!');
                }
                break;
            case 'context-learning':
                if (window.ContextLearning) {
                    await window.ContextLearning.start(config);
                }
                break;
            case 'dictation':
                if (window.Dictation) {
                    await window.Dictation.start(config);
                }
                break;
            case 'sentence-listening':
                if (window.SentenceListening) {
                    await window.SentenceListening.start(config);
                }
                break;
            case 'phonetic-quiz':
                if (window.PhoneticQuiz) {
                    await window.PhoneticQuiz.start(config);
                }
                break;
        }
    },

    /**
     * Update practice header
     */
    updateHeader(mode) {
        const modeNames = {
            'multiple-choice': 'Trắc nghiệm',
            'fill-blank': 'Điền từ',
            'listening': 'Nghe và chọn',
            'matching': 'Nối từ',
            'speed-quiz': 'Tốc độ',
            'flashcard': 'Thẻ từ vựng',
            'synonym-check': 'Từ đồng nghĩa',
            'word-type-check': 'Từ loại',
            'example-fill-blank': 'Điền vào câu',
            'review-mistakes': 'Ôn lại từ sai',
            'sentence-builder': 'Xếp câu',
            'pronunciation': 'Phát âm',
            'context-learning': 'Hiểu qua câu',
            'dictation': 'Chép chính tả',
            'sentence-listening': 'Nghe chuỗi từ',
            'phonetic-quiz': 'Đọc phiên âm'
        };

        const titleEl = document.getElementById('practice-mode-title');
        if (titleEl) {
            titleEl.textContent = modeNames[mode] || mode;
        }

        // Update difficulty badge
        this.updateDifficultyBadge();
    },

    /**
     * Update difficulty badge display
     */
    updateDifficultyBadge() {
        const badgeEl = document.getElementById('practice-difficulty-badge');
        if (!badgeEl) return;

        const settings = GameState.state?.settings || {};
        const difficulty = settings.difficulty || 'adaptive';
        const levelFilter = settings.levelFilter;
        const isRandom = settings.randomQuestions !== false;

        // Difficulty names mapping
        const difficultyNames = {
            'adaptive': 'Tự động',
            'easy': 'Dễ (A1-A2)',
            'medium': 'Trung bình (B1-B2)',
            'hard': 'Khó (C1-C2)'
        };

        // Build badge text
        let badgeText = difficultyNames[difficulty] || 'Tự động';

        // Add random/sequential indicator
        badgeText += isRandom ? ' • Ngẫu nhiên' : ' • Tuần tự';

        badgeEl.textContent = badgeText;
        badgeEl.className = `difficulty-badge difficulty-${difficulty}`;
    },

    /**
     * Update progress
     */
    updateProgress(current, total) {
        const questionNumberEl = document.getElementById('question-number');
        const totalQuestionsEl = document.getElementById('total-questions');

        if (questionNumberEl) questionNumberEl.textContent = current;
        if (totalQuestionsEl) totalQuestionsEl.textContent = total;
    },

    /**
     * Update score
     */
    updateScore(score, correct, wrong) {
        if (this.currentSession) {
            this.currentSession.score = score;
            this.currentSession.correctAnswers = correct;
            this.currentSession.wrongAnswers = wrong;
        }

        const scoreEl = document.getElementById('practice-score');
        const correctEl = document.getElementById('correct-count');
        const wrongEl = document.getElementById('wrong-count');

        if (scoreEl) scoreEl.textContent = score;
        if (correctEl) correctEl.textContent = correct;
        if (wrongEl) wrongEl.textContent = wrong;
    },

    // Milestone thresholds for celebration
    milestones: [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200],

    // Encouraging messages for milestones (multiple messages per milestone for variety)
    milestoneMessages: {
        5: [
            'Bước đầu vững chắc! Mỗi từ học được là một viên gạch xây nên nền tảng. 📚',
            'Năm từ đầu tiên đã xong! Hành trình ngàn dặm bắt đầu từ bước chân đầu tiên. 🚶',
            'Khởi đầu tốt đẹp! Não bộ đang bắt đầu ghi nhớ rồi đấy. 🧠'
        ],
        10: [
            'Hai con số rồi! Bạn đang tạo thói quen học tập tốt. 💪',
            'Mười từ không phải ít đâu! Kiên trì sẽ tạo nên sự khác biệt. 🌱',
            'Đã đi được 10 bước! Nhớ rằng học ít nhưng đều đặn tốt hơn học nhiều rồi bỏ. 📖'
        ],
        15: [
            'Bạn đang duy trì tốt! Sự kiên trì này sẽ mang lại kết quả. ⏳',
            '15 từ là một cột mốc đáng ghi nhận. Tiếp tục nhịp độ này! 🎯',
            'Não bộ đang dần quen với việc học từ mới. Cảm giác khó khăn ban đầu sẽ giảm dần. 🔄'
        ],
        20: [
            'Hai mươi từ! Đây là số lượng đủ để bạn thấy sự tiến bộ thực sự. 📈',
            'Bạn đã học được số từ tương đương một bài học TOEIC. Ấn tượng! 🏆',
            'Consistency is key! Bạn đang làm rất tốt việc duy trì học tập. ✨'
        ],
        25: [
            'Một phần tư trăm! Mỗi từ vựng là một công cụ mới trong hành trang của bạn. 🧰',
            'Bạn đang chứng minh rằng mình có thể kiên trì. Đó là phẩm chất quý giá. 💎',
            '25 từ đúng cho thấy bạn đang hiểu bài. Tiếp tục giữ vững! 🛡️'
        ],
        30: [
            'Ba mươi từ! Bạn đang xây dựng vốn từ vựng vững chắc. 🏗️',
            'Ở mốc này, nhiều người đã bỏ cuộc. Bạn thì không! 🔥',
            'Từ vựng của bạn đang mở rộng đáng kể. Những nỗ lực này sẽ được đền đáp. 🌟'
        ],
        40: [
            'Bốn mươi từ là thành tích đáng tự hào. Bạn đang nghiêm túc với việc học! 📚',
            'Não bộ bạn đang hoạt động hiệu quả. Tiếp tục nạp năng lượng cho nó! 🧠⚡',
            'Sự kiên nhẫn của bạn đang được chuyển hóa thành kiến thức thực sự. 🔮'
        ],
        50: [
            'NỬA TRĂM TỪ! Đây là cột mốc lớn đầu tiên. Bạn xứng đáng được ghi nhận! 🎉',
            'Fifty words! Vốn từ vựng này sẽ giúp bạn rất nhiều trong bài thi. 📝',
            '50 từ đúng nghĩa là bạn đã nắm vững một lượng kiến thức đáng kể. Tự hào đi! 🏅'
        ],
        75: [
            'Bảy mươi lăm từ! Bạn đang ở top những người học nghiêm túc nhất. 🥇',
            'Ba phần tư đường đến 100! Đích đến đã ở trước mắt. 🏁',
            'Sự cố gắng này sẽ phản ánh trong điểm TOEIC của bạn. Tin tưởng đi! 📊'
        ],
        100: [
            '🎊 MỘT TRĂM TỪ! Đây là thành tích phi thường. Bạn thực sự nghiêm túc!',
            'Century milestone! 100 từ là vốn từ vựng của cả một chủ đề TOEIC. 👑',
            'Bạn đã chứng minh rằng mình có kỷ luật và quyết tâm. Điều này quý hơn bất kỳ điểm số nào. 💯'
        ],
        150: [
            '150 từ! Đây là level mà chỉ những người thực sự kiên trì mới đạt được. 🌟',
            'Bạn đang ở nhóm 1% những người học chăm chỉ nhất. Respect! 🙌',
            'One hundred fifty! Vốn từ vựng của bạn đang trở nên rất vững chắc. 📚'
        ],
        200: [
            '🏆 HAI TRĂM TỪ! Bạn là LEGEND thực sự! Sự kiên trì này sẽ mang lại thành công!',
            'Đây là thành tích hiếm có! Bạn đã vượt qua mọi giới hạn của bản thân. 🚀',
            '200 từ đúng trong một phiên! Bạn xứng đáng nhận mọi lời khen ngợi. 👏👏👏'
        ]
    },

    /**
     * Get random message for a milestone
     */
    getMilestoneMessage(milestone) {
        const messages = this.milestoneMessages[milestone];
        if (!messages || messages.length === 0) {
            return 'Tuyệt vời! Tiếp tục cố gắng! 🎉';
        }
        return messages[Math.floor(Math.random() * messages.length)];
    },

    /**
     * Record answer
     */
    recordAnswer(isCorrect, word) {
        if (!this.currentSession) return;

        if (isCorrect) {
            this.currentSession.correctAnswers++;
            this.currentSession.score += 10; // ✅ +10 điểm mỗi câu đúng
            if (word) GameState.learnWord(word.en);
            Quest.updateProgress('correct-answers', 1);

            // ✅ Check milestone và hiển thị thông báo chúc mừng
            this.checkMilestone();

            // ✅ Nếu làm đúng trong review-mistakes mode, gọi API để cập nhật spaced repetition
            if (this.currentSession.mode === 'review-mistakes' && word) {
                if (typeof WrongWordsManager !== 'undefined') {
                    WrongWordsManager.recordCorrect(word.id).catch(err => {
                        console.error('Failed to record correct:', err);
                    });
                }
            }
        } else {
            this.currentSession.wrongAnswers++;

            // ✅ Track từ sai trong session để retry
            if (word && !this.currentSession.wrongWordsInSession.find(w => w.en === word.en)) {
                this.currentSession.wrongWordsInSession.push(word);
            }

            // ✅ Lưu từ sai vào MongoDB (trừ khi đang ở review-mistakes mode)
            if (word && this.currentSession.mode !== 'review-mistakes') {
                if (typeof WrongWordsManager !== 'undefined') {
                    WrongWordsManager.addWrongWord(word).catch(err => {
                        console.error('Failed to add wrong word:', err);
                    });
                }
            }
        }

        // ✅ FIX: Update score display UI after recording answer
        this.updateScore(
            this.currentSession.score,
            this.currentSession.correctAnswers,
            this.currentSession.wrongAnswers
        );

        EventBus.emit(GameEvents.PRACTICE_QUESTION_ANSWERED, { isCorrect, word });
    },

    /**
     * Check if user reached a milestone and show celebration
     */
    checkMilestone() {
        if (!this.currentSession) return;

        const correctCount = this.currentSession.correctAnswers;
        const wrongCount = this.currentSession.wrongAnswers;

        // Kiểm tra xem có đạt mốc nào không
        if (this.milestones.includes(correctCount)) {
            // Đã đạt mốc! Lấy message ngẫu nhiên cho mốc này
            const message = this.getMilestoneMessage(correctCount);

            // Tính tỷ lệ đúng
            const total = correctCount + wrongCount;
            const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 100;

            // Play celebration sound (if practice sound enabled)
            const settings = GameState.state?.settings || {};
            if (settings.practiceSoundEnabled !== false) {
                Utils.playSound(Config.sounds.correct, 0.7);
            }

            // Hiển thị thông báo chúc mừng
            Notification.show({
                type: 'success',
                title: `🎉 Đạt mốc ${correctCount} câu đúng!`,
                message: `✅ Đúng: ${correctCount} | ❌ Sai: ${wrongCount} | 📊 Tỷ lệ: ${accuracy}%\n${message}`,
                duration: 5000
            });

            console.log(`🎊 Milestone reached: ${correctCount} correct answers!`);
        }
    },

    /**
     * Complete session
     */
    async complete() {
        if (!this.currentSession) return;

        // ✅ Stop timer when completing
        this.stopTimer();

        this.currentSession.completed = true;
        this.currentSession.endTime = Date.now();

        const mode = this.currentSession.mode;

        // ── Pure business logic → SessionService ──
        const results = SessionService.calculateResults(this.currentSession);
        const { scoreData, xpReward, coinsReward, gemsBonus, isPerfect, totalQuestions, duration } = results;

        this.currentSession.finalScore = scoreData.totalScore;

        // Apply to state (no DOM, no save yet)
        SessionService.applyResultsToState(this.currentSession, results);

        // Record history
        SessionService.recordHistory(this.currentSession, xpReward, coinsReward, duration);

        // ── UI / side-effects → PracticeManager giữ ──
        Notification.show({
            type: 'success',
            title: '🎉 Hoàn thành xuất sắc!',
            message: `Bạn nhận được +${xpReward} XP và +${coinsReward} Coins!`,
            duration: 4000
        });

        if (gemsBonus > 0) {
            Notification.show({
                type: 'success',
                title: '💎 THƯỞNG ĐẶC BIỆT!',
                message: `Hoàn thành ${totalQuestions} câu ngẫu nhiên! Nhận ${gemsBonus} gems!`,
                duration: 5000
            });
        }

        if (isPerfect) {
            Quest.updateProgress('perfect-rounds', 1);
            Notification.show({
                type: 'success',
                title: '⭐ Hoàn hảo!',
                message: 'Bạn đã trả lời đúng tất cả câu hỏi!',
                duration: 3000
            });
        }

        // ✅ FIX: Await save to ensure gems are persisted to MongoDB
        await GameState.save();

        // Log session to server (fire-and-forget; stats already saved via GameState.save())
        Http.post('/practice/submit', {
            mode: this.currentSession.mode,
            questionsCount: totalQuestions,
            correctAnswers: this.currentSession.correctAnswers,
            wrongAnswers: this.currentSession.wrongAnswers,
            score: scoreData.totalScore,
            duration: Math.round(duration),
            xpEarned: xpReward,
            coinsEarned: coinsReward,
            skipStats: true,
        }).catch(() => {});

        // Update quests
        Quest.updateProgress('complete-games', 1);
        Quest.updateProgress('play-mode', 1, mode);
        Quest.updateProgress('earn-xp', xpReward);

        // Submit to leaderboard
        Leaderboard.submitScore(scoreData.totalScore);

        // Check achievements
        GameState.checkAchievements();

        // Show results
        this.showResults(scoreData, xpReward, coinsReward, isPerfect, gemsBonus, totalQuestions);

        EventBus.emit(GameEvents.PRACTICE_COMPLETED, this.currentSession);
    },

    /**
     * Show results
     */
    showResults(scoreData, xpReward, coinsReward, isPerfect, gemsBonus = 0, totalQuestions = 0) {
        const wrongWordsInSession = this.currentSession?.wrongWordsInSession || [];
        const performance = GameLogic.getPerformanceRating(
            this.currentSession.correctAnswers,
            this.currentSession.correctAnswers + this.currentSession.wrongAnswers
        );

        const stars = '⭐'.repeat(performance.stars);

        // Dừng tất cả âm thanh đang phát trước khi hiện kết quả
        if (typeof Utils !== 'undefined' && Utils.stopAllSounds) Utils.stopAllSounds();

        // Thời gian hoàn thành
        const durationSec = Math.round((this.currentSession.endTime - this.currentSession.startTime) / 1000) || 0;
        const mm = String(Math.floor(durationSec / 60)).padStart(2, '0');
        const ss = String(durationSec % 60).padStart(2, '0');
        const durationStr = `${mm}:${ss}`;

        // Ảnh chúc mừng theo số sao (SVG inline)
        const resultIllustration = {
            3: `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" style="width:110px;height:90px">
                  <circle cx="60" cy="45" r="38" fill="#fef08a" opacity=".25"/>
                  <text x="60" y="62" text-anchor="middle" font-size="52">🏆</text>
                  <text x="18" y="30" font-size="22">✨</text>
                  <text x="88" y="28" font-size="18">✨</text>
                  <text x="50" y="18" font-size="16">🎊</text>
                </svg>`,
            2: `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" style="width:110px;height:90px">
                  <circle cx="60" cy="45" r="38" fill="#bfdbfe" opacity=".2"/>
                  <text x="60" y="62" text-anchor="middle" font-size="52">🎉</text>
                  <text x="20" y="32" font-size="18">⭐</text>
                  <text x="85" y="30" font-size="16">⭐</text>
                </svg>`,
            1: `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg" style="width:110px;height:90px">
                  <circle cx="60" cy="45" r="38" fill="#fca5a5" opacity=".18"/>
                  <text x="60" y="62" text-anchor="middle" font-size="52">💪</text>
                  <text x="22" y="30" font-size="16">📚</text>
                  <text x="84" y="30" font-size="16">📖</text>
                </svg>`,
        }[performance.stars] || '';

        // Điểm số an toàn
        const safeScore = isNaN(scoreData.totalScore) ? 0 : scoreData.totalScore;

        // Play completion sound
        Utils.playSound('assets/sounds/complete.mp3', 1.0);

        Modal.show({
            title: '🎉 Hoàn thành!',
            closeOnBackdrop: false,
            content: `
                <div class="practice-results">
                    <div class="result-illustration">${resultIllustration}</div>

                    <div class="performance-rating">
                        <div class="stars">${stars}</div>
                        <h3>${performance.message}</h3>
                    </div>

                    <div class="score-display">
                        <div class="score-label">Điểm số</div>
                        <div class="score-value">${Utils.formatNumber(safeScore)}</div>
                    </div>

                    <div class="results-stats">
                        <div class="stat">
                            <i class="fas fa-check-circle"></i>
                            <span>Đúng: ${this.currentSession.correctAnswers}</span>
                        </div>
                        <div class="stat">
                            <i class="fas fa-times-circle"></i>
                            <span>Sai: ${this.currentSession.wrongAnswers}</span>
                        </div>
                        <div class="stat">
                            <i class="fas fa-clock"></i>
                            <span>Thời gian: ${durationStr}</span>
                        </div>
                    </div>

                    <div class="rewards">
                        <h4>Phần thưởng:</h4>
                        <div class="reward-item">
                            <i class="fas fa-star"></i> +${xpReward} XP
                        </div>
                        <div class="reward-item">
                            <i class="fas fa-coins"></i> +${coinsReward} Coins
                        </div>
                        ${gemsBonus > 0 ? `
                            <div class="reward-item gems-bonus">
                                <i class="fas fa-gem"></i> +${gemsBonus} Gems
                                <small style="display: block; color: #ffd700; margin-top: 4px;">
                                    🎉 Thưởng hoàn thành ${totalQuestions} câu ngẫu nhiên!
                                </small>
                            </div>
                        ` : ''}
                    </div>

                    ${isPerfect ? `
                        <div class="perfect-bonus">
                            <i class="fas fa-trophy"></i>
                            Hoàn hảo! Tất cả câu trả lời đều đúng!
                        </div>
                    ` : ''}
                </div>
            `,
            buttons: [
                {
                    text: 'Chơi lại',
                    className: 'btn-secondary',
                    onClick: () => {
                        Modal.close();
                        this.start(this.currentSession.mode);
                    }
                },
                ...(wrongWordsInSession.length > 0 ? [{
                    text: `Làm lại ${wrongWordsInSession.length} câu sai`,
                    className: 'btn-warning',
                    onClick: () => {
                        const mode = this.currentSession.mode;
                        PartSelector.retryWords = [...wrongWordsInSession];
                        Modal.close();
                        this.start(mode);
                    }
                }] : []),
                {
                    text: 'Về trang chủ',
                    className: 'btn-primary',
                    onClick: () => {
                        // ✅ Stop all sounds (including makingtask.mp3) when returning home
                        Utils.stopAllSounds();
                        Modal.close();
                        UI.showScreen('home-screen');
                    }
                }
            ]
        });
    },


    /**
     * Cleanup a specific practice mode
     */
    cleanupMode(mode) {
        if (!mode) return;

        console.log('🧹 Cleaning up mode:', mode);

        // Call cleanup on the appropriate mode module
        const modeMap = {
            'multiple-choice': window.MultipleChoice,
            'fill-blank': window.FillBlank,
            'listening': window.Listening,
            'matching': window.Matching,
            'speed-quiz': window.SpeedQuiz,
            'flashcard': window.Flashcard,
            'synonym-check': window.SynonymCheck,
            'word-type-check': window.WordTypeCheck,
            'example-fill-blank': window.ExampleFillBlank,
            'review-mistakes': window.ReviewMistakes,
            'sentence-builder': window.SentenceBuilder,
            'pronunciation': window.PronunciationMode,
            'context-learning': window.ContextLearning,
            'dictation': window.Dictation,
            'sentence-listening': window.SentenceListening,
            'phonetic-quiz': window.PhoneticQuiz
        };

        const modeModule = modeMap[mode];
        if (modeModule && typeof modeModule.cleanup === 'function') {
            modeModule.cleanup();
        }
    },

    /**
     * Cleanup current practice mode
     */
    cleanupCurrentMode() {
        if (!this.currentSession) return;
        this.cleanupMode(this.currentSession.mode);
    },

    /**
     * Exit practice
     */
    exit(targetScreenId = 'home-screen') { // <-- Đã thêm tham số targetScreenId
        console.log('🚪 PracticeManager.exit() called with targetScreenId:', targetScreenId);

        // Kiểm tra nếu có session đang chạy và CHƯA hoàn thành
        if (this.currentSession && !this.currentSession.completed) {
            console.log('⚠️ Session is active and not completed, showing exit confirmation modal');
            Modal.show({
                title: 'Thoát luyện tập?',
                content: '<p>Tiến trình của bạn sẽ không được lưu. Bạn có chắc chắn muốn thoát?</p>',
                buttons: [
                    {
                        text: 'Hủy',
                        className: 'btn-secondary',
                        onClick: () => {
                            console.log('❌ User cancelled exit');
                            Modal.close();
                        }
                    },
                    {
                        text: 'Thoát',
                        className: 'btn-primary',
                        onClick: () => {
                            console.log('✅ User confirmed exit, cleaning up...');

                            // Stop all sounds first
                            if (typeof Utils !== 'undefined' && Utils.stopAllSounds) {
                                Utils.stopAllSounds();
                            }

                            // ✅ Stop timer when exiting
                            this.stopTimer();

                            // ✅ CLEANUP: Stop timers and remove event listeners
                            this.cleanupCurrentMode();
                            this.cleanupKeyboardShortcuts();

                            // Clear session
                            this.currentSession = null;
                            console.log('🧹 Session cleared');

                            // Close modal
                            Modal.close();

                            // Navigate to target screen after a small delay to ensure modal is closed
                            setTimeout(() => {
                                console.log('🏠 Navigating to:', targetScreenId);
                                if (typeof UI !== 'undefined' && UI.showScreen) {
                                    UI.showScreen(targetScreenId);
                                    console.log('✅ Navigation complete');
                                } else {
                                    console.error('❌ UI.showScreen is not available!');
                                }
                            }, 100);
                        }
                    }
                ]
            });
        } else {
            console.log('ℹ️ No active session, navigating directly to:', targetScreenId);
            // Nếu không có session đang chạy, chuyển màn hình ngay
            if (typeof Utils !== 'undefined' && Utils.stopAllSounds) {
                Utils.stopAllSounds();
            }
            // ✅ Stop timer
            this.stopTimer();
            // ✅ CLEANUP: Clean up any remaining resources
            this.cleanupCurrentMode();
            this.cleanupKeyboardShortcuts();
            this.currentSession = null;
            if (typeof UI !== 'undefined' && UI.showScreen) {
                UI.showScreen(targetScreenId);
                console.log('✅ Navigation complete');
            }
        }
    },

    // ============================
    // TIMER FUNCTIONS
    // ============================

    /**
     * Start timer
     */
    startTimer(timeLimit) {
        // Stop any existing timer
        this.stopTimer();

        // If timeLimit is 0 or disabled, don't start timer
        if (!timeLimit || timeLimit === 0) {
            console.log('⏱️ Timer disabled (timeLimit = 0)');
            this.updateTimerDisplay(0, true); // Hide timer
            return;
        }

        this.timeLimit = timeLimit;
        this.timeRemaining = timeLimit;

        console.log(`⏱️ Starting timer: ${timeLimit} seconds`);

        // Show timer
        this.updateTimerDisplay(this.timeRemaining, false);

        // Start interval
        this.timerInterval = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay(this.timeRemaining, false);

            // Time's up
            if (this.timeRemaining <= 0) {
                this.stopTimer();
                this.onTimeUp();
            }
        }, 1000);
    },

    /**
     * Stop timer
     */
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    },

    /**
     * Freeze timer for 10 seconds
     */
    freezeTimer() {
        const resources = GameState.getResources();

        if (resources.timeFreezes <= 0) {
            Notification.show({
                type: 'warning',
                title: 'Không có lượt dừng thời gian',
                message: 'Hãy mua thêm trong cửa hàng!'
            });
            return;
        }

        // Use one time freeze
        GameState.state.resources.timeFreezes--;
        // ✅ FIX: Don't save during practice, will save when practice completes
        // GameState.save();
        this.updateFreezeButton();

        // Pause the timer for 10 seconds
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;

            // Show freeze effect on timer
            const timerEl = document.getElementById('practice-timer');
            if (timerEl) {
                timerEl.classList.add('timer-frozen');
            }

            Notification.show({
                type: 'info',
                title: '⏸️ Đã dừng thời gian!',
                message: 'Thời gian đông băng trong 10 giây',
                duration: 2000
            });

            // Resume timer after 10 seconds
            setTimeout(() => {
                // Remove frozen effect
                if (timerEl) {
                    timerEl.classList.remove('timer-frozen');
                }

                // Restart timer with current timeRemaining
                this.timerInterval = setInterval(() => {
                    this.timeRemaining--;
                    this.updateTimerDisplay(this.timeRemaining, false);

                    // Time's up
                    if (this.timeRemaining <= 0) {
                        this.stopTimer();
                        this.onTimeUp();
                    }
                }, 1000);

                Notification.show({
                    type: 'info',
                    title: '▶️ Thời gian tiếp tục!',
                    message: 'Đồng hồ đã chạy trở lại',
                    duration: 1500
                });
            }, 10000);
        }
    },

    /**
     * Update timer display
     */
    updateTimerDisplay(seconds, hide = false) {
        const timerEl = document.getElementById('practice-timer');
        if (!timerEl) return;

        const timerContainer = timerEl.parentElement;

        if (hide) {
            // Hide timer when disabled
            if (timerContainer) {
                timerContainer.style.display = 'none';
            }
            return;
        } else {
            // Show timer
            if (timerContainer) {
                timerContainer.style.display = 'flex';
            }
        }

        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const timeString = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        timerEl.textContent = timeString;

        // Add warning class when time is running low (< 30s)
        if (seconds < 30 && seconds > 0) {
            timerEl.classList.add('timer-warning');
        } else {
            timerEl.classList.remove('timer-warning');
        }

        // Add critical class when time is very low (< 10s)
        if (seconds < 10 && seconds > 0) {
            timerEl.classList.add('timer-critical');
        } else {
            timerEl.classList.remove('timer-critical');
        }
    },

    /**
     * Handle time up
     */
    onTimeUp() {
        console.log('⏰ Time is up!');

        Notification.show({
            type: 'warning',
            title: '⏰ Hết giờ!',
            message: 'Thời gian luyện tập đã kết thúc',
            duration: 3000
        });

        // Auto complete the session
        this.complete();
    },

    // ============================
    // HINT & SKIP FUNCTIONS
    // ============================

    /**
     * Use hint - show hint for current question
     */
    useHint() {
        const resources = GameState.getResources();
        const hintCost = 50; // Cost in coins if no hints available

        // Check if user has hints
        if (resources.hints > 0) {
            // Use hint resource
            GameState.state.resources.hints--;
            // ✅ FIX: Don't save during practice, will save when practice completes
            // GameState.save();
            this.updateHintButton();

            Notification.show({
                type: 'info',
                title: '💡 Gợi ý',
                message: 'Đã sử dụng 1 gợi ý',
                duration: 2000
            });

            // Trigger hint event for current mode
            EventBus.emit(GameEvents.HINT_USED);
            return true;
        }
        // Check if user has enough coins to buy hint
        else if (resources.coins >= hintCost) {
            Modal.show({
                title: '💡 Mua gợi ý?',
                content: `
                    <div class="hint-purchase">
                        <p>Bạn không còn gợi ý miễn phí.</p>
                        <p>Mua gợi ý với <strong>${hintCost} coins</strong>?</p>
                    </div>
                `,
                buttons: [
                    {
                        text: 'Hủy',
                        className: 'btn-secondary',
                        onClick: () => Modal.close()
                    },
                    {
                        text: 'Mua',
                        className: 'btn-primary',
                        onClick: () => {
                            if (GameState.useCoins(hintCost)) {
                                Modal.close();

                                Notification.show({
                                    type: 'success',
                                    title: '💡 Đã mua gợi ý',
                                    message: `Đã trả ${hintCost} coins`,
                                    duration: 2000
                                });

                                // Trigger hint event for current mode
                                EventBus.emit(GameEvents.HINT_USED);
                                this.updateHintButton();
                            } else {
                                Modal.close();
                                Notification.show({
                                    type: 'error',
                                    title: 'Không đủ coins',
                                    message: 'Bạn cần thêm coins để mua gợi ý',
                                    duration: 2000
                                });
                            }
                        }
                    }
                ]
            });
            return false;
        }
        else {
            // Not enough coins
            Notification.show({
                type: 'error',
                title: 'Không đủ tài nguyên',
                message: 'Bạn cần gợi ý hoặc coins để sử dụng chức năng này',
                duration: 2000
            });
            return false;
        }
    },

    /**
     * Skip current question
     */
    skipQuestion() {
        // Bỏ qua trực tiếp không cần xác nhận
        Notification.show({
            type: 'info',
            title: '⏭️ Đã bỏ qua',
            message: 'Câu hỏi được tính là sai',
            duration: 1500
        });

        // Trigger skip event for current mode
        EventBus.emit(GameEvents.QUESTION_SKIPPED);
    },

    /**
     * Update hint button display
     */
    updateHintButton() {
        const hintBtn = document.getElementById('hint-btn');
        if (!hintBtn) return;

        const resources = GameState.getResources();
        const costSpan = hintBtn.querySelector('.cost');

        if (resources.hints > 0) {
            // Show hint count
            if (costSpan) {
                costSpan.innerHTML = `${resources.hints} <i class="fas fa-lightbulb"></i>`;
            }
            hintBtn.disabled = false;
            hintBtn.classList.remove('disabled');
        } else {
            // Show coin cost
            if (costSpan) {
                costSpan.innerHTML = `50 <i class="fas fa-coins"></i>`;
            }
            // Check if has enough coins
            if (resources.coins >= 50) {
                hintBtn.disabled = false;
                hintBtn.classList.remove('disabled');
            } else {
                hintBtn.disabled = true;
                hintBtn.classList.add('disabled');
            }
        }
    },

    /**
     * Update freeze button display
     */
    updateFreezeButton() {
        const freezeBtn = document.getElementById('freeze-btn');
        if (!freezeBtn) return;

        const resources = GameState.getResources();
        const countSpan = freezeBtn.querySelector('.freeze-count');

        if (countSpan) {
            countSpan.textContent = resources.timeFreezes || 0;
        }

        // Disable if:
        // 1. No freezes available
        // 2. No timer at all (timeLimit = 0 means timer disabled)
        // 3. Timer already stopped AND no timeRemaining
        const hasNoFreezes = !resources.timeFreezes || resources.timeFreezes <= 0;
        const timerDisabled = this.timeLimit === 0;
        const timerNotActive = !this.timerInterval && this.timeRemaining <= 0;

        if (hasNoFreezes || timerDisabled || timerNotActive) {
            freezeBtn.disabled = true;
            freezeBtn.classList.add('disabled');
        } else {
            freezeBtn.disabled = false;
            freezeBtn.classList.remove('disabled');
        }
    },

    /**
     * Ctrl (alone) → replay âm thanh vừa phát, áp dụng mọi chế độ
     */
    setupKeyboardShortcuts() {
        // Dọn listener cũ nếu có
        this.cleanupKeyboardShortcuts();

        let nonModifierPressed = false;

        this._kbKeydown = (e) => {
            if (e.key === 'Control') {
                nonModifierPressed = false;
            } else if (e.ctrlKey && !e.repeat) {
                nonModifierPressed = true;
            }
        };

        this._kbKeyup = (e) => {
            if (e.key === 'Control' && !nonModifierPressed && !e.shiftKey && !e.altKey && !e.metaKey) {
                GameLogic.replayLast();
            }
        };

        document.addEventListener('keydown', this._kbKeydown);
        document.addEventListener('keyup', this._kbKeyup);
    },

    cleanupKeyboardShortcuts() {
        if (this._kbKeydown) document.removeEventListener('keydown', this._kbKeydown);
        if (this._kbKeyup) document.removeEventListener('keyup', this._kbKeyup);
        this._kbKeydown = null;
        this._kbKeyup = null;
    },

    /**
     * Setup hint and skip buttons
     */
    setupHintSkipButtons() {
        const hintBtn = document.getElementById('hint-btn');
        const skipBtn = document.getElementById('skip-btn');
        const freezeBtn = document.getElementById('freeze-btn');

        if (hintBtn) {
            hintBtn.onclick = () => this.useHint();
        }

        if (skipBtn) {
            skipBtn.onclick = () => this.skipQuestion();
        }

        if (freezeBtn) {
            freezeBtn.onclick = () => this.freezeTimer();
        }

        // Update button displays
        this.updateHintButton();
        this.updateFreezeButton();
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PracticeManager;
}