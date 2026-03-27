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
