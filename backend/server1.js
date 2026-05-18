const pLimit = require('p-limit');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const IMAGE_DIR = './public/images/pages/';

// 🆕 BIẾN KHAI BÁO TÊN FILE JSON 
const VOCABULARY_FILE_NAME = '600WORDS.json';
const CACHE_FILE_NAME = 'cache.json';
const DATA_DIR = './public/data/';

// Định nghĩa đường dẫn đầy đủ
const VOCABULARY_FILE_PATH = path.join(DATA_DIR, VOCABULARY_FILE_NAME);
const CACHE_FILE_PATH = path.join(DATA_DIR, CACHE_FILE_NAME);

// Giới hạn concurrency để giảm tải API
const limit = pLimit(2);

// ===================================
// CHUẨN HÓA: 11 KEYS BẮT BUỘC
// ===================================
const REQUIRED_KEYS = ['en', 'vn', 'phonetic', 'part', 'synonyms', 'synonyms_vn', 'type', 'image', 'example', 'level'];

// Cache
const cache = {
    phonetics: new Map(),
    synonyms: new Map(),
    synonyms_vn: new Map(),
    partsOfSpeech: new Map(),
    examples: new Map(),
    levels: new Map(),
};

// Đọc cache
try {
    // ⬇️ Sử dụng biến CACHE_FILE_PATH
    const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf-8'));
    cache.phonetics = new Map(cacheData.phonetics || []);
    cache.synonyms = new Map(cacheData.synonyms || []);
    cache.synonyms_vn = new Map(cacheData.synonyms_vn || []);
    cache.partsOfSpeech = new Map(cacheData.partsOfSpeech || []);
    cache.examples = new Map(cacheData.examples || []);
    cache.levels = new Map(cacheData.levels || []);
    console.log('✅ Đã tải cache từ file');
} catch (err) {
    console.log('⚠️  Không tìm thấy cache, tạo mới');
}

// Lưu cache
function saveCache() {
    const cacheData = {
        phonetics: Array.from(cache.phonetics.entries()),
        synonyms: Array.from(cache.synonyms.entries()),
        synonyms_vn: Array.from(cache.synonyms_vn.entries()),
        partsOfSpeech: Array.from(cache.partsOfSpeech.entries()),
        examples: Array.from(cache.examples.entries()),
        levels: Array.from(cache.levels.entries()),
    };
    // ⬇️ Sử dụng biến CACHE_FILE_PATH
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2), 'utf-8');
    console.log('💾 Cache đã được lưu');
}

// Theo dõi token
let totalOpenAITokens = 0;
let consecutive429Errors = 0;

// Đọc dữ liệu từ vocabulary.json
let data;
try {
    // ⬇️ Sử dụng biến VOCABULARY_FILE_PATH
    data = JSON.parse(fs.readFileSync(VOCABULARY_FILE_PATH, 'utf-8'));
    console.log(`📖 Đã đọc ${data.length} records từ ${VOCABULARY_FILE_NAME}`);
} catch (err) {
    console.error('❌ Không đọc được file:', err.message);
    process.exit(1);
}

// Hàm fetch với retry
async function apiFetch(url, options, retries = 8) {
    for (let i = 0; i <= retries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.status === 429) {
                consecutive429Errors++;
                if (consecutive429Errors >= 3) {
                    console.warn('⏸️  Quá nhiều lỗi 429, tạm dừng 2 phút...');
                    await new Promise(r => setTimeout(r, 120000));
                    consecutive429Errors = 0;
                }
                const delay = Math.pow(2, i) * 1000;
                console.warn(`⚠️  Lỗi 429, thử lại sau ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            consecutive429Errors = 0;
            return await res.json();
        } catch (err) {
            if (i === retries) throw err;
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
    }
}

// Hàm gọi OpenAI với gpt-4o-mini
async function callOpenAI(prompt, systemMessage, maxTokens = 200, temperature = 0.5) {
    try {
        const res = await apiFetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'system', content: systemMessage }, { role: 'user', content: prompt }],
                max_tokens: maxTokens,
                temperature,
            }),
        });
        if (res?.usage?.total_tokens) {
            totalOpenAITokens += res.usage.total_tokens;
        }
        return res.choices?.[0]?.message?.content?.trim() || '';
    } catch (err) {
        console.error(`❌ Lỗi OpenAI: ${err.message}`);
        return '';
    } finally {
        await new Promise(r => setTimeout(r, 5000));
    }
}

// Lấy từ đồng nghĩa
async function getSynonymsWithGPT(word, index) {
    if (cache.synonyms.has(word) && cache.synonyms.get(word)) {
        return cache.synonyms.get(word);
    }
    console.log(`🔍 [${index + 1}] Lấy từ đồng nghĩa cho "${word}"...`);
    const synonyms = await callOpenAI(
        `List 4-5 common synonyms for the word "${word}".`,
        'You are a language expert. Provide 4-5 common synonyms separated by commas, no explanation.',
        100,
        0.5
    );
    const result = synonyms ? synonyms.split(',').map(s => s.trim()).filter(Boolean).join(', ') : null;
    if (result) {
        console.log(`✅ [${index + 1}] Synonyms: ${result}`);
        cache.synonyms.set(word, result);
    } else {
        console.warn(`⚠️  [${index + 1}] Không tìm thấy synonyms`);
        cache.synonyms.set(word, null);
    }
    return result;
}

// Dịch từ đồng nghĩa sang tiếng Việt
async function translateSynonymsToVn(synonyms, word, index) {
    if (!synonyms) return null;
    if (cache.synonyms_vn.has(word) && cache.synonyms_vn.get(word)) {
        return cache.synonyms_vn.get(word);
    }
    console.log(`🇻🇳 [${index + 1}] Dịch đồng nghĩa cho "${word}"...`);
    const translated = await callOpenAI(
        `Translate these English synonyms to Vietnamese, keep the same comma-separated format: "${synonyms}"`,
        'You are a translator. Translate the given English words/phrases to Vietnamese separated by commas. No explanation.',
        100,
        0.3
    );
    const result = translated ? translated.trim() : null;
    if (result) {
        console.log(`✅ [${index + 1}] Synonyms VN: ${result}`);
        cache.synonyms_vn.set(word, result);
    } else {
        console.warn(`⚠️  [${index + 1}] Không dịch được synonyms`);
        cache.synonyms_vn.set(word, null);
    }
    return result;
}

// Lấy phiên âm từ GPT
async function fetchPhoneticWithGPT(word, index) {
    if (cache.phonetics.has(word) && cache.phonetics.get(word)) {
        return cache.phonetics.get(word);
    }
    console.log(`🔊 [${index + 1}] Lấy phiên âm cho "${word}"...`);
    const rawText = await callOpenAI(
        `What is the IPA phonetic transcription for "${word}"?`,
        'You are a phonetics expert. Provide only the IPA transcription in format /.../ or just the symbols.',
        50,
        0.1
    );
    const match = rawText ? rawText.match(/\/([^/]+)\//) : null;
    const phonetic = match ? match[1] : (rawText || null);

    if (phonetic) {
        console.log(`✅ [${index + 1}] Phonetic: ${phonetic}`);
        cache.phonetics.set(word, phonetic);
    } else {
        console.warn(`⚠️  [${index + 1}] Không tìm thấy phiên âm`);
        cache.phonetics.set(word, null);
    }
    return phonetic;
}

// Lấy loại từ từ GPT
async function fetchPartOfSpeechWithGPT(word, index) {
    if (cache.partsOfSpeech.has(word) && cache.partsOfSpeech.get(word)) {
        return cache.partsOfSpeech.get(word);
    }
    console.log(`📝 [${index + 1}] Lấy loại từ cho "${word}"...`);

    const prompt = `"${word}"

Choose the MOST COMMON part of speech. Reply with EXACTLY ONE word from this list:
noun
verb
adjective
adverb
preposition
conjunction
interjection
pronoun
determiner

Reply with ONE WORD ONLY. No punctuation. No explanation. No additional text.`;

    const rawText = await callOpenAI(
        prompt,
        'Reply with exactly one word: the part of speech. Nothing else.',
        15,
        0.0
    );

    // Xử lý response: lấy từ đầu tiên, loại bỏ tất cả ký tự không phải chữ
    let type = rawText ? rawText.toLowerCase().trim() : null;

    // Loại bỏ dấu câu và ký tự đặc biệt
    type = type ? type.replace(/[^a-z\s]/g, '').trim() : null;

    // Nếu có nhiều từ, lấy từ đầu tiên
    if (type && type.includes(' ')) {
        type = type.split(/\s+/)[0];
    }
    const validTypes = ['noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'interjection', 'pronoun', 'determiner'];

    if (type && validTypes.includes(type)) {
        console.log(`✅ [${index + 1}] Type: ${type}`);
        cache.partsOfSpeech.set(word, type);
        return type;
    } else {
        console.warn(`⚠️  [${index + 1}] Loại từ không chuẩn: "${rawText}" → "${type}"`);
        cache.partsOfSpeech.set(word, null);
    }
    return null;
}

// Lấy cấp độ từ vựng (A1-C2) từ GPT
async function fetchLevelWithGPT(word, index) {
    if (cache.levels.has(word) && cache.levels.get(word)) {
        return cache.levels.get(word);
    }
    console.log(`⭐ [${index + 1}] Lấy cấp độ CEFR cho "${word}"...`);

    const prompt = `"${word}"

Choose the MOST APPROPRIATE CEFR level for this word's COMMON usage:
A1
A2
B1
B2
C1
C2

Reply with EXACTLY ONE level from the list. No punctuation. No explanation. No additional text.`;

    const rawText = await callOpenAI(
        prompt,
        'Reply with exactly one CEFR level (A1, A2, B1, B2, C1, C2). Nothing else.',
        15,
        0.0
    );

    // Xử lý response
    let level = rawText ? rawText.toUpperCase().trim() : null;

    // Loại bỏ ký tự không phải chữ/số và lấy từ đầu tiên
    level = level ? level.replace(/[^A-Z0-9\s]/g, '').trim() : null;
    if (level && level.includes(' ')) {
        level = level.split(/\s+/)[0];
    }
    const validLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

    if (level && validLevels.includes(level)) {
        console.log(`✅ [${index + 1}] Level: ${level}`);
        cache.levels.set(word, level);
        return level;
    } else {
        console.warn(`⚠️  [${index + 1}] Cấp độ không chuẩn: "${rawText}" → "${level}"`);
        cache.levels.set(word, null);
    }
    return null;
}

// Lấy ví dụ câu từ GPT
async function fetchExampleWithGPT(word, index) {
    if (cache.examples.has(word) && cache.examples.get(word)) {
        return cache.examples.get(word);
    }
    console.log(`📝 [${index + 1}] Lấy ví dụ cho "${word}"...`);

    const prompt = `Create a SHORT, natural example sentence using the word "${word}" that is suitable for TOEIC English learners.

Requirements:
- VERY SHORT: 5-8 words maximum
- Use simple, practical business/everyday English
- Common TOEIC contexts: work, office, travel, daily life
- Clear and direct meaning

Reply with ONLY the example sentence. No quotes. No explanation.`;

    const example = await callOpenAI(
        prompt,
        'You are a TOEIC English teacher. Provide one very short, practical example sentence.',
        40,
        0.5
    );

    // Làm sạch kết quả
    let cleanExample = example ? example.trim() : null;

    // Loại bỏ dấu ngoặc kép nếu có
    if (cleanExample && (cleanExample.startsWith('"') || cleanExample.startsWith("'"))) {
        cleanExample = cleanExample.replace(/^["']|["']$/g, '');
    }

    if (cleanExample && cleanExample.length > 3) {
        console.log(`✅ [${index + 1}] Example: ${cleanExample}`);
        cache.examples.set(word, cleanExample);
        return cleanExample;
    } else {
        console.warn(`⚠️  [${index + 1}] Không tạo được ví dụ`);
        cache.examples.set(word, null);
        return null;
    }
}

// Tải ảnh
async function downloadImage(url, filepath) {
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`failed to fetch ${url}: ${response.statusText}`);
    }
    const buffer = await response.buffer();
    fs.writeFileSync(filepath, buffer);
}

// Lấy ảnh từ Pixabay
async function fetchImage(query, index, part) {
    const partSegment = part ? part.trim() : 'default';
    const safeFileName = `${query.replace(/[^a-z0-9]/gi, '_')}`.toLowerCase();
    const localDir = path.join(IMAGE_DIR, partSegment);
    const localPath = path.join(localDir, `${safeFileName}.jpg`);
    // Express serve ./public/ làm root → /images/pages/ETS24T01-LC/word.jpg
    const publicPath = `images/pages/${partSegment}/${safeFileName}.jpg`;

    // Kiểm tra file đã tồn tại chưa
    if (fs.existsSync(localPath)) {
        console.log(`✅ [${index + 1}] Ảnh đã tồn tại: ${publicPath}`);
        return publicPath;
    }

    console.log(`🖼️  [${index + 1}] Lấy ảnh cho "${query}"...`);
    const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&per_page=3`;

    try {
        const json = await apiFetch(url, {});
        const imageURL = json.hits?.[0]?.webformatURL || null;

        if (imageURL) {
            await downloadImage(imageURL, localPath);
            console.log(`✅ [${index + 1}] Image saved: ${publicPath}`);
            return publicPath;
        } else {
            console.warn(`⚠️  [${index + 1}] Không tìm thấy ảnh`);
            return null;
        }
    } catch (err) {
        console.error(`❌ [${index + 1}] Lỗi tải ảnh: ${err.message}`);
        return null;
    }
}

// Chuẩn hóa object theo keys bắt buộc
function normalizeObject(item) {
    const normalized = {};

    // Thứ tự keys chuẩn
    for (const key of REQUIRED_KEYS) {
        if (key in item && item[key] !== undefined && item[key] !== '') {
            normalized[key] = item[key];
        } else {
            normalized[key] = null; // Placeholder cho keys thiếu
        }
    }

    return normalized;
}

// Chuyển en sang chữ thường
function convertEnToLowercase(data) {
    let convertedCount = 0;
    for (const item of data) {
        if (item.en && typeof item.en === 'string') {
            const originalEn = item.en;
            item.en = item.en.toLowerCase();
            if (originalEn !== item.en) {
                convertedCount++;
            }
        }
    }
    return convertedCount;
}

// ==================== MAIN ====================
async function main() {
    console.log('\n🚀 BẮT ĐẦU CHUẨN HÓA JSON FILES\n');
    console.log(`📋 ${REQUIRED_KEYS.length} Keys bắt buộc: ${REQUIRED_KEYS.join(', ')}\n`);

    // Bước 1: Xóa fields không cần thiết và chuẩn hóa cấu trúc
    console.log('🧹 Bước 1: Xóa fields thừa và chuẩn hóa...');
    for (const item of data) {
        // Xóa các fields không thuộc keys chuẩn
        const validKeys = [...REQUIRED_KEYS];
        for (const key of Object.keys(item)) {
            if (!validKeys.includes(key)) {
                delete item[key];
            }
        }
    }

    const lowered = convertEnToLowercase(data);
    console.log(`✅ Đã chuyển ${lowered} từ sang chữ thường\n`);

    // Bước 2: Kiểm tra và bổ sung dữ liệu còn thiếu
    console.log('🔧 Bước 2: Bổ sung dữ liệu còn thiếu...\n');

    const tasks = data.map((item, index) => limit(async () => {
        try {
            // Bắt buộc phải có en và vn
            if (!item.en || !item.vn) {
                console.warn(`⚠️  [${index + 1}] Thiếu en hoặc vn, bỏ qua`);
                return;
            }

            // Phonetic
            if (!item.phonetic) {
                item.phonetic = await fetchPhoneticWithGPT(item.en, index);
            }

            // Synonyms
            if (!item.synonyms) {
                item.synonyms = await getSynonymsWithGPT(item.en, index);
            }

            // Synonyms VN (dịch từ synonyms)
            if (!item.synonyms_vn && item.synonyms) {
                item.synonyms_vn = await translateSynonymsToVn(item.synonyms, item.en, index);
            }

            // Type
            if (!item.type) {
                item.type = await fetchPartOfSpeechWithGPT(item.en, index);
            }

            // Example (bổ sung ví dụ câu nếu thiếu)
            if (!item.example) {
                item.example = await fetchExampleWithGPT(item.en, index);
            }

            // Level (bổ sung cấp độ CEFR nếu thiếu)
            if (!item.level) {
                item.level = await fetchLevelWithGPT(item.en, index);
            }

            // Image (chỉ fetch nếu thiếu và có PIXABAY_API_KEY)
            if (!item.image && PIXABAY_API_KEY) {
                item.image = await fetchImage(item.en, index, item.part);
            }

        } catch (err) {
            console.error(`❌ [${index + 1}] Lỗi xử lý: ${err.message}`);
        }
    }));

    await Promise.all(tasks);

    // Bước 3: Chuẩn hóa lại toàn bộ theo thứ tự keys
    console.log('\n📐 Bước 3: Chuẩn hóa thứ tự keys...');
    const normalizedData = data.map(item => normalizeObject(item));

    // Bước 4: Lưu file
    // ⬇️ Sử dụng biến VOCABULARY_FILE_PATH
    fs.writeFileSync(VOCABULARY_FILE_PATH, JSON.stringify(normalizedData, null, 2), 'utf-8');
    console.log(`✅ Đã lưu file chuẩn hóa: ${VOCABULARY_FILE_PATH}`);

    saveCache();

    // Thống kê
    console.log('\n📊 THỐNG KÊ:');
    console.log(`   Total records: ${normalizedData.length}`);
    console.log(`   OpenAI tokens used: ${totalOpenAITokens}`);

    const missingData = {
        phonetic: 0,
        synonyms: 0,
        synonyms_vn: 0,
        type: 0,
        example: 0,
        image: 0,
        level: 0,
    };

    for (const item of normalizedData) {
        if (!item.phonetic) missingData.phonetic++;
        if (!item.synonyms) missingData.synonyms++;
        if (!item.synonyms_vn) missingData.synonyms_vn++;
        if (!item.type) missingData.type++;
        if (!item.example) missingData.example++;
        if (!item.image) missingData.image++;
        if (!item.level) missingData.level++;
    }

    console.log('\n   Missing data:');
    for (const [key, count] of Object.entries(missingData)) {
        if (count > 0) {
            console.log(`     - ${key}: ${count} records`);
        }
    }

    console.log(`\n✅ HOÀN THÀNH! File JSON đã được chuẩn hóa với ${REQUIRED_KEYS.length} keys.\n`);

    process.exit(0);
}

main().catch(err => {
    console.error('❌ Lỗi chính:', err.message);
    process.exit(1);
});