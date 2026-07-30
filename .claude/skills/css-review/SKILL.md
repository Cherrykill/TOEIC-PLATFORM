---
name: css-review
description: Reviews styling in ONE module — CSS architecture, naming, responsiveness, layout, spacing and typography consistency, color usage, design tokens, accessibility, maintainability and duplicated styles. Use when auditing stylesheets, component styles, a design system or theme. Invoked by project-auditor; also usable standalone on a stylesheet directory.
allowed-tools: Read, Write, Glob, Grep, Bash
---

# css-review

## Purpose

Find the styling defects that turn into daily friction: selectors nobody dares delete,
`!important` wars, five slightly different greys, breakpoints that disagree with each other,
and markup that a keyboard or screen reader cannot use. CSS has no compiler — dead rules and
broken cascades are invisible until someone ships a visual regression.

The highest-value finding this lens produces is usually the missing token layer: quantify the
inconsistency (how many distinct greys, spacings, radii) rather than asserting it.

## Activation examples

- "Review our CSS architecture"
- "Is the spacing/typography consistent?"
- "Audit `frontend/src/assets/styles`"
- "Check this component's responsiveness and accessibility"
- Dispatched by `project-auditor` for kinds: global stylesheets/theme, React feature dir that
  owns styles, shared UI, admin panel markup.

## Required reading

`_shared/review-protocol.md` · `_shared/issue-format.md` · `_shared/report-format.md`.

## Inputs

`module.slug`, `module.path(s)`, `module.files`, styling approach (plain CSS / modules /
CSS-in-JS / utility framework), whether a token/theme layer exists, dark-mode support,
target breakpoints if declared.

## Workflow

1. **Inventory.** Files, line counts, load order (which stylesheet imports/overrides which),
   and the styling strategy actually in use. Load order *is* the architecture in plain CSS —
   reconstruct it from `index.css`/the HTML, and note where later files exist only to override
   earlier ones.

2. **Measure the value space** — this is the core of the lens and it must be counted, not
   claimed:

   ```bash
   # colors: how many distinct literals, and how often each appears
   rg -o "#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)" <path> --no-filename | tr 'A-Z' 'a-z' | sort | uniq -c | sort -rn
   # spacing
   rg -o "(?:margin|padding|gap)(?:-[a-z]+)?:\s*[^;]+" <path> --no-filename | sort | uniq -c | sort -rn | head -30
   # font sizes / weights / radii / shadows / z-index / transitions
   rg -o "font-size:\s*[^;]+"  <path> --no-filename | sort | uniq -c | sort -rn
   rg -o "border-radius:\s*[^;]+" <path> --no-filename | sort | uniq -c | sort -rn
   rg -o "z-index:\s*[^;]+" <path> --no-filename | sort | uniq -c | sort -rn
   ```

   Report as: "37 distinct hex colors across 11 files, of which 9 are near-duplicate greys
   (`#2a2a2a`, `#2b2b2b`, `#292929` …)". That is evidence. "Colors are inconsistent" is not.

3. **Check the token layer.** Are there custom properties? Are they used, or bypassed by
   literals? A token layer that exists and is bypassed in N places is a stronger finding than
   no tokens at all, because it means the convention is decided and unenforced.

4. **Selector and cascade audit.** Specificity spikes, `!important` (count and read each one —
   some are legitimately fighting a third-party style), deep descendant chains, tag selectors
   on shared elements, and rules whose class does not appear in any markup:

   ```bash
   rg -o "!important" <path> -c
   rg -o "^\s*\.[a-zA-Z][\w-]*" <path> --no-filename | sort -u > /tmp/classes.txt   # then cross-check usage
   ```

   For each candidate dead class, grep the whole codebase for the literal name **and** for
   dynamic construction (`class={`, template strings, `classList.add`) before calling it dead.
   Dynamically built class names are the #1 source of false "dead CSS" findings.

5. **Responsiveness.** Collect every breakpoint value and check they form one system. Look for
   fixed pixel widths/heights on containers, `100vw` with a scrollbar, horizontal-overflow
   risks (wide tables, long unbroken strings, fixed-width grids), and text that cannot reflow.
   Note whether the approach is mobile-first or desktop-first and whether it is applied
   consistently — mixing both is where breakpoint bugs come from.

6. **Layout.** Flex/grid usage vs. absolute positioning and magic offsets; height hacks
   (`calc(100vh - 64px)` hard-coding a header height that lives in another file — cite both
   lines); overflow and stacking-context problems; `z-index` values with no scale.

7. **Accessibility** (styling-adjacent and markup-adjacent, both in scope here):
   - Color contrast on text/background pairs — compute it for the primary pairs and report the
     ratio and the WCAG threshold. This is a measurable, high-confidence finding.
   - Focus visibility: any `outline: none` without a replacement `:focus-visible` style.
   - Interactive elements built from `div`/`span` without role/tabindex/keyboard handlers.
   - `prefers-reduced-motion` for animations; `prefers-color-scheme`/theme correctness.
   - Content hidden in a way that hides it from assistive tech unintentionally, or vice versa.
   - Touch target sizes on mobile breakpoints.

8. **Duplication.** Identical or near-identical rule blocks, repeated "card"/"button" patterns
   defined per feature, and copies of the same component style in two files. Report as one
   finding with the location list.

9. **Verification pass** (protocol §5) — re-check that each cited selector exists at that
   line, that "dead" classes really are unused, and that contrast numbers were computed rather
   than estimated. Then write the report and return the digest.

## Review checklist

**CSS architecture**
- [ ] A stated strategy (tokens → base → components → utilities → overrides) is discernible
- [ ] Load/import order is intentional, not an accretion of override layers
- [ ] Component styles are scoped or namespaced predictably; global rules are deliberate
- [ ] No stylesheet exists solely to undo another

**Naming**
- [ ] One convention (BEM / utility / component-scoped), applied consistently
- [ ] Names describe role, not appearance (`--danger`, not `--red-2` used for errors)
- [ ] No abbreviation soup; no numbered variants (`.card2`, `.btn-new`)
- [ ] Class names in CSS and in markup match (including dynamically built ones)

**Responsiveness**
- [ ] One breakpoint scale, consistently mobile-first or desktop-first
- [ ] No fixed widths that break below the smallest target
- [ ] Wide content (tables, code, charts) has its own overflow container
- [ ] Nothing depends on hover for essential interaction on touch

**Layout**
- [ ] Flex/grid used for structure; absolute positioning is the exception with a reason
- [ ] No cross-file magic offsets duplicating a dimension defined elsewhere
- [ ] `z-index` follows a documented scale
- [ ] No layout that breaks with longer text or a missing image

**Spacing consistency**
- [ ] Spacing comes from a scale; one-off values are rare and justified
- [ ] Vertical rhythm is not built from ad-hoc margins per component

**Typography**
- [ ] A finite type scale; sizes/weights/line-heights come from it
- [ ] Line length and line height are readable at each breakpoint
- [ ] Font loading strategy does not cause layout shift or invisible text

**Color consistency**
- [ ] Semantic colors are named by role and reused
- [ ] No near-duplicate values for the same intent
- [ ] Both themes (light/dark) covered wherever a theme exists
- [ ] Color is never the sole carrier of meaning

**Design tokens**
- [ ] A token layer exists for color/space/type/radius/shadow/motion
- [ ] Tokens are actually used; literal bypasses are counted
- [ ] Tokens are themeable at one place

**Accessibility**
- [ ] Contrast ≥ 4.5:1 body text, ≥ 3:1 large text and UI boundaries (report measured ratios)
- [ ] Visible focus for every interactive element
- [ ] Semantic elements for interactive behaviour
- [ ] `prefers-reduced-motion` honoured
- [ ] Text scales with user font-size settings (no rem-hostile fixed layout)

**Maintainability / duplication**
- [ ] No dead rules (verified against dynamic class construction)
- [ ] No duplicated component patterns across files
- [ ] File size and rule count per file are manageable
- [ ] Comments explain non-obvious hacks and browser workarounds

## Best practices

- **Count, then conclude.** Every consistency finding carries a number.
- **Compute contrast, don't eyeball it.** State the pair, the ratio, and the threshold.
- **Verify "dead" before reporting dead.** Search for dynamic class construction first; a
  wrong dead-code finding gets a whole report distrusted.
- **`!important` is a symptom.** Report the specificity conflict causing it, not the keyword.
- **Group into one systemic finding** when the same inconsistency spans a directory; list
  representative locations plus the total count.
- **Respect the chosen approach.** A project on plain CSS gets findings about *its* system's
  consistency, not a recommendation to adopt Tailwind (that is a Long-term Improvement with a
  trigger condition, at most).

## Anti-patterns

- ❌ "Migrate to <framework>" as a top finding
- ❌ Subjective aesthetics ("the palette feels dated") presented as a defect
- ❌ Flagging a hex literal as a finding one file at a time — aggregate
- ❌ Claiming a rule is unused after grepping only the CSS
- ❌ Accessibility claims without a measured ratio or a specific missing attribute
- ❌ Reviewing component logic — route it to react-review

## Output template

Per `_shared/report-format.md`, plus this section before `Findings`:

```markdown
## Style System Inventory

| Dimension | Distinct values | Tokenized? | Notable |
|---|---|---|---|
| Colors | 37 literals (9 near-dup greys) | no | `--bg` exists but bypassed 22× |
| Spacing | 24 values | no | 4/8px scale implied but not enforced |
| Font sizes | 13 | no | 3 unused |
| Breakpoints | 5 (`480/600/768/900/1024`) | n/a | mixed mobile- and desktop-first |
| z-index | 11 values, max 99999 | no | no scale |
| `!important` | 18 occurrences | — | 6 fight vendor styles (legitimate) |

- **Load order:** `index.css` → base → layout → components → responsive → dark-mode
- **Contrast checks:** <pair — ratio — pass/fail>
```

Digest example:

```
DIGEST css frontend.assets.styles · coverage 11/11 files · complete
VERDICT acceptable with debt
SUMMARY No token layer: 37 color literals and 24 spacing values across 11 stylesheets, with
dark-mode overrides duplicating 60 rules. Two body-text pairs fail WCAG AA at 3.1:1 and 3.8:1.
REPORT .claude-audit/reports/frontend.assets.styles.css.md

| ID | Sev | Conf | Title | Location | Eff | Impact |
|---|---|---|---|---|---|---|
| CSS-frontend.assets.styles-001 | High | High | Muted text on card bg is 3.1:1, below AA | base.css:212 (+2) | S | UX |
| CSS-frontend.assets.styles-002 | Medium | High | No token layer; 37 color literals, 9 near-duplicate greys | components.css:1 (+10 files) | L | maintainability |
| CSS-frontend.assets.styles-003 | Medium | High | dark-mode.css re-declares 60 rules instead of overriding tokens | dark-mode.css:1-180 | M | maintainability |

STRENGTHS Breakpoints live only in responsive.css, so layout changes have one home (responsive.css:1-40)
THEMES Values are decided per-file rather than centrally; dark mode pays for it twice
ROUTE performance: 11 stylesheets are all imported eagerly on first paint
REMAINING none
```

## Directory structure

```
.claude/skills/css-review/
└── SKILL.md
```