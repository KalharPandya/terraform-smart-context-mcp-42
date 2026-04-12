# NOTES.md

> **WARNING: This file is NOT session memory.**
> This file is ONLY for things `git log` cannot tell you.
> Always verify against `git log` before trusting any entry here.
> **Your teammates' sections are more important than your own. Read theirs first.**

---

## Open Blockers

Things actively blocking someone right now.
Format: `[NAME DATE] blocked on: what, waiting for: who`
Clear your entry the moment the blocker is resolved.

```
[EXAMPLE 2026-01-01] blocked on: HCL parser decision, waiting for: team to resolve Open Question #3 in DECISIONS.md
```

---

## Live Questions

Questions that need a team answer before the next commit.
Format: `[NAME DATE] question`
Move to `DECISIONS.md` the moment it is answered.
Never let a question sit here more than 24 hours.

```
[EXAMPLE 2026-01-01] Should module.outputs count as DAG nodes or just edges to their source resource?
```

---

## Heads Up

Things teammates should know that are not yet in git.
Format: `[NAME DATE] warning or notice`
Examples: refactoring a shared interface, changing a shared type, about to force push a branch.
Clear your entry once the work is committed.

```
[EXAMPLE 2026-01-01] Refactoring the GraphNode interface — do not build against it until this is committed.
```

[Kalhar 2026-04-11] prompts.json upgraded to v2.0 (30 prompts, 8 easy / 10 medium / 12 hard). Trials set to 2. Runner/scorer not yet tested against new prompt set — verify before full experiment run.

[Parin 2026-04-12] Gemini MCP experiment Trial 2 data is invalid for all 30 prompts — `.gemini/` config cleanup bug caused MCP tools to disappear. Only Trial 1 is usable from `gemini-mcp-2026-04-12T02-23-31.json`. Fix is in gemini-runner.ts but a clean re-run has not been done yet.

[Parin 2026-04-12] Gemini results scored and visualized in `results/charts/gemini.html`. Raw=0.82 avg score, MCP=0.30 (Trial 1 only). MCP accuracy is low — needs investigation whether it's a scoring issue or Gemini struggling with MCP tools on medium/hard prompts.
