# Context Budget — how this suite reviews repos bigger than the context window

The whole design rests on one idea: **implementation detail is disposable, findings are not.**
Detail lives in a subagent's context or on disk; only digests cross back into the
orchestrator.

## Budgets

| Level | Budget | Enforcement |
|---|---|---|
| One module, one lens | ~25 files / ~4,000 lines read | The lens skill stops and reports `partial`. |
| One module, all lenses | 2–6 lenses | Orchestrator picks from the dispatch matrix; unused lenses are never invoked. |
| Orchestrator, whole audit | ~40 lines of digest per (module, lens) | Nothing else from a review may enter its context. |

For a 10,000-file repo: ~60 modules × ~3 lenses × 40 lines ≈ 7,200 lines of digest. That
fits. The same audit done inline with file contents would not fit by two orders of magnitude.

## Module sizing rules

A good module is:

- **5–25 source files**, or ≤ ~4,000 LOC;
- **one cohesive purpose** — a feature, a layer of a feature, or a service cluster;
- **one technology** — never mix frontend and backend, never mix code and styles;
- **cut along an existing boundary** — a directory, a route domain, a feature folder.

Split further when: a directory exceeds the budget, a directory mixes concerns (routes +
business logic + data access), or one file exceeds ~1,500 lines (that file becomes its own
module).

Merge when: several directories total under ~500 LOC and share a purpose (e.g. `utils/`
one-liners).

Never include: `node_modules`, `dist`, `build`, `coverage`, `vendor`, lockfiles, generated
bundles, binary assets, `.min.*`. Exclude them at the Glob stage, not by reading and
discarding.

## Sampling a module too large to split cleanly

When a module must be reviewed but cannot be fully read, pick files in this order and say so
in `Files Reviewed` → Depth:

1. **Public surface** — index/entry/route/exported component.
2. **Highest churn** — `git log --format= --name-only --since=6.months -- <dir> | sort | uniq -c | sort -rn | head -20`. Churn correlates with both bugs and value.
3. **Most imported** — grep the module name across the repo; the file everyone depends on
   matters most.
4. **Largest** — size is a proxy for accumulated decisions.
5. **Newest** — least reviewed by anyone.

Explicitly record what you did *not* read. A partial review that is honest about its
coverage is usable; one that implies completeness is dangerous.

## Summarize-and-discard (inline mode only)

When the orchestrator runs lenses in its own context instead of subagents:

1. Lens writes the full report to disk.
2. Lens emits the digest.
3. Orchestrator appends the digest rows to `.claude-audit/state.md` → Findings ledger.
4. Orchestrator states: `DROPPING DETAIL: <module> <lens>` and from that point must not
   reference any file content from that module. If it needs detail again, it re-reads the
   report from disk — deliberately, one report at a time.

Subagent mode makes steps 1–4 automatic and is the default for anything above ~10 modules.

## Recovery after compaction or a new session

`.claude-audit/state.md` + `.claude-audit/reports/` are the source of truth, not the
conversation. To resume: read `state.md`, find the first module whose status is not `done`,
continue there. Never restart from module 1 because the conversation was lost.
