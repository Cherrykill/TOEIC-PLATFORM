# Report Format — every review produces exactly this

Two artifacts per invocation: a **full report** on disk, and a **digest** returned to the
caller. The digest is the only part that enters the orchestrator's context.

---

## A. Full report

Path: `.claude-audit/reports/<module-slug>.<lens>.md`
`module-slug` = module path with `/` → `.` (e.g. `frontend.src.components.shop`).

```markdown
# <Lens> Review — <module.path>

- **Module:** `<module.path>` — <one sentence: what this module is for>
- **Lens:** <lens name>
- **Reviewed at:** <YYYY-MM-DD> · commit `<short sha>`
- **Coverage:** <N> of <M> files read · ~<L> lines
- **Budget status:** complete | partial (see Files Remaining)

## Executive Summary

<3–6 sentences. What this module does, the single most important thing found, and the
overall verdict. A reader who stops here must still know whether to worry.>

**Verdict:** healthy | acceptable with debt | fragile | needs rework
**Finding count:** Critical <n> · High <n> · Medium <n> · Low <n>

## Strengths

<2–5 bullets. Each names the artefact, the property, and `path:line`. No adjectives without
a mechanism. Omit the section only if there is genuinely nothing — and say so.>

## Weaknesses

<2–5 bullets. Themes, not individual findings — the patterns behind the findings below.>

## Findings

<Every finding in full `_shared/issue-format.md` shape, ordered Critical → Low, and within
a severity by Confidence then Effort ascending.>

## Risk Assessment

| Risk | Likelihood | Blast radius | Existing mitigation | Residual |
|---|---|---|---|---|
| <what could go wrong> | high/med/low | <what breaks> | <guard that exists, or "none"> | high/med/low |

<Then 2–3 sentences on the module's overall risk posture: what would you not want to change
here without a test, and why.>

## Priority Fixes

<Ordered list, most consequential first. Each line: `<ID> — <title>` · Effort · one clause
on why it is first. Only Severity ≥ High, or Medium with wide blast radius. Max 7.>

## Quick Wins

<Per the Quick Win definition in `_shared/issue-format.md`. `<ID>` · Effort · one clause.
If none qualify, write "None — the cheap issues here are cosmetic (see Low findings)".>

## Long-term Improvements

<Structural changes worth doing but not now: L/XL effort, or blocked on a decision. Each
with the condition that should trigger it ("when a third consumer appears", "before the
next migration").>

## Files Reviewed

| File | Lines | Depth |
|---|---|---|
| `path` | 210 | full / skimmed / entry-points only |

## Files Remaining

<Untouched files with the reason (budget, out of lens, generated, vendored) and a suggested
sub-split if the module should be broken up. Write "None" if coverage is complete.>

## Cross-module notes

<Max 5 bullets. Things that belong to another module or to the architecture lens. Each must
say which module it should be routed to.>

## Appendix: Needs Verification

<Low-confidence suspicions, with the exact check that would confirm or kill each one. These
are not findings and must never appear in Priority Fixes.>
```

---

## B. Digest (returned as the final message, ≤40 lines)

```markdown
DIGEST <lens> <module.path> · coverage <N>/<M> files · <complete|partial>
VERDICT <healthy|acceptable with debt|fragile|needs rework>
SUMMARY <two sentences, max>
REPORT .claude-audit/reports/<module-slug>.<lens>.md

| ID | Sev | Conf | Title | Location | Eff | Impact |
|---|---|---|---|---|---|---|
| REACT-…-001 | High | High | Effect refetches on every render | ShopScreen.jsx:88 | S | correctness |

STRENGTHS <one line each, max 3>
THEMES <one line each, max 3 — the patterns behind the findings>
ROUTE <findings that belong to another module/lens: "ARCH: models/ has no boundary" — max 3>
REMAINING <files/sub-modules not covered, or "none">
```

Hard rules for the digest:

- Every row must exist as a full finding in the report. No row without a report entry.
- No code snippets, no file contents, no prose paragraphs. The digest is an index.
- If there are zero findings, still return the digest with an empty table and say what you
  checked in `SUMMARY` — a clean module is a result, not a non-answer.
