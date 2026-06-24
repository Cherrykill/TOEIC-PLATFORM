const ToeicQuestion = require('../models/ToeicQuestion');
const ToeicTest = require('../models/ToeicTest');
const ToeicAttempt = require('../models/ToeicAttempt');
const UserProfile = require('../models/UserProfile');
const UserStats = require('../models/UserStats');
const { getScoreInterpretation } = require('../utils/toeicScoreConverter');

// ===================================
// TEST TAKING
// ===================================

/**
 * @desc    Start a test attempt
 * @route   POST /api/toeic/attempts/start
 * @access  Private
 */
exports.startAttempt = async (req, res, next) => {
    try {
        const { testId, fillBlankMode } = req.body;

        const test = await ToeicTest.findById(testId)
            .populate('parts.questions');

        if (!test) {
            return res.status(404).json({
                success: false,
                message: 'Test not found',
            });
        }

        const [profile, stats] = await Promise.all([
            UserProfile.findOne({ userId: req.user.id }).lean(),
            UserStats.findOne({ userId: req.user.id }).lean(),
        ]);

        const access = test.canUserAccess({ level: profile?.level ?? 1, coins: stats?.coins ?? 0 });

        if (!access.allowed) {
            return res.status(403).json({
                success: false,
                message: access.reason,
            });
        }

        // Deduct coins if not free. stats lấy bằng .lean() (không có .save()) →
        // dùng cập nhật atomic (cũng hợp economy server-authoritative).
        if (!test.isFree && test.requiredCoins > 0) {
            await UserStats.updateOne({ userId: req.user.id }, { $inc: { coins: -test.requiredCoins } });
        }

        // Create attempt
        const attempt = await ToeicAttempt.create({
            userId: req.user.id,
            testId: test._id,
            testType: test.testType,
            testName: test.testName,
            totalQuestions: test.totalQuestions,
            fillBlankMode: !!fillBlankMode,
            status: 'in-progress',
        });

        // Prepare questions with global numbering
        const questions = [];
        let globalQuestionNumber = 0;

        // Define question ranges per part (TOEIC standard)
        const partRanges = {
            1: { start: 1, count: 6 },
            2: { start: 7, count: 25 },
            3: { start: 32, count: 39 },
            4: { start: 71, count: 30 },
            5: { start: 101, count: 30 },
            6: { start: 131, count: 16 },
            7: { start: 147, count: 54 },
        };

        for (const part of test.parts) {
            const partConfig = partRanges[part.partNumber];
            let partQuestionIndex = 0;

            for (const question of part.questions) {
                // Calculate global question number
                if (test.testType === 'full-test') {
                    // Full test: Use standard TOEIC numbering
                    globalQuestionNumber = partConfig.start + partQuestionIndex;
                } else {
                    // Mini test or other: Sequential numbering
                    globalQuestionNumber++;
                }

                const q = question.toObject();

                // In fill-blank mode, keep correctAnswer and keyword fields for display
                if (fillBlankMode) {
                    // Keep correctAnswer for highlighting
                    // Keep questionKeyword, answerKeyword, audioKeyword for blanking
                    q.options = q.options.map(opt => ({
                        label: opt.label,
                        text: opt.text,
                    }));
                } else {
                    // Normal mode: Don't send correct answers
                    delete q.correctAnswer;
                    // fields removed in new schema — kept for safety
                    delete q.questionKeyword;
                    delete q.answerKeyword;
                    delete q.audioKeyword;
                    q.options = q.options.map(opt => ({
                        label: opt.label,
                        text: opt.text,
                    }));
                }

                // Add global question number and section info
                q.globalQuestionNumber = globalQuestionNumber;
                q.section = part.partNumber <= 4 ? 'listening' : 'reading';

                questions.push(q);
                partQuestionIndex++;
            }
        }

        // Calculate section information
        const listeningQuestions = questions.filter(q => q.section === 'listening').length;
        const readingQuestions = questions.filter(q => q.section === 'reading').length;

        res.json({
            success: true,
            message: 'Test started successfully',
            data: {
                attemptId: attempt._id,
                test: {
                    id: test._id,
                    testName: test.testName,
                    testType: test.testType,
                    totalQuestions: test.totalQuestions,
                    totalTime: test.totalTime,
                    parts: test.parts.map(p => ({
                        partNumber: p.partNumber,
                        questionsCount: p.questionsCount,
                        timeLimit: p.timeLimit,
                    })),
                    sections: {
                        listening: {
                            questionsCount: listeningQuestions,
                            parts: [1, 2, 3, 4].filter(p => test.parts.find(part => part.partNumber === p)),
                        },
                        reading: {
                            questionsCount: readingQuestions,
                            parts: [5, 6, 7].filter(p => test.parts.find(part => part.partNumber === p)),
                        },
                    },
                },
                questions,
                startedAt: attempt.startedAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Submit answer for a question
 * @route   PUT /api/toeic/attempts/:id/answer
 * @access  Private
 */
exports.submitAnswer = async (req, res, next) => {
    try {
        const { questionId, userAnswer, timeSpent, isMarkedForReview } = req.body;

        const attempt = await ToeicAttempt.findById(req.params.id);

        if (!attempt) {
            return res.status(404).json({
                success: false,
                message: 'Attempt not found',
            });
        }

        if (attempt.userId.toString() !== req.user.id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized',
            });
        }

        if (attempt.status !== 'in-progress') {
            return res.status(400).json({
                success: false,
                message: 'This attempt is already completed',
            });
        }

        // Get correct answer
        const question = await ToeicQuestion.findById(questionId);

        if (!question) {
            return res.status(404).json({
                success: false,
                message: 'Question not found',
            });
        }

        // Submit answer
        attempt.submitAnswer({
            questionId,
            partNumber: question.part,
            userAnswer,
            correctAnswer: question.correctAnswer,
            timeSpent,
            isMarkedForReview,
        });

        await attempt.save();

        res.json({
            success: true,
            message: 'Answer submitted successfully',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Pause test
 * @route   PUT /api/toeic/attempts/:id/pause
 * @access  Private
 */
exports.pauseAttempt = async (req, res, next) => {
    try {
        const attempt = await ToeicAttempt.findById(req.params.id);

        if (!attempt) {
            return res.status(404).json({
                success: false,
                message: 'Attempt not found',
            });
        }

        if (attempt.userId.toString() !== req.user.id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized',
            });
        }

        attempt.pauseTest();
        await attempt.save();

        res.json({
            success: true,
            message: 'Test paused',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Resume test
 * @route   PUT /api/toeic/attempts/:id/resume
 * @access  Private
 */
exports.resumeAttempt = async (req, res, next) => {
    try {
        const attempt = await ToeicAttempt.findById(req.params.id);

        if (!attempt) {
            return res.status(404).json({
                success: false,
                message: 'Attempt not found',
            });
        }

        if (attempt.userId.toString() !== req.user.id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized',
            });
        }

        attempt.resumeTest();
        await attempt.save();

        // Tải lại ĐỦ câu hỏi của đề (không chỉ câu đã trả lời) + map đáp án đã lưu
        // → client hiển thị tiếp đúng trạng thái.
        const test = await ToeicTest.findById(attempt.testId).populate('parts.questions');
        const partRanges = { 1: { start: 1 }, 2: { start: 7 }, 3: { start: 32 }, 4: { start: 71 }, 5: { start: 101 }, 6: { start: 131 }, 7: { start: 147 } };
        const questions = [];
        let globalQuestionNumber = 0;
        if (test) {
            for (const part of test.parts) {
                let partQuestionIndex = 0;
                for (const question of part.questions) {
                    if (test.testType === 'full-test') globalQuestionNumber = (partRanges[part.partNumber]?.start || 1) + partQuestionIndex;
                    else globalQuestionNumber++;
                    const q = question.toObject();
                    delete q.correctAnswer;
                    delete q.questionKeyword;
                    delete q.answerKeyword;
                    delete q.audioKeyword;
                    q.options = (q.options || []).map(opt => ({ label: opt.label, text: opt.text }));
                    q.globalQuestionNumber = globalQuestionNumber;
                    q.section = part.partNumber <= 4 ? 'listening' : 'reading';
                    questions.push(q);
                    partQuestionIndex++;
                }
            }
        }

        const answerByQid = new Map((attempt.answers || []).map(a => [a.questionId?.toString(), a.userAnswer]));
        const answers = {};
        questions.forEach((q, i) => {
            const ua = answerByQid.get(q._id?.toString());
            if (ua) answers[i] = ua;
        });

        res.json({
            success: true,
            message: 'Test resumed',
            data: {
                attemptId: attempt._id,
                test: test ? { id: test._id, testName: test.testName, testType: test.testType, totalQuestions: test.totalQuestions } : null,
                questions,
                answers,
                markedQuestions: attempt.markedQuestions || [],
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Submit final test
 * @route   POST /api/toeic/attempts/:id/submit
 * @access  Private
 */
exports.submitAttempt = async (req, res, next) => {
    try {
        const { duration } = req.body;

        const attempt = await ToeicAttempt.findById(req.params.id);

        if (!attempt) {
            return res.status(404).json({
                success: false,
                message: 'Attempt not found',
            });
        }

        if (attempt.userId.toString() !== req.user.id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized',
            });
        }

        if (attempt.status !== 'in-progress') {
            return res.status(400).json({
                success: false,
                message: 'This attempt is already completed',
            });
        }

        // Set duration
        attempt.duration = duration || 0;

        // Calculate scores
        await attempt.calculateScores();

        // Calculate improvement
        await attempt.calculateImprovement();

        // Update question statistics
        for (const answer of attempt.answers) {
            const question = await ToeicQuestion.findById(answer.questionId);
            if (question) {
                question.recordAnswer(answer.isCorrect, answer.timeSpent);
                await question.save();
            }
        }

        // Update test statistics
        const test = await ToeicTest.findById(attempt.testId);
        if (test) {
            test.updateStats({
                totalScore: attempt.totalScore,
                listeningScore: attempt.listeningScore,
                readingScore: attempt.readingScore,
                isCompleted: true,
            });
            await test.save();
        }

        // Award rewards (XP, coins). KHÔNG .lean() — bên dưới có mutate + .save().
        const [toeicProfile, toeicStats] = await Promise.all([
            UserProfile.findOne({ userId: req.user.id }),
            UserStats.findOne({ userId: req.user.id }),
        ]);

        // Calculate rewards based on performance
        const baseXp = Math.round(attempt.accuracy * 10);
        const bonusXp = attempt.isPersonalBest ? 100 : 0;
        const perfectPartBonus = attempt.isPerfectPart.length * 50;

        attempt.xpEarned = baseXp + bonusXp + perfectPartBonus;
        attempt.coinsEarned = Math.round(attempt.accuracy * 5);

        if (attempt.totalScore >= 900) attempt.gemsEarned = 5;
        else if (attempt.totalScore >= 700) attempt.gemsEarned = 2;

        // Update stats
        if (toeicStats) {
            const { applyLevelUp } = require('../utils/userStateHelper');
            toeicStats.xp += attempt.xpEarned;
            toeicStats.totalXp += attempt.xpEarned;
            toeicStats.coins += attempt.coinsEarned;
            if (attempt.gemsEarned > 0) toeicStats.gems += attempt.gemsEarned;
            if (toeicProfile) applyLevelUp(toeicProfile, toeicStats);
            await Promise.all([toeicStats.save(), toeicProfile?.save()]);
        }

        await attempt.save();

        // Get interpretation
        const interpretation = getScoreInterpretation(
            attempt.totalScore,
            attempt.listeningScore,
            attempt.readingScore
        );

        // Batch fetch all questions in one query instead of N individual queries
        const questionIds = attempt.answers.map(a => a.questionId);
        const questionDocs = await ToeicQuestion.find({ _id: { $in: questionIds } })
            .select('questionText imageUrls passages options explanation part audioUrl audioText groupId questionIndex')
            .lean();
        const questionMap = new Map(questionDocs.map(q => [q._id.toString(), q]));

        const questionsReview = attempt.answers.map((ans) => {
            const q = questionMap.get(ans.questionId?.toString());
            return {
                questionId: ans.questionId,
                userAnswer: ans.userAnswer || null,
                correctAnswer: ans.correctAnswer,
                isCorrect: ans.isCorrect,
                part: ans.partNumber,
                questionText: q?.questionText || '',
                imageUrls: q?.imageUrls || [],
                passages: q?.passages || [],
                audioUrl: q?.audioUrl || null,
                audioText: q?.audioText || null,
                groupId: q?.groupId || null,
                questionIndex: q?.questionIndex || null,
                options: q?.options?.map(o => ({ label: o.label, text: o.text })) || [],
                explanation: q?.explanation || {},
            };
        });

        res.json({
            success: true,
            message: 'Test completed successfully',
            data: {
                ...attempt.getDetailedResults(),
                interpretation,
                questions: questionsReview,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get attempt details and review
 * @route   GET /api/toeic/attempts/:id/review
 * @access  Private
 */
exports.getAttemptReview = async (req, res, next) => {
    try {
        const attempt = await ToeicAttempt.findById(req.params.id)
            .populate('wrongQuestions')
            .populate('markedQuestions');

        if (!attempt) {
            return res.status(404).json({
                success: false,
                message: 'Attempt not found',
            });
        }

        if (attempt.userId.toString() !== req.user.id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized',
            });
        }

        // Batch fetch all questions in one query
        const reviewQuestionIds = attempt.answers.map(a => a.questionId);
        const reviewQuestionDocs = await ToeicQuestion.find({ _id: { $in: reviewQuestionIds } }).lean();
        const reviewQuestionMap = new Map(reviewQuestionDocs.map(q => [q._id.toString(), q]));

        const questions = attempt.answers
            .map((answer) => {
                const question = reviewQuestionMap.get(answer.questionId?.toString());
                if (!question) return null;
                return {
                    questionId: question._id,
                    part: question.part,
                    questionNumber: question.questionNumber,
                    questionText: question.questionText || '',
                    passages: question.passages || [],
                    imageUrls: question.imageUrls || [],
                    audioUrl: question.audioUrl || '',
                    audioText: question.audioText || '',
                    groupId: question.groupId || null,
                    questionIndex: question.questionIndex || null,
                    options: question.options || [],
                    correctAnswer: answer.correctAnswer,
                    userAnswer: answer.userAnswer || '',
                    isCorrect: answer.isCorrect,
                    timeSpent: answer.timeSpent,
                    explanation: question.explanation || {},
                };
            })
            .filter(q => q !== null);

        // Mark as reviewed
        if (!attempt.hasReviewed) {
            attempt.hasReviewed = true;
            attempt.reviewedAt = new Date();
            await attempt.save();
        }

        res.json({
            success: true,
            data: {
                ...attempt.getDetailedResults(),
                questions: questions,
                answers: attempt.answers,
                wrongQuestions: attempt.wrongQuestions,
                markedQuestions: attempt.markedQuestions,
            },
        });
    } catch (error) {
        next(error);
    }
};

// ===================================
// USER ANALYTICS
// ===================================

/**
 * @desc    Get user's in-progress attempt (if any) — for resume on page reload
 * @route   GET /api/toeic/my-attempts/in-progress
 * @access  Private
 */
exports.getInProgressAttempt = async (req, res, next) => {
    try {
        const attempt = await ToeicAttempt.findOne({
            userId: req.user.id,
            status: 'in-progress',
        })
            .sort({ startedAt: -1 })
            .populate('testId', 'title testType totalQuestions timeLimit');

        if (!attempt) {
            return res.json({ success: true, data: null });
        }

        res.json({ success: true, data: attempt });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get user's test history
 * @route   GET /api/toeic/my-attempts
 * @access  Private
 */
exports.getMyAttempts = async (req, res, next) => {
    try {
        const { testType, page = 1, limit = 10 } = req.query;

        const attempts = await ToeicAttempt.getUserHistory(req.user.id, {
            testType,
            limit: parseInt(limit),
            skip: (parseInt(page) - 1) * parseInt(limit),
        });

        const total = await ToeicAttempt.countDocuments({
            userId: req.user.id,
            status: 'completed',
            ...(testType && { testType }),
        });

        res.json({
            success: true,
            count: attempts.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            data: attempts,
        });
    } catch (error) {
        next(error);
    }
};

// ===================================
// FILE UPLOAD (IMAGES & AUDIO)
// ===================================

/**
 * @desc    Upload image for Part 1 questions
 * @route   POST /api/toeic/upload/part1-image
 * @access  Private/Admin
 */
exports.uploadPart1Image = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded',
            });
        }

        // Extract the relative path from the file path
        // req.file.path = "public/assets/images/e2e9/e2e9p1_1.jpg" (or "public\assets\images\e2e9\e2e9p1_1.jpg" on Windows)
        // We need to return: "/assets/images/e2e9/e2e9p1_1.jpg"
        const imageUrl = '/' + req.file.path.replace(/\\/g, '/').replace('public/', '');

        res.json({
            success: true,
            message: 'Image uploaded successfully',
            imageUrl,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Upload audio file for listening questions
 * @route   POST /api/toeic/upload/audio
 * @access  Private/Admin
 */
exports.uploadAudio = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded',
            });
        }

        // Extract the relative path from the file path
        // req.file.path = "public/assets/audio/e2e9/e2e9p1_1.mp3" (or "public\assets\audio\e2e9\e2e9p1_1.mp3" on Windows)
        // We need to return: "/assets/audio/e2e9/e2e9p1_1.mp3"
        const audioUrl = '/' + req.file.path.replace(/\\/g, '/').replace('public/', '');

        res.json({
            success: true,
            message: 'Audio uploaded successfully',
            audioUrl,
        });
    } catch (error) {
        next(error);
    }
};


module.exports = exports;
