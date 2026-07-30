---
name: performance-review
description: Reviews performance characteristics of ONE module — rendering performance, bundle size, lazy loading, memoization, expensive computations, unnecessary renders, large dependencies, network requests and caching opportunities. Use when auditing speed, payload size, or resource usage. Invoked by project-auditor; also usable standalone on a feature or service.
allowed-tools: Read, Write, Glob, Grep, Bash
---

# performance-review

## Purpose

Find the work this module does that it does not need to do, and the work that grows faster
than it should. Every finding must be tied to a **scale** — per keystroke, per request, per
row, per boot — because performance without a magnitude is an opinion.

Fast enough today is not evidence: state the growth curve. A linear scan of 40 items and a
linear scan of 40,000 look identical in code review and completely different in production.

## Activation examples

- "Review performance of the practice module"
- "Why is the initial load slow?"
- "Audit bundle size / dependencies"
- "Any N+1 queries or unnecessary refetches here?"
- Dispatched by `project-auditor` for kinds: React feature dir, frontend state, backend
  services, data models, queues/workers, global stylesheets.

## Required reading

`_shared/review-protocol.md` · `_shared/issue-format.md` · `_shared/report-format.md`.

## Inputs

`module.slug`, `module.path(s)`, `module.files`, runtime (browser / node), realistic data
scale if known (rows, users, items), build tool, whether a build/profile can be run.

## Workflow

1. **Establish the scale.** Before reading for defects, write down the magnitudes that matter
   for this module: how many items render, how many rows a query returns, how often a handler
   fires, how many times per session a request happens. Derive from the data layer or seed
   data where possible (`rg -c` on a seed file, a model's expected cardinality). Every finding
   later references one of these numbers.

2. **Measure what is cheap to measure.** Prefer real numbers over reading:

   ```bash
   # bundle: build once and look at the output (only if the project builds quickly)
   npm run build --prefix frontend 2>&1 | tail -30
   du -sh frontend/dist/assets/* 2>/dev/null | sort -rh | head -15
   # dependency weight
   npm ls --prefix frontend --depth=0
   du -sh frontend/node_modules/* 2>/dev/null | sort -rh | head -15
   # asset weight shipped to the client
   find frontend/public backend/public -type f -size +200k 2>/dev/null | head -20
   ```

   If a build is slow or unavailable, say so and fall back to static reasoning — do not fake
   numbers you did not obtain.

3. **Frontend render cost.** Work per render scaled by data: sorts/filters/maps in the render
   body, per-row date/number formatting, JSON parse/stringify, regex compilation in a loop,
   layout-thrashing reads (`offsetWidth` after a write). Unnecessary re-renders: unstable
   props into memoized children, context values rebuilt per render, state held too high.
   (Overlap with react-review is expected — report it under whichever lens ran, and route
   rather than duplicate; the orchestrator dedupes.)

4. **Loading strategy.** What is in the initial payload that is not needed for first paint:
   route-level code splitting, heavy libraries imported eagerly for a rare feature, charting
   or editor libs on the landing path, icon fonts/sets pulled whole, images without dimensions
   or modern formats, fonts blocking text. Check for the opposite too — over-splitting that
   creates request waterfalls.

   ```bash
   rg -n "^import .*(chart|xlsx|moment|lodash|three|editor)" <module-path> -i   # heavy eager imports
   rg -n "React.lazy|import\(" <module-path>                                   # existing splitting
   rg -n "from 'lodash'" <module-path>                                          # whole-lib imports
   ```

5. **Network behaviour.** Requests per user action; duplicate requests from sibling components;
   waterfalls (dependent awaits that could be parallel); missing pagination/limits;
   over-fetching fields; polling intervals; retries without backoff; payloads that grow with
   history. In Node: sequential `await` in a loop that could be `Promise.all`, and per-item
   queries inside a `for` (N+1).

   ```bash
   rg -n "for .*\{[\s\S]{0,200}?await " <module-path> --pcre2 -U     # await inside a loop → N+1
   rg -n "\.find\(|\.findOne\(|\.aggregate\(" <module-path>          # then check indexes + limits
   rg -n "setInterval\(" <module-path>                               # polling cost
   ```

6. **Backend/data cost.** Query shape vs. available indexes (read the schema's `index()`
   declarations — an unindexed filter on a large collection is a High finding with a clear
   growth curve); `select()` absent on wide documents; `lean()` missing on read-only paths;
   unbounded `find()`; aggregation stages that cannot use an index; in-memory sorting of
   large sets; documents that grow without bound (arrays of history/transactions inside a
   user doc — cite the field and the growth rate).

7. **Caching opportunities.** Pure recomputations of stable data (config, catalogs, derived
   maps) on every request/render; missing HTTP cache headers on static or rarely-changing
   endpoints; missing memoization on hot pure functions; existing caches with no invalidation
   path (a correctness risk, not just a perf one — flag both).

8. **Verification pass** (protocol §5). For each finding: the scale number, the trigger, and
   either a measurement or an explicit "reasoned, not measured". Then write the report and
   return the digest.

## Review checklist

**Rendering performance**
- [ ] No data-scaled computation in a render body
- [ ] Long lists are windowed or paginated at realistic N
- [ ] No layout thrash (interleaved DOM reads/writes) in effects or handlers
- [ ] Animations use compositor-friendly properties; none run while off-screen

**Bundle size**
- [ ] Initial chunk contains only what first paint needs
- [ ] No heavy dependency for a trivial use (measure it, propose the smaller path)
- [ ] Tree-shakable imports (named, not whole-library)
- [ ] Assets are compressed and sized; no oversized images or whole icon fonts

**Lazy loading**
- [ ] Route/feature-level splitting where a feature is rarely used
- [ ] Below-the-fold media is lazy
- [ ] Splitting does not create a dependent request waterfall
- [ ] Suspense/loading states exist for every lazy boundary

**Memoization**
- [ ] Present where a cost was reasoned or measured; absent where it would only add risk
- [ ] Dependency arrays correct (a wrong one caches stale data)
- [ ] No memoization of cheap values guarding expensive comparisons

**Expensive computations**
- [ ] No accidental O(n²) (nested `find`/`includes` over the same list)
- [ ] Repeated derivations hoisted or cached
- [ ] Heavy synchronous work off the critical path (worker, queue, background job)

**Unnecessary renders / work**
- [ ] Stable prop and context identity where consumers memo
- [ ] Subscriptions notify only affected consumers
- [ ] No effect that refires on every render

**Large dependencies**
- [ ] Each heavy dependency's cost is justified by its use
- [ ] No two libraries doing the same job
- [ ] Node-only libraries never reach the client bundle

**Network requests**
- [ ] Minimum request count per action; no duplicates across siblings
- [ ] Independent requests run in parallel
- [ ] Pagination/limits on every list endpoint
- [ ] Retries bounded with backoff; timeouts set
- [ ] Payloads bounded (no unbounded embedded history)

**Caching**
- [ ] Stable data cached at the right layer, with an invalidation path
- [ ] Cache headers/ETags on cacheable responses
- [ ] Hot pure functions memoized
- [ ] Cache keys include everything that varies the result

## Best practices

- **Always attach a magnitude.** "Runs on every keystroke over 1,200 vocabulary items" is a
  finding; "inefficient loop" is not.
- **Measure when measuring is cheap** (build output, `du`, `npm ls`, a query `explain`). Label
  reasoned findings as reasoned.
- **Rank by user-perceived cost**: time to first interaction and input latency beat a 5 KB
  bundle saving, regardless of how easy the bundle fix is.
- **Include the growth curve.** Say what happens at 10× data — that is what separates a Low
  from a High.
- **Prefer removing work over adding cache.** A cache is a new correctness surface; say so
  when you propose one.
- **Check the data layer before the render layer** on full-stack modules — an unindexed query
  usually dominates everything in the component.

## Anti-patterns

- ❌ Micro-optimizations with no measurable effect (`for` vs `map` on 12 items)
- ❌ "Add `useMemo` everywhere" / "add caching everywhere"
- ❌ Any performance claim without a scale or a trigger
- ❌ Inventing benchmark numbers, or presenting a reasoned estimate as measured
- ❌ Recommending a rewrite (virtual list, SSR, different framework) from a module-level view
  without stating the current cost it would remove
- ❌ Reporting a slow *dev-mode* behaviour as a production defect

## Output template

Per `_shared/report-format.md`, plus this section before `Findings`:

```markdown
## Cost Model

| Path | Trigger | Scale | Current cost | Measured? |
|---|---|---|---|---|
| Vocabulary filter | keystroke in search | 1,200 items | full re-sort per keystroke | reasoned |
| `GET /api/vocabulary` | screen open | limit=9999 | ~1.4 MB JSON, unindexed sort | measured (curl) |

- **Bundle:** <initial chunk size, largest chunks> (`npm run build`)
- **Heaviest dependencies:** <name — size — used for>
- **Assets > 200 KB:** <count>
```

Digest example:

```
DIGEST performance frontend.components.practice · coverage 18/27 files · partial
VERDICT fragile
SUMMARY The mode list re-derives and re-sorts all 1,200 vocabulary items on every keystroke,
and the whole word list is fetched with limit=9999 on screen open. Charting library is in the
initial chunk for a statistics screen most users never open.
REPORT .claude-audit/reports/frontend.components.practice.performance.md

| ID | Sev | Conf | Title | Location | Eff | Impact |
|---|---|---|---|---|---|---|
| PERF-frontend.components.practice-001 | High | High | Full 1,200-item sort per keystroke in render body | WordList.jsx:64 | S | performance |
| PERF-frontend.components.practice-002 | High | Medium | limit=9999 fetch on screen open (~1.4 MB) | api/vocabulary.js:22 | M | performance |
| PERF-frontend.components.practice-003 | Medium | High | chart.js (170 KB) eagerly imported for a rarely-opened screen | Statistics.jsx:3 | S | performance |

STRENGTHS Audio assets are lazily created per mode rather than preloaded (audio.js:30-52)
THEMES Data is fetched whole and filtered client-side; no server-side paging anywhere
ROUTE architecture: 16 practice modes each own a copy of the same filtering pipeline
REMAINING 9 mode files under components/practice/modes — suggest sub-module `fe.practice.modes`
```

## Directory structure

```
.claude/skills/performance-review/
└── SKILL.md
```