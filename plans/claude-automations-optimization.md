# Plan: Claude Code Automations + GitHub Integration

## Context

Project 42 (Terraform MCP Server) has a strong collaboration structure (7 commands, 5 skills, DECISIONS.md/NOTES.md workflow) but lacks automated enforcement. Team rules like "DECISIONS.md is append-only" and "CHANGELOG.md is read-only" are documented but not structural. There's no automated type-checking after edits, no tool scaffolding, no scope enforcement, and no GitHub integration for issue tracking.

This plan adds: 2 hooks, 2 skills, 1 subagent, GitHub MCP server, and 11 GitHub issues.

**Current state:** Docker is available. `gh` CLI installed (v2.89.0), authenticated as KalharPandya. `context7` plugin already enabled globally (skip). No `.mcp.json`, no `.claude/agents/`, no hooks configured.

## GitHub Project Board

**Project:** [42](https://github.com/users/KalharPandya/projects/1) — all 11 issues are already added.

| Field | Values | IDs (for `gh` API) |
|-------|--------|--------------------|
| Status | Todo / In Progress / Done | `f75ad846` / `47fc9ee4` / `98236657` |
| Priority | P0 / P1 / P2 | `e5ec1504` / `e0db157d` / `d144e196` |
| Size | XS / S / M / L / XL | `cf191044` / `da5c4432` / `7f68e0d8` / `2735bfb1` / `2f59d72b` |
| Status field ID | — | `PVTSSF_lAHOA_Tuhs4BTFq_zhAbqaA` |
| Priority field ID | — | `PVTSSF_lAHOA_Tuhs4BTFq_zhAbqdE` |
| Size field ID | — | `PVTSSF_lAHOA_Tuhs4BTFq_zhAbqdI` |
| Project node ID | — | `PVT_kwHOA_Tuhs4BTFq_` |

**Board rule for every phase:** move the linked issue to **In Progress** when starting, **Done** when committed and pushed.

```bash
# Move issue to In Progress (replace PVTI_... with the item's node ID)
gh project item-edit --project-id PVT_kwHOA_Tuhs4BTFq_ \
  --id <PVTI_item_id> \
  --field-id PVTSSF_lAHOA_Tuhs4BTFq_zhAbqaA \
  --single-select-option-id 47fc9ee4

# Move issue to Done
gh project item-edit --project-id PVT_kwHOA_Tuhs4BTFq_ \
  --id <PVTI_item_id> \
  --field-id PVTSSF_lAHOA_Tuhs4BTFq_zhAbqaA \
  --single-select-option-id 98236657
```

---

## Phase 1: Create Hook Scripts

**GitHub issues:** #1 (tsc hook), #2 (protect hook)
**Item IDs:** `PVTI_lAHOA_Tuhs4BTFq_zgokb5s` (#1), `PVTI_lAHOA_Tuhs4BTFq_zgokb5w` (#2)
**Board action:** Move both to In Progress when starting. Move to Done after Phase 2 is complete.

### File: `.claude/hooks/tsc-check.mjs` (NEW)
PostToolUse hook — runs `tsc --noEmit` after any `.ts` file edit.

- Reads tool input JSON from stdin (`tool_input.file_path`)
- Skips non-`.ts` files (exit 0)
- Runs `npx tsc --noEmit` in project root
- On errors: exit 2 with first 30 lines (sends feedback to Claude)
- On success: exit 0

### File: `.claude/hooks/protect-readonly-files.mjs` (NEW)
PreToolUse hook — blocks direct edits to protected files.

- `CHANGELOG.md` → exit 2: "BLOCKED: read-only. Use /end-session."
- `DECISIONS.md` → exit 2: "BLOCKED: append-only. Use /commit-decision."
- Everything else → exit 0

---

## Phase 2: Wire Hooks into Settings

### File: `.claude/settings.local.json` (MODIFY)
Add `hooks` key alongside existing `permissions`. Preserve all existing permissions exactly.

```json
"hooks": {
  "PostToolUse": [{
    "matcher": "Edit|Write",
    "hooks": [{"type": "command", "command": "node P:/42-Terraform-MCP/.claude/hooks/tsc-check.mjs"}]
  }],
  "PreToolUse": [{
    "matcher": "Edit",
    "hooks": [{"type": "command", "command": "node P:/42-Terraform-MCP/.claude/hooks/protect-readonly-files.mjs"}]
  }]
}
```

---

## Phase 3: Create Skills

**GitHub issues:** #3 (add-tool skill), #4 (scope-guard skill)
**Item IDs:** `PVTI_lAHOA_Tuhs4BTFq_zgokb50` (#3), `PVTI_lAHOA_Tuhs4BTFq_zgokb54` (#4)
**Board action:** Move to In Progress when starting each skill. Move to Done after the SKILL.md is committed.

### File: `.claude/skills/add-tool/SKILL.md` (NEW)
User-invocable `/add-tool` — scaffolds a new MCP tool block in `src/index.ts`.

- Asks for: tool name (enforce `verb_noun`), description (under 20 words), inputs
- Checks for name conflicts via grep
- Generates `server.registerTool(...)` block with zod schema + try/catch
- Inserts before `// --- Start` comment in `src/index.ts`
- Runs `tsc --noEmit` to verify, reminds to run `/review-code`

### File: `.claude/skills/scope-guard/SKILL.md` (NEW)
Claude-auto-invoked (`user-invocable: false`) — checks proposals against GOAL.md v1 out-of-scope list.

Out-of-scope patterns:
- Distributed scaling / concurrent provisioning / state locking
- Autonomous agent orchestration
- Saga-based rollback / multi-step workflows
- Real cloud infrastructure in experiments
- Provider documentation lookups

Outputs `SCOPE ALERT` with A/B choice before any implementation proceeds.

---

## Phase 4: Create Subagent

**GitHub issue:** #5 (tool-schema-reviewer)
**Item ID:** `PVTI_lAHOA_Tuhs4BTFq_zgokb58`
**Board action:** Move to In Progress when starting. Move to Done after agent file is committed.

### Directory: `.claude/agents/` (NEW)
### File: `.claude/agents/tool-schema-reviewer.md` (NEW)

Validates `server.registerTool()` blocks against mcp-server-patterns skill:

| Check | Severity |
|-------|----------|
| `verb_noun` name format | BLOCKING |
| Description ≤ 20 words | BLOCKING |
| Complete zod `inputSchema` | BLOCKING |
| try/catch with structured error return | BLOCKING |
| Unbounded response risk | WARNING |

Output: per-tool BLOCKING/WARNING/PASS table + verdict.

---

## Phase 5: GitHub MCP Server

**GitHub issue:** #6 (GitHub MCP)
**Item ID:** `PVTI_lAHOA_Tuhs4BTFq_zgokb6A`
**Board action:** Move to In Progress when starting. Move to Done after `.mcp.json` is committed and pushed.

### File: `.mcp.json` (NEW — project root, committed to git for team sharing)

Docker is available, so use the official GitHub MCP server image:

```json
{
  "mcpServers": {
    "github": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "ghcr.io/github/github-mcp-server"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    }
  }
}
```

**Prerequisite:** User must create a GitHub PAT at github.com/settings/tokens (scopes: `repo`, `read:org`) and set it:
```
setx GITHUB_PERSONAL_ACCESS_TOKEN "ghp_..."
```

---

## Phase 6: Install `gh` CLI + Create GitHub Issues

### Step 1: Install and authenticate
```bash
winget install GitHub.cli
# restart terminal
gh auth login  # GitHub.com, HTTPS, browser auth
```

### Step 2: Create `decision` label
```bash
gh label create decision --repo KalharPandya/terraform-smart-context-mcp-42 --color "0075ca" --description "Architecture decisions requiring team resolution"
```

### Step 3: Create 11 GitHub issues

**Automation issues (label: enhancement):**

| # | Title |
|---|-------|
| 1 | feat: tsc --noEmit PostToolUse hook for TypeScript error detection |
| 2 | feat: PreToolUse hook to protect DECISIONS.md and CHANGELOG.md |
| 3 | feat: add-tool skill for MCP tool scaffolding |
| 4 | feat: scope-guard skill for v1 scope enforcement |
| 5 | feat: tool-schema-reviewer subagent for pre-commit validation |
| 6 | feat: GitHub MCP server in .mcp.json for team |

**Architecture decision issues (label: decision):**

| # | Title | Source |
|---|-------|--------|
| 7 | decision: define node model — resource vs module, include variables/outputs? | DECISIONS.md Q1 |
| 8 | decision: define edge model — explicit only, implicit only, or both | DECISIONS.md Q2 |
| 9 | decision: select HCL parser library | DECISIONS.md Q3 |
| 10 | decision: define v1 MCP tool list — which tools ship | DECISIONS.md Q4 |
| 11 | decision: define reduced context output JSON schema | DECISIONS.md Q5 |

Each issue gets a body describing the requirement, referencing the relevant skill/DECISIONS.md entry.

---

## Verification

### Hooks
```bash
# tsc hook — should exit 0 on clean .ts file
echo '{"tool_input":{"file_path":"P:/42-Terraform-MCP/src/index.ts"}}' | node .claude/hooks/tsc-check.mjs; echo "exit: $?"

# protect hook — should exit 2 on CHANGELOG.md
echo '{"tool_input":{"file_path":"P:/42-Terraform-MCP/CHANGELOG.md"}}' | node .claude/hooks/protect-readonly-files.mjs; echo "exit: $?"

# protect hook — should exit 0 on normal file
echo '{"tool_input":{"file_path":"P:/42-Terraform-MCP/src/index.ts"}}' | node .claude/hooks/protect-readonly-files.mjs; echo "exit: $?"
```

### Settings JSON validity
```bash
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.local.json','utf8')); console.log('valid')"
```

### Skills and agent file presence
```bash
ls .claude/skills/add-tool/SKILL.md .claude/skills/scope-guard/SKILL.md .claude/agents/tool-schema-reviewer.md
```

### .mcp.json validity
```bash
node -e "JSON.parse(require('fs').readFileSync('.mcp.json','utf8')); console.log('valid')"
```

### GitHub issues
```bash
gh issue list --repo KalharPandya/terraform-smart-context-mcp-42 --limit 15
```

---

## Phase 0 (Do First): Save Plan + Create GitHub Issues

### Step 1: Create `plans/` directory in repo root
Save this plan as `plans/claude-automations.md` in the repo — a proper plans folder that persists.

### Step 2: Install `gh` CLI and authenticate
```bash
winget install GitHub.cli
# restart terminal
gh auth login
```

### Step 3: Create `decision` label + 11 GitHub issues
Each issue references `plans/claude-automations.md` in its body.

### Step 4: Commit plan + push
```bash
git add plans/
git commit -m "Kalhar: feat: add automation implementation plan and plans/ folder"
git push
```

Implementation (Phases 1-6) happens in follow-up work tracked by the issues.

---

## Git Commit (for implementation phases later)

After implementing each phase, commit individually:
```bash
# Phase 1-2: hooks
git add .claude/hooks/ .claude/settings.local.json
git commit -m "Kalhar: feat: add tsc type-check and file-protection hooks"

# Phase 3: skills
git add .claude/skills/add-tool/ .claude/skills/scope-guard/
git commit -m "Kalhar: feat: add add-tool and scope-guard skills"

# Phase 4: subagent
git add .claude/agents/
git commit -m "Kalhar: feat: add tool-schema-reviewer subagent"

# Phase 5: GitHub MCP
git add .mcp.json
git commit -m "Kalhar: feat: add GitHub MCP server config"
```

---

## Files Summary

| File | Action | Phase |
|------|--------|-------|
| `plans/claude-automations.md` | CREATE | 0 |
| `.claude/hooks/tsc-check.mjs` | CREATE | 1 |
| `.claude/hooks/protect-readonly-files.mjs` | CREATE | 1 |
| `.claude/settings.local.json` | MODIFY (add hooks) | 2 |
| `.claude/skills/add-tool/SKILL.md` | CREATE | 3 |
| `.claude/skills/scope-guard/SKILL.md` | CREATE | 3 |
| `.claude/agents/tool-schema-reviewer.md` | CREATE | 4 |
| `.mcp.json` | CREATE | 5 |

## Prerequisites (user action required before Phase 5-6)
1. GitHub PAT set as env var: `setx GITHUB_PERSONAL_ACCESS_TOKEN "ghp_..."`
2. `winget install GitHub.cli` → `gh auth login`
