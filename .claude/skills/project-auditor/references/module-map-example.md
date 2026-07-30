# Module Map — worked example (this repository)

A real partition, to show the shape a good module map takes. **Regenerate it at audit time**
— file counts drift. Use this as the template, not as the truth.

Repo: TOEIC Platform · 519 tracked files · Express + MongoDB backend, React (Vite) frontend,
vanilla-JS admin panel served from `backend/public/admin`.

## Stack table (step 2 output)

| Concern | Choice | Notes for reviewers |
|---|---|---|
| Backend | Express 4, Mongoose 9 | `routes → controllers → services → models`; layering is a stated *goal*, not fully reached (`backend/CONTRIBUTING.md`) |
| Auth | JWT + Google OAuth | `middleware/auth.js`, `protect` guard |
| Frontend | React 19 + Vite 8, no router lib | Context-based state (`frontend/src/game/GameContext.jsx`) |
| Styling | Plain CSS, 11 global stylesheets | `frontend/src/assets/styles/*` — no CSS modules, no tokens file |
| Admin panel | Vanilla JS, 20 script tags, HTML partials | `backend/public/admin` — server-assembled via `@include` comments |
| Data | MongoDB, 41 models | Economy/XP/level authoritative on server (project invariant) |
| Async | BullMQ + Redis, 1 worker | `backend/queues`, `backend/workers` |
| Tests | Jest (backend, 15 files), Vitest (frontend, ~3 files) | `npm test` in each workspace |
| Media | Cloudinary with disk fallback | `services/cloudinaryAssets.js` |

## Declared conventions (the yardstick for findings)

From `CLAUDE.md` and `backend/CONTRIBUTING.md` — findings that violate these are stronger;
findings that merely disagree with them are demoted:

- Errors: controllers `throw`/`next(ApiError)`, never `res.status(5xx)` in a `catch`; every
  handler with a `catch` declares `next`.
- Write routes: validate at the edge via `middleware/validate.js` + `validators/schemas.js`,
  with messages identical to the controller's.
- Layering target: controllers thin, business rules in `services/`.
- Naming: route file `<domain>.js`, controller `<domain>Controller.js`, ops scripts in
  `scripts/`.
- Currency/XP/level/energy mutations are **server-side only**; client writes are a defect
  by definition.
- XP must be added via `awardXp`/`applyLevelUp` and both `profile` and `stats` saved.
- Comments in Vietnamese; no large refactors — stability is prioritized.
- Backend logic changes require `npm test` to pass and new logic requires new tests.

## Module map

`Kind` values map to the dispatch matrix in `orchestration.md`.

**Gating applied to this example:** React and Express are both detected here, so `react-review` and
`express-review` are active. The `Lenses` column below predates the Express lens — when regenerating,
add `express` to the **routes / controllers / middleware / bootstrap** modules (`be.auth`,
`be.routes-rest`, `be.utils` middleware, and the `server.js` bootstrap), and **not** to services,
models, workers, or the vanilla-JS admin panel: those have no middleware chain and no React signal.
`vue`/`nextjs`/`nestjs` are absent from this repo and must never appear in any row.

| # | Slug | Path | Kind | Files | Lenses | Order | Why here |
|---|---|---|---|---|---|---|---|
| 1 | `repo` | (skeleton only) | repo-wide skeleton | — | architecture | 1 | Frames everything; import graph + boundaries only |
| 2 | `secrets-deps` | `.env.example`, `Dockerfile`, `docker-compose.yml`, lockfiles, CI | config/infra | ~8 | security | 2 | Cheapest highest-consequence pass |
| 3 | `test-strategy` | `backend/jest.config.js`, `frontend/vitest` config, both test dirs (shape only) | tests | ~20 | testing | 3 | Establishes what the suite protects before judging risk elsewhere |
| 4 | `be.auth` | `routes/auth.js`, `controllers/authController.js`, `middleware/auth.js`, `models/User.js`, `models/OtpCode.js` | backend routes+controllers | ~5 | security, api, architecture, testing | 4 | Auth is the highest-consequence surface |
| 5 | `be.economy` | `services/shopEffects.js`, `services/inventoryService.js`, `utils/userStateHelper.js`, `utils/economyLog.js`, `controllers/shopController.js`, `routes/shop.js`, `routes/inventory.js` | backend services | ~7 | security, architecture, technical-debt, testing | 5 | Money/XP authority — a defect here is exploitable |
| 6 | `be.toeic-scoring` | `controllers/toeicController.js`, `utils/toeicScoreConverter.js`, `utils/scoreCalculator.js`, `services/questionSetService.js`, `models/Toeic*.js` | backend services | ~10 | architecture, performance, testing, technical-debt | 6 | Core domain, high churn, scoring correctness |
| 7 | `be.gamification` | `controllers/{quest,checkin,notification}Controller.js`, `services/{questEvaluators,questPeriod,featureUnlock,seasonService}.js` | backend services | ~8 | architecture, technical-debt, testing, security | 7 | Grants rewards → touches the economy invariant |
| 8 | `be.models` | `backend/models/*` (41) — **split into 3 by domain** | data models | 41 | architecture, security, performance, naming | 8 | Over budget as one module: split user/economy/toeic clusters |
| 9 | `be.routes-rest` | remaining `backend/routes/*` | backend routes | ~20 | security, api, naming | 9 | Consistency pass across the REST surface |
| 10 | `be.utils` | `backend/utils/*` (17) | middleware/utils | 17 | technical-debt, naming, architecture, testing | 10 | Shared blast radius |
| 11 | `be.queues` | `backend/queues`, `backend/workers` | queues/workers | 2 | architecture, performance, security, testing | 11 | Small but failure-prone |
| 12 | `be.scripts` | `backend/scripts/*` (22 + subdirs) | scripts/migrations | 36 | security, technical-debt | 12 | Destructive ops on real data |
| 13 | `admin.core` | `backend/public/admin/js/core/*` (7 files, incl. `tabs.js` ~1,700 lines) | vanilla-JS admin | 7 | security, technical-debt, performance, naming | 13 | XSS via innerHTML templating; `tabs.js` is its own sub-module |
| 14 | `admin.features` | `backend/public/admin/js/features/**` | vanilla-JS admin | ~14 | security, technical-debt, naming | 14 | Same risks, lower churn |
| 15 | `admin.markup` | `backend/public/admin/partials/**`, `dashboard.html`, `css/dashboard.css` | vanilla-JS admin | ~40 | css, technical-debt, security | 15 | 20 versioned script tags = load-order coupling |
| 16 | `fe.state` | `frontend/src/game/*` (14) | frontend state | 14 | react, architecture, performance, technical-debt, testing | 16 | Single context feeding the whole app — highest React risk |
| 17 | `fe.api` | `frontend/src/api/*` (19) | frontend API client | 19 | api, technical-debt, naming, testing, security | 17 | Error/retry/validation consistency across 19 modules |
| 18 | `fe.toeic-runner` | `frontend/src/components/toeic/{runner,hooks,selector}` | React feature | 37 | react, performance, technical-debt, testing | 18 | Largest, most stateful feature; **split runner vs. selector** |
| 19 | `fe.practice` | `frontend/src/components/practice/**` (incl. 16 modes) | React feature | 27 | react, performance, technical-debt, naming | 19 | 16 near-sibling modes → duplication hotspot |
| 20 | `fe.economy-ui` | `components/{shop,inventory,spin}` | React feature | ~5 | react, api, naming | 20 | Mirrors `be.economy`; check client never writes currency |
| 21 | `fe.profile-social` | `components/{profile,leaderboard,season,achievements,quest,checkin}` | React feature | ~20 | react, naming, technical-debt | 21 | Leaf features |
| 22 | `fe.shared-ui` | `frontend/src/ui/*`, `frontend/src/layouts/*` | shared UI | 12 | react, css, naming, performance | 22 | Reused everywhere |
| 23 | `fe.styles` | `frontend/src/assets/styles/*` (11) | global stylesheets | 11 | css, naming, performance | 23 | No token layer — expect consistency findings |
| 24 | `fe.lib` | `frontend/src/lib/*`, `frontend/src/services/*` | utils | 11 | technical-debt, naming, testing | 24 | Leaves |

**Not reviewed** (recorded with reasons): `backend/public/admin/vendor/**` (vendored
FontAwesome), `frontend/public/assets/**` (binary media), `node_modules`, lockfiles,
`backend/data/**` (seed data — reviewed as data, not code, only if the audit scope includes it).

## Notes this map encodes (do this in your own maps)

- **Split what is over budget** (`be.models` 41 files, `fe.toeic-runner` 37) rather than
  letting a lens skim it.
- **A single oversized file becomes its own module** (`admin/js/core/tabs.js`, ~1,700 lines).
- **Pair mirrored modules** (`be.economy` ↔ `fe.economy-ui`) so invariant violations on
  either side are visible.
- **Lens sets are deliberate**: no `css` on services, no `react` on the vanilla admin panel,
  `security` wherever money, auth, destructive scripts, or `innerHTML` live.
- **Order by consequence, then churn** — auth and economy before presentational leaves.
