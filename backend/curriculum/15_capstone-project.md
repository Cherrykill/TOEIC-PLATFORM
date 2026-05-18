# Module 15: Capstone Project — Tổng Kết và Xây Dựng Từ Đầu

---

## Mục tiêu

Module này là bài thi tổng hợp của toàn khóa học. Bạn sẽ:
- Ôn tập và củng cố tất cả kiến thức từ Module 1-14
- Xây dựng một backend API hoàn chỉnh từ đầu, không nhìn code có sẵn
- Có một project thực tế để đưa vào portfolio/CV
- Biết cách tiếp cận một yêu cầu mới từ đầu

---

## Tổng kết Kiến Thức

### Giai đoạn 1 — Nền tảng (Module 1-3)

| Module | Kiến thức chính |
|--------|----------------|
| 01 | ES6+: let/const, arrow functions, async/await, destructuring, modules |
| 02 | Node.js: runtime, fs, path, os, .env, CommonJS modules |
| 03 | Express: routing, middleware, MVC, REST conventions, error handling |

**Điều cần nhớ:**
- `async/await` là cách viết bất đồng bộ dễ đọc nhất
- Middleware chạy tuần tự — `next()` để tiếp tục, `res.json()` để kết thúc
- MVC: Routes định nghĩa URL, Controllers xử lý logic, Models là dữ liệu

### Giai đoạn 2 — Dữ liệu & Xác thực (Module 4-6)

| Module | Kiến thức chính |
|--------|----------------|
| 04 | MongoDB: Schema, Model, CRUD, middleware hooks, aggregation |
| 05 | Auth: bcrypt hash, JWT, OTP email, protect middleware, rate limiting |
| 06 | Security: Helmet, CORS whitelist, input validation, OWASP |

**Điều cần nhớ:**
- `bcrypt.hash()` + `bcrypt.compare()` — không bao giờ lưu password plaintext
- JWT = stateless token, verify bằng secret không cần tra DB
- `protect` middleware đọc Bearer token → gắn `req.user`

### Giai đoạn 3 — Tính năng nâng cao (Module 7-11)

| Module | Kiến thức chính |
|--------|----------------|
| 07 | Redis: in-memory cache, TTL, Cache-Aside pattern, graceful degradation |
| 08 | Third-party API: OpenAI, Nodemailer, TTS, error handling, fallbacks |
| 09 | File Upload: Multer, diskStorage, fileFilter, size limits |
| 10 | BullMQ: job queue, worker, retry, exponential backoff |
| 11 | Winston: log levels, transports, DailyRotateFile, Morgan integration |

**Điều cần nhớ:**
- Cache: Check → Miss → Query DB → Store. Invalidate khi data thay đổi
- Queue: Tách "đẩy việc" (nhanh) và "làm việc" (background, retry tự động)
- Logger: Không dùng `console.log` trong production — dùng Winston với levels

### Giai đoạn 4 — Production (Module 12-13)

| Module | Kiến thức chính |
|--------|----------------|
| 12 | Swagger: JSDoc annotations, schemas, $ref, bearerAuth |
| 13 | Docker: Dockerfile, multi-stage build, docker-compose, graceful shutdown |

**Điều cần nhớ:**
- Swagger docs = "hợp đồng" giữa frontend và backend
- Multi-stage build: Stage 1 build, Stage 2 chỉ có production code
- Graceful shutdown: Xử lý SIGTERM, đóng connections trước khi exit

### Giai đoạn 5 — Chuyên sâu (Module 14)

| Module | Kiến thức chính |
|--------|----------------|
| 14 | Gamification: XP/Level formula, Streak, SM-2 spaced repetition |

---

## Capstone Project: Blog API

Xây dựng **REST API cho một Blog platform** với các tính năng:

### Yêu cầu tính năng

**Authentication:**
- Đăng ký với xác nhận email (OTP)
- Đăng nhập → JWT token
- Role: `user` và `admin`

**Blog Posts:**
- CRUD posts (tạo, đọc, cập nhật, xóa)
- Upload ảnh thumbnail
- Phân trang, filter theo category/tag
- Cache danh sách posts (Redis)

**Comments:**
- Thêm/xóa comment (chỉ của mình)
- Admin xóa bất kỳ comment

**Notifications:**
- Gửi email thông báo khi có comment mới (BullMQ queue)

**Documentation:**
- Swagger UI đầy đủ

**Deployment:**
- Dockerfile và docker-compose
- Deploy lên Render

---

## Checklist Từng Bước

### Bước 1: Setup Project (Module 2, 3)

```bash
mkdir blog-api
cd blog-api
npm init -y
npm install express mongoose dotenv bcryptjs jsonwebtoken \
    nodemailer multer redis bullmq winston winston-daily-rotate-file \
    morgan helmet cors express-rate-limit swagger-jsdoc swagger-ui-express \
    compression
npm install -D nodemon
```

Cấu trúc thư mục:
```
blog-api/
├── server.js
├── .env
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── config/
│   ├── db.js          ← MongoDB connection
│   ├── redis.js       ← Redis connection
│   └── swagger.js     ← Swagger spec
├── models/
│   ├── User.js
│   ├── Post.js
│   ├── Comment.js
│   └── OtpCode.js
├── controllers/
│   ├── authController.js
│   ├── postController.js
│   └── commentController.js
├── routes/
│   ├── auth.js
│   ├── posts.js
│   └── comments.js
├── middleware/
│   ├── auth.js        ← protect, authorize
│   ├── cache.js       ← cacheMiddleware
│   ├── upload.js      ← multer config
│   └── errorHandler.js
├── queues/
│   └── index.js       ← emailQueue
├── workers/
│   └── emailWorker.js
└── utils/
    ├── logger.js
    └── emailService.js
```

**Checkpoint**: `npm run dev` chạy được, server start ở port 5000.

---

### Bước 2: Database Models (Module 4)

**User model** (tương tự project TOEIC):
```javascript
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isActive: { type: Boolean, default: true },
    bio: String,
    avatar: String,
}, { timestamps: true });

// Hash password pre-save hook
// comparePassword method
// generateToken method
```

**Post model:**
```javascript
const PostSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true },    // URL-friendly title
    content: { type: String, required: true },
    excerpt: String,                          // Short description
    thumbnail: String,                        // Image URL
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, required: true },
    tags: [String],
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    views: { type: Number, default: 0 },
    likesCount: { type: Number, default: 0 },
}, { timestamps: true });

// Pre-save hook: auto-generate slug từ title
PostSchema.pre('save', function() {
    if (this.isModified('title')) {
        this.slug = this.title
            .toLowerCase()
            .replace(/[^a-z0-9 ]/g, '')
            .replace(/\s+/g, '-');
    }
});
```

**Comment model:**
```javascript
const CommentSchema = new mongoose.Schema({
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, maxlength: 1000 },
}, { timestamps: true });
```

**Checkpoint**: Models import được, Mongoose kết nối MongoDB Atlas.

---

### Bước 3: Authentication (Module 5, 6)

**Routes cần implement:**
```
POST /api/auth/register/send-otp    ← Gửi OTP xác nhận email
POST /api/auth/register             ← Tạo account sau khi verify OTP
POST /api/auth/login                ← Đăng nhập → JWT
GET  /api/auth/me                   ← Lấy profile (cần token)
POST /api/auth/forgot-password      ← Gửi OTP reset password
POST /api/auth/reset-password       ← Đặt password mới
```

**Checklist:**
- [ ] Rate limiting trên register và login
- [ ] bcrypt hash password (cost=10)
- [ ] JWT token `{ id, role }` với expiry 7d
- [ ] `protect` middleware đọc Bearer token
- [ ] `authorize('admin')` middleware
- [ ] OTP expire sau 10 phút
- [ ] TTL index trên OtpCode collection

**Checkpoint**: Đăng ký → nhận OTP console (nếu chưa config email) → verify → đăng nhập → nhận token → gọi `/api/auth/me` với token.

---

### Bước 4: Post CRUD (Module 3, 4, 9)

**Routes:**
```
GET    /api/posts                   ← Lấy danh sách (phân trang, filter)
GET    /api/posts/:slug             ← Lấy một post
POST   /api/posts                   ← Tạo post (cần auth)
PUT    /api/posts/:id               ← Cập nhật (chỉ author hoặc admin)
DELETE /api/posts/:id               ← Xóa (chỉ author hoặc admin)
POST   /api/posts/:id/thumbnail     ← Upload ảnh thumbnail
```

**Checklist:**
- [ ] Phân trang: `?page=1&limit=10`
- [ ] Filter: `?category=tech&tag=nodejs`
- [ ] Chỉ trả về `published` posts cho public
- [ ] Author chỉ sửa/xóa post của mình
- [ ] Multer upload thumbnail (JPEG/PNG, max 5MB)
- [ ] Cache GET /api/posts 5 phút (Redis)
- [ ] Xóa cache khi tạo/sửa/xóa post

**Checkpoint**: CRUD posts hoạt động, ảnh upload được, cache hoạt động.

---

### Bước 5: Comments + Email Queue (Module 10)

**Routes:**
```
GET    /api/posts/:id/comments      ← Lấy comments của post
POST   /api/posts/:id/comments      ← Thêm comment (cần auth)
DELETE /api/comments/:id            ← Xóa comment (author hoặc admin)
```

**Email notification khi có comment mới:**
```javascript
// Sau khi lưu comment thành công
const post = await Post.findById(postId).populate('author');

await emailQueue.add('new-comment', {
    to: post.author.email,
    authorName: post.author.username,
    postTitle: post.title,
    commenterName: commenter.username,
    commentContent: newComment.content,
});
```

**Checkpoint**: Comment, email worker xử lý job, email gửi (hoặc log ra console).

---

### Bước 6: Swagger Documentation (Module 12)

Thêm JSDoc annotations cho tất cả routes. Ít nhất:

- [ ] Auth routes (login, register)
- [ ] Post routes (CRUD, upload)
- [ ] Comment routes

**Checkpoint**: `http://localhost:5000/api-docs` hiển thị tất cả endpoints, test được trực tiếp.

---

### Bước 7: Docker + Deploy (Module 13)

**Dockerfile:**
```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=appuser:appgroup . .
RUN mkdir -p public/uploads logs && chown -R appuser:appgroup public/uploads logs
USER appuser
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD wget -qO- http://localhost:5000/health || exit 1
CMD ["node", "server.js"]
```

**docker-compose.yml** (app + redis)

**Checkpoint:** `docker compose up --build` chạy được, API accessible.

**Deploy:**
1. Push code lên GitHub
2. Tạo Web Service trên Render.com
3. Cấu hình env vars
4. Deploy

---

## Tính Năng Bonus (Nếu Còn Thời Gian)

| Feature | Kiến thức cần | Độ khó |
|---------|--------------|--------|
| Like/Unlike post | CRUD, atomic `$inc` | ⭐ |
| Full-text search | MongoDB text index | ⭐⭐ |
| Admin dashboard stats | Aggregation | ⭐⭐ |
| Post reading time | Pre-save hook | ⭐ |
| RSS feed | Template generation | ⭐⭐ |
| Request metrics (như server.js) | Middleware, metrics | ⭐⭐⭐ |

---

## Cách Xây Dựng Portfolio

### Viết README tốt

```markdown
# Blog API

RESTful API cho blog platform với đầy đủ tính năng production.

## Tech Stack
- Node.js + Express.js
- MongoDB Atlas + Mongoose
- Redis (caching + job queue)
- BullMQ (async email)
- JWT Authentication
- Swagger API docs
- Docker

## Live Demo
- API: https://your-blog-api.onrender.com
- Docs: https://your-blog-api.onrender.com/api-docs

## Quick Start
\`\`\`bash
git clone https://github.com/you/blog-api
cd blog-api
cp .env.example .env
docker compose up
\`\`\`
```

### Điều recruiter tìm

- **Clean code**: Tổ chức folder MVC, đặt tên biến rõ ràng
- **Security**: bcrypt, JWT, input validation, rate limiting
- **Production-ready**: Dockerfile, graceful shutdown, health check
- **Documentation**: Swagger, README
- **Error handling**: Error handler middleware, try-catch, meaningful messages

---

## Hành Trình Đã Đi

Nhìn lại, từ Module 0 đến đây bạn đã học:

```
HTML/CSS cơ bản
      ↓
JavaScript ES6+: async/await, modules, destructuring
      ↓
Node.js: runtime, fs, path, npm, .env
      ↓
Express.js: routing, middleware, MVC, REST API
      ↓
MongoDB + Mongoose: schemas, CRUD, validation, aggregation
      ↓
Authentication: bcrypt, JWT, OTP email
      ↓
Security: Helmet, CORS, rate limiting, OWASP
      ↓
Redis: caching, TTL, Cache-Aside pattern
      ↓
Third-party APIs: OpenAI, Nodemailer, TTS
      ↓
File Upload: Multer, validation
      ↓
Async Queue: BullMQ, workers, retry
      ↓
Logging: Winston, log levels, rotation
      ↓
API Docs: Swagger/OpenAPI 3.0
      ↓
Docker: containerization, multi-stage build, compose
      ↓
Gamification + Algorithms: SM-2 spaced repetition
      ↓
  PRODUCTION-READY BACKEND DEVELOPER
```

Dự án TOEIC Learning Platform mà bạn đã học qua là một **senior-level production system** với:
- 44 API endpoints
- JWT + OTP authentication
- Redis caching
- BullMQ email queue
- Swagger documentation
- Docker deployment
- Admin dashboard với metrics real-time
- Gamification với 12 game modes
- SM-2 spaced repetition algorithm

**Bạn đã học và hiểu toàn bộ hệ thống này. Đó là thành tựu đáng tự hào.**

---

## Bước Tiếp Theo

Sau khi hoàn thành Capstone:

1. **Portfolio**: Upload dự án lên GitHub, viết README chi tiết
2. **Deploy**: Push lên Render.com để có live URL
3. **Nâng cao backend**:
   - TypeScript (type safety)
   - Testing: Jest + Supertest (unit & integration tests)
   - GraphQL (alternative to REST)
   - WebSockets (real-time features)
4. **DevOps**:
   - CI/CD với GitHub Actions
   - Kubernetes (container orchestration)
   - Monitoring: Prometheus + Grafana
5. **System Design**:
   - Microservices architecture
   - Message queues: Kafka
   - Caching strategies: Read-through, Write-behind

---

## Tài Liệu Tham Khảo

| Tài liệu | Link | Dùng để |
|---------|------|---------|
| Node.js Docs | nodejs.org/docs | Built-in modules API |
| Express Docs | expressjs.com | Express API reference |
| Mongoose Docs | mongoosejs.com/docs | Schema, Model, Query API |
| Redis Docs | redis.io/docs | Commands reference |
| BullMQ Docs | docs.bullmq.io | Queue/Worker API |
| Winston Docs | github.com/winstonjs/winston | Logger configuration |
| Swagger Editor | editor.swagger.io | Validate OpenAPI spec |
| Docker Docs | docs.docker.com | Dockerfile, compose reference |
| OWASP | owasp.org/Top10 | Security best practices |

---

## Tóm Tắt Toàn Khóa

Bạn đã học được một backend stack hoàn chỉnh:

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB + Redis
- **Auth**: JWT + bcrypt + OTP
- **Async**: BullMQ queues
- **Logging**: Winston
- **Docs**: Swagger
- **Deploy**: Docker + Render

Và quan trọng hơn, bạn đã học **cách suy nghĩ** của một backend developer:
- Tách biệt concerns (MVC)
- Không tin dữ liệu từ client (validate everything)
- Xử lý lỗi gracefully
- Cache để tối ưu performance
- Log để debug production issues
- Document để người khác dùng được API của bạn
