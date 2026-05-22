/**
 * k6 Load Test — TOEIC Platform
 * Install: choco install k6  (hoặc https://k6.io/docs/get-started/installation)
 *
 * Chạy:
 *   k6 run load-test.js                          # 100 VU, 1 phút
 *   k6 run --vus 50 --duration 30s load-test.js  # tuỳ chỉnh
 *
 * Kết quả quan trọng:
 *   http_req_duration p(95) < 500ms  → OK
 *   http_req_failed   < 1%           → OK
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:5000';

// Thay bằng JWT token hợp lệ để test các route cần auth
// Lấy bằng cách login rồi copy token từ DevTools → Application → localStorage
const AUTH_TOKEN = __ENV.TOKEN || '';

export const options = {
    stages: [
        { duration: '20s', target: 100 },  // ramp → 100
        { duration: '20s', target: 300 },  // ramp → 300
        { duration: '20s', target: 500 },  // ramp → 500
        { duration: '20s', target: 1000 }, // ramp → 1000
        { duration: '30s', target: 1000 }, // giữ 1000
        { duration: '20s', target: 0 },    // ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<1500', 'p(99)<3000'],
        // dừng sớm nếu error rate > 10% (tránh sập Atlas)
        http_req_failed: ['rate<0.10'],
    },
};

// Custom metrics
const vocabLatency     = new Trend('vocab_latency');
const leaderboardLatency = new Trend('leaderboard_latency');
const authLatency      = new Trend('auth_latency');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const headers      = { 'Content-Type': 'application/json' };
const authHeaders  = { 'Content-Type': 'application/json', Authorization: `Bearer ${AUTH_TOKEN}` };

function checkOk(res, name) {
    check(res, {
        [`${name} status 200`]: (r) => r.status === 200,
        [`${name} has success`]: (r) => {
            try { return JSON.parse(r.body).success === true; } catch { return false; }
        },
    });
}

// ─── Scenarios ────────────────────────────────────────────────────────────────
export default function () {
    const rand = Math.random();

    if (rand < 0.35) {
        // 35% — load vocabulary (phổ biến nhất)
        const res = http.get(`${BASE_URL}/api/vocabulary?limit=20&page=1`, { headers });
        checkOk(res, 'vocabulary');
        vocabLatency.add(res.timings.duration);

    } else if (rand < 0.55) {
        // 20% — leaderboard
        const period = ['all-time', 'weekly', 'daily'][Math.floor(Math.random() * 3)];
        const res = http.get(`${BASE_URL}/api/leaderboard/${period}`, { headers });
        checkOk(res, 'leaderboard');
        leaderboardLatency.add(res.timings.duration);

    } else if (rand < 0.70) {
        // 15% — search vocab
        const words = ['ability', 'account', 'achieve', 'adapt', 'announce', 'apply'];
        const word  = words[Math.floor(Math.random() * words.length)];
        const res   = http.get(`${BASE_URL}/api/vocabulary?search=${word}`, { headers });
        checkOk(res, 'vocab_search');

    } else if (rand < 0.80) {
        // 10% — topics
        const res = http.get(`${BASE_URL}/api/topics`, { headers });
        checkOk(res, 'topics');

    } else if (rand < 0.88) {
        // 8% — leaderboard stats
        const res = http.get(`${BASE_URL}/api/leaderboard/stats/all-time`, { headers });
        checkOk(res, 'lb_stats');

    } else if (rand < 0.94 && AUTH_TOKEN) {
        // 6% — user state (cần auth)
        const res = http.get(`${BASE_URL}/api/user/state`, { headers: authHeaders });
        checkOk(res, 'user_state');
        authLatency.add(res.timings.duration);

    } else {
        // 6% — online count
        const res = http.get(`${BASE_URL}/api/leaderboard/online-count`, { headers });
        checkOk(res, 'online_count');
    }

    sleep(Math.random() * 2 + 0.5); // nghỉ 0.5–2.5s giữa requests (simulate real user)
}
