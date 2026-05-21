require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

// ===================================
// VALIDATE REQUIRED ENV VARS
// ===================================
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'];
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length > 0) {
    // logger chưa init ở đây nên dùng console tạm
    logger.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
    logger.error('Create a .env file based on .env.example');
    process.exit(1);
}

const logger = require('./utils/logger');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { startEmailWorker } = require('./workers/emailWorker');
const { testConnection } = require('./config/openai');
const errorHandler = require('./middleware/errorHandler');
const { connectMongoDB, closeMongoConnection } = require('./config/mongodb');
const { connectRedis, closeRedisConnection } = require('./config/redis');

// Initialize Express app
const app = express();

// ===================================
// METRICS COLLECTOR
// ===================================
const metrics = {
    startTime: Date.now(),
    totalRequests: 0,
    statusCodes: { '2xx': 0, '4xx': 0, '5xx': 0 },
    latencies: [],          // rolling last 1000 request durations (ms)
    routeStats: {},         // { "METHOD /path": { count, totalMs } }
    slowRequests: [],       // last 15 requests >300ms
    // 60-slot circular buffer: each slot = requests in that minute
    minuteBuffer: new Array(60).fill(0),
    minuteIdx: 0,
    cpuUsageSnapshot: process.cpuUsage(),
    cpuPercent: 0,
    cpuSampleTime: Date.now(),
};

// Rotate minute bucket every 60s
setInterval(() => {
    metrics.minuteIdx = (metrics.minuteIdx + 1) % 60;
    metrics.minuteBuffer[metrics.minuteIdx] = 0;
}, 60000);

// CPU sampling every 5s
setInterval(() => {
    const now = Date.now();
    const elapsed = (now - metrics.cpuSampleTime) * 1000; // µs
    const usage = process.cpuUsage(metrics.cpuUsageSnapshot);
    metrics.cpuPercent = elapsed > 0
        ? Math.min(100, Math.round(((usage.user + usage.system) / elapsed) * 100))
        : 0;
    metrics.cpuUsageSnapshot = process.cpuUsage();
    metrics.cpuSampleTime = now;
}, 5000);

// ===================================
// MIDDLEWARE
// ===================================
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            scriptSrcElem: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://*.onrender.com"],
        }
    }
}));
app.use(compression({
    level: 6,           // Compression level (0-9, 6 is good balance)
    threshold: 1024,    // Only compress responses > 1KB
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:5173', 'http://127.0.0.1:5173', `http://localhost:${process.env.PORT || 5000}`];

app.use(cors({
    origin: (origin, callback) => {
        // same-origin requests have no Origin header — always allow
        if (!origin) return callback(null, true);
        // wildcard or no explicit whitelist → echo back the requesting origin
        if (!allowedOrigins) return callback(null, origin);
        // explicit whitelist
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', { stream: logger.stream }));

// ===================================
// REQUEST METRICS MIDDLEWARE
// ===================================
app.use((req, res, next) => {
    const startHr = process.hrtime.bigint();
    res.on('finish', () => {
        const durMs = Number(process.hrtime.bigint() - startHr) / 1e6;
        metrics.totalRequests++;
        metrics.minuteBuffer[metrics.minuteIdx]++;

        const code = res.statusCode;
        if      (code >= 500) metrics.statusCodes['5xx']++;
        else if (code >= 400) metrics.statusCodes['4xx']++;
        else                  metrics.statusCodes['2xx']++;

        // Rolling latency buffer
        metrics.latencies.push(durMs);
        if (metrics.latencies.length > 1000) metrics.latencies.shift();

        // Per-route stats (API only, normalize IDs)
        if (req.path.startsWith('/api/')) {
            const norm = req.path
                .replace(/\/[0-9a-f]{24}/gi, '/:id')
                .replace(/\/\d+/g, '/:n');
            const key = `${req.method} ${norm}`;
            if (!metrics.routeStats[key]) metrics.routeStats[key] = { count: 0, totalMs: 0 };
            metrics.routeStats[key].count++;
            metrics.routeStats[key].totalMs += durMs;
        }

        // Slow request log (>300ms, API only)
        if (durMs > 300 && req.path.startsWith('/api/')) {
            metrics.slowRequests.unshift({
                method: req.method,
                path: req.path,
                status: code,
                ms: Math.round(durMs),
                ts: new Date().toISOString(),
            });
            if (metrics.slowRequests.length > 15) metrics.slowRequests.pop();
        }
    });
    next();
});

// ===================================
// SWAGGER API DOCS
// ===================================
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'TOEIC API Docs',
    customCss: '.swagger-ui .topbar { background-color: #1a1a2e; }',
    swaggerOptions: { persistAuthorization: true },
}));
// JSON spec endpoint (để import vào Postman / Insomnia)
app.get('/api-docs.json', (_, res) => res.json(swaggerSpec));

// ===================================
// SERVE STATIC FILES
// ===================================
app.use(express.static(path.join(__dirname, 'public')));
app.use('/static', express.static(path.join(__dirname, 'public', 'admin')));

// ===================================
// API ROUTES (Mount BEFORE server starts)
// ===================================

app.get('/api', (req, res) => {
    res.json({
        message: 'TOEIC Game API',
        version: '2.0.0',
        database: 'MongoDB',
    });
});

// Health check endpoint for dashboard
app.get('/health', async (_, res) => {
    const { mongoose: mg } = require('./config/mongodb');
    const Vocabulary = require('./models/Vocabulary');
    const mongoStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    const mongoState = mongoStates[mg.connection.readyState] || 'unknown';
    const mongoOk = mg.connection.readyState === 1;

    let vocabularyCount = 0;
    try {
        vocabularyCount = await Vocabulary.countDocuments();
    } catch (_) {}

    const status = mongoOk ? 'OK' : 'DEGRADED';
    res.status(mongoOk ? 200 : 503).json({
        status,
        uptime: Math.floor(process.uptime()),
        mongodb: mongoState,
        vocabularyCount,
        timestamp: new Date().toISOString(),
    });
});

// ===================================
// ADMIN METRICS ENDPOINT
// ===================================
const { protect, authorize } = require('./middleware/auth');

app.get('/api/admin/metrics', protect, authorize('admin'), (req, res) => {
    const { mongoose: mg } = require('./config/mongodb');
    const mem  = process.memoryUsage();

    // Latency percentile helper
    const sorted = [...metrics.latencies].sort((a, b) => a - b);
    const pct = (p) => sorted.length
        ? Math.round(sorted[Math.floor(sorted.length * p)])
        : 0;
    const avgLatency = sorted.length
        ? Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length)
        : 0;

    // Reorder minute buffer so index 0 = oldest, 59 = most recent
    const timeline = [
        ...metrics.minuteBuffer.slice(metrics.minuteIdx + 1),
        ...metrics.minuteBuffer.slice(0, metrics.minuteIdx + 1),
    ];

    // Requests per minute (sum of last 60 slots / 60)
    const rpm = Math.round(
        metrics.minuteBuffer.reduce((s, v) => s + v, 0) / 60 * 10
    ) / 10;

    // Top 10 routes by request count
    const topRoutes = Object.entries(metrics.routeStats)
        .map(([route, v]) => ({
            route,
            count: v.count,
            avgMs: Math.round(v.totalMs / v.count),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    // Error rate %
    const total = metrics.totalRequests || 1;
    const errorRate = Math.round(
        ((metrics.statusCodes['4xx'] + metrics.statusCodes['5xx']) / total) * 1000
    ) / 10;

    res.json({
        uptime:    Math.floor(process.uptime()),
        cpu:       metrics.cpuPercent,
        memory: {
            rss:       Math.round(mem.rss       / 1024 / 1024),
            heapUsed:  Math.round(mem.heapUsed  / 1024 / 1024),
            heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
            external:  Math.round(mem.external  / 1024 / 1024),
        },
        requests: {
            total,
            rpm,
            timeline,
        },
        latency: {
            avg: avgLatency,
            p50: pct(0.50),
            p95: pct(0.95),
            p99: pct(0.99),
        },
        statusCodes:  { ...metrics.statusCodes },
        errorRate,
        topRoutes,
        slowRequests: metrics.slowRequests.slice(0, 10),
        mongo: mg.connection.readyState === 1 ? 'connected' : 'disconnected',
    });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/user', require('./routes/userState'));
app.use('/api/practice', require('./routes/practice'));
app.use('/api/vocabulary', require('./routes/vocabulary'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/shop', require('./routes/shop'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/wrong-words', require('./routes/wrongWords')); // Wrong words with spaced repetition
app.use('/api/test', require('./routes/test')); // Test MongoDB endpoints
app.use('/api/activities', require('./routes/activity')); // Activity logs for dashboard
app.use('/api/toeic', require('./routes/toeic')); // TOEIC 7-Part Test System
app.use('/api/tts', require('./routes/tts')); // Text-to-Speech natural voice
app.use('/api/reports', require('./routes/reports')); // User reports / feedback
app.use('/api/topics', require('./routes/topics'));   // Vocabulary topic/dataset management
app.use('/api/upload', require('./routes/uploadRoutes')); // User vocabulary uploads with admin management
app.use('/api/admin', require('./routes/adminDefinitions')); // Achievement + Quest definitions (admin)
app.use('/api/quests', require('./routes/quests'));          // Quest system (daily/weekly/monthly/special)
app.use('/api/checkin', require('./routes/checkin'));        // Weekly check-in (điểm danh hằng tuần)
app.use('/api/notifications', require('./routes/notifications')); // In-app notification center

// ===================================
// ADMIN STATS: USER GROWTH
// ===================================
app.get('/api/admin/stats/growth', protect, authorize('admin'), async (req, res) => {
    try {
        const User = require('./models/User');
        const days = Math.min(90, Math.max(7, parseInt(req.query.days) || 30));
        const since = new Date(Date.now() - days * 86400000);

        const raw = await User.aggregate([
            { $match: { createdAt: { $gte: since } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        // Fill missing days with 0
        const map = {};
        raw.forEach(r => { map[r._id] = r.count; });
        const result = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(Date.now() - i * 86400000);
            const key = d.toISOString().slice(0, 10);
            result.push({ date: key, count: map[key] || 0 });
        }

        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===================================
// DASHBOARD & SPA (Catch-all)
// ===================================
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html'));
});

// Data file 404 Handler (Specific for /data folder)
app.use('/data/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Data file not found: ${req.originalUrl}`,
    });
});

// API 404 Handler
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    });
});

// Admin SPA Fallback (chỉ dành cho admin dashboard)
app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html'));
});

// ===================================
// ERROR HANDLER (Must be last middleware)
// ===================================
app.use(errorHandler);

// ===================================
// START SERVER
// ===================================
const PORT = process.env.PORT || 5000;
let emailWorker = null;

async function migrateUserDependents() {
    try {
        const User        = require('./models/User');
        const UserProfile = require('./models/UserProfile');
        const UserStats   = require('./models/UserStats');

        const users = await User.find({}).select('_id email').lean();
        let created = 0;

        for (const u of users) {
            const [profile, stats] = await Promise.all([
                UserProfile.findOne({ userId: u._id }).lean(),
                UserStats.findOne({ userId: u._id }).lean(),
            ]);

            if (!profile) {
                const base = u.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').substring(0, 18) || 'user';
                const exists = await UserProfile.findOne({ username: base }).lean();
                const username = exists ? base + '_' + String(u._id).slice(-4) : base;
                await UserProfile.create({ userId: u._id, username, displayName: username, avatar: username.charAt(0).toUpperCase() });
                created++;
            }
            if (!stats) {
                await UserStats.create({ userId: u._id });
                created++;
            }
        }

        if (created > 0) logger.info(`Migration: created ${created} missing UserProfile/UserStats documents`);
    } catch (err) {
        logger.warn('Migration migrateUserDependents failed (non-fatal):', err.message);
    }
}

async function seedAchievementDefinitions() {
    try {
        const AchievementDefinition = require('./models/AchievementDefinition');
        const count = await AchievementDefinition.countDocuments();
        if (count > 0) return; // already seeded

        const DEFINITIONS = [
            { code: 'learning1', name: 'Người mới bắt đầu', description: 'Học 10 từ vựng đầu tiên', icon: '📖', category: 'learning', conditionType: 'words-learned', conditionValue: 10, rewardCoins: 100, rewardXp: 0, rewardGems: 0, isActive: true, order: 1 },
            { code: 'learning2', name: 'Học sinh chăm chỉ', description: 'Học 50 từ vựng', icon: '🎓', category: 'learning', conditionType: 'words-learned', conditionValue: 50, rewardCoins: 300, rewardXp: 0, rewardGems: 5, isActive: true, order: 2 },
            { code: 'learning3', name: 'Bậc thầy từ vựng', description: 'Học 200 từ vựng', icon: '🏆', category: 'learning', conditionType: 'words-learned', conditionValue: 200, rewardCoins: 1000, rewardXp: 0, rewardGems: 20, isActive: true, order: 3 },
            { code: 'practice1', name: 'Tay mơ', description: 'Hoàn thành 5 bài luyện tập', icon: '🎮', category: 'practice', conditionType: 'total-sessions', conditionValue: 5, rewardCoins: 50, rewardXp: 0, rewardGems: 0, isActive: true, order: 10 },
            { code: 'practice2', name: 'Điểm số hoàn hảo', description: 'Đạt 10 vòng hoàn hảo (không sai)', icon: '⭐', category: 'practice', conditionType: 'perfect-rounds', conditionValue: 10, rewardCoins: 500, rewardXp: 0, rewardGems: 10, isActive: true, order: 11 },
            { code: 'practice3', name: 'Tốc độ ánh sáng', description: 'Trả lời 100 câu trong chế độ tốc độ', icon: '⚡', category: 'speed', conditionType: 'total-answers', conditionValue: 100, rewardCoins: 300, rewardXp: 0, rewardGems: 0, isActive: true, order: 12 },
            { code: 'special1', name: 'Streaker', description: 'Học liên tục 7 ngày', icon: '🔥', category: 'streak', conditionType: 'streak', conditionValue: 7, rewardCoins: 500, rewardXp: 0, rewardGems: 15, isActive: true, order: 20 },
            { code: 'special2', name: 'Huyền thoại', description: 'Đạt level 50', icon: '👑', category: 'skill', conditionType: 'level', conditionValue: 50, rewardCoins: 0, rewardXp: 0, rewardGems: 100, isActive: true, order: 21 },
        ];

        await AchievementDefinition.insertMany(DEFINITIONS);
        logger.info(`Seeded ${DEFINITIONS.length} achievement definitions`);
    } catch (err) {
        logger.warn('seedAchievementDefinitions failed (non-fatal):', err.message);
    }
}

async function startServer() {
    logger.info('Connecting to databases...');

    await connectMongoDB();
    await connectRedis();

    // Create missing UserProfile/UserStats for pre-restructure accounts
    await migrateUserDependents();

    // Seed achievement definitions if collection is empty
    await seedAchievementDefinitions();

    // Khởi động background workers (sau khi Redis đã connect)
    emailWorker = startEmailWorker();

    app.listen(PORT, async () => {
        logger.info(`Server running on port ${PORT}`, {
            env: process.env.NODE_ENV || 'development',
            port: PORT,
        });

        if (process.env.OPENAI_API_KEY) {
            await testConnection();
        } else {
            logger.warn('OpenAI API key not configured');
        }
    });
}

startServer().catch(err => {
    logger.error('Failed to start server', { error: err.message, stack: err.stack });
    process.exit(1);
});

async function shutdown(signal) {
    logger.info(`${signal} received — shutting down gracefully...`);

    const forceExit = setTimeout(() => {
        logger.error('Graceful shutdown timed out — forcing exit');
        process.exit(1);
    }, 15_000);
    forceExit.unref();

    await Promise.allSettled([
        closeMongoConnection(),
        closeRedisConnection(),
        emailWorker?.close(),   // drain jobs đang chạy trước khi tắt
    ]);
    clearTimeout(forceExit);
    logger.info('All connections closed.');
    process.exit(0);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection', { reason: String(reason) });
    shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
    shutdown('uncaughtException');
});

