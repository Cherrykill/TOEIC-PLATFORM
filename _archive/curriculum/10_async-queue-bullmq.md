# Module 10: Async Queue với BullMQ

---

## Mục tiêu

Sau module này bạn sẽ:
- Hiểu tại sao cần queue và khi nào dùng
- Biết sự khác biệt giữa synchronous và asynchronous processing
- Biết cài đặt và dùng BullMQ để tạo job queue
- Hiểu cơ chế retry với exponential backoff
- Biết monitor jobs qua Bull Board
- Đọc được `queues/index.js` và `workers/emailWorker.js`

---

## Vấn đề: Tại sao cần Queue?

Khi user đăng ký, server cần gửi email OTP. Nếu gửi đồng bộ (synchronous):

```
User gửi request đăng ký
         ↓
Server nhận request
         ↓
Server gọi Gmail API  ← CÓ THỂ MẤT 1-3 GIÂY (network, SMTP handshake)
         ↓ (user đang chờ...)
Gmail gửi email xong
         ↓
Server trả về response
         ↓
User nhận response (sau 3-5 giây!)
```

**Vấn đề:**
1. User chờ lâu (bad UX)
2. Nếu Gmail API lỗi tạm thời → request thất bại hoàn toàn
3. Không retry tự động

**Giải pháp: Queue (hàng đợi)**

```
User gửi request đăng ký
         ↓
Server nhận request
         ↓
Server đẩy job "send-email" vào Queue → NGAY LẬP TỨC
         ↓
Server trả về response (< 50ms!)
         ↓ (SONG SONG)
Worker lấy job từ Queue
         ↓
Worker gửi email
         ↓
Nếu lỗi → Worker retry tự động
```

**Lợi ích:**
- Response nhanh (không chờ email gửi xong)
- Retry tự động khi thất bại
- Có thể scale: Chạy nhiều worker song song
- Persist qua restart: Job không mất nếu server crash

---

## 1. BullMQ — Job Queue cho Node.js

**BullMQ** là thư viện queue mạnh nhất cho Node.js, dùng Redis để lưu trữ jobs.

```bash
npm install bullmq
```

**Kiến trúc:**

```
Producer          Redis            Consumer (Worker)
┌────────┐       ┌──────┐         ┌──────────────┐
│ Queue  │ ──→   │ Jobs │  ──→    │   Worker     │
│        │  add  │      │  poll   │              │
│        │       │      │         │ Xử lý job    │
└────────┘       └──────┘         └──────────────┘
```

- **Queue**: Nơi "sản xuất" đẩy jobs vào
- **Redis**: Lưu trữ jobs (đang chờ, đang xử lý, đã xong, thất bại)
- **Worker**: Lấy jobs từ queue và xử lý

---

## 2. Tạo Queue

```javascript
// queues/index.js
const { Queue } = require('bullmq');

const connection = {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
};

// Tạo queue "email"
const emailQueue = new Queue('email', {
    connection,
    defaultJobOptions: {
        attempts: 3,                               // Retry tối đa 3 lần
        backoff: {
            type: 'exponential',                   // Thời gian chờ tăng dần
            delay: 5000,                           // Lần 1: 5s, lần 2: 10s, lần 3: 20s
        },
        removeOnComplete: { count: 100 },          // Giữ 100 job đã xong (để xem lịch sử)
        removeOnFail: { count: 50 },               // Giữ 50 job lỗi (để debug)
    },
});

module.exports = { emailQueue };
```

---

## 3. Thêm Job vào Queue (Producer)

```javascript
// Từ controllers/authController.js
const { emailQueue } = require('../queues');

// Khi cần gửi OTP
await emailQueue.add(
    'send-otp',               // Tên job (có thể dùng để phân loại)
    {                         // Job data — payload
        to: user.email,
        code: otpCode,
        type: 'register',
    },
    {                         // Job options (override defaultJobOptions nếu cần)
        jobId: `register-${otpDoc._id}`,  // ID cố định → tránh duplicate nếu retry
    }
);

// API trả về ngay lập tức — không chờ email gửi xong
res.json({ success: true, message: 'OTP đã gửi, vui lòng kiểm tra email' });
```

**`jobId` cố định** (idempotency): Nếu user click nút 2 lần, BullMQ không tạo job trùng lặp — chỉ giữ một job với cùng ID.

---

## 4. Worker — Xử lý Job

```javascript
// workers/emailWorker.js
const { Worker } = require('bullmq');
const { sendOtpEmail } = require('../utils/emailService');

function startEmailWorker() {
    const worker = new Worker(
        'email',                    // Tên queue cần lắng nghe
        async (job) => {            // Processor function — chạy cho mỗi job
            const { to, code, type } = job.data;

            logger.info('Processing email job', {
                jobId: job.id,
                to,
                attempt: job.attemptsMade + 1,  // Lần thử thứ mấy
            });

            await sendOtpEmail(to, code, type);

            // Nếu hàm này throw error → BullMQ sẽ retry
            // Nếu return bình thường → job được đánh dấu 'completed'
        },
        {
            connection,
            concurrency: 5,         // Xử lý tối đa 5 jobs cùng lúc
        }
    );

    // Event listeners
    worker.on('completed', (job) => {
        logger.debug('Email job completed', { jobId: job.id });
    });

    worker.on('failed', (job, err) => {
        const isFinalAttempt = (job?.attemptsMade ?? 0) >= (job?.opts?.attempts ?? 3);

        logger.error('Email job failed', {
            jobId: job?.id,
            to: job?.data?.to,
            attempt: job?.attemptsMade,
            final: isFinalAttempt,     // Hết lần retry chưa?
            error: err.message,
        });
    });

    return worker;
}

module.exports = { startEmailWorker };
```

---

## 5. Khởi Động Worker

Worker được khởi động sau khi Redis kết nối thành công:

🎯 **Trong project — `server.js`:**

```javascript
let emailWorker = null;  // Module-level variable để dùng trong shutdown

async function startServer() {
    await connectDB();
    await connectMongoDB();
    await connectRedis();    // ← Worker cần Redis → phải start sau

    // Khởi động worker
    emailWorker = startEmailWorker();

    app.listen(PORT, () => { ... });
}

// Graceful shutdown — drain worker trước khi tắt
async function shutdown(signal) {
    await Promise.allSettled([
        closeConnection(),
        closeMongoConnection(),
        closeRedisConnection(),
        emailWorker?.close(),   // Chờ job đang xử lý hoàn thành
    ]);
    process.exit(0);
}
```

**`emailWorker?.close()`** — Optional chaining. Nếu `emailWorker` là `null` (Redis chưa kết nối), không crash.

---

## 6. Job Lifecycle

```
Khi thêm vào queue:
    ┌─────────┐
    │ waiting │  ← Đang chờ trong queue
    └────┬────┘
         │ Worker lấy job
    ┌────▼────┐
    │  active │  ← Đang được xử lý
    └────┬────┘
         │
    ┌────▼────────────────────────────────┐
    │                                     │
┌───▼──────┐                     ┌────────▼──┐
│completed │                     │  failed   │
└──────────┘                     └─────┬─────┘
                                       │ attempts < max?
                                 ┌─────▼──────┐
                                 │  delayed   │  ← Chờ backoff time
                                 └─────┬──────┘
                                       │ Sau delay
                                  Back to waiting
```

---

## 7. Retry với Exponential Backoff

```javascript
// Cấu hình:
backoff: { type: 'exponential', delay: 5000 }
attempts: 3

// Timeline khi lỗi:
Attempt 1 → FAIL
Chờ 5s  (5000 * 2^0)
Attempt 2 → FAIL
Chờ 10s (5000 * 2^1)
Attempt 3 → FAIL
→ Job vào 'failed' queue (hết retry)
```

**Tại sao exponential backoff?**
- Lần 1 thất bại: Gmail API bận → chờ 5s (vẫn còn bận)
- Lần 2 thất bại: Chờ lâu hơn (10s) → tránh spam API
- Lần 3 thất bại: Chờ 20s → API có thời gian phục hồi

---

## 8. So Sánh: Đồng Bộ vs Queue

```javascript
// ĐỒNG BỘ (Synchronous) — hiện tại nhiều app làm vậy:
const register = async (req, res) => {
    const user = await User.create({ ... });
    await sendOtpEmail(user.email, otp);  // Chờ email gửi xong
    res.json({ success: true });          // Mới trả về (chậm!)
};
// Vấn đề: Nếu Gmail down → user bị lỗi ngay
// Vấn đề: Response chậm (3-5s)

// BẤT ĐỒNG BỘ với Queue (cách trong project):
const register = async (req, res) => {
    const user = await User.create({ ... });
    await emailQueue.add('send-otp', { ... });  // Đẩy vào queue → NGAY LẬP TỨC
    res.json({ success: true });                // Trả về < 50ms
    // Email sẽ được gửi ở background bởi Worker
};
// Lợi ích: Response nhanh, retry tự động
```

---

## 9. Khi Nào Nên Dùng Queue?

**Dùng queue khi:**
- Gửi email / SMS / push notification
- Xử lý ảnh (resize, watermark)
- Tạo PDF, báo cáo
- Gọi API bên ngoài (có thể chậm/lỗi)
- Batch processing (xử lý hàng nghìn records)
- Scheduled jobs (chạy theo lịch)

**Không cần queue khi:**
- Đọc/ghi database (thường đủ nhanh)
- Logic business đơn giản
- User cần response ngay (xác thực, tính điểm)

---

## 10. Bull Board — Monitor Jobs

BullMQ có UI để xem trạng thái jobs:

```bash
npm install @bull-board/express @bull-board/api
```

```javascript
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter,
});

app.use('/admin/queues', protect, authorize('admin'), serverAdapter.getRouter());
```

Truy cập `http://localhost:5000/admin/queues` để xem:
- Jobs đang chờ (waiting)
- Jobs đang xử lý (active)
- Jobs đã xong (completed)
- Jobs lỗi (failed) — có thể retry thủ công

---

## Bài Tập Thực Hành

### Bài 1: Queue đơn giản

```javascript
// producer.js
const { Queue } = require('bullmq');

const myQueue = new Queue('my-jobs', {
    connection: { url: 'redis://localhost:6379' },
    defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
});

// Thêm 5 jobs
for (let i = 1; i <= 5; i++) {
    await myQueue.add('process-item', { id: i, value: `item-${i}` });
    console.log(`Added job ${i}`);
}

process.exit(0);
```

```javascript
// worker.js
const { Worker } = require('bullmq');

const worker = new Worker('my-jobs', async (job) => {
    console.log(`Processing job ${job.id}:`, job.data);

    // Simulate 50% chance of failure
    if (Math.random() < 0.5) {
        throw new Error('Random failure!');
    }

    await new Promise(r => setTimeout(r, 500));  // Simulate work
    console.log(`Job ${job.id} completed`);
}, {
    connection: { url: 'redis://localhost:6379' },
    concurrency: 2,  // Chạy 2 job cùng lúc
});

worker.on('failed', (job, err) => {
    console.log(`Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
});

console.log('Worker started...');
```

Chạy worker trước, rồi chạy producer. Quan sát retry behavior.

### Bài 2: Delay job

```javascript
// Job chạy sau 5 giây
await myQueue.add('delayed-job', { message: 'Hello from the past!' }, {
    delay: 5000,
});
```

---

## Câu Hỏi Ôn Tập

1. Sự khác biệt chính giữa xử lý đồng bộ và bất đồng bộ với queue là gì?

2. Tại sao `jobId: 'register-${otpDoc._id}'` giúp tránh gửi email trùng lặp?

3. Exponential backoff là gì và tại sao tốt hơn fixed interval?

4. `concurrency: 5` trong Worker có nghĩa là gì?

5. Tại sao Worker phải start **sau** khi Redis kết nối?

---

## Tóm Tắt

- **Queue**: Tách "đẩy việc" và "làm việc" — producer đẩy nhanh, worker làm ở background
- **BullMQ**: Thư viện queue cho Node.js, dùng Redis để persist jobs
- **Job lifecycle**: waiting → active → completed/failed → retry (delayed)
- **Retry + backoff**: Tự động thử lại khi lỗi, chờ lâu hơn mỗi lần (exponential)
- **jobId cố định**: Tránh duplicate jobs khi retry — idempotency
- **concurrency**: Số job xử lý đồng thời trong một worker
- **Graceful shutdown**: `worker.close()` — chờ job đang xử lý xong rồi mới tắt
- **Dùng queue khi**: Gửi email, xử lý file, gọi API chậm, batch processing
