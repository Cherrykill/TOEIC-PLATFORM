---
name: naming-review
description: Reviews naming in ONE module — file names, variable names, function names, component names, hook names, consistency, readability and domain terminology. Use when auditing whether names communicate intent and follow one convention. Invoked by project-auditor; also usable standalone on a directory.
allowed-tools: Read, Write, Glob, Grep, Bash
---

# naming-review

## Purpose

Names are the codebase's documentation. This lens finds the ones that lie, the ones that force
a reader into the implementation, and the places where two names mean one thing (or one name
means two). The cost of bad naming is paid by every future reader — including the next
misreading that becomes a bug.

This lens is the easiest one to fill with noise. The bar: a name is a finding when it
**misleads**, **hides** something, or **breaks a convention the codebase already keeps**.
Personal preference is not a finding.

## Activation examples

- "Review naming in `backend/services`"
- "Are our component/hook names consistent?"
- "Does the code use our domain terminology correctly?"
- Dispatched by `project-auditor` for kinds: most module kinds, usually paired with
  technical-debt.

## Required reading

`_shared/review-protocol.md` · `_shared/issue-format.md` · `_shared/report-format.md`.

## Inputs

`module.slug`, `module.path(s)`, `module.files`, declared naming conventions, the project's
domain vocabulary (from the README/docs/models), the language of comments and identifiers.

## Workflow

1. **Extract the conventions actually in force.** Do not import conventions from elsewhere —
   derive them by counting:

   ```bash
   git ls-files <module-path> | xargs -n1 basename | sort          # file-name casing patterns
   rg -o "^(?:export )?(?:async )?function \w+" <module-path> --no-filename | sort
   rg -o "^(?:export )?const \w+" <module-path> --no-filename | sort
   rg -o "\buse[A-Z]\w+" <module-path> --no-filename | sort -u     # hooks
   ```

   Write down the majority pattern per category (files, functions, components, hooks,
   constants, booleans, handlers). **The majority is the standard**; the minority are the
   findings — unless the minority is objectively better, in which case say so and recommend
   the migration direction explicitly.

2. **Build the domain glossary.** From models, docs, and the product's language, list the terms
   this module should use. Then find the synonyms and near-misses in code: `test` vs. `exam`
   vs. `attempt`, `word` vs. `vocab` vs. `term`, `item` vs. `product`, `user` vs. `account`
   vs. `profile`. Where two names refer to the same concept, or one name refers to two,
   quantify it (`rg -c`) — this is usually the highest-value finding of the lens because it
   causes real misreadings at boundaries.

3. **Check names against behaviour** — the only way to find lying names. Read the
   implementation and ask whether the name still describes it:
   - `get*` that mutates or writes; `validate*` that also saves; `is*`/`has*` that returns a
     non-boolean; `handle*` that is not an event handler
   - a function whose name mentions one thing and whose body does two (the name is honest, the
     function is not — route it to technical-debt)
   - a name whose scope has drifted (`updateUser` now also grants rewards)
   - stale names after a refactor (`ShopItem` used for the whole catalog; `uploadRoutes.js`
     when the convention is `<domain>.js`)
   - negated booleans (`isNotDisabled`) and double negatives at call sites

4. **Readability sweep.** Single letters outside tiny scopes (`i`, `x` in a 40-line function),
   ambiguous abbreviations (`cfg`, `tmp`, `res` for something that is not a response, `q`,
   `d`), numeric suffixes (`data2`, `handleClick2`), meaningless nouns (`manager`, `helper`,
   `utils`, `data`, `info`, `stuff`) where a real name exists, and names that require reading
   the body to know their unit (`timeout` in ms or s? `size` in bytes or items? `price` in
   coins or gems?). Unit-less numeric names are a genuine correctness risk — rank them above
   cosmetic naming.

5. **Structural naming.** File name vs. its main export; directory names vs. their contents;
   component file/component mismatch; hook files not named after the hook; test file naming;
   plural/singular consistency on collections and modules.

6. **Aggregate ruthlessly.** All instances of one pattern = one finding with a count and 3–5
   representative locations. A naming report with 30 individual entries will be ignored, and
   deserves to be.

7. **Verification pass** (protocol §5) — confirm each cited name still exists at that line, and
   that the "convention violation" really is a minority pattern (count both sides). Then write
   the report and return the digest.

## Review checklist

**File names**
- [ ] One casing convention per category, matching the majority
- [ ] File name matches its primary export
- [ ] Suffixes used consistently (`*Controller.js`, `*.test.js`, `use*.js`)
- [ ] No leftover names from a previous design (`*New`, `*Old`, `*2`, `*Copy`)
- [ ] Directory names describe contents, not history

**Variable names**
- [ ] Length matches scope (short names only in short scopes)
- [ ] Units and currency in the name where ambiguous (`timeoutMs`, `priceCoins`, `sizeBytes`)
- [ ] Booleans read as predicates and are not negated
- [ ] Collections are plural; single items singular
- [ ] No shadowing of an outer name with a different meaning

**Function names**
- [ ] Verb-first and truthful about side effects (`get` does not write)
- [ ] Name covers everything the function does — or the function does too much
- [ ] Symmetric pairs are symmetric (`open`/`close`, not `open`/`dismiss`)
- [ ] Async functions do not pretend to be synchronous accessors

**Component names**
- [ ] PascalCase; noun or noun-phrase
- [ ] Named for role, not for its current location or styling
- [ ] File, component, and default export agree
- [ ] Distinguishable siblings (not `Card`, `Card2`, `CardNew`)

**Hook names**
- [ ] `use` prefix, always; nothing non-hook uses the prefix
- [ ] Named for what they provide, not how (`useCountdown`, not `useEffectWrapper`)
- [ ] Return values named consistently across hooks

**Consistency**
- [ ] One term per concept across the module and its boundary
- [ ] Same parameter order and names for similar functions
- [ ] Event handlers follow one pattern (`onX` prop / `handleX` implementation)
- [ ] Constants and enums follow one casing and are grouped

**Readability**
- [ ] A reader can predict what a function does from its signature
- [ ] No name that requires reading the body to interpret
- [ ] Comments are not compensating for a bad name (fix the name)

**Domain terminology**
- [ ] Code vocabulary matches the product/domain vocabulary
- [ ] No synonyms for one concept; no one word for two concepts
- [ ] Domain terms are not shortened into ambiguity
- [ ] Language of identifiers is consistent (mixed-language identifiers are a finding; mixed
      language between code and comments may be the project's deliberate convention — check
      before reporting)

## Best practices

- **Count both sides of every convention claim.** "14 files use `<domain>.js`, 2 use
  `<domain>Routes.js`" is evidence; "inconsistent naming" is not.
- **Rank by cost of misreading.** A misleading name on a money path outranks twenty short
  variable names in a loop. Unit-less numbers and lying verbs are the top of this lens.
- **Prefer the codebase's word over the industry's word.** If the domain says "màn hỏi" /
  "question set", use it; do not standardize a project onto your own vocabulary.
- **Recommend a direction, not a debate.** Say which of the two competing patterns wins and
  why (majority, documented, or clearer), so the fix is mechanical.
- **Respect declared conventions and their exceptions.** A convention documented as
  "new code only, do not mass-migrate" means the finding is about new code — say so, and set
  effort accordingly.

## Anti-patterns

- ❌ 25 separate findings for the same pattern
- ❌ Renaming proposals across a public API surface without noting the breaking-change cost
- ❌ Enforcing English identifiers on a project that documents another language
- ❌ Style preferences dressed as defects (`arr` vs. `items`, `idx` vs. `i`)
- ❌ Anything above Medium severity without a demonstrated misreading risk (a wrong-unit
  argument, a `get` that writes, two concepts sharing a name at a boundary)
- ❌ Proposing a mass rename in a codebase whose stated priority is stability

## Output template

Per `_shared/report-format.md`, plus this section before `Findings`:

```markdown
## Convention Census

| Category | Majority pattern | Count | Deviations | Locations |
|---|---|---|---|---|
| Route files | `<domain>.js` | 26 | 2 | `uploadRoutes.js`, `userState.js` |
| Controllers | `<domain>Controller.js` | 27 | 0 | — |
| Hooks | `use<Noun>` | 7 | 1 | `useToeicRunnerEffectHandler.js` |
| Booleans | `is*`/`has*` | 34 | 5 | `disabled`, `notReady`, … |

## Domain Glossary

| Concept | Terms in use | Canonical | Boundary risk |
|---|---|---|---|
| a TOEIC exam | `test`, `exam`, `attempt` | `test` (model name) | `attempt` also means a user's run — two concepts, overlapping words |
```

Digest example:

```
DIGEST naming backend.routes · coverage 26/26 files · complete
VERDICT acceptable with debt
SUMMARY Route and controller naming follows the documented convention in 26 of 28 files. The
real risk is vocabulary: `test` and `attempt` are used for both the exam definition and a
user's run, in the same handlers.
REPORT .claude-audit/reports/backend.routes.naming.md

| ID | Sev | Conf | Title | Location | Eff | Impact |
|---|---|---|---|---|---|---|
| NAME-backend.routes-001 | Medium | High | `test`/`attempt` each denote two concepts in the same handlers | routes/toeic.js:44 (+6) | M | correctness |
| NAME-backend.routes-002 | Low | High | 2 route files break the documented `<domain>.js` convention | routes/uploadRoutes.js:1 (+1) | S | maintainability |
| NAME-backend.routes-003 | Low | High | 5 boolean params lack is/has and 2 are negated | routes/practice.js:31 (+6) | S | readability |

STRENGTHS Controller naming is 27/27 consistent, so locating a handler from a route is mechanical
THEMES Structural naming is disciplined; domain vocabulary is not
ROUTE architecture: the test/attempt overlap mirrors a model boundary that is also blurred
REMAINING none
```

## Directory structure

```
.claude/skills/naming-review/
└── SKILL.md
```
