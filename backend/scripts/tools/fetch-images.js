/**
 * Tải ảnh từ Pixabay cho từng từ trong vocabulary.json
 * Cách dùng: node scripts/fetch-images.js
 * Tùy chọn: node scripts/fetch-images.js --force   (tải lại kể cả ảnh đã có)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const API_KEY = process.env.PIXABAY_API_KEY;
if (!API_KEY) {
    console.error('Thiếu PIXABAY_API_KEY trong .env');
    process.exit(1);
}

const VOCAB_PATH = path.join(__dirname, '../public/data/vocabulary.json');
const ASSETS_BASE = path.join(__dirname, '../public/assets/pages');
const DELAY_MS = 500;
const FORCE = process.argv.includes('--force');

function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPixabayImage(query) {
    const url = `https://pixabay.com/api/?key=${API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&per_page=3&safesearch=true`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Pixabay API lỗi: ${res.status}`);
    const data = await res.json();
    if (!data.hits || data.hits.length === 0) return null;
    return data.hits[0].webformatURL;
}

async function downloadImage(url, destPath) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download ảnh lỗi: ${res.status}`);
    const buffer = await res.buffer();
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, buffer);
}

async function main() {
    const vocabulary = JSON.parse(fs.readFileSync(VOCAB_PATH, 'utf-8'));
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < vocabulary.length; i++) {
        const entry = vocabulary[i];
        const { en, part } = entry;
        if (!en || !part) continue;

        const slug = slugify(en);
        const relPath = `assets/pages/${part}/${slug}.jpg`;
        const absPath = path.join(__dirname, '../public', relPath);

        // Bỏ qua nếu ảnh đã tồn tại và không có --force
        if (!FORCE && fs.existsSync(absPath)) {
            entry.image = relPath;
            skipped++;
            continue;
        }

        process.stdout.write(`[${i + 1}/${vocabulary.length}] "${en}" ... `);

        try {
            const imageUrl = await fetchPixabayImage(en);
            if (!imageUrl) {
                console.log('không tìm thấy ảnh');
                failed++;
                continue;
            }

            await downloadImage(imageUrl, absPath);
            entry.image = relPath;
            updated++;
            console.log(`OK -> ${relPath}`);
        } catch (err) {
            console.log(`LỖI: ${err.message}`);
            failed++;
        }

        await sleep(DELAY_MS);
    }

    fs.writeFileSync(VOCAB_PATH, JSON.stringify(vocabulary, null, 4), 'utf-8');

    console.log('\n=============================');
    console.log(`Hoàn thành: ${updated} tải mới, ${skipped} bỏ qua (đã có), ${failed} thất bại`);
    console.log(`Đã cập nhật vocabulary.json`);
}

main().catch(err => {
    console.error('Lỗi:', err.message);
    process.exit(1);
});
