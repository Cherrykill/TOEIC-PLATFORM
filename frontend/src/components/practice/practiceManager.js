import { Config } from '@game/config.js';
import { GameState } from '@game/state.js';
import { Storage } from '@lib/storage.js';
import { Utils } from '@lib/utils.js';
import { EventBus, GameEvents } from '@game/eventBus.js';
import { GameLogic, vocabLang } from '@game/gameLogic.js';
import { Http } from '@api/http.js';
import { Energy } from '@game/energy.js';
import { Quest } from '@components/quest/quest.js';
import { WrongWordsManager } from '@components/vocab/wrongWords/wrongWordsManager.js';
import { PartSelector } from '@components/vocab/part/partSelector.js';
import { TopicSelector } from '@components/vocab/topic/topicSelector.js';
import { SessionService } from './sessionService.js';
import { Notification } from '@ui/Toaster.jsx';
import { Modal } from '@ui/Modal.jsx';
import { ReviewOverlay } from './ReviewOverlay.js';
import { Flashcard } from './modes/flashcard.js';
import { MultipleChoice } from './modes/multipleChoice.js';
import { Matching } from './modes/matching.js';
import { WordTypeCheck } from './modes/wordTypeCheck.js';
import { Listening } from './modes/listening.js';
import { PronunciationMode } from './modes/pronunciationMode.js';
import { Dictation } from './modes/dictation.js';
import { SentenceListening } from './modes/sentenceListening.js';
import { FillBlank } from './modes/fillBlank.js';
import { ExampleFillBlank } from './modes/exampleFillBlank.js';
import { SentenceBuilder } from './modes/sentenceBuilder.js';
import { PhoneticQuiz } from './modes/phoneticQuiz.js';
import { ContextLearning } from './modes/contextLearning.js';
import { SynonymCheck } from './modes/synonymCheck.js';
import { SpeedQuiz } from './modes/speedQuiz.js';
import { ReviewMistakes } from './modes/reviewMistakes.js';

export const PracticeManager = {

    currentSession: null,

    timerInterval: null,
    timeRemaining: 0,
    timeLimit: 0,

    // Tính pool từ vựng sau khi áp filter (level + part).
    // Trả về array — caller kiểm tra .length.
    _getFilteredPool() {
        const settings = GameState.state?.settings || {};
        const levelFilter = settings.levelFilter;
        const selectedPart = PartSelector.selectedPart;

        let pool = selectedPart
            ? GameLogic.vocabularyData.filter(w => w.part === selectedPart)
            : [...GameLogic.vocabularyData];

        if (levelFilter?.length > 0) {
            pool = pool.filter(w => w.level && levelFilter.includes(w.level));
        }

        return pool;
    },

    start(mode) {
        console.log('🚀 PracticeManager.start() called with mode:', mode);

        if (this.currentSession && this.currentSession.mode) {
            this.cleanupMode(this.currentSession.mode);
        }

        // Chưa chọn đề → hiện popup chọn đề trước. Sau khi chọn đề xong,
        // TopNav.handleTopicSelected sẽ mở popup Part, rồi PRACTICE_REQUESTED tự start lại.
        if (!TopicSelector.currentTopic && mode !== 'review-mistakes') {
            EventBus.emit(GameEvents.TOPIC_MODAL_REQUESTED, { pendingMode: mode });
            return false;
        }

        // Đã chọn đề nhưng chưa chọn Part → buộc chọn Part trước.
        // Bỏ qua khi: retry từ sai, review-mistakes, hoặc đang ở chế độ Ngẫu nhiên tất cả.
        if (TopicSelector.currentTopic && !PartSelector.selectedPart && !PartSelector.retryWords?.length && mode !== 'review-mistakes' && PartSelector.practiceMode !== 'random-all') {
            PartSelector.pendingMode = mode;
            PartSelector.showPartSelectionModal();
            return false;
        }

        // Kiểm tra pool TRƯỚC khi trừ energy hoặc mở practice screen.
        // review-mistakes dùng pool riêng (wrong words) nên bỏ qua.
        if (mode !== 'review-mistakes') {
            const pool = this._getFilteredPool();
            if (pool.length < 4) {
                const settings = GameState.state?.settings || {};
                const levelNames = { easy: 'Dễ (A1-A2)', medium: 'Trung bình (B1-B2)', hard: 'Khó (C1-C2)', adaptive: 'Tự động' };
                const filterDesc = [];
                if (PartSelector.selectedPart) filterDesc.push(`Part: <strong>${PartSelector.selectedPart}</strong>`);
                if (settings.levelFilter?.length > 0) filterDesc.push(`Cấp độ: <strong>${settings.levelFilter.join(', ')}</strong>`);

                Modal.show({
                    title: '⚠️ Không đủ từ vựng',
                    content: `
                        <div style="text-align:center;padding:8px 0">
                            <div style="font-size:48px;margin-bottom:12px">📭</div>
                            <p style="margin:0 0 8px;font-size:15px">
                                Bộ lọc hiện tại chỉ tìm được <strong style="color:var(--error-color,#ef4444)">${pool.length} từ</strong>.
                            </p>
                            <p style="margin:0 0 12px;font-size:13px;color:var(--text-secondary)">
                                Cần ít nhất <strong>4 từ</strong> để bắt đầu luyện tập.
                            </p>
                            ${filterDesc.length > 0 ? `<p style="margin:0;font-size:13px;color:var(--text-secondary)">
                                Điều kiện lọc: ${filterDesc.join(' · ')}
                            </p>` : ''}
                        </div>
                    `,
                    buttons: [
                        {
                            text: 'Đổi bộ lọc Part',
                            className: 'btn-secondary',
                            onClick: async () => {
                                Modal.close();
                                // Chuyển sang Ngẫu nhiên tất cả → không cần chọn Part
                                PartSelector.practiceMode = 'random-all';
                                PartSelector.selectedPart = null;
                                GameState.state.settings.selectedPart = null;
                                GameState.state.settings.randomQuestions = true;
                                await Storage.set('practiceMode', 'random-all');
                                await Storage.remove('selectedPart');
                                PartSelector.updatePartBadge();
                                await GameState.save();
                                // Khởi động lại với mode hiện tại
                                setTimeout(() => EventBus.emit(GameEvents.PRACTICE_REQUESTED, { mode }), 200);
                            }
                        },
                        {
                            text: 'Đóng',
                            className: 'btn-primary',
                            onClick: () => Modal.close()
                        }
                    ]
                });
                return false;
            }
        }

        const energyCost = Config.energyCosts[mode];
        if (!Energy.hasEnough(energyCost)) {
            Energy.showRefillModal();
            return false;
        }

        if (!Energy.use(energyCost)) {
            return false;
        }

        const settings = GameState.state?.settings || {};
        if (settings.practiceSoundEnabled !== false) {
            Utils.playSound(Config.sounds.making, 0.5);
        }

        this.currentSession = {
            mode: mode,
            startTime: Date.now(),
            currentQuestionIndex: 0,
            correctAnswers: 0,
            wrongAnswers: 0,
            score: 0,
            completed: false,
            wrongWordsInSession: [],
            answerHistory: [],
        };

        UI.showScreen('practice-screen');

        this.updateHeader(mode);

        this.setupHintSkipButtons();

        this.setupKeyboardShortcuts();

        this.loadMode(mode);

        EventBus.emit(GameEvents.PRACTICE_STARTED, { mode });

        return true;
    },

    async loadMode(mode) {
        const baseConfig = Config.practice[mode];

        const settings = GameState.state?.settings || {};
        const isRandom = settings.randomQuestions !== false;

        const selectedPart = PartSelector.selectedPart;

        let actualQuestionsPerRound;
        let actualPairsCount;
        let actualTimeLimit;

        const rawCount = settings.questionsPerSession || baseConfig.questionsPerRound || 10;
        let userQuestionCount;
        if (rawCount === 'auto') {
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

        if (settings.timeLimitEnabled !== false) {
            const timePerQuestion = settings.timePerQuestion || 30;
            actualTimeLimit = actualQuestionsPerRound * timePerQuestion;
            console.log(`⏱️ Time limit enabled: ${actualTimeLimit} seconds (${actualQuestionsPerRound} questions × ${timePerQuestion}s)`);
        } else {
            actualTimeLimit = 0;
            console.log(`⏱️ Time limit disabled`);
        }

        const config = {
            ...baseConfig,
            questionsPerRound: actualQuestionsPerRound,
            pairsCount: actualPairsCount,
            timeLimit: actualTimeLimit
        };

        this.startTimer(actualTimeLimit);

        switch (mode) {
            case 'multiple-choice':
                await MultipleChoice.start(config);
                break;
            case 'fill-blank':
                await FillBlank.start(config);
                break;
            case 'listening':
                await Listening.start(config);
                break;
            case 'matching':
                await Matching.start(config);
                break;
            case 'word-scramble':
                if (window.WordScramble) {
                    await window.WordScramble.start(config);
                }
                break;
            case 'speed-quiz':
                await SpeedQuiz.start(config);
                break;
            case 'flashcard': {
                const flashConfig = { ...baseConfig };
                if (!isRandom) delete flashConfig.cardsPerRound;
                await Flashcard.start(flashConfig);
                break;
            }
            case 'synonym-check':
                await SynonymCheck.start(config);
                break;
            case 'word-type-check':
                await WordTypeCheck.start(config);
                break;
            case 'example-fill-blank':
                await ExampleFillBlank.start(config);
                break;
            case 'review-mistakes':
                await ReviewMistakes.start(config);
                break;
            case 'sentence-builder':
                await SentenceBuilder.start(config);
                break;
            case 'pronunciation':
                if (vocabLang() === 'zh') {
                    await new Promise((resolve) => {
                        Modal.show({
                            title: '⚠️ Tính năng đang phát triển',
                            content: 'Chế độ phát âm tiếng Trung hiện đang trong giai đoạn phát triển, chưa hoàn thiện. Trong quá trình sử dụng có thể không được như ý. Bạn có chắc muốn tiếp tục?',
                            buttons: [
                                {
                                    text: 'Quay lại',
                                    className: 'btn-secondary',
                                    onClick: () => { Modal.close(); resolve(false); }
                                },
                                {
                                    text: 'Tiếp tục',
                                    className: 'btn-primary',
                                    onClick: () => { Modal.close(); resolve(true); }
                                },
                            ],
                            onClose: () => resolve(false),
                        });
                    }).then(async (confirmed) => {
                        if (confirmed) await PronunciationMode.start(config);
                        else PracticeManager.exitPractice?.();
                    });
                } else {
                    await PronunciationMode.start(config);
                }
                break;
            case 'context-learning':
                await ContextLearning.start(config);
                break;
            case 'dictation':
                await Dictation.start(config);
                break;
            case 'sentence-listening':
                await SentenceListening.start(config);
                break;
            case 'phonetic-quiz':
                await PhoneticQuiz.start(config);
                break;
        }
    },

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

        this.updateDifficultyBadge();
    },

    updateDifficultyBadge() {
        const badgeEl = document.getElementById('practice-difficulty-badge');
        if (!badgeEl) return;

        const settings = GameState.state?.settings || {};
        const difficulty = settings.difficulty || 'adaptive';
        const isRandom = settings.randomQuestions !== false;

        const difficultyNames = {
            'adaptive': 'Tự động',
            'easy': 'Dễ (A1-A2)',
            'medium': 'Trung bình (B1-B2)',
            'hard': 'Khó (C1-C2)'
        };

        let badgeText = difficultyNames[difficulty] || 'Tự động';
        badgeText += isRandom ? ' • Ngẫu nhiên' : ' • Tuần tự';

        badgeEl.textContent = badgeText;
        badgeEl.className = `difficulty-badge difficulty-${difficulty}`;
    },

    updateProgress(current, total) {
        const questionNumberEl = document.getElementById('question-number');
        const totalQuestionsEl = document.getElementById('total-questions');

        if (questionNumberEl) questionNumberEl.textContent = current;
        if (totalQuestionsEl) totalQuestionsEl.textContent = total;
    },

    setCurrentWord(word) {
        if (this.currentSession) this.currentSession.currentWord = word || null;
        EventBus.emit(GameEvents.QUESTION_RENDERED, { word: word || null });
    },

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

    milestones: [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200],

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

    getMilestoneMessage(milestone) {
        const messages = this.milestoneMessages[milestone];
        if (!messages || messages.length === 0) {
            return 'Tuyệt vời! Tiếp tục cố gắng! 🎉';
        }
        return messages[Math.floor(Math.random() * messages.length)];
    },

    recordAnswer(isCorrect, word, meta = {}) {
        if (!this.currentSession) return;

        this.currentSession.answerHistory.push({
            word,
            isCorrect,
            userAnswer: meta.userAnswer ?? null,
            correctAnswer: meta.correctAnswer ?? (word?.vn || word?.vi || null),
            questionText: meta.questionText ?? null,
            options: meta.options ?? null,
        });

        if (isCorrect) {
            this.currentSession.correctAnswers++;
            this.currentSession.score += 10;
            if (word) GameState.learnWord(word.en);
            Quest.updateProgress('correct-answers', 1);

            this.checkMilestone();

            // Luyện trên pool "Từ vựng sai" (mọi chế độ) cũng tính tiến độ
            // ôn như chế độ review-mistakes → trả lời đúng đủ thì từ bị xoá.
            const isWrongPool = TopicSelector.getCurrentTopic?.()?.isWrong === true;
            if ((this.currentSession.mode === 'review-mistakes' || isWrongPool) && word) {
                WrongWordsManager.recordCorrect(word.id).catch(err => {
                    console.error('Failed to record correct:', err);
                });
            }
        } else {
            this.currentSession.wrongAnswers++;

            if (word && !this.currentSession.wrongWordsInSession.find(w => w.en === word.en)) {
                this.currentSession.wrongWordsInSession.push(word);
            }

            if (word && this.currentSession.mode !== 'review-mistakes') {
                WrongWordsManager.addWrongWord(word).catch(err => {
                    console.error('Failed to add wrong word:', err);
                });
            }
        }

        this.updateScore(
            this.currentSession.score,
            this.currentSession.correctAnswers,
            this.currentSession.wrongAnswers
        );

        EventBus.emit(GameEvents.PRACTICE_QUESTION_ANSWERED, { isCorrect, word });
    },

    checkMilestone() {
        if (!this.currentSession) return;

        const correctCount = this.currentSession.correctAnswers;
        const wrongCount = this.currentSession.wrongAnswers;

        if (this.milestones.includes(correctCount)) {
            const message = this.getMilestoneMessage(correctCount);

            const total = correctCount + wrongCount;
            const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 100;

            const settings = GameState.state?.settings || {};
            if (settings.practiceSoundEnabled !== false) {
                Utils.playSound(Config.sounds.correct, 0.7);
            }

            Notification.show({
                type: 'success',
                title: `🎉 Đạt mốc ${correctCount} câu đúng!`,
                message: `✅ Đúng: ${correctCount} | ❌ Sai: ${wrongCount} | 📊 Tỷ lệ: ${accuracy}%\n${message}`,
                duration: 5000
            });

            console.log(`🎊 Milestone reached: ${correctCount} correct answers!`);
        }
    },

    // Chạy mọi side-effect cuối session (stats, history, quest, leaderboard,
    // achievements, sound complete qua showResults sau đó). KHÔNG hiện popup
    // — caller tự quyết hiện popup unified (showResults) hay popup riêng
    // (vd Flashcard có Học tiếp / xem từ chưa thuộc). Trả về results hoặc
    // null nếu không có session.
    async finalizeSession() {
        if (!this.currentSession) return null;
        if (this.currentSession.completed) return null;

        this.stopTimer();

        this.currentSession.completed = true;
        this.currentSession.endTime = Date.now();

        const mode = this.currentSession.mode;

        const results = SessionService.calculateResults(this.currentSession);
        const { scoreData, xpReward, coinsReward, gemsBonus, isPerfect, totalQuestions, duration } = results;

        this.currentSession.finalScore = scoreData.totalScore;

        // Side-effects are best-effort: a failure in stats/quests/leaderboard
        // must NOT prevent the result popup from showing (that was why every
        // non-flashcard mode appeared "tịt"). Each block guards itself.
        try {
        SessionService.applyResultsToState(this.currentSession, results);

        SessionService.recordHistory(this.currentSession, xpReward, coinsReward, duration);

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

        // Cập nhật streak local ngay (không phụ thuộc vào backend response)
        await GameState.updateStreak();
        await GameState.save();

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
        }).then(res => {
            // Server vừa chốt streak (có shield mới được áp dụng). Đồng bộ
            // số streak + shields về state cục bộ để header cập nhật ngay,
            // khỏi phải F5. Http wrap body dưới res.data.
            const u = res?.data?.user || res?.user;
            if (!u) return;
            if (u.streak) {
                GameState.state.streak.current = u.streak.current;
                GameState.state.streak.longest = u.streak.longest;
                GameState.state.streak.lastPlayDate = u.streak.lastPlayDate;
                GameState.state.streak.shieldsUsed = u.streak.shieldsUsed;
                EventBus.emit(GameEvents.STREAK_UPDATED, GameState.state.streak);
            }
            if (u.resources && typeof u.resources.shields === 'number') {
                GameState.state.resources.shields = u.resources.shields;
            }
        }).catch(() => {});

        Quest.updateProgress('complete-games', 1);
        Quest.updateProgress('play-mode', 1, mode);
        Quest.updateProgress('earn-xp', xpReward);

        GameState.checkAchievements();
        } catch (err) {
            console.warn('[PracticeManager] post-complete side-effect failed (popup still shown):', err);
        }

        return results;
    },

    async complete() {
        const results = await this.finalizeSession();
        if (!results) return;
        const { scoreData, xpReward, coinsReward, gemsBonus, isPerfect, totalQuestions } = results;

        this.showResults(scoreData, xpReward, coinsReward, isPerfect, gemsBonus, totalQuestions);

        EventBus.emit(GameEvents.PRACTICE_COMPLETED, this.currentSession);
    },

    showResults(scoreData, xpReward, coinsReward, isPerfect, gemsBonus = 0) {
        const wrongWordsInSession = this.currentSession?.wrongWordsInSession || [];
        const answerHistory = this.currentSession?.answerHistory || [];
        const performance = GameLogic.getPerformanceRating(
            this.currentSession.correctAnswers,
            this.currentSession.correctAnswers + this.currentSession.wrongAnswers
        );

        const stars = '⭐'.repeat(performance.stars);

        if (typeof Utils !== 'undefined' && Utils.stopAllSounds) Utils.stopAllSounds();

        const durationSec = Math.round((this.currentSession.endTime - this.currentSession.startTime) / 1000) || 0;
        const mm = String(Math.floor(durationSec / 60)).padStart(2, '0');
        const ss = String(durationSec % 60).padStart(2, '0');
        const durationStr = `${mm}:${ss}`;

        const correct = this.currentSession.correctAnswers || 0;
        const wrong = this.currentSession.wrongAnswers || 0;
        const accuracy = (correct + wrong) > 0
            ? Math.round((correct / (correct + wrong)) * 100)
            : 0;

        Utils.playSound('assets/sounds/complete.mp3', 1.0);

        Modal.show({
            title: '🎉 Hoàn thành!',
            closeOnBackdrop: false,
            content: `
                <div class="flashcard-summary">
                    <div class="summary-stats">
                        <div class="summary-stat known">
                            <i class="fas fa-check-circle"></i>
                            <h3>${correct}</h3>
                            <p>Đúng</p>
                        </div>
                        <div class="summary-stat unknown">
                            <i class="fas fa-times-circle"></i>
                            <h3>${wrong}</h3>
                            <p>Sai</p>
                        </div>
                    </div>

                    <div class="summary-accuracy">
                        <div class="accuracy-circle">
                            <span class="accuracy-value">${accuracy}%</span>
                            <span class="accuracy-label">Chính xác</span>
                        </div>
                    </div>

                    <div class="summary-rewards" style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin:4px 0 2px">
                        <span class="reward-item"><i class="fas fa-star"></i> +${xpReward} XP</span>
                        <span class="reward-item"><i class="fas fa-coins"></i> +${coinsReward}</span>
                        ${gemsBonus > 0 ? `<span class="reward-item"><i class="fas fa-gem"></i> +${gemsBonus}</span>` : ''}
                        <span class="reward-item"><i class="fas fa-clock"></i> ${durationStr}</span>
                    </div>

                    ${isPerfect ? `
                        <div class="perfect-message">
                            <i class="fas fa-trophy"></i>
                            <p>${stars} Hoàn hảo! Tất cả câu trả lời đều đúng!</p>
                        </div>
                    ` : `
                        <div class="review-suggestion">
                            <i class="fas fa-info-circle"></i>
                            <p>${stars} ${performance.message}</p>
                        </div>
                    `}
                </div>
            `,
            buttons: [
                {
                    text: 'Chơi lại',
                    className: 'btn-secondary',
                    onClick: () => {
                        const mode = this.currentSession.mode;
                        this.cleanupCurrentMode();
                        this.cleanupKeyboardShortcuts();
                        this.currentSession = null;
                        Modal.close();
                        this.start(mode);
                    }
                },
                ...(wrongWordsInSession.length > 0 ? [{
                    text: `Làm lại ${wrongWordsInSession.length} câu sai`,
                    className: 'btn-warning',
                    onClick: () => {
                        const mode = this.currentSession.mode;
                        PartSelector.retryWords = [...wrongWordsInSession];
                        this.cleanupCurrentMode();
                        this.cleanupKeyboardShortcuts();
                        this.currentSession = null;
                        Modal.close();
                        this.start(mode);
                    }
                }] : []),
                ...(answerHistory.length > 0 ? [{
                    text: 'Xem lại câu sai',
                    className: 'btn-info',
                    closeOnClick: false,
                    onClick: () => ReviewOverlay.show(answerHistory),
                }] : []),
                {
                    text: 'Về trang chủ',
                    className: 'btn-primary',
                    onClick: () => {
                        Utils.stopAllSounds();
                        this.cleanupCurrentMode();
                        this.cleanupKeyboardShortcuts();
                        this.currentSession = null;
                        Modal.close();
                        UI.showScreen('home-screen');
                    }
                }
            ]
        });
    },

    cleanupMode(mode) {
        if (!mode) return;

        console.log('🧹 Cleaning up mode:', mode);

        const modeMap = {
            'multiple-choice': MultipleChoice,
            'fill-blank': FillBlank,
            'listening': Listening,
            'matching': Matching,
            'speed-quiz': SpeedQuiz,
            'flashcard': Flashcard,
            'synonym-check': SynonymCheck,
            'word-type-check': WordTypeCheck,
            'example-fill-blank': ExampleFillBlank,
            'review-mistakes': ReviewMistakes,
            'sentence-builder': SentenceBuilder,
            'pronunciation': PronunciationMode,
            'context-learning': ContextLearning,
            'dictation': Dictation,
            'sentence-listening': SentenceListening,
            'phonetic-quiz': PhoneticQuiz
        };

        const modeModule = modeMap[mode];
        if (modeModule && typeof modeModule.cleanup === 'function') {
            modeModule.cleanup();
        }
    },

    cleanupCurrentMode() {
        if (!this.currentSession) return;
        this.cleanupMode(this.currentSession.mode);
    },

    exit(targetScreenId = 'home-screen') {
        console.log('🚪 PracticeManager.exit() called with targetScreenId:', targetScreenId);

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

                            if (typeof Utils !== 'undefined' && Utils.stopAllSounds) {
                                Utils.stopAllSounds();
                            }

                            this.stopTimer();

                            this.cleanupCurrentMode();
                            this.cleanupKeyboardShortcuts();

                            this.currentSession = null;
                            console.log('🧹 Session cleared');

                            Modal.close();

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
            if (typeof Utils !== 'undefined' && Utils.stopAllSounds) {
                Utils.stopAllSounds();
            }
            this.stopTimer();
            this.cleanupCurrentMode();
            this.cleanupKeyboardShortcuts();
            this.currentSession = null;
            if (typeof UI !== 'undefined' && UI.showScreen) {
                UI.showScreen(targetScreenId);
                console.log('✅ Navigation complete');
            }
        }
    },

    startTimer(timeLimit) {
        this.stopTimer();

        if (!timeLimit || timeLimit === 0) {
            console.log('⏱️ Timer disabled (timeLimit = 0)');
            this.updateTimerDisplay(0, true);
            return;
        }

        this.timeLimit = timeLimit;
        this.timeRemaining = timeLimit;

        console.log(`⏱️ Starting timer: ${timeLimit} seconds`);

        this.updateTimerDisplay(this.timeRemaining, false);

        this.timerInterval = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay(this.timeRemaining, false);

            if (this.timeRemaining <= 0) {
                this.stopTimer();
                this.onTimeUp();
            }
        }, 1000);
    },

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    },

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

        GameState.state.resources.timeFreezes--;
        this.updateFreezeButton();

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;

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

            setTimeout(() => {
                if (timerEl) {
                    timerEl.classList.remove('timer-frozen');
                }

                this.timerInterval = setInterval(() => {
                    this.timeRemaining--;
                    this.updateTimerDisplay(this.timeRemaining, false);

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

    updateTimerDisplay(seconds, hide = false) {
        window._reactSetTimerVisible?.(!hide);
        if (hide) return;

        const timerEl = document.getElementById('practice-timer');

        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const timeString = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        timerEl.textContent = timeString;

        if (seconds < 30 && seconds > 0) {
            timerEl.classList.add('timer-warning');
        } else {
            timerEl.classList.remove('timer-warning');
        }

        if (seconds < 10 && seconds > 0) {
            timerEl.classList.add('timer-critical');
        } else {
            timerEl.classList.remove('timer-critical');
        }
    },

    onTimeUp() {
        console.log('⏰ Time is up!');

        Notification.show({
            type: 'warning',
            title: '⏰ Hết giờ!',
            message: 'Thời gian luyện tập đã kết thúc',
            duration: 3000
        });

        this.cleanupCurrentMode();
        this.complete();
    },

    useHint() {
        const resources = GameState.getResources();
        const hintCost = 50;

        if (resources.hints > 0) {
            GameState.state.resources.hints--;
            this.updateHintButton();

            Notification.show({
                type: 'info',
                title: '💡 Gợi ý',
                message: 'Đã sử dụng 1 gợi ý',
                duration: 2000
            });

            EventBus.emit(GameEvents.HINT_USED);
            return true;
        }
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
            Notification.show({
                type: 'error',
                title: 'Không đủ tài nguyên',
                message: 'Bạn cần gợi ý hoặc coins để sử dụng chức năng này',
                duration: 2000
            });
            return false;
        }
    },

    skipQuestion() {
        Notification.show({
            type: 'info',
            title: '⏭️ Đã bỏ qua',
            message: 'Câu hỏi được tính là sai',
            duration: 1500
        });

        EventBus.emit(GameEvents.QUESTION_SKIPPED);
    },

    updateHintButton() {
        const hintBtn = document.getElementById('hint-btn');
        if (!hintBtn) return;

        const resources = GameState.getResources();
        const costSpan = hintBtn.querySelector('.cost');

        if (resources.hints > 0) {
            if (costSpan) {
                costSpan.innerHTML = `${resources.hints} <i class="fas fa-lightbulb"></i>`;
            }
            hintBtn.disabled = false;
            hintBtn.classList.remove('disabled');
        } else {
            if (costSpan) {
                costSpan.innerHTML = `50 <i class="fas fa-coins"></i>`;
            }
            if (resources.coins >= 50) {
                hintBtn.disabled = false;
                hintBtn.classList.remove('disabled');
            } else {
                hintBtn.disabled = true;
                hintBtn.classList.add('disabled');
            }
        }
    },

    updateFreezeButton() {
        const freezeBtn = document.getElementById('freeze-btn');
        if (!freezeBtn) return;

        const resources = GameState.getResources();
        const countSpan = freezeBtn.querySelector('.freeze-count');

        if (countSpan) {
            countSpan.textContent = resources.timeFreezes || 0;
        }

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

    setupKeyboardShortcuts() {
        this.cleanupKeyboardShortcuts();

        // Ghi nhận thời điểm Ctrl được nhấn xuống — chỉ phát âm khi:
        // 1. Ctrl keydown không kèm phím khác (chord)
        // 2. Ctrl keyup xảy ra trong vòng 600ms sau keydown
        let ctrlDownAt = 0;
        let ctrlChord  = false;

        this._kbKeydown = (e) => {
            if (e.key === 'Control' && !e.repeat) {
                ctrlDownAt = Date.now();
                ctrlChord  = false;
            } else if (e.ctrlKey) {
                // Phím khác được nhấn cùng Ctrl → đây là chord (Ctrl+C, Ctrl+V…)
                ctrlChord = true;
            }
        };

        this._kbKeyup = (e) => {
            if (e.key === 'Control') {
                const held = Date.now() - ctrlDownAt;
                if (!ctrlChord && held < 600) {
                    // Nếu pronunciation mode đang ghi âm → abort trước khi replay
                    // để onend không tính là lần thử thất bại
                    if (PronunciationMode.isListening && PronunciationMode.recognition) {
                        PronunciationMode._resultHandled = true;
                        try { PronunciationMode.recognition.abort(); } catch (_) {}
                    }
                    GameLogic.replayLast();
                }
                ctrlDownAt = 0;
                ctrlChord  = false;
            }
        };

        document.addEventListener('keydown', this._kbKeydown);
        document.addEventListener('keyup',   this._kbKeyup);
    },

    cleanupKeyboardShortcuts() {
        if (this._kbKeydown) document.removeEventListener('keydown', this._kbKeydown);
        if (this._kbKeyup) document.removeEventListener('keyup', this._kbKeyup);
        this._kbKeydown = null;
        this._kbKeyup = null;
    },

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

        this.updateHintButton();
        this.updateFreezeButton();
    }
};

