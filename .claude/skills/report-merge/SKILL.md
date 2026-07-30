---
name: report-merge
description: Merges all review reports into one ranked audit — collects findings, deduplicates overlapping issues, promotes cross-module patterns to systemic findings, ranks Critical to Low, and generates a sequenced fix roadmap. Use when review reports exist and need consolidating, when asked for the final audit or the prioritized roadmap, or to re-merge after new reviews. Produces .claude-audit/FINAL-AUDIT.md and ROADMAP.md.
allowed-tools: Read, Write, Glob, Grep, Bash
---

# report-merge

## Purpose

Turn N module reports into one document a team can act on: deduplicated, ranked by consequence,
with cross-module patterns collapsed into systemic findings, and a roadmap sequenced so
prerequisites come first.

This is the step where an audit either becomes useful or becomes a 400-item backlog nobody
opens. Two jobs matter most:

- **Compression** — 23 instances of one problem must become 1 finding with a table, not 23
  entries. An unmerged list is not a merge.
- **Sequencing** — the ranked list says what is worst; the roadmap says what to do *first*,
  which is not the same thing. A risky refactor comes *after* the test that protects it, even
  though the refactor is the higher-severity finding.

This skill is also the canonical home of the merge algorithm; `project-auditor` delegates step 9
and 10 here rather than duplicating it.

## Activation examples

- "Merge the review reports"
- "Give me the final audit"
- "Build the fix roadmap"
- "Re-merge — I added two more module reviews"
- "Rank everything we found by severity"
- Invoked by `project-auditor` at steps 9–10.

## Required reading

`_shared/issue-format.md` — the rubrics are the ruler for the anti-inflation sweep.
`_shared/report-format.md` § Digest — the ledger row shape.
`project-auditor/references/final-report-template.md` — the two output templates.

## Inputs

Optional: `scope` (merge only certain modules/lenses), `since` (re-merge only reports newer than
a previous merge), `mode` (`full` — default, rebuild both documents; `incremental` — fold new
reports into an existing merge, preserving IDs and the roadmap's completed items).

## Workflow

### 1. Collect — ledger first, reports only to fill gaps

```bash
ls .claude-audit/reports/*.md | wc -l
rg -c "^### [A-Z]+-" .claude-audit/reports/*.md          # findings per report
```

The findings ledger in `.claude-audit/state.md` is the intended input: it already holds every
row (ID, lens, module, severity, confidence, title, location, effort, impact). Read reports only
for rows the ledger is missing, and then only their `## Findings` headings:

```bash
rg -n "^### |^- \*\*Severity|^- \*\*Confidence|^- \*\*Location|^- \*\*Effort|^- \*\*Impact" \
   .claude-audit/reports/<file>.md
```

Never load whole reports. This step must stay cheap, because judgment quality here matters more
than anywhere else in the suite and context pressure is what degrades it.

Also collect, per report header: coverage, `Files Remaining`, verdict, and `Cross-module notes`
(`ROUTE` lines) — coverage feeds the audit's honesty section, ROUTE lines feed step 3.

### 2. Normalize

One row per finding: `ID | lens | module | sev | conf | title | location | effort | impact`.
Reject rows missing severity, confidence, or location — a finding that cannot be ranked cannot
be merged; list them under `Malformed (excluded)` with their source report so they can be fixed.

### 3. Deduplicate

- **Same location, different lenses** → one row. Severity = max, confidence = max, `lens`
  becomes a list. (A performance and a React lens both finding one re-render is one problem.)
- **Same defect, same module, different wording** → collapse; keep the clearer title, union the
  locations.
- **A `ROUTE` line matching an existing finding** → drop the route note; it is already covered.
  A `ROUTE` line with no matching finding → record as `Unreviewed lead` (not a finding: no lens
  verified it).

Never merge two findings that share a *location* but describe different defects. Report how many
rows collapsed — that number is a quality signal for the audit.

### 4. Promote systemic patterns

Cluster by **defect shape**, not by wording: "controller returns `res.status(500)` in catch",
"magic value duplicated across the client/server boundary", "list rendered without windowing".

A cluster spanning **≥3 modules** becomes `SYS-NNN`:

- **severity** = max(instances) raised one step, capped at Critical — because a repeated defect
  is a process failure, not N accidents;
- **confidence** = min(instances) — the cluster is only as sure as its weakest member;
- **effort** = the *systemic* cost (convention + enforcement + migration), typically L/XL — not
  the sum of local fixes, and not the cost of one;
- **evidence** = the instance table (module, location, severity);
- **enforcement** = the mechanism that stops recurrence: a lint rule, a schema, a CI check, a
  test, a CONTRIBUTING entry. **A systemic finding without an enforcement proposal is half a
  finding** — the fix without it regresses within a quarter.

Instances move to an appendix table; they no longer appear as top-level findings.

### 5. Anti-inflation sweep

Re-read `_shared/issue-format.md` and apply the bars to the merged list:

- Critical/High with Confidence Low → verify or demote. This skill cannot verify (it does not
  read code), so demote and note it.
- "Could theoretically" with no reachable path → not Critical/High.
- Style disagreement → Low or dropped.
- Findings that contradict a **declared** project convention → keep, mark
  `violates declared convention`. Findings that merely contradict house style → demote to Low or
  drop, marked `matches convention (reviewer disagreement)`. The audit is not the place to
  relitigate settled style.
- Findings inside modules whose coverage was `partial` → keep, but never state or imply that the
  module is clean.

Report the drop/demote count. **A merge that changes nothing was not a merge** — either the
inputs were unusually clean (say so) or the sweep was not applied.

### 6. Rank

Severity desc → confidence desc → blast radius desc → effort asc. Ties break toward whatever
unblocks other fixes. Blast radius comes from the location count and the fan-in recorded in
`PROJECT-MAP.md` (a finding in a module with fan-in 21 outranks the same finding in a leaf).

### 7. Coverage accounting

Modules done / clean / degraded / partial / not-reviewed; files read vs. tracked; lenses that
never ran and on what. This goes into the audit **verbatim and in the body**, not in a footnote.
An audit without stated coverage is a marketing document — and an audit that implies
completeness it does not have is worse than none.

### 8. Build the roadmap

- **Now** — Critical + High at Confidence ≥ Medium, **plus their prerequisites**. If a fix needs
  a test, a backup, or a migration script first, that prerequisite is its own Now item, ordered
  before it.
- **Next** — remaining High, Medium with wide blast radius, systemic findings whose fix is a
  convention plus enforcement.
- **Later** — L/XL structural work, each with the **trigger condition** that should start it
  ("when a third consumer appears", "before the next data migration").
- **Quick wins** — parallel track, strictly per the definition in `_shared/issue-format.md`.
  Do not pad it; a quick-win list of 30 cosmetic items buries the 4 that matter.
- **Enforcement** — one entry per systemic finding, with concrete config where possible.
- **Explicitly not recommended** — findings a reader might expect, and why they are excluded
  (cost exceeds benefit, matches a deliberate decision, or the project's stated priorities rule
  them out). This section is what stops the roadmap being re-litigated.

Every item: finding IDs, effort, dependencies, and **the risk of not doing it**. Effort totals
per phase stated, not implied.

### 9. Write and report

`.claude-audit/FINAL-AUDIT.md` and `.claude-audit/ROADMAP.md` per
`project-auditor/references/final-report-template.md`. Then update `state.md`: mark the merge
sha/date and record the systemic IDs so an incremental re-merge is stable.

Return ≤25 lines: verdict, counts by severity, systemic count, collapsed/dropped counts,
coverage, top 5, quick-win count and total effort, and the first roadmap item.

## Review checklist

This skill produces no new findings; the checklist is for the merge's own quality.

**Collection** — [ ] every report accounted for (count matches `reports/`) · [ ] ledger used as
the primary source · [ ] no whole report loaded · [ ] malformed rows listed, not silently dropped

**Deduplication** — [ ] cross-lens duplicates collapsed · [ ] collapse count reported ·
[ ] no two distinct defects merged because they share a location · [ ] ROUTE leads resolved

**Systemic promotion** — [ ] clusters by defect shape, not wording · [ ] ≥3 modules → `SYS-NNN` ·
[ ] severity/confidence/effort computed by the stated rules · [ ] every systemic finding has an
enforcement mechanism · [ ] instances moved to an appendix

**Ranking** — [ ] severity rubric applied, not the reviewers' self-assessment · [ ] Critical/High
with Low confidence demoted and noted · [ ] blast radius informed by fan-in · [ ] drop/demote
count reported

**Honesty** — [ ] coverage in the body · [ ] partial modules never implied clean · [ ] blind spots
stated · [ ] declared-convention conflicts marked in both directions

**Roadmap** — [ ] every item traces to finding IDs · [ ] prerequisites ordered before dependents ·
[ ] effort totals per phase · [ ] every item has a risk-of-not-doing · [ ] Later items have
trigger conditions · [ ] quick wins meet the definition · [ ] enforcement per systemic finding

## Best practices

- **Sequence is the value you add.** The findings list already says what is worst. Only the
  roadmap can say "do this test first, then that refactor" — that ordering is the deliverable.
- **Merge aggressively, rank conservatively.** Collapse duplicates hard; do not inflate severity
  to make the audit look important.
- **One number sells the audit:** "23 instances of 3 systemic patterns" tells a lead more than 23
  rows ever will.
- **Enforcement is part of every systemic fix.** Otherwise you will merge the same finding again
  next quarter.
- **Respect stated project priorities.** If the project's declared phase is "stability for a
  demo", large refactors belong in Later with a trigger — the finding stands, the timing changes.
- **Keep IDs stable across re-merges.** People cite them in commits and PRs; renumbering breaks
  that link.

## Anti-patterns

- ❌ Concatenating reports and calling it a merge
- ❌ Reading every report in full (defeats the suite's context design at the step most sensitive
  to it)
- ❌ Listing 23 instances of one pattern as 23 findings
- ❌ Inventing findings not present in any report
- ❌ Raising severity to make the audit look more urgent, or lowering it to look reassuring
- ❌ A roadmap of "improve X" items with no IDs, effort, sequence, or consequence
- ❌ Reporting a total finding count without coverage — the two numbers are meaningless apart
- ❌ Scheduling a refactor before the test that makes it safe

## Output template

Both documents follow `project-auditor/references/final-report-template.md`.
Merge summary returned to the caller:

```
MERGE COMPLETE — <repo> @ <sha>
Reports merged: 34 (from 14 modules × 2.4 lenses avg) · malformed excluded: 1
Rows in:  118  →  after dedupe: 96 (-22)  →  after sweep: 81 (-15 dropped/demoted)
Systemic: 4 (SYS-001…004) absorbing 37 instances
Findings: 3 Critical · 11 High · 34 Medium · 33 Low
Coverage: 14/24 modules · 512/519 files · 3 partial · 2 degraded · 7 not-reviewed
Verdict:  acceptable with debt — the risk concentrates in the admin surface and the economy path
Top 5:    SEC-…-001 (C) · SYS-001 (C) · SEC-…-002 (H) · TEST-…-001 (H) · PERF-…-001 (H)
Quick wins: 9 (~1.5 days total)
Roadmap starts with: #1 rotate the committed JWT secret (S) — blocks nothing, costs nothing
→ .claude-audit/FINAL-AUDIT.md · .claude-audit/ROADMAP.md
```

## Directory structure

```
.claude/skills/report-merge/
└── SKILL.md

reads   → .claude-audit/state.md (ledger, primary) · reports/*.md (headings only, as needed)
outputs → .claude-audit/FINAL-AUDIT.md
          .claude-audit/ROADMAP.md
          .claude-audit/state.md (merge marker + systemic IDs)
```
