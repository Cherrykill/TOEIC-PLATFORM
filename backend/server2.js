/**
 * server2.js - Chuan hoa filetam.json
 *
 * Chuc nang:
 *   1. Xoa cac key khong can: paragraph, paragraph_vi, audio, tip
 *   2. Bo sung cac key thieu theo chuan vocabulary.json
 *   3. Dung OpenAI API dien gia tri cho cac key rong
 *
 * Cach chay:
 *   node server2.js                (chay that, ghi file)
 *   node server2.js --dry-run      (chi xem, khong ghi)
 *   node server2.js myfile.json    (xu ly file khac thay vi filetam.json)
 */

require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const { OpenAI } = require('openai');

// ===================================
// CONFIG
// ===================================
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const customFile = args.find(a => a.endsWith('.json'));

const DATA_FILE = customFile
    ? path.resolve(customFile)
    : path.resolve(__dirname, 'filetam.json');
const BACKUP_FILE = `${DATA_FILE}.backup.${Date.now()}.json`;

const BATCH_SIZE = 5;
const DELAY_MS = 1500;

// ===================================
// THAY DOI GIA TRI NAY TRUOC KHI CHAY
// ===================================
const SOURCE = 'ets2024'; // ets2024 | ets2026 | ets2023 | 600words | keytoeic | ...

// Thứ tự key chuẩn — khớp với Vocabulary model
const STANDARD_KEYS = ['en', 'vn', 'phonetic', 'part', 'synonyms', 'type', 'image', 'example', 'level', 'source'];

// Key AI co the dien
const AI_FILLABLE = ['vn', 'phonetic', 'synonyms', 'type', 'example', 'level'];

// Key can xoa (khong thuoc chuan)
const KEYS_TO_REMOVE = ['paragraph', 'paragraph_vi', 'audio', 'tip', 'zh', 'pinyin', 'synonyms_vn'];

// ===================================
// OPENAI
// ===================================
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const AI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Goi AI dien thong tin cho 1 batch tu
 */
async function fillBatchWithAI(words) {
    const wordsInfo = words.map((w, i) => {
        const gaps = w.gaps;
        return `${i + 1}. "${w.en}" (co san: vn="${w.vn || ''}", type="${w.type || ''}") → CAN DIEN: [${gaps.join(', ')}]`;
    }).join('\n');

    const prompt = `Fill missing vocabulary information for these English words.

Words:
${wordsInfo}

Return ONLY valid JSON array. Each item has index (1-based) and ONLY the missing fields:
[
  {
    "index": 1,
    "vn": "Vietnamese translation",
    "zh": "Simplified Chinese",
    "phonetic": "IPA (e.g., /əˈkaʊnt/)",
    "pinyin": "Chinese pinyin with tones",
    "synonyms": "3-5 comma-separated",
    "type": "noun|verb|adjective|adverb|preposition|conjunction|pronoun|interjection|phrase",
    "example": "One practical sentence",
    "level": "A1|A2|B1|B2|C1|C2"
  }
]

Rules:
- ONLY include fields listed in CAN DIEN for each word
- Do NOT override existing vn/type values
- type: noun, verb, adjective, adverb, preposition, conjunction, pronoun, interjection, phrase
- level: A1, A2, B1, B2, C1, C2
- Return ONLY JSON array, no markdown`;

    try {
        const response = await openai.chat.completions.create({
            model: AI_MODEL,
            messages: [
                { role: 'system', content: 'You are a multilingual dictionary. Return ONLY valid JSON arrays.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 2000,
            temperature: 0.2,
        });

        const usage = response.usage;
        console.log(`   Tokens: ${usage.prompt_tokens}+${usage.completion_tokens}=${usage.total_tokens}`);

        let content = response.choices[0].message.content.trim();
        if (content.startsWith('```json')) content = content.slice(7);
        if (content.startsWith('```')) content = content.slice(3);
        if (content.endsWith('```')) content = content.slice(0, -3);

        return JSON.parse(content.trim());
    } catch (error) {
        console.error(`   ❌ AI Error: ${error.message}`);
        return null;
    }
}

// ===================================
// MAIN
// ===================================
async function main() {
    console.log('='.repeat(60));
    console.log('🔧 SERVER2 - CHUAN HOA FILE JSON');
    console.log('='.repeat(60));
    console.log(`File: ${path.basename(DATA_FILE)}`);
    console.log(`Model: ${AI_MODEL}`);
    console.log(`Standard keys: ${STANDARD_KEYS.join(', ')}`);
    if (DRY_RUN) console.log('⚠️  DRY RUN - khong ghi file');
    console.log('='.repeat(60));

    // 1. Doc file
    if (!(await fs.pathExists(DATA_FILE))) {
        console.error(`❌ Khong tim thay: ${DATA_FILE}`);
        return;
    }

    const data = await fs.readJson(DATA_FILE);
    if (!Array.isArray(data)) {
        console.error('❌ File khong phai mang JSON!');
        return;
    }
    console.log(`\n📄 Doc ${data.length} tu tu ${path.basename(DATA_FILE)}`);

    // ==============================
    // BUOC 1: Xoa key khong can
    // ==============================
    let removedCount = 0;
    for (const entry of data) {
        for (const key of KEYS_TO_REMOVE) {
            if (key in entry) {
                delete entry[key];
                removedCount++;
            }
        }
    }
    console.log(`\n🗑️  BUOC 1: Xoa key khong can (${KEYS_TO_REMOVE.join(', ')})`);
    console.log(`   Da xoa ${removedCount} key`);

    // ==============================
    // BUOC 2: Them key thieu (gia tri "")
    // ==============================
    let addedKeys = 0;
    for (const entry of data) {
        for (const key of STANDARD_KEYS) {
            if (!(key in entry) || entry[key] === undefined || entry[key] === null) {
                entry[key] = key === 'source' ? SOURCE : '';
                addedKeys++;
            }
        }
        // Always overwrite source with configured SOURCE value
        entry.source = SOURCE;
    }
    console.log(`\n📝 BUOC 2: Them key thieu (source="${SOURCE}")`);
    console.log(`   Da them ${addedKeys} key voi gia tri ""`);

    // ==============================
    // BUOC 3: AI dien gia tri cho key rong
    // ==============================
    // Tim cac entry co key rong ma AI co the dien
    const needsAI = [];
    for (let i = 0; i < data.length; i++) {
        const entry = data[i];
        if (!entry.en) continue; // Phai co tu tieng Anh

        const gaps = [];
        for (const key of AI_FILLABLE) {
            if (entry[key] === '' || entry[key] === undefined || entry[key] === null) {
                gaps.push(key);
            }
        }
        if (gaps.length > 0) {
            needsAI.push({ index: i, en: entry.en, vn: entry.vn, type: entry.type, gaps });
        }
    }

    console.log(`\n🤖 BUOC 3: AI dien gia tri`);
    console.log(`   ${needsAI.length}/${data.length} tu can AI dien`);

    if (DRY_RUN) {
        // Chi hien thi 10 tu dau
        for (const item of needsAI.slice(0, 10)) {
            console.log(`   "${item.en}" → can: [${item.gaps.join(', ')}]`);
        }
        if (needsAI.length > 10) console.log(`   ... va ${needsAI.length - 10} tu khac`);
        console.log(`\n⚠️  DRY RUN - khong ghi file. Bo --dry-run de chay that.`);
        return;
    }

    let totalAIFilled = 0;

    if (needsAI.length > 0) {
        const totalBatches = Math.ceil(needsAI.length / BATCH_SIZE);
        console.log(`   Chia thanh ${totalBatches} batch (${BATCH_SIZE} tu/batch)\n`);

        for (let b = 0; b < needsAI.length; b += BATCH_SIZE) {
            const batch = needsAI.slice(b, b + BATCH_SIZE);
            const batchNum = Math.floor(b / BATCH_SIZE) + 1;

            const wordNames = batch.map(w => w.en).join(', ');
            process.stdout.write(`   [${batchNum}/${totalBatches}] ${wordNames} ... `);

            const aiResults = await fillBatchWithAI(batch);

            if (aiResults && Array.isArray(aiResults)) {
                for (const result of aiResults) {
                    const idx = result.index - 1; // AI tra ve 1-based
                    if (idx >= 0 && idx < batch.length) {
                        const dataIdx = batch[idx].index;
                        const gaps = batch[idx].gaps;

                        for (const key of gaps) {
                            if (result[key] && result[key] !== '') {
                                data[dataIdx][key] = result[key];
                                totalAIFilled++;
                            }
                        }
                    }
                }
                console.log('✅');
            } else {
                console.log('⚠️ AI that bai, giu ""');
            }

            if (b + BATCH_SIZE < needsAI.length) {
                await sleep(DELAY_MS);
            }
        }
    }

    console.log(`\n   AI da dien ${totalAIFilled} gia tri`);

    // ==============================
    // BUOC 4: Sap xep key theo thu tu chuan
    // ==============================
    const normalized = data.map(entry => {
        const ordered = {};
        for (const key of STANDARD_KEYS) {
            ordered[key] = entry[key] !== undefined ? entry[key] : '';
        }
        // Giu key ngoai chuan neu co
        for (const key of Object.keys(entry)) {
            if (!STANDARD_KEYS.includes(key)) {
                ordered[key] = entry[key];
            }
        }
        return ordered;
    });

    // ==============================
    // BUOC 5: Backup + Ghi file
    // ==============================
    await fs.copy(DATA_FILE, BACKUP_FILE);
    console.log(`\n💾 Backup: ${path.basename(BACKUP_FILE)}`);

    await fs.writeJson(DATA_FILE, normalized, { spaces: 2 });

    // ==============================
    // TONG KET
    // ==============================
    console.log('\n' + '='.repeat(60));
    console.log('✅ HOAN TAT');
    console.log('='.repeat(60));
    console.log(`📄 File: ${path.basename(DATA_FILE)}`);
    console.log(`📊 Tong: ${normalized.length} tu`);
    console.log(`🗑️  Key da xoa: ${removedCount}`);
    console.log(`📝 Key da them: ${addedKeys}`);
    console.log(`🤖 Gia tri AI dien: ${totalAIFilled}`);
    console.log(`💾 Backup: ${path.basename(BACKUP_FILE)}`);
    console.log('='.repeat(60));
}

main().catch(err => {
    console.error('❌ Fatal:', err);
    process.exit(1);
});

