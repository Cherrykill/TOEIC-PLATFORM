/**
 * Thêm một key mới vào tất cả object trong file JSON
 * Chỉnh sửa TARGET_FILES và FIELD_VALUE trước khi chạy
 * Usage: node scripts/addFieldToJson.js
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// TUỲ CHỈNH Ở ĐÂY
// ============================================================

const TARGET_FILES = [
    'public/data/ETS2024.json',
    // 'public/data/vocabulary.json',
    // 'public/data/anh-file-khac.json',
];

const FIELD_NAME = 'test';

const FIELD_VALUE = 'ETS2024'; // <-- đổi giá trị này tuỳ ý

// true  = ghi đè nếu key đã tồn tại
// false = bỏ qua những obj đã có key đó
const OVERWRITE = false;

// ============================================================

const ROOT = path.resolve(__dirname, '..');

TARGET_FILES.forEach(relPath => {
    const filePath = path.join(ROOT, relPath);

    if (!fs.existsSync(filePath)) {
        console.warn(`[SKIP] File không tồn tại: ${relPath}`);
        return;
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);

    if (!Array.isArray(data)) {
        console.warn(`[SKIP] Không phải array: ${relPath}`);
        return;
    }

    let changed = 0;
    const updated = data.map(obj => {
        if (!OVERWRITE && Object.prototype.hasOwnProperty.call(obj, FIELD_NAME)) {
            return obj;
        }
        changed++;
        return { ...obj, [FIELD_NAME]: FIELD_VALUE };
    });

    fs.writeFileSync(filePath, JSON.stringify(updated, null, 4), 'utf-8');
    console.log(`[OK] ${relPath} — đã cập nhật ${changed}/${data.length} object`);
});
