# Module 7: Redis & Caching

---

## Mục tiêu

Sau module này bạn sẽ:
- Hiểu Redis là gì và tại sao cần cache
- Biết cài đặt và kết nối Redis
- Biết các lệnh Redis cơ bản: GET, SET, DEL, EXPIRE
- Hiểu caching patterns: Cache-Aside, Write-Through
- Biết implement cache middleware trong Express
- Hiểu Redis được dùng thêm để làm gì trong project (BullMQ queue)
- Đọc được `config/redis.js` và `middleware/cache.js`

---

## Tại sao cần Cache?

Mỗi request API thường phải:
1. Đọc từ MongoDB (chậm: 10-100ms)
2. Tính toán, filter, format dữ liệu
3. Trả về response

Nếu 1000 user cùng gọi `GET /api/vocabulary` — server phải truy vấn MongoDB 1000 lần cho cùng một dữ liệu.

**Cache** lưu kết quả vào bộ nhớ nhanh (RAM). Lần sau hỏi câu hỏi tương tự → trả ngay từ cache:

```
Không có cache:
User 1 → MongoDB → 80ms
User 2 → MongoDB → 80ms
User 3 → MongoDB → 80ms
...1000 lần...

Có cache:
User 1 → MongoDB → 80ms → lưu vào cache
User 2 → Cache hit → 1ms!
User 3 → Cache hit → 1ms!
...999 lần nhanh hơn 80x...
```

---

## 1. Redis là gì?

**Redis** (Remote Dictionary Server) là **in-memory database** — lưu dữ liệu trong RAM, không trên đĩa. Nó cực kỳ nhanh (< 1ms) nhưng dữ liệu sẽ mất khi tắt máy (nếu không cấu hình persistence).

**Redis dùng cho:**
- **Cache** — Lưu kết quả query tạm thời
- **Session storage** — Lưu user sessions
- **Job queues** — BullMQ dùng Redis để lưu jobs (Module 10)
- **Rate limiting** — Đếm request per IP
- **Pub/Sub** — Real-time messaging

---

## 2. Cài đặt Redis

### Chạy Redis với Docker (đơn giản nhất)

```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

### Kiểm tra kết nối

```bash
docker exec -it redis redis-cli
127.0.0.1:6379> PING
PONG
```

### Redis Cloud (miễn phí)

Đăng ký tại [redis.io/try-free](https://redis.io/try-free) — 30MB miễn phí.
Connection string dạng: `redis://default:password@redis-12345.cloud.redislabs.com:12345`

---

## 3. Redis Commands Cơ Bản

```bash
# redis-cli (terminal)

# String operations
SET name "Alice"               # Set key-value
GET name                       # Lấy giá trị → "Alice"
SET counter 10
INCR counter                   # Tăng 1 → 11
INCRBY counter 5               # Tăng 5 → 16

# Expire (TTL = Time To Live)
SET session "abc123" EX 3600   # Set với TTL 1 giờ (giây)
EXPIRE name 300                # Set TTL cho key đã có → 5 phút
TTL name                       # Xem còn bao lâu (giây)
PERSIST name                   # Xóa TTL → giữ mãi mãi

# Delete
DEL name                       # Xóa key
KEYS "cache:*"                 # Tìm tất cả key khớp pattern

# Check existence
EXISTS name                    # 1 (có) hoặc 0 (không)

# Hash (như object)
HSET user id "123" name "Alice" role "admin"
HGET user name                 # "Alice"
HGETALL user                   # Tất cả fields

# List
LPUSH queue "job1" "job2"      # Thêm vào đầu list
RPOP queue                     # Lấy từ cuối list
LLEN queue                     # Độ dài list
```

---

## 4. Kết Nối Redis trong Node.js

```javascript
const { createClient } = require('redis');

const client = createClient({
    url: 'redis://localhost:6379',
});

client.on('error', (err) => console.error('Redis error:', err));

await client.connect();

// Basic operations
await client.set('name', 'Alice');
const name = await client.get('name');  // 'Alice'

// Với TTL (5 phút)
await client.setEx('session:abc', 300, JSON.stringify({ userId: '123' }));

// Xóa
await client.del('name');

// Đóng kết nối
await client.quit();
```

### Lưu/đọc JSON

Redis chỉ lưu string — cần serialize/deserialize JSON:

```javascript
// Lưu object
const user = { id: 1, name: 'Alice', level: 5 };
await client.setEx('user:1', 3600, JSON.stringify(user));

// Đọc object
const raw = await client.get('user:1');
const user = raw ? JSON.parse(raw) : null;
```

🎯 **Trong project — `config/redis.js`:**

```javascript
// Helper functions đã bọc sẵn
const setCache = async (key, value, ttl = 300) => {
    if (!redisClient || !redisClient.isOpen) return false;
    await redisClient.setEx(key, ttl, JSON.stringify(value));
    return true;
};

const getCache = async (key) => {
    if (!redisClient || !redisClient.isOpen) return null;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;  // Auto parse JSON
};
```

---

## 5. Cache Patterns

### Cache-Aside (Lazy Loading)

Pattern phổ biến nhất — ứng dụng tự quản lý cache:

```javascript
async function getVocabulary(id) {
    const cacheKey = `vocab:${id}`;

    // 1. Thử lấy từ cache trước
    const cached = await getCache(cacheKey);
    if (cached) {
        console.log('Cache HIT');
        return cached;  // Trả về ngay
    }

    // 2. Cache miss → query DB
    console.log('Cache MISS');
    const vocab = await Vocabulary.findById(id);

    // 3. Lưu vào cache (TTL 5 phút)
    await setCache(cacheKey, vocab, 300);

    return vocab;
}
```

```
Lần 1: Cache MISS → DB (80ms) → save cache → return
Lần 2: Cache HIT → return (< 1ms)
...5 phút sau...
Lần N: Cache MISS (expired) → DB → save cache → return
```

### Cache Invalidation — Xóa cache khi dữ liệu thay đổi

Vấn đề: Cache có thể cũ (stale) nếu dữ liệu thay đổi mà không cập nhật cache.

```javascript
// Khi update vocabulary
async function updateVocab(id, data) {
    const vocab = await Vocabulary.findByIdAndUpdate(id, data, { new: true });

    // Xóa cache liên quan ngay sau khi update
    await deleteCache(`vocab:${id}`);
    await clearCachePattern('cache:/api/vocabulary*');  // Xóa tất cả list cache

    return vocab;
}
```

**Quy tắc**: Cache + Invalidation đi đôi với nhau. Nếu update/delete data, phải xóa cache liên quan.

---

## 6. Cache Middleware trong Express

Thay vì viết cache logic trong từng controller, tạo middleware tái dùng:

```javascript
// middleware/cache.js
const cacheMiddleware = (ttl = 300) => {
    return async (req, res, next) => {
        // Chỉ cache GET requests
        if (req.method !== 'GET') return next();

        const cacheKey = `cache:${req.originalUrl}`;
        // URL: /api/vocabulary?page=1&limit=20
        // → cacheKey: 'cache:/api/vocabulary?page=1&limit=20'

        // Thử lấy từ cache
        const cachedData = await getCache(cacheKey);
        if (cachedData) {
            logger.debug('Cache HIT', { key: cacheKey });
            return res.json(cachedData);  // Trả về ngay, không vào controller
        }

        // Cache miss — "bẫy" res.json để save cache sau khi response
        const originalJson = res.json.bind(res);
        res.json = (data) => {
            if (res.statusCode === 200) {
                setCache(cacheKey, data, ttl);  // Lưu vào cache (async, không await)
            }
            return originalJson(data);  // Gửi response bình thường
        };

        next();  // Tiếp tục vào controller
    };
};
```

**Cách dùng trong routes:**

```javascript
// routes/vocabulary.js
const cacheMiddleware = require('../middleware/cache');

// Cache 5 phút
router.get('/', cacheMiddleware(300), getAllVocabulary);

// Cache 1 giờ (thống kê ít thay đổi)
router.get('/stats', cacheMiddleware(3600), getVocabularyStats);

// Không cache (dữ liệu cá nhân)
router.get('/profile', protect, getProfile);
```

---

## 7. Reconnect Strategy

Redis có thể mất kết nối tạm thời. Cần strategy reconnect:

🎯 **Trong project — `config/redis.js`:**

```javascript
const redisConfig = {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
            if (retries > 10) {
                logger.error('Redis: Too many retry attempts');
                return new Error('Too many retries');  // Ngừng retry
            }
            // Delay tăng dần: 100ms, 200ms, 300ms, ..., 3000ms
            return Math.min(retries * 100, 3000);
        },
    },
};
```

**Graceful degradation**: Nếu Redis không kết nối được, server vẫn chạy bình thường — chỉ chậm hơn (không có cache):

```javascript
const getCache = async (key) => {
    try {
        if (!redisClient || !redisClient.isOpen) return null;  // Không crash
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        logger.warn('Redis GET error', { error: error.message });
        return null;  // Trả về null thay vì throw error
    }
};
```

---

## 8. Chọn TTL Phù Hợp

| Loại dữ liệu | TTL đề xuất | Lý do |
|-------------|------------|-------|
| Danh sách từ vựng | 5-15 phút | Ít thay đổi, traffic cao |
| Thống kê tổng hợp | 1-24 giờ | Thay đổi chậm |
| Profile user | 1-5 phút | Có thể thay đổi |
| Leaderboard | 30-60 giây | Cần tương đối real-time |
| Session | 7 ngày | Theo JWT expire |
| Dữ liệu real-time | Không cache | Cần fresh data |

---

## 9. Redis cho BullMQ (Preview)

Ngoài cache, Redis còn làm **job queue storage** cho BullMQ (sẽ học chi tiết Module 10):

```
Producer (authController):          Consumer (emailWorker):
┌─────────────────────┐             ┌──────────────────────┐
│ emailQueue.add(     │  ──Redis──  │ Worker processes job │
│   'send-otp',       │  ─────────► │   → sendEmail()      │
│   { to, code }      │             │   → retry if fail    │
│ )                   │             └──────────────────────┘
└─────────────────────┘
```

Lý do BullMQ cần `noeviction` policy: Redis KHÔNG được xóa job đang chờ khi hết RAM.

---

## Bài Tập Thực Hành

### Bài 1: Redis CLI

Mở redis-cli và thực hiện:
```bash
# 1. Set và get giá trị
SET greeting "Xin chào"
GET greeting

# 2. Set với TTL 60 giây, theo dõi TTL
SET temp_key "value" EX 60
TTL temp_key
# Đợi vài giây, chạy lại TTL

# 3. Hash operations
HSET student name "Nguyễn A" age 20 score 850
HGETALL student
HGET student name

# 4. Counter
SET page_views 0
INCR page_views
INCR page_views
INCR page_views
GET page_views
```

### Bài 2: Cache-Aside trong Node.js

```javascript
const { createClient } = require('redis');

const client = createClient();
await client.connect();

// Simulate slow DB query
async function slowQuery(id) {
    await new Promise(r => setTimeout(r, 100)); // Giả lập DB delay 100ms
    return { id, name: `Item ${id}`, data: 'some data' };
}

async function getWithCache(id) {
    const key = `item:${id}`;

    // TODO: Implement cache-aside
    // 1. Kiểm tra cache
    // 2. Nếu miss → call slowQuery → save cache
    // 3. Return data
}

// Test
console.time('first call');
await getWithCache('123');
console.timeEnd('first call');  // ~100ms

console.time('second call');
await getWithCache('123');
console.timeEnd('second call'); // ~1ms (từ cache)

await client.quit();
```

### Bài 3: Cache middleware

Thêm cache middleware vào CRUD API từ Module 3:
- GET /products — cache 5 phút
- POST/PUT/DELETE /products — xóa cache
- Thêm `X-Cache-Status: HIT` hoặc `MISS` vào response header

---

## Câu Hỏi Ôn Tập

1. Khi nào nên dùng cache và khi nào KHÔNG nên cache?

2. "Cache invalidation" là gì? Tại sao nó khó?

3. Redis mất điện thì data có mất không? Giải pháp?

4. Tại sao `setCache` không dùng `await` khi gọi trong `res.json` override?

5. Tại sao BullMQ cần Redis với `noeviction` policy thay vì `allkeys-lru`?

---

## Tóm Tắt

- **Redis** = in-memory database, cực nhanh (< 1ms), lý tưởng cho cache
- **Cache-Aside**: Check cache → miss → query DB → save cache
- **TTL**: Thời gian sống của cache key — tự động expire
- **Cache Invalidation**: Xóa cache khi data thay đổi để tránh stale data
- **Cache Middleware**: Wrap `res.json` để tự động cache response
- **Graceful degradation**: Nếu Redis chết, app vẫn chạy (chỉ chậm hơn)
- **Reconnect strategy**: Exponential backoff khi mất kết nối
- **BullMQ**: Dùng Redis để lưu job queue (cần `noeviction` policy)
