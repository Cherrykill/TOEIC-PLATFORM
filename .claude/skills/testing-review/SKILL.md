---
name: testing-review
description: Reviews testing for ONE module (or the repo-wide test strategy) — strategy, missing tests, edge cases, integration vs. unit balance, test readability and maintainability. Use when auditing what the test suite actually protects and where the gaps are. Invoked by project-auditor; also usable standalone on a module or on the test directory.
allowed-tools: Read, Write, Glob, Grep, Bash
---

# testing-review

## Purpose

Answer one question precisely: **if someone changed this module carelessly, would anything
fail?** Coverage percentage does not answer it; a test that asserts a mock was called does not
either. This lens maps behaviours to tests and reports the unprotected ones, ranked by what
breaking them would cost.

The most valuable finding is a missing test on a high-consequence, high-churn path — not the
absence of tests in general.

## Activation examples

- "Review our testing strategy"
- "What's untested in the economy service?"
- "Are these tests any good?"
- "What edge cases are we missing?"
- Dispatched by `project-auditor` for kinds: backend services/controllers, frontend state,
  queues, utils, tests directory, and the repo-wide `test-strategy` pass.

## Required reading

`_shared/review-protocol.md` · `_shared/issue-format.md` · `_shared/report-format.md`.

## Inputs

`module.slug`, `module.path(s)`, `module.files`, test runner(s) and config, where tests live
(co-located or a test dir), whether tests can be run here, declared testing rules (e.g. "new
logic requires a test").

## Workflow

1. **Find the tests that cover this module.** Both conventions:

   ```bash
   git ls-files | rg "(?:test|spec)\.[jt]sx?$|__tests__"
   rg -l "require\(.*<module-name>|from '.*<module-name>" $(git ls-files | rg "test\.[jt]sx?$" | tr '\n' ' ') 2>/dev/null
   ```

   A module with tests elsewhere is covered; a module whose name appears in no test file is
   not. State which.

2. **Run them if you can** — cheapest possible evidence:

   ```bash
   npm test --prefix backend -- --testPathPattern=<pattern> 2>&1 | tail -30
   npx vitest run <path> 2>&1 | tail -30
   ```

   Record: pass/fail, duration, and any test that is skipped or silently passing. If running is
   not possible (needs a DB, a service, credentials), say so — that inability is itself a
   finding about the suite's usability.

3. **Enumerate the behaviours worth protecting.** From the module's code, list its meaningful
   behaviours: each public function's contract, each branch that changes an outcome, each
   invariant, each error path. Rank them by consequence — money/score/auth/data-integrity
   first. This list is the yardstick; without it, "missing tests" is a guess.

4. **Map behaviours to tests.** A table: behaviour → test that covers it → verdict
   (`covered` / `partially` / `not covered`). Read the tests to fill it; a test whose name
   mentions the behaviour but whose assertions do not check it counts as `partially` — and that
   discrepancy is itself a finding (a false sense of safety is worse than a known gap).

5. **Judge test quality**, not just presence:
   - **Assertion strength:** does it assert the outcome, or only that nothing threw / that a
     mock was called? `expect(fn).toHaveBeenCalled()` on the thing under test proves nothing
     about correctness.
   - **Over-mocking:** if every collaborator is mocked, the test verifies the implementation's
     shape, not its behaviour, and will break on refactor while missing real bugs.
   - **Tautology:** the test recomputes the expected value with the same logic as the code.
   - **Coupling to internals:** asserting private state or call order where the contract does
     not require it.
   - **Determinism:** real timers, real clocks (`Date.now()` without control), random data,
     network, shared mutable fixtures, order dependence between tests.
   - **Isolation:** does each test set up and tear down its own state?

6. **Edge-case sweep** — for each covered behaviour, check whether the *interesting* inputs are
   there, not just the happy path: empty / one / many; zero, negative, fractional, huge,
   `NaN`; `null`/`undefined`/missing field; duplicate and concurrent calls (double submit,
   replay); boundaries (first/last, exactly-at-threshold — the classic level-up-at-exactly-N
   case); expiry and clock-skew for anything time-based; idempotency for anything that grants a
   reward. List the specific missing cases, not "more edge cases needed".

7. **Strategy assessment** (repo-wide pass, or the strategy part of a module review): the shape
   of the pyramid, what layer is missing entirely (usually integration), whether the fast suite
   can run on every commit, whether critical paths have any end-to-end protection, whether the
   project's own declared rule ("logic changes require tests") is actually followed — check the
   recent commits:

   ```bash
   git log --oneline -20 --name-only | rg -c "test\.[jt]s" 
   ```

8. **Verification pass** (protocol §5) — before claiming a behaviour is untested, grep the test
   files for it once more (including tests in another directory or another workspace). Then
   write the report and return the digest.

## Review checklist

**Testing strategy**
- [ ] The suite's purpose is discernible: what class of bug is it meant to catch?
- [ ] Unit / integration / e2e balance matches the risk profile
- [ ] Fast suite runnable locally without external services
- [ ] Critical paths (auth, money, scoring, data migration) have deliberate coverage
- [ ] The project's declared testing rule is actually followed in recent commits

**Missing tests**
- [ ] Every high-consequence behaviour is mapped to a test or reported as a gap
- [ ] Every error path has at least one test
- [ ] Invariants (server-authoritative values, level↔XP consistency, uniqueness) are asserted
- [ ] Bug fixes have regression tests (check recent fix commits)
- [ ] High-churn files are not the least-tested files (cross-check churn vs. coverage)

**Edge cases**
- [ ] Empty / single / large collections
- [ ] Zero, negative, fractional, oversized, `NaN` numbers
- [ ] Missing/null/undefined inputs
- [ ] Boundary values, exactly-at-threshold
- [ ] Duplicate/concurrent/replayed operations; idempotency
- [ ] Time: expiry, timezone, clock skew, DST where relevant
- [ ] Failure of a dependency (DB down, API 500, timeout)

**Integration tests**
- [ ] Real seams exercised (route → controller → service → data) at least on critical paths
- [ ] Contracts between modules tested where a mock would hide drift
- [ ] Setup/teardown does not leak state between tests

**Unit tests**
- [ ] Pure logic tested directly, without a DB or a server
- [ ] One behaviour per test; failure name identifies the behaviour
- [ ] Minimal, meaningful mocking

**Test readability**
- [ ] Names state the behaviour and the condition ("levels up at exactly the threshold")
- [ ] Arrange/act/assert visible at a glance
- [ ] Fixtures are minimal and local; no giant shared blobs
- [ ] Assertions are specific: the value, not just truthiness

**Test maintainability**
- [ ] Tests do not break on harmless refactors (no internal coupling)
- [ ] No duplicated setup that could be a factory/builder
- [ ] Deterministic: controlled clocks, seeded randomness, no network
- [ ] Fast enough to run constantly; slow tests separated

## Best practices

- **Rank gaps by consequence × churn.** An untested money path that changes weekly is High.
  An untested formatting helper is Low. Say which.
- **Report the specific missing case.** "No test for `quantity = -1` on purchase, which the
  schema allows" is actionable; "insufficient edge-case coverage" is not.
- **A weak test is a finding.** Especially a passing test that asserts nothing meaningful about
  the behaviour it names — it converts a known gap into a hidden one.
- **Use the existing tests as the style reference.** Propose new tests in the project's shape
  (same runner, same fixture style, same language for names) so they are trivial to accept.
- **Prefer one integration test over ten mocked units** on a path whose bugs live in the seams,
  and say why.
- **Never propose a coverage percentage target.** Propose specific tests for specific
  behaviours.

## Anti-patterns

- ❌ "Coverage is only 34%, raise it to 80%"
- ❌ "Add tests for everything" with no priority ordering
- ❌ Demanding tests for trivial getters or presentational markup
- ❌ Recommending a different test framework
- ❌ Claiming something is untested without grepping the whole test surface
- ❌ Counting a test file's existence as coverage without reading its assertions
- ❌ Proposing e2e infrastructure as a Now item for a project with none (that is Later, with a
  trigger)

## Output template

Per `_shared/report-format.md`, plus this section before `Findings`:

```markdown
## Coverage Map

- **Tests found:** <files> · **Run:** <pass/fail, duration, or why not run>
- **Runner:** <jest/vitest, config path>

| Behaviour (ranked by consequence) | Test | Verdict |
|---|---|---|
| Purchase rejects insufficient coins | `shopEffects.test.js:44` | covered |
| Purchase rejects negative quantity | — | **not covered** (schema allows it) |
| Level-up at exactly the threshold | `levelUp.test.js:22` | covered |
| Boost expiry mid-session | `shopEffects.test.js:88` | partially — asserts flag, not the multiplier |

- **Churn vs. coverage:** <files changed most in 6 months and their test status>
- **Weak tests:** <test — what it fails to assert>
```

Digest example:

```
DIGEST testing backend.services.economy · coverage 7/7 source + 2 test files · complete
VERDICT fragile
SUMMARY Pure effect logic is well tested at the unit level, but no test covers the purchase
endpoint's guards: negative quantity, insufficient funds via a replayed request, or a client
supplying a price. The boost-expiry test asserts the flag flips but not the multiplier applied.
REPORT .claude-audit/reports/backend.services.economy.testing.md

| ID | Sev | Conf | Title | Location | Eff | Impact |
|---|---|---|---|---|---|---|
| TEST-backend.services.economy-001 | High | High | No test for negative/fractional quantity on purchase, which the schema permits | controllers/shopController.js:61 | M | correctness |
| TEST-backend.services.economy-002 | High | Medium | No idempotency test; a replayed purchase request is unprotected and unverified | controllers/shopController.js:44 | M | correctness |
| TEST-backend.services.economy-003 | Medium | High | Boost expiry test asserts the flag, not the multiplier it controls | tests/shopEffects.test.js:88 | S | correctness |

STRENGTHS applyShopEffect is pure and tested per branch, so effect logic is genuinely protected (tests/shopEffects.test.js:12-80)
THEMES Unit coverage is good where logic is pure; every guard at the HTTP boundary is untested
ROUTE security: the same guards are the ones flagged as missing validation
REMAINING none
```

## Directory structure

```
.claude/skills/testing-review/
└── SKILL.md
```
