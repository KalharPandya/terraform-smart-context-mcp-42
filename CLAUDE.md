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

## Context File Hierarchy

Trust these sources in this order. Higher = more authoritative.

| # | Source | Trust | Notes |
|---|--------|-------|-------|
| 1 | `git log` | Highest | Always current, automatic, never wrong |
| 2 | `DECISIONS.md` | Ground truth | What we agreed on. Append only. |
| 3 | `NOTES.md` | Low | Only for things git cannot tell you |
| 4 | `CHANGELOG.md` | Reference | Shipped work only. Read only. |

**If git log and NOTES.md disagree — trust git log.**

---

## Reading Priority at Session Start

1. Read **teammates' NOTES.md sections first** — their context is more important than yours
2. Read `DECISIONS.md` fully — non-negotiable
3. Check `git log --oneline --since="48 hours ago" --all`
4. Read **your own NOTES.md section last** — treat it as a hint, verify against git log

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
