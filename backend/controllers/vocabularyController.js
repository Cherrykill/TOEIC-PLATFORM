// ===================================
// VOCABULARY CONTROLLER (MongoDB Only)
// ===================================

const logger = require('../utils/logger');
const activityLogger = require('../utils/activityLogger');
const Vocabulary = require('../models/Vocabulary');

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ===================================
// ALLOWED WORD TYPES (sync with frontend)
// ===================================
const ALLOWED_TYPES = [
    'noun',
    'verb',
    'adjective',
    'adverb',
    'preposition',
    'conjunction',
    'pronoun',
    'interjection',
    'phrase'
];

const DEFAULT_TYPE = 'noun';

function validateAndNormalizeType(type) {
    if (!type) return DEFAULT_TYPE;

    const normalizedType = type.toLowerCase().trim();

    if (ALLOWED_TYPES.includes(normalizedType)) {
        return normalizedType;
    }

    const corrections = {
        'n': 'noun',
        'v': 'verb',
        'adj': 'adjective',
        'adv': 'adverb',
        'prep': 'preposition',
        'conj': 'conjunction',
        'pron': 'pronoun',
        'interj': 'interjection',
        'phr': 'phrase',
        'word': 'noun',
        'nouns': 'noun',
        'verbs': 'verb',
        'adjectives': 'adjective',
        'adverbs': 'adverb',
    };

    if (corrections[normalizedType]) {
        logger.debug(`ℹ️  Auto-corrected type "${type}" → "${corrections[normalizedType]}"`);
        return corrections[normalizedType];
    }

    logger.warn(`⚠️  Invalid type "${type}" - using default "${DEFAULT_TYPE}"`);
    return DEFAULT_TYPE;
}

// Public vocab filter — excludes private user uploads.
// Uses $ne so legacy docs without `scope` field still match.
const PUBLIC_FILTER = { scope: { $ne: 'private' } };

// ===================================
// CONTROLLER FUNCTIONS
// ===================================

/**
 * @desc    Get all vocabulary with filters and pagination
 * @route   GET /api/vocabulary
 * @access  Public
 */
exports.getAllVocabulary = async (req, res, next) => {
    try {
        const { limit = 20, page = 1, part, type, search, source } = req.query;
        const pageNum = parseInt(page);
        const limitNum = Math.min(parseInt(limit) || 20, 10000);
        const skip = (pageNum - 1) * limitNum;

        let query = Vocabulary.find(PUBLIC_FILTER);

        if (part) {
            query = query.where('part').equals(part.toUpperCase());
        }
        if (type) {
            query = query.where('type').equals(type.toLowerCase());
        }
        if (source) {
            query = query.where('source').equals(source.toLowerCase());
        }
        if (search) {
            query = query.or([
                { en: new RegExp(escapeRegex(search), 'i') },
                { vn: new RegExp(escapeRegex(search), 'i') }
            ]);
        }

        const total = await Vocabulary.countDocuments(query.getFilter());
        const vocabulary = await query.skip(skip).limit(limitNum).lean().exec();

        res.json({
            success: true,
            count: vocabulary.length,
            total: total,
            page: pageNum,
            limit: limitNum,
            _source: 'mongodb',
            _filters: { part: part || null, type: type || null, source: source || null },
            data: vocabulary,
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get vocabulary by ID (word)
 * @route   GET /api/vocabulary/:id
 * @access  Public
 */
exports.getVocabularyById = async (req, res, next) => {
    try {
        const word = await Vocabulary.findOne({ ...PUBLIC_FILTER, en: req.params.id }).lean();

        if (!word) {
            return res.status(404).json({
                success: false,
                message: 'Word not found',
            });
        }

        res.json({
            success: true,
            data: word,
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get random vocabulary
 * @route   GET /api/vocabulary/random/:count
 * @access  Public
 */
exports.getRandomVocabulary = async (req, res, next) => {
    try {
        const count = Math.min(parseInt(req.params.count) || 10, 50);
        const { part, type } = req.query;

        let query = Vocabulary.find(PUBLIC_FILTER);

        if (part) {
            query = query.where('part').equals(part.toUpperCase());
        }
        if (type) {
            query = query.where('type').equals(type.toLowerCase());
        }

        const random = await query.sample(count);

        res.json({
            success: true,
            count: random.length,
            data: random,
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get vocabulary by part
 * @route   GET /api/vocabulary/part/:part
 * @access  Public
 */
exports.getVocabularyByPart = async (req, res, next) => {
    try {
        const { part } = req.params;

        const filtered = await Vocabulary.find({ ...PUBLIC_FILTER, part: part.toUpperCase() }).lean().exec();

        res.json({
            success: true,
            count: filtered.length,
            _source: 'mongodb',
            data: filtered,
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Search vocabulary
 * @route   GET /api/vocabulary/search
 * @access  Public
 */
exports.searchVocabulary = async (req, res, next) => {
    try {
        const { q, limit = 20 } = req.query;

        if (!q) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required',
            });
        }

        const results = await Vocabulary.find({
            ...PUBLIC_FILTER,
            $or: [
                { en: new RegExp(escapeRegex(q), 'i') },
                { vn: new RegExp(escapeRegex(q), 'i') },
                { phonetic: new RegExp(escapeRegex(q), 'i') }
            ]
        }).limit(parseInt(limit)).lean().exec();

        res.json({
            success: true,
            count: results.length,
            data: results,
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get vocabulary statistics
 * @route   GET /api/vocabulary/stats
 * @access  Public
 */
exports.getVocabularyStats = async (req, res, next) => {
    try {
        const stats = {
            total: await Vocabulary.countDocuments(PUBLIC_FILTER),
            byPart: {},
            byType: {},
            byLevel: {},
        };

        const partStats = await Vocabulary.aggregate([
            { $match: PUBLIC_FILTER },
            { $group: { _id: '$part', count: { $sum: 1 } } }
        ]);

        const typeStats = await Vocabulary.aggregate([
            { $match: PUBLIC_FILTER },
            { $group: { _id: '$type', count: { $sum: 1 } } }
        ]);

        const levelStats = await Vocabulary.aggregate([
            { $match: PUBLIC_FILTER },
            { $group: { _id: '$level', count: { $sum: 1 } } }
        ]);

        partStats.forEach(s => stats.byPart[s._id] = s.count);
        typeStats.forEach(s => stats.byType[s._id] = s.count);
        levelStats.forEach(s => stats.byLevel[s._id] = s.count);

        res.json({
            success: true,
            data: stats,
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get unique vocabulary parts
 * @route   GET /api/vocabulary/parts
 * @access  Public
 */
exports.getVocabularyParts = async (req, res, next) => {
    try {
        const match = { ...PUBLIC_FILTER };
        if (req.query.source) match.source = req.query.source;

        const grouped = await Vocabulary.aggregate([
            { $match: match },
            { $group: { _id: '$part', count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
        ]);

        const counts = {};
        const data = [];
        for (const g of grouped) {
            if (!g._id) continue;
            data.push(g._id);
            counts[g._id] = g.count;
        }

        res.json({
            success: true,
            data,        // array of part names (backward-compatible)
            counts,      // { partName: count } respecting optional ?source=
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Upsert vocabulary array (Admin only) — insert or update by "en"
 * @route   POST /api/vocabulary/upsert
 * @access  Private/Admin
 */
exports.upsertVocabulary = async (req, res, next) => {
    try {
        const words = Array.isArray(req.body) ? req.body : [req.body];
        if (words.length === 0) return res.status(400).json({ success: false, message: 'Empty array' });

        let inserted = 0, updated = 0, errors = [];

        for (const word of words) {
            if (!word.en) { errors.push({ en: null, message: 'Missing "en"' }); continue; }
            try {
                const normalizedType = word.type ? validateAndNormalizeType(word.type) : 'noun';
                const doc = {
                    ...(word.vn        !== undefined && { vn: word.vn }),
                    ...(word.phonetic  !== undefined && { phonetic: word.phonetic }),
                    ...(word.part      !== undefined && { part: word.part.toUpperCase() }),
                    ...(word.type      !== undefined && { type: normalizedType }),
                    ...(word.level     !== undefined && { level: word.level }),
                    ...(word.synonyms  !== undefined && { synonyms: word.synonyms }),
                    ...(word.image     !== undefined && { image: word.image }),
                    ...(word.example   !== undefined && { example: word.example }),
                    ...(word.source    !== undefined && { source: word.source }),
                    updatedAt: new Date(),
                };
                const upsertKey = {
                    ...PUBLIC_FILTER,
                    en: word.en,
                    ...(word.part   && { part:   word.part.toUpperCase() }),
                    ...(word.source && { source: word.source.toLowerCase() }),
                    ...(word.vn     !== undefined && { vn: word.vn }),
                };
                const result = await Vocabulary.updateOne(
                    upsertKey,
                    { $set: doc, $setOnInsert: { en: word.en, scope: 'public', createdAt: new Date() } },
                    { upsert: true }
                );
                if (result.upsertedCount > 0) inserted++;
                else updated++;
            } catch (e) {
                errors.push({ en: word.en, message: e.message });
            }
        }

        res.json({ success: true, inserted, updated, errors });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Create new vocabulary (Admin only)
 * @route   POST /api/vocabulary
 * @access  Private/Admin
 */
exports.createVocabulary = async (req, res, next) => {
    try {
        const { en, vn, phonetic, part, type, synonyms, image, example, level, sources, source } = req.body;

        if (!en || !vn || !part || !type) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: en, vn, part, type',
            });
        }

        const sourceVal = (source || (Array.isArray(sources) ? sources[0] : sources) || 'custom').toLowerCase();

        const existing = await Vocabulary.findOne({ ...PUBLIC_FILTER, en, part: part.toUpperCase(), source: sourceVal, vn });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Word already exists',
            });
        }

        const validatedType = validateAndNormalizeType(type);

        const newVocab = new Vocabulary({
            en,
            vn,
            phonetic: phonetic || '',
            part: part.toUpperCase(),
            type: validatedType,
            synonyms: synonyms || '',
            image: image || '',
            example: example || '',
            level: level || 'B1',
            source: sourceVal,
            scope: 'public',
        });

        await newVocab.save();

        await activityLogger.logActivity('vocabulary', 'add', {
            word: newVocab.en,
            part: newVocab.part,
            type: newVocab.type
        });

        res.status(201).json({
            success: true,
            message: 'Vocabulary added successfully',
            data: newVocab,
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update vocabulary (Admin only)
 * @route   PUT /api/vocabulary/:id
 * @access  Private/Admin
 */
exports.updateVocabulary = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { en, vn, phonetic, part, type, example, synonyms, image, level, sources, source } = req.body;

        const word = await Vocabulary.findOne({ ...PUBLIC_FILTER, en: id });

        if (!word) {
            return res.status(404).json({
                success: false,
                message: 'Word not found',
            });
        }

        const validatedType = type ? validateAndNormalizeType(type) : word.type;

        if (en) word.en = en;
        if (vn) word.vn = vn;
        if (phonetic !== undefined) word.phonetic = phonetic;
        if (part) word.part = part.toUpperCase();
        if (type) word.type = validatedType;
        if (example !== undefined) word.example = example;
        if (synonyms !== undefined) word.synonyms = synonyms;
        if (image !== undefined) word.image = image;
        if (level) word.level = level;
        const sourceVal = source || (Array.isArray(sources) ? sources[0] : sources);
        if (sourceVal) word.source = sourceVal.toLowerCase();

        await word.save();

        await activityLogger.logActivity('vocabulary', 'update', {
            word: word.en,
            part: word.part,
            type: word.type
        });

        res.json({
            success: true,
            message: 'Vocabulary updated successfully',
            data: word,
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete vocabulary (Admin only)
 * @route   DELETE /api/vocabulary/:id
 * @access  Private/Admin
 */
exports.deleteVocabulary = async (req, res, next) => {
    try {
        const { id } = req.params;

        const word = await Vocabulary.findOneAndDelete({ ...PUBLIC_FILTER, en: id });

        if (!word) {
            return res.status(404).json({
                success: false,
                message: 'Word not found',
            });
        }

        await activityLogger.logActivity('vocabulary', 'delete', {
            word: word.en,
            part: word.part,
        });

        res.json({
            success: true,
            message: 'Vocabulary deleted successfully',
            data: word,
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get vocabulary by level
 * @route   GET /api/vocabulary/level/:level
 * @access  Public
 */
exports.getVocabularyByLevel = async (req, res, next) => {
    try {
        const { level } = req.params;
        const { limit = 20, page = 1 } = req.query;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const total = await Vocabulary.countDocuments({ ...PUBLIC_FILTER, level });
        const data = await Vocabulary.find({ ...PUBLIC_FILTER, level })
            .skip(skip)
            .limit(limitNum)
            .exec();

        res.json({
            success: true,
            count: data.length,
            total,
            page: pageNum,
            limit: limitNum,
            data,
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Bulk import vocabulary (Admin only)
 * @route   POST /api/vocabulary/bulk
 * @access  Private/Admin
 */
exports.bulkImportVocabulary = async (req, res, next) => {
    try {
        const { words, source = 'custom' } = req.body;

        if (!Array.isArray(words) || words.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'words array is required and must not be empty',
            });
        }

        let inserted = 0;
        let skipped = 0;
        const errors = [];

        for (const word of words) {
            try {
                if (!word.en || !word.vn) {
                    errors.push(`Skipping word (missing en/vn): ${JSON.stringify(word)}`);
                    continue;
                }

                const partKey = (word.part || 'PART1').toUpperCase();
                const srcKey  = (word.source || source).toLowerCase();
                const exists  = await Vocabulary.findOne({ en: word.en, part: partKey, source: srcKey, vn: word.vn || '' });
                if (exists) {
                    skipped++;
                    continue;
                }

                const newVocab = new Vocabulary({
                    en: word.en,
                    vn: word.vn,
                    phonetic: word.phonetic || null,
                    part: (word.part || 'PART1').toUpperCase(),
                    type: validateAndNormalizeType(word.type),
                    synonyms: word.synonyms || null,
                    image: word.image || null,
                    example: word.example || null,
                    level: word.level || 'B1',
                    source: word.source || source,
                });

                await newVocab.save();
                inserted++;
            } catch (err) {
                errors.push(`${word.en}: ${err.message}`);
            }
        }

        await activityLogger.logActivity('vocabulary', 'bulk-import', { inserted, skipped });

        res.json({
            success: true,
            message: `Bulk import completed`,
            inserted,
            skipped,
            errors: errors.length > 0 ? errors : undefined,
        });

    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Bulk delete by array of "en" values
 * @route   DELETE /api/vocabulary/bulk
 */
exports.bulkDeleteVocabulary = async (req, res, next) => {
    try {
        const { ens } = req.body;
        if (!Array.isArray(ens) || ens.length === 0) {
            return res.status(400).json({ success: false, message: 'ens array is required' });
        }
        const result = await Vocabulary.deleteMany({ ...PUBLIC_FILTER, en: { $in: ens } });
        await activityLogger.logActivity('vocabulary', 'bulk-delete', { count: result.deletedCount });
        res.json({ success: true, deleted: result.deletedCount });
    } catch (error) {
        next(error);
    }
};

const FILTER_DELETE_ALLOWED_FIELDS = ['part', 'type', 'source', 'level', 'en', 'uploadBatchId', 'image'];

/**
 * @desc    Delete all docs matching one or more field=value conditions (AND)
 * @route   POST /api/vocabulary/filter-delete
 * Body: { filters: [{field, value}, ...] }  OR legacy { field, value }
 */
exports.filterDeleteVocabulary = async (req, res, next) => {
    try {
        // Normalise input: accept both legacy {field,value} and new {filters:[...]}
        let pairs = req.body.filters;
        if (!Array.isArray(pairs)) {
            const { field, value } = req.body;
            pairs = [{ field, value }];
        }

        // Validate & normalise each pair
        const conditions = {};
        for (const { field, value } of pairs) {
            if (!field || value === undefined || value === '') continue; // skip blank rows
            if (!FILTER_DELETE_ALLOWED_FIELDS.includes(field)) {
                return res.status(400).json({ success: false, message: `Invalid field "${field}". Allowed: ${FILTER_DELETE_ALLOWED_FIELDS.join(', ')}` });
            }
            conditions[field] = field === 'part' ? value.toUpperCase() : value;
        }

        if (Object.keys(conditions).length === 0) {
            return res.status(400).json({ success: false, message: 'At least one field+value pair is required' });
        }

        const filter = { ...PUBLIC_FILTER, ...conditions };
        const count = await Vocabulary.countDocuments(filter);
        const result = await Vocabulary.deleteMany(filter);
        await activityLogger.logActivity('vocabulary', 'filter-delete', { conditions, deleted: result.deletedCount });
        res.json({ success: true, deleted: result.deletedCount, matched: count });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete ALL public vocabulary (Admin only)
 * @route   DELETE /api/vocabulary/all
 */
exports.deleteAllVocabulary = async (req, res, next) => {
    try {
        const result = await Vocabulary.deleteMany(PUBLIC_FILTER);
        await activityLogger.logActivity('vocabulary', 'delete-all', { deleted: result.deletedCount });
        res.json({ success: true, deleted: result.deletedCount });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Replace all vocabulary with new dataset (Admin only)
 * @route   POST /api/vocabulary/replace
 * @access  Private/Admin
 */
exports.replaceVocabulary = async (req, res, next) => {
    try {
        const { words, source } = req.body;

        if (!Array.isArray(words) || words.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'words array is required',
            });
        }

        await Vocabulary.deleteMany(source ? { source } : {});

        const docs = words.map(word => ({
            en: word.en,
            vn: word.vn,
            phonetic: word.phonetic || null,
            part: (word.part || 'PART1').toUpperCase(),
            type: validateAndNormalizeType(word.type),
            synonyms: word.synonyms || null,
            image: word.image || null,
            example: word.example || null,
            level: word.level || 'B1',
            source: word.source || source || 'custom',
        }));

        await Vocabulary.insertMany(docs, { ordered: false });

        await activityLogger.logActivity('vocabulary', 'replace', { count: docs.length, source });

        res.json({
            success: true,
            message: 'Vocabulary replaced successfully',
            count: docs.length,
        });

    } catch (error) {
        next(error);
    }
};
