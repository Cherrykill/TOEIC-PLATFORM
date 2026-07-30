---
name: technical-debt-review
description: Reviews accumulated debt in ONE module — duplicated logic, dead code, TODOs, commented-out code, magic values, over-engineering, under-engineering, unnecessary abstractions and code smells. Use when auditing maintainability cost and cleanup opportunities. Invoked by project-auditor; also usable standalone on a directory.
allowed-tools: Read, Write, Glob, Grep, Bash
---

# technical-debt-review

## Purpose

Quantify what this module costs to keep. Debt is not "code I would have written differently" —
it is code that **makes the next change slower or riskier**. Every finding must name that
cost: how many places a single conceptual change must touch, what a reader must know that is
not written down, what is unreachable but still maintained.

The most valuable output of this lens is usually one number: *a change to X requires edits in
N files*. Everything else is supporting detail.

## Activation examples

- "Where's the technical debt in this module?"
- "Find duplicated logic / dead code here"
- "Is this over-engineered?"
- "Clean-up opportunities in `backend/utils`"
- Dispatched by `project-auditor` for nearly every module kind; usually paired with naming.

## Required reading

`_shared/review-protocol.md` · `_shared/issue-format.md` · `_shared/report-format.md`.

## Inputs

`module.slug`, `module.path(s)`, `module.files`, declared conventions (including any documented
"do not refactor" constraints), and whether the project is in a stability-first phase.

## Workflow

1. **Cheap signals first.**

   ```bash
   rg -n "TODO|FIXME|HACK|XXX|WORKAROUND|TEMP|LEGACY|DEPRECATED|@ts-ignore|eslint-disable" <module-path>
   git log --format= --name-only --since=6.months -- <module-path> | sort | uniq -c | sort -rn | head -15
   git ls-files <module-path> | xargs wc -l | sort -rn | head -15
   ```

   For each marker: how old is it (`git log -S` or blame the line), does the condition still
   hold, is it a note or an unfinished feature? A three-year-old `TODO: fix before launch` is a
   finding; a `TODO: revisit if we add a third provider` is documentation. Distinguish them —
   reporting all markers as debt is noise.

2. **Duplicated logic.** Find repetition of *decisions*, not of syntax. Highest-value targets:
   the same validation in several handlers, the same derived calculation in several components,
   the same magic constant in several files, sibling implementations (N modes, N tabs, N item
   types) that each re-implement one pipeline.

   ```bash
   rg -o "\b[A-Z_]{4,}\b" <module-path> --no-filename | sort | uniq -c | sort -rn | head -20
   rg -n "\b\d{3,}\b" <module-path> | head -40         # magic numbers worth a name
   ```

   For each duplication: count the copies, cite 3–5 locations, and state the cost — "changing
   the energy cost formula requires editing 4 files; two already disagree (`a:31` says 5,
   `b:88` says 3)". Divergence between copies is the proof that duplication is expensive here,
   and it is often a live bug — raise the severity when you find it.

3. **Dead code.** Candidates: exported symbols with no importer, unreferenced files, unreachable
   branches, feature flags permanently on/off, commented-out blocks, and code for a removed
   feature.

   ```bash
   rg -o "^(?:module\.)?exports?(?:\.(\w+))?" <module-path> --no-filename   # then grep each symbol repo-wide
   rg -n "^\s*//\s*(?:const|let|function|if|return|await|res\.|await )" <module-path>  # commented-out code
   ```

   **Verify before reporting**: search the whole repo, including dynamic access
   (`obj[name]`, string-built keys, route registration by convention, `window.X` in a
   script-tag world, seed/migration scripts, and tests). Dynamically referenced code that looks
   dead is the single biggest false-positive source in this lens. State how you verified.

4. **Magic values.** Numbers and strings with domain meaning and no name: prices, XP, energy
   costs, timeouts, limits, level thresholds, status strings, collection names. Prioritize
   those that (a) appear more than once, (b) must agree with a value elsewhere (client/server,
   DB/code, CSS/JS), or (c) live on a money/score path. A magic value duplicated across a
   client/server boundary that must stay in sync is a correctness finding, not a style one.

5. **Over-engineering.** Abstractions with one consumer; configuration nobody configures;
   indirection layers that only forward calls; generic machinery for a single concrete case;
   premature extensibility (a strategy pattern with one strategy); wrapper classes around a
   library that expose the library anyway. Cost: every reader pays the indirection tax.
   Evidence: the call-site count.

6. **Under-engineering.** The inverse, and often more expensive: copy-paste instead of a
   parameter; 300-line functions with 5 concerns; a switch repeated in four places that should
   be a table; state machines expressed as interacting booleans (count them —
   `isLoading`/`isReady`/`hasError`/`isDone` in one component is a state machine wearing a
   disguise); string-keyed conditionals that should be a map; missing error path entirely.

7. **Code smells** with a real cost: long parameter lists (especially same-type parameters that
   can be swapped silently), boolean flag parameters that change behaviour, deep nesting,
   functions with multiple return shapes, mutation of shared objects, silent `catch {}`, action
   at a distance via module-level mutable state, and load-order dependencies.

8. **Score the module.** Give a short maintainability read: what would slow down the next
   feature here, what a newcomer would misread first, and what you would fix before touching
   anything else.

9. **Verification pass** (protocol §5) — for every "dead" or "duplicated" claim, re-run the
   repo-wide check and record it. Then write the report and return the digest.

## Review checklist

**Duplicated logic**
- [ ] Same rule/decision implemented in >1 place — counted, with copies compared for divergence
- [ ] Constants duplicated across files or across the client/server boundary
- [ ] Sibling implementations re-implementing one pipeline
- [ ] Copy-paste with a subtle difference (the dangerous kind — say whether it is intentional)

**Dead code**
- [ ] Unreferenced exports/files, verified repo-wide including dynamic access
- [ ] Unreachable branches; permanently fixed flags
- [ ] Code for removed features; orphaned migrations/scripts
- [ ] Deleted-elsewhere API still called (or vice versa)

**TODOs**
- [ ] Each triaged: still relevant? has an owner/condition? actually a note?
- [ ] Old markers on shipped features flagged
- [ ] `eslint-disable`/`@ts-ignore` justified in a comment, or a finding

**Commented code**
- [ ] Commented-out blocks removed (git is the history)
- [ ] Comments that describe an older behaviour than the code
- [ ] Comments compensating for a bad name or a confusing structure

**Magic values**
- [ ] Domain numbers/strings named and centralized
- [ ] Cross-boundary values have one source of truth
- [ ] Config-worthy values are configurable if the project has a config mechanism
- [ ] No value repeated with a variant spelling ('boost' vs 'BOOST')

**Over-engineering**
- [ ] Every abstraction has ≥2 real consumers
- [ ] No pass-through layers
- [ ] No unused configuration/extension points
- [ ] No pattern applied for its own sake

**Under-engineering**
- [ ] No function doing >2 unrelated things
- [ ] No repeated switch/if-chain that should be data
- [ ] No implicit state machine built from booleans
- [ ] Error paths exist and are handled

**Unnecessary abstractions**
- [ ] Indirection earns its cost; a reader does not chase 3 files to find the logic
- [ ] Wrappers add something (a guarantee, a default, a boundary), not just a signature

**Code smells**
- [ ] Parameter lists short and type-distinct
- [ ] No behaviour-changing boolean flags
- [ ] Nesting ≤3 in normal code
- [ ] No silent empty catch
- [ ] No module-level mutable state acting at a distance
- [ ] No load-order dependency without a comment saying so

## Best practices

- **State the cost, always.** "N places to change / two already disagree / a reader must know
  X" is the finding. "This is duplicated" is half of one.
- **Divergent duplicates outrank identical ones.** Identical copies are cleanup; diverged
  copies are a live bug — check every set of copies for disagreement.
- **Verify dead code twice**, including dynamic and script-tag references, and say how.
- **Both directions matter.** Report over-engineering with its call-site count and
  under-engineering with its duplication count; do not lean on only one.
- **Respect a documented stability constraint.** If the project says "no large refactors",
  keep the finding, set effort honestly, and put restructuring in Long-term Improvements with a
  trigger. Do not soften the evidence — just be right about the timing.
- **Cluster into ≤10 findings.** Debt reports that list everything get read by nobody.

## Anti-patterns

- ❌ Every TODO as a finding
- ❌ "Dead code" that a script, test, or dynamic key references
- ❌ Extracting a helper for two 3-line similar blocks (that is churn, not debt reduction)
- ❌ "Add an abstraction layer" for a single concrete case
- ❌ Reporting duplication between a test and the code under test
- ❌ Recommending a rewrite as a debt fix
- ❌ Counting generated, vendored, or seed-data files as debt

## Output template

Per `_shared/report-format.md`, plus this section before `Findings`:

```markdown
## Debt Inventory

| Kind | Count | Worst instance | Cost |
|---|---|---|---|
| Duplicated logic | 4 clusters | energy-cost formula in 4 files, 2 disagree | change = 4 edits + a live inconsistency |
| Dead code | 3 exports, 1 file | `utils/oldEnricher.js` (no importer, verified repo-wide) | maintained for nothing |
| Markers | 11 TODO, 2 FIXME | `FIXME: race on double submit` (14 months old) | one is an unshipped fix |
| Magic values | 23 numbers, 9 strings | XP thresholds in 3 files | must stay in sync manually |
| Over-engineering | 2 | `BaseModeRunner` with 1 subclass | indirection with no payoff |
| Under-engineering | 3 | 4 booleans encoding one runner state | invalid states representable |

**Maintainability read:** <2–3 sentences: what slows the next change here, what a newcomer
misreads first, what to fix before anything else.>
```

Digest example:

```
DIGEST technical-debt frontend.components.practice · coverage 22/27 files · partial
VERDICT acceptable with debt
SUMMARY 16 practice modes each re-implement the same answer-check + scoring pipeline, and three
copies have already diverged on how a near-miss answer is scored. One abstraction (BaseMode)
exists with a single user.
REPORT .claude-audit/reports/frontend.components.practice.technical-debt.md

| ID | Sev | Conf | Title | Location | Eff | Impact |
|---|---|---|---|---|---|---|
| DEBT-frontend.components.practice-001 | High | High | Scoring pipeline duplicated across 16 modes; 3 copies disagree on near-miss scoring | modes/Dictation.jsx:88 (+15) | L | correctness |
| DEBT-frontend.components.practice-002 | Medium | High | Runner state encoded in 4 independent booleans; invalid combinations reachable | PracticeRunner.jsx:40-58 | M | correctness |
| DEBT-frontend.components.practice-003 | Low | High | BaseMode abstraction has exactly one consumer | modes/BaseMode.jsx:1 | S | maintainability |

STRENGTHS Each mode is self-contained, so adding one cannot break the others (modes/*.jsx)
THEMES Isolation was bought with duplication; the shared pipeline was never extracted
ROUTE react: the boolean state cluster also causes an extra render per answer
REMAINING 5 mode files — sub-module `fe.practice.modes.b`
```

## Directory structure

```
.claude/skills/technical-debt-review/
└── SKILL.md
```
