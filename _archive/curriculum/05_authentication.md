# Module 5: Authentication — Xác Thực Người Dùng

---

## Mục tiêu

Sau module này bạn sẽ:
- Hiểu tại sao cần authentication và các cách làm phổ biến
- Biết hash password an toàn với bcrypt
- Hiểu JWT (JSON Web Token) và cách dùng
- Biết implement đăng ký, đăng nhập, xác thực OTP qua email
- Hiểu middleware `protect` và `authorize` trong project
- Đọc được `controllers/authController.js` và `middleware/auth.js`

---

## Tại sao cần Authentication?

Khi user gọi `GET /api/users/profile`, server cần biết **đây là ai** để trả về đúng dữ liệu — và không cho phép user A xem dữ liệu của user B.

**3 câu hỏi authentication giải quyết:**
1. **Bạn là ai?** — Đăng nhập (Authentication)
2. **Bạn có quyền làm điều này không?** — Phân quyền (Authorization)
3. **Làm sao server nhớ bạn đã đăng nhập?** — Session / Token

---

## 1. Hash Password với bcrypt

### Tại sao không lưu password thẳng?

Nếu database bị hack, kẻ tấn công sẽ có toàn bộ password dưới dạng plaintext. Mọi user bị lộ mật khẩu ngay lập tức.

**Giải pháp**: Lưu **hash** của password, không lưu password gốc.

```
Password gốc: "mypassword123"
Bcrypt hash:  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
```

Hash là **một chiều** — không thể đảo ngược từ hash ra password gốc.

### Cách dùng bcrypt

```javascript
const bcrypt = require('bcryptjs');

// Hash password khi đăng ký
const salt = await bcrypt.genSalt(10);   // [1] Tạo salt (số càng cao càng an toàn, càng chậm)
const hashedPassword = await bcrypt.hash('mypassword123', salt);  // [2] Hash

// Kiểm tra password khi đăng nhập
const isMatch = await bcrypt.compare('mypassword123', hashedPassword);  // [3] So sánh
// → true (khớp) hoặc false (sai)
```

**`salt` là gì?** — Chuỗi ngẫu nhiên thêm vào trước khi hash, giúp hai password giống nhau có hash khác nhau. Tránh tấn công rainbow table.

```
"password123" + salt1 → hash1
"password123" + salt2 → hash2
hash1 ≠ hash2  ← Dù cùng password!
```

🎯 **Trong project — `models/User.js`:**

```javascript
// Hash tự động trước khi save (pre-save hook)
UserSchema.pre('save', async function() {
    if (!this.isModified('password')) return;  // Chỉ hash khi password thay đổi

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Method để so sánh password
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};
```

---

## 2. JWT — JSON Web Token

### Session vs Token

**Session (cách cũ):**
```
Client → Đăng nhập → Server lưu session vào DB → Trả về sessionId
Client → Gửi sessionId mỗi request → Server tra DB → OK
```
*Vấn đề*: Server phải lưu và tra DB mỗi request. Khó scale.

**JWT (cách hiện đại):**
```
Client → Đăng nhập → Server tạo JWT → Trả về JWT
Client → Gửi JWT mỗi request → Server verify JWT (không cần DB) → OK
```
*Ưu điểm*: Stateless — server không cần lưu gì. Dễ scale.

### Cấu trúc JWT

JWT gồm 3 phần, ngăn cách bởi dấu `.`:

```
eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEyMyIsInJvbGUiOiJ1c2VyIn0.abc123xyz
└─── Header ────────┘└────────── Payload ──────────────────┘└─ Signature ─┘
```

- **Header**: Thuật toán ký (HS256)
- **Payload**: Dữ liệu chứa trong token (có thể decode, KHÔNG mã hóa)
- **Signature**: Chữ ký — verify token không bị giả mạo

⚠️ **Payload không mã hóa** — bất kỳ ai cũng có thể đọc. Không lưu password hay thông tin nhạy cảm vào JWT!

### Tạo và verify JWT

```javascript
const jwt = require('jsonwebtoken');

// Tạo token
const token = jwt.sign(
    { id: user._id, role: user.role, username: user.username },  // Payload
    process.env.JWT_SECRET,   // Secret key (phải bí mật)
    { expiresIn: '7d' }       // Hết hạn sau 7 ngày
);

// Verify token
try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(decoded);
    // { id: '123', role: 'user', username: 'alice', iat: ..., exp: ... }
} catch (error) {
    if (error.name === 'JsonWebTokenError') {
        console.log('Token không hợp lệ');
    }
    if (error.name === 'TokenExpiredError') {
        console.log('Token đã hết hạn');
    }
}
```

🎯 **Trong project — `models/User.js`:**

```javascript
UserSchema.methods.generateToken = function() {
    return jwt.sign(
        {
            id: this._id,
            username: this.username,
            role: this.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
};
```

---

## 3. Luồng Authentication Đầy Đủ

### Đăng ký (Register)

```
1. Client gửi POST /api/auth/register { username, email, password }
2. Validate input (email hợp lệ? password đủ dài?)
3. Kiểm tra email đã tồn tại chưa
4. Hash password
5. Lưu user vào MongoDB
6. Tạo JWT token
7. Trả về { token, user }
```

### Đăng nhập (Login)

```
1. Client gửi POST /api/auth/login { email, password }
2. Tìm user theo email
3. So sánh password với hash trong DB
4. Tạo JWT token
5. Trả về { token, user }
```

### Gọi API có bảo vệ

```
1. Client gửi request với header: Authorization: Bearer <token>
2. Middleware `protect` chạy:
   a. Đọc token từ header
   b. Verify token
   c. Tìm user theo ID trong payload
   d. Gắn user vào req.user
3. Route handler tiếp tục
```

---

## 4. Middleware `protect` và `authorize`

🎯 **Trong project — `middleware/auth.js`:**

```javascript
const protect = async (req, res, next) => {
    let token;

    // [1] Đọc token từ Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
        // 'Bearer eyJhbGci...' → 'eyJhbGci...'
    }

    // [2] Không có token → từ chối
    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized - no token' });
    }

    try {
        // [3] Verify token và giải mã payload
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // decoded = { id: '123', username: 'alice', role: 'user', iat: ..., exp: ... }

        // [4] Tìm user trong DB (đảm bảo user vẫn còn tồn tại)
        const user = await User.findById(decoded.id);
        if (!user || !user.isActive) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        // [5] Gắn user vào request để các middleware sau dùng
        req.user = {
            id: user._id,
            username: user.username,
            role: user.role,
        };

        next();   // [6] Cho qua

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Token expired' });
        }
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};
```

**`authorize` — Phân quyền theo role:**

```javascript
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Role '${req.user.role}' không có quyền`,
            });
        }
        next();
    };
};

// Dùng trong route
app.get('/api/admin/metrics', protect, authorize('admin'), handler);
// 1. protect: Kiểm tra token hợp lệ
// 2. authorize('admin'): Kiểm tra role là admin
// 3. handler: Xử lý request
```

---

## 5. OTP — Xác thực Email

Project dùng OTP để:
1. Xác minh email khi đăng ký (tránh fake accounts)
2. Reset password khi quên mật khẩu

### Luồng OTP đăng ký

```
1. POST /api/auth/register/send-otp { username, email, password }
   → Server hash password ngay
   → Tạo OTP 6 số
   → Lưu OtpCode { email, code, type: 'register', userData: { username, passwordHash } }
   → Gửi email có OTP
   → Trả về 200 OK (không tạo user ngay)

2. POST /api/auth/register { email, otp }
   → Tìm OtpCode khớp email + otp
   → Kiểm tra hết hạn chưa
   → Tạo User từ userData trong OtpCode
   → Xóa OtpCode
   → Trả về { token, user }
```

🎯 **Trong project — `models/OtpCode.js`:**

```javascript
const otpCodeSchema = new mongoose.Schema({
    email: { type: String, required: true },
    code: { type: String, required: true },
    type: { type: String, enum: ['reset', 'register'] },

    // Lưu data tạm khi đăng ký
    userData: {
        username: String,
        passwordHash: String,   // Password đã hash, không lưu plaintext
    },

    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
});

// TTL Index: MongoDB tự xóa document sau expiresAt
otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

**TTL Index**: MongoDB có cơ chế tự động xóa document khi `expiresAt` đã qua — không cần cron job dọn dẹp.

### Tạo OTP

```javascript
// Tạo số ngẫu nhiên 6 chữ số
const code = Math.floor(100000 + Math.random() * 900000).toString();

// Lưu vào DB
await OtpCode.create({
    email,
    code,
    type: 'register',
    userData: { username, passwordHash },
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),  // Hết hạn sau 10 phút
});
```

### Verify OTP

```javascript
const otpDoc = await OtpCode.findOne({
    email,
    type: 'register',
    expiresAt: { $gt: new Date() },   // Chưa hết hạn
}).sort({ createdAt: -1 });           // Lấy OTP mới nhất

if (!otpDoc) {
    return res.status(400).json({ message: 'OTP không hợp lệ hoặc đã hết hạn' });
}

if (otpDoc.code !== otp) {
    otpDoc.attempts += 1;
    await otpDoc.save();
    return res.status(400).json({ message: 'OTP không đúng' });
}

// OTP đúng → xóa và tạo user
await OtpCode.deleteOne({ _id: otpDoc._id });
```

---

## 6. Chống Brute Force

### Rate Limiting trên route

```javascript
// routes/auth.js
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 phút
    max: 10,                    // Tối đa 10 lần trong 15 phút
    message: { success: false, message: 'Quá nhiều lần thử. Thử lại sau 15 phút' },
});

const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,  // 10 phút
    max: 5,                     // 5 lần gửi OTP trong 10 phút
});

router.post('/login', loginLimiter, authController.login);
router.post('/register/send-otp', otpLimiter, authController.sendRegisterOtp);
```

### Account lockout sau nhiều lần sai password

```javascript
// Sau 5 lần sai → khóa tài khoản 30 phút
const MAX_ATTEMPTS = 5;
const LOCK_TIME = 30 * 60 * 1000; // 30 phút

if (!isMatch) {
    user.loginAttempts += 1;

    if (user.loginAttempts >= MAX_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_TIME);
    }

    await user.save();
    return res.status(401).json({ message: 'Sai mật khẩu' });
}

// Đăng nhập thành công → reset counter
user.loginAttempts = 0;
user.lockUntil = null;
```

---

## 7. Password Reset Flow

```
1. POST /api/auth/forgot-password { email }
   → Tạo OTP 6 số
   → Lưu OtpCode { email, type: 'reset', expiresAt: +10min }
   → Gửi email OTP
   → Trả về 200 (không tiết lộ email có tồn tại hay không)

2. POST /api/auth/reset-password { email, otp, newPassword }
   → Tìm OtpCode hợp lệ
   → Verify OTP
   → Hash newPassword
   → Cập nhật password user
   → Xóa OtpCode
   → Trả về 200 OK
```

---

## Bài Tập Thực Hành

### Bài 1: Hash và compare password

```javascript
const bcrypt = require('bcryptjs');

async function main() {
    const password = 'mySecurePass123';

    // Hash
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    console.log('Hash:', hash);

    // Compare đúng
    console.log('Đúng:', await bcrypt.compare(password, hash));        // true

    // Compare sai
    console.log('Sai:', await bcrypt.compare('wrongPassword', hash));  // false

    // Thử genSalt với cost khác nhau (chú ý thời gian)
    console.time('cost=10');
    await bcrypt.hash(password, 10);
    console.timeEnd('cost=10');

    console.time('cost=12');
    await bcrypt.hash(password, 12);
    console.timeEnd('cost=12');
}

main();
```

### Bài 2: Tạo và decode JWT

```javascript
const jwt = require('jsonwebtoken');

const SECRET = 'my_secret_key';

// Tạo token
const token = jwt.sign(
    { userId: 'user_123', role: 'admin' },
    SECRET,
    { expiresIn: '1h' }
);
console.log('Token:', token);

// Decode (không verify — xem payload)
const decoded = jwt.decode(token);
console.log('Decoded:', decoded);

// Verify
const verified = jwt.verify(token, SECRET);
console.log('Verified:', verified);

// Thử verify với sai secret
try {
    jwt.verify(token, 'wrong_secret');
} catch (e) {
    console.log('Lỗi:', e.name, e.message);
}
```

### Bài 3: Implement đăng nhập đơn giản

Tạo API đăng nhập với JWT (không cần MongoDB, dùng array):
```javascript
const users = [
    { id: 1, email: 'admin@test.com', passwordHash: '...' /* hash của "admin123" */ }
];

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    // 1. Tìm user
    // 2. Compare password
    // 3. Tạo JWT
    // 4. Trả về token
});

app.get('/profile', verifyToken, (req, res) => {
    res.json({ user: req.user });
});
```

---

## Câu Hỏi Ôn Tập

1. Tại sao không lưu password plaintext mà phải hash? Tại sao không dùng MD5 hay SHA256?

2. JWT "stateless" nghĩa là gì? Ưu điểm và nhược điểm so với session?

3. Payload của JWT có thể bị đọc bởi người khác không? Điều gì đảm bảo không bị giả mạo?

4. Tại sao `protect` middleware tra lại DB (`User.findById`) thay vì chỉ dùng data từ token?

5. TTL Index trên `OtpCode` hoạt động như thế nào? Tại sao không dùng cron job?

---

## Tóm Tắt

- **bcrypt**: Hash password một chiều, salt ngẫu nhiên — chống rainbow table
- **JWT**: Token stateless, gồm header.payload.signature — không cần lưu phía server
- **protect middleware**: Đọc token từ Authorization header → verify → gắn req.user
- **authorize middleware**: Kiểm tra req.user.role có trong danh sách cho phép
- **OTP flow**: Gửi code qua email → user xác nhận → tạo account / reset password
- **Rate limiting**: Giới hạn số request để chống brute force
- **TTL Index**: MongoDB tự xóa OTP document sau khi hết hạn

