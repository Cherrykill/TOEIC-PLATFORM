---
name: security-review
description: Defensive security audit of ONE module — XSS, CSRF, authentication, authorization, input validation, output escaping, secrets, environment variables, dependency vulnerabilities and insecure API surfaces. Use when auditing a module for exploitable weaknesses, or for a repo-wide secrets-and-dependencies pass. Invoked by project-auditor as part of a code audit; also usable standalone on a route, controller, or admin surface.
allowed-tools: Read, Write, Glob, Grep, Bash
---

# security-review

> **Name note:** Claude Code ships a built-in `security-review` skill that reviews *pending
> changes on the current branch*. This project skill reviews *one module of the existing
> codebase* as part of an audit. If the name collides in your setup, rename this directory to
> `security-module-review` and update the dispatch matrix in
> `project-auditor/references/orchestration.md`.

## Purpose

Find the weaknesses an attacker or a careless client could actually exploit in this module —
and say how. Defensive only: the output is a finding plus a fix, never a working exploit.

Two things this lens must never do: assume a value is trusted because it "comes from our own
frontend", and assume a control exists because it exists somewhere else in the app. Trace the
guard or report its absence.

## Activation examples

- "Security review of `backend/routes/auth`"
- "Is this endpoint authorized correctly?"
- "Any XSS risk in the admin panel?"
- "Check for committed secrets and vulnerable dependencies"
- Dispatched by `project-auditor` for kinds: backend routes/controllers, money/score services,
  data models, admin panel, scripts/migrations, config/infra, and the `secrets-deps` pass.

## Required reading

`_shared/review-protocol.md` · `_shared/issue-format.md` · `_shared/report-format.md`.

## Inputs

`module.slug`, `module.path(s)`, `module.files`, auth mechanism, role model, which values are
server-authoritative invariants, whether this module is internet-facing.

## Workflow

1. **Map the trust boundary.** For this module, list: every entry point (route, handler,
   message consumer, form, script), and for each one — who can reach it (anonymous / any
   logged-in user / role X / internal only), and which inputs it takes. This table is the
   backbone of the review; findings that are not anchored to an entry point are usually noise.

2. **Follow untrusted input to a sink.** For each input, trace it to where it lands: a query,
   a filesystem path, an HTML string, a shell command, a redirect, a template, a response
   body, a price/amount calculation. A finding is *reachable input* → *dangerous sink* with
   the path shown, not the presence of a scary function.

   ```bash
   rg -n "req\.(body|params|query|headers|cookies)" <module-path>
   rg -n "innerHTML|outerHTML|insertAdjacentHTML|document\.write|dangerouslySetInnerHTML" <module-path>
   rg -n "eval\(|new Function\(|setTimeout\(\s*['\"]" <module-path>
   rg -n "exec\(|execSync|spawn\(" <module-path>
   rg -n "path\.join\([^)]*req\.|readFile.*req\.|unlink|rm -rf" <module-path>
   ```

3. **Authentication check.** Where does identity come from, and is it verified on every
   request? Look for: token verification vs. mere decoding, expiry and clock handling, secret
   strength and origin, refresh/rotation, session invalidation on password change or logout,
   password hashing algorithm and cost, OAuth token/audience verification, rate limiting and
   lockout on credential endpoints, timing-safe comparison, and identity taken from the request
   body instead of the verified token (a classic: `req.body.userId`).

4. **Authorization check** — per entry point, not per module. The two dominant real-world bugs:
   - **Missing guard:** a write/admin route with no `protect`/role middleware. Compare siblings
     in the same router; the outlier is usually the bug.
   - **Object-level (IDOR):** a guard proves *who you are* but the query does not scope to
     *your* resources (`findById(req.params.id)` with no owner filter). Report the exact query.

   ```bash
   rg -n "router\.(get|post|put|patch|delete)\(" <module-path> -A1   # guard on the same line?
   rg -n "findById\(req\.params|findOne\(\{\s*_id" <module-path>      # ownership scoping?
   rg -n "role\s*===|isAdmin|requireAdmin|protect" <module-path>
   ```

   Also check client-side-only gating: a UI that hides a feature while the endpoint remains
   open is an authorization finding, not a UI one.

5. **Input validation.** Is validation at the edge, schema-driven, and does it constrain type,
   range, length, and shape — or does it only check presence? Specifically: numeric fields used
   in economy/score math (negative quantity, float, huge values, `NaN`), array/object where a
   scalar is expected, mass assignment (`Object.assign(doc, req.body)` / spreading the body
   into a model), operator injection in NoSQL queries (`{$gt: ''}` as a value), enum fields
   accepting arbitrary strings, and unbounded string lengths reaching storage.

6. **Output escaping.** For every place data leaves the module into a rendering context:
   HTML-escaped? URL-encoded in URLs? JSON-encoded in scripts? For a DOM-templating admin panel
   built from `innerHTML` + template literals, treat every interpolated user-controlled field
   as a stored-XSS candidate and cite the interpolation line. Also: sensitive fields leaking in
   responses (password hashes, tokens, internal IDs, other users' emails), and verbose errors
   or stack traces returned to clients.

7. **CSRF / state-changing requests.** How are mutations authenticated? Bearer token in a
   header is largely CSRF-immune; cookie-based session auth is not — then look for
   SameSite/CSRF tokens. Check `cors` configuration for reflected/`*` origins combined with
   credentials, and for state-changing `GET` endpoints.

8. **Secrets & environment.** Committed credentials, real values in `.env.example`, secrets in
   client-side code or in the bundle, tokens in logs, default/weak fallbacks
   (`process.env.JWT_SECRET || 'dev'` — a High finding on its own), and secrets in error
   messages or git history.

   ```bash
   rg -n "(?i)(api[_-]?key|secret|token|password|passwd|credential|private[_-]?key)\s*[:=]" <module-path>
   rg -n "process\.env\.\w+\s*\|\|\s*['\"]" <module-path>     # insecure fallbacks
   rg -n "sk-|AKIA|-----BEGIN|ghp_|xoxb-" <module-path>       # provider key shapes
   git log --oneline -S 'JWT_SECRET' -- . | head              # secret history (repo-wide pass)
   ```

9. **Dependencies** (repo-wide pass only, not per module):

   ```bash
   npm audit --json 2>/dev/null | head -60          # per workspace
   npm outdated 2>/dev/null | head -30
   ```

   Report only vulnerabilities that are *reachable* from this codebase's usage where you can
   determine it; otherwise state "advisory, reachability unverified" and set confidence
   accordingly. A wall of transitive dev-dependency advisories is noise, not an audit.

10. **Insecure API surface.** Debug/admin endpoints exposed in production, missing rate limits
    on expensive or credential endpoints, verbose responses enabling enumeration
    ("email not found" vs. generic), missing security headers, open redirects, unrestricted
    file upload (type/size/path/filename), SSRF via user-supplied URLs, mass-data endpoints
    without pagination, and destructive operations without confirmation or audit logging
    (especially in `scripts/`).

11. **Verification pass** (protocol §5) — for every finding, state the **reachability**: who
    can trigger it and how. If you cannot establish reachability, it goes to
    `Appendix: Needs Verification`, not to Findings. Then write the report and return the
    digest.

## Review checklist

**XSS** — [ ] every interpolation into HTML is escaped or provably safe · [ ] no
`innerHTML`/`dangerouslySetInnerHTML` with user-controlled data · [ ] stored fields rendered
in admin views are escaped · [ ] no `javascript:`/`data:` URLs from user input · [ ] CSP
present where feasible

**CSRF** — [ ] mutations are not authenticated by cookies alone, or are CSRF-protected ·
[ ] no state-changing `GET` · [ ] CORS does not reflect arbitrary origins with credentials ·
[ ] SameSite set on auth cookies

**Authentication** — [ ] tokens verified, not decoded · [ ] expiry enforced · [ ] secret from
env with no fallback default · [ ] passwords hashed with a modern KDF at sane cost ·
[ ] lockout/rate limit on login, OTP, and reset · [ ] identity never taken from the body ·
[ ] OAuth audience/issuer verified · [ ] logout/password change invalidates sessions

**Authorization** — [ ] every write/admin route has a guard · [ ] every object access is scoped
to the owner · [ ] role checks server-side, not UI-only · [ ] no privilege escalation via a
mutable role/field in the body · [ ] admin surfaces authenticated *and* authorized

**Input validation** — [ ] schema validation at the edge on every write · [ ] numeric bounds on
anything used in money/score math · [ ] no mass assignment from the body · [ ] NoSQL operator
injection blocked · [ ] enums constrained · [ ] lengths and array sizes bounded ·
[ ] file uploads constrained by type, size, and destination path

**Output escaping** — [ ] no sensitive fields in responses · [ ] errors do not leak internals ·
[ ] logs do not contain tokens or passwords · [ ] user data escaped per rendering context

**Secrets / env** — [ ] nothing real committed · [ ] no client-side secrets · [ ] no insecure
`||` fallbacks · [ ] required env vars fail fast at boot rather than silently defaulting

**Dependencies** — [ ] known vulnerabilities triaged by reachability · [ ] no unmaintained
package on a security-critical path · [ ] lockfile committed

**Insecure APIs** — [ ] no debug/admin routes in production · [ ] rate limits on expensive and
credential endpoints · [ ] no user enumeration · [ ] security headers set · [ ] no SSRF/open
redirect · [ ] destructive ops logged and confirmed

**Domain invariants** — [ ] server-authoritative values (currency, XP, level, energy, scores)
cannot be written by a client · [ ] no client-supplied price, amount, or reward · [ ] idempotency
on purchase/claim endpoints (replay = duplicate rewards)

## Best practices

- **Reachability is the finding.** "Unauthenticated POST `/api/x` lets any caller set
  `coins`" beats "input validation could be improved" every time.
- **Compare siblings.** Within one router, the handler missing the guard the other nine have is
  almost always a real bug — and it is trivially verifiable evidence.
- **Read the middleware chain in order**, including where it is mounted in `server.js`. A guard
  applied at the router level changes every finding below it.
- **Economy and scoring paths are security surfaces**, not just business logic. Negative
  quantity, replayed claims, and client-supplied rewards belong here.
- **Defensive output only.** Describe the vulnerable path and the fix. No payloads, no PoC.
- **Confidence discipline.** Critical/High requires a traced path from a reachable entry point
  to the sink. Everything else is Medium at best.

## Anti-patterns

- ❌ Listing every `npm audit` advisory as findings
- ❌ "No CSRF token" on a bearer-token API, without checking the auth mechanism
- ❌ Flagging `innerHTML` with a hardcoded constant string
- ❌ Reporting a missing guard without reading the router-level middleware
- ❌ Writing exploit code or step-by-step attack instructions
- ❌ Theoretical severity inflation ("could be Critical if the attacker had DB access")
- ❌ Treating "our own frontend sends it" as validation

## Output template

Per `_shared/report-format.md`, plus this section before `Findings`:

```markdown
## Trust Boundary Map

| Entry point | Reachable by | Guard(s) | Untrusted inputs | Sinks |
|---|---|---|---|---|
| `POST /api/shop/purchase` | any logged-in user | `protect`, `validate(purchaseSchema)` | itemId, quantity | price math, inventory write |
| `GET /api/admin/db/:coll` | any logged-in user ⚠ | `protect` only | collection name | Mongo query |

- **Auth mechanism:** <bearer JWT / cookie session / both>
- **Server-authoritative invariants checked:** <list>
- **Repo-wide items** (secrets/deps) are in `secrets-deps.security.md`, not here.
```

Digest example:

```
DIGEST security backend.routes.admin · coverage 6/6 files · complete
VERDICT needs rework
SUMMARY The admin DB routes authenticate but never check role, so any logged-in user can read
any collection. Collection name from params reaches the query unvalidated. Guards are otherwise
consistent across the router.
REPORT .claude-audit/reports/backend.routes.admin.security.md

| ID | Sev | Conf | Title | Location | Eff | Impact |
|---|---|---|---|---|---|---|
| SEC-backend.routes.admin-001 | Critical | High | Admin DB routes check auth but not role; any user can read any collection | routes/adminDb.js:18 | S | security |
| SEC-backend.routes.admin-002 | High | High | Collection name from req.params reaches the Mongo query unvalidated | controllers/adminDbController.js:44 | S | security |
| SEC-backend.routes.admin-003 | Medium | Medium | Delete endpoint has no audit log; destructive action is untraceable | routes/adminDb.js:52 | M | security |

STRENGTHS Every other router in this module applies protect + requireAdmin at router level (routes/adminMetrics.js:9)
THEMES Role enforcement is per-route and inconsistently applied; no router-level admin guard
ROUTE architecture: admin routes are split across 4 files with different guard conventions
REMAINING none
```

## Directory structure

```
.claude/skills/security-review/
└── SKILL.md
```