const ToeicQuestion = require('../models/ToeicQuestion');
const logger = require('../utils/logger');
const ToeicTest = require('../models/ToeicTest');
const ToeicAttempt = require('../models/ToeicAttempt');
const UserProfile = require('../models/UserProfile');
const UserStats = require('../models/UserStats');
const {
    getToeicLevel,
    getScoreInterpretation,
    calculatePercentile,
} = require('../utils/toeicScoreConverter');

// ===================================
// TOEIC QUESTIONS MANAGEMENT
// ===================================

/**
 * @desc    Get all TOEIC questions (Admin)
 * @route   GET /api/toeic/questions
 * @access  Private/Admin
 */
exports.getQuestions = async (req, res, next) => {
    try {
        const {
            part,
            questionType,
            topic,
            page = 1,
            limit = 20,
        } = req.query;

        const query = {};

        if (part) query.part = parseInt(part);
        if (questionType) query.questionType = questionType;
        if (topic) query.topic = topic;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const questions = await ToeicQuestion.find(query)
            .sort({ createdAt: -1, _id: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .lean();

        const total = await ToeicQuestion.countDocuments(query);

        res.json({
            success: true,
            count: questions.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            data: questions,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get single question
 * @route   GET /api/toeic/questions/:id
 * @access  Private/Admin
 */
exports.getQuestion = async (req, res, next) => {
    try {
        const question = await ToeicQuestion.findById(req.params.id).lean();

        if (!question) {
            return res.status(404).json({
                success: false,
                message: 'Question not found',
            });
        }

        res.json({
            success: true,
            data: question,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Create new question (Admin)
 * @route   POST /api/toeic/questions
 * @access  Private/Admin
 */
exports.createQuestion = async (req, res, next) => {
    try {
        req.body.createdBy = req.user.id;

        // Auto-generate questionNumber if not provided
        if (!req.body.questionNumber) {
            const lastQuestion = await ToeicQuestion.findOne({ part: req.body.part })
                .sort({ questionNumber: -1 })
                .select('questionNumber');

            req.body.questionNumber = lastQuestion ? lastQuestion.questionNumber + 1 : 1;
        }

        // Auto-generate questionType based on part if not provided
        if (!req.body.questionType) {
            const questionTypeMap = {
                1: 'photo-description',
                2: 'question-response',
                3: 'conversation',
                4: 'talk',
                5: 'incomplete-sentence',
                6: 'text-completion',
                7: 'single-passage',
            };
            req.body.questionType = questionTypeMap[req.body.part];
        }

        const question = await ToeicQuestion.create(req.body);

        res.status(201).json({
            success: true,
            message: 'Question created successfully',
            data: question,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update question (Admin)
 * @route   PUT /api/toeic/questions/:id
 * @access  Private/Admin
 */
exports.updateQuestion = async (req, res, next) => {
    try {
        const question = await ToeicQuestion.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!question) {
            return res.status(404).json({
                success: false,
                message: 'Question not found',
            });
        }

        res.json({
            success: true,
            message: 'Question updated successfully',
            data: question,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete question (Admin)
 * @route   DELETE /api/toeic/questions/:id
 * @access  Private/Admin
 */
exports.deleteQuestion = async (req, res, next) => {
    try {
        const question = await ToeicQuestion.findByIdAndDelete(req.params.id);

        if (!question) {
            return res.status(404).json({
                success: false,
                message: 'Question not found',
            });
        }

        res.json({
            success: true,
            message: 'Question deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete all questions (Admin)
 * @route   DELETE /api/toeic/questions/delete-all
 * @access  Private/Admin
 */
exports.deleteAllQuestions = async (req, res, next) => {
    try {
        // Delete all TOEIC questions
        const result = await ToeicQuestion.deleteMany({});

        res.json({
            success: true,
            message: `Successfully deleted all TOEIC questions`,
            deletedCount: result.deletedCount,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get questions statistics by part (Admin)
 * @route   GET /api/toeic/questions/statistics
 * @access  Private/Admin
 */
exports.getQuestionsStatistics = async (req, res, next) => {
    try {
        const partNames = {
            1: 'Photographs',
            2: 'Question-Response',
            3: 'Conversations',
            4: 'Talks',
            5: 'Incomplete Sentences',
            6: 'Text Completion',
            7: 'Reading Comprehension'
        };

        const partRequirements = {
            1: 6, 2: 25, 3: 39, 4: 30, 5: 30, 6: 16, 7: 54
        };

        const statistics = [];
        let totalAvailable = 0;
        let totalRequired = 0;
        let canCreateFullTest = true;

        for (let part = 1; part <= 7; part++) {
            const total = await ToeicQuestion.countDocuments({ part, isActive: true, isPublished: true });

            const required = partRequirements[part];
            const missing = Math.max(0, required - total);
            const canCreate = total >= required;

            if (!canCreate) canCreateFullTest = false;

            totalAvailable += total;
            totalRequired += required;

            statistics.push({
                part,
                partName: partNames[part],
                available: total,
                required,
                missing,
                canCreate
            });
        }

        // Section breakdown
        const listeningCount = await ToeicQuestion.countDocuments({
            part: { $in: [1, 2, 3, 4] },
            isActive: true,
            isPublished: true,
        });

        const readingCount = await ToeicQuestion.countDocuments({
            part: { $in: [5, 6, 7] },
            isActive: true,
            isPublished: true,
        });

        res.json({
            success: true,
            data: {
                parts: statistics,
                summary: {
                    totalAvailable,
                    totalRequired,
                    missing: totalRequired - totalAvailable,
                    progress: ((totalAvailable / totalRequired) * 100).toFixed(1),
                    canCreateFullTest
                },
                sections: {
                    listening: {
                        count: listeningCount,
                        required: 100
                    },
                    reading: {
                        count: readingCount,
                        required: 100
                    }
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Generate questions using AI (Admin)
 * @route   POST /api/toeic/questions/ai-generate
 * @access  Private/Admin
 */
exports.generateQuestionsWithAI = async (req, res, next) => {
    try {
        const { part, count = 5, autoSave = false } = req.body;

        // Validate part
        if (!part || part < 1 || part > 7) {
            return res.status(400).json({
                success: false,
                message: 'Invalid part number. Must be between 1 and 7.',
            });
        }

        // Validate count
        if (count < 1 || count > 50) {
            return res.status(400).json({
                success: false,
                message: 'Count must be between 1 and 50.',
            });
        }

        logger.debug(`AI generating ${count} questions for Part ${part}`);

        const aiGenerator = require('../services/aiQuestionGenerator');
        const generatedQuestions = await aiGenerator.generateQuestions(part, count);

        // Optionally save to database
        let savedQuestions = [];
        if (autoSave) {
            for (let i = 0; i < generatedQuestions.length; i++) {
                const qData = generatedQuestions[i];

                // Map questionType to schema enum
                let questionType;
                if (part === 1) questionType = 'photo-description';
                else if (part === 2) questionType = 'question-response';
                else if (part === 3) questionType = 'conversation';
                else if (part === 4) questionType = 'talk';
                else if (part === 5) questionType = 'incomplete-sentence';
                else if (part === 6) questionType = 'text-completion';
                else if (part === 7) questionType = 'single-passage';

                // Transform options from AI format to DB format
                // Always assign A/B/C/D by index — AI sometimes returns word text as optionLetter
                const LETTERS = ['A', 'B', 'C', 'D'];
                const transformedOptions = qData.options.map((opt, idx) => ({
                    label: LETTERS[idx] || LETTERS[0],
                    text: opt.optionText,
                    isCorrect: opt.isCorrect,
                }));

                // correctAnswer = letter of the option where isCorrect === true
                const correctIdx = qData.options.findIndex(opt => opt.isCorrect);
                const correctAnswer = LETTERS[correctIdx >= 0 ? correctIdx : 0];

                // Prepare question data for saving
                const questionToSave = {
                    part: qData.part,
                    questionNumber: i + 1,
                    questionText: qData.questionText,
                    questionType: questionType,
                    options: transformedOptions,
                    correctAnswer,
                    explanation: qData.explanation,
                    grammarPoint: qData.grammarPoint || null,
                    topic: qData.grammarPoint || qData.passageType || 'general',
                    audioScript: qData.audioTranscript || null,
                    passage: qData.passage || null,
                    passageType: qData.passageType || null,
                    tags: ['ai-generated'],
                    isPublished: false, // Admin needs to review first
                    isActive: true,
                    createdBy: req.user.id,
                };

                const savedQuestion = await ToeicQuestion.create(questionToSave);
                savedQuestions.push(savedQuestion);
            }

            logger.debug(`✅ Saved ${savedQuestions.length} AI-generated questions to database`);
        }

        res.status(201).json({
            success: true,
            message: autoSave
                ? `Generated and saved ${generatedQuestions.length} questions successfully`
                : `Generated ${generatedQuestions.length} questions successfully (not saved)`,
            data: autoSave ? savedQuestions : generatedQuestions,
            metadata: {
                part,
                count: generatedQuestions.length,
                autoSaved: autoSave,
                needsReview: autoSave,
            },
        });

    } catch (error) {
        logger.error('AI generation error:', error);
        next(error);
    }
};

// ===================================
// TOEIC TESTS MANAGEMENT
// ===================================

/**
 * @desc    Get all tests
 * @route   GET /api/toeic/tests
 * @access  Private
 */
exports.getTests = async (req, res, next) => {
    try {
        const { testType } = req.query;
        const isAdmin = req.user.role === 'admin';

        const query = { isActive: true };
        if (!isAdmin) query.isPublished = true;
        if (testType) query.testType = testType;

        const tests = await ToeicTest.find(query)
            .select('-parts.questions')
            .sort({ createdAt: -1 })
            .lean();

        let userContext = { level: 1, coins: 0 };
        if (!isAdmin) {
            const stats = await UserStats.findOne({ userId: req.user.id }).lean();
            const profile = await UserProfile.findOne({ userId: req.user.id }).lean();
            userContext = { level: profile?.level ?? 1, coins: stats?.coins ?? 0 };
        }

        const testsWithAccess = isAdmin
            ? tests
            : tests.map(test => {
                const access = new ToeicTest(test).canUserAccess(userContext);
                return { ...test, canAccess: access.allowed, accessReason: access.reason || null };
            });

        res.json({
            success: true,
            count: testsWithAccess.length,
            data: testsWithAccess,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get single test details
 * @route   GET /api/toeic/tests/:id
 * @access  Private
 */
exports.getTest = async (req, res, next) => {
    try {
        const test = await ToeicTest.findById(req.params.id)
            .populate('parts.questions', 'part questionNumber')
            .lean();

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
        const testDoc = new ToeicTest(test);
        const access = testDoc.canUserAccess({ level: profile?.level ?? 1, coins: stats?.coins ?? 0 });

        res.json({
            success: true,
            data: {
                ...test,
                canAccess: access.allowed,
                accessReason: access.reason || null,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Create new test (Admin)
 * @route   POST /api/toeic/tests
 * @access  Private/Admin
 */
exports.createTest = async (req, res, next) => {
    try {
        const { testName, testType, description, totalTime: customTotalTime, allowReuseQuestions } = req.body;

        // Validate required fields
        if (!testName || !testType) {
            return res.status(400).json({
                success: false,
                message: 'Test name and type are required',
            });
        }

        // If Full Test, use the createFullTest method to auto-populate questions
        if (testType === 'full-test') {
            try {
                const test = await ToeicTest.createFullTest({
                    testName,
                    description,
                    createdBy: req.user.id,
                    isPublished: false,
                    allowReuseQuestions: allowReuseQuestions || false,
                });

                // Override totalTime if custom time provided
                if (customTotalTime) {
                    test.totalTime = customTotalTime;
                    await test.save();
                }

                return res.status(201).json({
                    success: true,
                    message: `✅ Full Test created successfully with ${test.totalQuestions} questions!`,
                    data: test,
                });
            } catch (error) {
                // If error has insufficientParts, return it in response
                if (error.insufficientParts) {
                    return res.status(400).json({
                        success: false,
                        message: error.message,
                        insufficientParts: error.insufficientParts,
                    });
                }
                throw error; // Re-throw other errors
            }
        }

        // For Mini Tests, create with random questions for that part
        let parts = [];
        let totalQuestions = 0;
        let totalTime = customTotalTime || 0;

        if (testType.startsWith('mini-part')) {
            // Extract part number from testType (e.g., "mini-part1" -> 1)
            const partNumber = parseInt(testType.replace('mini-part', ''));

            // Define question counts for each part
            const partQuestionCounts = {
                1: 6, 2: 25, 3: 39, 4: 30,
                5: 30, 6: 16, 7: 54
            };

            // Default time limits per part
            const partTimeLimits = {
                1: 240, 2: 600, 3: 1020, 4: 900,
                5: 720, 6: 480, 7: 2040
            };

            const requiredCount = partQuestionCounts[partNumber];
            const defaultTime = partTimeLimits[partNumber] || 600;

            // Check if enough questions available
            const availableCount = await ToeicQuestion.countDocuments({
                part: partNumber,
                isActive: true,
                isPublished: true,
            });

            if (availableCount < requiredCount) {
                return res.status(400).json({
                    success: false,
                    message: `⚠️ Cannot create Mini Test Part ${partNumber}: Need ${requiredCount} questions, but only ${availableCount} available. Please add ${requiredCount - availableCount} more questions.`,
                    insufficientParts: [{
                        part: partNumber,
                        required: requiredCount,
                        available: availableCount,
                        missing: requiredCount - availableCount,
                    }],
                });
            }

            // Get questions already used in other tests if reuse is not allowed
            let excludeIds = [];
            if (allowReuseQuestions === false) {
                const existingTests = await ToeicTest.find({ isActive: true }).select('parts').lean();
                existingTests.forEach(test => {
                    test.parts.forEach(part => {
                        if (part.partNumber === partNumber && part.questions) {
                            excludeIds.push(...part.questions);
                        }
                    });
                });
            }

            // Get random questions for this part
            const questions = await ToeicQuestion.getRandomQuestions({
                part: partNumber,
                count: requiredCount,
                excludeIds,
            });

            if (questions.length < requiredCount) {
                return res.status(400).json({
                    success: false,
                    message: `⚠️ Cannot create Mini Test Part ${partNumber}: Not enough ${allowReuseQuestions === false ? 'unused ' : ''}questions available. Need ${requiredCount} questions, but only ${questions.length} found. Please ${allowReuseQuestions === false ? 'enable question reuse or ' : ''}add more questions.`,
                });
            }

            parts = [{
                partNumber,
                questions: questions.map(q => q._id),
                questionsCount: questions.length,
                timeLimit: customTotalTime || defaultTime
            }];
            totalQuestions = questions.length;
            if (!customTotalTime) {
                totalTime = defaultTime;
            }
        }

        const test = await ToeicTest.create({
            testName,
            testType,
            description,
            parts,
            totalQuestions,
            totalTime,
            createdBy: req.user.id,
            isPublished: false, // Admin can review before publishing
            isActive: true,
            allowReuseQuestions: allowReuseQuestions || false,
        });

        res.status(201).json({
            success: true,
            message: `✅ ${testType === 'full-test' ? 'Full Test' : 'Mini Test'} created successfully with ${test.totalQuestions} questions!`,
            data: test,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Generate full-length test automatically (Admin)
 * @route   POST /api/toeic/tests/generate
 * @access  Private/Admin
 */
exports.generateFullTest = async (req, res, next) => {
    try {
        const { testName, description } = req.body;

        const test = await ToeicTest.createFullTest({
            testName,
            description,
            createdBy: req.user.id,
            isPublished: false, // Admin needs to review before publishing
        });

        res.status(201).json({
            success: true,
            message: 'Full test generated successfully',
            data: test,
        });
    } catch (error) {
        // If error has insufficientParts, return it in response
        if (error.insufficientParts) {
            return res.status(400).json({
                success: false,
                message: error.message,
                insufficientParts: error.insufficientParts,
            });
        }
        next(error);
    }
};

/**
 * @desc    Update test (Admin)
 * @route   PUT /api/toeic/tests/:id
 * @access  Private/Admin
 */
exports.updateTest = async (req, res, next) => {
    try {
        const { testName, testType, description, totalTime, randomQuestionCount, allowReuseQuestions, isPublished, isActive } = req.body;

        const test = await ToeicTest.findById(req.params.id);

        if (!test) {
            return res.status(404).json({
                success: false,
                message: 'Test not found',
            });
        }

        // Prevent editing published tests
        if (test.isPublished) {
            return res.status(400).json({
                success: false,
                message: 'Cannot edit a published test. Please unpublish it first.',
            });
        }

        // Update basic fields
        if (testName) test.testName = testName;
        if (testType) test.testType = testType;
        if (description !== undefined) test.description = description;
        if (totalTime !== undefined) test.totalTime = totalTime;
        if (randomQuestionCount !== undefined) test.randomQuestionCount = randomQuestionCount;
        if (allowReuseQuestions !== undefined) test.allowReuseQuestions = allowReuseQuestions;
        if (isPublished !== undefined) test.isPublished = isPublished;
        if (isActive !== undefined) test.isActive = isActive;

        test.lastModifiedBy = req.user.id;

        await test.save();

        res.json({
            success: true,
            message: 'Test updated successfully',
            data: test,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Publish/Unpublish test (Admin)
 * @route   PUT /api/toeic/tests/:id/publish
 * @access  Private/Admin
 */
exports.publishTest = async (req, res, next) => {
    try {
        const { isPublished } = req.body;

        const test = await ToeicTest.findById(req.params.id);

        if (!test) {
            return res.status(404).json({
                success: false,
                message: 'Test not found',
            });
        }

        // Validate that test has questions before publishing
        if (isPublished && test.totalQuestions === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot publish test with no questions. Please add questions first.',
            });
        }

        test.isPublished = isPublished;
        test.lastModifiedBy = req.user.id;

        await test.save();

        res.json({
            success: true,
            message: isPublished ? 'Test published successfully' : 'Test unpublished',
            data: test,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete a test (Admin)
 * @route   DELETE /api/toeic/tests/:id
 * @access  Private/Admin
 */
exports.deleteTest = async (req, res, next) => {
    try {
        const test = await ToeicTest.findById(req.params.id);

        if (!test) {
            return res.status(404).json({
                success: false,
                message: 'Test not found',
            });
        }

        await test.deleteOne();

        res.json({
            success: true,
            message: 'Test deleted successfully',
            data: {},
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete all tests
 * @route   DELETE /api/toeic/tests/delete-all
 * @access  Private/Admin
 */
exports.deleteAllTests = async (req, res, next) => {
    try {
        const result = await ToeicTest.deleteMany({});

        res.json({
            success: true,
            message: `Deleted ${result.deletedCount} tests successfully`,
            deletedCount: result.deletedCount,
        });
    } catch (error) {
        next(error);
    }
};

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

        // Deduct coins if not free
        if (!test.isFree && test.requiredCoins > 0) {
            stats.coins -= test.requiredCoins;
            await stats.save();
        }

        // Create attempt
        const attempt = await ToeicAttempt.create({
            userId: user._id,
            testId: test._id,
            testType: test.testType,
            testName: test.testName,
            totalQuestions: test.totalQuestions,
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

        res.json({
            success: true,
            message: 'Test resumed',
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

        // Award rewards (XP, coins)
        const [toeicProfile, toeicStats] = await Promise.all([
            UserProfile.findOne({ userId: req.user.id }).lean(),
            UserStats.findOne({ userId: req.user.id }).lean(),
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
            .select('questionText imageUrl passage options explanation part')
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
                imageUrl: q?.imageUrl || null,
                passage: q?.passage || null,
                options: q?.options?.map(o => ({ label: o.label, text: o.text })) || [],
                explanation: q?.explanation || null,
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
                    passage: question.passage || '',
                    imageUrl: question.imageUrl || '',
                    audioUrl: question.audioUrl || '',
                    options: question.options || [],
                    correctAnswer: answer.correctAnswer,
                    userAnswer: answer.userAnswer || '',
                    isCorrect: answer.isCorrect,
                    timeSpent: answer.timeSpent,
                    explanation: question.explanation || '',
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

/**
 * @desc    Get user analytics overview
 * @route   GET /api/toeic/analytics/overview
 * @access  Private
 */
exports.getAnalyticsOverview = async (req, res, next) => {
    try {
        const analytics = await ToeicAttempt.getUserAnalytics(req.user.id);

        res.json({
            success: true,
            data: analytics,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get score progression
 * @route   GET /api/toeic/analytics/progress
 * @access  Private
 */
exports.getScoreProgress = async (req, res, next) => {
    try {
        const { limit = 10 } = req.query;

        const progression = await ToeicAttempt.getScoreProgression(
            req.user.id,
            parseInt(limit)
        );

        res.json({
            success: true,
            data: progression,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get part-by-part analysis
 * @route   GET /api/toeic/analytics/parts
 * @access  Private
 */
exports.getPartAnalysis = async (req, res, next) => {
    try {
        const attempts = await ToeicAttempt.find({
            userId: req.user.id,
            status: 'completed',
        }).select('partScores').lean();

        // Aggregate part scores
        const partStats = {};

        for (const attempt of attempts) {
            for (const partScore of attempt.partScores) {
                const part = partScore.partNumber;

                if (!partStats[part]) {
                    partStats[part] = {
                        partNumber: part,
                        attempts: 0,
                        totalAccuracy: 0,
                        avgAccuracy: 0,
                    };
                }

                partStats[part].attempts += 1;
                partStats[part].totalAccuracy += partScore.accuracy;
            }
        }

        // Calculate averages
        const analysis = Object.values(partStats).map(stat => ({
            ...stat,
            avgAccuracy: Math.round(stat.totalAccuracy / stat.attempts),
        }));

        res.json({
            success: true,
            data: analysis,
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
