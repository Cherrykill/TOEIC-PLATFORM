// ===================================
// TTS ROUTES - Text-to-Speech (Microsoft Edge Neural Voices)
// ===================================

const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const path = require('path');
const fs = require('fs');

// Cache directory for TTS audio files
const TTS_CACHE_DIR = path.join(__dirname, '..', 'public', 'tts-cache');
if (!fs.existsSync(TTS_CACHE_DIR)) {
    fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });
}

// TOEIC voice map - 4 accents with natural neural voices
const VOICE_MAP = {
    'en-us': 'en-US-AriaNeural',       // American female
    'en-gb': 'en-GB-SoniaNeural',      // British female
    'en-au': 'en-AU-NatashaNeural',    // Australian female
    'en-ca': 'en-CA-ClaraNeural',      // Canadian female
};

/**
 * GET /api/tts?text=hello&lang=en-us
 * Returns audio file URL using Microsoft Edge Neural TTS
 */
router.get('/', async (req, res) => {
    try {
        const { text, lang = 'en-us', rate: rawRate = '1' } = req.query;

        if (!text) {
            return res.status(400).json({ error: 'Missing text parameter' });
        }

        // Speech rate: clamp 0.5x–2x. SSML accepts a relative number.
        const rate = Math.min(2, Math.max(0.5, parseFloat(rawRate) || 1));

        // Create cache key from text + lang + rate (different speeds = different files)
        const cacheKey = Buffer.from(`${lang}_${rate}_${text}`).toString('base64url').substring(0, 60);
        const fileName = `${cacheKey}.mp3`;
        const filePath = path.join(TTS_CACHE_DIR, fileName);

        // Return cached file if exists
        if (fs.existsSync(path.join(filePath, 'audio.mp3'))) {
            return res.json({ url: `/tts-cache/${fileName}/audio.mp3` });
        }

        // Select voice
        const voiceName = VOICE_MAP[lang] || VOICE_MAP['en-us'];

        // Generate audio
        const tts = new MsEdgeTTS();
        await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

        // Create cache subdir
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(filePath, { recursive: true });
        }

        await tts.toFile(filePath, text, { rate });

        res.json({ url: `/tts-cache/${fileName}/audio.mp3` });
    } catch (err) {
        logger.error('TTS error:', err);
        res.status(500).json({ error: 'TTS generation failed' });
    }
});

// Cleanup old cache files periodically (older than 1 hour)
setInterval(() => {
    try {
        if (!fs.existsSync(TTS_CACHE_DIR)) return;
        const dirs = fs.readdirSync(TTS_CACHE_DIR);
        const now = Date.now();
        dirs.forEach(dir => {
            const dirPath = path.join(TTS_CACHE_DIR, dir);
            const stat = fs.statSync(dirPath);
            if (now - stat.mtimeMs > 3600000) {
                fs.rmSync(dirPath, { recursive: true, force: true });
            }
        });
    } catch (e) { /* ignore cleanup errors */ }
}, 1800000); // Every 30 min

module.exports = router;
