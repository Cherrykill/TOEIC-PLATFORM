---
name: knowledge-sync
description: Builds a compact session primer from the project map and existing audit reports so a new conversation starts informed instead of rediscovering the codebase. Use at the start of a session ("catch me up", "what do we know about this repo", "where did the audit stop"), after compaction, or before resuming an audit. Reads PROJECT-MAP.md, state.md and report headers; writes .claude-audit/CONTEXT.md. Detects staleness against the current commit.
allowed-tools: Read, Write, Glob, Grep, Bash
---

# knowledge-sync

## Purpose

Turn everything the suite has already learned into one short, current, self-contained briefing —
so session N+1 does not pay to rediscover what session N established.

Two failure modes it exists to prevent:

1. **Amnesia** — a new chat re-reads the repo, re-derives the stack, and re-finds the same
   issues, burning context on work already done.
2. **Confident staleness** — a primer that repeats findings from three weeks and forty commits
   ago as if they were current. This is the worse failure: acting on a fixed finding wastes
   time and destroys trust in the whole audit.

So this skill does two jobs: **compress** what is known, and **date-stamp** it against the
current commit.

## Activation examples

- "Catch me up on this project"
- "What do we already know about this repo?"
- "Where did the audit stop?"
- "Refresh the context, then continue the audit"
- After a compaction, or at the start of any session that will act on a previous audit
- Invoked by `project-auditor` at step 0 (resume check)

## Required reading

`_shared/context-budget.md` § Recovery. The issue/report formats do **not** apply — this skill
produces a briefing, not findings, and must never invent one.

## Inputs

Optional: `focus` (a module or subsystem to bias the primer toward), `for` (`audit-resume` /
`implementation` / `onboarding` — changes what gets emphasised), `max-lines` (default 200).

## Workflow

### 1. Inventory what exists

```bash
ls -la .claude-audit/ 2>/dev/null
ls .claude-audit/reports/ 2>/dev/null | wc -l
git rev-parse --short HEAD
```

If `.claude-audit/` does not exist: say so, and offer `repo-map` (to get a map) or
`project-auditor` (to start an audit). Do not fabricate a primer from nothing — a briefing with
no sources is worse than no briefing.

### 2. Read the durable artifacts — in this order, and stop early

1. `.claude-audit/PROJECT-MAP.md` — the whole thing. It is designed to be cheap.
2. `.claude-audit/state.md` — queue status, findings ledger, decisions log.
3. `.claude-audit/FINAL-AUDIT.md` if present — read only: Verdict, Executive Summary,
   Systemic Findings headings, Coverage.
4. `.claude-audit/reports/*.md` — **headers only**, never bodies:

   ```bash
   for f in .claude-audit/reports/*.md; do sed -n '1,12p' "$f"; echo '---'; done
   ```

   The ledger already holds every finding row. Report bodies exist for humans acting on a
   specific module — pull one only if `focus` names that module.

### 3. Detect staleness (the step that makes this trustworthy)

```bash
AUDIT_SHA=<sha recorded in PROJECT-MAP.md / state.md>
git diff --name-only $AUDIT_SHA..HEAD | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn
git log --oneline $AUDIT_SHA..HEAD | head -20
```

Map the changed paths onto modules, then classify every module:

| Class | Meaning |
|---|---|
| `current` | no file in the module changed since the audit sha |
| `stale` | files changed; its findings may be fixed or invalidated — must be re-checked before acting |
| `unaudited` | never reviewed |

For findings inside stale modules, spot-check the *highest-severity ones only* by opening the
cited `path:line` and checking whether the evidence still holds. Mark each
`still present` / `changed — re-verify` / `appears fixed`. Cap this at ~10 checks; it is a
sanity pass, not a re-audit.

If the recorded sha is unavailable (history rewritten, shallow clone), say so and mark
everything `staleness unknown`.

### 4. Extract the invariants and decisions

The most valuable content for the next session is not the findings — it is the things that are
easy to violate by accident:

- **Invariants** the codebase must preserve (server-authoritative values, level↔XP consistency,
  which layer may import which, what must never move to the client).
- **Declared conventions** from the map (error contract, validation location, naming, comment
  language).
- **Decisions already taken** from `state.md` → Decisions log, including deliberate trade-offs
  that must not be re-litigated as findings.
- **Known blind spots** — what the audit structurally could not see.

Source each one with a file path. An unsourced invariant in a primer becomes folklore.

### 5. Write `.claude-audit/CONTEXT.md` and report

Hard limit: `max-lines` (default 200). It must be **self-contained** (a reader with no other
context can act), **sourced** (every claim has a path or a finding ID), and **current**
(staleness stated per module).

Return a ≤20-line summary: verdict, where to resume, top 3 open items, stale-module count, and
what to do next. The primer itself is on disk.

### 6. Keep it fresh

Re-run after each audit stage, after a batch of fixes, or when HEAD has moved materially. It is
cheap by design. When findings are fixed, move them to `Recently resolved` with the commit —
that section is what stops the next session from re-reporting them.

## Review checklist

This skill reviews nothing; the checklist is for the primer's own quality.

**Sourcing** — [ ] every claim traceable to a path, a finding ID, or a commit · [ ] no finding
invented, inferred, or restated more strongly than its confidence · [ ] no code in the primer,
only pointers

**Currency** — [ ] audit sha vs. HEAD stated · [ ] every module classed current / stale /
unaudited · [ ] top stale findings spot-checked with a verdict · [ ] resolved findings moved
out of the open list

**Compression** — [ ] ≤ max-lines · [ ] no duplication of `PROJECT-MAP.md` (link it) ·
[ ] findings as one-line index rows, not restated in full · [ ] emphasis matches `for`

**Actionability** — [ ] "where to resume" is a concrete next step · [ ] invariants and
conventions listed with sources · [ ] blind spots stated · [ ] decisions log carried forward so
settled questions stay settled

## Best practices

- **Recency beats completeness.** A 120-line primer that is accurate today is worth more than a
  400-line one that is accurate as of last month.
- **Lead with the resume point.** Most invocations exist to answer "what do I do next?" — put it
  in the first five lines.
- **Carry the decisions log forward, always.** It is the only thing preventing a new session
  from re-opening a question the user already settled, or re-filing a deliberate trade-off as a
  finding.
- **Findings stay one line each.** IDs plus locations. Anyone who needs detail reads the report;
  the primer's job is to tell them which report.
- **Distinguish "we know" from "we assumed".** A primer that launders an assumption into a fact
  is how audits go wrong quietly.
- **Prefer re-running to patching.** Regenerating is cheap; a hand-edited primer diverges from
  the artifacts it summarizes.

## Anti-patterns

- ❌ Producing a primer with no `.claude-audit/` artifacts to summarize
- ❌ Restating findings in full — that is the report's job
- ❌ Presenting month-old findings as the current state without a staleness check
- ❌ Copying `PROJECT-MAP.md` into `CONTEXT.md` instead of linking it
- ❌ Adding new findings or opinions of your own
- ❌ Silently dropping the decisions log, so old debates restart
- ❌ Reading report bodies for every module (the ledger exists precisely so you do not)

## Output template

`.claude-audit/CONTEXT.md`:

```markdown
# Session Context — <repo>

**Generated:** <date> · **Audit sha:** `<sha>` · **HEAD:** `<sha>` (<N> commits since)
**Sources:** PROJECT-MAP.md · state.md · <N> reports (headers) · FINAL-AUDIT.md
**Staleness:** <n> modules current · <n> stale · <n> unaudited

## Resume here
<The concrete next step: "Audit module 12/24 `fe.api` (lenses: api, testing) — queue in
state.md" or "No audit in progress; 4 Now-items open in ROADMAP.md".>

## The project in 10 lines
<Stack, architecture in one line, the 3–5 features that matter, the size. Link to
PROJECT-MAP.md for the rest — do not restate it.>

## Invariants — do not break these
| Invariant | Source |
|---|---|
| Currency/XP/level/energy mutate server-side only | `CLAUDE.md`, `utils/userStateHelper.js:90` |
| XP added only via `awardXp`/`applyLevelUp`, saving profile + stats | `utils/userStateHelper.js:79-98` |

## Declared conventions
| Rule | Source |
|---|---|
| Controllers `next(ApiError)`, never `res.status(5xx)` in catch | `backend/CONTRIBUTING.md` |

## Open findings (top <N> by severity)
| ID | Sev | Module | Title | Location | Module status |
|---|---|---|---|---|---|
| SEC-…-001 | Critical | be.routes.admin | Admin DB routes lack a role check | routes/adminDb.js:18 | stale — re-verify |

## Recently resolved
| ID | Fixed in | Note |
|---|---|---|
| API-…-002 | `a1b2c3d` | wrapper now normalizes error kinds |

## Decisions already taken — do not re-litigate
- <date> <decision + why> (`state.md` decisions log)

## Module status
| Module | Audited | Lenses | Findings | Status |
|---|---|---|---|---|

## Blind spots
- <what the audit cannot see: runtime behaviour, prod data shape, load, anything needing a
  running system>

## Where things live
| Need | Go to |
|---|---|
| full findings for a module | `.claude-audit/reports/<slug>.<lens>.md` |
| what to fix next | `.claude-audit/ROADMAP.md` |
| structure, graph, features | `.claude-audit/PROJECT-MAP.md` |
```

## Directory structure

```
.claude/skills/knowledge-sync/
└── SKILL.md

reads   → .claude-audit/PROJECT-MAP.md, state.md, reports/*.md (headers), FINAL-AUDIT.md
outputs → .claude-audit/CONTEXT.md
```