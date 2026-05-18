// modules/utils.js — Utility functions

// ===================================
// 2. UTILITY FUNCTIONS
// ===================================

const debounce = (func, delay) => {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
};

/**
 * Truncate string to specified length
 */
function truncate(str, maxLength) {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
}

/**
 * Chuẩn hóa object từ vựng theo 9 keys bắt buộc
 */
function normalizeVocabularyObject(item) {
    const REQUIRED_KEYS = ['en', 'vn', 'phonetic', 'part', 'synonyms', 'type', 'image'];
    const normalized = {};

    for (const key of REQUIRED_KEYS) {
        if (key in item && item[key] !== undefined && item[key] !== '') {
            normalized[key] = item[key];
        } else {
            // Giá trị mặc định cho các keys thiếu
            normalized[key] = null;
        }
    }

    return normalized;
}

/**
 * [PHẦN QUÉT DỮ LIỆU ĐỘNG]
 * Lấy danh sách duy nhất các Part có trong database/file vocabulary.json.
 * Yêu cầu API backend phải có endpoint /api/vocabulary/parts trả về mảng chuỗi ['N', 'V', 'ADJ', 'E2XA-P1', ...].
 */
async function fetchUniqueVocabParts() {
    try {
        // Gọi API để quét toàn bộ data và chỉ trả về danh sách các Part duy nhất
        const res = await fetch(`${API_URL}/vocabulary/parts`);
        const data = await res.json();

        if (data.success && Array.isArray(data.data)) {
            return data.data.sort((a, b) => a.localeCompare(b));
        }
    } catch (error) {
        console.error("Lỗi khi quét danh sách Parts duy nhất từ API:", error);
    }
    // Fallback: Trả về một danh sách Parts tiêu chuẩn nếu API bị lỗi.
    return ['N', 'V', 'ADJ', 'ADV', 'PHR', 'OTHERS', 'E2XA-P1', 'E2XA-P2'];
}

// Hàm xử lý sự kiện change cho Filter Part
function handleVocabFilterChange(e) {
    const newPart = e.target.value;
    vocabCurrentPart = newPart;

    console.log(`🏷️ Part filter changed: "${newPart}", localData=${localVocabularyData.length}`);

    // Use local filter if we have local data loaded
    if (localVocabularyData && localVocabularyData.length > 0) {
        console.log(`📋 Using LOCAL filter`);
        displayLocalVocabulary();
    } else {
        console.log(`🌐 Using API filter`);
        // Reset về trang 1 và gọi hàm loadVocabulary để thực hiện LỌC
        loadVocabulary(1, newPart);
    }
}
