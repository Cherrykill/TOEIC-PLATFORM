/**
 * Script: Tự động điền phonetic cho 600WORDS.json
 *
 * Strategy:
 * 1. Cross-reference với vocabulary.json, keytoeic.json, ETS2024.json, ETS2023.json
 * 2. Fetch từ Free Dictionary API (dictionaryapi.dev) cho các từ còn thiếu
 * 3. Lưu kết quả vào 600WORDS.json
 *
 * Usage: node scripts/fillPhonetics.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const TARGET_FILE = path.join(DATA_DIR, '600WORDS.json');
const CROSS_REF_FILES = [
    'vocabulary.json',
    'keytoeic.json',
    'ETS2024.json',
    'ETS2023.json',
    'ETS2026.json',
    'e2h9.json',
    'e2xa.json',
    'ets.json',
];

// ===================================
// STEP 1: Build cross-reference map từ các file có sẵn
// ===================================
function buildPhoneticMap() {
    const map = {};
    for (const filename of CROSS_REF_FILES) {
        const filepath = path.join(DATA_DIR, filename);
        if (!fs.existsSync(filepath)) continue;

        try {
            const raw = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
            const arr = Array.isArray(raw) ? raw : (raw.words || raw.vocabulary || []);
            for (const w of arr) {
                const key = w.en?.toLowerCase()?.trim();
                if (key && w.phonetic?.trim() && !map[key]) {
                    map[key] = w.phonetic.trim();
                }
            }
        } catch (e) {
            console.warn(`⚠️  Skipping ${filename}: ${e.message}`);
        }
    }
    console.log(`📚 Built phonetic map from existing files: ${Object.keys(map).length} entries`);
    return map;
}

// ===================================
// STEP 2: Fetch từ Free Dictionary API
// ===================================
function fetchPhonetic(word) {
    return new Promise((resolve) => {
        const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        resolve(null);
                        return;
                    }
                    const json = JSON.parse(data);
                    // Tìm phonetic text đầu tiên có giá trị
                    const entry = json[0];
                    if (!entry) { resolve(null); return; }

                    // Thử phonetics array trước
                    const phoneticObj = entry.phonetics?.find(p => p.text?.trim());
                    if (phoneticObj?.text) {
                        // Strip leading/trailing slashes if any
                        const text = phoneticObj.text.trim().replace(/^\/|\/$/g, '');
                        resolve(text);
                        return;
                    }

                    // Fallback: phonetic field trực tiếp
                    if (entry.phonetic?.trim()) {
                        resolve(entry.phonetic.trim().replace(/^\/|\/$/g, ''));
                        return;
                    }

                    resolve(null);
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

// ===================================
// STEP 3: Sleep helper
// ===================================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ===================================
// MAIN
// ===================================
async function main() {
    console.log('🚀 Starting phonetic fill for 600WORDS.json...\n');

    // Load target file
    const raw = JSON.parse(fs.readFileSync(TARGET_FILE, 'utf-8'));
    const words = Array.isArray(raw) ? raw : [];

    // Build cross-ref map
    const phoneticMap = buildPhoneticMap();

    // Stats
    let filledFromMap = 0;
    let filledFromApi = 0;
    let notFound = 0;
    let apiRequests = 0;

    // Process each word
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const key = word.en?.toLowerCase()?.trim();

        // Skip nếu đã có phonetic
        if (word.phonetic?.trim()) continue;

        // Try cross-reference first
        if (phoneticMap[key]) {
            word.phonetic = phoneticMap[key];
            filledFromMap++;
            continue;
        }

        // Fetch từ API
        apiRequests++;
        if (apiRequests % 20 === 0) {
            process.stdout.write(`\n`);
        }
        process.stdout.write(`[${i + 1}/${words.length}] Fetching: ${word.en}... `);

        const phonetic = await fetchPhonetic(word.en);

        if (phonetic) {
            word.phonetic = phonetic;
            filledFromApi++;
            process.stdout.write(`✅ /${phonetic}/\n`);
        } else {
            notFound++;
            process.stdout.write(`❌ not found\n`);
        }

        // Rate limit: 150ms giữa các request
        await sleep(150);
    }

    // Save
    fs.writeFileSync(TARGET_FILE, JSON.stringify(words, null, 2), 'utf-8');

    console.log('\n' + '='.repeat(50));
    console.log('✅ Done!');
    console.log(`📖 Filled from existing files: ${filledFromMap}`);
    console.log(`🌐 Filled from API:            ${filledFromApi}`);
    console.log(`❌ Not found:                  ${notFound}`);
    console.log(`📝 Total processed:            ${filledFromMap + filledFromApi + notFound}`);
    console.log(`💾 Saved to: ${TARGET_FILE}`);
}

main().catch(console.error);
