# Module 13: Docker & Deployment

---

## Mục tiêu

Sau module này bạn sẽ:
- Hiểu Docker là gì và tại sao cần container hóa
- Biết viết Dockerfile và build Docker image
- Biết dùng docker-compose để chạy nhiều service
- Hiểu multi-stage build để tối ưu image size
- Biết deploy lên Render.com (miễn phí)
- Đọc được `Dockerfile` và `docker-compose.yml` trong project

---

## Vấn đề: "It works on my machine"

```
Backend developer: "Tôi test rồi, chạy ngon trên máy tôi"
DevOps: "Production deploy lên server thì lỗi"
Backend: "Trên máy tôi Node 20, server dùng Node 16..."
DevOps: "Package version cũng khác..."
Backend: "OS khác nhau nên path cũng khác..."
```

**Docker** giải quyết: Đóng gói app cùng với môi trường chạy vào một **container**. Container chạy giống nhau trên mọi máy.

---

## 1. Docker Concepts

### Image vs Container

```
Image = Bản thiết kế (class)
Container = Instance đang chạy (object)

Một Image có thể tạo nhiều Container
```

- **Image**: File tĩnh chứa OS, runtime, code, dependencies
- **Container**: Instance của image đang chạy (có network, filesystem, process)

### Dockerfile

Tập lệnh để build image:

```dockerfile
FROM node:20-alpine        # Base image (OS + Node.js)
WORKDIR /app               # Thư mục làm việc trong container
COPY package.json .        # Copy file
RUN npm install            # Chạy lệnh khi build
COPY . .                   # Copy toàn bộ code
EXPOSE 5000                # Document cổng (không tự mở)
CMD ["node", "server.js"]  # Lệnh chạy khi container start
```

---

## 2. Dockerfile trong Project

🎯 **Trong project — `Dockerfile`:**

```dockerfile
# ─── Stage 1: deps ───────────────────────────────
FROM node:20-alpine AS deps   # [1] Base image Alpine (nhỏ ~5MB vs Ubuntu ~200MB)

WORKDIR /app

# Copy package files TRƯỚC — tận dụng Docker layer cache
COPY package.json package-lock.json ./
RUN npm ci --omit=dev          # [2] Chỉ cài production deps (không dev tools)


# ─── Stage 2: production image ───────────────────
FROM node:20-alpine AS runner

# [3] Security: không chạy bằng root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# [4] Copy node_modules từ stage trước — không build lại
COPY --from=deps /app/node_modules ./node_modules

# [5] Copy source code với ownership đúng
COPY --chown=appuser:appgroup . .

# [6] Tạo thư mục cần ghi (logs, uploads, tts-cache)
RUN mkdir -p public/tts-cache public/uploads data logs \
    && chown -R appuser:appgroup public/tts-cache public/uploads data logs

USER appuser    # [7] Switch sang non-root user

EXPOSE 5000

# [8] Health check — Docker tự kiểm tra container còn sống không
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:5000/health || exit 1

CMD ["node", "server.js"]
```

### Tại sao Multi-Stage Build?

```
Không dùng multi-stage:
Image chứa: Node.js + npm + dev dependencies + source code
Size: ~800MB

Dùng multi-stage:
Stage 1 (deps): Build node_modules (bao gồm dev tools)
Stage 2 (runner): Chỉ lấy production node_modules + source
Size: ~150MB (nhỏ hơn 5x!)
```

**Stage 1** làm nhiệm vụ build — có thể có tools nặng.
**Stage 2** là image cuối cùng — chỉ chứa những gì cần thiết để chạy.

### Layer Cache

```dockerfile
# ✅ ĐÚNG: Copy package.json TRƯỚC source code
COPY package.json package-lock.json ./
RUN npm ci                          # Chỉ chạy lại khi package.json thay đổi
COPY . .                            # Source code thay đổi không cần npm ci lại

# ❌ SAI: Copy tất cả một lần
COPY . .
RUN npm ci                          # Chạy lại MỖI LẦN bất kỳ file nào thay đổi!
```

Docker cache từng layer. Nếu layer không thay đổi, Docker dùng cache — build nhanh hơn nhiều.

---

## 3. .dockerignore

Giống `.gitignore` — bảo Docker không copy các file không cần:

```
# .dockerignore
node_modules/      # Sẽ install lại trong Docker
.env               # KHÔNG bao giờ đưa secrets vào image!
.git/
*.log
tests/
.DS_Store
```

---

## 4. Docker Commands Cơ Bản

```bash
# Build image từ Dockerfile
docker build -t toeic-app:latest .
#             └── tên:tag

# Chạy container
docker run -p 5000:5000 toeic-app:latest
#           └── host:container port mapping

# Chạy với env file và detached mode
docker run -d --env-file .env -p 5000:5000 toeic-app:latest

# Xem containers đang chạy
docker ps

# Xem logs
docker logs container-name
docker logs -f container-name   # Follow (real-time)

# Vào bên trong container
docker exec -it container-name sh

# Dừng và xóa
docker stop container-name
docker rm container-name

# Xóa image
docker rmi toeic-app:latest
```

---

## 5. Docker Compose

Khi cần nhiều service (app + redis + database), dùng `docker-compose.yml` để quản lý tất cả:

🎯 **Trong project — `docker-compose.yml`:**

```yaml
services:
  # ── App ──────────────────────────────────────────
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: toeic-app
    restart: unless-stopped       # [1] Tự restart nếu crash
    ports:
      - "5000:5000"               # host:container
    env_file:
      - .env                      # Load .env
    environment:
      NODE_ENV: production
      REDIS_URL: redis://redis:6379   # [2] Dùng tên service 'redis'
    depends_on:
      redis:
        condition: service_healthy    # [3] Chờ redis healthy mới start
    volumes:
      - uploads_data:/app/public/uploads    # [4] Persist data ra ngoài container
      - tts_cache:/app/public/tts-cache
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s

  # ── Redis ────────────────────────────────────────
  redis:
    image: redis:7-alpine         # Dùng image có sẵn (không build)
    container_name: toeic-redis
    restart: unless-stopped
    command: redis-server --maxmemory 256mb --maxmemory-policy noeviction
    volumes:
      - redis_data:/data          # Persist Redis data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

# ── Volumes ───────────────────────────────────────
volumes:
  redis_data:
  uploads_data:
  tts_cache:

# ── Network ───────────────────────────────────────
networks:
  toeic-net:
    driver: bridge
```

### Networking trong Docker Compose

Tất cả services trong cùng compose file tự động ở cùng network. Có thể dùng tên service làm hostname:

```
App container có thể kết nối Redis bằng:
  redis://redis:6379
  (tên service "redis" = hostname)

Không cần IP address!
```

### Docker Compose Commands

```bash
# Start tất cả services (build nếu cần)
docker compose up --build

# Start detached (background)
docker compose up -d

# Xem logs tất cả services
docker compose logs -f

# Xem logs service cụ thể
docker compose logs -f app

# Dừng tất cả
docker compose down

# Dừng và xóa volumes (cẩn thận! Mất data)
docker compose down -v

# Rebuild và restart
docker compose up --build --force-recreate
```

---

## 6. Health Check

Health check giúp Docker biết container có hoạt động bình thường không:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:5000/health || exit 1
```

- `interval`: Kiểm tra mỗi 30 giây
- `timeout`: Timeout 10 giây nếu không respond
- `start-period`: Chờ 15 giây sau khi start trước khi check lần đầu
- `retries`: Thất bại 3 lần liên tiếp → Container "unhealthy"

```javascript
// server.js — endpoint /health trả về trạng thái
app.get('/health', (_, res) => {
    const mongoOk = mongoose.connection.readyState === 1;
    const status = mongoOk ? 'OK' : 'DEGRADED';

    res.status(mongoOk ? 200 : 503).json({
        status,
        uptime: Math.floor(process.uptime()),
        mongodb: mongoOk ? 'connected' : 'disconnected',
    });
});
```

---

## 7. Deploy lên Render.com (Miễn phí)

Render là platform PaaS — bạn chỉ cần push code lên GitHub, Render tự build và deploy.

### Các bước:

1. **Tạo tài khoản** tại [render.com](https://render.com)

2. **New Web Service** → Connect GitHub repo

3. **Cấu hình:**
   ```
   Name: toeic-backend
   Environment: Docker  (Render tự đọc Dockerfile)
   Region: Singapore (gần VN nhất)
   Branch: main
   ```

4. **Environment Variables:**
   ```
   MONGODB_URI=mongodb+srv://...
   JWT_SECRET=your_secret_key_here
   REDIS_URL=redis://...  (nếu dùng Redis Cloud)
   NODE_ENV=production
   PORT=5000
   ```

5. **Deploy** → Render build Docker image và run

### Tạo Redis trên Render:

1. New Redis → Free tier (25MB)
2. Copy Internal URL: `redis://red-xxxxx:6379`
3. Set `REDIS_URL` environment variable

---

## 8. Graceful Shutdown

Khi container nhận tín hiệu `SIGTERM` (Docker stop) hoặc `SIGINT` (Ctrl+C), cần kết thúc sạch sẽ:

🎯 **Trong project — `server.js`:**

```javascript
async function shutdown(signal) {
    logger.info(`${signal} received — shutting down gracefully...`);

    // Timeout force-exit sau 15s (tránh hang mãi)
    const forceExit = setTimeout(() => {
        logger.error('Graceful shutdown timed out — forcing exit');
        process.exit(1);
    }, 15_000);
    forceExit.unref();

    // Đóng tất cả connections
    await Promise.allSettled([
        closeConnection(),          // JSON DB
        closeMongoConnection(),     // MongoDB
        closeRedisConnection(),     // Redis
        emailWorker?.close(),       // BullMQ worker drain
    ]);

    clearTimeout(forceExit);
    logger.info('All connections closed.');
    process.exit(0);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
```

**Tại sao quan trọng?**
- Tránh mất data (jobs đang xử lý, transactions đang chạy)
- Đóng kết nối DB đúng cách (không để connections "orphaned")
- Kubernetes và Docker chờ graceful shutdown trước khi force kill

---

## 9. Security Best Practices

### Non-root user

```dockerfile
# Không chạy bằng root — nếu container bị hack, thiệt hại giảm thiểu
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
```

### Secrets không vào image

```bash
# Truyền secrets qua env, không COPY .env vào image
docker run --env-file .env toeic-app
# Hoặc
docker run -e JWT_SECRET=xxx toeic-app
```

---

## Bài Tập Thực Hành

### Bài 1: Build và chạy app đơn giản với Docker

```dockerfile
# Dockerfile cho app Hello World
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

```bash
docker build -t my-first-app .
docker run -p 3000:3000 my-first-app
```

### Bài 2: Docker Compose với Redis

Tạo `docker-compose.yml` cho project todo từ Module 3, thêm Redis service để cache:

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      REDIS_URL: redis://redis:6379
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
```

---

## Câu Hỏi Ôn Tập

1. Sự khác biệt giữa Docker Image và Docker Container là gì?

2. Tại sao COPY `package.json` trước, rồi mới COPY `.` trong Dockerfile?

3. Multi-stage build giúp gì cho image size?

4. Trong docker-compose, tại sao app kết nối Redis qua `redis://redis:6379` thay vì `localhost`?

5. `restart: unless-stopped` hoạt động như thế nào?

---

## Tóm Tắt

- **Docker**: Container hóa app + môi trường → chạy giống nhau mọi nơi
- **Dockerfile**: Tập lệnh build image — FROM, WORKDIR, COPY, RUN, CMD
- **Multi-stage build**: Stage 1 build, Stage 2 chỉ chứa production code — image nhỏ hơn
- **Layer cache**: Copy package.json trước COPY . để tận dụng cache khi source thay đổi
- **Non-root user**: Chạy bằng user thường, không phải root — security
- **docker-compose**: Quản lý nhiều service, networking tự động bằng tên service
- **Health check**: Docker tự kiểm tra app còn sống → restart nếu unhealthy
- **Graceful shutdown**: Xử lý SIGTERM → đóng connections sạch sẽ trước khi thoát
- **Render**: Deploy miễn phí — connect GitHub, cấu hình env vars, done
