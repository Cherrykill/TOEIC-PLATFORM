---
name: express-review
description: Reviews Express.js framework mechanics in ONE module — middleware order, mounting, async error propagation, the request/response lifecycle, router composition, guard placement, body parsing, and shutdown behaviour. Framework-gated: only for codebases where Express is detected and NestJS is not. Invoked by project-auditor; also usable standalone on a router, controller, or server bootstrap.
allowed-tools: Read, Write, Glob, Grep, Bash
---

# express-review

## Purpose

Find the defects that come from Express's own model rather than from the business logic: ordering
that silently bypasses a guard, an async handler whose rejection never reaches the error handler,
a response written twice, a catch-all mounted too early, a middleware that runs on every request
because it was mounted at the app instead of the router.

These are invisible to unit tests and to reading a single handler in isolation — they live in the
*composition*, which is why they need their own lens.

**Boundary with the universal lenses** (do not double-report; route instead):

| Concern | Owner |
|---|---|
| Is the guard *reachable/bypassable*, is input exploitable | `security-review` |
| Is the response contract consistent, are errors distinguishable to the client | `api-review` |
| Are layers separated, does dependency flow one way | `architecture-review` |
| Query cost, indexes, payload size | `performance-review` |
| **Ordering, mounting, async propagation, lifecycle, framework idioms** | **this lens** |

## Activation examples

- "Review the Express setup"
- "Is our middleware order correct?"
- "Do async errors actually reach the error handler?"
- "Audit `backend/routes` and `server.js`"
- Dispatched by `project-auditor` for kinds: backend routes, backend controllers, middleware,
  config/infra — **only when Express is detected and NestJS is not** (see
  `project-auditor/references/stack-detection.md`).

## Required reading

`_shared/review-protocol.md` · `_shared/issue-format.md` · `_shared/report-format.md`.

## Inputs

`module.slug`, `module.path(s)`, `module.files`, **Express major version** (4 vs 5 changes async
error handling materially), the declared error contract, where the app bootstrap lives, and which
guards are expected on which routes.

## Workflow

1. **Read the bootstrap first, in order.** Even when the module is a single router, the app's
   `use()` sequence determines what is true inside it. Extract the full chain with line numbers:

   ```bash
   rg -n "app\.use\(|app\.(get|post|listen)\(" backend/server.js
   ```

   Write the chain down as an ordered list: security headers → parsers → sanitizers → static →
   logging → rate limits → routers → 404 → error handler. Then check the invariants:
   - error handler (4-arg) is **last**;
   - the catch-all / 404 is after every router (a `app.use('/api/*')` placed before a router makes
     that router dead — verify by comparing line numbers, this is a real and silent bug);
   - body parsers precede any router that reads `req.body`;
   - sanitizers/validators precede the handlers that trust them;
   - static file serving does not shadow an API prefix;
   - `trust proxy` set if rate limiting or IP logging runs behind a proxy.

2. **Map the per-route middleware chain.** For each route in the module: method, path, the guards
   on it, and the handler. Then compare siblings — the outlier is the finding:

   ```bash
   rg -n "router\.(get|post|put|patch|delete)\(" <module-path> -A1
   rg -n "router\.use\(" <module-path>          # router-level middleware applies to what follows only
   ```

   `router.use(guard)` placed *after* some routes protects only the ones below it. Check the line
   numbers, do not assume router-level means all routes.

3. **Async error propagation** — the highest-yield check in this lens. On Express 4, a rejected
   promise in a handler does **not** reach the error handler; it becomes an unhandled rejection and
   the client hangs until timeout. Find handlers that can reject without a catch:

   ```bash
   rg -n "(?:router|app)\.(get|post|put|patch|delete)\([^)]*async" <module-path>
   rg -n "async \(req, res\)" <module-path>        # no `next` in signature → cannot forward errors
   rg -n "catch \(err\) \{[^}]*\}" <module-path> -U --pcre2   # empty or non-forwarding catch
   ```

   For each async handler, confirm one of: wrapped by an async-handler utility, has a `try/catch`
   that calls `next(err)`, or the project is on Express 5 (which forwards rejections). A handler
   with `catch (err) { console.error(err) }` and no response is a hang, not a logged error — check
   whether a response is sent on every path.

4. **Response lifecycle.** Look for double-send and missing-send:
   - two `res.json`/`res.send`/`res.redirect` reachable on one path (`ERR_HTTP_HEADERS_SENT`);
   - a `return` missing after `res.status(...).json(...)` in an early-exit branch — execution
     continues and sends again (very common; grep and read each guard clause);
   - branches that neither respond nor call `next()` → the request hangs;
   - `res` written after an `await` that can throw, inside the same try;
   - streaming/`pipe` without an `error` listener.

   ```bash
   rg -n "res\.(json|send|end|redirect|sendFile)\(" <module-path> -B2   # check for a preceding `return`
   ```

5. **Router composition and mounting.** Path prefixes duplicated between mount point and route
   (`app.use('/api/shop', …)` + `router.get('/shop/:id')` → `/api/shop/shop/:id`), the same prefix
   mounted twice from different files (later mount silently unreachable for overlapping paths),
   param routes shadowing literal ones (`/:id` before `/stats` makes `/stats` an id), and
   `mergeParams` needed but absent in nested routers.

   ```bash
   rg -n "app\.use\('/api" backend/server.js -o | sort | uniq -d      # duplicate prefixes
   rg -n "router\.get\('/:" <module-path>                              # param routes: check order
   ```

6. **Framework idioms and configuration.** Handlers doing blocking synchronous work (large
   `JSON.parse`, `sharp`/crypto without async, sync `fs`) on the event loop; body-parser limits
   (default `100kb` — either too small for the real payload or unbounded where `limit` was raised);
   file upload middleware applied globally instead of per-route; `helmet`/`cors`/`compression`
   present and ordered sensibly; per-request work that should be module-level (compiling a regex,
   constructing a client, reading config); graceful shutdown (`server.close`, DB/Redis disconnect,
   in-flight requests) — its absence loses in-flight work on every deploy.

7. **Verification pass** (protocol §5). Every ordering finding must cite the **two** line numbers
   whose relative order is the defect. Every async finding must name what the client observes
   (hang / 500 with no log / unhandled rejection crash under `--unhandled-rejections=strict`).
   Then write the report and return the digest.

## Review checklist

**Bootstrap order**
- [ ] 4-arg error handler is last
- [ ] 404/catch-all after all routers
- [ ] Body parsers before body-reading routers
- [ ] Sanitizers/validators before the handlers that trust them
- [ ] Static serving does not shadow API prefixes
- [ ] `trust proxy` set when behind a proxy and rate limiting or IP logging is used
- [ ] Security middleware (`helmet`, `cors`) applied before routes, with intentional config

**Per-route chains**
- [ ] Guards present and consistent across sibling routes
- [ ] `router.use(guard)` placed before every route it must protect
- [ ] Validation middleware attached to every write route
- [ ] No guard applied twice with conflicting behaviour

**Async error propagation**
- [ ] Every async handler either has an async wrapper, or `try/catch` → `next(err)`
- [ ] Every handler with a `catch` declares `next` in its signature
- [ ] No `catch` that logs and returns without responding
- [ ] No `catch` that swallows silently
- [ ] Express version's rejection behaviour accounted for (4 vs 5)
- [ ] Errors inside middleware (not just handlers) also forwarded

**Response lifecycle**
- [ ] Exactly one response per path
- [ ] `return` after every early-exit response
- [ ] No branch that neither responds nor calls `next()`
- [ ] Streams have error handling
- [ ] Nothing writes to `res` after the response completes (async callbacks, timers)

**Router composition**
- [ ] No duplicated prefix between mount and route
- [ ] No prefix mounted twice with overlapping paths
- [ ] Literal routes declared before param routes that would shadow them
- [ ] `mergeParams` where nested routers need parent params
- [ ] One domain per router file, mounted once

**Framework configuration**
- [ ] Body/upload size limits set deliberately
- [ ] Upload middleware scoped to the routes that need it
- [ ] Rate limiting on expensive and credential routes, keyed correctly
- [ ] No blocking sync work in a handler
- [ ] Per-request work that could be hoisted, hoisted
- [ ] Graceful shutdown closes server, DB, queues, and drains in-flight requests
- [ ] `NODE_ENV`-dependent behaviour (stack traces, logging) behaves correctly in production

## Best practices

- **Cite two lines for every ordering finding.** "`app.use('/api/*', 404)` at `server.js:198`
  precedes `app.use('/api/inventory')` at `server.js:180`" is proof; "middleware order is wrong"
  is not.
- **Read the bootstrap even for a one-router module.** Half of this lens's findings only exist in
  the relationship between the router and the app.
- **Name what the client sees.** Hang, 500 without a log, wrong status, duplicate send. That is
  what makes an async finding actionable rather than theoretical.
- **Compare siblings within a router.** Consistency deviations are cheap to find and almost always
  real.
- **Check the version before citing behaviour.** Express 4 and 5 differ exactly where this lens
  works hardest.
- **Route, don't duplicate.** Exploitability → security; contract shape → api; layering →
  architecture. Keep this report about mechanics.

## Anti-patterns

- ❌ Running this lens on a NestJS or Fastify codebase (the gate exists for this reason)
- ❌ "Add `express-async-errors`" as a top finding without showing a handler that actually hangs
- ❌ Reporting a missing guard that a `router.use` above it already applies — check line order
- ❌ Re-reporting an authorization hole already owned by `security-review`
- ❌ Style findings about arrow vs. function handlers, or router file layout
- ❌ Demanding graceful shutdown as High on a project with no deployment yet — set effort and
  severity by real consequence
- ❌ Claiming double-send without a reachable path where both fire

## Output template

Per `_shared/report-format.md`, plus this section before `Findings`:

```markdown
## Middleware Chain

| # | Mount | Middleware | Line | Note |
|---|---|---|---|---|
| 1 | app | `helmet()` | server.js:60 | |
| 2 | app | `express.json({limit:'2mb'})` | server.js:71 | |
| … | | | | |
| 29 | `/api/inventory` | router | server.js:180 | |
| 30 | `/api/*` | 404 catch-all | server.js:198 | after all routers ✓ |
| 31 | app | `errorHandler` (4-arg) | server.js:205 | last ✓ |

**Express version:** <4.x | 5.x> — rejection forwarding: <no | yes>

## Route Chains (this module)

| Method + path | Guards | Validation | async | Error path |
|---|---|---|---|---|
| `POST /purchase` | `protect` | `validate(purchaseSchema)` | yes | try/catch → `next(err)` ✓ |
| `GET /catalog` | none (public) | — | yes | **no catch → rejection unhandled** |
```

Digest example:

```
DIGEST express backend.routes.inventory · coverage 4/4 files · complete
VERDICT fragile
SUMMARY Two async handlers have no catch and no async wrapper, so on Express 4 a DB error leaves
the client hanging until timeout with nothing in the error log. One guard clause responds without
returning, so a rejected purchase also attempts a second send.
REPORT .claude-audit/reports/backend.routes.inventory.express.md

| ID | Sev | Conf | Title | Location | Eff | Impact |
|---|---|---|---|---|---|---|
| EXPRESS-backend.routes.inventory-001 | High | High | 2 async handlers cannot forward rejections; client hangs on DB error | routes/inventory.js:34 (+1) | S | correctness |
| EXPRESS-backend.routes.inventory-002 | High | High | Missing `return` after early-exit response causes a second send | controllers/inventoryController.js:88 | S | correctness |
| EXPRESS-backend.routes.inventory-003 | Medium | Medium | `router.use(protect)` at line 22 leaves the 2 routes above it unguarded | routes/inventory.js:22 | S | correctness |

STRENGTHS Error handler is mounted last and the 404 catch-all sits after every router (server.js:198-205)
THEMES Async error forwarding is per-handler and inconsistent; no shared async wrapper exists
ROUTE security: the 2 routes above router.use(protect) expose inventory reads — verify reachability
REMAINING none
```

## Directory structure

```
.claude/skills/express-review/
└── SKILL.md
```
