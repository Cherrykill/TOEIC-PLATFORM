# Module 11: Logging với Winston

---

## Mục tiêu

Sau module này bạn sẽ:
- Hiểu tại sao `console.log` không đủ cho production
- Biết các log levels và khi nào dùng cái nào
- Biết cấu hình Winston với multiple transports
- Biết rotate log files hàng ngày để tránh đầy ổ cứng
- Biết tích hợp Winston với Morgan (HTTP request logging)
- Đọc được `utils/logger.js`

---

## Tại sao không dùng console.log?

```javascript
// Cách nhiều bạn đang làm:
console.log('User đăng nhập:', userId);
console.log('Database connected');
console.error('Lỗi:', error);
```

**Vấn đề trong production:**
- Logs đi đâu? Chỉ in ra terminal — không lưu lại
- Không có timestamp → không biết lỗi xảy ra lúc nào
- Không có log levels → không thể filter "chỉ xem errors"
- Không thể rotate files → log file 50GB sau vài tháng
- Khó xử lý JSON → không integrate được với logging services (Datadog, Splunk)

**Winston** giải quyết tất cả những vấn đề trên.

---

## 1. Log Levels

Winston dùng thứ tự ưu tiên từ cao (nghiêm trọng) đến thấp:

```
error    (0) ← Lỗi nghiêm trọng — cần xử lý ngay
warn     (1) ← Cảnh báo — cần chú ý
info     (2) ← Thông tin quan trọng — server start, DB connect
http     (3) ← HTTP requests (từ Morgan)
verbose  (4) ← Thông tin chi tiết hơn
debug    (5) ← Debug info — chỉ dùng khi phát triển
silly    (6) ← Cực kỳ chi tiết
```

Khi bạn set `level: 'info'`, logger chỉ ghi **level info và cao hơn** (error, warn, info). Level http, debug, silly bị bỏ qua.

```javascript
logger.error('Database connection failed');  // Luôn được ghi
logger.warn('Redis not configured');         // Luôn được ghi
logger.info('Server started on port 5000'); // Luôn được ghi
logger.http('GET /api/vocabulary 200 45ms'); // Chỉ ghi nếu level <= 'http'
logger.debug('Processing vocabulary item'); // Chỉ ghi nếu level <= 'debug'
```

---

## 2. Cài đặt Winston

```bash
npm install winston winston-daily-rotate-file
```

---

## 3. Tạo Logger Cơ Bản

```javascript
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, json } = format;

const logger = createLogger({
    level: 'info',     // Ghi từ info trở lên

    transports: [
        new transports.Console(),   // Ghi ra console
    ],
});

logger.info('Hello Winston!');
// → info: Hello Winston!
```

---

## 4. Custom Format

```javascript
// Format cho development — màu sắc, dễ đọc
const devFormat = combine(
    format.colorize({ all: true }),         // Màu theo level
    format.timestamp({ format: 'HH:mm:ss' }),  // Giờ:phút:giây
    format.printf(({ level, message, timestamp, ...meta }) => {
        const metaStr = Object.keys(meta).length
            ? ' ' + JSON.stringify(meta)
            : '';
        return `${timestamp} [${level}] ${message}${metaStr}`;
    })
);

// Kết quả:
// 14:32:55 [info] Server started on port 5000
// 14:33:01 [error] Database connection failed {"error":"timeout"}
```

```javascript
// Format cho production — JSON để machine-readable
const prodFormat = combine(
    format.timestamp(),
    format.errors({ stack: true }),   // Lưu stack trace khi có Error object
    format.json()
);

// Kết quả (JSON):
// {"level":"error","message":"DB failed","timestamp":"2025-01-01T14:32:55.000Z","service":"toeic-app","stack":"Error: ..."}
```

**Tại sao JSON trong production?**
- Dễ parse bằng script hoặc tool (Datadog, ELK Stack)
- Filter: `cat app.log | jq 'select(.level == "error")'`
- Search: `grep "userId" app.log`

---

## 5. Transports — Nơi Ghi Logs

**Transport** là "đích" ghi log:

```javascript
const logger = createLogger({
    transports: [
        // 1. Console transport
        new transports.Console({
            format: devFormat,
            level: 'debug',    // Console ghi debug và trên
        }),

        // 2. File transport — ghi thẳng vào file
        new transports.File({
            filename: 'logs/error.log',
            level: 'error',    // Chỉ ghi errors
        }),
        new transports.File({
            filename: 'logs/app.log',
            level: 'info',
        }),
    ],
});
```

---

## 6. Daily Rotate File — Rotate Log Tự Động

Nếu log vào một file mãi mãi, sau vài tháng file sẽ cực kỳ lớn. `DailyRotateFile` tự động:
- Tạo file mới mỗi ngày: `app-2025-01-01.log`
- Xóa file cũ sau N ngày
- Nén file cũ (gzip) để tiết kiệm ổ cứng

```javascript
const DailyRotateFile = require('winston-daily-rotate-file');

const fileTransport = new DailyRotateFile({
    filename: 'logs/app-%DATE%.log',  // %DATE% được thay bằng ngày
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,     // Nén file cũ thành .gz
    maxSize: '20m',          // Rotate khi file > 20MB (bất kể ngày)
    maxFiles: '14d',         // Xóa file cũ hơn 14 ngày
    level: 'info',
    format: prodFormat,
});
```

Kết quả trong thư mục `logs/`:
```
logs/
├── app-2025-01-01.log.gz   ← Đã nén
├── app-2025-01-02.log.gz
├── app-2025-01-03.log      ← Hôm qua
├── app-2025-01-04.log      ← Hôm nay
└── error-2025-01-04.log
```

---

## 7. Logger Đầy Đủ trong Project

🎯 **Trong project — `utils/logger.js`:**

```javascript
const isProd = process.env.NODE_ENV === 'production';

// Format dev: colorized, human-readable
const consoleFormat = combine(
    colorize({ all: true }),
    timestamp({ format: 'HH:mm:ss' }),
    errors({ stack: true }),           // Nếu message là Error object, in stack
    printf(({ level, message, timestamp, stack, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
        return `${timestamp} [${level}] ${stack || message}${metaStr}`;
    })
);

// Format prod: JSON
const fileFormat = combine(timestamp(), errors({ stack: true }), json());

const logTransports = [
    new transports.Console({
        format: isProd ? fileFormat : consoleFormat,   // JSON trong prod, màu trong dev
        level: isProd ? 'http' : 'debug',              // Debug trong dev, http trong prod
    }),
];

// Chỉ thêm file logging trong production (không cần trong dev)
if (isProd) {
    logTransports.push(
        new DailyRotateFile({
            filename: path.join(LOG_DIR, 'app-%DATE%.log'),
            maxFiles: '14d',
            level: 'info',
            format: fileFormat,
        }),
        new DailyRotateFile({
            filename: path.join(LOG_DIR, 'error-%DATE%.log'),
            maxFiles: '30d',   // Error log giữ lâu hơn
            level: 'error',
            format: fileFormat,
        })
    );
}

const logger = createLogger({
    level: isProd ? 'http' : 'debug',
    defaultMeta: { service: 'toeic-app' },  // Thêm field "service" vào mọi log
    transports: logTransports,
    exitOnError: false,   // Không crash khi lỗi trong transport
});
```

---

## 8. Tích Hợp với Morgan

**Morgan** là HTTP request logger — tự động log mỗi request (method, URL, status, thời gian). Tích hợp với Winston để log vào cùng chỗ:

```javascript
// utils/logger.js — tạo stream cho Morgan
logger.stream = {
    write: (message) => logger.http(message.trim()),
    //                           └── Dùng level 'http'
};
```

```javascript
// server.js
const morgan = require('morgan');
const logger = require('./utils/logger');

// Morgan gửi log vào Winston thay vì console.log trực tiếp
app.use(morgan(
    process.env.NODE_ENV === 'production' ? 'combined' : 'dev',
    { stream: logger.stream }
));
```

**Morgan formats:**
- `'dev'` — Ngắn gọn: `GET /api/users 200 45ms`
- `'combined'` — Apache format đầy đủ: `127.0.0.1 - frank [10/Oct/2000 13:55:36] "GET / HTTP/1.1" 200 2326`

**Tại sao level 'http' phải set trong logger?**

Logger level `info` = chỉ ghi error, warn, info. Morgan dùng level `http` (level 3) — thấp hơn info (level 2). Nếu logger level là `info`, mọi Morgan log đều bị bỏ qua!

Trong project: `level: isProd ? 'http' : 'debug'` — đảm bảo HTTP logs được ghi.

---

## 9. Log Metadata

Thêm context vào logs để dễ debug:

```javascript
// Log kèm metadata object
logger.info('User đăng nhập', {
    userId: user._id,
    email: user.email,
    ip: req.ip,
});

// Kết quả JSON:
// {
//   "level": "info",
//   "message": "User đăng nhập",
//   "userId": "507f1f77bcf86cd799439011",
//   "email": "alice@gmail.com",
//   "ip": "127.0.0.1",
//   "timestamp": "2025-01-01T14:32:55.000Z",
//   "service": "toeic-app"
// }

// Log Error object — tự động lấy stack trace
try {
    await someOperation();
} catch (error) {
    logger.error('Operation failed', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id,
    });
}
```

---

## 10. Thực hành: Thay console.log bằng logger

```javascript
// Trước (console):
console.log('Server started on port', PORT);
console.error('Failed to connect:', error.message);
console.log('User created:', user.email);

// Sau (Winston):
logger.info(`Server started on port ${PORT}`, { env: process.env.NODE_ENV });
logger.error('Failed to connect', { error: error.message, stack: error.stack });
logger.info('User created', { email: user.email });
```

---

## Bài Tập Thực Hành

### Bài 1: Logger cơ bản

```javascript
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
    level: 'debug',
    transports: [
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.timestamp({ format: 'HH:mm:ss' }),
                format.printf(({ level, message, timestamp }) =>
                    `${timestamp} [${level}] ${message}`
                )
            ),
        }),
    ],
});

// Test tất cả levels
logger.error('This is an error');
logger.warn('This is a warning');
logger.info('Server started');
logger.http('GET /api 200 45ms');
logger.debug('Debug info');
```

### Bài 2: File logging với rotate

Thêm `DailyRotateFile` transport vào logger, kiểm tra file được tạo trong `logs/`.

### Bài 3: Morgan integration

```javascript
const express = require('express');
const morgan = require('morgan');

const app = express();

// Tích hợp Morgan với Winston logger từ bài 1
app.use(morgan('dev', { stream: logger.stream }));

app.get('/test', (req, res) => {
    logger.info('Test endpoint called');
    res.json({ ok: true });
});

app.listen(3000);
// Gọi http://localhost:3000/test và xem log
```

---

## Câu Hỏi Ôn Tập

1. Tại sao JSON format tốt hơn cho production logs?

2. `DailyRotateFile` với `maxFiles: '14d'` sẽ xóa file như thế nào?

3. Tại sao level của logger phải là `'http'` (không phải `'info'`) để Morgan logs hiển thị?

4. `defaultMeta: { service: 'toeic-app' }` có tác dụng gì?

5. `errors({ stack: true })` trong format làm gì khi bạn log một Error object?

---

## Tóm Tắt

- **Winston** = Structured logger cho Node.js — thay thế console.log
- **Log levels**: error → warn → info → http → debug (thứ tự ưu tiên giảm dần)
- **Transports**: Console (terminal) + File + DailyRotateFile (file xoay theo ngày)
- **JSON format** trong production: Dễ parse, filter, tích hợp logging services
- **DailyRotateFile**: Tạo file mới mỗi ngày, nén và xóa file cũ tự động
- **Morgan stream**: Redirect HTTP logs từ Morgan vào Winston
- **defaultMeta**: Thêm context mặc định vào mọi log entry
- **Dev vs Prod**: Dev dùng colorized console, Prod dùng JSON + file rotation
