// ===================================
// TOEIC TESTS CONTROLLER
// ===================================
// Split out of toeicController (P4). Self-contained test (exam paper)
// CRUD + full-test generation. Verbatim move; behaviour unchanged.
// routes/toeic.js imports these from here now.

const ToeicQuestion = require('../models/ToeicQuestion');
const ToeicTest = require('../models/ToeicTest');
const UserProfile = require('../models/UserProfile');
const UserStats = require('../models/UserStats');

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
        const { testName, testType, description, source, level, totalTime: customTotalTime, questionSelectMode,
            isFree, requiredCoins, requiredLevel } = req.body;

        // Điều kiện vào bài, chuẩn hoá 1 lần rồi dùng cho cả full-test lẫn mini-test.
        const accessFields = {
            isFree: isFree === undefined ? true : !!isFree,
            requiredCoins: Math.max(0, Number(requiredCoins) || 0),
            requiredLevel: Math.max(1, Number(requiredLevel) || 1),
        };

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
                    source: source || null,
                    createdBy: req.user.id,
                    isPublished: false,
                    allowReuseQuestions: allowReuseQuestions || false,
                });

                // Override totalTime if custom time provided
                if (customTotalTime) test.totalTime = customTotalTime;
                Object.assign(test, accessFields);
                await test.save();

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

            // Chế độ chọn câu: default (thứ tự, trong test này) | shuffle-same (đảo,
            // cùng test) | shuffle-cross (đảo, lấy từ MỌI test cùng Part).
            const selectMode = questionSelectMode || 'default';
            const scopeFilter = {
                part: partNumber,
                isActive: true,
                isPublished: true,
                // shuffle-cross bỏ filter source để gộp câu từ các test khác
                ...(selectMode !== 'shuffle-cross' && source ? { source } : {}),
            };

            const availableCount = await ToeicQuestion.countDocuments(scopeFilter);
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

            const pool = await ToeicQuestion.find(scopeFilter)
                .sort({ questionNumber: 1, createdAt: 1 })
                .lean();

            const shuffle = (arr) => {
                for (let i = arr.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                }
                return arr;
            };

            let questions;
            if (selectMode === 'default') {
                // Theo thứ tự tạo
                questions = pool.slice(0, requiredCount);
            } else if ([3, 4, 6, 7].includes(partNumber)) {
                // Part có nhóm → ĐẢO THEO NHÓM, giữ nguyên thứ tự câu trong nhóm
                const groupMap = new Map();
                for (const q of pool) {
                    const key = q.groupId || String(q._id);
                    if (!groupMap.has(key)) groupMap.set(key, []);
                    groupMap.get(key).push(q);
                }
                const groups = [...groupMap.values()];
                groups.forEach(g => g.sort((a, b) => (a.questionIndex || 0) - (b.questionIndex || 0)));
                shuffle(groups);
                questions = [];
                for (const g of groups) {
                    if (questions.length >= requiredCount) break;
                    questions.push(...g);
                }
                questions = questions.slice(0, requiredCount);
            } else {
                // Part câu đơn (1, 2, 5) → đảo từng câu
                questions = shuffle(pool).slice(0, requiredCount);
            }

            if (questions.length < requiredCount) {
                return res.status(400).json({
                    success: false,
                    message: `⚠️ Cannot create Mini Test Part ${partNumber}: Not enough questions. Need ${requiredCount}, found ${questions.length}.`,
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
            source: source || null,
            level: level || 'intermediate',
            parts,
            totalQuestions,
            totalTime,
            createdBy: req.user.id,
            isPublished: false,
            isActive: true,
            questionSelectMode: questionSelectMode || 'default',
            ...accessFields,
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
        const { testName, testType, description, source, level, totalTime, randomQuestionCount, questionSelectMode, isPublished, isActive,
            isFree, requiredCoins, requiredLevel } = req.body;

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
        if (source !== undefined) test.source = source;
        if (level !== undefined) test.level = level;
        if (totalTime !== undefined) test.totalTime = totalTime;
        if (randomQuestionCount !== undefined) test.randomQuestionCount = randomQuestionCount;
        if (questionSelectMode !== undefined) test.questionSelectMode = questionSelectMode;
        // Điều kiện vào bài — kẹp giá trị để admin không lỡ tay nhập số âm.
        if (isFree !== undefined) test.isFree = !!isFree;
        if (requiredCoins !== undefined) test.requiredCoins = Math.max(0, Number(requiredCoins) || 0);
        if (requiredLevel !== undefined) test.requiredLevel = Math.max(1, Number(requiredLevel) || 1);
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
        const { id } = req.params;
        console.log('[deleteTest] id:', id);

        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: `Invalid test ID: ${id}` });
        }

        const test = await ToeicTest.findById(id);
        console.log('[deleteTest] found:', test?._id || 'null');

        if (!test) {
            const allTests = await ToeicTest.find({}).select('_id testName').lean();
            console.log('[deleteTest] all tests in DB:', allTests.map(t => t._id.toString()));
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

module.exports = exports;
