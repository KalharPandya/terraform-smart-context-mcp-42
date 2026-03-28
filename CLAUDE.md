# CLAUDE.md — Terraform Smart Context MCP Server

## Project Purpose

This is an MCP server that parses `.tf` files into a directed acyclic graph (DAG)
and serves minimal relevant subgraphs to LLMs via MCP tools.

**The goal:** reduce LLM context window usage by returning only the slice of
Terraform infrastructure the LLM actually needs — not the whole graph.

## Tech Stack

- **Language:** TypeScript
- **Runtime:** Node.js v18+
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **Anthropic SDK:** `@anthropic-ai/sdk`

---

## Team

| Person | GitHub | Owns |
|--------|--------|------|
| Kalhar Pandya | `KalharPandya` | Technical prototyping, MCP implementation, architecture |
| Vinal Dsouza | `vinaldsz` | AI-first workflow, team alignment, project structure |
| Parin Shah | `ShahParin` | Protocol design, prompt engineering, tool naming, experiments |

---

## Repo File Map

All meaningful files in this repo. Update this section when files are added or removed.

### Documentation
| File | Purpose |
|------|---------|
| `GOAL.md` | Why the project exists. Ground truth for scope and experiments. Read first. |
| `DECISIONS.md` | All team decisions. Append-only. Read every session. |
| `NOTES.md` | Live blockers, questions, heads-up only. Low trust — verify against git log. |
| `CHANGELOG.md` | Shipped work log. Read only — never edit manually. |
| `README.md` | Installation, tool descriptions, public-facing docs. |
| `AI-COLLABORATION.md` | Full team workflow guide — session flow, rules, commit prefixes. |
| `CLAUDE.md` | This file. Project instructions loaded every session. |

### Plans (in-progress work, not yet committed to code)
| File | Purpose |
|------|---------|
| `plans/claude-automations-optimization.md` | Automation implementation plan (hooks, skills, subagents, GitHub MCP). |
| `plans/experiments-plan.md` | Baseline experiment plan — dummy infra, prompts, runner, scorer. |

### Source
| File | Purpose |
|------|---------|
| `src/index.ts` | MCP server — 6 Terraform CLI wrapper tools (init, validate, plan, apply, state_list, output). |
| `test-mcp.mjs` | Smoke test — spawns MCP server, runs validate and plan against test-infra/. |
| `tsconfig.json` | TypeScript config — ES2022, Node16, strict mode. |
| `package.json` | Dependencies: `@modelcontextprotocol/sdk`, `zod`. DevDeps: `tsx`, `typescript`. |

### Test Infrastructure
| File | Purpose |
|------|---------|
| `test-infra/main.tf` | Minimal null_resource for smoke testing. Not the experiment dummy infra. |

### Experiments (to be created — tracked in issues #12–#16)
| Path | Purpose |
|------|---------|
| `experiments/baseline/dummy-infra/` | 75-resource null_resource project simulating 3-tier AWS deployment. |
| `experiments/baseline/prompts.json` | 10 task prompts + ground truth answers (3 easy, 4 medium, 3 hard). |
| `experiments/baseline/runner.ts` | Anthropic SDK agentic loop — raw CLI mode baseline runner. |
| `experiments/baseline/scorer.ts` | Category-specific scorer — outputs JSON + markdown summary table. |
| `experiments/baseline/results/` | Experiment output (gitignored except `.gitkeep`). |

### Claude Configuration (`.claude/`)
| File | Purpose |
|------|---------|
| `.claude/commands/start-session.md` | Load full team context at session start. |
| `.claude/commands/commit-decision.md` | Append a decision to DECISIONS.md. |
| `.claude/commands/sync-context.md` | Update NOTES.md with blockers/heads-up. |
| `.claude/commands/end-session.md` | Clean up and push before stopping. |
| `.claude/commands/review-code.md` | Review file/diff against decisions and skill conventions. |
| `.claude/commands/review-design.md` | Validate approach before building. |
| `.claude/commands/review-pr.md` | Full PR review gate before merge. |
| `.claude/skills/terraform-parsing/SKILL.md` | HCL parsing conventions — resources, modules, variables, edges. |
| `.claude/skills/dag-design/SKILL.md` | Graph node/edge format, direction conventions, traversal rules. |
| `.claude/skills/mcp-server-patterns/SKILL.md` | Tool naming, error handling, context efficiency rules. |
| `.claude/skills/context-reduction/SKILL.md` | Traversal depth, what to include/exclude, output format. |
| `.claude/skills/code-review/SKILL.md` | Review framework — severity levels, categories, verdict rules. |

---

## Context File Hierarchy

Trust these sources in this order. Higher = more authoritative.

| # | Source | Trust | Notes |
|---|--------|-------|-------|
| 1 | `git log` | Highest | Always current, automatic, never wrong |
| 2 | `GOAL.md` | Ground truth | Why we exist. Read before DECISIONS.md. |
| 3 | `DECISIONS.md` | Ground truth | What we agreed on. Append only. |
| 4 | `NOTES.md` | Low | Only for things git cannot tell you |
| 5 | `CHANGELOG.md` | Reference | Shipped work only. Read only. |
| 6 | GitHub Project #1 | Live state | Issue status, sprint assignment, priority |

**If git log and NOTES.md disagree — trust git log.**

## GitHub Project

**Project:** [42](https://github.com/users/KalharPandya/projects/1) — tracks all issues for this repo.

| Field | Values | Used for |
|-------|--------|----------|
| Status | Todo / In Progress / Done | What is being worked on right now |
| Priority | P0 / P1 / P2 | P0 = blocks everything, P1 = this sprint, P2 = backlog |
| Size | XS / S / M / L / XL | Effort estimate |
| Iteration | Sprint 1 (Mar 28) / Sprint 2 (Apr 11) / Sprint 3 (Apr 25) | 2-week cycles |

**Rules:**
- Move an issue to **In Progress** the moment you start work on it
- Move it to **Done** when the work is committed and pushed
- Set **Priority** when creating or picking up an issue
- Decision issues (#7–#11) move to Done when `/commit-decision` is run for them
- Experiment issues (#12–#16) are owned by ShahParin, Sprint 1

---

## Reading Priority at Session Start

1. Read `GOAL.md` — understand why the project exists before reading anything else
2. Read **teammates' NOTES.md sections first** — their context is more important than yours
3. Read `DECISIONS.md` fully — non-negotiable
4. Check `git log --oneline --since="48 hours ago" --all`
5. Read **your own NOTES.md section last** — treat it as a hint, verify against git log

**Your own yesterday context is the least important thing you read.**

---

## Rules

- Read `DECISIONS.md` at the start of **every session without exception**
- Run `/commit-decision` immediately after **any** design decision
- Only write to **your own section** in `NOTES.md`
- Never treat `NOTES.md` as reliable — verify against `git log`
- `NOTES.md` is only for: **blockers**, **live questions**, **heads-up warnings**
- `CHANGELOG.md` is **read only** — never edit manually
- MCP tool names use **verb_noun format only** (e.g., `get_subgraph`, not `getSubgraph`)
- Never make a design decision without committing it immediately

---

## Commands Available

| Command | Purpose |
|---------|---------|
| `/start-session` | Load full team context at the start of every day |
| `/commit-decision` | Commit a decision to `DECISIONS.md` immediately |
| `/sync-context` | Update `NOTES.md` with current blockers and heads-up |
| `/end-session` | Clean up and push before stopping work |
| `/review-code` | Review a file or diff against decisions and skill conventions |
| `/review-design` | Review a proposed approach before building it |
| `/review-pr` | Full PR review across all changed files — gate before merge |

---

## Prompt Structure

Use this format for every prompt to Claude during a session:

```
Context: [file or area you are working in]
Goal: [what you are trying to achieve]
Decision: [relevant DECISIONS.md entry — or "none"]
Ask: [specific question or task]
```

---

## Skills Available

Skills load automatically when you are working in that domain.
Check `.claude/skills/` for domain-specific knowledge.

| Skill | Triggers when... |
|-------|-----------------|
| `terraform-parsing` | Reading, parsing, or discussing `.tf` files |
| `dag-design` | Building, querying, or discussing the DAG |
| `mcp-server-patterns` | Building, discussing, or reviewing MCP tools |
| `context-reduction` | Deciding what subgraph to return to an LLM |
| `code-review` | Conducting any review — code, design, or PR |

---

## The Core Rule

> Your teammates' context is more important than your own.
> Read theirs first. Always.
