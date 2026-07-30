---
name: api-review
description: Reviews the API layer of ONE module — fetch/client logic, error handling, retry strategy, loading state, response validation, request organization and REST consistency. Use when auditing an API client, HTTP wrapper, or the shape and consistency of server endpoints. Invoked by project-auditor; also usable standalone on an api/ directory or a route domain.
allowed-tools: Read, Write, Glob, Grep, Bash
---

# api-review

## Purpose

Audit the contract between client and server: whether every call has one obvious way to fail,
whether failures are distinguishable and surfaced, whether responses are trusted blindly, and
whether the endpoint surface is consistent enough that a developer can predict the next one.

The recurring real defect in this layer is not a missing feature — it is **N slightly
different ways to do the same call**, so error handling is right in 6 places and wrong in 3.
Count the variants and cite them.

## Activation examples

- "Review our API layer"
- "Is error handling consistent across `frontend/src/api`?"
- "Audit the REST design of these routes"
- "Do we validate API responses?"
- Dispatched by `project-auditor` for kinds: frontend API client layer, backend routes,
  backend controllers.

## Required reading

`_shared/review-protocol.md` · `_shared/issue-format.md` · `_shared/report-format.md`.

## Inputs

`module.slug`, `module.path(s)`, `module.files`, transport (fetch/axios/Express), the declared
response envelope if any, declared error contract, auth mechanism.

## Workflow

1. **Find the declared contract.** Read the project's own rules first (CONTRIBUTING, an error
   handler, a shared HTTP wrapper, a validator directory). Write the contract down in one
   block: success shape, error shape, status usage, auth header. Everything after this is
   measured against it — a module that is internally consistent but contradicts the declared
   contract is still a finding, and vice versa.

2. **Inventory every call/endpoint.** One table row per call: name, method, path, params, who
   calls it, error handling present, loading state, response validated. Build it with grep,
   then confirm by reading:

   ```bash
   rg -n "(?:fetch|axios|Http\.(get|post|put|patch|delete))\(" <module-path>
   rg -n "router\.(get|post|put|patch|delete)\(['\"]" <module-path> -o
   ```

   The table itself usually reveals the findings — the two rows missing error handling stand
   out against the twenty that have it.

3. **Count the variants.** How many distinct ways does this module make a request? A shared
   wrapper *plus* raw `fetch` in three files means the wrapper's guarantees (auth header,
   timeout, 401 handling, error normalization) silently do not apply there. That is a High
   finding with an exact location list, and it is very common wherever `FormData` or file
   upload bypassed the wrapper.

4. **Error handling audit.** For each call and each handler:
   - Are HTTP errors distinguished from network errors from parse errors? Collapsing them into
     one string loses the retry/report decision.
   - Are non-2xx responses actually treated as failures (a `fetch` that ignores `res.ok`
     silently returns an error body as data — trace what happens downstream).
   - Is the error surfaced to the user, swallowed, or only `console.log`ged?
   - Server side: does the handler follow the declared error path (`next(ApiError)`) or invent
     its own `res.status(500).json({...})` shape? Inconsistent error shapes force clients to
     handle both.
   - Are error messages safe for display and not leaking internals?

5. **Retry & resilience.** Is there any retry? If yes: bounded? backoff? jitter? only on
   idempotent methods? Retrying a `POST /purchase` on timeout can double-charge — check for
   idempotency keys before calling a retry safe. If there is no retry at all, that is fine for
   many apps; say so rather than inventing a requirement. Also check timeouts (a request with
   no timeout can hang a UI forever) and cancellation on unmount/navigation.

6. **Loading state.** Is every call's pending state represented? Look for: no loading state at
   all, loading flags that never reset on the error path (`setLoading(false)` only in the
   success branch — verify by reading the `catch`/`finally`), double-submit possibility on
   buttons, and per-component ad-hoc `loading`/`error`/`data` triples duplicated across files
   (report as one systemic finding with the count).

7. **Response validation.** Does the code trust the response shape? Look for direct
   `data.x.y.z` access, `data.map()` without an array check, and writing a raw response into
   state/store. Rank by consequence: unvalidated data flowing into rendering is a crash;
   unvalidated data flowing into stored state or into a currency/score display is worse. Note
   whether the project has a validator layer already (then bypasses are the finding).

8. **Request organization.** Grouping (per domain vs. per screen), duplicate calls defined in
   two places, URL construction (string concatenation without `encodeURIComponent` — check for
   user-supplied query values), base-URL handling, header/auth duplication, and whether
   components call `fetch` directly instead of going through the layer.

9. **REST consistency.** Methods matching semantics (state change via `GET`), plural/singular
   and casing consistency in paths, status-code usage (200 for errors, 500 for validation
   failures, missing 404), envelope consistency (`{success, data}` vs. bare arrays),
   pagination/filter/sort parameter naming across endpoints, and identifier style.

10. **Verification pass** (protocol §5), then write the report and return the digest.

## Review checklist

**API layer structure**
- [ ] One transport path; no raw `fetch` bypassing the shared client
- [ ] Grouped by domain, one definition per endpoint
- [ ] Components/services do not build URLs or headers themselves
- [ ] Base URL and auth injection happen in exactly one place

**Fetch logic**
- [ ] `res.ok` (or equivalent) checked before parsing as success
- [ ] Content-type handled (JSON vs. text vs. blob) without assuming
- [ ] Timeout set; request cancellable
- [ ] Query values URL-encoded
- [ ] Method/body/header construction consistent across calls

**Error handling**
- [ ] Network / HTTP / parse / domain errors distinguishable by the caller
- [ ] Nothing swallowed silently; every catch either surfaces or deliberately ignores with a
      comment saying why
- [ ] One error shape across the whole surface, matching the declared contract
- [ ] Auth expiry (401) handled centrally, once
- [ ] Errors safe to display; internals not leaked

**Retry strategy**
- [ ] Retries only on idempotent operations, or with an idempotency key
- [ ] Bounded attempts, backoff, and a give-up path that reaches the user
- [ ] No retry storms on a hard failure (cascading amplification)

**Loading state**
- [ ] Every call has a pending representation
- [ ] Flags reset on every exit path (`finally`, not just success)
- [ ] Double-submit prevented on mutations
- [ ] Not reimplemented ad hoc in every component

**Response validation**
- [ ] Shape checked before access, at least defensively for arrays and nested objects
- [ ] Server data validated before being stored, not just before being rendered
- [ ] Optional/nullable fields handled at the boundary, not with `?.` scattered downstream
- [ ] Version/shape drift would fail loudly rather than render `undefined`

**Request organization**
- [ ] No duplicate definitions of the same endpoint
- [ ] Naming mirrors the endpoint domain
- [ ] Shared concerns (auth, tracing, logging) applied uniformly

**REST consistency**
- [ ] Methods match semantics; no state change on `GET`
- [ ] Status codes correct and consistent (validation → 400, authz → 403, missing → 404)
- [ ] Path naming, casing, and pluralization consistent
- [ ] One response envelope
- [ ] Pagination/filter/sort parameters named consistently across endpoints

## Best practices

- **Lead with the inventory table.** It is the evidence for most findings in this lens and it
  makes inconsistency self-evident.
- **Count variants.** "3 of 19 API modules use raw `fetch`, skipping the wrapper's auth header
  and 401 handling (`uploadVocab.js:14`, …)" is precise and actionable.
- **Trace one full failure path** end-to-end: server throws → status → client parse → state →
  UI. Most error-handling findings only become visible along that path.
- **Do not invent requirements.** No retry, no schema validation library, and no idempotency
  keys can all be correct choices for a project of this size — judge against consequence and
  the project's own contract, and put "adopt X" in Long-term Improvements.
- **Distinguish "unvalidated" by destination.** Rendering vs. storing vs. score/currency
  display are three different severities.

## Anti-patterns

- ❌ "Use axios/React Query/tRPC instead" as a finding
- ❌ Demanding runtime schema validation on every endpoint of a small app as High
- ❌ Reporting a missing loading state on a fire-and-forget analytics call
- ❌ Recommending retries without checking idempotency
- ❌ Reviewing the business logic behind the endpoint (route it to architecture/security)
- ❌ Style findings about naming that already follow the project convention

## Output template

Per `_shared/report-format.md`, plus this section before `Findings`:

```markdown
## Endpoint / Call Inventory

| Call | Method | Path | Via | Error handling | Loading | Response validated |
|---|---|---|---|---|---|---|
| `purchase()` | POST | `/shop/purchase` | Http wrapper | wrapper only | caller | no |
| `uploadAvatar()` | POST | `/auth/avatar` | raw fetch ⚠ | none | no | no |

- **Declared contract:** success `{success, data}` · error `{success:false, message}` via `errorHandler`
- **Transport variants found:** <N> (wrapper, raw fetch, …)
- **Deviations from the declared contract:** <count + locations>
```

Digest example:

```
DIGEST api frontend.api · coverage 19/19 files · complete
VERDICT acceptable with debt
SUMMARY The shared Http wrapper normalizes errors, 401 handling and timeouts, but three
upload-related calls use raw fetch and get none of it. Responses are written into state with no
shape check, so a changed field renders undefined instead of failing.
REPORT .claude-audit/reports/frontend.api.api.md

| ID | Sev | Conf | Title | Location | Eff | Impact |
|---|---|---|---|---|---|---|
| API-frontend.api-001 | High | High | 3 calls bypass Http wrapper: no auth header, no 401 handling, no timeout | api/uploadVocab.js:14 (+2) | M | correctness |
| API-frontend.api-002 | Medium | High | Wrapper flattens HTTP, network and parse failures into one string | api/http.js:89-97 | M | dev-velocity |
| API-frontend.api-003 | Medium | Medium | Responses stored unvalidated; shape drift renders undefined silently | api/shopCatalog.js:22 (+6) | M | correctness |

STRENGTHS 401 is handled once, centrally, and emits auth:expired rather than per-call redirects (api/http.js:69-73)
THEMES One good wrapper plus three bypasses; the guarantees are real but not enforced
ROUTE security: uploadAvatar sends the token manually — verify it is not logged
REMAINING none
```

## Directory structure

```
.claude/skills/api-review/
└── SKILL.md
```