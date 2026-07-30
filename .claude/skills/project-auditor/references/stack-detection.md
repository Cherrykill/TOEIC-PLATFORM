# Stack Detection and Lens Gating

Two classes of lens:

- **Universal** — apply to any codebase: `architecture`, `performance`, `security`, `api`,
  `naming`, `technical-debt`, `testing`, `css` (whenever styling exists at all).
- **Framework-gated** — apply *only* when their framework is detected in the repo:
  `react-review`, `express-review`, `vue-review`, `nextjs-review`, `nestjs-review`, …

**A framework-gated lens must never be dispatched on evidence weaker than §2.** Running
`react-review` on a Vue codebase, or `express-review` on a Fastify one, produces findings
measured against rules the project never adopted — noise that discredits the whole audit.

## 1. When detection happens

`repo-map` runs it as part of step 2 (Tech Stack) and emits a **Detected Frameworks** block into
`PROJECT-MAP.md`. `project-auditor` reads that block at step 3b, resolves it against the registry
below, and writes the resulting **active lens set** into `state.md` before any dispatch.

Detection is per-**module**, not only per-repo. A repo containing both Express and React activates
both lenses — but `react-review` still only runs on the React modules and `express-review` only on
the Express ones. Repo-level detection decides which lenses *exist* for this audit; the dispatch
matrix decides which modules they touch.

## 2. Detection signatures

A framework counts as detected only with **at least one dependency signal AND one code signal**.
A dependency in `package.json` with no import sites is *declared, not used* — record it as a fact,
do not activate its lens.

| Framework | Dependency signal | Code signal | Lens |
|---|---|---|---|
| **React** | `react` in dependencies | `.jsx`/`.tsx` files, or `from 'react'` imports | `react-review` |
| **Vue** | `vue` | `.vue` files, or `defineComponent`/`<script setup>` | `vue-review` |
| **Next.js** | `next` | `pages/` or `app/` router dir, `next.config.*` | `nextjs-review` **and** `react-review` |
| **NestJS** | `@nestjs/core` | `*.module.ts` with `@Module(`, `@Injectable(` | `nestjs-review` (Express lens **off** — Nest owns the HTTP layer) |
| **Express** | `express` | `express()` app, `express.Router()` | `express-review` |
| **Fastify** | `fastify` | `fastify()` instance, plugin registration | *(no lens yet — universal only)* |
| **Angular** | `@angular/core` | `*.component.ts` with `@Component(` | *(no lens yet)* |
| **Svelte** | `svelte` | `.svelte` files | *(no lens yet)* |
| **Nuxt** | `nuxt` | `nuxt.config.*` | *(no lens yet — activates `vue-review` if present)* |

Detection commands:

```bash
# dependency signals, per workspace
for p in $(git ls-files '*package.json' | grep -v node_modules); do
  echo "--- $p"; rg -o '"(react|vue|next|@nestjs/core|express|fastify|@angular/core|svelte|nuxt)"' "$p"
done
# code signals
git ls-files | rg -c '\.(jsx|tsx)$|\.vue$|\.svelte$'
rg -l "express\(\)|express\.Router\(" --glob '!node_modules' . | head
rg -l "@Module\(|@Injectable\(" --glob '!node_modules' . | head
git ls-files | rg "^(src/)?(pages|app)/.*\.(jsx|tsx)$" | head
```

## 3. Registry — status in this repository

`available` = the SKILL.md exists and can be dispatched. `not created` = detection would activate
it, but the skill does not exist yet; the orchestrator must then record the gap in
`state.md` → `not-reviewed` with the reason, and fall back to universal lenses only. It must
**not** substitute a different framework's lens.

| Lens | Status | Activates when |
|---|---|---|
| `react-review` | available | React detected |
| `express-review` | available | Express detected **and** NestJS not detected |
| `vue-review` | not created | Vue detected |
| `nextjs-review` | not created | Next.js detected |
| `nestjs-review` | not created | NestJS detected |

Detected in this repo (commit `739685d`): **React 19** (85 `.jsx` files, `react` dependency) and
**Express ~4.16** (`backend/server.js`, 28 routers). Vue, Next.js, NestJS: absent — their lenses
must never be dispatched here, which is why they have not been written.

## 4. Activation rules

1. **Both signals or no activation.** See §2.
2. **Mutual exclusion.** NestJS present → `express-review` off even though Nest runs on Express
   underneath; Nest's own conventions (modules, providers, DI, guards, pipes) supersede raw-Express
   review rules. Next.js present → `nextjs-review` **and** `react-review` both on, with routing,
   data fetching, and rendering-strategy findings owned by the Next lens and component/hook
   findings by the React lens.
3. **Per-module scoping still applies.** An activated lens runs only on modules whose `Kind` the
   dispatch matrix pairs it with.
4. **Version matters.** Record the major version in `PROJECT-MAP.md` and pass it in the dispatch
   prompt. Rules differ across React 17/18/19, Express 4/5, Vue 2/3, Next pages/app router. A
   finding citing behaviour from the wrong major version is a false finding.
5. **Missing lens ≠ silent skip.** If a detected framework has no lens, say so in the audit's
   Coverage and Blind Spots sections: "Vue detected in `apps/admin`; no `vue-review` skill exists,
   so that module was reviewed by universal lenses only."
6. **Never guess from a folder name.** `components/`, `services/`, `pages/` exist in many stacks.
   Dependencies plus imports, or no activation.

## 5. Adding a framework lens

1. Write `.claude/skills/<framework>-review/SKILL.md` using the standard lens layout (see any
   existing lens; `README.md` §5 has the section list).
2. Add its ID prefix to `_shared/issue-format.md` (`VUE`, `NEXT`, `NEST`, …).
3. Add a row to §2 (detection signature) and §3 (registry, status `available`) here.
4. Add its rows to the dispatch matrix in `orchestration.md`: which module kinds it applies to,
   which it must never touch, and any mutual exclusion.
5. State the framework's **version scope** in the skill's Inputs — the rules are
   version-sensitive.
6. Keep the boundary with the universal lenses explicit in the skill's Purpose, so the same
   defect is not reported twice under two lenses. Framework lenses own *framework mechanics*;
   universal lenses own structure, exploitability, contracts, and cost.
