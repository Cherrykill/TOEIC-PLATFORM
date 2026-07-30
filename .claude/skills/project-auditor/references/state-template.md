# `.claude-audit/state.md` — schema

The resume point and the findings ledger. **Update after every module.** If the conversation
is compacted or lost, this file plus `reports/` is the entire audit.

```markdown
# Audit State

- **Repo:** <name> · commit `<sha>` (record drift if HEAD moves mid-audit)
- **Started:** <YYYY-MM-DD HH:MM> · **Updated:** <YYYY-MM-DD HH:MM>
- **Mode:** subagent | inline
- **Report language:** English | Vietnamese
- **Scope:** whole repo | <path(s)>
- **Progress:** <done>/<total> modules · <files read>/<tracked files>

## Queue

| # | Module | Lenses | Status | Report(s) | Note |
|---|---|---|---|---|---|
| 1 | repo | architecture | done | `repo.architecture.md` | re-split be.models per ARCH-repo-002 |
| 2 | secrets-deps | security | done | `secrets-deps.security.md` | 1 Critical |
| 3 | be.auth | security, api, testing | in-progress | — | security done, api pending |
| 4 | be.economy | security, architecture, testing | pending | — | |

Status ∈ `pending` · `in-progress` · `done` · `clean` (done, zero findings) ·
`degraded` (review failed, reason in Note) · `deferred` (with reason) · `not-reviewed`.

## Findings ledger

Append digest rows verbatim. This table is the **only** input to the merge step.

| ID | Lens | Module | Sev | Conf | Title | Location | Eff | Impact |
|---|---|---|---|---|---|---|---|---|
| SEC-secrets-deps-001 | security | secrets-deps | Critical | High | Live JWT secret committed in .env.example | .env.example:12 | S | security |
| ARCH-repo-002 | architecture | repo | High | High | models/ has no domain boundary; 41 flat files | backend/models:1 | L | maintainability |

## Systemic candidates

Defect shapes seen in ≥2 modules so far. Promote at merge when the count reaches 3.

| Shape | Modules | Instances | Max sev |
|---|---|---|---|
| controller returns res.status(500) in catch instead of next(err) | be.toeic-scoring, be.gamification | 6 | Medium |

## Not reviewed

| Path | Reason |
|---|---|
| `backend/public/admin/vendor/**` | vendored dependency |
| `frontend/public/assets/**` | binary media |

## Decisions log

Ordering changes, re-splits, scope changes — with the reason. Keeps a resumed run from
undoing a deliberate choice.

- `<date>` Split `be.models` into user/economy/toeic clusters after ARCH-repo-002.
- `<date>` Deferred `be.scripts` — user scoped the audit to runtime code.
```
