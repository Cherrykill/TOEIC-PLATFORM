// ===================================
// TOEIC QUESTIONS CONTROLLER
// ===================================
// Split out of toeicController (P4). Self-contained question-bank CRUD +
// AI generation. LETTERS and the aiQuestionGenerator require are local to
// their handlers. Verbatim move; behaviour unchanged. routes/toeic.js
// imports these from here now.

const ToeicQuestion = require('../models/ToeicQuestion');
const logger = require('../utils/logger');

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

module.exports = exports;
