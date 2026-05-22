const multer = require('multer');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

// ===================================
// IMAGE UPLOAD CONFIGURATION
// ===================================

const imageStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Extract test type from filename (e.g., e2e9p1_1.jpg -> e2e9)
        const match = file.originalname.match(/^([a-z0-9]+)p\d+/i);
        const testType = match ? match[1] : 'other';

        const destPath = `public/assets/images/${testType}/`;

        // Create directory if it doesn't exist
        if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
        }

        cb(null, destPath);
    },
    filename: function (req, file, cb) {
        // Keep original filename - no timestamp prefix
        cb(null, file.originalname);
    }
});

const imageFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
};

const uploadImage = multer({
    storage: imageStorage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
    },
    fileFilter: imageFilter,
});

// ===================================
// AUDIO UPLOAD CONFIGURATION
// ===================================

const audioStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Extract test type from filename (e.g., e2e9p1_1.mp3 -> e2e9)
        const match = file.originalname.match(/^([a-z0-9]+)p\d+/i);
        const testType = match ? match[1] : 'other';

        const destPath = `public/assets/audio/${testType}/`;

        // Create directory if it doesn't exist
        if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
        }

        cb(null, destPath);
    },
    filename: function (req, file, cb) {
        // Keep original filename - no timestamp prefix
        cb(null, file.originalname);
    }
});

const audioFilter = (req, file, cb) => {
    const allowedExtensions = /mp3|wav|ogg|m4a|aac/;
    const allowedMimeTypes = /audio\/(mpeg|mp3|wav|ogg|m4a|aac|x-m4a|x-wav)/;

    const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimeTypes.test(file.mimetype);

    logger.debug('🎵 Audio upload attempt:', {
        filename: file.originalname,
        mimetype: file.mimetype,
        extension: path.extname(file.originalname),
        extensionValid: extname,
        mimetypeValid: mimetype
    });

    // Accept if EITHER extension OR mimetype is valid (some browsers report wrong MIME types)
    if (mimetype || extname) {
        return cb(null, true);
    } else {
        cb(new Error(`Invalid audio file. File: ${file.originalname}, Type: ${file.mimetype}`));
    }
};

const uploadAudio = multer({
    storage: audioStorage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max for audio
    },
    fileFilter: audioFilter,
});

// ===================================
// AVATAR UPLOAD CONFIGURATION
// ===================================

const avatarDir = path.join(__dirname, '../public/uploads/avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarDir),
    filename: (req, file, cb) => {
        // Dùng userId làm tên file → tự động ghi đè khi update
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, `${req.user.id}${ext}`);
    },
});

const avatarFilter = (req, file, cb) => {
    if (/image\/(jpeg|jpg|png|gif|webp)/.test(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ hỗ trợ file ảnh (jpeg, png, gif, webp)'));
    }
};

const uploadAvatar = multer({
    storage: avatarStorage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
    fileFilter: avatarFilter,
});

module.exports = {
    uploadImage,
    uploadAudio,
    uploadAvatar,
};
