# Review Protocol — binding rules for every review skill

Read this file first, every time. It is the contract. A report that violates it is invalid
and must be rewritten before being handed back.

## 1. Scope discipline

- **One module per invocation.** A module is a bounded set of files given to you as
  `module.path` / `module.files`. You review that and nothing else.
- **Never review the whole repository.** If you were handed something that looks like
  "the repo", stop and report `SCOPE_TOO_LARGE` with a proposed split instead of reviewing.
- You may *look outside* the module to resolve a symbol, confirm a caller, or check a
  config — that is allowed and encouraged. You may not *audit* outside the module. Findings
  must be anchored to a file inside the module (an out-of-module observation goes in
  `Cross-module notes`, max 5 bullets).

## 2. Cold-start assumption

Assume **nothing** from previous reviews is in your context. No prior module, no prior
finding, no prior decision. Everything you need is either:

- in the invocation arguments,
- in `.claude-audit/state.md` and `.claude-audit/modules.md` (read them if present),
- or something you must discover yourself now.

Never write "as noted earlier", "same as the previous module", or "see above".

## 3. Local-understanding-first

Before judging anything, build a local model of the module. In order:

1. List the module's files and sizes (Glob + line counts).
2. Read the entry points / public surface (index, route file, exported component, service
   facade). Understand what the module is *for* before you look for flaws.
3. Map inbound and outbound dependencies (who imports this, what this imports).
4. Only then start the lens checklist.

Write down, in one sentence, the module's job. If you cannot, say so — an unclear purpose
is itself a finding (architecture/naming lens).

## 4. Evidence gate — no finding without proof

Every finding must carry:

- an exact `path:line` (or `path:startLine-endLine`) **inside the module**, and
- a quoted snippet of **at most 10 lines**, copied verbatim, and
- how you verified it (`read the code` / `traced callers` / `ran <command>` / `grep <pattern> → N hits`).

If you cannot produce all three, the finding does not exist. Delete it. Do not "soften" an
unverifiable claim into a vague one — that is how fake findings get shipped.

Forbidden phrasings: "may possibly", "could potentially somewhere", "it seems likely that
this might", "consider reviewing whether". Either you found something or you did not.

## 5. Verification pass (mandatory, before writing the report)

Re-open every file you cited and confirm:

- the line numbers still match what you quoted,
- the defect is not already handled by a guard/caller/config you skipped,
- the fix you propose does not already exist elsewhere in the module.

Findings that survive → `Findings`. Findings you could not confirm but consider real →
`Appendix: Needs Verification`, never in `Priority Fixes`. A Critical or High finding with
Low confidence **must** be verified or demoted. This pass typically kills 20–40% of a first
draft; that is the pass working, not failing.

## 6. Balance rules

- **No praise without a reason.** "Clean code" is banned. "`shopEffects.js` keeps all
  mutations in one switch so every effect is auditable in one place (`shopEffects.js:12-88`)"
  is a strength.
- **No criticism without evidence.** See §4.
- Compiling, passing tests, and "working in production" are **not** evidence of correctness.
  Assume there are defects and go find them; if after a genuine hunt a module is sound, say
  that explicitly and show what you checked.

## 7. Context budget and bail-out

Soft budget per module: **~25 files or ~4,000 lines read**. When you approach it:

1. Stop reading new files.
2. Write the report for what you covered.
3. Fill `Files Remaining` with the untouched files **and a suggested sub-split**.
4. Return the digest. Do not push through by skimming — a shallow report on 60 files is
   worth less than a deep report on 20 plus an honest remainder.

Never dump whole files into your output. Quote ≤10 lines, cite the rest by `path:line`.

## 8. Output contract

You produce exactly two artifacts:

1. **Full report** written to `.claude-audit/reports/<module-slug>.<lens>.md`
   — format: `_shared/report-format.md`.
2. **Digest** (≤40 lines) returned as your final message
   — format: `_shared/report-format.md` § Digest.

The digest is the *only* thing that enters the orchestrator's context. Everything the
orchestrator needs to rank, plan, and roadmap must be in the digest; everything a human
needs to act must be in the report.

## 9. Tone

Staff engineer performing a professional audit for colleagues who will read it. Direct,
specific, no hedging, no moralising, no filler. Depth over speed. Rank by consequence, not
by how easy the issue was to spot.