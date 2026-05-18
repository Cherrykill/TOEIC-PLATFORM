const Vocabulary = require('../models/Vocabulary');
const User = require('../models/User');

// Private uploads: user picks retention at upload time.
const ALLOWED_RETENTION_DAYS = [3, 7, 14, 30];
const DEFAULT_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// Days until a private source is considered "expiring soon" (force export).
const EXPIRY_WARN_DAYS = 3;

/** Resolve a valid retention (in days) from the request, fallback to default. */
function resolveRetentionDays(raw) {
  const n = parseInt(raw, 10);
  return ALLOWED_RETENTION_DAYS.includes(n) ? n : DEFAULT_RETENTION_DAYS;
}

const lower = (s) => (s == null ? '' : String(s).trim().toLowerCase());
const upper = (s) => (s == null ? '' : String(s).trim().toUpperCase());
const capFirst = (s) => {
  if (!s) return '';
  const trimmed = String(s).trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

// GET /api/upload/check
// Permission gating disabled — all authenticated users can upload.
exports.checkPermission = async (req, res) => {
  res.json({
    success: true,
    hasPermission: true,
    limit: 100,
    status: 'active',
  });
};

// POST /api/upload/vocabulary - save a single vocab entry as PRIVATE doc
exports.uploadVocabulary = async (req, res) => {
  try {
    const userId = req.user.id;
    const userDoc = await User.findById(userId).select('email').lean();
    const email = userDoc?.email;
    const {
      en, vn, phonetic, part, synonyms,
      type, image, example, level, source, retentionDays
    } = req.body;

    if (!en || !String(en).trim()) {
      return res.status(400).json({ success: false, message: 'English is required' });
    }
    if (!part || !String(part).trim()) {
      return res.status(400).json({ success: false, message: 'Part is required' });
    }
    if (!source || !String(source).trim()) {
      return res.status(400).json({ success: false, message: 'Source is required' });
    }

    const doc = await Vocabulary.create({
      en: lower(en),
      vn: lower(vn),
      phonetic: lower(phonetic),
      part: upper(part),
      synonyms: lower(synonyms),
      type: lower(type),
      image: lower(image),
      example: capFirst(example),
      level: upper(level),
      source: lower(source),
      scope: 'private',
      ownerId: userId,
      ownerEmail: email,
      expiresAt: new Date(Date.now() + resolveRetentionDays(retentionDays) * DAY_MS),
    });

    res.json({
      success: true,
      message: `Saved "${doc.en}" to source "${doc.source}"`,
      data: doc,
    });
  } catch (err) {
    console.error('uploadVocabulary error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/upload/my-topics - list unique private sources for current user
exports.getMyTopics = async (req, res) => {
  try {
    const userDoc = await User.findById(req.user.id).select('email').lean();
    const email = userDoc?.email;
    const topics = await Vocabulary.aggregate([
      { $match: { scope: 'private', ownerEmail: email } },
      {
        $group: {
          _id: '$source',
          wordCount: { $sum: 1 },
          lastUpload: { $max: '$createdAt' },
        },
      },
      { $sort: { lastUpload: -1 } },
      {
        $project: {
          _id: 0,
          source: '$_id',
          wordCount: 1,
          lastUpload: 1,
        },
      },
    ]);
    res.json({ success: true, data: topics });
  } catch (err) {
    console.error('getMyTopics error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/upload/expiring - private sources expiring within EXPIRY_WARN_DAYS.
// Used to force the user to export before auto-deletion.
exports.getExpiringTopics = async (req, res) => {
  try {
    const userDoc = await User.findById(req.user.id).select('email').lean();
    const email = userDoc?.email;
    const threshold = new Date(Date.now() + EXPIRY_WARN_DAYS * DAY_MS);

    const topics = await Vocabulary.aggregate([
      {
        $match: {
          scope: 'private',
          ownerEmail: email,
          expiresAt: { $ne: null, $lte: threshold },
        },
      },
      {
        $group: {
          _id: '$source',
          wordCount: { $sum: 1 },
          expiresAt: { $min: '$expiresAt' },
        },
      },
      { $sort: { expiresAt: 1 } },
      {
        $project: { _id: 0, source: '$_id', wordCount: 1, expiresAt: 1 },
      },
    ]);

    res.json({ success: true, warnDays: EXPIRY_WARN_DAYS, data: topics });
  } catch (err) {
    console.error('getExpiringTopics error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/upload/my-vocabulary/:source - load words by source for current user
exports.getMyVocabulary = async (req, res) => {
  try {
    const userDoc = await User.findById(req.user.id).select('email').lean();
    const email = userDoc?.email;
    const { source } = req.params;
    const words = await Vocabulary.find({
      scope: 'private',
      ownerEmail: email,
      source,
    }).sort({ createdAt: -1 });
    res.json({ success: true, data: words });
  } catch (err) {
    console.error('getMyVocabulary error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/upload/my-vocabulary/:wordId — delete a single word owned by current user
exports.deleteMyWord = async (req, res) => {
  try {
    const userDoc = await User.findById(req.user.id).select('email').lean();
    const email = userDoc?.email;
    const { wordId } = req.params;

    const word = await Vocabulary.findOne({ _id: wordId, scope: 'private', ownerEmail: email });
    if (!word) return res.status(404).json({ success: false, message: 'Không tìm thấy từ hoặc bạn không có quyền xóa' });

    await word.deleteOne();
    res.json({ success: true, message: `Đã xóa "${word.en}"` });
  } catch (err) {
    console.error('deleteMyWord error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/upload/extend/:source — push expiry of all words in a private
// source forward by DEFAULT_RETENTION_DAYS (renew, no data loss).
exports.extendMySource = async (req, res) => {
  try {
    const userDoc = await User.findById(req.user.id).select('email').lean();
    const email = userDoc?.email;
    const { source } = req.params;

    const newExpiresAt = new Date(Date.now() + DEFAULT_RETENTION_DAYS * DAY_MS);
    const result = await Vocabulary.updateMany(
      { scope: 'private', ownerEmail: email, source },
      { $set: { expiresAt: newExpiresAt } }
    );

    if (!result.matchedCount) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nguồn hoặc bạn không có quyền' });
    }

    res.json({
      success: true,
      message: `Đã gia hạn "${source}" thêm ${DEFAULT_RETENTION_DAYS} ngày`,
      extendedCount: result.modifiedCount,
      expiresAt: newExpiresAt,
      retentionDays: DEFAULT_RETENTION_DAYS,
    });
  } catch (err) {
    console.error('extendMySource error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/upload/my-source/:source — delete all words in a source owned by current user
exports.deleteMySource = async (req, res) => {
  try {
    const userDoc = await User.findById(req.user.id).select('email').lean();
    const email = userDoc?.email;
    const { source } = req.params;

    const result = await Vocabulary.deleteMany({ scope: 'private', ownerEmail: email, source });
    res.json({ success: true, message: `Đã xóa ${result.deletedCount} từ trong "${source}"`, deletedCount: result.deletedCount });
  } catch (err) {
    console.error('deleteMySource error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/upload/monitoring
exports.getMonitoring = async (req, res) => {
  try {
    const uploads = await Vocabulary.aggregate([
      { $match: { scope: 'private' } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: { email: '$ownerEmail', source: '$source' },
          wordCount: { $sum: 1 },
          lastUpload: { $max: '$createdAt' },
          words: { $push: '$en' },
        },
      },
      { $sort: { lastUpload: -1 } },
      { $limit: 100 },
    ]);

    const data = uploads.map(u => ({
      email: u._id.email,
      source: u._id.source,
      wordCount: u.wordCount,
      contentPreview: (u.words || []).slice(0, 5),
      status: 'active',
      createdAt: u.lastUpload,
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('getMonitoring error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/upload/stats
exports.getStats = async (req, res) => {
  try {
    const totalWords = await Vocabulary.countDocuments({ scope: 'private' });
    const totalUsers = await Vocabulary.distinct('ownerEmail', { scope: 'private' }).then(a => a.filter(Boolean).length);
    const totalSources = await Vocabulary.distinct('source', { scope: 'private' }).then(a => a.length);
    res.json({
      success: true,
      data: { totalWords, totalUsers, totalSources },
    });
  } catch (err) {
    console.error('getStats error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
