// ===================================
// FAVORITES CONTROLLER (per-user, requires auth)
// ===================================
// Split out of vocabularyController (P4). Self-contained: only touches the
// User model + req/res/next — no vocabulary query helpers. Verbatim move,
// behaviour unchanged; routes/vocabulary.js now imports these from here.

const User = require('../models/User');

exports.getFavorites = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('favoriteWords');
        res.json({ success: true, data: user?.favoriteWords || [] });
    } catch (error) {
        next(error);
    }
};

exports.addFavorite = async (req, res, next) => {
    try {
        const { word } = req.body;
        if (!word?.en) return res.status(400).json({ success: false, message: 'Missing word.en' });
        const entry = {
            en: word.en,
            vn: word.vn || '',
            phonetic: word.phonetic || '',
            synonyms: word.synonyms || '',
            part: word.part || '',
        };
        await User.findByIdAndUpdate(req.user.id, { $pull: { favoriteWords: { en: word.en } } });
        await User.findByIdAndUpdate(req.user.id, { $push: { favoriteWords: entry } });
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
};

exports.removeFavorite = async (req, res, next) => {
    try {
        if (req.body.all) {
            await User.findByIdAndUpdate(req.user.id, { $set: { favoriteWords: [] } });
        } else {
            const { en } = req.body;
            if (!en) return res.status(400).json({ success: false, message: 'Missing en' });
            await User.findByIdAndUpdate(req.user.id, { $pull: { favoriteWords: { en } } });
        }
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
};
