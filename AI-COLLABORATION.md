# AI Collaboration Guide

How this team works with Claude Code on the Terraform Smart Context MCP Server.
Read this fully before your first session. Keep it open as a reference.

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [System Overview](#system-overview)
3. [File Hierarchy](#file-hierarchy)
4. [Session Flow](#session-flow)
5. [Daily Workflow](#daily-workflow)
6. [Commands](#commands)
7. [Skills](#skills)
8. [Team Rules](#team-rules)
9. [Quick Reference](#quick-reference)

---

## Philosophy

This system is built on one principle: **your teammates' context is more important than your own.**

Every convention in this repo follows from that. Read their context first. Commit decisions immediately so they have it. Keep NOTES.md clean so the signal-to-noise ratio stays high.

Three things that follow directly from this:

- **git log is always truth.** It is automatic, timestamped, and never wrong. When anything conflicts with git log, trust git log.
- **Decisions committed are decisions made.** If it is not in DECISIONS.md, the team has not agreed on it — regardless of what was said in Slack or standup.
- **NOTES.md is a warning board, not a diary.** Write only what git cannot tell your teammates. Clear it the moment it is no longer true.

---

## System Overview

```
project-root/
├── CLAUDE.md                          # Project instructions — loaded every session
├── DECISIONS.md                       # Team agreements — append only, never edit
├── NOTES.md                           # Live blockers, questions, heads-up only
├── CHANGELOG.md                       # Shipped work — read only, never edit manually
├── AI-COLLABORATION.md                # This file
└── .claude/
    ├── commands/
    │   ├── start-session.md           # /start-session
    │   ├── commit-decision.md         # /commit-decision
    │   ├── sync-context.md            # /sync-context
    │   └── end-session.md             # /end-session
    └── skills/
        ├── terraform-parsing/
        │   └── SKILL.md               # Auto-loads when working with .tf files
        ├── dag-design/
        │   └── SKILL.md               # Auto-loads when working on the DAG
        ├── mcp-server-patterns/
        │   └── SKILL.md               # Auto-loads when building MCP tools
        └── context-reduction/
            └── SKILL.md               # Auto-loads when deciding what to return to LLMs
```

**How it fits together:** CLAUDE.md is loaded into every Claude session automatically. Commands are slash commands you run explicitly. Skills are loaded automatically by Claude when your work touches that domain — you do not need to invoke them manually.

---

## File Hierarchy

Trust these sources in this order. Higher means more authoritative.

| Priority | Source | Trust Level | Notes |
|----------|--------|-------------|-------|
| 1 | `git log` | Highest | Automatic, timestamped, never wrong |
| 2 | `DECISIONS.md` | Ground truth | What the team agreed on — append only |
| 3 | `NOTES.md` | Low | Only for things git cannot tell you |
| 4 | `CHANGELOG.md` | Reference | Shipped work only — read only |

**If git log and NOTES.md disagree, trust git log and update NOTES.md.**

### CLAUDE.md
Loaded automatically at the start of every Claude session. Contains the project purpose, tech stack, file hierarchy, rules, and available commands and skills. Do not put decisions or live state here — that belongs in DECISIONS.md and NOTES.md.

### DECISIONS.md
The single source of truth for everything the team has agreed on. Append only — never edit or delete existing entries. If a decision is not in here, it is not a decision. Run `/commit-decision` immediately after any design decision, no matter how small.

### NOTES.md
A warning board for things that git cannot communicate. Three sections only: Open Blockers, Live Questions, Heads Up. Write only to your own section. Clear entries the moment they are resolved. Never let this file become a journal or a status update — git log handles that.

### CHANGELOG.md
Records shipped features. Never edit this manually. It is updated only via `/end-session` when work ships. If you find yourself wanting to edit it directly, stop — that is a sign you are doing it wrong.

---

## Session Flow

Every session follows the same five phases. Do not skip phases — each one
protects the next.

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1 — START                                                │
│                                                                 │
│  /start-session                                                 │
│    ├── git pull                                                 │
│    ├── git log last 48h → what changed, who touched what        │
│    ├── DECISIONS.md → load all team agreements                  │
│    └── NOTES.md → teammates first, your section last           │
│                                                                 │
│  → Tell Claude what you are working on today                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2 — BEFORE BUILDING                                      │
│                                                                 │
│  /review-design                                                 │
│    ├── Submit your proposed approach using the prompt structure │
│    ├── Claude checks DECISIONS.md for conflicts                 │
│    ├── Claude checks relevant domain skills                     │
│    ├── Claude surfaces any implied unresolved decisions         │
│    └── Verdict: PASS → continue │ FAIL → revise first          │
│                                                                 │
│  /commit-decision  (for any implied decisions surfaced above)   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3 — DURING DEVELOPMENT                         (repeat) │
│                                                                 │
│  Every Claude prompt uses the team prompt structure:            │
│    Context / Goal / Decision / Ask                              │
│                                                                 │
│  After ANY design decision →  /commit-decision immediately      │
│                                                                 │
│  If you become blocked →      /sync-context                     │
│  If sharing a heads-up →      /sync-context                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4 — BEFORE COMMITTING / MERGING                          │
│                                                                 │
│  /review-code   ← run on every file before committing           │
│    ├── BLOCKING finding → fix before commit                     │
│    ├── WARNING finding  → fix or log as blocker                 │
│    └── PASS             → commit                                │
│                                                                 │
│  /review-pr     ← run before any merge to main                  │
│    ├── FAIL             → resolve all BLOCKING, re-review       │
│    ├── PASS WITH WARNINGS → decide: fix or log as Heads Up     │
│    └── PASS             → merge                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 5 — END                                                  │
│                                                                 │
│  /end-session                                                   │
│    ├── Commit or stash any open work                            │
│    ├── /sync-context → clear resolved blockers and questions    │
│    ├── /commit-decision → for any answered Live Questions       │
│    ├── git log -5 → summary of what you shipped today           │
│    └── Push → teammates get your context on next git pull       │
└─────────────────────────────────────────────────────────────────┘
```

### Decision points at a glance

| Moment | Action |
|--------|--------|
| Start of session | `/start-session` — non-negotiable |
| Before writing any code | `/review-design` |
| Any design decision made | `/commit-decision` — immediately |
| Blocked or have a heads-up | `/sync-context` |
| Before committing a file | `/review-code` |
| Before merging to main | `/review-pr` |
| End of session | `/end-session` — non-negotiable |

---

## Daily Workflow

### Starting a session

1. Run `/start-session` — this pulls latest, reads git log, reads DECISIONS.md, reads NOTES.md (teammates first), and gives you a summary of what the team has been doing.
2. Tell Claude what you are working on today.
3. Claude will flag any decisions, blockers, or heads-up warnings relevant to your work.

**Do not skip `/start-session`.** The entire point of this system is shared context. Starting without it means you are working blind.

### During a session

- The moment you make any design decision — run `/commit-decision`. Do not batch decisions. Do not wait until end of day. Commit each one immediately so teammates have it.
- If you become blocked or have a question that needs a team answer — run `/sync-context` to write it to NOTES.md and push it.
- If you are about to change a shared interface, type, or file that others may be touching — add a Heads Up entry via `/sync-context` before you start.

### Ending a session

1. Run `/end-session` — this checks for uncommitted work, syncs NOTES.md, clears stale entries, closes answered questions, and shows a summary of what you shipped.
2. Do not stop working without running this. Uncommitted context blocks teammates.

---

## Prompt Structure

Use this format for every prompt to Claude during a session. Consistency means Claude gets the same quality of context from every teammate.

```
Context: [file or area you are working in]
Goal: [what you are trying to achieve]
Decision: [relevant DECISIONS.md entry — or "none"]
Ask: [specific question or task]
```

**Example:**
```
Context: src/parser.ts, building the HCL resource extractor
Goal: extract implicit dependency edges from attribute references
Decision: nodes are resource_type.resource_name format [Alice 2026-03-20]
Ask: how should I handle a reference inside a dynamic block?
```

The `Decision` field is the key one — it forces you to check DECISIONS.md before prompting and prevents Claude from suggesting approaches the team has already ruled out. Fold scope constraints into `Ask` directly: *"...without touching surrounding code"* or *"v1 scope only"*.

---

## Commands

Commands are slash commands you run inside a Claude Code session. Each one is a markdown file in `.claude/commands/` that Claude follows as step-by-step instructions.

### /start-session

**Run at the start of every session before touching any code.**

What it does:
1. Pulls latest from remote
2. Summarizes git log for the last 48 hours — what changed, who touched what
3. Shows which files differ from main on your current branch
4. Reads DECISIONS.md fully and flags anything relevant to your work
5. Reads NOTES.md — teammates' sections first, your section last
6. Flags blockers and heads-up warnings that affect you
7. Gives a single consolidated summary of team state
8. Asks what you are working on today

### /commit-decision

**Run immediately after any design decision.**

What it does:
1. Asks for the decision in one sentence
2. Asks who made it and today's date
3. Checks DECISIONS.md for conflicts — stops and flags if one exists
4. Appends the decision to DECISIONS.md
5. Removes the question from NOTES.md Live Questions if it answers one
6. Commits and pushes both files immediately
7. Confirms teammates will see it on next `git pull`

Format written to DECISIONS.md:
```
[NAME YYYY-MM-DD] decision summary in one sentence
```

### /sync-context

**Run when your status changes and git cannot communicate it.**

What it does:
1. Asks if you are blocked — adds or clears your Open Blockers entry
2. Asks if you have questions needing a team answer — adds or clears your Live Questions entry
3. Asks if teammates need a heads-up about anything not yet committed — adds or clears your Heads Up entry
4. Commits and pushes NOTES.md
5. Reminds you to run `/end-session` when done

Only sync what git cannot tell the team. Do not summarize code changes here.

### /end-session

**Run before stopping work every session.**

What it does:
1. Checks for uncommitted work — asks what to do with it
2. Runs `/sync-context` to update NOTES.md
3. Clears stale Heads Up entries that are now committed
4. Clears resolved Open Blockers
5. Closes answered Live Questions via `/commit-decision`
6. Shows the last 5 commits as a summary of today's work
7. Confirms session ended cleanly

### /review-code

**Run to review a specific file or diff before committing.**

What it does:
1. Reads the file or diff
2. Identifies which domain skills apply
3. Reads DECISIONS.md and checks for violations
4. Applies the `code-review` skill across six categories: decisions compliance, skill compliance, correctness, context efficiency, security, error handling
5. Outputs a structured review with BLOCKING / WARNING / SUGGESTION findings, each citing a rule
6. Returns a verdict: PASS, PASS WITH WARNINGS, or FAIL
7. If FAIL: offers to fix issues now or log them as blockers via `/sync-context`

### /review-design

**Run to validate a proposed approach before writing any code.**

What it does:
1. Collects the design using the team prompt structure
2. Reads DECISIONS.md fully — checks for conflicts, overlaps, and open questions
3. Identifies domain skills that apply to the design
4. Surfaces any implied decisions hiding inside the design's assumptions
5. Applies the `code-review` skill framework adapted for design (not code)
6. Outputs a structured review with verdict
7. If PASS: prompts to commit any implied decisions before building
8. If FAIL: blocks implementation until design is revised and re-reviewed

### /review-pr

**Run as the gate before any branch merges to main.**

What it does:
1. Gets the full changeset (`gh pr diff` or `git diff main...HEAD`)
2. Reads DECISIONS.md once and checks NOTES.md for active Heads Up warnings
3. Reviews every changed file using the `/review-code` logic
4. Aggregates findings across all files, deduplicating repeated patterns
5. Outputs a full PR report with per-file summary table and overall verdict
6. If FAIL: lists all BLOCKING findings and blocks merge
7. If PASS WITH WARNINGS: asks whether to resolve before merging or log as Heads Up
8. If PASS: confirms clean and reminds to run `/end-session` after merge

---

## Skills

Skills are domain-specific knowledge files loaded automatically by Claude when your work touches that domain. You do not invoke them manually — Claude reads their descriptions at startup and loads the full content when relevant.

Each skill lives at `.claude/skills/<name>/SKILL.md` and contains key concepts, conventions, and gotchas for that domain.

### terraform-parsing

**Auto-loads when:** reading, parsing, or discussing `.tf` files, HCL syntax, resources, modules, variables, outputs, or Terraform dependency declarations.

Covers:
- Resource, module, variable, and output block structure
- The difference between `depends_on` (explicit edge) and attribute references (implicit edge)
- Why HCL is not JSON and must not be treated as such
- Module source variants (local path, registry, git URL)
- How module outputs create implicit inter-module edges

### dag-design

**Auto-loads when:** building, querying, designing, or discussing the DAG structure, node conventions, edge types, or graph traversal.

Covers:
- Node ID format: `resource_type.resource_name` for resources, `module.module_name` for modules
- Required fields on every node: `id`, `type`, `config`, `metadata`
- Edge direction convention: dependent → dependency
- Required fields on every edge: `from`, `to`, `type`, `source`
- How to handle circular dependencies without crashing
- How to deduplicate edges while preserving both type labels

### mcp-server-patterns

**Auto-loads when:** building, reviewing, or discussing MCP tools — naming, structure, error handling, or context efficiency.

Covers:
- Tool naming: `verb_noun` format only, no exceptions
- Required fields on every tool: `name`, `description`, `inputSchema`, `handler`
- Error handling: never throw, always return structured error objects
- Context efficiency: keep descriptions short, return only what the LLM needs
- Input validation before any processing

### context-reduction

**Auto-loads when:** deciding what subgraph to return to an LLM — traversal depth, inclusions, exclusions, or output format.

Covers:
- Default traversal depth: 2 hops, never exceed 3 without explicit request
- What to include: queried node, direct dependencies, direct dependents
- What to exclude: unrelated resources, full module internals, internal metadata, duplicate edges
- Output format: minimal JSON per node and edge, plus a human-readable summary
- The core rule: when in doubt, return less and let the LLM ask for more

### code-review

**Auto-loads when:** conducting any review — code, design, or PR.

This is the meta-framework skill. It defines *how* to review — the domain skills define *what* correct looks like. Always applied alongside the relevant domain skill(s).

Covers:
- Severity levels: BLOCKING (must fix), WARNING (should fix), SUGGESTION (optional)
- Rule citation requirement: every finding must cite a DECISIONS.md entry or skill convention — no subjective feedback
- Six review categories: decisions compliance, skill compliance, correctness, context efficiency, security, error handling
- Structured output format used by all three review commands
- Verdict rules: FAIL if any BLOCKING, PASS WITH WARNINGS if any WARNING, PASS if clean

---

## Team Rules

These apply to everyone on the team, every session.

**Context reading order**
- Read DECISIONS.md at the start of every session — no exceptions
- Read teammates' NOTES.md sections before your own
- Check `git log --since="48 hours ago"` — more reliable than any NOTES.md entry
- Treat your own NOTES.md section as a hint, not ground truth

**Decisions**
- Run `/commit-decision` immediately after any design decision
- Never batch decisions — commit each one as it happens
- Never make a design decision in a vacuum — check DECISIONS.md for conflicts first
- If it is not in DECISIONS.md, it is not a decision

**NOTES.md**
- Only write to your own section
- Only write what git cannot tell the team
- Clear your entries the moment they are resolved
- Never let a Live Question sit unanswered for more than 24 hours

**Code**
- MCP tool names: `verb_noun` format only — `get_subgraph`, not `getSubgraph`
- Never edit CHANGELOG.md manually

---

## Quick Reference

### Commands

| Command | When to run | What it does |
|---------|-------------|--------------|
| `/start-session` | Start of every session | Pulls, reads team context, summarizes, asks your plan |
| `/commit-decision` | After any design decision | Writes to DECISIONS.md, commits, pushes immediately |
| `/sync-context` | Status changes mid-session | Updates your NOTES.md section, commits, pushes |
| `/end-session` | Before stopping work | Cleans up, syncs context, shows session summary |
| `/review-code` | Before committing a file | Reviews against decisions and conventions, returns verdict |
| `/review-design` | Before writing any code | Validates approach, surfaces implied decisions |
| `/review-pr` | Before merging to main | Full review across all changed files, gate for merge |

### Skills

| Skill | Auto-loads when you are working on... |
|-------|--------------------------------------|
| `terraform-parsing` | `.tf` files, HCL, resources, modules, variables, outputs |
| `dag-design` | Nodes, edges, graph traversal, DAG structure |
| `mcp-server-patterns` | MCP tools, tool naming, error handling, input schema |
| `context-reduction` | Subgraph selection, traversal depth, response format |
| `code-review` | Any review — code, design, or PR |

### Files

| File | Write? | Purpose |
|------|--------|---------|
| `CLAUDE.md` | No | Project instructions loaded every session |
| `DECISIONS.md` | Append only | Team agreements — never edit existing entries |
| `NOTES.md` | Your section only | Blockers, live questions, heads-up — nothing else |
| `CHANGELOG.md` | Never manually | Shipped work — updated only via `/end-session` |

### NOTES.md entry formats

```
# Open Blockers
[NAME YYYY-MM-DD] blocked on: what, waiting for: who

# Live Questions
[NAME YYYY-MM-DD] question that needs a team answer

# Heads Up
[NAME YYYY-MM-DD] warning about something not yet in git
```

### DECISIONS.md entry format

```
[NAME YYYY-MM-DD] decision summary in one sentence
```

### Commit message prefixes used in this repo

| Prefix | Used for |
|--------|----------|
| `feat:` | New capability or file added |
| `decision:` | A team decision committed to DECISIONS.md |
| `context:` | NOTES.md sync commit from `/sync-context` |
| `fix:` | Bug fix |
