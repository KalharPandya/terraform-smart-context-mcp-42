# Plan: Enhanced Experiment Runner + Full Re-run

## Context

Re-running all 10 baseline prompts (3 trials each) with enhanced logging.
The existing runner already captures terraform_commands, tokens, and duration —
but is missing: all bash commands (not just terraform), lines of .tf code read,
and the CLAUDE_BIN is hardcoded to Parin's Mac path.

Goal: fix the runner, add the 3 missing metrics, run all 10 prompts, write results.

---

## Files to Modify

| File | Change |
|------|--------|
| `experiments/baseline/runner.ts` | Fix CLAUDE_BIN, add `all_bash_commands`, add `tf_lines_read` |
| `experiments/baseline/scorer.ts` | Add `tf_lines_read` to ScoredTrial interface + summary output |

---

## Change 1: Fix CLAUDE_BIN (runner.ts line 101–102)

Replace hardcoded Mac path with platform-aware detection:

```typescript
function findClaudeBin(): string {
  // Try PATH first (works if claude is installed globally)
  try {
    const result = execSync(
      process.platform === "win32" ? "where claude" : "which claude",
      { encoding: "utf-8", stdio: "pipe" }
    ).trim().split("\n")[0].trim();
    if (result && existsSync(result)) return result;
  } catch { /* not in PATH */ }

  // Windows fallback: AppData\Local\AnthropicClaude\claude.exe
  if (process.platform === "win32") {
    const winPath = join(
      process.env.LOCALAPPDATA ?? "C:\\Users\\kalha\\AppData\\Local",
      "AnthropicClaude", "claude.exe"
    );
    if (existsSync(winPath)) return winPath;
  }

  throw new Error("Claude binary not found. Ensure `claude` is in your PATH.");
}

const CLAUDE_BIN = findClaudeBin();
```

---

## Change 2: Add `all_bash_commands` to TrialResult

Captures every bash command Claude ran — not just terraform ones.
Currently only `extractTerraformCommands()` exists (captures subset).

**Add to TrialResult interface:**
```typescript
all_bash_commands: string[];   // every bash command in order
```

**Add extraction function:**
```typescript
function extractAllBashCommands(toolCalls: ToolCallRecord[]): string[] {
  return toolCalls
    .filter(tc => tc.name === "Bash")
    .map(tc => String(tc.input.command ?? "").trim())
    .filter(Boolean);
}
```

**Use in runTrial result:**
```typescript
all_bash_commands: extractAllBashCommands(parsed.toolCalls),
```

**Add to console log per trial:**
```typescript
console.log(`    -> All cmds (${trial.all_bash_commands.length}): ${trial.all_bash_commands.map(c => c.slice(0,60)).join(" | ")}`);
```

---

## Change 3: Add `tf_lines_read` to TrialResult

Count total lines of .tf source code Claude read via cat/head/tail.
Derived from tool output chars of file-read commands on .tf files.

**Add to TrialResult interface:**
```typescript
tf_lines_read: number;   // total lines of .tf files read across all tool calls
```

**Add extraction function:**
```typescript
function extractTfLinesRead(toolCalls: ToolCallRecord[]): number {
  let total = 0;
  for (const tc of toolCalls) {
    const cmd = String(tc.input.command ?? "");
    // Only count reads of .tf files
    if (!cmd.match(/\.tf/) && !cmd.match(/cat|head|tail/)) continue;
    if (!cmd.match(/\.tf/)) continue;
    // Count newlines in the output
    total += (tc.output_preview.match(/\n/g) ?? []).length;
    // output_preview is capped at 500 chars — use output_chars to estimate if large
    if (tc.output_chars > 500) {
      // estimate: output_preview covers 500 chars, scale up proportionally
      const estimatedLines = Math.round(
        (tc.output_preview.match(/\n/g) ?? []).length * (tc.output_chars / 500)
      );
      total = total - (tc.output_preview.match(/\n/g) ?? []).length + estimatedLines;
    }
  }
  return total;
}
```

**Use in runTrial result:**
```typescript
tf_lines_read: extractTfLinesRead(parsed.toolCalls),
```

**Add to console log per trial:**
```typescript
console.log(`    -> TF lines read: ${trial.tf_lines_read}`);
```

---

## Change 4: Update scorer.ts

Add `tf_lines_read` and `all_bash_commands` to `ScoredTrial` interface and include in summary table.

**Add to ScoredTrial interface:**
```typescript
tf_lines_read: number;
all_bash_commands: string[];
```

**Add column to summary table** (in the per-prompt summary section):
```
| TF Lines | All Cmds |
```

---

## Summary Table Output (per trial, to console + results)

After changes, each trial will log:
```
Trial 1/3...
  -> 6 tool calls, 76203 tokens, 24300ms, $0.055, stop: end_turn
  -> Files: [modules/compute/main.tf, modules/loadbalancer/main.tf]
  -> TF cmds: [state list, graph | grep vpc, state show module.networking...]
  -> All cmds (6): terraform state list | terraform graph | grep vpc | terraform state show... 
  -> TF lines read: 312
```

---

## Run Command

After fixing the runner:
```bash
npx tsx experiments/baseline/runner.ts --trials 3
```

Results write to: `experiments/baseline/results/baseline-<timestamp>.json`
Then score with: `npx tsx experiments/baseline/scorer.ts experiments/baseline/results/baseline-<timestamp>.json`

---

## Verification

1. `tsc --noEmit` passes with no errors after changes
2. Single trial smoke test: `npx tsx experiments/baseline/runner.ts --prompt 1 --trials 1`
3. Output JSON contains `all_bash_commands` and `tf_lines_read` fields
4. Full run: all 10 prompts × 3 trials complete, results file written
5. Scorer runs cleanly on the new results file
