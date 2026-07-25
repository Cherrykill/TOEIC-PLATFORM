# Module 0: Tổng quan khóa học

---

## Khóa học này dạy gì?

Bạn sẽ xây dựng **hoàn chỉnh** một ứng dụng backend thực tế — từ dòng code đầu tiên đến lúc deploy lên cloud — dựa trên dự án **TOEIC Learning Platform**: nền tảng học từ vựng và luyện thi TOEIC tích hợp AI, gamification, và hệ thống thi đầy đủ.

Không học lý thuyết suông. Mỗi khái niệm đều gắn với code thật, file thật trong project.

---

## Yêu cầu đầu vào

| Bạn cần biết | Bạn KHÔNG cần biết |
|---|---|
| HTML căn bản (tag, form, link) | React / Vue / Angular |
| CSS căn bản (selector, box model) | Backend bất kỳ |
| JavaScript cơ bản (biến, hàm, if/else, vòng lặp) | Database |
| Cách dùng trình duyệt DevTools | Docker |

> Nếu bạn chưa chắc về JavaScript — Module 1 sẽ bổ sung toàn bộ phần cần thiết.

---

## Lộ trình học

```
GIAI ĐOẠN 1 — NỀN TẢNG (Module 1-3)
┌─────────────────────────────────────────┐
│  JavaScript nâng cao                    │
│  → ES6+, async/await, module            │
│                                         │
│  Node.js căn bản                        │
│  → Runtime, fs, path, http              │
│                                         │
│  Express.js & REST API                  │
│  → Server, routing, middleware          │
└─────────────────────────────────────────┘
            ↓
GIAI ĐOẠN 2 — DỮ LIỆU & XÁC THỰC (Module 4-6)
┌─────────────────────────────────────────┐
│  MongoDB & Mongoose                     │
│  → Schema, CRUD, quan hệ               │
│                                         │
│  Authentication                         │
│  → JWT, bcrypt, OTP email              │
│                                         │
│  Security                               │
│  → CORS, rate limit, Helmet            │
└─────────────────────────────────────────┘
            ↓
GIAI ĐOẠN 3 — TÍNH NĂNG NÂNG CAO (Module 7-11)
┌─────────────────────────────────────────┐
│  Redis & Caching                        │
│  Third-party API (AI, Email, TTS)       │
│  File Upload                            │
│  Async Queue (BullMQ)                  │
│  Logging (Winston)                      │
└─────────────────────────────────────────┘
            ↓
GIAI ĐOẠN 4 — PRODUCTION (Module 12-13)
┌─────────────────────────────────────────┐
│  Swagger / API Documentation            │
│  Docker & Deployment                    │
└─────────────────────────────────────────┘
            ↓
GIAI ĐOẠN 5 — CHUYÊN SÂU (Module 14-15)
┌─────────────────────────────────────────┐
│  Gamification & Algorithm (SM-2)        │
│  Capstone Project                       │
└─────────────────────────────────────────┘
```

---

## Cấu trúc mỗi module

Mỗi file trong bộ giáo trình này có cấu trúc thống nhất:

1. **Mục tiêu** — bạn sẽ làm được gì sau module này
2. **Tại sao cần học** — đặt vấn đề thực tế
3. **Lý thuyết** — giải thích khái niệm bằng ngôn ngữ đơn giản
4. **Trong project** — code thật từ dự án TOEIC, giải thích từng dòng
5. **Bài tập thực hành** — tự làm để khắc sâu
6. **Câu hỏi ôn tập** — kiểm tra hiểu bài
7. **Tóm tắt** — bullet points để review nhanh

---

## Cài đặt môi trường

### 1. Cài Node.js
Tải tại [nodejs.org](https://nodejs.org) — chọn bản **LTS** (ví dụ: 20.x).

Kiểm tra sau khi cài:
```bash
node --version    # v20.x.x
npm --version     # 10.x.x
```

### 2. Cài VS Code
Tải tại [code.visualstudio.com](https://code.visualstudio.com).

Extensions nên cài:
- **Thunder Client** — test API ngay trong VS Code
- **MongoDB for VS Code** — xem database trực quan
- **GitLens** — xem lịch sử git
- **Prettier** — format code tự động
- **ESLint** — phát hiện lỗi code

### 3. Cài Git
Tải tại [git-scm.com](https://git-scm.com).

### 4. Tài khoản cần có
| Dịch vụ | Link | Dùng để |
|---|---|---|
| MongoDB Atlas | mongodb.com/atlas | Database miễn phí |
| Gmail | gmail.com | Gửi OTP email |
| OpenAI | platform.openai.com | AI features |
| GitHub | github.com | Lưu code |
| Render | render.com | Deploy miễn phí |

### 5. Clone project về máy
```bash
git clone <repository-url>
cd backend-main
npm install
cp .env.example .env
# Điền các giá trị vào .env
npm run dev
```

---

## Cấu trúc project tổng quan

```
backend-main/
│
├── server.js              ← Điểm khởi động ứng dụng
├── package.json           ← Danh sách thư viện
├── .env                   ← Biến môi trường (secrets)
│
├── config/                ← Kết nối DB, Redis, OpenAI
├── controllers/           ← Logic xử lý request
├── models/                ← Cấu trúc dữ liệu (MongoDB)
├── routes/                ← Định nghĩa URL endpoints
├── middleware/            ← Xử lý trung gian
├── utils/                 ← Hàm tiện ích
├── queues/                ← BullMQ job queues
├── workers/               ← Background job workers
├── public/                ← File tĩnh (HTML, CSS, JS)
└── curriculum/            ← Bộ giáo trình này
```

---

## Cách đọc code trong giáo trình

Mỗi đoạn code sẽ có chú thích `// [?]` đánh dấu điểm cần chú ý:

```javascript
const express = require('express');  // [1] Import thư viện
const app = express();               // [2] Tạo ứng dụng
const PORT = 3000;

app.get('/', (req, res) => {         // [3] Định nghĩa route
    res.send('Hello World');         // [4] Gửi response
});

app.listen(PORT);                    // [5] Khởi động server
```

- `[1]` Giải thích sẽ đi kèm bên dưới
- `req` = request (dữ liệu client gửi lên)
- `res` = response (dữ liệu server trả về)

---

## Quy ước trong tài liệu

| Ký hiệu | Ý nghĩa |
|---|---|
| 📌 **Quan trọng** | Khái niệm cốt lõi, bắt buộc nhớ |
| 💡 **Mẹo** | Trick hay, tiết kiệm thời gian |
| ⚠️ **Cẩn thận** | Lỗi phổ biến cần tránh |
| 🔨 **Bài tập** | Phần tự thực hành |
| 🎯 **Trong project** | Code thật từ dự án TOEIC |

---

## Thời gian học dự kiến

| Giai đoạn | Module | Thời gian |
|---|---|---|
| Nền tảng | 1-3 | 3-4 tuần |
| Dữ liệu & Xác thực | 4-6 | 3-4 tuần |
| Tính năng nâng cao | 7-11 | 4-5 tuần |
| Production | 12-13 | 1-2 tuần |
| Chuyên sâu + Capstone | 14-15 | 2-3 tuần |
| **Tổng** | | **~3 tháng** |

> Học 2-3 tiếng/ngày, 5 ngày/tuần.

---

## Tóm tắt

- Khóa học xây dựng backend thực tế từ HTML/CSS lên production-ready app
- Mỗi module học qua code thật của dự án TOEIC
- Cần cài: Node.js, VS Code, Git
- Cần tài khoản: MongoDB Atlas, Gmail, GitHub
- Thời gian: ~3 tháng nếu học đều đặn
