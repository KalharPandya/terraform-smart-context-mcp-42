#!/usr/bin/env npx tsx
/**
 * Baseline Experiment Runner — Claude Code CLI Headless Mode
 *
 * Sends each prompt to Claude via the Claude Code CLI (`claude -p`) with only
 * Bash tool access and captures granular metrics per prompt trial.
 *
 * Usage:
 *   npx tsx experiments/baseline/runner.ts                  # run all prompts, 3 trials each
 *   npx tsx experiments/baseline/runner.ts --prompt 1       # run only prompt #1
 *   npx tsx experiments/baseline/runner.ts --trials 1       # 1 trial per prompt
 *   npx tsx experiments/baseline/runner.ts --mode raw       # explicit raw mode (default)
 */

import { execSync, spawn } from "child_process";
import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
  cpSync,
  existsSync,
  readdirSync,
  mkdirSync,
  statSync,
} from "fs";
import { resolve, join, relative } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PromptEntry {
  id: number;
  prompt: string;
  difficulty: string;
  category: string;
  scoring: {
    type: string;
    ground_truth: Record<string, unknown>;
  };
}

interface PromptsFile {
  version: string;
  description: string;
  infra_path: string;
  prompts: PromptEntry[];
}

interface ToolCallRecord {
  name: string;
  input: Record<string, unknown>;
  output_preview: string;
  output_chars: number;
  tokens_in_this_turn: number;
  tokens_out_this_turn: number;
  is_error: boolean;
}

interface TrialResult {
  trial: number;
  answer: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  tool_calls: number;
  tool_call_details: ToolCallRecord[];
  wall_time_ms: number;
  num_turns: number;
  stop_reason: string;
  files_accessed: string[];
  terraform_commands: string[];
  total_tool_output_chars: number;
}

interface PromptResult {
  id: number;
  prompt: string;
  difficulty: string;
  category: string;
  scoring: PromptEntry["scoring"];
  trials: TrialResult[];
}

interface RunResult {
  metadata: {
    mode: string;
    model: string;
    timestamp: string;
    infra_path: string;
    trials_per_prompt: number;
    total_prompts: number;
    claude_cli_version: string;
  };
  results: PromptResult[];
}

// ─── Config ──────────────────────────────────────────────────────────────────

const CLAUDE_BIN =
  "/Users/parinshah/Library/Application Support/Claude/claude-code/2.1.85/claude.app/Contents/MacOS/claude";

const MODEL = "sonnet";
const MAX_BUDGET_USD = 2.0;

const SCRIPT_DIR = resolve(
  decodeURIComponent(
    new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")
  )
);
const PROMPTS_PATH = join(SCRIPT_DIR, "prompts.json");
const RESULTS_DIR = join(SCRIPT_DIR, "results");

const SYSTEM_PROMPT = `You are an infrastructure assistant. There is a Terraform project in the current directory that is already initialized and applied (state exists with 75+ resources across 6 modules).

You have access to Bash to run:
- terraform commands (state list, show -json, state show <address>, graph, output -json, etc.)
- cat/head/tail to read .tf files
- find/ls to list files

Rules:
- Use ONLY terraform CLI commands and file reading to answer
- Do not guess — verify with commands
- Synthesize your answer clearly — do not dump raw command output`;

// ─── Temp Directory Management ───────────────────────────────────────────────

function createTempInfraDir(infraDir: string): string {
  const tempDir = join(tmpdir(), `exp-${randomUUID()}`);
  mkdirSync(tempDir, { recursive: true });

  // Copy .tf files preserving directory structure
  copyTfFiles(infraDir, tempDir, infraDir);

  // Copy terraform state and config
  const filesToCopy = [
    ".terraform.lock.hcl",
    "terraform.tfstate",
    "terraform.tfvars",
  ];
  for (const file of filesToCopy) {
    const src = join(infraDir, file);
    if (existsSync(src)) {
      cpSync(src, join(tempDir, file));
    }
  }

  // Copy .terraform directory (provider plugins)
  const terraformDir = join(infraDir, ".terraform");
  if (existsSync(terraformDir)) {
    cpSync(terraformDir, join(tempDir, ".terraform"), { recursive: true });
  }

  return tempDir;
}

function copyTfFiles(srcDir: string, destDir: string, rootDir: string): void {
  const entries = readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const relPath = relative(rootDir, srcPath);
    const destPath = join(destDir, relPath);

    if (entry.isDirectory()) {
      // Skip hidden dirs except we already handle .terraform separately
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      mkdirSync(destPath, { recursive: true });
      copyTfFiles(srcPath, destDir, rootDir);
    } else if (entry.isFile() && entry.name.endsWith(".tf")) {
      cpSync(srcPath, destPath);
    }
  }
}

function cleanupClaude(dir: string): void {
  const claudeDir = join(dir, ".claude");
  if (existsSync(claudeDir)) {
    rmSync(claudeDir, { recursive: true, force: true });
  }
}

// ─── Stream JSON Parsing ─────────────────────────────────────────────────────

interface StreamEvent {
  type: string;
  subtype?: string;
  message?: {
    content?: Array<{
      type: string;
      name?: string;
      input?: Record<string, unknown>;
      text?: string;
    }>;
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
  tool_use_result?: {
    stdout?: string;
    stderr?: string;
  };
  // Result event fields
  result?: string;
  is_error?: boolean;
  duration_ms?: number;
  num_turns?: number;
  stop_reason?: string;
  total_cost_usd?: number;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    server_tool_use?: Record<string, unknown>;
  };
  modelUsage?: Record<
    string,
    {
      inputTokens: number;
      outputTokens: number;
      cacheReadInputTokens: number;
      cacheCreationInputTokens: number;
      costUSD: number;
    }
  >;
}

function parseStreamOutput(rawOutput: string): {
  toolCalls: ToolCallRecord[];
  result: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  duration_ms: number;
  num_turns: number;
  stop_reason: string;
} {
  const lines = rawOutput.split("\n").filter((l) => l.trim());
  const toolCalls: ToolCallRecord[] = [];
  let result = "";
  let tokens_in = 0;
  let tokens_out = 0;
  let cost_usd = 0;
  let duration_ms = 0;
  let num_turns = 0;
  let stop_reason = "unknown";

  // Track pending tool uses to match with their results
  const pendingToolUses: Map<
    string,
    { name: string; input: Record<string, unknown> }
  > = new Map();

  // Track per-turn token usage
  let lastTurnTokensIn = 0;
  let lastTurnTokensOut = 0;

  for (const line of lines) {
    let event: StreamEvent;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }

    // Assistant message with tool_use blocks
    if (event.type === "assistant" && event.message?.content) {
      // Update per-turn tokens
      if (event.message.usage) {
        lastTurnTokensIn = event.message.usage.input_tokens;
        lastTurnTokensOut = event.message.usage.output_tokens;
      }

      for (const block of event.message.content) {
        if (block.type === "tool_use" && block.name) {
          pendingToolUses.set(block.name + "_" + toolCalls.length, {
            name: block.name,
            input: (block.input as Record<string, unknown>) ?? {},
          });
        }
      }
    }

    // Tool result events
    if (event.type === "user" && event.tool_use_result) {
      const stdout = event.tool_use_result.stdout ?? "";
      const stderr = event.tool_use_result.stderr ?? "";
      const fullOutput = [stdout, stderr].filter(Boolean).join("\n");

      // Match with the most recent pending tool use
      const lastKey = Array.from(pendingToolUses.keys()).pop();
      if (lastKey) {
        const pending = pendingToolUses.get(lastKey)!;
        pendingToolUses.delete(lastKey);

        toolCalls.push({
          name: pending.name,
          input: pending.input,
          output_preview: fullOutput.slice(0, 500),
          output_chars: fullOutput.length,
          tokens_in_this_turn: lastTurnTokensIn,
          tokens_out_this_turn: lastTurnTokensOut,
          is_error: false,
        });
      }
    }

    // Final result event
    if (event.type === "result") {
      result = event.result ?? "";
      cost_usd = event.total_cost_usd ?? 0;
      duration_ms = event.duration_ms ?? 0;
      num_turns = event.num_turns ?? 0;
      stop_reason = event.stop_reason ?? "unknown";

      // Prefer modelUsage for accurate token counts (includes cache tokens)
      if (event.modelUsage) {
        const modelStats = Object.values(event.modelUsage)[0];
        if (modelStats) {
          tokens_in =
            modelStats.inputTokens +
            (modelStats.cacheReadInputTokens ?? 0) +
            (modelStats.cacheCreationInputTokens ?? 0);
          tokens_out = modelStats.outputTokens;
        }
      } else if (event.usage) {
        tokens_in =
          (event.usage.input_tokens ?? 0) +
          (event.usage.cache_creation_input_tokens ?? 0) +
          (event.usage.cache_read_input_tokens ?? 0);
        tokens_out = event.usage.output_tokens ?? 0;
      }
    }
  }

  return {
    toolCalls,
    result,
    tokens_in,
    tokens_out,
    cost_usd,
    duration_ms,
    num_turns,
    stop_reason,
  };
}

// ─── Derived Metrics ─────────────────────────────────────────────────────────

function extractFilesAccessed(toolCalls: ToolCallRecord[]): string[] {
  const files = new Set<string>();
  for (const tc of toolCalls) {
    const cmd = String(tc.input.command ?? "");
    // Match cat/head/tail commands
    const fileMatch = cmd.match(
      /(?:cat|head|tail|less|more)\s+(?:-[^\s]+\s+)*([^\s|>]+)/
    );
    if (fileMatch) {
      files.add(fileMatch[1]);
    }
  }
  return Array.from(files).sort();
}

function extractTerraformCommands(toolCalls: ToolCallRecord[]): string[] {
  const cmds: string[] = [];
  for (const tc of toolCalls) {
    const cmd = String(tc.input.command ?? "");
    const tfMatch = cmd.match(/terraform\s+(.+)/);
    if (tfMatch) {
      cmds.push(tfMatch[1].trim());
    }
  }
  return cmds;
}

// ─── Trial Execution ─────────────────────────────────────────────────────────

function runTrial(prompt: string, cwd: string): Promise<TrialResult> {
  return new Promise((resolvePromise, reject) => {
    const fullPrompt = `${SYSTEM_PROMPT}\n\n---\n\nTask: ${prompt}`;

    const args = [
      "-p",
      fullPrompt,
      "--output-format",
      "stream-json",
      "--verbose",
      "--model",
      MODEL,
      "--max-budget-usd",
      String(MAX_BUDGET_USD),
      "--tools",
      "Bash",
      "--allowedTools",
      "Bash",
      "--dangerously-skip-permissions",
      "--disable-slash-commands",
      "--no-session-persistence",
    ];

    let rawOutput = "";
    let stderrOutput = "";

    const proc = spawn(CLAUDE_BIN, args, {
      cwd,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdout.on("data", (data: Buffer) => {
      rawOutput += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderrOutput += data.toString();
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });

    proc.on("close", (code) => {
      if (!rawOutput.trim()) {
        reject(
          new Error(
            `Claude CLI exited with code ${code}, no output. stderr: ${stderrOutput.slice(0, 500)}`
          )
        );
        return;
      }

      const parsed = parseStreamOutput(rawOutput);

      const filesAccessed = extractFilesAccessed(parsed.toolCalls);
      const terraformCommands = extractTerraformCommands(parsed.toolCalls);
      const totalToolOutputChars = parsed.toolCalls.reduce(
        (sum, tc) => sum + tc.output_chars,
        0
      );

      resolvePromise({
        trial: 0, // set by caller
        answer: parsed.result,
        tokens_in: parsed.tokens_in,
        tokens_out: parsed.tokens_out,
        cost_usd: parsed.cost_usd,
        tool_calls: parsed.toolCalls.length,
        tool_call_details: parsed.toolCalls,
        wall_time_ms: parsed.duration_ms,
        num_turns: parsed.num_turns,
        stop_reason: parsed.stop_reason,
        files_accessed: filesAccessed,
        terraform_commands: terraformCommands,
        total_tool_output_chars: totalToolOutputChars,
      });
    });
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Parse CLI args
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const mode = getArg("--mode") ?? "raw";
  const trialsPerPrompt = parseInt(getArg("--trials") ?? "3", 10);
  const promptFilter = getArg("--prompt")
    ? parseInt(getArg("--prompt")!, 10)
    : undefined;

  if (mode !== "raw") {
    console.error(
      "Only --mode raw is implemented. MCP mode is a future addition."
    );
    process.exit(1);
  }

  // Verify Claude CLI exists
  if (!existsSync(CLAUDE_BIN)) {
    console.error(`Claude CLI not found at: ${CLAUDE_BIN}`);
    process.exit(1);
  }

  // Get CLI version
  let cliVersion = "unknown";
  try {
    cliVersion = execSync(`"${CLAUDE_BIN}" --version`, {
      encoding: "utf-8",
    }).trim();
  } catch {
    // ignore
  }

  // Load prompts
  const promptsFile: PromptsFile = JSON.parse(
    readFileSync(PROMPTS_PATH, "utf-8")
  );
  let prompts = promptsFile.prompts;
  if (promptFilter !== undefined) {
    prompts = prompts.filter((p) => p.id === promptFilter);
    if (prompts.length === 0) {
      console.error(`No prompt with id ${promptFilter} found.`);
      process.exit(1);
    }
  }

  const infraDir = resolve(SCRIPT_DIR, promptsFile.infra_path);

  // Verify terraform state exists
  try {
    execSync("terraform state list", {
      cwd: infraDir,
      encoding: "utf-8",
      timeout: 10_000,
    });
  } catch {
    console.error(
      "Terraform state not found. Run 'terraform init && terraform apply -auto-approve' in dummy-infra/ first."
    );
    process.exit(1);
  }

  console.log(`\n=== Baseline Experiment Runner (CLI Mode) ===`);
  console.log(`Mode: ${mode}`);
  console.log(`Model: ${MODEL}`);
  console.log(`CLI: ${cliVersion}`);
  console.log(`Prompts: ${prompts.length} (${trialsPerPrompt} trials each)`);
  console.log(`Infra: ${infraDir}`);
  console.log(`Total CLI invocations: ${prompts.length * trialsPerPrompt}`);
  console.log(`Max budget per prompt: $${MAX_BUDGET_USD}`);
  console.log(`=============================================\n`);

  const results: PromptResult[] = [];

  for (const prompt of prompts) {
    console.log(
      `[${prompt.id}/${promptsFile.prompts.length}] "${prompt.prompt}" (${prompt.difficulty})`
    );

    // Create isolated temp directory for this prompt
    const tempDir = createTempInfraDir(infraDir);
    console.log(`  Temp dir: ${tempDir}`);

    const trials: TrialResult[] = [];

    try {
      for (let t = 1; t <= trialsPerPrompt; t++) {
        console.log(`  Trial ${t}/${trialsPerPrompt}...`);

        try {
          const trial = await runTrial(prompt.prompt, tempDir);
          trial.trial = t;
          trials.push(trial);

          console.log(
            `    -> ${trial.tool_calls} tool calls, ${trial.tokens_in + trial.tokens_out} tokens, ${trial.wall_time_ms}ms, $${trial.cost_usd.toFixed(4)}, stop: ${trial.stop_reason}`
          );
          console.log(
            `    -> Files: [${trial.files_accessed.join(", ")}]`
          );
          console.log(
            `    -> TF cmds: [${trial.terraform_commands.slice(0, 5).join(", ")}${trial.terraform_commands.length > 5 ? "..." : ""}]`
          );
        } catch (err) {
          console.error(
            `    ERROR in trial ${t}: ${(err as Error).message}`
          );
          trials.push({
            trial: t,
            answer: `[ERROR: ${(err as Error).message}]`,
            tokens_in: 0,
            tokens_out: 0,
            cost_usd: 0,
            tool_calls: 0,
            tool_call_details: [],
            wall_time_ms: 0,
            num_turns: 0,
            stop_reason: "error",
            files_accessed: [],
            terraform_commands: [],
            total_tool_output_chars: 0,
          });
        }

        // Clean up .claude directory between trials
        cleanupClaude(tempDir);

        // Delay between trials to avoid rate limits
        if (t < trialsPerPrompt) {
          await new Promise((r) => setTimeout(r, 5_000));
        }
      }
    } finally {
      // Always clean up temp directory
      try {
        rmSync(tempDir, { recursive: true, force: true });
        console.log(`  Temp dir cleaned up.`);
      } catch (err) {
        console.warn(`  Warning: failed to clean temp dir: ${(err as Error).message}`);
      }
    }

    results.push({
      id: prompt.id,
      prompt: prompt.prompt,
      difficulty: prompt.difficulty,
      category: prompt.category,
      scoring: prompt.scoring,
      trials,
    });

    // Delay between prompts
    if (prompt !== prompts[prompts.length - 1]) {
      console.log(`  (waiting 5s before next prompt...)\n`);
      await new Promise((r) => setTimeout(r, 5_000));
    }
  }

  // Build output
  const runResult: RunResult = {
    metadata: {
      mode,
      model: MODEL,
      timestamp: new Date().toISOString(),
      infra_path: infraDir,
      trials_per_prompt: trialsPerPrompt,
      total_prompts: prompts.length,
      claude_cli_version: cliVersion,
    },
    results,
  };

  // Write results
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const outPath = join(RESULTS_DIR, `baseline-${timestamp}.json`);
  writeFileSync(outPath, JSON.stringify(runResult, null, 2));
  console.log(`\nResults written to: ${outPath}`);

  // Print summary table
  console.log(`\n=== Summary ===`);
  console.log(
    `| # | Prompt                         | Diff | Avg Tokens | Avg Tools | Avg Time(s) | Avg Cost |`
  );
  console.log(
    `|---|--------------------------------|------|------------|-----------|-------------|----------|`
  );

  let totalTokens = 0;
  let totalTools = 0;
  let totalTime = 0;
  let totalCost = 0;

  for (const r of results) {
    const avgTokens = Math.round(
      r.trials.reduce((s, t) => s + t.tokens_in + t.tokens_out, 0) /
        r.trials.length
    );
    const avgTools = Math.round(
      r.trials.reduce((s, t) => s + t.tool_calls, 0) / r.trials.length
    );
    const avgTime = (
      r.trials.reduce((s, t) => s + t.wall_time_ms, 0) /
      r.trials.length /
      1000
    ).toFixed(1);
    const avgCost = (
      r.trials.reduce((s, t) => s + t.cost_usd, 0) / r.trials.length
    ).toFixed(4);

    totalTokens += r.trials.reduce(
      (s, t) => s + t.tokens_in + t.tokens_out,
      0
    );
    totalTools += r.trials.reduce((s, t) => s + t.tool_calls, 0);
    totalTime += r.trials.reduce((s, t) => s + t.wall_time_ms, 0);
    totalCost += r.trials.reduce((s, t) => s + t.cost_usd, 0);

    const shortPrompt =
      r.prompt.length > 30 ? r.prompt.slice(0, 27) + "..." : r.prompt;
    console.log(
      `| ${String(r.id).padStart(1)} | ${shortPrompt.padEnd(30)} | ${r.difficulty.padEnd(4)} | ${String(avgTokens).padStart(10)} | ${String(avgTools).padStart(9)} | ${avgTime.padStart(11)} | $${avgCost.padStart(6)} |`
    );
  }

  console.log(
    `| - | TOTAL${" ".repeat(25)} | ---- | ${String(totalTokens).padStart(10)} | ${String(totalTools).padStart(9)} | ${(totalTime / 1000).toFixed(1).padStart(11)} | $${totalCost.toFixed(4).padStart(6)} |`
  );
  console.log();
}

main().catch((err) => {
  console.error("Runner failed:", err);
  process.exit(1);
});
