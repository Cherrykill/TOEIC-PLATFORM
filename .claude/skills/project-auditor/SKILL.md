---
name: project-auditor
description: Orchestrates a full staff-engineer-level engineering audit of a codebase, module by module, without ever loading the whole repo into context. Use when asked to audit/review a project, assess code quality or technical debt at repo scale, produce an engineering audit report, or get a prioritized improvement roadmap. Also use to resume an interrupted audit. Delegates mapping to repo-map, resume context to knowledge-sync, review to the nine lens skills (architecture, react, css, performance, security, api, naming, technical-debt, testing), and consolidation to report-merge.
allowed-tools: Read, Write, Glob, Grep, Bash, Agent, TodoWrite, Skill
---

# project-auditor

## Purpose

Run a professional engineering audit of a repository of any size — including 10,000+ file
repos — by decomposing it into modules, reviewing each module through only the lenses that
apply, and merging the results into one prioritized audit.

You are the orchestrator. **You do not review code, map the repo, or merge reports yourself** —
those are `repo-map`, the nine lenses, and `report-merge`. You decide *what gets reviewed, in
what order, through which lens*, and you keep your own context clean enough to make those
decisions well. The moment you start reading application files in depth, the audit degrades:
that is the failure mode this suite exists to prevent.

Depth over speed. The output is worth more than the time it took.

## Delegation map

| Phase | Owner | Artifact |
|---|---|---|
| Resume context (step 0) | `knowledge-sync` | `.claude-audit/CONTEXT.md` |
| Structure, stack, features, graph, module partition (steps 1–3) | `repo-map` | `PROJECT-MAP.md`, `modules.md` |
| Order, dispatch, collect, discard (steps 4–8) | **this skill** | `state.md` |
| Module review | the nine lens skills | `reports/<slug>.<lens>.md` |
| Dedupe, rank, systemic promotion, roadmap (steps 9–10) | `report-merge` | `FINAL-AUDIT.md`, `ROADMAP.md` |

Delegate by `Skill` (inline) or by `Agent` (subagent) — the choice is the same as for lenses,
per `references/orchestration.md`. Do not reimplement a delegated phase inline "just this once":
duplicated algorithms in two skills drift, and the merge algorithm is the one place drift is
most expensive.

## Activation examples

- "Audit this project" / "review the whole codebase"
- "Do a staff-engineer review of the backend"
- "Where is the technical debt in this repo?"
- "Give me a prioritized improvement roadmap"
- "Continue the audit" / "resume the audit from where it stopped"
- "Audit `frontend/src/components` only"

## Required reading

Before step 1, read:

- `.claude/skills/_shared/review-protocol.md`
- `.claude/skills/_shared/context-budget.md`
- `.claude/skills/_shared/report-format.md`
- `.claude/skills/project-auditor/references/orchestration.md` — dispatch matrix, subagent
  prompt template, merge algorithm
- `.claude/skills/project-auditor/references/module-map-example.md` — a worked partition of
  this repository; use it as the shape to aim for

Read `_shared/issue-format.md` only at the merge step (step 9).

## Workflow

### Step 0 — Resume check

If `.claude-audit/` exists, invoke **`knowledge-sync`** and read the `CONTEXT.md` it produces.
It gives you the queue position, the open findings, the decisions log, and — critically — which
modules are **stale** because their files changed since the audit sha.

- Any module not `done` → announce the remaining queue and jump to step 5.
- Modules marked `stale` whose reviews are already `done` → requeue them, with the reason in the
  decisions log. A finished review of changed code is not a finished review.
- Fresh audit requested → archive the old run to `.claude-audit/archive/<date>/` first, then
  continue to step 1.

Never restart a partially finished audit from module 1 because the conversation was lost.

### Steps 1–3 — Map the repository (delegated to `repo-map`)

Invoke **`repo-map`**. It produces `.claude-audit/PROJECT-MAP.md` (tech stack, folder purpose,
feature list, dependency graph, implicit coupling, declared conventions) and
`.claude-audit/modules.md` (the partition, with `Kind` and lens set per module).

Then do the one thing that is yours, not `repo-map`'s: **read the map and challenge the
partition.**

- Is any module over budget (`_shared/context-budget.md`) or mixing technologies? Split it.
- Does the graph show a high fan-in module scheduled late? Move it earlier — its findings affect
  how everything downstream reads.
- Are mirrored modules (a service and its client) scheduled far apart? Pair them so invariant
  violations on either side are visible together.
- Does every module have a justified lens set of 2–6, per the dispatch matrix? A lens that cannot
  apply must not be scheduled.

Record every change you make, with the reason, in the decisions log. If `PROJECT-MAP.md` already
exists and is current (its sha matches HEAD), skip to the challenge step — do not re-map.

Read the map. Do **not** start reading the application files it describes.

### Step 3b — Detect the stack and gate the lens set

**Do this before any dispatch.** Read the `Detected Frameworks` block in `PROJECT-MAP.md` and
resolve it against `references/stack-detection.md`. Lenses come in two classes:

- **Universal** — always available: `architecture`, `performance`, `security`, `api`, `naming`,
  `technical-debt`, `testing`, and `css` wherever styling exists.
- **Framework-gated** — available *only* when their framework is detected, with **both** a
  dependency signal and a code signal:

  ```
  React    detected → react-review
  Vue      detected → vue-review
  Express  detected → express-review        (unless NestJS is also detected)
  NestJS   detected → nestjs-review         (and express-review OFF — Nest owns the HTTP layer)
  Next.js  detected → nextjs-review + react-review
  ```

Then write the resolved set into `state.md`:

```markdown
## Active lens set (gated at <sha>)
- Detected: React 19 (85 .jsx, `react` dep) · Express 4.16 (`server.js`, 28 routers)
- Active: architecture, performance, security, api, naming, technical-debt, testing, css,
          react-review, express-review
- Disabled (framework absent): vue-review, nextjs-review, nestjs-review
- Detected but no lens exists: <framework — recorded as a blind spot in the final audit>
```

Rules you must enforce:

1. **Never dispatch a framework lens outside its active set.** A React lens on a Vue module
   measures the code against rules the project never adopted — the findings are false by
   construction and they discredit every other finding in the audit.
2. **Declared-but-unused is not detected.** A dependency in `package.json` with zero import sites
   is a fact for the map, not an activation.
3. **A detected framework with no lens is a stated gap**, never a silent skip and never a
   substitution: review that module with universal lenses only and record it in Coverage and
   Blind Spots.
4. **Pass the major version** in every dispatch prompt. React 17/18/19, Express 4/5, Vue 2/3, and
   Next pages/app router differ exactly where these lenses work; a finding citing the wrong major
   version is a false finding.
5. **Per-module scoping still applies.** Activation says a lens exists for this audit; the
   dispatch matrix says which module kinds it may touch. Both must pass.

If detection is ambiguous (two frontend frameworks, a half-finished migration), do not guess:
record both, activate both lenses, and scope each to the modules where its code signal actually
appears.

### Step 4 — Determine review order

Default order, adjust with reasons:

1. **Repo-wide architecture pass first** (low resolution, module map + import graph only) —
   it frames everything after it.
2. **Security-sensitive and money/score-authoritative modules next** — auth, payments,
   economy, scoring. Highest consequence.
3. **Highest-churn modules** — where change is happening, findings pay off soonest.
4. **Core domain logic** — the subsystems the product depends on.
5. **Leaves** — presentational components, styles, scripts, tooling.

Record the order and the rationale in `modules.md`. Present the plan to the user before
step 5 if the audit exceeds ~10 modules, with an estimate of module count; a large audit is
their time and cost.

### Step 5 — Invoke exactly one specialized skill for one module

Use the dispatch procedure in `references/orchestration.md`:

- **Default: subagent mode.** One `Agent` call per (module, lens) with the prompt template
  from that file, `subagent_type: "general-purpose"`, `run_in_background: false`. Lenses for
  the *same* module may be fanned out up to 4 at a time; **modules stay strictly sequential**.
- **Inline mode** (small audits, ≤10 modules, or when subagents are unavailable): invoke the
  lens skill directly with `Skill`, one at a time, then apply the summarize-and-discard
  procedure.

Never invoke a lens with more than one module. Never invoke a lens without a file list.

### Step 6 — Collect the report

Accept only the digest (`_shared/report-format.md` § B). Verify:

- the report file exists at the stated path,
- every digest row has an ID, severity, confidence, location, effort,
- coverage is stated.

If a digest is malformed or contains prose instead of an index, send it back once with the
specific defect. If it fails again, record the module as `degraded` in state and move on —
do not fix the report yourself by reading the module.

### Step 7 — Discard implementation details

Append the digest rows to the Findings ledger in `.claude-audit/state.md`, mark the module's
lens `done`, then state plainly:

```
DROPPING DETAIL: <module> / <lens>
```

From here you must not reference any file content from that module. Detail is on disk if you
need it later. This step is not ceremony — it is the mechanism that keeps module #47 as
sharply reviewed as module #1.

### Step 8 — Next module

Repeat 5–7 until the queue is empty. Update `state.md` after **every** module so an
interrupted run is always resumable. If the user interrupts, leave state consistent.

### Steps 9–10 — Merge and generate the audit (delegated to `report-merge`)

Invoke **`report-merge`**. It owns the merge algorithm: collect from the ledger, deduplicate,
promote cross-module patterns to systemic findings with an enforcement mechanism, run the
anti-inflation sweep, rank, account for coverage, and write `.claude-audit/FINAL-AUDIT.md` and
`.claude-audit/ROADMAP.md`.

Give it: the scope, the number of reports it should expect, and any project priority that must
shape the roadmap's phasing (e.g. a stability-first phase pushes large refactors to Later with a
trigger condition). Do not merge inline — the algorithm lives in one place on purpose.

When it returns, sanity-check its summary against what you saw pass through:

- Does the report count match the reviews you dispatched?
- Is any module you know was `partial` or `degraded` being implied as clean?
- Did anything you watched get reported as Critical vanish without an explanation?

Then relay to the user: verdict, top 5, quick-win count, coverage, what was not reviewed, and
links to both documents. Finally, invoke **`knowledge-sync`** once more so the next session opens
with a current primer instead of re-deriving all of this.

## Review checklist (for the orchestrator's own work)

- [ ] Did I avoid reading application source at all? (The map is `repo-map`'s job, the code is
      the lenses'.)
- [ ] Did I delegate mapping, resume context, and merging instead of doing them inline?
- [ ] Did I **challenge** the partition rather than accept it: budget, technology mix, fan-in
      ordering, mirrored modules paired?
- [ ] Was the stack detected from dependency **and** code signals, and the active lens set written
      to `state.md` before the first dispatch?
- [ ] Is every framework-gated lens I dispatched actually in the active set, with its major version
      passed in the prompt?
- [ ] Is every detected-but-unsupported framework recorded as a blind spot rather than skipped or
      substituted?
- [ ] Does every module have a justified lens set of 2–6 — no padding with inapplicable lenses?
- [ ] Is the order justified by consequence and churn, not by directory alphabet?
- [ ] Were stale modules (changed since the audit sha) requeued rather than left `done`?
- [ ] Was `state.md` updated after every single module?
- [ ] Did I state `DROPPING DETAIL` after each collect, and honour it?
- [ ] Did I sanity-check `report-merge`'s output against what I watched pass through?
- [ ] Is every decision that changed the plan recorded in the decisions log?

## Best practices

- **Plan visibly, then execute quietly.** Show the module map and order up front; after
  that, progress lines, not narration.
- **Delegate the phases that have an owner.** `repo-map`, `knowledge-sync`, and `report-merge`
  exist so their algorithms have one home. Your value is the ordering and the judgment between
  phases, not re-doing them.
- **Let architecture go first.** Its findings change how later modules are read (and can
  re-split the module map — that is allowed, record the change).
- **Prefer the project's own conventions as the yardstick.** An audit that fights the
  codebase's documented style produces noise the team will reject.
- **Track coverage like a budget.** "38 of 41 modules, 3 deferred with reasons" is a
  professional result. Silence about the other 3 is not.
- **Cheap signals first**: run the project's own lint/test/audit commands and mine their
  output before hand-reading anything. Free findings with perfect evidence.
- **Stop when marginal value dies.** If three consecutive leaf modules return only Low
  findings, say so and propose ending early rather than grinding to 100%.

## Anti-patterns

- ❌ Reading files to "get a feel" for a module before dispatching — that is the lens's job
  and it costs the context the whole audit depends on.
- ❌ Invoking all nine lenses on every module. Produces volume, not insight, and buries the
  real findings.
- ❌ Merging inline, or re-implementing the merge algorithm because "it is just this once".
  Two copies of that algorithm will drift, and the merge is where drift costs most.
- ❌ Re-mapping a repository whose `PROJECT-MAP.md` already matches HEAD.
- ❌ Accepting `repo-map`'s partition without challenging it — it applies the sizing rules, but
  ordering by consequence and pairing mirrored modules is yours.
- ❌ Leaving a `done` module marked done after its files changed (`knowledge-sync` flags these).
- ❌ Dispatching a framework lens on a stack that framework is not part of — the single fastest way
  to make an audit worthless, because every finding is measured against rules the project never
  adopted.
- ❌ Activating a lens from a `package.json` entry alone, with no import sites.
- ❌ Substituting a near-neighbour lens for a missing one (`react-review` on Vue, `express-review`
  on Fastify). A stated gap is a result; a wrong-framework review is damage.
- ❌ Claiming a module is fine because it has no findings, when coverage was `partial`.
- ❌ Fixing anything. This suite audits; remediation is a separate, explicit request.

## Output template

Progress line after each module (this is all the user needs mid-run):

```
[7/41] backend/routes/auth  ·  lenses: security, api, testing
        SEC 1C 2H 1M · API 0C 1H 3M · TEST 0C 2H 1M  → 4 files remaining
        DROPPING DETAIL
```

Final message shape:

```
AUDIT COMPLETE — <repo> @ <sha>
Verdict: <one line>
Coverage: <N>/<M> modules · <F>/<T> files · <deferred count> deferred
Findings: <c> Critical · <h> High · <m> Medium · <l> Low · <s> systemic
Top 5: <ID — title (severity)> ×5
Quick wins: <n> (est. <total effort>)
Not reviewed: <list with reasons>
→ .claude-audit/FINAL-AUDIT.md · .claude-audit/ROADMAP.md
```

## Directory structure

```
.claude/skills/project-auditor/
├── SKILL.md                         ← this file
└── references/
    ├── orchestration.md             ← dispatch matrix, subagent prompt, degraded-outcome handling
    ├── module-map-example.md        ← worked partition of this repository
    ├── state-template.md            ← .claude-audit/state.md schema
    └── final-report-template.md     ← FINAL-AUDIT.md + ROADMAP.md templates (used by report-merge)

.claude-audit/                       ← generated, gitignored
├── CONTEXT.md                       ← session primer            (owner: knowledge-sync)
├── PROJECT-MAP.md                   ← stack, folders, features, graph  (owner: repo-map)
├── modules.md                       ← module partition          (owner: repo-map, tuned here)
├── state.md                         ← queue + findings ledger + decisions log (owner: this skill)
├── reports/<module-slug>.<lens>.md  ← full reports              (owner: the lens skills)
├── FINAL-AUDIT.md                   ← ranked audit              (owner: report-merge)
└── ROADMAP.md                       ← sequenced fix plan        (owner: report-merge)
```
