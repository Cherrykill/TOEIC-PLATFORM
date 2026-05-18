# Module 2: Node.js Căn Bản

---

## Mục tiêu

Sau module này bạn sẽ:
- Hiểu Node.js là gì và tại sao nó chạy được JavaScript ngoài trình duyệt
- Biết dùng các built-in modules quan trọng: `fs`, `path`, `os`, `http`
- Hiểu `npm` và `package.json`
- Biết đọc biến môi trường từ `.env`
- Nhìn vào `config/db.js` và `server.js` trong project và hiểu từng dòng code

---

## Tại sao cần học Node.js?

Bạn đã biết JavaScript chạy trong trình duyệt — nhưng trình duyệt là môi trường bị giới hạn: nó không thể đọc file, không thể kết nối database, không thể mở cổng mạng.

**Node.js** giải quyết vấn đề này. Nó là một **runtime** — môi trường thực thi — cho phép JavaScript chạy trực tiếp trên máy tính (hay server), với đầy đủ quyền hạn của một chương trình thực sự.

```
Trước Node.js:        Sau Node.js:
┌─────────────┐       ┌─────────────┐    ┌─────────────┐
│  Trình duyệt │       │  Trình duyệt │    │   Node.js   │
│  JavaScript │       │  JavaScript │    │  JavaScript │
│  (giới hạn) │       │  (frontend) │    │  (backend)  │
└─────────────┘       └─────────────┘    └─────────────┘
                                               │
                                    ┌──────────┴──────────┐
                                    │  Database │  Files   │
                                    │  Network  │  OS API  │
                                    └───────────────────── ┘
```

---

## 1. Node.js Runtime

### V8 Engine

Node.js dùng **V8** — engine JavaScript của Google Chrome — nhưng thêm vào các API để tương tác với hệ điều hành.

```javascript
// Trong trình duyệt — CÓ:
document.getElementById('btn');
window.location.href;
localStorage.setItem('key', 'value');

// Trong Node.js — KHÔNG CÓ những thứ trên
// Thay vào đó Node.js CÓ:
const fs = require('fs');      // Đọc/ghi file
const os = require('os');      // Thông tin máy tính
const http = require('http');  // Tạo web server
```

### Kiểm tra version

```bash
node --version    # v20.x.x
node -e "console.log('Hello from Node!')"
```

### REPL (Read-Eval-Print Loop)

```bash
node    # Mở interactive shell

> 2 + 2
4
> const name = "TOEIC"
> `Hello ${name}`
'Hello TOEIC'
> .exit   # Thoát
```

---

## 2. Built-in Modules

Node.js có sẵn nhiều module không cần `npm install`. Dùng `require()` để tải.

### 2.1 Module `path` — Xử lý đường dẫn file

📌 **Quan trọng**: Đường dẫn file khác nhau trên Windows (`\`) và Linux/Mac (`/`). Module `path` xử lý điều này tự động.

```javascript
const path = require('path');

// Nối đường dẫn an toàn (tự dùng / hay \ tùy OS)
path.join('/users', 'data', 'file.json');
// → '/users/data/file.json'  (Linux/Mac)
// → '\users\data\file.json'  (Windows)

// Lấy thư mục hiện tại của file đang chạy
console.log(__dirname);    // 'd:\PROGRAMS\OTHERS\backend-main\config'
console.log(__filename);   // 'd:\PROGRAMS\OTHERS\backend-main\config\db.js'

// Tách tên file
path.basename('/users/data/file.json');    // 'file.json'
path.extname('/users/data/file.json');     // '.json'
path.dirname('/users/data/file.json');     // '/users/data'

// Tạo đường dẫn tuyệt đối từ __dirname
path.join(__dirname, '..', 'data');        // Lên 1 cấp rồi vào thư mục 'data'
path.resolve(__dirname, '..', 'data');     // Tương tự, nhưng trả về absolute path
```

🎯 **Trong project — `config/db.js`:**

```javascript
// config/db.js — dòng 8-10
const DATA_DIR = path.join(__dirname, '..', 'data');
//                          │           │    └── thư mục 'data'
//                          │           └── đi lên 1 cấp (ra khỏi 'config/')
//                          └── thư mục chứa file đang chạy (= 'config/')
// Kết quả: 'backend-main/data'

const USERS_FILE = path.join(DATA_DIR, 'users.json');
// Kết quả: 'backend-main/data/users.json'
```

### 2.2 Module `fs` — Đọc/ghi file

```javascript
const fs = require('fs');           // Callback style (cũ)
const fs = require('fs/promises');  // Promise style (mới, dùng với async/await)
```

**Đọc file:**
```javascript
const fs = require('fs/promises');

// Đọc file text
const content = await fs.readFile('data.txt', 'utf8');
console.log(content);

// Đọc file JSON
const raw = await fs.readFile('data.json', 'utf8');
const data = JSON.parse(raw);
```

**Ghi file:**
```javascript
// Ghi text
await fs.writeFile('output.txt', 'Hello World', 'utf8');

// Ghi JSON (JSON.stringify chuyển object → string)
await fs.writeFile('data.json', JSON.stringify(data, null, 2), 'utf8');
//                                                        │    └── indent 2 spaces
//                                                        └── replacer (null = giữ nguyên)
```

**Kiểm tra file tồn tại:**
```javascript
try {
    await fs.access(filePath);
    console.log('File tồn tại');
} catch {
    console.log('File không tồn tại');
}
```

**Tạo thư mục:**
```javascript
await fs.mkdir('logs', { recursive: true });
// recursive: true → không báo lỗi nếu thư mục đã tồn tại
```

🎯 **Trong project — `config/db.js`:**

```javascript
// Hàm đọc JSON file với xử lý lỗi
async function readJSONFile(filePath, defaultValue = []) {
    try {
        await fs.access(filePath);              // [1] Kiểm tra file có tồn tại không
        const data = await fs.readFile(filePath, 'utf8');  // [2] Đọc nội dung
        return JSON.parse(data);                // [3] Chuyển string → object
    } catch (error) {
        if (error.code === 'ENOENT') {          // [4] Lỗi "file not found"
            // File không có → tạo mới với giá trị mặc định
            await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2));
            return defaultValue;
        }
        throw error;  // Lỗi khác thì ném ra ngoài
    }
}
```

### 2.3 Module `os` — Thông tin hệ điều hành

```javascript
const os = require('os');

os.platform();    // 'win32', 'linux', 'darwin'
os.arch();        // 'x64', 'arm64'
os.cpus().length; // Số CPU cores
os.freemem();     // RAM còn trống (bytes)
os.totalmem();    // Tổng RAM (bytes)
os.hostname();    // Tên máy tính

// RAM còn trống tính bằng MB
const freeRamMB = Math.round(os.freemem() / 1024 / 1024);
console.log(`Free RAM: ${freeRamMB} MB`);
```

### 2.4 Module `http` — Tạo web server thủ công

📌 Module này là nền tảng của Express.js. Hiểu nó giúp bạn hiểu Express.js làm gì "bên dưới".

```javascript
const http = require('http');

const server = http.createServer((req, res) => {
    // req = request (thông tin từ client)
    // res = response (dữ liệu trả về cho client)

    console.log(req.method);  // 'GET', 'POST', ...
    console.log(req.url);     // '/api/users', '/health', ...

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Hello World' }));
});

server.listen(3000, () => {
    console.log('Server chạy tại http://localhost:3000');
});
```

⚠️ **Lưu ý**: Trong thực tế, chúng ta dùng **Express.js** thay vì `http` trực tiếp vì Express giúp code gọn hơn nhiều. Module 3 sẽ học Express.js.

---

## 3. npm và package.json

### npm là gì?

**npm** (Node Package Manager) là kho thư viện lớn nhất thế giới. Có hơn 2 triệu packages cho Node.js.

```bash
npm install express        # Cài 1 package
npm install                # Cài tất cả từ package.json
npm install -D nodemon     # Cài devDependency (chỉ dùng lúc dev)
npm uninstall express      # Gỡ package
npm run dev                # Chạy script "dev" trong package.json
```

### package.json

File này là "hồ sơ" của project Node.js:

```json
{
  "name": "toeic-backend",
  "version": "1.0.0",
  "description": "TOEIC Learning Platform API",
  "main": "server.js",
  
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest"
  },
  
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^8.0.0",
    "bcryptjs": "^2.4.3"
  },
  
  "devDependencies": {
    "nodemon": "^3.0.0",
    "jest": "^29.0.0"
  }
}
```

- **`dependencies`** — Thư viện cần thiết khi chạy (production)
- **`devDependencies`** — Thư viện chỉ cần lúc phát triển (test, auto-reload)
- **`scripts`** — Lệnh tắt để chạy

### node_modules và .gitignore

Khi `npm install`, Node.js tải thư viện vào thư mục `node_modules`. Thư mục này rất nặng (hàng trăm MB) nên **không commit lên Git**:

```
# .gitignore
node_modules/
.env
```

Người khác clone repo về chỉ cần chạy `npm install` là đủ (npm sẽ tải lại từ package.json).

---

## 4. Biến Môi Trường (.env)

### Tại sao cần .env?

Code thường cần các thông tin nhạy cảm: database password, API key, JWT secret. Không được hardcode vào code vì:
- Commit lên GitHub → lộ thông tin
- Mỗi môi trường (dev/staging/production) có giá trị khác nhau

**Giải pháp**: Lưu vào file `.env`, đọc bằng thư viện `dotenv`.

### Cách dùng

```bash
# .env (KHÔNG commit file này lên Git)
PORT=5000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/toeic
JWT_SECRET=supersecretkey123
NODE_ENV=development
```

```javascript
// Đầu file server.js — phải gọi TRƯỚC KHI dùng process.env
require('dotenv').config();

// Sau đó dùng process.env ở bất kỳ đâu
const PORT = process.env.PORT || 5000;
//                              └── Giá trị mặc định nếu biến không tồn tại
const secret = process.env.JWT_SECRET;
```

### process.env

`process` là object toàn cục trong Node.js (không cần require), chứa thông tin về tiến trình đang chạy:

```javascript
process.env.NODE_ENV     // 'development' hoặc 'production'
process.env.PORT         // Cổng server
process.uptime()         // Số giây server đã chạy
process.memoryUsage()    // RAM đang dùng
process.exit(0)          // Thoát chương trình (0 = thành công, 1 = lỗi)
process.argv             // Tham số command line
```

🎯 **Trong project — `server.js`:**

```javascript
// server.js — dòng 1
require('dotenv').config();   // [1] Load .env vào process.env

// Kiểm tra biến bắt buộc phải có
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'];
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length > 0) {
    console.error(`Missing: ${missingEnv.join(', ')}`);
    process.exit(1);    // [2] Thoát với mã lỗi 1
}

// server.js — dòng 372
const PORT = process.env.PORT || 5000;   // [3] Đọc PORT, mặc định 5000
```

---

## 5. Module System

Module 1 đã học `import/export` (ES Modules). Node.js có cách riêng là **CommonJS**:

### CommonJS (require / module.exports)

```javascript
// math.js — Export
function add(a, b) { return a + b; }
function subtract(a, b) { return a - b; }

module.exports = { add, subtract };
// Hoặc:
module.exports.multiply = (a, b) => a * b;
```

```javascript
// app.js — Import
const math = require('./math');
console.log(math.add(2, 3));      // 5

// Destructuring
const { add, subtract } = require('./math');
console.log(add(2, 3));           // 5
```

### Quy tắc require

```javascript
// Thư viện cài từ npm (không có ./ ở đầu)
const express = require('express');
const path = require('path');       // Built-in module

// File trong project (phải có ./ hoặc ../)
const db = require('./config/db');
const logger = require('../utils/logger');
const User = require('./models/User');
```

🎯 **Trong project — `config/db.js`:**

```javascript
// config/db.js — dòng 1-3
const fs = require('fs/promises');  // Built-in
const path = require('path');       // Built-in
const logger = require('../utils/logger');  // File trong project

// ...

// Cuối file — export tất cả functions
module.exports = {
    connectDB,
    closeConnection,
    getUsers,
    saveUsers,
    getVocabulary,
    // ...
};
```

---

## 6. Event Loop — Tại Sao Node.js Nhanh?

### Vấn đề của I/O blocking

Hầu hết web server phải đọc database, đọc file — những thao tác này mất thời gian chờ (I/O). Nếu server "đứng chờ" trong lúc đó, nó không thể phục vụ request khác.

### Non-blocking I/O

Node.js giải quyết bằng **event loop**: thay vì chờ, nó đăng ký một callback và tiếp tục làm việc khác.

```
Request 1: Đọc DB ──────────────────────────────► Trả về
           └─ Gửi query → tiếp tục → nhận kết quả

Request 2: Đọc DB ────────────────────────────────► Trả về
           └─ Gửi query → tiếp tục → nhận kết quả

Thời gian:  |──────── 100ms ────────|
            Request 1 và 2 chạy "song song" (thực ra là xen kẽ)
```

```javascript
// BLOCKING (tránh dùng trong Node.js server):
const data = fs.readFileSync('big-file.txt');  // Chờ xong mới tiếp
doOtherWork();  // Chỉ chạy sau khi đọc xong

// NON-BLOCKING (chuẩn):
const data = await fs.readFile('big-file.txt');  // Không chờ
// Khi file đọc xong, Node.js sẽ tiếp tục từ đây
doOtherWork();  // Có thể chạy trong lúc chờ (nếu không có await)
```

---

## 7. Global Objects trong Node.js

```javascript
// Luôn có sẵn, không cần require
console.log('debug');
console.error('error');
console.warn('warning');

__dirname    // Thư mục chứa file hiện tại (absolute path)
__filename   // Đường dẫn đầy đủ của file hiện tại

process      // Thông tin về tiến trình Node.js
Buffer       // Xử lý dữ liệu nhị phân

// Timer (giống browser)
setTimeout(() => {}, 1000);
setInterval(() => {}, 5000);
clearTimeout(timerId);

// Chạy sau tất cả I/O callbacks trong vòng lặp hiện tại
setImmediate(() => { /* chạy ngay lần tiếp theo */ });
```

---

## 8. Tổng hợp: Luồng khởi động của project

Khi bạn chạy `npm run dev` (`nodemon server.js`), đây là điều xảy ra:

```
node server.js
    │
    ├── require('dotenv').config()    → Load .env vào process.env
    ├── Kiểm tra REQUIRED_ENV         → Thoát nếu thiếu biến quan trọng
    ├── require('./utils/logger')      → Khởi tạo Winston logger
    ├── require('express')             → Load Express framework
    ├── require('./config/swagger')    → Load Swagger spec
    │
    ├── app = express()                → Tạo Express app
    ├── app.use(helmet())              → Bảo mật HTTP headers
    ├── app.use(cors())                → Cho phép cross-origin requests
    ├── app.use(express.json())        → Parse JSON body
    │
    ├── app.use('/api/auth', ...)      → Mount routes
    ├── app.use('/api/users', ...)
    ├── ...
    │
    └── startServer()
            ├── connectDB()            → Load JSON files vào memory
            ├── connectMongoDB()       → Kết nối MongoDB Atlas
            ├── connectRedis()         → Kết nối Redis
            ├── startEmailWorker()     → Khởi động BullMQ worker
            └── app.listen(5000)       → Server bắt đầu nhận request
```

---

## Bài Tập Thực Hành

### Bài 1: Đọc và ghi file JSON
Tạo file `practice/bai1.js`:
```javascript
const fs = require('fs/promises');
const path = require('path');

const FILE_PATH = path.join(__dirname, 'students.json');

async function main() {
    // 1. Tạo mảng sinh viên
    const students = [
        { id: 1, name: 'Nguyễn Văn A', score: 850 },
        { id: 2, name: 'Trần Thị B', score: 720 },
    ];

    // 2. Ghi vào file
    await fs.writeFile(FILE_PATH, JSON.stringify(students, null, 2), 'utf8');
    console.log('Đã ghi file');

    // 3. Đọc lại
    const raw = await fs.readFile(FILE_PATH, 'utf8');
    const loaded = JSON.parse(raw);
    console.log('Đọc lại:', loaded);

    // 4. Thêm sinh viên mới và lưu lại
    loaded.push({ id: 3, name: 'Lê Văn C', score: 950 });
    await fs.writeFile(FILE_PATH, JSON.stringify(loaded, null, 2), 'utf8');
    console.log('Đã thêm sinh viên mới');
}

main().catch(console.error);
```

### Bài 2: Biến môi trường
Tạo file `.env` trong thư mục `practice/`:
```
APP_NAME=My App
SECRET_KEY=hello123
MAX_USERS=100
```

Tạo file `practice/bai2.js`:
```javascript
require('dotenv').config({ path: './.env' });

console.log('App name:', process.env.APP_NAME);
console.log('Max users:', parseInt(process.env.MAX_USERS));

// Kiểm tra biến bắt buộc
const required = ['APP_NAME', 'SECRET_KEY', 'DATABASE_URL'];
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
    console.error('Thiếu biến:', missing.join(', '));
    process.exit(1);
}
```

### Bài 3: Thông tin hệ thống
Tạo file `practice/bai3.js`:
```javascript
const os = require('os');
const path = require('path');

console.log('=== Thông tin hệ thống ===');
console.log('OS:', os.platform(), os.arch());
console.log('CPU cores:', os.cpus().length);
console.log('Total RAM:', Math.round(os.totalmem() / 1024 / 1024 / 1024), 'GB');
console.log('Free RAM:', Math.round(os.freemem() / 1024 / 1024), 'MB');
console.log('Home dir:', os.homedir());
console.log('Hostname:', os.hostname());
console.log('');
console.log('=== Node.js info ===');
console.log('Node version:', process.version);
console.log('Working dir:', process.cwd());
console.log('Script path:', __filename);
console.log('Script dir:', __dirname);
```

---

## Câu Hỏi Ôn Tập

1. **Sự khác biệt** giữa `require('fs')` và `require('fs/promises')` là gì? Khi nào dùng cái nào?

2. **`__dirname` và `process.cwd()`** khác nhau như thế nào? Khi nào nên dùng `__dirname` thay vì `process.cwd()`?

3. Trong `config/db.js`, tại sao dùng `path.join(__dirname, '..', 'data')` thay vì hardcode `'data/'`?

4. Nếu file `.env` chứa `PORT=3000` nhưng bạn viết `const PORT = process.env.PORT || 5000`, thì `PORT` có giá trị bao nhiêu? Tại sao?

5. `module.exports = {}` khác `exports.fn = ...` như thế nào?

---

## Tóm Tắt

- **Node.js** = JavaScript runtime chạy ngoài trình duyệt, dùng V8 engine
- **Built-in modules**: `fs` (file), `path` (đường dẫn), `os` (hệ thống), `http` (web server)
- **`path.join(__dirname, ...)`** — cách an toàn để tạo đường dẫn, tránh lỗi Windows/Linux
- **`fs/promises`** — dùng với async/await để đọc/ghi file không blocking
- **npm** — package manager, `package.json` là file cấu hình
- **`.env` + dotenv** — lưu secrets, đọc qua `process.env`
- **CommonJS**: `require()` để import, `module.exports` để export
- **Event Loop** — Node.js xử lý nhiều request đồng thời nhờ non-blocking I/O
