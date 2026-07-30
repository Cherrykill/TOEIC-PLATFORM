# Issue Format — the only accepted shape for a finding

## Template

```markdown
### <ID> — <Title: the defect in one clause, no rationale>

- **Severity:** Critical | High | Medium | Low
- **Confidence:** High | Medium | Low
- **Location:** `path/to/file.ext:120-134`
- **Effort:** S | M | L | XL
- **Impact:** correctness | security | performance | maintainability | dev-velocity | UX | cost

**Evidence**

```<lang>
// path/to/file.ext:120-134  (verbatim, ≤10 lines)
<snippet>
```

Verified by: <read the code / traced N callers / ran `cmd` / grep `pattern` → N hits>

**Why it matters**

<Concrete failure or cost. Name the trigger: which input, which state, which scale, which
future change. "Harder to maintain" alone is not a reason — say what breaks and for whom.>

**Suggested improvement**

<What to do, specific enough to start. Reference the existing pattern in this codebase that
should be followed. If there is a trade-off, name it in one clause.>

**Potential impact of fixing**

<What improves and what could regress. Blast radius: which files/behaviours are touched.>
```

## ID scheme

`<LENS>-<module-slug>-<NNN>` — e.g. `REACT-frontend.components.shop-003`, `SEC-backend.routes.auth-001`.

Lens prefixes — universal: `ARCH` `CSS` `PERF` `SEC` `API` `NAME` `DEBT` `TEST`.
Framework-gated: `REACT` `EXPRESS` `VUE` `NEXT` `NEST` (only when that framework is detected —
see `project-auditor/references/stack-detection.md`).
Numbering restarts per (lens, module). IDs must be stable across re-runs where the finding
is the same — quote the old ID if you are re-reporting.

## Severity rubric (pick by consequence, not by effort)

| Severity | Bar |
|---|---|
| **Critical** | Exploitable now, or destroys/corrupts data, or silently produces wrong results in a money/score/auth path, or takes production down. Ship-blocker. |
| **High** | A real defect reachable with plausible input or state; auth/authz gap that needs a condition to trigger; a performance cliff real users hit; an architectural violation that will force a subsystem rewrite. |
| **Medium** | Wrong in edge cases; a maintainability cost paid repeatedly (hours, not minutes); an inconsistency that will mislead the next reader into a bug; missing test on non-trivial logic. |
| **Low** | Cosmetic, naming, dead code, small duplication, doc gaps. Real but cheap to live with. |

Anti-inflation rules:
- "Could theoretically" without a reachable path → **not** Critical/High.
- Style disagreement → Low, or not a finding at all.
- One systemic problem is **one** finding with N locations listed, not N findings.

## Confidence rubric

| Confidence | Bar |
|---|---|
| **High** | You read the relevant code end-to-end and traced the callers, or you ran something that demonstrates it. You can state the exact triggering input/state. |
| **Medium** | You read the code and the logic implies the defect, but an unread caller, guard, or config could prevent it. |
| **Low** | Pattern match / smell. Needs runtime or wider verification. **Goes to `Appendix: Needs Verification`, not `Findings`.** |

## Effort

| Code | Meaning |
|---|---|
| **S** | ≤ 1 hour, local, no coordination. |
| **M** | ≤ 1 day, one module, may need a test. |
| **L** | 1–3 days, touches several modules or needs a migration/backfill. |
| **XL** | > 3 days, needs its own design doc; the finding should say so rather than pretend it is actionable. |

## Impact

Pick the primary axis, then one sentence. Include a scale qualifier when relevant
("on every keystroke", "per request", "once at boot", "only for admins", "N=40k docs").

## Quick Win definition (used by the report)

Effort ∈ {S, M} **and** Severity ≥ Medium **and** Confidence ≥ Medium **and** blast radius
is local (no migration, no cross-module contract change). Everything else is a priority fix
or a long-term improvement — do not pad the quick-win list.