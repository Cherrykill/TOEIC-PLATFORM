# Final audit templates

Two files. The audit answers *what is true*; the roadmap answers *what to do next*.
Both are built from the ledger in `state.md`, never by re-reading module reports.

---

## A. `.claude-audit/FINAL-AUDIT.md`

```markdown
# Engineering Audit — <repo>

- **Commit:** `<sha>` · **Date:** <YYYY-MM-DD>
- **Scope:** <what was audited>
- **Coverage:** <done>/<total> modules · <files read>/<tracked> files · <deferred> deferred
- **Method:** module-by-module review, <N> lens passes, <mode> dispatch
- **Reports:** `.claude-audit/reports/` (<N> files)

## Verdict

<One paragraph. The honest state of this codebase: what it does well structurally, the one
thing that most threatens it, and whether it is safe to keep building on as-is. A CTO reading
only this paragraph must not be misled.>

| | |
|---|---|
| Overall | healthy · acceptable with debt · fragile · needs rework |
| Correctness risk | high/med/low |
| Security posture | high/med/low |
| Maintainability | high/med/low |
| Scalability headroom | high/med/low |
| Test safety net | high/med/low |

## Executive Summary

<5–10 sentences: the stack, the architecture in one line, finding counts by severity, the
2–3 systemic themes, and what the roadmap's first move is.>

**Findings:** <c> Critical · <h> High · <m> Medium · <l> Low · <s> systemic
**Dropped at merge:** <n> (failed the severity bar or were duplicates) — kept honest on purpose.

## Strengths

<3–7 bullets. Each: the artefact, the property, the mechanism, `path:line`. These are load-
bearing — a reader uses them to know what NOT to refactor away.>

## Weaknesses

<3–7 bullets. Themes with the finding IDs behind them. Ordered by consequence.>

## Systemic Findings

<Cross-module patterns (`SYS-NNN`), full issue format, with the instance table and the
enforcement mechanism that would prevent recurrence (lint rule, schema, CI check, convention
doc). A systemic finding without an enforcement proposal is half a finding.>

## Findings by Severity

### Critical
<full issue-format entries, or "None.">
### High
### Medium
### Low
<Low may be summarized as a table if there are more than ~15: `ID | module | title | location | effort`.>

## Risk Assessment

| Risk | Likelihood | Blast radius | Existing mitigation | Residual | Findings |
|---|---|---|---|---|---|

<Then: the three changes most likely to cause an incident if made carelessly, and what
protection is missing for each.>

## Architecture Assessment

<Half a page: the intended architecture, the actual one, where they diverge, and whether the
divergence is drift or a deliberate trade-off. Reference the architecture-review reports.>

## Coverage and Gaps

| Module | Lenses run | Status | Findings | Report |
|---|---|---|---|---|

**Not reviewed:** <path — reason> …
**Degraded reviews:** <module — what failed>
**Known blind spots:** <what this audit structurally cannot see: runtime behaviour, prod data
shapes, load characteristics, anything requiring a running system.>

## Priority Fixes
<Top ordered list across the whole repo. `<ID> — title` · sev · effort · why first. Max 10.>

## Quick Wins
<Per the Quick Win definition. Table: ID · title · effort · module. With a total effort estimate.>

## Long-term Improvements
<L/XL items with their trigger conditions.>

## Appendix: Needs Verification
<Aggregated low-confidence items with the exact check that resolves each.>
```

---

## B. `.claude-audit/ROADMAP.md`

```markdown
# Improvement Roadmap — <repo>

Derived from `FINAL-AUDIT.md`. Every item traces to finding IDs. Sequenced so prerequisites
come first — notably, **do not schedule a risky refactor before the test that protects it.**

## Now — <total effort estimate>

| # | Item | Findings | Effort | Depends on | Risk of not doing it |
|---|---|---|---|---|---|
| 1 | Rotate and remove the committed JWT secret; move to env + CI secret | SEC-…-001 | S | — | Any repo reader can mint admin tokens |
| 2 | Add regression test around <core scoring path> | TEST-…-004 | M | — | Blocks item 3 safely |
| 3 | <refactor that item 2 protects> | ARCH-…-002 | L | #2 | Silent scoring drift on every future change |

## Next — <total effort estimate>

| # | Item | Findings | Effort | Depends on | Risk of not doing it |
|---|---|---|---|---|---|

## Later

| # | Item | Findings | Effort | Trigger condition |
|---|---|---|---|---|
| | <structural change> | SYS-002 | XL | When a third consumer of <X> appears |

## Quick wins (parallel track)

| Item | Findings | Effort |
|---|---|---|

## Enforcement — stop the debt coming back

<For each systemic finding, the mechanism: a lint rule, a schema, a CI check, a test, a
CONTRIBUTING entry. Include the concrete config where you can. Fixes without enforcement
regress within a quarter.>

## Explicitly not recommended

<Findings a reader might expect here and why they are excluded: cost exceeds benefit, matches
a deliberate project decision, or the project's stated priorities (e.g. "stability for a demo
over refactoring") rule them out. Naming these prevents the roadmap from being re-litigated.>
```

## Rules for both files

- Every claim traces to a finding ID; every finding ID traces to a report path.
- Effort totals are stated, not implied. "Now" that secretly costs three weeks is not a plan.
- Coverage and blind spots are stated in the audit body, not buried in an appendix.
- No item without a consequence for skipping it. If you cannot name one, it does not belong.
