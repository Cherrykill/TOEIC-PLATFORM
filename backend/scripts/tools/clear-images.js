const fs = require('fs');
const path = require('path');

const VOCAB_PATH = path.join(__dirname, '../public/data/vocabulary.json');

const vocabulary = JSON.parse(fs.readFileSync(VOCAB_PATH, 'utf-8'));

vocabulary.forEach(entry => {
    entry.image = '';
});

fs.writeFileSync(VOCAB_PATH, JSON.stringify(vocabulary, null, 4), 'utf-8');

console.log(`Đã xóa image của ${vocabulary.length} từ trong vocabulary.json`);
