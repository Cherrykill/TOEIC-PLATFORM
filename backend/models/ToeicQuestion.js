const mongoose = require('mongoose');

const ToeicQuestionSchema = new mongoose.Schema({
    // ===================================
    // BASIC INFO
    // ===================================
    part: {
        type: Number,
        required: [true, 'TOEIC part is required'],
        enum: [1, 2, 3, 4, 5, 6, 7],
        index: true,
    },
    questionNumber: {
        type: Number,
        required: true,
    },
    questionType: {
        type: String,
        required: true,
        enum: [
            // Part 1
            'photo-description',
            // Part 2
            'question-response',
            // Part 3
            'conversation',
            // Part 4
            'talk',
            // Part 5
            'incomplete-sentence',
            // Part 6
            'text-completion',
            // Part 7
            'single-passage',
            'double-passage',
            'triple-passage',
        ],
        index: true,
    },

    // ===================================
    // LISTENING (Part 1-4)
    // ===================================
    audioUrl: {
        type: String,
        trim: true,
    },
    audioText: {
        type: String, // Text for TTS generation
        trim: true,
    },
    audioScript: {
        type: String, // Full transcript for review
        trim: true,
    },
    speakers: {
        type: Number, // Number of speakers (for Part 3, 4)
        min: 1,
        max: 3,
    },

    // ===================================
    // QUESTION CONTENT
    // ===================================
    questionText: {
        type: String,
        trim: true,
    },
    imageUrl: {
        type: String, // For Part 1 and Part 7
        trim: true,
    },
    passage: {
        type: String, // For Part 6, 7
        trim: true,
    },
    passageTitle: {
        type: String, // Title of the passage
        trim: true,
    },
    passageType: {
        type: String, // email, article, notice, advertisement, etc.
        trim: true,
    },

    // ===================================
    // OPTIONS (A, B, C, D)
    // ===================================
    options: [{
        label: {
            type: String,
            required: true,
            enum: ['A', 'B', 'C', 'D'],
        },
        text: {
            type: String,
            required: true,
            trim: true,
        },
        isCorrect: {
            type: Boolean,
            default: false,
        },
    }],
    correctAnswer: {
        type: String,
        required: [true, 'Correct answer is required'],
        enum: ['A', 'B', 'C', 'D'],
    },

    // ===================================
    // EXPLANATION & LEARNING
    // ===================================
    explanation: {
        type: String,
        trim: true,
    },
    explanationVN: {
        type: String, // Vietnamese explanation
        trim: true,
    },
    translation: {
        type: String, // Vietnamese translation of question/passage
        trim: true,
    },
    grammarPoint: {
        type: String, // Grammar rule tested
        trim: true,
    },
    vocabularyFocus: [{
        type: String, // Key vocabulary tested
        trim: true,
    }],
    skillsTested: [{
        type: String,
        enum: [
            'vocabulary',
            'grammar',
            'inference',
            'main-idea',
            'detail',
            'purpose',
            'synonym',
            'paraphrase',
            'location',
            'reference',
        ],
    }],

    // ===================================
    // FILL-IN-BLANK KEYWORDS (Đục lỗ)
    // ===================================
    questionKeyword: {
        type: String, // Part 1-2: Keyword to blank in question/audio display
        trim: true,
    },
    answerKeyword: {
        type: String, // Part 1-2: Keyword to blank in correct answer only
        trim: true,
    },
    audioKeyword: {
        type: String, // Part 3-4: Keyword to blank in audio text/transcript
        trim: true,
    },

    // ===================================
    // METADATA
    // ===================================
    topic: {
        type: String,
        trim: true,
        index: true,
    },
    tags: [{
        type: String,
        trim: true,
    }],
    source: {
        type: String, // Source of the question (e.g., "ETS Official Test 1")
        trim: true,
    },

    // ===================================
    // STATISTICS
    // ===================================
    timesUsed: {
        type: Number,
        default: 0,
    },
    correctCount: {
        type: Number,
        default: 0,
    },
    wrongCount: {
        type: Number,
        default: 0,
    },
    averageTimeSpent: {
        type: Number, // milliseconds
        default: 0,
    },

    // ===================================
    // STATUS & ADMIN
    // ===================================
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
    isPublished: {
        type: Boolean,
        default: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, {
    timestamps: true,
    collection: 'toeic_questions',
});

// ===================================
// INDEXES — single-field indexes declared on schema fields via `index: true`;
// only compound indexes go here.
// ===================================
ToeicQuestionSchema.index({ isActive: 1, isPublished: 1 });

// ===================================
// METHODS
// ===================================

/**
 * Get accuracy rate
 */
ToeicQuestionSchema.methods.getAccuracy = function() {
    const total = this.correctCount + this.wrongCount;
    if (total === 0) return 0;
    return Math.round((this.correctCount / total) * 100);
};

/**
 * Record answer
 */
ToeicQuestionSchema.methods.recordAnswer = function(isCorrect, timeSpent) {
    this.timesUsed += 1;

    if (isCorrect) {
        this.correctCount += 1;
    } else {
        this.wrongCount += 1;
    }

    // Update average time spent
    if (timeSpent) {
        const totalTime = this.averageTimeSpent * (this.timesUsed - 1) + timeSpent;
        this.averageTimeSpent = Math.round(totalTime / this.timesUsed);
    }
};

/**
 * Get question with options shuffled (for practice)
 */
ToeicQuestionSchema.methods.getShuffledQuestion = function() {
    const question = this.toObject();

    // Shuffle options
    const options = [...question.options];
    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
    }

    question.options = options;

    // Remove correct answer and isCorrect flags for practice
    delete question.correctAnswer;
    question.options.forEach(opt => delete opt.isCorrect);

    return question;
};

// ===================================
// STATIC METHODS
// ===================================

/**
 * Get random questions by criteria
 */
ToeicQuestionSchema.statics.getRandomQuestions = async function(criteria) {
    const {
        part,
        count = 10,
        excludeIds = [],
    } = criteria;

    const query = {
        isActive: true,
        isPublished: true,
    };

    if (part) query.part = part;
    if (excludeIds.length > 0) {
        query._id = { $nin: excludeIds };
    }

    const questions = await this.aggregate([
        { $match: query },
        { $sample: { size: count } },
    ]);

    return questions;
};

/**
 * Get statistics by part
 */
ToeicQuestionSchema.statics.getStatsByPart = async function() {
    return await this.aggregate([
        { $match: { isActive: true, isPublished: true } },
        {
            $group: {
                _id: '$part',
                totalQuestions: { $sum: 1 },
                avgCorrectRate: {
                    $avg: {
                        $cond: [
                            { $eq: [{ $add: ['$correctCount', '$wrongCount'] }, 0] },
                            0,
                            {
                                $multiply: [
                                    { $divide: ['$correctCount', { $add: ['$correctCount', '$wrongCount'] }] },
                                    100,
                                ],
                            },
                        ],
                    },
                },
            },
        },
        { $sort: { _id: 1 } },
    ]);
};

module.exports = mongoose.model('ToeicQuestion', ToeicQuestionSchema);
