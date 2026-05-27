// ===================================
// TTS ROUTES - Text-to-Speech (Microsoft Edge Neural Voices)
// ===================================
// Phiên bản STREAM — không ghi cache file mp3 ra disk (trước đây phát sinh
// rác trong public/tts-cache mỗi lần user sai/đúng). Audio được pipe trực
// tiếp về client với Content-Type: audio/mpeg, frontend nhận blob rồi
// URL.createObjectURL → revoke sau khi phát xong.

const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

// TOEIC voice map - 4 accents with natural neural voices
const VOICE_MAP = {
    'en-us': 'en-US-AriaNeural',           // American female
    'en-gb': 'en-GB-SoniaNeural',          // British female
    'en-au': 'en-AU-NatashaNeural',        // Australian female
    'en-ca': 'en-CA-ClaraNeural',          // Canadian female
    // Chinese (Mandarin) neural voices
    'zh-cn-xiaoxiao': 'zh-CN-XiaoxiaoNeural',  // Mainland CN — warm female (most natural)
    'zh-cn-yunxi':    'zh-CN-YunxiNeural',     // Mainland CN — male
    'zh-cn-xiaoyi':   'zh-CN-XiaoyiNeural',    // Mainland CN — young female
    'zh-cn-random':   null,                    // random between 3 CN voices
    'zh-tw':          'zh-TW-HsiaoChenNeural', // Taiwan Mandarin — female
};

/**
 * GET /api/tts?text=hello&lang=en-us&rate=1
 * STREAM audio/mpeg trực tiếp (KHÔNG cache disk).
 */
router.get('/', async (req, res) => {
    try {
        const { text, lang = 'en-us', rate: rawRate = '1' } = req.query;
        if (!text) return res.status(400).json({ error: 'Missing text parameter' });

        const rate = Math.min(2, Math.max(0.5, parseFloat(rawRate) || 1));
        let voiceName;
        if (lang === 'zh-cn-random') {
            const zhVoices = ['zh-CN-XiaoxiaoNeural', 'zh-CN-YunxiNeural', 'zh-CN-XiaoyiNeural'];
            voiceName = zhVoices[Math.floor(Math.random() * zhVoices.length)];
        } else {
            voiceName = VOICE_MAP[lang] || VOICE_MAP['en-us'];
        }

        const tts = new MsEdgeTTS();
        await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

        const { audioStream } = tts.toStream(text, { rate });

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-store');

        audioStream.on('error', (e) => {
            logger.error('TTS stream error:', e);
            if (!res.headersSent) res.status(500).json({ error: 'TTS stream failed' });
            try { tts.close && tts.close(); } catch (_) {}
        });
        audioStream.on('end', () => { try { tts.close && tts.close(); } catch (_) {} });
        res.on('close', () => { try { tts.close && tts.close(); } catch (_) {} });

        audioStream.pipe(res);
    } catch (err) {
        logger.error('TTS error:', err);
        if (!res.headersSent) res.status(500).json({ error: 'TTS generation failed' });
    }
});

module.exports = router;
