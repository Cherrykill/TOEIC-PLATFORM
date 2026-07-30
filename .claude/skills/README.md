# Review Skill Suite

A modular code-review system for this repository. Thirteen skills in four tiers — one
orchestrator, three foundation skills, nine specialized review lenses — plus a set of shared
contracts they all obey.

The design premise: **a single giant review skill degrades as the repo grows.** Loading 10,000
files into one conversation does not produce a thorough review — it produces a shallow one with
a large token bill, because by the time the reviewer reaches module 40 it has forgotten module
1 and is reasoning over noise. This suite keeps reasoning quality constant by making
implementation detail disposable and findings durable.

---

## 1. The pieces

**Tier 1 — orchestration**

| Skill | Job |
|---|---|
| **project-auditor** | Master. Owns ordering, dispatch, collection, and context hygiene. Delegates mapping, resume context, and merging. Reviews nothing itself. |

**Tier 2 — foundation** (no reviewing, no opinions — they produce the artifacts everything else reads)

| Skill | Job |
|---|---|
| **repo-map** | Project Map: tech stack, folder purpose, feature list, dependency graph (incl. implicit coupling), declared conventions, and the module partition. Facts only. → `PROJECT-MAP.md`, `modules.md` |
| **knowledge-sync** | Session primer: compresses the map + ledger + report headers into one briefing, and **date-stamps it against HEAD** so stale findings are flagged, not repeated as current. → `CONTEXT.md` |
| **report-merge** | Consolidation: collects, deduplicates, promotes cross-module patterns to systemic findings, ranks Critical→Low, and sequences the fix roadmap. Canonical home of the merge algorithm. → `FINAL-AUDIT.md`, `ROADMAP.md` |

**Tier 3a — universal lenses** (apply to any stack; each reviews exactly one module, then forgets it)

| Skill | Job |
|---|---|
| **architecture-review** | Folder structure, boundaries, dependency direction, separation of concerns, cycles, abstraction quality, scalability. |
| **css-review** | CSS architecture, naming, responsiveness, layout, spacing/typography/color consistency, tokens, accessibility, duplication. |
| **performance-review** | Render cost, bundle size, lazy loading, expensive computation, network behaviour, caching. |
| **security-review** | XSS, CSRF, auth, authorization, input validation, output escaping, secrets, dependencies, insecure APIs. |
| **api-review** | API layer structure, fetch logic, error handling, retries, loading state, response validation, REST consistency. |
| **naming-review** | File/variable/function/component/hook names, consistency, readability, domain terminology. |
| **technical-debt-review** | Duplication, dead code, TODOs, magic values, over/under-engineering, code smells. |
| **testing-review** | Strategy, missing tests, edge cases, unit/integration balance, test quality. |

**Tier 3b — framework-gated lenses** (dispatched **only** when their framework is detected)

| Skill | Status | Activates when |
|---|---|---|
| **react-review** | available | React detected — component design, hooks, state, props, composition, rendering, memoization, context, effect dependencies |
| **express-review** | available | Express detected and NestJS not — middleware order, mounting, async error propagation, request/response lifecycle, router composition |
| `vue-review` | not created | Vue detected |
| `nextjs-review` | not created | Next.js detected (pairs with `react-review`) |
| `nestjs-review` | not created | NestJS detected (turns `express-review` **off**) |

Gating is not advisory. `project-auditor` step 3b resolves the detected stack against
`project-auditor/references/stack-detection.md`, writes the **active lens set** into `state.md`,
and refuses to dispatch anything outside it. A framework counts as detected only with **both** a
dependency signal and a code signal — a `package.json` entry with no import sites is a fact for the
map, not an activation. Running `react-review` on a Vue codebase would measure the code against
rules the project never adopted: every finding false by construction, and the credibility of the
rest of the audit gone with them.

The three `not created` lenses are deliberately absent: no Vue, Next, or Nest code exists in this
repo, so they could never activate here, and a skill that can never run is dead weight. The
detection table and registry already list them, so adding one is a single new `SKILL.md` plus four
one-line registry edits — see `stack-detection.md` §5.

**Tier 4 — shared contracts** in `_shared/`, read by every skill, every time:

| File | Contents |
|---|---|
| `review-protocol.md` | The binding rules: one module at a time, cold-start assumption, evidence gate, verification pass, context bail-out, output contract. |
| `issue-format.md` | The only accepted finding shape, plus the severity / confidence / effort / impact rubrics and the Quick Win definition. |
| `report-format.md` | The 10-section report, and the ≤40-line digest that is the only thing crossing back into the orchestrator. |
| `context-budget.md` | Budgets, module sizing rules, sampling strategy for oversized modules, summarize-and-discard, recovery after compaction. |

---

## 2. How they cooperate

```
   session start ──▶ knowledge-sync ──▶ CONTEXT.md  (resume point, staleness flagged)
                            │
                            ▼
                       repo-map ──▶ PROJECT-MAP.md + modules.md   (facts, no opinions)
                            │
                            ▼
              ┌──────────────────────────────────────┐
              │           project-auditor            │
              │  challenge partition → order →       │
              │  dispatch → collect → DROP DETAIL    │
              └──────────────┬───────────────────────┘
                             │ one (module, lens) at a time
      ┌──────────────┬───────┼───────┬──────────────┐
      ▼              ▼       ▼       ▼              ▼
architecture      react     css   security   … 5 more lenses
      │              │       │       │              │
      └──────────────┴───────┴───┬───┴──────────────┘
                                 │
      full report → .claude-audit/reports/*.md    (stays on disk)
      digest (≤40 lines) → orchestrator context   (the only thing that crosses)
                                 │
                                 ▼
                    .claude-audit/state.md   ← findings ledger + decisions log
                                 │
                                 ▼
                          report-merge   ──▶ FINAL-AUDIT.md + ROADMAP.md
                                 │
                                 ▼
                         knowledge-sync   ──▶ CONTEXT.md (refreshed for next session)
```

Every box writes to disk and every arrow carries a summary, not content. That is the whole
trick: **artifacts are durable, context is disposable.**

Three rules make this work:

1. **Lenses never talk to each other.** Each starts cold with a module path, a file list, and
   the project's conventions. A finding that belongs to another lens goes in `ROUTE` in the
   digest; the orchestrator re-routes it. No lens depends on another having run.
2. **Only digests cross boundaries.** A digest is an index — IDs, severity, confidence, title,
   location, effort. No code, no prose. The full report, with evidence and snippets, lives on
   disk for humans and for the record.
3. **Disk is the source of truth, not the conversation.** `state.md` + `reports/` survive
   compaction, session loss, and interruption. Any run can resume from them.

And one rule about the skills themselves: **each algorithm has exactly one home.** The merge
lives in `report-merge`, the partition rules in `_shared/context-budget.md`, the finding shape in
`_shared/issue-format.md`. `project-auditor` delegates rather than duplicating — two copies of a
rule drift, and drift in the merge step is where an audit quietly stops being trustworthy.

---

## 3. Recommended workflow

**Map first** (cheap, useful on its own, and every later step reuses it)

```
> map this repo
```

`repo-map` writes `PROJECT-MAP.md` + `modules.md`. Read the feature list and the dependency
graph before deciding what is worth auditing — often that alone answers the question you had.

**Full audit**

```
> audit this project
```

`project-auditor`: `knowledge-sync` (resume check) → `repo-map` (or reuse a current map) →
challenge the partition → show you the plan for audits over ~10 modules → dispatch lens by lens
→ `report-merge` → refresh `CONTEXT.md`.

**Scoped audit** (recommended for the first run — cheaper, and it validates the module map)

```
> audit backend/services and backend/controllers
> audit the frontend only
```

**Single lens, single module** (fastest useful loop; every lens works standalone)

```
> security review of backend/routes
> react review of frontend/src/components/toeic/runner
> technical debt in backend/utils
```

**New session / after compaction**

```
> catch me up on this project
```

`knowledge-sync` reads the map, the ledger, and the report headers, checks them against HEAD, and
writes a ≤200-line primer: where to resume, the invariants, the open findings, the decisions
already taken, and which modules went **stale** because their files changed since the audit.

**Resume**

```
> continue the audit
```

Reads `CONTEXT.md`/`state.md`, requeues stale modules, continues from the first module that is
not `done`. Never restarts from module 1.

**Merge on demand** (e.g. you ran three lenses by hand and want the consolidated picture)

```
> merge the review reports
> re-merge, I added two more module reviews      # incremental: keeps IDs stable
```

**After the audit** — the roadmap is the deliverable to act on. Fix from `Now` down, and treat
the `Enforcement` section as part of each fix: a fix without a lint rule, test, or convention
entry behind it regresses within a quarter. Re-run `knowledge-sync` after a batch of fixes so the
next session sees them as resolved instead of re-reporting them.

### Cost and pacing

A full audit of a mid-size repo is dozens of subagent runs. Budget accordingly: scope the
first pass to the highest-consequence third of the repo, read the roadmap, then decide whether
the rest is worth auditing. The orchestrator is instructed to tell you when marginal value has
died rather than grinding to 100%.

### Report language

Reports default to the language you ask in. To fix it explicitly, set
`Report language:` in `.claude-audit/state.md` — the lenses read it.

---

## 4. Reviewing a repo larger than the context window

This is the case the suite is built for. The mechanism, in order:

1. **Partition first, read later.** `repo-map` builds the plan from *aggregated* command output
   (`git ls-files | uniq -c` → 40 lines instead of 10,000), reading ~30 config and entry-point
   files at most. Modules are 5–25 files / ≤4,000 LOC, cut along real boundaries, one technology
   each. Nothing downstream re-derives this.
2. **Lens sets are doubly gated.** A lens runs only if its framework is detected (step 3b) **and**
   the dispatch matrix pairs it with the module's kind. 2–6 lenses per module, never all of them:
   a services module gets no CSS pass, a stylesheet gets no React pass, a vanilla-JS admin panel
   gets no frontend-framework pass even in a React repo. This alone cuts the work by ~60% versus
   running everything everywhere — and it is what keeps the suite usable on non-React stacks.
3. **One subagent per (module, lens).** Its context holds the file bodies; it dies when the task
   ends, taking the detail with it. The orchestrator receives 40 lines.
4. **Hard budget with an honest bail-out.** At ~25 files / ~4,000 lines a lens stops, reports
   `partial`, and lists `Files Remaining` plus a suggested sub-split. A deep report on 20 files
   plus a stated remainder beats a skim of 60.
5. **Sampling when a module cannot be split cleanly:** public surface → highest churn → most
   imported → largest → newest, with the depth of each file recorded.
6. **Findings accumulate; detail does not.** The ledger in `state.md` grows by a few lines per
   finding. The merge step reads only the ledger — never the reports — so the final synthesis
   happens with a clean context, which is exactly where judgment matters most.
7. **Systemic promotion instead of repetition.** The same defect in ≥3 modules collapses into
   one `SYS-NNN` finding one severity higher, with an enforcement proposal. 40 instances become
   1 finding plus a table.
8. **Across sessions, not just within one.** A repo too big for one context is usually too big
   for one sitting. `knowledge-sync` makes session N+1 start from a 200-line primer with staleness
   already checked, so an audit can span days without re-deriving anything — and without acting
   on findings that the last three commits already fixed.

Arithmetic for a 10,000-file repo: ~60 modules × ~3 lenses × 40 lines ≈ 7,200 lines of digest
in the orchestrator. The same audit done inline with file contents is roughly two orders of
magnitude over any context window.

---

## 5. Extending the suite

**Add a framework lens** (`vue-review`, `nextjs-review`, `nestjs-review`, `fastify-review`, …):

1. Write `.claude/skills/<framework>-review/SKILL.md` with the standard lens layout.
2. Add its ID prefix to `_shared/issue-format.md`.
3. Add a detection signature (§2) and a registry row with status `available` (§3) in
   `project-auditor/references/stack-detection.md`.
4. Add its rows to the dispatch matrix in `orchestration.md`, including any mutual exclusion
   (NestJS excludes Express; Next pairs with React).
5. State the **version scope** in the skill's Inputs — these rules are version-sensitive, and a
   finding citing the wrong major version is a false finding.
6. Draw the boundary with the universal lenses in the skill's Purpose, so one defect is not
   reported twice. Framework lenses own *framework mechanics*; universal lenses own structure,
   exploitability, contracts, and cost. `express-review` has that boundary table — copy its shape.

A framework lens missing its registry rows will never be dispatched, no matter how good it is.

**Add a universal lens** (e.g. `accessibility-review`, `db-review`, `i18n-review`, `docs-review`):

1. `mkdir .claude/skills/<name>-review` and write `SKILL.md` with the same section layout the
   nine lenses use: frontmatter (`name`, `description`, `allowed-tools`) → Purpose → Activation
   examples → Required reading → Inputs → Workflow → Review checklist → Detection recipes →
   Best practices → Anti-patterns → Output template → Directory structure.
2. Frontmatter `description` must say **what it reviews and when to use it** — that text is how
   the skill gets selected. Include the words a user would type.
3. Reference the four `_shared/` contracts in Required reading. Do not restate them; if a rule
   needs changing, change it in `_shared/` so every lens moves together.
4. Pick an ID prefix (`A11Y`, `DB`, `I18N`) and add it to the list in `_shared/issue-format.md`.
5. Add rows to the dispatch matrix in
   `project-auditor/references/orchestration.md` — module kinds it applies to, and the kinds it
   must never run on. **A lens the matrix does not mention will never be dispatched.**
6. Keep it read-only (`Read, Write, Glob, Grep, Bash` — `Write` only for its report).

**Add a foundation skill** (something that produces an artifact rather than findings — e.g.
`adr-extract`, `metrics-collect`, `ownership-map`):

1. Same layout, but **no issue format** — foundation skills emit facts or summaries, never
   findings with severities. Say so explicitly in Purpose; it is the line that keeps them reusable.
2. Declare the artifact path under `.claude-audit/` and record the commit sha in it, so
   `knowledge-sync` can detect staleness.
3. Add it to the phase-ownership table in `orchestration.md` and to the delegation map in
   `project-auditor/SKILL.md` — a phase with no owner in those two tables never runs.
4. If it summarizes other artifacts, read **headers only** and state its sources.

**Tune the suite for a project:**

- Module sizes and budgets → `_shared/context-budget.md`
- Severity bar, effort scale, Quick Win definition → `_shared/issue-format.md`
- Report sections → `_shared/report-format.md`
- Which lenses run on which kind of module → `orchestration.md` dispatch matrix
- Which lenses exist at all for a given stack → `references/stack-detection.md` (detection
  signatures + registry)
- Merge, ranking, and roadmap rules → `report-merge/SKILL.md` (**not** `orchestration.md` — the
  algorithm has one home)
- Audit / roadmap document shape → `project-auditor/references/final-report-template.md`
- Primer length and emphasis → `knowledge-sync/SKILL.md` (`max-lines`, `for`)
- The project's module map and conventions → `project-auditor/references/module-map-example.md`
  (a worked example for this repo; `repo-map` regenerates the live one per audit)

**Do not** add project-specific rules into a lens's checklist. Lenses stay portable; project
specifics go in the dispatch prompt (`conventions`, `invariants`) and in the module map.

---

## 6. Design rules the suite enforces

These are the reasons a report from this suite can be trusted, and they are non-negotiable in
`_shared/review-protocol.md`:

- **No finding without evidence** — `path:line`, a verbatim snippet ≤10 lines, and how it was
  verified. Missing any of the three → the finding is deleted, not softened.
- **A mandatory verification pass** before every report. Findings that cannot be confirmed go to
  `Appendix: Needs Verification`, never to `Priority Fixes`. Critical/High requires Confidence
  ≥ Medium.
- **No praise without a mechanism, no criticism without evidence.** "Clean code" is banned; so
  is "this could be problematic".
- **Compiling, passing tests, and working in production are not evidence of correctness.**
  Lenses are instructed to assume defects exist and go find them — and to say plainly when a
  module turns out to be sound, with what was checked.
- **The project's own conventions are the yardstick.** A finding that violates a documented
  convention is stronger; one that merely disagrees with house style is demoted or dropped.
- **Coverage is always stated.** Modules and files reviewed vs. total, with reasons for every
  gap. An audit that implies completeness it does not have is worse than no audit.
- **Facts and judgments are separate skills.** `repo-map` records that a cycle exists;
  `architecture-review` decides whether it matters. Mixing the two makes the map unreusable and
  the review unfalsifiable.
- **A lens never runs on a stack it does not understand.** Framework lenses are gated on detected
  dependency **and** code signals; a detected framework with no lens is recorded as a stated blind
  spot, never substituted with a near neighbour.
- **Findings are dated.** `knowledge-sync` checks every module against HEAD and marks it stale
  when its files have changed. An old finding presented as current is a worse failure than a
  missed one, because someone will act on it.
- **The suite audits; it does not fix.** Remediation is a separate, explicit request.

---

## 7. Directory structure

```
.claude/skills/
├── README.md                          ← this file
├── _shared/                           ← contracts read by every skill (not a skill itself)
│   ├── review-protocol.md
│   ├── issue-format.md
│   ├── report-format.md
│   └── context-budget.md
├── project-auditor/                   ← tier 1: orchestration
│   ├── SKILL.md
│   └── references/
│       ├── orchestration.md           ← phase ownership, dispatch matrix, subagent prompt
│       ├── stack-detection.md         ← detection signatures + framework-lens registry (the gate)
│       ├── module-map-example.md      ← worked partition of this repo + its conventions
│       ├── state-template.md          ← .claude-audit/state.md schema
│       └── final-report-template.md   ← FINAL-AUDIT.md + ROADMAP.md templates
├── repo-map/SKILL.md                  ← tier 2: foundation (facts, no findings)
├── knowledge-sync/SKILL.md            ← tier 2
├── report-merge/SKILL.md              ← tier 2
├── architecture-review/SKILL.md       ← tier 3a: universal lenses
├── css-review/SKILL.md
├── performance-review/SKILL.md
├── security-review/SKILL.md
├── api-review/SKILL.md
├── naming-review/SKILL.md
├── technical-debt-review/SKILL.md
├── testing-review/SKILL.md
├── react-review/SKILL.md              ← tier 3b: framework-gated (React)
└── express-review/SKILL.md            ← tier 3b: framework-gated (Express, not NestJS)

.claude-audit/                         ← generated, gitignored
├── CONTEXT.md                         ← session primer          (knowledge-sync)
├── PROJECT-MAP.md                     ← stack/folders/features/graph  (repo-map)
├── modules.md                         ← module partition        (repo-map, tuned by auditor)
├── state.md                           ← queue + ledger + decisions log (project-auditor)
├── reports/<module-slug>.<lens>.md    ← full reports            (the lenses)
├── FINAL-AUDIT.md                     ← ranked audit            (report-merge)
└── ROADMAP.md                         ← sequenced fix plan      (report-merge)
```

## 8. Known name collision

Claude Code ships a built-in `security-review` skill that reviews **pending changes on the
current branch**. This suite's `security-review` reviews **one module of the existing
codebase**. Different jobs, same name.

If your setup surfaces both ambiguously, rename this one:

```
.claude/skills/security-review → .claude/skills/security-module-review
```

and update the two places that name it: the dispatch matrix in
`project-auditor/references/orchestration.md`, and the lens list in section 1 above. Nothing
else references it.
