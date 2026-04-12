# Plan: Codex CLI Experiment Runner

**File to create:** `experiments/baseline/runner-codex.ts`

**Goal:** Run the same 30 prompts from `prompts.json` through OpenAI Codex CLI in
`raw` and `mcp` modes, capture the same `TrialResult` schema that `scorer.ts` expects,
and store results in `experiments/baseline/results/` alongside the Claude results.

---

## Key Differences From `runner.ts`

| Concern | Claude runner | Codex runner |
|---------|---------------|--------------|
| Binary | `claude` | `codex` |
| Invocation | `claude -p "..." --output-format stream-json` | `codex exec --json --full-auto --skip-git-repo-check --ephemeral -C <dir> "..."` |
| MCP config | JSON file passed via `--mcp-config` | TOML `config.toml` in `CODEX_HOME` dir |
| Tool restriction (raw) | `--tools Bash --allowedTools Bash` | No MCP servers in `CODEX_HOME/config.toml` |
| Tool restriction (mcp) | `--tools mcp__... --allowedTools mcp__...` | MCP server in `CODEX_HOME/config.toml` |
| Output format | Claude stream-json events | Codex JSONL events |
| Cost | `total_cost_usd` in result event | Not available — `cost_usd = 0` |
| Model | `sonnet` | `gpt-5.4` (Codex default) |
| Windows | `shell: true` + stdin pipe trick | `shell: true`, prompt via stdin |
| Metadata key | `claude_cli_version` | `codex_cli_version` |

---

## Config Isolation Strategy

**Problem:** Codex project-scoped `.codex/config.toml` requires "trusted projects" —
we can't reliably write a per-trial project config. The global `~/.codex/config.toml`
would affect all runs.

**Solution:** Use `CODEX_HOME` env var to point each trial at a temporary directory
with a custom `config.toml`. This gives complete isolation:

```
CODEX_HOME=/tmp/exp-<uuid>/codex-home  →  /tmp/exp-<uuid>/codex-home/config.toml
```

- **Raw mode:** `config.toml` = empty (no `[mcp_servers.*]` sections)
- **MCP mode:** `config.toml` = terraform server pointing at `dist/index.js`

The temp `CODEX_HOME` dir is created per-trial and cleaned up after.

---

## TOML Config Templates

### Raw mode (`config.toml`)
```toml
# No MCP servers — raw bash mode
```

### MCP mode (`config.toml`)
```toml
[mcp_servers.terraform]
command = "node"
args = ["P:/42-Terraform-MCP/dist/index.js"]
tool_timeout_sec = 120
startup_timeout_sec = 30

[mcp_servers.terraform.env]
TERRAFORM_MCP_GATE = "read"
```

---

## Codex JSONL Event Schema

With `--json`, Codex emits one JSON object per line. Key events to parse:

| Event type | When | What to extract |
|-----------|------|-----------------|
| `turn.completed` | End of agent turn | may contain usage stats |
| `item.agent_message` or similar | Assistant text | final answer (last one) |
| `item.mcp_tool_call` | MCP tool invoked | tool name, input, output |
| `item.command_execution` | Shell command run | command text, output |
| `thread.completed` / `turn.failed` | Session end | stop reason |

**Note:** The exact JSONL schema is not fully documented. The parser will:
1. Print a `--dump-raw` mode that saves the raw JSONL to a debug file
2. Use defensive parsing — skip unknown events, never crash
3. Fall back to capturing everything as the final answer if no `agent_message` found

The runner will include a `--dump-raw` flag for discovery during initial testing.

---

## Result File Schema

Output files follow the same top-level shape as Claude results:

```typescript
interface RunResult {
  metadata: {
    mode: "raw" | "mcp";
    model: string;             // "gpt-5.4" or from --json header
    timestamp: string;
    infra_path: string;
    trials_per_prompt: number;
    total_prompts: number;
    codex_cli_version: string; // from `codex --version`
  };
  results: PromptResult[];     // same PromptResult / TrialResult as Claude
}
```

`TrialResult` fields:
- `cost_usd`: always `0` (Codex doesn't report cost in JSONL)
- `mcp_tools_used`: tool names from `item.mcp_tool_call` events
- `files_accessed`: extracted from `command_execution` commands (cat/head/tail)
- `terraform_commands`: extracted from `command_execution` commands

Output file names:
- `results/codex-raw-<timestamp>.json`
- `results/codex-mcp-<timestamp>.json`

---

## System Prompts

### Raw mode
Same as Claude runner's `RAW_SYSTEM_PROMPT` — use terraform CLI + file reading, no MCP.

### MCP mode
Adapted for Codex + unified tool:
```
You are an infrastructure assistant. The Terraform project is in the current directory.
The project is already initialized and applied (75 resources across 6 modules).

You have access to one MCP tool: terraform. Use the "type" parameter to pick the operation.
Start with type: "schema" to discover available queries, then use type: "query"
for dependency/relationship questions.

Rules:
- Use ONLY the terraform MCP tool. Do NOT run shell commands or read files.
- Synthesize your answer clearly.
```

---

## CLI Usage (mirrors runner.ts)

```bash
npx tsx experiments/baseline/runner-codex.ts                        # all prompts, 2 trials, raw
npx tsx experiments/baseline/runner-codex.ts --mode mcp             # MCP mode
npx tsx experiments/baseline/runner-codex.ts --prompt 6             # single prompt
npx tsx experiments/baseline/runner-codex.ts --trials 1             # 1 trial
npx tsx experiments/baseline/runner-codex.ts --mode raw --live      # live event log
npx tsx experiments/baseline/runner-codex.ts --mode mcp --dump-raw  # debug JSONL events
```

---

## Key Functions to Write

1. **`findCodexBin()`** — detect `codex` binary (Windows: return `"codex"`, use `shell: true`)
2. **`writeCodexConfig(mode, codexHomeDir)`** — write TOML `config.toml` to `codexHomeDir`
3. **`parseCodexJsonl(rawOutput)`** — parse JSONL, extract answer/tools/tokens
4. **`runTrial(...)`** — spawn `codex exec`, collect JSONL, return `TrialResult`
5. **`main()`** — arg parsing, trial loop, write results JSON

Reuse from `runner.ts` (copy verbatim or import):
- `PromptEntry`, `PromptsFile`, `TrialResult`, `ToolCallRecord`, `PromptResult` types
- `createTempInfraDir()` + `copyTfFiles()`
- `extractFilesAccessed()`, `extractTerraformCommands()`, `extractMcpTools()`
- Color constants (`C`)
- Trial delay logic

---

## Open Questions (resolve with `--dump-raw` on first run)

1. Exact JSONL field names for `agent_message` content
2. Whether token counts appear per-event or only in a summary event
3. Whether `--ephemeral` prevents `CODEX_HOME` writes (if so, drop it)
4. Whether Codex picks up `CODEX_HOME` per-process or reads config once at startup

---

## Scorer Compatibility

`scorer.ts` reads `PromptResult[].trials[]` and calls `scoreAnswer(trial.answer, scoring)`.
The Codex runner writes the **identical** `PromptResult` / `TrialResult` shape —
no changes to `scorer.ts` needed.

To score Codex results:
```bash
npx tsx experiments/baseline/scorer.ts experiments/baseline/results/codex-mcp-<timestamp>.json
```
