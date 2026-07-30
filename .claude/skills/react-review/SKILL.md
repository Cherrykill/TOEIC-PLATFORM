---
name: react-review
description: Reviews React code in ONE module — component design, hooks usage, state management, props design, composition, rendering behaviour, memoization, context usage, effect dependencies, unnecessary re-renders and React best practices. Framework-gated: only for codebases where React is detected. Use when auditing React components, hooks or context providers. Invoked by project-auditor; also usable standalone on a single feature folder.
allowed-tools: Read, Write, Glob, Grep, Bash
---

# react-review

## Purpose

Find the defects React lets you ship silently: effects that fire more or less often than
intended, state that is derived-but-stored, context that re-renders a subtree on every tick,
props that encode the wrong ownership, and cleanup that never runs. Rendering correctness is
mostly invisible until it is a bug report — this lens goes looking.

Compiling and "it works on my machine" prove nothing about effect ordering, stale closures,
or what happens on the second mount.

**Framework-gated.** This lens may only be dispatched on a module whose code shows an actual React
signal (`.jsx`/`.tsx`, `from 'react'`) in a repo where React is a real dependency — see
`project-auditor/references/stack-detection.md`. If you were handed a Vue, Svelte, or vanilla-JS
module, stop and report `WRONG_FRAMEWORK` rather than reviewing it: findings measured against rules
the project never adopted are false by construction. Note the **React major version** before citing
version-specific behaviour (17/18/19 differ in effect double-invocation, transitions, and the
compiler's memoization assumptions).

## Activation examples

- "Review the React code in `frontend/src/components/toeic/runner`"
- "Why does this component re-render so much?"
- "Audit our hooks usage / context design"
- "Is this state management sound?"
- Dispatched by `project-auditor` for kinds: React feature dir, shared UI, frontend state.

## Required reading

`_shared/review-protocol.md` · `_shared/issue-format.md` · `_shared/report-format.md`.

## Inputs

`module.slug`, `module.path(s)`, `module.job`, `module.files`, React version, state approach
(context / store / server state lib), whether the project has `eslint-plugin-react-hooks`.

## Workflow

1. **Free findings first.** Run the project's linter and mine the output; hook-rule violations
   come with perfect evidence:

   ```bash
   npx eslint <module-path> --no-error-on-unmatched-pattern 2>&1 | tail -60
   npx eslint <module-path> --rule '{"react-hooks/exhaustive-deps":"warn"}' 2>&1 | tail -40
   ```

   Do not stop here — the linter finds rule violations, not design defects.

2. **Map the component graph.** Which components render which, where state lives, where it is
   consumed. Note the render root of the module and any provider inside it. One sentence per
   component: what it owns.

3. **State audit.** For every `useState`/`useReducer`/store slice:
   - Is it **derived** from props/other state? Then it should be computed, and any effect that
     syncs it is a defect (double render, one frame of stale UI, drift on missed updates).
   - Is it **server data** held in component state with manual loading/error flags? Note the
     duplication cost and the staleness path.
   - Is it **too high**? State lifted above every consumer re-renders unrelated siblings.
   - Is it **too low**? Two components maintaining copies that must agree.

4. **Effect audit** — one by one, this is where the real bugs live:
   - What is this effect *for*? Effects that only transform data or respond to an event should
     not be effects at all.
   - Dependency array: missing dep → stale closure; extra/unstable dep (object, array, or
     inline function literal recreated each render) → refires every render.
   - Cleanup: subscriptions, timers, listeners, `AbortController`, async setState after
     unmount. Missing cleanup with a `setInterval`/`addEventListener` is a leak — verify by
     reading the cleanup return, not by assuming.
   - Re-entrancy: fetch effects without an ignore/abort flag produce out-of-order responses.
   - Effects that write state they also depend on → loop or extra render pass.

5. **Render-cost audit.**
   - Inline object/array/function props into memoized children (defeats the memo).
   - Work in the render body that scales with data (sort/filter/map over large lists, date
     formatting per row, JSON parse).
   - Keys: index keys on reorderable/removable lists → wrong state after mutation. Verify the
     list can actually change order before reporting.
   - Context value objects rebuilt every provider render → every consumer re-renders.
   - Big lists with no windowing (cite the realistic N).

6. **Props & composition audit.** Boolean-flag explosions that encode variants, prop drilling
   past 2 levels, children-vs-render-prop misuse, components taking 10+ props doing three
   jobs, missing controlled/uncontrolled clarity, mutation of props or of state objects in
   place (`arr.push`, `obj.x = 1` then `setState(obj)` — a real and common defect).

7. **Verification pass** (protocol §5). For each rendering claim, name the exact trigger
   ("typing in the search box re-renders all 40 rows because `onSelect` is recreated at
   `List.jsx:22`"). If you cannot name the trigger, downgrade confidence.

8. Write the report, return the digest.

## Review checklist

**Component design**
- [ ] One component, one responsibility; no component both fetching, transforming, and drawing
- [ ] Size is reasonable (>300 lines or >3 concerns → split candidate, with the seam named)
- [ ] Conditional-return branches do not hide two different components in one file
- [ ] No component defined inside another component's body (remounts the subtree every render)

**Hooks usage**
- [ ] Rules of hooks respected (no conditional/looped hooks) — verified via lint
- [ ] Custom hooks: named `use*`, single purpose, stable return identity where consumers memo
- [ ] No hook doing an imperative side effect that belongs in an event handler
- [ ] `useRef` used for mutable non-render values, not to dodge dependency arrays
- [ ] `useLayoutEffect` only where measurement/paint ordering requires it

**State management**
- [ ] No state that is derivable from other state/props
- [ ] No effect whose only job is to mirror props into state
- [ ] State lives at the lowest common ancestor of its consumers
- [ ] Server data lifecycle (loading/error/stale/refetch) is handled once, not per component
- [ ] No duplicated source of truth between context, local state, and storage

**Props design**
- [ ] Names describe intent, not implementation; booleans read as states
- [ ] Ownership is clear: who can change this value?
- [ ] No prop drilling deeper than ~2 levels without a reason
- [ ] Props are not mutated; objects passed down are not modified in place

**Composition**
- [ ] Variants via composition/children, not a matrix of boolean flags
- [ ] Shared behaviour extracted into hooks rather than copied between siblings
- [ ] Sibling components of the same kind follow the same shape

**Rendering**
- [ ] Stable, identity-based `key`s on dynamic lists
- [ ] No expensive computation in the render body scaled by data size
- [ ] No `setState` during render (outside the documented derived-state pattern)
- [ ] Async setState paths cannot fire after unmount

**Memoization**
- [ ] `memo`/`useMemo`/`useCallback` used where there is a measured or reasoned cost — not
      sprinkled by default
- [ ] Memoized children are not handed fresh object/function props each render
- [ ] Dependency arrays of memo hooks are correct (a wrong one caches a stale value — worse
      than no memo)

**Context usage**
- [ ] Provider `value` is memoized or otherwise identity-stable
- [ ] Context granularity matches update frequency — a fast-ticking value does not share a
      provider with rarely-changing config
- [ ] Consumers are not re-rendering for slices they never read
- [ ] Context is not used as a global mutable bag to avoid designing props

**Effect dependencies**
- [ ] Every dependency array is exhaustive **and** every dep is stable enough to intend
- [ ] Every subscription/timer/listener has cleanup
- [ ] Fetch effects are abortable or ignore-flagged against out-of-order responses
- [ ] Nothing depends on effects running in a particular order across components

## Detection recipes

```bash
rg -n "useEffect\(" <module-path> -A2                       # then read each one properly
rg -n "\[\]\s*\)\s*;?\s*$" <module-path> --glob '*.jsx'      # empty dep arrays: verify intent
rg -n "key=\{(?:i|idx|index)\}" <module-path> --pcre2        # index keys
rg -n "(?:setInterval|setTimeout|addEventListener)" <module-path>  # pair each with a cleanup
rg -n "useMemo|useCallback|React\.memo|memo\(" <module-path> -c    # memo density vs. need
rg -n "\.(push|splice|sort|reverse)\(" <module-path>          # in-place mutation of state/props
rg -n "value=\{\{" <module-path>                             # inline context value object
rg -n "localStorage|sessionStorage" <module-path>            # state duplicated outside React
rg -n "^\s*(?:const|function)\s+[A-Z]\w*" <module-path> -A1  # nested component definitions
```

Confirm each hit by reading the surrounding code. A grep hit is a lead, never a finding.

## Best practices

- **Name the trigger.** Every rendering finding states the user action or data change that
  causes it. Without that, it is speculation.
- **Prefer "delete this effect" over "fix these deps"** when the effect should not exist.
  Say which of the standard shapes applies: derived value, event handler, or subscription.
- **Do not prescribe memoization as a default.** Unnecessary memo is itself a finding
  (complexity + stale-cache risk). Ask for a cost first.
- **Check the second mount.** StrictMode double-invocation, remount after navigation, and
  cleanup correctness surface most effect bugs.
- **Respect the project's chosen approach.** If it uses plain context and no server-state
  library, "adopt React Query" is a Long-term Improvement with a trigger, not a High finding.
- **React version matters.** Check it before citing version-specific behaviour or APIs.

## Anti-patterns

- ❌ "Wrap everything in `useMemo`/`memo`" as a recommendation
- ❌ Reporting an exhaustive-deps lint warning as High without tracing what actually breaks
- ❌ Recommending a state-management library rewrite from a module-level view
- ❌ Style findings (arrow vs. function component) presented as defects
- ❌ Claiming "unnecessary re-render" without identifying what causes it and what it costs
- ❌ Reviewing non-React files (styles, API clients) — route them to the css/api lens instead

## Output template

Per `_shared/report-format.md`, plus this section before `Findings`:

```markdown
## Component & State Map

| Component | Owns | Consumes | Effects | Notable |
|---|---|---|---|---|
| `ShopScreen.jsx` | filter, selection | GameContext (coins, items) | 2 (fetch, sync) | 340 lines, 3 concerns |

- **Provider(s) in module:** <name — value stability>
- **Lint status:** <N hook warnings> (`npx eslint <path>`)
- **Render hot paths:** <what re-renders on which action>
```

Digest example:

```
DIGEST react frontend.components.shop · coverage 5/5 files · complete
VERDICT fragile
SUMMARY Shop state is largely derived from GameContext but stored again locally and synced by
an effect, so the list shows one stale frame after a purchase. Provider value is rebuilt each
render, re-rendering every consumer on the energy tick.
REPORT .claude-audit/reports/frontend.components.shop.react.md

| ID | Sev | Conf | Title | Location | Eff | Impact |
|---|---|---|---|---|---|---|
| REACT-frontend.components.shop-001 | High | High | Purchase effect mirrors context into state, showing stale coins for one frame | ShopScreen.jsx:88-104 | M | UX |
| REACT-frontend.components.shop-002 | High | Medium | Inline context value re-renders all consumers on every energy tick | GameContext.jsx:151 | S | performance |
| REACT-frontend.components.shop-003 | Medium | High | Fetch effect has no abort; switching category fast can render the wrong list | ShopScreen.jsx:52 | S | correctness |

STRENGTHS Item card is presentational with no data access, so it is trivially reusable (ItemThumb.jsx:1-40)
THEMES Server data kept in component state; no single owner for shop data
ROUTE api: purchase response is not validated before being written into state
REMAINING none
```

## Directory structure

```
.claude/skills/react-review/
└── SKILL.md
```
