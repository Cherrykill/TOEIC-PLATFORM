# TOEIC Platform

A gamified TOEIC study application: 16 vocabulary practice modes, a full 7-part TOEIC test
engine, and an XP/level/energy economy — with a browser-based admin panel for managing content,
the item catalog, quests, and the database itself.

This document explains **why the system is built the way it is**. For a feature list, see
[`README.md`](README.md) (Vietnamese).

| | |
|---|---|
| **Backend** | Express 4 · Mongoose 9 · MongoDB Atlas · BullMQ + Redis · JWT + Google OAuth |
| **Frontend** | React 19 · Vite 8 · plain CSS · no router library |
| **Admin panel** | Vanilla JS, server-assembled HTML partials, 26 tabs |
| **Scale** | 41 Mongoose models · 28 mounted API routers · 127 React component files · ~101k LOC |
| **Tests** | 209 tests across 19 Jest suites (backend) + Vitest (frontend) |

---

## Design decisions worth reading

The interesting parts of this codebase are not the features — they are the constraints that shaped
them.

### 1. Every unit of value is computed on the server

A study app with currency, XP, and an energy budget is an app where the client has an incentive to
lie. The rule here is absolute: **the client may request, but only the server may decide.**

Energy is the clearest example. It regenerates at 1 point per minute, and that rate is applied from
the stored timestamp on the server, not counted down in the browser:

```js
// backend/utils/userStateHelper.js
const minutesPassed = Math.floor((now - lastUpdate) / 60000);
stats.energy = Math.min(stats.maxEnergy, stats.energy + gained * ENERGY_REGEN_PER_MIN);
```

Changing the system clock, editing localStorage, or replaying a request does not produce energy —
the server recomputes from `lastEnergyUpdate` every time. Speed-up cards multiply only the portion
of elapsed time that actually fell inside the card's validity window, so idling for ten hours with
one hour of boost left credits one boosted hour, not ten.

The same rule governs XP. `awardXp()` is the only sanctioned way to grant experience, and it applies
level-ups *in the same step*:

```js
// backend/utils/userStateHelper.js
function awardXp(profile, stats, amount) {
    stats.xp += xp;
    stats.totalXp = (stats.totalXp || 0) + xp;
    const r = applyLevelUp(profile, stats);   // ← not optional
    if (r.leveledUp) stats.coins += r.coinsReward;
}
```

This is not stylistic. Level gates feature access (`services/featureUnlock.js`), so a reward path
that increments `xp` without applying the level-up leaves a user who has earned a feature locked out
of it. That bug existed once; `awardXp` is the fix, and `buildFullState()` additionally self-heals
any drift it finds on read. XP thresholds follow `floor(100 × level^1.5)`.

### 2. The score predictor refuses to average incompatible numbers

The app estimates "what would you score on the real test" from your practice history. Two data
sources are available and they are **not in the same unit**:

- A **full test** (200 questions) has been converted through the official ETS scaling table — it is
  a real score out of 990.
- A **mini test** (one part) reports `readingScore` as *percentage correct × 495*. Getting 15 of 30
  Part 5 questions right yields "readingScore = 248" — which is not a Reading score, it is 50%
  scaled up.

Averaging those two produces a confident-looking number that means nothing. Instead, mini tests
contribute only **per-part accuracy**, which is projected onto the question counts of a full test
and *then* converted:

```js
// backend/services/toeicPrediction.js
const PART_COUNTS = { 1: 6, 2: 25, 3: 39, 4: 30, 5: 30, 6: 16, 7: 54 };
```

There is also deliberately **no "real exam penalty" coefficient**. Testing at home does tend to
produce higher scores than the real thing — no pressure, no time anxiety, familiar material — but
inventing a constant to subtract is fabricating data. The predictor returns a *range* with a
confidence level and lets the UI explain the caveat.

### 3. One catalog document is the single source of truth for an item

Cosmetics, boosts, consumables, and spin-wheel prizes were once described in several places at
once — a shop entry, a spin config, a quest reward — which meant the same item could have three
different prices and two different images. Now `ItemDefinition` owns `category`, `price`, `image`,
`published`, and `effect`; the shop, the spin wheel, the quest system, and the achievement system
are *channels* that filter that one catalog.

Two rules about the catalog are pure functions with their own tests
(`backend/utils/itemDefRules.js`, `tests/itemDefRules.test.js`), because both once corrupted real
data silently:

- `type` is what the **inventory** filters on to build its tabs. Derive it wrongly and the item
  still exists in the database but the player cannot see it anywhere.
- A boost card with the wrong `boostType` matches no branch in `applyShopEffect`, so the card is
  consumed and nothing turns on.

### 4. A TOEIC question document is a *screen*, not a question

Parts 3, 4, 6 and 7 present several questions against one shared audio clip or reading passage. The
original model stored one document per question with a `groupId` to tie them together, which meant
every read had to re-assemble groups and every write had to keep the group consistent.

The model is now **one document per question screen**, with the individual questions nested inside.
A related consequence: question order comes from the standard TOEIC question number stored on each
question, not from the order an admin happened to add screens — sorting by insertion order produced
43 backwards jumps in a real full test (Part 1 rendering as 2, 4, 1, 3, 5, 6…). The sort is stable,
so screens missing a number keep their relative order and sink to the end rather than being
scrambled (`backend/services/questionSetService.js`).

### 5. MongoDB is the source of truth; localStorage is a parachute

The client keeps a local copy of game state so a dropped connection does not lose a study session,
but the sync is deliberately one-directional in authority: local state is a *cache and a buffer*,
never an input the server trusts. On reconnect the server's view wins for every value that matters
(currency, XP, level, energy). The HTTP wrapper (`frontend/src/api/http.js`) centralises token
attachment, timeouts, and expiry handling so that one 401 path exists rather than nineteen.

### 6. Background work is queued, and the app boots without it

Email delivery runs through BullMQ on Redis. Redis is treated as **optional**: it is connected in
the background and never awaited during startup, because awaiting an unavailable Redis parks the
process in a reconnect loop and `app.listen()` is never reached — turning a missing cache into a
total outage.

```js
// backend/server.js
connectRedis().catch((e) => logger.warn('Redis init skipped (server continues)', ...));
```

### 7. Spaced repetition drives the "review mistakes" mode

Words answered incorrectly are recorded per user with a review schedule, and the *Review Mistakes*
practice mode draws from that queue rather than from the general vocabulary pool, so study time
concentrates where accuracy is lowest (`backend/models/WrongWord.js`,
`tests/wrongWordSpacedRepetition.test.js`).

---

## Architecture

```
                    React SPA (Vite)                    Vanilla-JS admin panel
                 frontend/src/**                     backend/public/admin/**
                          │                                     │
                          │  fetch (bearer JWT)                 │
                          ▼                                     ▼
        ┌───────────────────────────────────────────────────────────────┐
        │  Express  ·  helmet → cors → parsers → routers → 404 → errors │
        └───────────────────────────────────────────────────────────────┘
              │                    │                      │
         controllers          services               middleware
         (thin: req→res)    (rules, no req/res)   (auth, validate, upload)
              │                    │
              └────────┬───────────┘
                       ▼
                 Mongoose models ──▶ MongoDB Atlas
                       │
                 BullMQ ──▶ Redis ──▶ worker (email)     Cloudinary (media, disk fallback)
```

The target layering is `routes → controllers → services → models`, documented in
[`backend/CONTRIBUTING.md`](backend/CONTRIBUTING.md) along with the error contract: controllers
`throw`/`next()` an `ApiError` and never build a 5xx response by hand, so every failure exits
through one handler with one shape.

---

## Getting started

**Requirements:** Node.js 18+, a MongoDB instance (Atlas or local). Redis optional.

```bash
npm run install:all                        # root + backend + frontend

cp backend/.env.example backend/.env       # then fill in MONGODB_URI and JWT_SECRET
```

Use `backend/.env.example`, not the copy at the repository root — the backend one is the complete
list, and the server loads `.env` relative to `backend/`. Only `MONGODB_URI` and `JWT_SECRET` are
required; Google sign-in, Cloudinary media storage, email, and the AI features each activate when
their variables are present and stay dormant when they are not.

The server refuses to start without `MONGODB_URI` and `JWT_SECRET` rather than falling back to
defaults — a missing secret should stop the process, not silently weaken authentication.

```bash
npm run dev                  # backend + frontend together
npm run dev:backend          # backend only  (nodemon)
npm run dev:frontend         # frontend only (vite)
npm run build                # production build of the frontend
```

Create the first administrator:

```bash
cd backend
npm run create-admin
npm run change-password      # change any account's password (prompts, input hidden)
```

---

## Project layout

```
backend/
├── routes/          28 routers, one per domain, mounted in server.js
├── controllers/     request handlers
├── services/        business rules — no req/res
├── models/          41 Mongoose schemas
├── middleware/      auth · validate · upload · cache · errorHandler
├── utils/           ApiError · logger · score conversion · economy log
├── queues/ workers/ BullMQ queue and the email worker
├── scripts/         migrations, seeds, media and admin operations
├── tests/           19 Jest suites, pure logic (no database required)
└── public/admin/    the admin dashboard (HTML partials + vanilla JS)

frontend/src/
├── api/             HTTP wrapper + one module per domain
├── game/            GameState store, GameContext, energy, cosmetics
├── components/      feature folders (toeic, practice, shop, profile, …)
├── layouts/  ui/    navigation, status bar, shared primitives
└── assets/styles/   global stylesheets
```

---

## Testing

```bash
cd backend  && npm test      # 209 tests, 19 suites
cd frontend && npm test      # Vitest
```

Backend tests are deliberately **pure**: they exercise scoring conversion, level-up arithmetic,
energy regeneration, quest periods, shop effects, spaced repetition, catalog rules, and the auth
guard without touching a database, so the suite runs in about three seconds and can run on every
save. That is also its limitation — see below.

---

## Security posture

- **Bearer JWT**, verified on every request; the user record is re-read and account state
  (disabled, locked, temporarily locked) is enforced at request time, not only at login.
- **Role checks are server-side.** Every admin route carries `protect` + `authorize('admin')`; the
  UI hiding a control is never the control.
- **Rate limiting** on all credential endpoints, with a tighter budget on administrator login.
- **Currency, XP, level, and energy are unwritable by clients** by construction — see §1.
- **Secrets** come from the environment with no fallback defaults, and the process exits at boot if
  a required one is missing.
- API documentation (`/api-docs`) is served in development only.

The repository carries an audit trail: findings are recorded with file/line evidence, a stated
confidence level, and a fix commit. Specifics are kept in the commit history rather than summarised
here.

---

## Known limitations

Stated deliberately — these are the things a reviewer would find anyway.

- **No integration or end-to-end tests.** The suite covers pure logic well and the HTTP layer not at
  all; guards, routing, and database interaction are verified by hand.
- **Development and production share one MongoDB cluster.** Convenient, and the reason several
  operations are more dangerous than they look.
- **The admin panel has no module system.** 24 scripts are ordered by hand in one HTML file with
  manual cache-busting; it works, and it is the least pleasant part of the codebase to change.
- **Layering is a target, not a finished state.** Some route files still query models directly and
  hold business logic; `CONTRIBUTING.md` scopes the convention to new and touched code rather than
  mandating a sweeping refactor.
- **Edge validation covers 2 of 28 routers.** The schema mechanism exists and is adopted when a
  route is touched.
- **Not deployed publicly yet.** Running it requires your own MongoDB instance.

---

## License

ISC
