# Orchestration — dispatch matrix, subagent protocol, degraded outcomes

**Phase ownership.** The orchestrator delegates three phases and owns one:

| Phase | Owner |
|---|---|
| resume context | `knowledge-sync` |
| structure / stack / features / graph / partition | `repo-map` |
| **order, dispatch, collect, discard** | **project-auditor** (this document) |
| module review | the nine lens skills |
| dedupe, rank, systemic promotion, roadmap | `report-merge` — **the merge algorithm lives there, not here** |

Dispatch a delegated phase exactly like a lens: `Skill` inline, or `Agent` with the template in
§2 (replace the MODULE block with the phase's inputs). Never reimplement one inline.

## 1. Dispatch matrix — which lenses apply to which module kind

Pick the lens set from the module's `Kind`. Add a lens only with a stated reason; drop one
that cannot apply. 2–6 lenses per module.

**Two gates, both must pass.** A lens runs on a module only if (a) it is in the **active lens set**
resolved at step 3b from `stack-detection.md`, and (b) this matrix pairs it with the module's
`Kind`. Framework-gated lenses are marked ᶠ below — if their framework is not detected, strike them
from every row and never substitute a near neighbour.

| Class | Lenses |
|---|---|
| Universal (always available) | architecture · performance · security · api · naming · technical-debt · testing · css *(wherever styling exists)* |
| Framework-gated ᶠ | react ᶠ · express ᶠ · vue ᶠ · nextjs ᶠ · nestjs ᶠ |

| Module kind | Lenses (in order) | Never |
|---|---|---|
| **repo-wide skeleton** | architecture, testing (strategy only) | react ᶠ, css |
| **Component feature dir** | react ᶠ / vue ᶠ *(whichever is detected)*, naming, technical-debt, performance, css *(if it owns styles)* | api, security |
| **Shared UI / design system** | react ᶠ / vue ᶠ, css, naming, performance | api |
| **Frontend state / context / store** | react ᶠ / vue ᶠ, architecture, performance, technical-debt, testing | css |
| **Frontend API client layer** | api, technical-debt, naming, testing, security *(token handling only)* | css, react ᶠ |
| **Framework routing / data-fetching layer** *(Next.js app|pages, Nuxt)* | nextjs ᶠ, architecture, performance, api | css |
| **Backend routes** | express ᶠ / nestjs ᶠ, security, api, architecture, naming | css, react ᶠ |
| **Backend controllers** | express ᶠ / nestjs ᶠ, architecture, api, security, technical-debt, testing | css, react ᶠ |
| **Backend services / business logic** | architecture, technical-debt, testing, performance, security *(if it touches money/score/auth)*, nestjs ᶠ *(providers/DI)* | css, react ᶠ, express ᶠ |
| **Data models / schema** | architecture, security *(data exposure, indexes, validation)*, performance *(query shape)*, naming | react ᶠ, css, express ᶠ |
| **Middleware / utils** | express ᶠ *(middleware only)*, technical-debt, naming, architecture, testing | css |
| **Queues / workers / jobs** | architecture, performance, security *(poison messages, retries)*, testing | react ᶠ, css, express ᶠ |
| **Global stylesheets / theme** | css, naming, performance *(critical CSS, size)* | react ᶠ, api |
| **Server-rendered / vanilla JS admin panel** | security *(XSS, authz)*, technical-debt, naming, performance, architecture | react ᶠ, express ᶠ |
| **Scripts / migrations / ops** | security *(destructive ops, credentials)*, technical-debt, testing | css, react ᶠ |
| **Tests directory** | testing, naming, technical-debt | — |
| **Config / infra / CI** | security *(secrets, exposure)*, architecture, express ᶠ *(bootstrap order)* | react ᶠ, css |

Notes on the framework rows:

- **`express` ᶠ owns composition, not business logic.** It belongs on routes, controllers,
  middleware, and the bootstrap — never on services, models, or workers, where there is no
  middleware chain to review.
- **`nestjs` ᶠ excludes `express` ᶠ** even though Nest runs on Express: Nest's module/provider/guard
  model supersedes raw-Express rules, and reviewing both produces contradictory findings.
- **`nextjs` ᶠ pairs with `react` ᶠ**: routing, rendering strategy, and data fetching to the Next
  lens; components and hooks to the React lens.
- **Vanilla-JS or server-rendered panels get no frontend framework lens** even in a React repo —
  the code signal is absent there. Check the module, not the repo.

Cross-cutting single passes (run once per audit, not per module):

- **security-review** on a `secrets-and-dependencies` pseudo-module: `.env*`, CI files,
  lockfile audit, dependency vulnerabilities.
- **testing-review** on a `test-strategy` pseudo-module: runners, config, coverage shape,
  what the suite as a whole does and does not protect.
- **architecture-review** on the `repo-wide skeleton` pseudo-module, first, at low resolution.

## 2. Subagent dispatch (default mode)

One `Agent` call per (module, lens). `run_in_background: false`. Up to 4 lenses for the
**same** module concurrently; modules strictly sequential.

Prompt template — fill every placeholder, add nothing else:

```
You are performing a <LENS> review of ONE module. Do not review anything else.

Invoke the skill `<lens-skill-name>` (Skill tool). If the Skill tool is unavailable to you,
read `.claude/skills/<lens-skill-name>/SKILL.md` and follow it exactly.

MODULE
  slug:  <module-slug>
  path:  <module path(s)>
  job:   <one-sentence purpose from the module map>
  files: <explicit file list, or the glob that defines it + exclusions>
  size:  <N files, ~L LOC>

PROJECT CONTEXT (do not re-derive, do not expand)
  stack:       <one line>
  framework:   <the framework this lens is gated on, with its MAJOR VERSION — e.g. "React 19",
                "Express 4.16". Rules differ across majors; cite behaviour for this one only.
                Omit for universal lenses.>
  conventions: <declared conventions relevant to this lens, e.g. "backend errors must go
                through ApiError + next(err) — see backend/CONTRIBUTING.md">
  invariants:  <hard rules this module must respect, e.g. "currency/XP mutations are
                server-side only">

CONSTRAINTS
  - Budget ~25 files / ~4,000 lines. On reaching it: report partial + Files Remaining.
  - Write the full report to .claude-audit/reports/<module-slug>.<lens>.md
  - Return ONLY the digest (≤40 lines) per _shared/report-format.md § B.
  - Evidence gate is mandatory: no path:line + verbatim snippet + verification method → no
    finding. Run the verification pass before writing.
  - Do not modify any source file. Read-only audit.
```

Why a fresh agent per (module, lens): its context dies with the task, taking every
implementation detail with it. That is the point — the orchestrator stays clean, so the
40th module gets the same quality of attention as the 1st.

## 3. Inline dispatch (fallback / small audits)

For ≤10 modules, or when subagents are unavailable:

1. `Skill(skill: "<lens>", args: "<module path> | files: <list>")`
2. Lens writes the report to disk and emits the digest.
3. Append digest rows to the ledger in `state.md`.
4. State `DROPPING DETAIL: <module> / <lens>` and honour it — no further reference to that
   module's file contents.

Inline mode is strictly worse for large repos: detail accumulates in one context even with
discipline. Prefer subagents past ~10 modules.

## 4. Degraded outcomes — handle, don't hide

| Situation | Action |
|---|---|
| Lens returns prose instead of a digest | Return once with the specific defect. Second failure → mark `degraded`, continue. |
| Lens reports `SCOPE_TOO_LARGE` | Accept the proposed split, update `modules.md`, re-dispatch the sub-modules. |
| Lens reports 0 findings | Legitimate. Record `clean` with the coverage number. Do not re-run hoping for findings. |
| Report file missing | Re-dispatch once. Then `degraded`. |
| Module is generated/vendored | Remove from the queue, record in `not-reviewed` with the reason. |
| Everything in a batch of 3 leaf modules is Low-only | Note diminishing returns; propose to the user that the remaining leaves be sampled rather than fully reviewed. |

## 5. Merge and roadmap → `report-merge`

Not documented here on purpose. The algorithm (normalize → deduplicate → systemic promotion →
anti-inflation sweep → rank → coverage accounting → roadmap sequencing) lives in
`.claude/skills/report-merge/SKILL.md`, and the output templates in
`references/final-report-template.md`.

What the orchestrator must supply when it dispatches the merge:

- **scope** — which modules/lenses are in this merge;
- **expected report count** — so a missing report is detected rather than silently skipped;
- **project priorities that shape phasing** — e.g. a declared stability-first phase pushes
  L/XL refactors into Later with a trigger condition instead of Now;
- **`mode`** — `full`, or `incremental` when folding new reviews into an existing merge (keeps
  finding IDs and completed roadmap items stable).

What it must check on return: report count matches what was dispatched; no `partial` or
`degraded` module is implied clean; no Critical it watched pass through has vanished unexplained.
