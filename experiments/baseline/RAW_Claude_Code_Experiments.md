# RAW Claude Code Experiments

> **Purpose:** Document the runner design, research findings, and experiment results for the raw CLI baseline.
> This is the "before" measurement — Claude with only a terminal, no MCP tools.
> Updated each time a run completes.

---

## Runner Design

### Approach: Claude Code CLI Headless Mode

The experiment runner uses **Claude Code CLI** (`claude -p`) in headless mode rather than the Anthropic SDK directly.

**Why Claude Code CLI over raw SDK:**
- Built-in metrics output: tokens, cost, duration in a single JSON blob via `--output-format json`
- Tool call tracking via `--output-format stream-json` (each tool use emits a `tool_use` event)
- Reproducible environment: `--bare` skips CLAUDE.md, hooks, skills — clean isolation per run
- Cost guard: `--max-budget-usd` stops runaway runs automatically
- Simpler runner.ts: no agentic loop to implement manually — Claude Code handles the loop

**Key flags used per trial:**

```bash
claude \
  -p "<task prompt>" \
  --allowedTools "Bash" \
  --output-format json \
  --max-turns 10 \
  --max-budget-usd 2.00 \
  --bare
```

`--bare` ensures Claude does not load any project context (no CLAUDE.md, no skills, no MCP servers). This isolates the raw CLI baseline from any project-specific intelligence.

---

## Temporary Directory Design

Each experiment trial runs in an isolated temporary directory:

1. Create `os.tmpdir()/exp-<uuid>/`
2. Copy all `.tf` files from `dummy-infra/` recursively — preserving module structure
3. **Exclude:** `README.md`, `.gitignore`, `terraform.tfvars` (optional), any `.md` files
4. Run `terraform init` (once per prompt, shared across 3 trials)
5. Run `terraform apply -auto-approve` (once, state persists across trials in temp dir)
6. Run `claude -p` with `cwd` = temp dir for each trial
7. Delete temp dir after all trials for that prompt complete

**Why temp dir instead of dummy-infra directly:**
- Prevents Claude from reading `dummy-infra/README.md` which describes the structure
- Prevents Claude from reading `prompts.json` ground truth
- Each prompt gets a fresh state — no state pollution between prompts
- Clean baseline: Claude only sees `.tf` files and Terraform state, nothing else

---

## Metrics Collected Per Trial

| Metric | Source | Used For |
|--------|--------|----------|
| `tokens_in` | `json.usage.input_tokens` | Token cost measurement |
| `tokens_out` | `json.usage.output_tokens` | Token cost measurement |
| `total_tokens` | `tokens_in + tokens_out` | Primary efficiency metric |
| `cost_usd` | `json.cost` | Budget tracking |
| `wall_time_ms` | `json.duration` | Time taken metric |
| `tool_calls` | count of `tool_use` in stream | Tool call metric |
| `answer` | `json.result` | Accuracy scoring input |
| `session_id` | `json.session_id` | Dedup / audit trail |
| `turns_used` | parsed from stream events | Loop depth |

---

## Five Experiment Metrics (ShahParin's Baseline Metrics)

| Metric | How Measured |
|--------|-------------|
| Time taken | `wall_time_ms` averaged across 3 trials |
| Tokens utilized | `total_tokens` averaged across 3 trials |
| Accuracy | scorer.ts: correct=1.0 / partial=0.5 / wrong=0.0 |
| Tool calls | `tool_calls` averaged across 3 trials |
| Context efficiency | `total_tokens / accuracy_score` (tokens per correct answer) |

---

## Raw CLI Baseline — Tool Access

In raw mode, Claude has access to **only:**
- `Bash` — can run any shell command including `terraform` CLI

Claude must use `terraform state list`, `terraform show -json`, `terraform graph`, etc. to answer questions. This produces large context dumps — the state is 4041 lines of JSON (~33K tokens).

---

## Results

> No runs completed yet. This section will be populated after `runner.ts` is implemented and the baseline run completes.

### Run Log

| Run ID | Date | Prompts | Trials | Mode | Status |
|--------|------|---------|--------|------|--------|
| — | — | — | — | raw | Pending |

---

### Summary Table (after first run)

| # | Prompt | Difficulty | Accuracy | Avg Tokens | Avg Time (ms) | Avg Tool Calls | Context Efficiency |
|---|--------|-----------|----------|-----------|--------------|----------------|-------------------|
| 1 | VPC CIDR block | Easy | — | — | — | — | — |
| 2 | List all subnets + AZs | Easy | — | — | — | — | — |
| 3 | Direct VPC dependents | Medium | — | — | — | — | — |
| 4 | DB subnet group impact | Hard | — | — | — | — | — |
| 5 | SG rules 0.0.0.0/0 | Medium | — | — | — | — | — |
| 6 | ALB to DB dependency chain | Hard | — | — | — | — | — |
| 7 | Web tier deployment order | Medium | — | — | — | — | — |
| 8 | Cross-module outputs compute consumes | Medium | — | — | — | — | — |
| 9 | Resource count by module | Easy | — | — | — | — | — |
| 10 | Add microservice behind ALB | Hard | — | — | — | — | — |

---

### Expected vs Actual (after run)

| | Easy | Medium | Hard |
|---|------|--------|------|
| **Expected Accuracy** | 80–100% | 50–75% | 10–30% |
| **Actual Accuracy** | — | — | — |
| **Expected Avg Tokens** | 5–15K | 15–30K | 30–50K |
| **Actual Avg Tokens** | — | — | — |
| **Expected Tool Calls** | 2–4 | 5–8 | 8–15 |
| **Actual Tool Calls** | — | — | — |

---

## Research Notes

### Claude Code CLI Headless Mode — Key Findings

Researched 2026-03-28.

**Yes, Claude Code can run programmatically from a subprocess in a different directory.**

```bash
# Basic headless invocation
claude -p "your prompt" --output-format json

# Full experiment pattern
cd /tmp/exp-uuid && claude \
  -p "task prompt" \
  --allowedTools "Bash" \
  --output-format json \
  --max-turns 10 \
  --max-budget-usd 2.00 \
  --bare
```

**Output formats:**
- `text` — plain string (default)
- `json` — structured object with `result`, `usage`, `cost`, `duration`, `session_id`
- `stream-json` — newline-delimited events; use to count `tool_use` events

**Token/cost metrics are built-in** — no need to wrap the SDK manually.

**`--bare` mode** skips CLAUDE.md, hooks, skills, MCP auto-discovery. Critical for clean baselines.

**Working directory:** no `--cwd` flag; use `cd /path && claude -p` or Node `execSync` with `cwd` option.

**Subprocess from Node.js:**

```typescript
import { execSync } from 'child_process';

const result = execSync(`claude -p "${prompt}" --output-format json --max-turns 10 --bare --allowedTools "Bash"`, {
  cwd: tempDir,
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024, // 10MB for large state outputs
});
const metrics = JSON.parse(result);
```

**Sources:**
- [Claude Code Headless Docs](https://code.claude.com/docs/en/headless)
- [CI/CD and Headless Mode](https://angelo-lima.fr/en/claude-code-cicd-headless-en/)

---

## Next Steps

1. Implement `runner.ts` — Claude Code CLI subprocess, temp dir management, 3 trials/prompt
2. Implement `scorer.ts` — category-specific scoring against `prompts.json` ground truth
3. Run baseline: 10 prompts × 3 trials
4. Update Results section above
5. Commit findings — this becomes the "before" data point for the MCP comparison
