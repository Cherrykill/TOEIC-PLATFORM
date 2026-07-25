# Module 1: JavaScript Nâng Cao

> **Yêu cầu:** Biết JavaScript cơ bản (biến, hàm, if/else, vòng lặp)
> **Thời gian:** 1 tuần

---

## Mục tiêu

Sau module này bạn sẽ:
- Dùng được `let`, `const`, arrow function, template literal
- Hiểu và viết được `async/await`, `Promise`
- Dùng destructuring, spread operator thành thạo
- Hiểu `module` trong Node.js (`require` / `module.exports`)
- Không còn sợ callback hell

---

## Tại sao cần học phần này?

Toàn bộ backend Node.js viết bằng **JavaScript hiện đại (ES6+)**. Nếu bạn chỉ biết JavaScript cũ, bạn sẽ không đọc hiểu được code trong project.

Ví dụ code bạn sẽ gặp ngay trong `controllers/authController.js`:

```javascript
const login = async (req, res, next) => {
    const { identifier, password } = req.body;
    const user = await User.findOne({ email: identifier });
    if (!user) return res.status(401).json({ success: false, message: 'Không tìm thấy tài khoản' });
    // ...
};
```

5 tính năng ES6+ xuất hiện chỉ trong 4 dòng. Module này giải thích từng cái.

---

## 1. let và const (thay thế var)

### Vấn đề với `var`

```javascript
// VAR — hành xử kỳ lạ, tránh dùng
var x = 10;
if (true) {
    var x = 20;  // ghi đè x bên ngoài!
}
console.log(x);  // 20 — bất ngờ!
```

### Dùng `let` và `const` thay thế

```javascript
// LET — có thể thay đổi giá trị
let count = 0;
count = 1;  // OK

// CONST — không thể gán lại
const PORT = 5000;
PORT = 3000;  // LỖI!

// Nhưng object/array const vẫn thay đổi được bên trong
const user = { name: 'An' };
user.name = 'Bình';  // OK — không gán lại biến, chỉ thay đổi property
user = {};           // LỖI — gán lại biến
```

📌 **Quy tắc:** Luôn dùng `const`. Chỉ dùng `let` khi cần gán lại. Không bao giờ dùng `var`.

---

## 2. Arrow Function

```javascript
// Cách cũ
function add(a, b) {
    return a + b;
}

// Arrow function
const add = (a, b) => a + b;

// Nhiều dòng — cần dấu {} và return
const greet = (name) => {
    const message = `Xin chào ${name}`;
    return message;
};

// Một tham số — bỏ dấu ()
const double = n => n * 2;
```

### 🎯 Trong project — routes/auth.js

```javascript
router.post('/login', loginLimiter, authController.login);
//                                  ↑ truyền hàm như tham số — rất phổ biến trong Node.js
```

---

## 3. Template Literal (chuỗi có biến)

```javascript
// Cách cũ — nối chuỗi
const msg = 'Xin chào ' + name + ', bạn có ' + count + ' thông báo';

// Template literal — dùng backtick ``
const msg = `Xin chào ${name}, bạn có ${count} thông báo`;

// Nhiều dòng
const html = `
    <div>
        <h1>${title}</h1>
        <p>${content}</p>
    </div>
`;

// Biểu thức bên trong ${}
const status = `Trạng thái: ${isActive ? 'Hoạt động' : 'Khóa'}`;
```

### 🎯 Trong project — utils/emailService.js

```javascript
const subject = isReset
    ? '🔐 Mã đặt lại mật khẩu TOEIC App'
    : '✅ Mã xác nhận đăng ký TOEIC App';

// Template literal tạo HTML email
const html = `
<!DOCTYPE html>
<html>
  <body>
    <span style="font-size:40px;">${code}</span>
  </body>
</html>`;
```

---

## 4. Destructuring (Giải cấu trúc)

### Object destructuring

```javascript
const user = {
    name: 'Nguyễn An',
    email: 'an@gmail.com',
    age: 25
};

// Cách cũ
const name = user.name;
const email = user.email;

// Destructuring
const { name, email } = user;

// Đổi tên khi destructure
const { name: fullName, email: userEmail } = user;

// Giá trị mặc định
const { name, role = 'user' } = user;  // role = 'user' nếu không có trong object
```

### Array destructuring

```javascript
const colors = ['đỏ', 'xanh', 'vàng'];

const [first, second] = colors;
// first = 'đỏ', second = 'xanh'

// Bỏ qua phần tử
const [, , third] = colors;
// third = 'vàng'
```

### 🎯 Trong project — controllers/authController.js

```javascript
const login = async (req, res, next) => {
    const { identifier, password } = req.body;
    // Thay vì: const identifier = req.body.identifier;
    //          const password = req.body.password;
```

```javascript
// Destructure khi import nhiều hàm
const { connectDB, closeConnection } = require('./config/db');
```

---

## 5. Spread & Rest Operator (`...`)

### Spread — "trải ra"

```javascript
// Sao chép array
const arr1 = [1, 2, 3];
const arr2 = [...arr1, 4, 5];  // [1, 2, 3, 4, 5]

// Merge object
const defaults = { theme: 'dark', lang: 'vi' };
const userPrefs = { lang: 'en' };
const settings = { ...defaults, ...userPrefs };
// { theme: 'dark', lang: 'en' }  — userPrefs ghi đè defaults
```

### Rest — "gom lại"

```javascript
// Hàm nhận số lượng tham số không xác định
function sum(...numbers) {
    return numbers.reduce((total, n) => total + n, 0);
}
sum(1, 2, 3, 4);  // 10

// Lấy phần còn lại
const { password, ...publicUser } = user;
// publicUser = user nhưng không có password — dùng để trả về API
```

### 🎯 Trong project — middleware/errorHandler.js

```javascript
res.status(500).json({
    success: false,
    message: error.message,
    ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,    // Chỉ thêm stack khi dev — spread có điều kiện
    }),
});
```

---

## 6. Promise — Xử lý bất đồng bộ

### Vấn đề: Code bất đồng bộ

Khi gọi database, API, đọc file — JavaScript **không chờ** mà chạy tiếp:

```javascript
// SAI — đọc file mất thời gian, result sẽ là undefined
const result = readFile('data.json');
console.log(result);  // undefined!

// ĐÚNG — phải xử lý bất đồng bộ
```

### Promise là gì?

Promise là một "lời hứa" rằng giá trị sẽ có trong tương lai:

```javascript
const promise = new Promise((resolve, reject) => {
    // Giả lập đọc database sau 1 giây
    setTimeout(() => {
        const success = true;
        if (success) {
            resolve({ name: 'Nguyễn An' });  // Thành công
        } else {
            reject(new Error('Không tìm thấy'));  // Thất bại
        }
    }, 1000);
});

// Sử dụng
promise
    .then(user => console.log(user))       // Khi resolve
    .catch(err => console.error(err));     // Khi reject
```

### Trạng thái của Promise

```
Promise
├── pending   → đang chờ
├── fulfilled → thành công (resolve được gọi)
└── rejected  → thất bại (reject được gọi)
```

---

## 7. async/await — Cách viết Promise đẹp hơn

`async/await` không phải tính năng mới — nó chỉ là **cú pháp đẹp hơn** để viết Promise.

```javascript
// Với .then().catch()
function getUser(id) {
    return fetch(`/api/users/${id}`)
        .then(res => res.json())
        .then(data => data.user)
        .catch(err => console.error(err));
}

// Với async/await — đọc như code đồng bộ
async function getUser(id) {
    try {
        const res = await fetch(`/api/users/${id}`);
        const data = await res.json();
        return data.user;
    } catch (err) {
        console.error(err);
    }
}
```

### Quy tắc async/await

```javascript
// 1. Hàm có await PHẢI có async
async function example() {
    const result = await somePromise();  // await chỉ dùng trong async function
}

// 2. await làm code "chờ" — nhưng không block toàn app
async function fetchData() {
    console.log('Bắt đầu');
    const data = await getFromDatabase();  // chờ database
    console.log('Xong:', data);            // chạy sau khi có data
}

// 3. Luôn dùng try/catch để bắt lỗi
async function safeOperation() {
    try {
        const result = await riskyOperation();
        return result;
    } catch (error) {
        console.error('Lỗi:', error.message);
        throw error;  // Ném lỗi lên để caller xử lý
    }
}
```

### 🎯 Trong project — controllers/authController.js

```javascript
// Toàn bộ controller dùng async/await
const login = async (req, res, next) => {
    try {
        const { identifier, password } = req.body;

        // await — chờ database tìm user
        const user = await User.findOne({ email: identifier });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Sai tài khoản' });
        }

        // await — chờ bcrypt so sánh password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Sai mật khẩu' });
        }

        // Tạo JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

        res.json({ success: true, token, user });

    } catch (error) {
        next(error);  // Chuyển lỗi cho error handler
    }
};
```

---

## 8. Module trong Node.js

Node.js dùng hệ thống module để chia code thành các file nhỏ.

### Xuất (export)

```javascript
// utils/helper.js

// Xuất một hàm
function add(a, b) {
    return a + b;
}
module.exports = add;

// Xuất nhiều thứ
module.exports = {
    add,
    subtract: (a, b) => a - b,
    PI: 3.14159,
};
```

### Nhập (import/require)

```javascript
// app.js

// Nhập một hàm
const add = require('./utils/helper');

// Nhập nhiều thứ (destructuring)
const { add, subtract, PI } = require('./utils/helper');

// Nhập thư viện (không có ./)
const express = require('express');
const mongoose = require('mongoose');
```

### 🎯 Trong project — server.js

```javascript
// Nhập thư viện bên ngoài
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// Nhập module nội bộ (có ./)
const { connectDB } = require('./config/db');
const { connectMongoDB } = require('./config/mongodb');
const errorHandler = require('./middleware/errorHandler');

// Nhập routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/vocabulary', require('./routes/vocabulary'));
```

---

## 9. Array Methods quan trọng

### map — Biến đổi từng phần tử

```javascript
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
// [2, 4, 6, 8, 10]

const users = [{ name: 'An', age: 25 }, { name: 'Bình', age: 30 }];
const names = users.map(u => u.name);
// ['An', 'Bình']
```

### filter — Lọc phần tử

```javascript
const scores = [45, 78, 92, 33, 88];
const passing = scores.filter(s => s >= 60);
// [78, 92, 88]
```

### find — Tìm phần tử đầu tiên thỏa điều kiện

```javascript
const users = [
    { id: 1, name: 'An' },
    { id: 2, name: 'Bình' },
];
const user = users.find(u => u.id === 2);
// { id: 2, name: 'Bình' }
```

### reduce — Rút gọn về một giá trị

```javascript
const prices = [100, 200, 300];
const total = prices.reduce((sum, price) => sum + price, 0);
// 600
```

### 🎯 Trong project — server.js

```javascript
// Lấy các env vars bị thiếu
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);

// Tính latency percentile
const sorted = [...metrics.latencies].sort((a, b) => a - b);
const p95 = sorted[Math.floor(sorted.length * 0.95)];
```

---

## 10. Optional Chaining và Nullish Coalescing

```javascript
// Optional chaining ?.
// Thay vì: if (user && user.address && user.address.city)
const city = user?.address?.city;  // undefined nếu bất kỳ bước nào null

// Nullish coalescing ??
// Chỉ dùng default khi giá trị là null hoặc undefined
const port = process.env.PORT ?? 5000;
// Khác || ở chỗ: 0 || 5000 = 5000, nhưng 0 ?? 5000 = 0

// 🎯 Trong project — server.js
await emailWorker?.close();  // Chỉ gọi close() nếu emailWorker không null
```

---

## Bài tập thực hành

### Bài 1: Refactor code cũ
Viết lại đoạn code sau bằng ES6+:
```javascript
// Code cũ cần refactor
var name = 'Nguyễn An';
var age = 25;

function greetUser(name, age) {
    return 'Xin chào ' + name + ', bạn ' + age + ' tuổi';
}

var users = [1, 2, 3, 4, 5];
var evenUsers = [];
for (var i = 0; i < users.length; i++) {
    if (users[i] % 2 === 0) {
        evenUsers.push(users[i]);
    }
}
```

### Bài 2: async/await
Viết hàm `fetchUserData(userId)` giả lập gọi API:
- Sau 1 giây trả về `{ id: userId, name: 'Test User' }`
- Nếu `userId <= 0` thì reject với lỗi `'Invalid userId'`
- Dùng `async/await` và `try/catch` để gọi hàm này

### Bài 3: Destructuring thực tế
Cho object sau, dùng destructuring để lấy ra các giá trị cần thiết:
```javascript
const response = {
    status: 200,
    data: {
        user: {
            id: 'abc123',
            profile: {
                name: 'Nguyễn An',
                email: 'an@gmail.com',
                settings: {
                    theme: 'dark',
                    notifications: true
                }
            }
        },
        token: 'eyJhbGci...'
    }
};
// Lấy: name, email, theme, token trong một dòng
```

---

## Câu hỏi ôn tập

1. Sự khác nhau giữa `let`, `const`, `var` là gì?
2. Arrow function khác function thường ở điểm nào quan trọng nhất?
3. `async/await` có làm code chạy nhanh hơn không? Tại sao?
4. `Promise.resolve()` và `Promise.reject()` dùng để làm gì?
5. Destructuring `const { a, b } = obj` có lỗi không nếu `obj.b` không tồn tại?

---

## Tóm tắt

- **`const`/`let`** thay thế `var` — `const` là mặc định
- **Arrow function** `(a, b) => a + b` — ngắn gọn hơn function
- **Template literal** `` `Hello ${name}` `` — nối chuỗi đẹp hơn
- **Destructuring** `const { a, b } = obj` — lấy nhiều giá trị cùng lúc
- **Spread** `...arr` — sao chép, merge array/object
- **Promise** — đại diện cho giá trị trong tương lai (async)
- **async/await** — viết code async dễ đọc như sync
- **require/module.exports** — hệ thống module của Node.js
- **map/filter/find/reduce** — xử lý array không cần vòng lặp
