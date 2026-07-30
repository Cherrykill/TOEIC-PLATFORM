---
name: architecture-review
description: Reviews the structure of ONE module (or the repo skeleton at low resolution) — folder layout, module boundaries, dependency direction, separation of concerns, feature organization, shared utilities, cyclic dependencies, abstraction quality, scalability and maintainability. Use when auditing how code is organized rather than what it does. Invoked by project-auditor; also usable standalone on a single directory.
allowed-tools: Read, Write, Glob, Grep, Bash
---

# architecture-review

## Purpose

Judge whether a module's **shape** will hold up: are the boundaries real, does dependency
flow in one direction, is each unit responsible for one thing, and will this survive the next
ten features. Structure defects are the most expensive to fix and the cheapest to spot early
— which is why this lens usually runs first.

Structure is judged against the project's **declared** architecture (CLAUDE.md,
CONTRIBUTING.md, ADRs, lint config). Divergence from a declared target is a finding.
Divergence from your taste is not.

## Activation examples

- "Review the architecture of `backend/services`"
- "Are the module boundaries in `frontend/src/game` sound?"
- "Any circular dependencies in this feature?"
- "Is this folder structure going to scale?"
- Dispatched by `project-auditor` for kinds: repo-wide skeleton, backend controllers/services,
  data models, frontend state, middleware/utils, queues, config.

## Required reading

`_shared/review-protocol.md` · `_shared/issue-format.md` · `_shared/report-format.md`
(paths relative to `.claude/skills/`). The protocol is binding.

## Inputs

`module.slug`, `module.path(s)`, `module.job`, `module.files`, declared conventions,
invariants. Missing file list → derive it with Glob and state what you derived.

## Workflow

1. **Map before judging.** List files with line counts. Identify the module's public surface
   (what other modules import from it) and its job in one sentence. If the job takes more than
   one sentence, that is finding #1.

2. **Build the dependency picture.** Outbound and inbound edges, from imports — not from
   assumption:

   ```bash
   # outbound: what this module depends on
   rg -o "(?:require\(|from\s+)['\"]([^'\"]+)['\"]" -r '$1' --no-filename <module-path> | sort | uniq -c | sort -rn
   # inbound: who depends on this module
   rg -l "<module-dir-name>/" --glob '!node_modules' --glob '!dist' .
   ```

   Classify each edge: same layer / downward (allowed) / upward (violation) / sideways into a
   peer feature (coupling). Upward and sideways edges are the highest-value findings this lens
   produces.

3. **Hunt cycles.** For each outbound target inside the repo, check whether it imports back.
   Two-hop cycles are found by grepping the target for the module's own name; longer cycles by
   following the highest-fan-in edges. Report a cycle with the full path
   (`a.js → b.js → c.js → a.js`) and the line of each edge — a cycle claimed without its edges
   is unverifiable.

4. **Test the boundaries.** For each file, ask what layer it belongs to and whether it does
   only that layer's work: does a route contain business rules, a controller contain queries,
   a service import `req`/`res`, a model contain HTTP concerns, a component contain fetch and
   transport logic. Mixed layers are separation-of-concerns findings with a `path:line`
   pointing at the mixed statement, not at the file.

5. **Assess the abstractions.** For every abstraction (base class, wrapper, factory, generic
   helper, hook), count real call sites (`rg`). Then classify:
   - 1 call site → speculative; the indirection costs reading time and buys nothing.
   - ≥3 near-identical call sites *without* an abstraction → missing abstraction (pair this
     with the technical-debt lens rather than duplicating the finding).
   - an abstraction whose parameters are mostly flags controlling unrelated behaviour → wrong
     seam; name the two things it is really doing.

6. **Scale and maintenance stress test.** Name the concrete next changes and see if the shape
   absorbs them: a second provider, a third consumer, 10× data volume, a new feature of the
   same kind as the existing ones, a new developer needing to find where X lives. Where the
   shape forces edits in >3 places for a single conceptual change, that is a
   maintainability finding — quantify the fan-out.

7. **Verification pass** (protocol §5), then write the report and return the digest.

## Review checklist

**Folder structure**
- [ ] Directory names describe domain or layer consistently — not a mix of both at one level
- [ ] Depth is justified (no single-child chains, no 40-file flat dumps)
- [ ] File placement is predictable: can you guess where a new file of kind X goes?
- [ ] Co-location matches the change unit (things that change together live together)

**Module boundaries**
- [ ] The module has an identifiable public surface, not "everything is importable"
- [ ] Internals are not reached into from outside (deep imports past the entry point)
- [ ] The boundary matches a real seam (domain, layer, or deployment unit)

**Dependency direction**
- [ ] Flow is one-way: outer → inner (routes → controllers → services → data)
- [ ] No upward imports (a service importing a controller, a model importing a route)
- [ ] No sideways feature-to-feature imports; shared code goes to a shared place
- [ ] Third-party dependencies are isolated behind an adapter where swapping is plausible

**Separation of concerns**
- [ ] Transport, business rules, and persistence are not interleaved in one function
- [ ] Presentation is separate from data fetching and from domain logic
- [ ] Cross-cutting concerns (auth, logging, errors, caching) are middleware/wrappers, not
      copy-pasted into handlers

**Feature organization**
- [ ] Sibling features follow the same internal shape; an outlier is either better (adopt) or
      accidental (fix)
- [ ] Feature-level state is not lifted into a global store without a reason
- [ ] Dead or half-migrated feature folders are identified

**Shared utilities**
- [ ] `utils/` files have a coherent topic, not a junk-drawer name
- [ ] No two utilities do the same job under different names
- [ ] Shared code has no knowledge of its consumers (no importing a feature from a util)

**Cyclic dependencies**
- [ ] No import cycles; each reported one has its full edge list

**Abstraction quality**
- [ ] Every abstraction has ≥2 real consumers or a stated near-term second one
- [ ] No leaky abstractions (callers must know the internals to use them correctly)
- [ ] Naming reflects the seam, not the implementation

**Scalability / maintainability**
- [ ] Adding the obvious next feature does not require touching >3 unrelated files
- [ ] No file over ~800 lines without a structural reason; none over ~1,500 (call it out)
- [ ] Load-bearing knowledge is in code or docs, not only in someone's head (magic ordering,
      implicit init sequences, global side effects at import time)

## Detection recipes

```bash
# size distribution — structural smell finder
git ls-files <module-path> | xargs wc -l 2>/dev/null | sort -rn | head -20

# import-time side effects (state mutated on module load)
rg -n "^(?!.*(?:function|=>|class))\s*\w+\([^)]*\)\s*;?\s*$" <module-path> --pcre2

# layer violations (Express example)
rg -n "req\.|res\." <module-path>/services 2>/dev/null       # transport leaking into services
rg -n "require\('\.\./models" <module-path>/routes 2>/dev/null # routes reaching the data layer

# god objects / fan-in
rg -c "from '@?<module-name>" --glob '!node_modules' . | sort -t: -k2 -rn | head

# barrel-file coupling (one import pulls the world)
rg -n "export \*" <module-path>

# churn as a maintainability signal
git log --format= --name-only --since=6.months -- <module-path> | sort | uniq -c | sort -rn | head -15
```

Ambient/implicit coupling is worth extra attention where a project has no module system in a
layer (e.g. a browser admin panel with N `<script>` tags): load order becomes an invisible
dependency graph. Reconstruct it from the HTML and report the coupling with the tag lines.

## Best practices

- **Read the declared architecture first.** A project that documents `routes → controllers →
  services → models` gives you a precise ruler; use it and cite it.
- **One finding per boundary, with all its instances.** "Services import `req`/`res` in 4
  places" beats four findings.
- **Distinguish drift from decision.** Ask whether the divergence is documented as a
  trade-off. Auditing a deliberate trade-off as an error destroys the report's credibility.
- **Quantify maintainability.** "Adding a shop item type requires edits in 6 files
  (`a:12`, `b:88`, …)" is a finding. "Poor cohesion" is not.
- **Respect stability constraints.** If the project explicitly prioritizes stability (demo,
  release freeze), keep the finding but set effort honestly and put restructuring in
  Long-term Improvements with a trigger condition.

## Anti-patterns

- ❌ Recommending a folder-structure rewrite as a top finding when nothing is broken by it
- ❌ "Should use hexagonal/clean architecture" — pattern advocacy without a defect
- ❌ Claiming a cycle without listing the edges
- ❌ Counting a re-export or a type-only import as a runtime dependency
- ❌ Judging a 3-file module by enterprise-scale standards
- ❌ Reviewing the whole repo's structure when handed one module (that is the repo-wide pass,
  and it works from the module map, not from file bodies)

## Output template

Per `_shared/report-format.md`, plus these architecture-specific sections in the report body,
placed before `Findings`:

```markdown
## Module Shape

- **Job:** <one sentence>
- **Public surface:** <exported entry points>
- **Inbound:** <N modules> — <the notable ones>
- **Outbound:** <N internal, M external> — <the notable ones>
- **Layer map:** <file → layer, only where it is ambiguous or violated>
- **Cycles:** <none | full edge lists>
```

Digest example:

```
DIGEST architecture backend.services · coverage 15/15 files · complete
VERDICT acceptable with debt
SUMMARY Services hold the real business rules as intended, but four of them accept req/res,
which puts transport concerns below the controller layer. No cycles.
REPORT .claude-audit/reports/backend.services.architecture.md

| ID | Sev | Conf | Title | Location | Eff | Impact |
|---|---|---|---|---|---|---|
| ARCH-backend.services-001 | High | High | Services take req/res, inverting the layer contract | services/questEvaluators.js:41 (+3) | M | maintainability |
| ARCH-backend.services-002 | Medium | High | gameConfig cache mutated at import time | services/gameConfig.js:8 | S | correctness |

STRENGTHS Single switch for shop effects keeps every mutation auditable (shopEffects.js:12-88)
THEMES Layer contract is stated but unenforced; no lint rule prevents the inversion
ROUTE testing: services with money paths have no failure-case tests
REMAINING none
```

## Directory structure

```
.claude/skills/architecture-review/
└── SKILL.md
```
