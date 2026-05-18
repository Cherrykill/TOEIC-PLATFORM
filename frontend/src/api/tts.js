// ===================================
// TTS API SERVICE
// ===================================
// Server text-to-speech. Returns parsed JSON ({ url, ... }) exactly as
// gameLogic already consumes it. Pure move.

export const TtsAPI = {
    async synthesize(text, lang, rate) {
        const res = await fetch(
            `/api/tts?text=${encodeURIComponent(text)}&lang=${lang}&rate=${rate}`
        );
        return res.json();
    },
};
