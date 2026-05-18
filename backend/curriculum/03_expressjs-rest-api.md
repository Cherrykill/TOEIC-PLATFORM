# Module 3: Express.js & REST API

---

## Mục tiêu

Sau module này bạn sẽ:
- Hiểu Express.js là gì và tại sao dùng nó thay vì `http` thuần
- Biết định nghĩa routes (GET, POST, PUT, DELETE)
- Biết dùng middleware và hiểu cơ chế `next()`
- Hiểu request/response object và các method quan trọng
- Hiểu kiến trúc MVC: tách Route, Controller, Model
- Đọc được toàn bộ `server.js`, `routes/`, `controllers/` trong project

---

## Tại sao cần Express.js?

Module 2 đã thấy server viết bằng `http` thuần:

```javascript
// Cách cũ — http thuần:
const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/api/users') {
        // code xử lý
    } else if (req.method === 'POST' && req.url === '/api/users') {
        // code khác
    } else if (req.method === 'GET' && req.url.startsWith('/api/users/')) {
        const id = req.url.split('/')[3];  // Lấy ID từ URL thủ công
        // ...
    }
    // Phải tự parse body, tự set headers, tự xử lý lỗi...
});
```

**Express.js** làm cho code gọn gàng hơn rất nhiều:

```javascript
// Cách mới — Express:
const app = express();

app.get('/api/users', getAllUsers);
app.post('/api/users', createUser);
app.get('/api/users/:id', getUserById);   // :id là tham số động
```

Express là **web framework** nhỏ gọn, không opinionated — nó không bắt bạn phải làm theo một cách cụ thể.

---

## 1. Tạo Express App

```javascript
const express = require('express');
const app = express();           // [1] Tạo ứng dụng

// Cấu hình middleware
app.use(express.json());         // [2] Parse JSON body tự động

// Định nghĩa route
app.get('/', (req, res) => {     // [3] Xử lý GET /
    res.json({ message: 'Hello World' });
});

// Khởi động server
app.listen(5000, () => {         // [4] Lắng nghe cổng 5000
    console.log('Server chạy tại http://localhost:5000');
});
```

---

## 2. Routing

### HTTP Methods

REST API dùng các HTTP method để phân biệt hành động:

| Method | Hành động | Ví dụ |
|--------|-----------|-------|
| `GET` | Lấy dữ liệu | Lấy danh sách từ vựng |
| `POST` | Tạo mới | Đăng ký tài khoản |
| `PUT` / `PATCH` | Cập nhật | Sửa thông tin user |
| `DELETE` | Xóa | Xóa từ vựng |

```javascript
app.get('/api/vocabulary', handler);        // Lấy danh sách
app.post('/api/vocabulary', handler);       // Tạo từ mới
app.put('/api/vocabulary/:id', handler);    // Cập nhật từ có id
app.delete('/api/vocabulary/:id', handler); // Xóa từ có id
```

### Route Parameters

```javascript
// :id là tham số — bất kỳ giá trị nào
app.get('/api/users/:id', (req, res) => {
    const userId = req.params.id;   // Lấy từ req.params
    res.json({ id: userId });
});

// Nhiều tham số
app.get('/api/tests/:testId/questions/:qId', (req, res) => {
    const { testId, qId } = req.params;
});
```

### Query String

```javascript
// URL: /api/vocabulary?page=2&limit=20&type=noun
app.get('/api/vocabulary', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const type = req.query.type;   // 'noun'
});
```

🎯 **Trong project — `routes/vocabulary.js`:**

```javascript
// routes/vocabulary.js — dòng 43
router.get('/', getAllVocabulary);
// Khi gọi GET /api/vocabulary?page=1&limit=20
// → req.query = { page: '1', limit: '20' }
```

### Router — Tách routes thành file riêng

Thay vì định nghĩa tất cả route trong `server.js`, Express cho phép tách thành các file riêng:

```javascript
// routes/vocabulary.js
const express = require('express');
const router = express.Router();  // Tạo mini-app

router.get('/', getAllVocabulary);
router.get('/stats', getVocabularyStats);
router.get('/:id', getVocabularyById);
router.post('/', createVocabulary);

module.exports = router;  // Export router
```

```javascript
// server.js
app.use('/api/vocabulary', require('./routes/vocabulary'));
// → GET /api/vocabulary     → router.get('/')
// → GET /api/vocabulary/stats → router.get('/stats')
// → GET /api/vocabulary/123   → router.get('/:id') với params.id = '123'
```

---

## 3. Request Object (req)

```javascript
app.post('/api/login', (req, res) => {
    // Body (từ JSON body của request)
    const { email, password } = req.body;

    // URL params
    const userId = req.params.id;

    // Query string
    const page = req.query.page;

    // Headers
    const token = req.headers.authorization;
    const contentType = req.headers['content-type'];

    // IP địa chỉ client
    const clientIP = req.ip;

    // Method và URL
    console.log(req.method);  // 'POST'
    console.log(req.url);     // '/api/login'
    console.log(req.path);    // '/api/login'

    // Gắn dữ liệu vào req để middleware sau dùng
    req.user = { id: 1, name: 'Admin' };
});
```

🎯 **Trong project — `middleware/auth.js`:**

```javascript
// Middleware đọc token từ header
const protect = async (req, res, next) => {
    // req.headers.authorization = "Bearer eyJhbGci..."
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];   // Lấy phần sau "Bearer "
    }
    // ... verify token rồi gắn user vào req
    req.user = { id: user._id, username: user.username, role: user.role };
    next();
};
```

---

## 4. Response Object (res)

```javascript
app.get('/example', (req, res) => {
    // Gửi JSON (phổ biến nhất với API)
    res.json({ success: true, data: [] });

    // Gửi với status code
    res.status(201).json({ success: true, message: 'Created' });
    res.status(404).json({ success: false, message: 'Not found' });
    res.status(500).json({ success: false, message: 'Server error' });

    // Gửi file
    res.sendFile(path.join(__dirname, 'public', 'index.html'));

    // Redirect
    res.redirect('/dashboard');

    // Set header
    res.set('X-Custom-Header', 'value');
});
```

### Status codes quan trọng

| Code | Ý nghĩa | Khi nào dùng |
|------|---------|-------------|
| 200 | OK | Request thành công |
| 201 | Created | Tạo resource mới thành công |
| 400 | Bad Request | Dữ liệu gửi lên sai |
| 401 | Unauthorized | Chưa đăng nhập / token hết hạn |
| 403 | Forbidden | Đã đăng nhập nhưng không có quyền |
| 404 | Not Found | Resource không tồn tại |
| 409 | Conflict | Trùng lặp (email đã tồn tại) |
| 500 | Internal Server Error | Lỗi server |

---

## 5. Middleware

### Middleware là gì?

Middleware là hàm chạy **giữa** request và response. Mỗi middleware có thể:
1. Đọc/sửa `req` và `res`
2. Kết thúc request bằng `res.json()`
3. Hoặc gọi `next()` để chuyển sang middleware tiếp theo

```
Request → [Middleware 1] → [Middleware 2] → [Route Handler] → Response
                ↓                ↓                 ↓
           (helmet)          (auth check)      (business logic)
```

### Cấu trúc middleware

```javascript
// Middleware có 3 tham số: req, res, next
const logMiddleware = (req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();   // ← PHẢI gọi next() để tiếp tục, nếu không request bị treo
};

// Middleware xử lý lỗi có 4 tham số (err là tham số đầu tiên)
const errorMiddleware = (err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
};
```

### Đăng ký middleware

```javascript
// Global middleware — áp dụng cho MỌI request
app.use(express.json());
app.use(cors());
app.use(helmet());

// Middleware cho route cụ thể
app.get('/admin', isAdmin, (req, res) => { ... });
//                 └── isAdmin chạy trước, nếu pass thì mới vào handler

// Middleware cho router
router.use(protect);    // Áp dụng cho tất cả routes trong router này
```

🎯 **Trong project — `server.js`:**

```javascript
// server.js — Global middleware stack
app.use(helmet({ ... }));           // [1] Bảo mật HTTP headers
app.use(compression({ ... }));      // [2] Nén response (gzip)
app.use(cors({ ... }));             // [3] Cross-Origin Resource Sharing
app.use(express.json());            // [4] Parse JSON body
app.use(express.urlencoded({ extended: true }));  // [5] Parse form data
app.use(morgan('dev', { ... }));    // [6] Log mỗi request ra console
```

Khi một request đến, nó đi qua **lần lượt** tất cả middleware theo thứ tự đăng ký.

### Middleware có điều kiện

```javascript
// Chỉ apply cho route bắt đầu bằng /api/admin
app.use('/api/admin', protect, authorize('admin'));

// Middleware trong route definition
router.get('/profile', protect, getProfile);
//                     └── protect chạy trước getProfile
```

---

## 6. Kiến Trúc MVC

Project này theo kiến trúc **MVC** (Model - View - Controller):

```
Request
   │
   ▼
routes/auth.js         ← Route: định nghĩa URL + middleware
   │
   ▼
controllers/authController.js   ← Controller: logic xử lý
   │
   ▼
models/User.js         ← Model: cấu trúc dữ liệu + DB operations
   │
   ▼
Response
```

### Routes — Chỉ định nghĩa URL

```javascript
// routes/auth.js
const router = express.Router();

// Route chỉ biết: URL nào → hàm nào xử lý
// KHÔNG chứa logic business
router.post('/login', loginLimiter, authController.login);
router.post('/register/send-otp', otpLimiter, authController.sendRegisterOtp);
router.post('/register', registerLimiter, authController.register);
router.get('/me', protect, authController.getMe);
router.post('/logout', protect, authController.logout);
```

### Controllers — Chứa logic xử lý

```javascript
// controllers/authController.js — hàm login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;     // [1] Lấy dữ liệu từ request

        // [2] Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email và password là bắt buộc'
            });
        }

        // [3] Tìm user trong DB
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Sai email' });
        }

        // [4] Kiểm tra password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Sai password' });
        }

        // [5] Tạo JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        // [6] Trả về response
        res.json({ success: true, token, user: { id: user._id, username: user.username } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
```

### Models — Cấu trúc dữ liệu

```javascript
// models/User.js (sẽ học chi tiết ở Module 4)
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
});

module.exports = mongoose.model('User', UserSchema);
```

---

## 7. Error Handling

### Try-catch trong controller

```javascript
const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
```

### Global Error Handler Middleware

Thay vì xử lý lỗi trong từng controller, dùng một middleware tập trung:

```javascript
// Trong controller — ném lỗi ra
const getUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        res.json({ data: user });
    } catch (error) {
        next(error);   // Chuyển lỗi sang global error handler
    }
};
```

```javascript
// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
    logger.error('Request error', { method: req.method, url: req.originalUrl, error: err.message });

    // Xử lý các loại lỗi MongoDB
    if (err.name === 'CastError')       return res.status(404).json({ message: 'Not found' });
    if (err.code === 11000)             return res.status(400).json({ message: 'Duplicate field' });
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });

    // Lỗi JWT
    if (err.name === 'JsonWebTokenError')  return res.status(401).json({ message: 'Invalid token' });
    if (err.name === 'TokenExpiredError')  return res.status(401).json({ message: 'Token expired' });

    // Lỗi mặc định
    res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Server Error' });
};

// Đăng ký CUỐI CÙNG trong server.js
app.use(errorHandler);
```

---

## 8. REST API Conventions

### Chuẩn đặt tên URL

```
GET    /api/vocabulary          ← Lấy danh sách
GET    /api/vocabulary/:id      ← Lấy một item
POST   /api/vocabulary          ← Tạo mới
PUT    /api/vocabulary/:id      ← Cập nhật toàn bộ
PATCH  /api/vocabulary/:id      ← Cập nhật một phần
DELETE /api/vocabulary/:id      ← Xóa

GET    /api/users/:id/badges    ← Nested resource
POST   /api/auth/login          ← Hành động (không phải resource)
```

### Chuẩn format response

```javascript
// Thành công
{
    "success": true,
    "data": { ... },        // Hoặc mảng []
    "message": "...",       // Optional
    "pagination": {         // Nếu có phân trang
        "page": 1,
        "limit": 20,
        "total": 150
    }
}

// Lỗi
{
    "success": false,
    "message": "Mô tả lỗi rõ ràng"
}
```

🎯 **Trong project** — tất cả responses đều theo format này. Ví dụ từ `routes/vocabulary.js`:

```javascript
// Controller trả về
res.json({
    success: true,
    data: vocabulary,
    pagination: {
        page,
        limit,
        total: allVocabulary.length,
        totalPages: Math.ceil(allVocabulary.length / limit)
    }
});
```

---

## 9. Static Files và Serving HTML

```javascript
// Serve thư mục public/ làm static files
app.use(express.static(path.join(__dirname, 'public')));

// Người dùng truy cập:
// http://localhost:5000/        → public/index.html
// http://localhost:5000/app.js  → public/app.js
// http://localhost:5000/style.css → public/style.css
```

🎯 **Trong project:**

```javascript
// server.js — dòng 172-173
app.use(express.static(path.join(__dirname, 'public')));
app.use('/static', express.static(path.join(__dirname, 'public', 'admin')));

// SPA fallback — mọi URL không khớp đều trả về index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
```

---

## Bài Tập Thực Hành

### Bài 1: CRUD API đơn giản

Tạo file `practice/bai-express/server.js` với CRUD API cho "tasks":

```javascript
const express = require('express');
const app = express();
app.use(express.json());

// In-memory storage
let tasks = [
    { id: 1, title: 'Học Node.js', done: false },
    { id: 2, title: 'Học Express', done: false },
];
let nextId = 3;

// GET /tasks — Lấy tất cả
app.get('/tasks', (req, res) => {
    res.json({ success: true, data: tasks });
});

// GET /tasks/:id — Lấy một task
app.get('/tasks/:id', (req, res) => {
    const task = tasks.find(t => t.id === parseInt(req.params.id));
    if (!task) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
    res.json({ success: true, data: task });
});

// POST /tasks — Tạo mới
app.post('/tasks', (req, res) => {
    const { title } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'title là bắt buộc' });

    const task = { id: nextId++, title, done: false };
    tasks.push(task);
    res.status(201).json({ success: true, data: task });
});

// PUT /tasks/:id — Cập nhật
app.put('/tasks/:id', (req, res) => {
    const idx = tasks.findIndex(t => t.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ success: false, message: 'Không tìm thấy' });

    tasks[idx] = { ...tasks[idx], ...req.body };
    res.json({ success: true, data: tasks[idx] });
});

// DELETE /tasks/:id — Xóa
app.delete('/tasks/:id', (req, res) => {
    const idx = tasks.findIndex(t => t.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ success: false, message: 'Không tìm thấy' });

    tasks.splice(idx, 1);
    res.json({ success: true, message: 'Đã xóa' });
});

app.listen(3000, () => console.log('Server chạy tại http://localhost:3000'));
```

Test bằng curl hoặc Thunder Client:
```bash
curl http://localhost:3000/tasks
curl -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{"title":"Học MongoDB"}'
curl -X DELETE http://localhost:3000/tasks/1
```

### Bài 2: Middleware tùy chỉnh

Thêm vào bài 1:
```javascript
// 1. Logger middleware — log mỗi request
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// 2. Auth middleware cho route DELETE
const fakeAuth = (req, res, next) => {
    const key = req.headers['x-api-key'];
    if (key !== 'secret123') {
        return res.status(401).json({ success: false, message: 'Cần API key' });
    }
    next();
};

// Áp dụng fakeAuth cho route DELETE
app.delete('/tasks/:id', fakeAuth, (req, res) => { ... });
```

---

## Câu Hỏi Ôn Tập

1. Tại sao phải gọi `next()` trong middleware? Điều gì xảy ra nếu không gọi?

2. Sự khác biệt giữa `req.params`, `req.query`, và `req.body`?
   - URL: `PUT /api/users/123?notify=true` với body `{ "name": "Alice" }`
   - `req.params.id` = ?
   - `req.query.notify` = ?
   - `req.body.name` = ?

3. Tại sao `app.use(errorHandler)` phải đặt **cuối cùng** trong `server.js`?

4. Trong MVC, tại sao không nên viết code database trực tiếp trong route file?

5. Sự khác biệt giữa `res.json()` và `res.send()`?

---

## Tóm Tắt

- **Express** = web framework cho Node.js, đơn giản hóa routing và middleware
- **Routes**: Tách thành file riêng, dùng `express.Router()`
- **Middleware**: Hàm chạy giữa request và response, phải gọi `next()` để tiếp tục
- **MVC**: Routes → Controllers → Models — tách biệt trách nhiệm
- **req.params** / **req.query** / **req.body** — ba cách dữ liệu đến từ client
- **res.status(code).json({})** — cách chuẩn trả response
- **Error handler** 4 tham số `(err, req, res, next)` — đặt cuối cùng trong app
- **REST conventions**: URL dùng noun, HTTP method diễn đạt hành động
