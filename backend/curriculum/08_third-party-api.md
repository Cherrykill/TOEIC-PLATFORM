# Module 8: Third-Party APIs — OpenAI, Email, và TTS

---

## Mục tiêu

Sau module này bạn sẽ:
- Biết cách tích hợp bất kỳ third-party API nào
- Hiểu cách dùng OpenAI API để tạo AI features
- Biết gửi email với Nodemailer qua Gmail
- Hiểu Text-to-Speech với Microsoft Edge TTS (miễn phí)
- Biết xử lý lỗi API ngoài và fallback strategies
- Đọc được `config/openai.js`, `utils/emailService.js`, `routes/tts.js`

---

## Third-Party API là gì?

Thay vì xây dựng mọi thứ từ đầu, bạn gọi API của công ty khác để dùng dịch vụ của họ:

| Service | Dùng để | Chi phí |
|---------|---------|---------|
| OpenAI API | AI giải thích từ vựng, tạo câu hỏi | ~$0.002/1000 tokens |
| Gmail SMTP | Gửi email OTP | Miễn phí |
| Microsoft Edge TTS | Phát âm từ vựng | **Miễn phí** |

**Pattern chung** khi dùng third-party API:
1. Đăng ký → lấy API key
2. Cài SDK (`npm install openai`)
3. Khởi tạo client với API key từ `.env`
4. Gọi API → xử lý response
5. Handle lỗi (quota, network, timeout)

---

## 1. OpenAI API

### Lấy API Key

1. Đăng ký tại [platform.openai.com](https://platform.openai.com)
2. Billing → Add payment method
3. API Keys → Create new key
4. Lưu vào `.env`: `OPENAI_API_KEY=sk-...`

### Cài SDK

```bash
npm install openai
```

### Khởi tạo và gọi API

```javascript
const { OpenAI } = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
```

### Chat Completion — Giao tiếp với AI

```javascript
const response = await openai.chat.completions.create({
    model: 'gpt-4',           // Hoặc 'gpt-3.5-turbo' (rẻ hơn)
    messages: [
        {
            role: 'system',   // Định nghĩa AI sẽ đóng vai gì
            content: 'Bạn là giáo viên TOEIC chuyên nghiệp. Trả lời ngắn gọn bằng tiếng Việt.',
        },
        {
            role: 'user',     // Câu hỏi của user
            content: 'Giải thích từ "accomplish" trong TOEIC context',
        },
    ],
    max_tokens: 500,          // Giới hạn độ dài response
    temperature: 0.7,         // 0 = deterministic, 1 = creative
});

// Lấy nội dung response
const answer = response.choices[0].message.content;
console.log(answer);

// Theo dõi chi phí (token usage)
console.log(response.usage);
// { prompt_tokens: 50, completion_tokens: 200, total_tokens: 250 }
```

### Roles trong conversation

```
system   → Hướng dẫn AI hành xử như thế nào
user     → Câu hỏi/yêu cầu của người dùng
assistant → Response của AI (dùng khi muốn cung cấp "lịch sử" chat)
```

### Multi-turn conversation

```javascript
const messages = [
    { role: 'system', content: 'Bạn là trợ lý học TOEIC' },
    { role: 'user', content: 'Giải thích từ accomplish' },
    { role: 'assistant', content: 'Accomplish nghĩa là hoàn thành...' },
    { role: 'user', content: 'Cho tôi 2 ví dụ' },  // Tiếp tục cuộc trò chuyện
];

const response = await openai.chat.completions.create({ model: 'gpt-4', messages });
```

🎯 **Trong project — `config/openai.js` và `utils/aiHelper.js`:**

```javascript
// config/openai.js
const chatCompletion = async (messages, options = {}) => {
    try {
        const response = await openai.chat.completions.create({
            model: options.model || 'gpt-4',
            messages,
            max_tokens: options.maxTokens || 500,
            temperature: options.temperature || 0.7,
        });

        logger.debug('OpenAI token usage', {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
        });

        return { success: true, content: response.choices[0].message.content };
    } catch (error) {
        logger.error('OpenAI API error', { error: error.message });
        return { success: false, error: error.message };
    }
};
```

```javascript
// utils/aiHelper.js
exports.explainWord = async (word) => {
    const prompt = `Giải thích từ vựng TOEIC:
${word.en} (${word.vn}) - ${word.type}

1. Nghĩa và cách dùng
2. 2 ví dụ + dịch
3. Cụm từ thường gặp
4. Lưu ý cho TOEIC`;

    const messages = [
        { role: 'system', content: 'Bạn là giáo viên TOEIC. Trả lời ngắn gọn bằng tiếng Việt.' },
        { role: 'user', content: prompt },
    ];

    return await chatCompletion(messages, { maxTokens: 600 });
};
```

### Yêu cầu AI trả JSON

Khi cần parse kết quả, yêu cầu AI trả về JSON:

```javascript
exports.generateQuestions = async (word, count = 5) => {
    const prompt = `Tạo ${count} câu hỏi multiple-choice cho từ "${word.en}".

Trả về ONLY JSON array, không có text khác:
[
  {
    "question": "...",
    "options": ["a", "b", "c", "d"],
    "correctIndex": 0,
    "explanation": "..."
  }
]`;

    const result = await chatCompletion([
        { role: 'system', content: 'Return ONLY valid JSON, no other text.' },
        { role: 'user', content: prompt },
    ]);

    if (!result.success) return null;

    // Parse JSON từ response
    try {
        return JSON.parse(result.content);
    } catch {
        // AI đôi khi trả thêm text xung quanh JSON
        const match = result.content.match(/\[[\s\S]*\]/);
        return match ? JSON.parse(match[0]) : null;
    }
};
```

---

## 2. Email với Nodemailer

### Gmail App Password

**Không dùng mật khẩu Gmail thường** — Google chặn đăng nhập từ "less secure apps". Dùng **App Password**:

1. Bật 2FA tại [myaccount.google.com](https://myaccount.google.com)
2. Security → 2-Step Verification → App passwords
3. Select app: "Mail", Select device: "Windows Computer"
4. Copy password 16 ký tự (vd: `abcd efgh ijkl mnop`)
5. Lưu vào `.env`:
```
EMAIL_USER=yourname@gmail.com
EMAIL_PASS=abcdefghijklmnop
```

### Cài đặt Nodemailer

```bash
npm install nodemailer
```

### Gửi email đơn giản

```javascript
const nodemailer = require('nodemailer');

// Khởi tạo transporter (chỉ khởi tạo một lần)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Gửi email
await transporter.sendMail({
    from: `TOEIC App <${process.env.EMAIL_USER}>`,
    to: 'recipient@gmail.com',
    subject: 'Xác nhận đăng ký',
    text: 'Mã OTP của bạn là: 123456',  // Plain text

    html: `
        <h1>Xác nhận đăng ký</h1>
        <p>Mã OTP: <strong>123456</strong></p>
        <p>Mã có hiệu lực trong 10 phút.</p>
    `,  // HTML version
});
```

🎯 **Trong project — `utils/emailService.js`:**

```javascript
// Lazy initialization — chỉ tạo transporter khi cần (nếu config có)
function getTransporter() {
    if (transporter) return transporter;

    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) {
        logger.warn('Email không cấu hình — OTP sẽ in ra console (dev mode)');
        return null;  // Không crash, chỉ warn
    }

    transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    return transporter;
}

async function sendOtpEmail(to, code, type) {
    const t = getTransporter();

    if (!t) {
        // Dev mode: in ra console thay vì gửi email
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Email service not configured');
        }
        logger.debug(`OTP CODE: ${code}`);  // In ra để test
        return;
    }

    await t.sendMail({
        from: process.env.EMAIL_FROM || `TOEIC App <${process.env.EMAIL_USER}>`,
        to,
        subject: type === 'reset' ? 'Đặt lại mật khẩu' : 'Xác nhận đăng ký',
        html: `<!-- HTML template với CSS inline -->`
    });
}
```

**Kỹ thuật quan trọng**: Dev fallback — nếu email chưa cấu hình, in OTP ra console thay vì crash. Giúp dev test mà không cần setup email.

---

## 3. Text-to-Speech — Microsoft Edge Neural TTS

Project dùng thư viện `msedge-tts` — dùng API của Microsoft Edge **hoàn toàn miễn phí**, chất lượng neural voice rất tốt.

```bash
npm install msedge-tts
```

### Cách dùng

```javascript
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const path = require('path');

async function generateAudio(text, voiceName = 'en-US-AriaNeural') {
    const tts = new MsEdgeTTS();

    // Chọn giọng đọc và format output
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

    // Xuất ra file MP3
    await tts.toFile('/path/to/output/', text);
    // → Tạo file audio.mp3 trong thư mục chỉ định
}

// Các giọng đọc có sẵn
const voices = {
    'en-US-AriaNeural',     // Mỹ - nữ (rõ ràng, phổ biến)
    'en-US-GuyNeural',      // Mỹ - nam
    'en-GB-SoniaNeural',    // Anh - nữ
    'en-AU-NatashaNeural',  // Úc - nữ
    'en-CA-ClaraNeural',    // Canada - nữ
};
```

🎯 **Trong project — `routes/tts.js`:**

```javascript
// Cache system cho TTS
// Base64 encode text → unique filename
const cacheKey = Buffer.from(`${lang}_${text}`).toString('base64url').substring(0, 60);
const fileName = `${cacheKey}.mp3`;
const filePath = path.join(TTS_CACHE_DIR, fileName);

// Trả về file cached nếu đã tạo trước
if (fs.existsSync(path.join(filePath, 'audio.mp3'))) {
    return res.json({ url: `/tts-cache/${fileName}/audio.mp3` });
}

// Generate audio mới
const tts = new MsEdgeTTS();
await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
fs.mkdirSync(filePath, { recursive: true });
await tts.toFile(filePath, text);

res.json({ url: `/tts-cache/${fileName}/audio.mp3` });
```

**Kỹ thuật cache cho TTS**: Mỗi từ chỉ tạo audio một lần → lưu file → lần sau trả file cũ. Không mất thời gian gọi API lại.

---

## 4. Xử Lý Lỗi từ API Ngoài

Khi gọi API bên ngoài, có nhiều thứ có thể sai:
- **Network timeout** — API server quá tải hoặc mất mạng
- **Rate limit** — Gọi quá nhiều request trong thời gian ngắn
- **Auth error** — API key sai hoặc hết hạn
- **Server error** — API server gặp lỗi

```javascript
const callExternalAPI = async (data) => {
    try {
        const response = await fetch('https://api.external.com/endpoint', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
            signal: AbortSignal.timeout(10000),  // Timeout 10s
        });

        if (!response.ok) {
            // HTTP error (4xx, 5xx)
            if (response.status === 429) {
                throw new Error('Rate limit exceeded — try again later');
            }
            if (response.status === 401) {
                throw new Error('Invalid API key');
            }
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        if (error.name === 'TimeoutError') {
            throw new Error('API request timed out');
        }
        throw error;
    }
};
```

### Retry với exponential backoff

```javascript
async function callWithRetry(fn, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === maxRetries) throw error;

            // Chờ: 1s, 2s, 4s (exponential)
            const delay = Math.pow(2, attempt - 1) * 1000;
            logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

// Dùng
const result = await callWithRetry(() => openai.chat.completions.create(...));
```

---

## 5. Giảm Chi Phí API

OpenAI tính tiền theo token. Các kỹ thuật giảm chi phí:

**1. Cache kết quả AI:**
```javascript
const cacheKey = `ai:explain:${word.en}`;
const cached = await getCache(cacheKey);
if (cached) return cached;

const result = await chatCompletion(messages);
await setCache(cacheKey, result, 86400);  // Cache 24 giờ
return result;
```

**2. Dùng model rẻ hơn cho task đơn giản:**
```javascript
// gpt-3.5-turbo: ~1/10 giá gpt-4, đủ cho nhiều task
const model = task === 'complex' ? 'gpt-4' : 'gpt-3.5-turbo';
```

**3. Giới hạn max_tokens:**
```javascript
// Không để mặc định (có thể tốn nhiều token)
max_tokens: 300,  // Giới hạn output
```

---

## 6. Environment Variables cho API Keys

```bash
# .env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4

EMAIL_USER=myapp@gmail.com
EMAIL_PASS=abcdefghijklmnop
EMAIL_FROM=TOEIC App <myapp@gmail.com>
```

Kiểm tra trước khi khởi động:
```javascript
// server.js
if (process.env.OPENAI_API_KEY) {
    await testConnection();  // Test nếu có key
} else {
    logger.warn('OpenAI API key not configured — AI features disabled');
}
```

**Graceful degradation**: Nếu không có API key, tính năng AI bị vô hiệu hóa nhưng app vẫn chạy bình thường.

---

## Bài Tập Thực Hành

### Bài 1: Gửi email test

Cấu hình Gmail App Password và gửi email test:

```javascript
require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

async function sendTestEmail() {
    const info = await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,  // Gửi cho chính mình
        subject: 'Test email từ Node.js',
        html: '<h1>Hello từ Node.js!</h1><p>Email hoạt động rồi!</p>',
    });
    console.log('Email sent:', info.messageId);
}

sendTestEmail().catch(console.error);
```

### Bài 2: Gọi OpenAI API

```javascript
require('dotenv').config();
const { OpenAI } = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function askAI(question) {
    const response = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: 'Trả lời ngắn gọn bằng tiếng Việt.' },
            { role: 'user', content: question },
        ],
        max_tokens: 200,
    });

    console.log('Answer:', response.choices[0].message.content);
    console.log('Tokens used:', response.usage.total_tokens);
}

askAI('Từ "accomplish" trong TOEIC thường xuất hiện trong ngữ cảnh nào?');
```

### Bài 3: TTS đơn giản

```javascript
require('dotenv').config();
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const path = require('path');

async function generateSpeech(text) {
    const tts = new MsEdgeTTS();
    await tts.setMetadata('en-US-AriaNeural', OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

    const outputDir = path.join(__dirname, 'audio_output');
    await tts.toFile(outputDir, text);
    console.log('Audio saved to:', outputDir);
}

generateSpeech('accomplish');
```

---

## Câu Hỏi Ôn Tập

1. Tại sao không dùng mật khẩu Gmail thường để gửi email từ Node.js?

2. `temperature: 0` và `temperature: 1` trong OpenAI API khác nhau như thế nào?

3. Tại sao project dùng cache file cho TTS thay vì generate mỗi lần?

4. Khi OpenAI API trả lỗi 429 (rate limit), bạn nên làm gì?

5. `max_tokens: 300` là giới hạn cho input hay output của AI?

---

## Tóm Tắt

- **OpenAI**: SDK `openai`, `chat.completions.create()`, roles: system/user/assistant
- **Nodemailer**: Gửi email qua Gmail, cần App Password (không phải mật khẩu thường)
- **Dev fallback**: Nếu email/AI chưa cấu hình, in ra console thay vì crash
- **Caching**: Cache kết quả AI và TTS để giảm chi phí và tăng tốc
- **Error handling**: Retry với exponential backoff, graceful degradation
- **Secrets**: API keys trong `.env`, không hardcode, không commit
- **Token cost**: Dùng model phù hợp, giới hạn max_tokens, cache kết quả
