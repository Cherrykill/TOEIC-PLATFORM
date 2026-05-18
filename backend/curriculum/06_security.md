# Module 6: Security — Bảo Mật Web Application

---

## Mục tiêu

Sau module này bạn sẽ:
- Hiểu các mối đe dọa phổ biến với web API
- Biết dùng Helmet để bảo vệ HTTP headers
- Hiểu CORS và cách cấu hình đúng
- Biết implement rate limiting chống DDoS / brute force
- Hiểu các lỗ hổng OWASP Top 10 cơ bản
- Đọc được phần security trong `server.js`

---

## Tại sao cần bảo mật?

Mọi API đều là mục tiêu tấn công. Một lỗ hổng nhỏ có thể:
- Lộ dữ liệu của hàng nghìn user
- Cho phép kẻ tấn công giả mạo là admin
- Làm sập server bằng DDoS

Bảo mật không phải là tính năng thêm vào sau — phải làm từ đầu.

---

## 1. Helmet — Bảo Vệ HTTP Headers

Trình duyệt dùng HTTP headers để biết cách xử lý response. Kẻ tấn công có thể lợi dụng một số header mặc định nguy hiểm.

**Helmet** là middleware tự động set các security headers an toàn.

```bash
npm install helmet
```

```javascript
const helmet = require('helmet');
app.use(helmet());
```

### Các header Helmet thêm vào

| Header | Chức năng |
|--------|-----------|
| `X-Content-Type-Options: nosniff` | Chặn trình duyệt đoán MIME type (chống MIME sniffing) |
| `X-Frame-Options: DENY` | Chặn site bị nhúng vào iframe (chống Clickjacking) |
| `X-XSS-Protection: 1; mode=block` | Bật XSS filter của trình duyệt |
| `Strict-Transport-Security` | Bắt buộc dùng HTTPS |
| `Content-Security-Policy` | Kiểm soát nguồn tài nguyên được load |

### Content Security Policy (CSP)

CSP là header quan trọng nhất — kiểm soát trình duyệt được phép load script, style từ đâu:

```javascript
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],              // Mọi thứ chỉ load từ cùng domain
            scriptSrc: [
                "'self'",
                "https://cdn.jsdelivr.net",      // Cho phép CDN này
                "https://cdnjs.cloudflare.com",
            ],
            styleSrc: ["'self'", "'unsafe-inline'"],   // Cho phép inline style
            imgSrc: ["'self'", "data:", "https:"],     // Cho phép ảnh từ HTTPS
        }
    }
}));
```

Nếu không có CSP: kẻ tấn công inject script `<script src="https://evil.com/steal.js">` vào HTML → trình duyệt chạy luôn. Với CSP: trình duyệt từ chối vì `evil.com` không trong whitelist.

---

## 2. CORS — Cross-Origin Resource Sharing

### Vấn đề Same-Origin Policy

Trình duyệt mặc định chặn JavaScript ở `http://frontend.com` gọi API ở `http://api.com`. Đây là **Same-Origin Policy** — bảo vệ user khỏi request "trái phép".

```
Origin A: http://localhost:3000 gọi http://localhost:5000/api
→ Khác port → Khác origin → Bị chặn!

Origin A: https://myapp.com gọi https://api.myapp.com/api
→ Khác subdomain → Khác origin → Bị chặn!
```

### CORS giải quyết

CORS cho phép server "mời" một số origin nhất định:

```javascript
const cors = require('cors');

// Cho phép tất cả (KHÔNG DÙNG CHO PRODUCTION)
app.use(cors());

// Chỉ cho phép origin cụ thể
app.use(cors({
    origin: ['http://localhost:3000', 'https://myapp.com'],
    credentials: true,    // Cho phép gửi cookie
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
```

🎯 **Trong project — `server.js`:**

```javascript
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:5500', `http://localhost:${process.env.PORT || 5000}`];

app.use(cors({
    origin: (origin, callback) => {
        // Cho phép same-origin (origin = undefined) và danh sách whitelist
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: origin ${origin} không được phép`));
    },
    credentials: true,
}));
```

**`credentials: true`** — Cần thiết khi frontend dùng cookie hoặc Authorization header. Khi set này, không thể dùng `origin: '*'` (wildcard).

---

## 3. Rate Limiting — Giới Hạn Request

Rate limiting giới hạn số request từ một IP trong khoảng thời gian nhất định.

**Tại sao cần:**
- Chống brute force (thử password nhiều lần)
- Chống DDoS (gửi triệu request để làm sập server)
- Chống spam (gửi email OTP hàng trăm lần)

```javascript
const rateLimit = require('express-rate-limit');

// Tạo limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // Cửa sổ 15 phút
    max: 100,                   // Tối đa 100 request trong cửa sổ
    standardHeaders: true,      // Trả về headers Retry-After
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Quá nhiều request, vui lòng thử lại sau',
    },
});

// Áp dụng cho tất cả /api routes
app.use('/api/', apiLimiter);
```

🎯 **Trong project — `routes/auth.js`** có nhiều limiter khác nhau:

```javascript
// OTP: Tối đa 5 lần trong 10 phút (chống spam email)
const otpLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 5 });

// Login: Tối đa 10 lần trong 15 phút
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

// Register: Tối đa 5 tài khoản trong 1 giờ từ một IP
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5 });

router.post('/login', loginLimiter, authController.login);
router.post('/register/send-otp', otpLimiter, authController.sendRegisterOtp);
router.post('/register', registerLimiter, authController.register);
```

### Response khi bị rate limit

```
HTTP/1.1 429 Too Many Requests
Retry-After: 900
RateLimit-Limit: 10
RateLimit-Remaining: 0
RateLimit-Reset: 1703000000

{ "success": false, "message": "Quá nhiều lần thử" }
```

---

## 4. Input Validation — Không Tin Dữ Liệu Từ Client

**Golden rule**: Never trust user input. Validate mọi dữ liệu trước khi dùng.

### Các loại tấn công qua input

**SQL Injection** (với SQL database):
```sql
-- Hacker nhập email: admin'--
SELECT * FROM users WHERE email = 'admin'--' AND password = '...'
-- Dấu -- comment out phần password check!
```

**NoSQL Injection** (với MongoDB):
```javascript
// Hacker gửi: { email: { $gt: "" }, password: "anything" }
User.findOne({ email: { $gt: "" }, password: "anything" })
// $gt: "" khớp mọi email → đăng nhập không cần password!
```

### Sanitize input

```javascript
// Chống NoSQL injection — xóa $ và . từ input
const mongoSanitize = require('express-mongo-sanitize');
app.use(mongoSanitize());

// Với thư viện validator
const { body, validationResult } = require('express-validator');

app.post('/register', [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('username').trim().isAlphanumeric().isLength({ min: 3, max: 20 }),
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    // ... xử lý tiếp
});
```

### Validate thủ công trong project

```javascript
// controllers/authController.js — pattern kiểm tra trong project
const { email, password, username } = req.body;

if (!email || !password || !username) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
}

const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: 'Email không hợp lệ' });
}

if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password cần ít nhất 6 ký tự' });
}
```

---

## 5. Environment Variables — Bảo Vệ Secrets

⚠️ **Sai lầm nguy hiểm**: Hardcode secrets vào code

```javascript
// ĐỪNG LÀM NÀY:
const secret = 'my_super_secret_jwt_key_12345';
const dbUrl = 'mongodb+srv://admin:password@cluster.mongodb.net/';

// LÀM NHƯ NÀY:
const secret = process.env.JWT_SECRET;
const dbUrl = process.env.MONGODB_URI;
```

**.env không được commit lên Git:**
```
# .gitignore
.env
.env.local
.env.production
```

Thay vào đó, commit file `.env.example` với giá trị trống:
```bash
# .env.example (commit cái này)
MONGODB_URI=
JWT_SECRET=
OPENAI_API_KEY=
REDIS_URL=
```

---

## 6. OWASP Top 10 Cơ Bản

OWASP (Open Web Application Security Project) liệt kê 10 lỗ hổng phổ biến nhất:

### A01: Broken Access Control

User thường có thể làm những gì họ không được phép:

```javascript
// Lỗi: Ai cũng xem được profile của người khác
app.get('/api/users/:id/profile', async (req, res) => {
    const user = await User.findById(req.params.id);
    res.json(user);
});

// Đúng: Chỉ xem được profile của mình (hoặc admin xem được tất)
app.get('/api/users/:id/profile', protect, async (req, res) => {
    if (req.params.id !== req.user.id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Không có quyền' });
    }
    const user = await User.findById(req.params.id);
    res.json(user);
});
```

### A02: Cryptographic Failures

- Dùng MD5 hay SHA1 để hash password ← Sai! (tốc độ cao → dễ crack)
- Bcrypt, Argon2 mới an toàn (thiết kế để chậm)
- Không truyền data nhạy cảm qua HTTP (phải HTTPS)

### A03: Injection

Đã đề cập ở trên — sanitize input, dùng parameterized queries.

### A05: Security Misconfiguration

- Để verbose error messages trong production
- Để debug endpoints không bảo vệ
- Dùng default credentials

```javascript
// Chỉ trả về stack trace trong development
res.status(500).json({
    success: false,
    message: error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
});
```

### A07: Identification and Authentication Failures

- Không có rate limiting trên login
- Không lock account sau nhiều lần sai
- Cho phép password quá yếu
- JWT secret không đủ mạnh

---

## 7. HTTPS trong Production

Mọi traffic phải dùng HTTPS. Trên Render/Railway/Heroku, HTTPS được xử lý tự động.

Khi deploy trên VPS tự quản lý, dùng **Nginx + Let's Encrypt (certbot)** để có SSL miễn phí.

Helmet tự động thêm `Strict-Transport-Security` header để buộc browser dùng HTTPS sau lần đầu truy cập:

```
Strict-Transport-Security: max-age=15552000; includeSubDomains
```

---

## 8. Sensitive Data trong Response

Không bao giờ trả về password hoặc token trong response:

```javascript
// Mongoose: field với select: false không được fetch mặc định
password: {
    type: String,
    select: false,   // Không trả về khi query User
}

// Khi cần query kèm password (chỉ khi verify):
const user = await User.findOne({ email }).select('+password');

// Lọc fields khi trả về
const userData = {
    id: user._id,
    username: user.username,
    email: user.email,
    // KHÔNG BAO GỒM: password, token, loginAttempts
};
```

---

## Bài Tập Thực Hành

### Bài 1: Cấu hình Helmet

```javascript
// Thêm Helmet với CSP tùy chỉnh
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://trusted-cdn.com"],
            styleSrc: ["'self'", "'unsafe-inline'"],
        }
    }
}));

// Kiểm tra headers bằng curl:
// curl -I http://localhost:3000
// Tìm các headers bắt đầu bằng X-
```

### Bài 2: Rate limiting

Tạo 3 rate limiters khác nhau:
- `/api/auth/login`: 5 lần/15 phút
- `/api/auth/register`: 3 lần/giờ
- `/api/` (global): 100 lần/phút

### Bài 3: Validate input

Thêm validation cho route POST `/register`:
- Email hợp lệ (regex)
- Password ít nhất 8 ký tự, có chữ hoa, số
- Username 3-20 ký tự, chỉ chứa a-z, 0-9, và _

---

## Câu Hỏi Ôn Tập

1. CORS là cơ chế bảo vệ phía server hay phía trình duyệt? Giải thích.

2. Tại sao `credentials: true` không thể kết hợp với `origin: '*'`?

3. Sự khác biệt giữa Authentication (Xác thực) và Authorization (Phân quyền)?

4. Tại sao không dùng MD5 để hash password dù nó "an toàn hơn plaintext"?

5. `select: false` trong Mongoose Schema có tác dụng gì?

---

## Tóm Tắt

- **Helmet**: Set security HTTP headers tự động (CSP, X-Frame-Options, HSTS...)
- **CORS**: Cho phép frontend từ domain khác gọi API của bạn — cấu hình whitelist chặt chẽ
- **Rate limiting**: Giới hạn request để chống brute force và DDoS
- **Input validation**: Validate và sanitize mọi input từ client
- **Secrets**: Lưu trong `.env`, không commit lên Git
- **OWASP**: Học và tránh 10 lỗ hổng phổ biến nhất
- **select: false**: Ẩn sensitive fields khỏi MongoDB response
- **Production**: Luôn dùng HTTPS, ẩn stack trace
