#!/usr/bin/env npx tsx
/**
 * Gemini CLI Experiment Runner
 *
 * Replicates the Claude baseline experiment for Gemini CLI.
 * Runs all prompts against dummy-infra using Gemini in headless mode.
 *
 * Usage:
 *   npx tsx experiments/baseline/gemini-runner.ts                        # all prompts, 2 trials, both modes
 *   npx tsx experiments/baseline/gemini-runner.ts --prompt 6             # single prompt
 *   npx tsx experiments/baseline/gemini-runner.ts --trials 1             # 1 trial per prompt
 *   npx tsx experiments/baseline/gemini-runner.ts --mode raw             # raw mode only
 *   npx tsx experiments/baseline/gemini-runner.ts --mode mcp             # MCP mode only
 *   npx tsx experiments/baseline/gemini-runner.ts --mode both            # both modes (default)
 *   npx tsx experiments/baseline/gemini-runner.ts --live                 # live tool call logging
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
  unlinkSync,
} from "fs";
import { resolve, join, relative } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { scoreAndWrite, type CombinedRunResult } from "./scorer.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

type Mode = "raw" | "mcp";

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
  mcp_tools_used: string[];
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
    mode: Mode;
    model: string;
    timestamp: string;
    infra_path: string;
    trials_per_prompt: number;
    total_prompts: number;
    gemini_cli_version: string;
  };
  results: PromptResult[];
}

// ─── Gemini Stream Event Types ──────────────────────────────────────────────

interface GeminiStreamEvent {
  type: "init" | "message" | "tool_use" | "tool_result" | "result";
  timestamp?: string;
  session_id?: string;
  model?: string;
  role?: string;
  content?: string;
  delta?: boolean;
  tool_name?: string;
  tool_id?: string;
  parameters?: Record<string, unknown>;
  status?: string;
  output?: string;
  stats?: {
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    cached: number;
    input: number;
    duration_ms: number;
    tool_calls: number;
    models: Record<
      string,
      {
        total_tokens: number;
        input_tokens: number;
        output_tokens: number;
        cached: number;
        input: number;
      }
    >;
  };
}

// ─── Gemini Pricing (per 1M tokens, as of 2025) ────────────────────────────
// Source: https://ai.google.dev/pricing
// Prices vary by model; we estimate from per-model token stats in the result event.

const GEMINI_PRICING: Record<string, { input: number; output: number; cachedInput: number }> = {
  // Gemini 2.5 Flash Lite — used as utility router
  "gemini-2.5-flash-lite": { input: 0.075, output: 0.30, cachedInput: 0.01875 },
  // Gemini 2.5 Flash
  "gemini-2.5-flash": { input: 0.15, output: 0.60, cachedInput: 0.0375 },
  // Gemini 3 Flash Preview — primary model
  "gemini-3-flash-preview": { input: 0.15, output: 0.60, cachedInput: 0.0375 },
  // Gemini 2.5 Pro
  "gemini-2.5-pro": { input: 1.25, output: 10.00, cachedInput: 0.3125 },
};

const DEFAULT_PRICING = { input: 0.15, output: 0.60, cachedInput: 0.0375 };

function estimateCost(
  models: Record<string, { input_tokens: number; output_tokens: number; cached: number }>
): number {
  let totalCost = 0;
  for (const [modelName, stats] of Object.entries(models)) {
    const pricing = GEMINI_PRICING[modelName] ?? DEFAULT_PRICING;
    const uncachedInput = stats.input_tokens - (stats.cached ?? 0);
    const cachedInput = stats.cached ?? 0;
    totalCost +=
      (uncachedInput / 1_000_000) * pricing.input +
      (cachedInput / 1_000_000) * pricing.cachedInput +
      (stats.output_tokens / 1_000_000) * pricing.output;
  }
  return totalCost;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_TRIALS = 2;
const TRIAL_TIMEOUT_MS = 180_000; // 3 minutes per trial

const SCRIPT_DIR = resolve(
  decodeURIComponent(
    new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")
  )
);
const REPO_ROOT = resolve(SCRIPT_DIR, "../..");
const PROMPTS_PATH = join(SCRIPT_DIR, "prompts.json");
const RESULTS_DIR = join(SCRIPT_DIR, "results");
const MCP_SERVER_BIN = join(REPO_ROOT, "dist", "index.js");

// ─── Gemini Binary Detection ────────────────────────────────────────────────

function findGeminiBin(): string {
  try {
    const found = execSync("which gemini", { encoding: "utf-8" }).trim();
    if (found && existsSync(found)) return found;
  } catch {
    // fall through
  }

  const brew = "/opt/homebrew/bin/gemini";
  if (existsSync(brew)) return brew;

  throw new Error(
    "Gemini CLI not found. Install via: brew install gemini-cli"
  );
}

// ─── System Prompts ─────────────────────────────────────────────────────────

const RAW_SYSTEM_PROMPT = `You are an infrastructure assistant. There is a Terraform project in the current directory that is already initialized and applied (state exists with 75+ resources across 6 modules).

You have access to run_shell_command to run:
- terraform commands (state list, show -json, state show <address>, graph, output -json, etc.)
- cat/head/tail to read .tf files
- find/ls to list files

Rules:
- Use ONLY terraform CLI commands and file reading to answer
- Do not guess — verify with commands
- Synthesize your answer clearly — do not dump raw command output`;

function buildMcpSystemPrompt(infraPath: string): string {
  const dir = infraPath.replace(/\\/g, "/");

  return `You are an infrastructure assistant. The Terraform project is at: ${dir}

The project is already initialized and applied. There are 75 resources across 6 modules in the state.

You have access to MCP tools from the connected terraform MCP server.
Pass workingDir: "${dir}" in EVERY tool call.

Available tools:
  get_schema       — GraphQL SDL + prebuilt queries scoped to your infra
  query_graph      — Execute GraphQL queries against the dependency DAG
  terraform_state_list, terraform_state_show — View deployed resource state
  terraform_graph  — DOT dependency graph
  terraform_validate, terraform_plan — Validate/preview changes

Rules:
- Use ONLY MCP tools. Do NOT use run_shell_command or read_file directly.
- Always pass workingDir: "${dir}" in every call.
- Start with get_schema to discover available prebuilt queries.
- Prefer query_graph for dependency and relationship questions.
- Do not guess — verify with tools.
- Synthesize your answer clearly — do not dump raw tool output.`;
}

// ─── MCP Config for Gemini ──────────────────────────────────────────────────

function writeGeminiMcpConfig(tempDir: string): void {
  const geminiDir = join(tempDir, ".gemini");
  mkdirSync(geminiDir, { recursive: true });
  const config = {
    mcpServers: {
      terraform: {
        command: "node",
        args: [MCP_SERVER_BIN.replace(/\\/g, "/")],
        trust: true,
      },
    },
  };
  writeFileSync(
    join(geminiDir, "settings.json"),
    JSON.stringify(config, null, 2)
  );
}

// ─── Temp Directory Management ──────────────────────────────────────────────

function createTempInfraDir(infraDir: string): string {
  const tempDir = join(tmpdir(), `exp-gemini-${randomUUID()}`);
  mkdirSync(tempDir, { recursive: true });

  copyTfFiles(infraDir, tempDir, infraDir);

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
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      mkdirSync(destPath, { recursive: true });
      copyTfFiles(srcPath, destDir, rootDir);
    } else if (entry.isFile() && entry.name.endsWith(".tf")) {
      cpSync(srcPath, destPath);
    }
  }
}

function cleanupGemini(dir: string): void {
  const geminiDir = join(dir, ".gemini");
  if (existsSync(geminiDir)) {
    rmSync(geminiDir, { recursive: true, force: true });
  }
}

// ─── Stream-JSON Parser ─────────────────────────────────────────────────────

function parseGeminiStreamOutput(rawOutput: string): {
  toolCalls: ToolCallRecord[];
  result: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  duration_ms: number;
  num_turns: number;
  stop_reason: string;
  model: string;
} {
  const lines = rawOutput.split("\n").filter((l) => l.trim());
  const toolCalls: ToolCallRecord[] = [];
  let tokens_in = 0;
  let tokens_out = 0;
  let cost_usd = 0;
  let duration_ms = 0;
  let num_turns = 0;
  let stop_reason = "unknown";
  let model = "gemini";

  // Track assistant message content to reconstruct the answer
  const assistantChunks: string[] = [];
  let lastToolResultIdx = -1;
  let chunkIdx = 0;

  // Track pending tool_use events by tool_id
  const pendingTools: Map<
    string,
    { name: string; input: Record<string, unknown> }
  > = new Map();

  for (const line of lines) {
    let event: GeminiStreamEvent;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }

    if (event.type === "init" && event.model) {
      model = event.model;
    }

    if (
      event.type === "message" &&
      event.role === "assistant" &&
      event.content
    ) {
      assistantChunks.push(event.content);
      chunkIdx++;
      num_turns++;
    }

    if (event.type === "tool_use" && event.tool_name && event.tool_id) {
      pendingTools.set(event.tool_id, {
        name: event.tool_name,
        input: (event.parameters as Record<string, unknown>) ?? {},
      });
    }

    if (event.type === "tool_result" && event.tool_id) {
      const pending = pendingTools.get(event.tool_id);
      if (pending) {
        pendingTools.delete(event.tool_id);
        const output = event.output ?? "";
        toolCalls.push({
          name: pending.name,
          input: pending.input,
          output_preview: output.slice(0, 500),
          output_chars: output.length,
          tokens_in_this_turn: 0,
          tokens_out_this_turn: 0,
          is_error: event.status !== "success",
        });
      }
      lastToolResultIdx = chunkIdx;
    }

    if (event.type === "result") {
      stop_reason = event.status ?? "unknown";
      if (event.stats) {
        tokens_in = event.stats.input_tokens ?? 0;
        tokens_out = event.stats.output_tokens ?? 0;
        duration_ms = event.stats.duration_ms ?? 0;
        if (event.stats.models) {
          cost_usd = estimateCost(event.stats.models);
        }
      }
    }
  }

  // The final answer is assistant content after the last tool result
  let result: string;
  if (lastToolResultIdx >= 0 && lastToolResultIdx < assistantChunks.length) {
    result = assistantChunks.slice(lastToolResultIdx).join("");
  } else if (assistantChunks.length > 0) {
    result = assistantChunks.join("");
  } else {
    result = "";
  }

  return {
    toolCalls,
    result,
    tokens_in,
    tokens_out,
    cost_usd,
    duration_ms,
    num_turns: Math.max(1, Math.ceil(num_turns / 2)), // assistant messages count
    stop_reason,
    model,
  };
}

// ─── Live Event Printer ─────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  gray: "\x1b[90m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
};

function printLiveEvent(evt: GeminiStreamEvent, mode: Mode): void {
  if (evt.type === "tool_use" && evt.tool_name) {
    let inputSummary = "";
    if (evt.parameters) {
      const cmd = evt.parameters.command;
      const query = evt.parameters.query;
      const address = evt.parameters.address;
      if (cmd) inputSummary = String(cmd).slice(0, 90).replace(/\n/g, " ");
      else if (query)
        inputSummary = `query: "${String(query).slice(0, 70).replace(/\n/g, " ")}"`;
      else if (address) inputSummary = `address: ${address}`;
    }
    process.stdout.write(
      `    ${C.blue}-> [${evt.tool_name}]${C.reset} ${C.gray}${inputSummary}${C.reset}\n`
    );
  }

  if (evt.type === "tool_result") {
    const out = evt.output ?? "";
    const preview = out.slice(0, 80).replace(/\n/g, " ");
    const status = evt.status === "success" ? C.green : C.red;
    process.stdout.write(
      `    ${status}<- ${out.length.toLocaleString()} chars${C.reset} ${C.gray}${preview ? `"${preview}..."` : ""}${C.reset}\n`
    );
  }

  if (
    evt.type === "message" &&
    evt.role === "assistant" &&
    evt.content?.trim() &&
    !evt.delta
  ) {
    const firstLine = evt.content.trim().split("\n")[0].slice(0, 100);
    process.stdout.write(`    ${C.gray}${firstLine}${C.reset}\n`);
  }
}

// ─── Derived Metrics ────────────────────────────────────────────────────────

function extractFilesAccessed(toolCalls: ToolCallRecord[]): string[] {
  const files = new Set<string>();
  for (const tc of toolCalls) {
    // From run_shell_command
    const cmd = String(tc.input.command ?? "");
    const fileMatch = cmd.match(
      /(?:cat|head|tail|less|more)\s+(?:-[^\s]+\s+)*([^\s|>]+)/
    );
    if (fileMatch) files.add(fileMatch[1]);
    // From read_file tool
    if (tc.name === "read_file" && tc.input.file_path) {
      files.add(String(tc.input.file_path));
    }
  }
  return Array.from(files).sort();
}

function extractTerraformCommands(toolCalls: ToolCallRecord[]): string[] {
  const cmds: string[] = [];
  for (const tc of toolCalls) {
    const cmd = String(tc.input.command ?? "");
    const tfMatch = cmd.match(/terraform\s+(.+)/);
    if (tfMatch) cmds.push(tfMatch[1].trim());
  }
  return cmds;
}

function extractMcpTools(toolCalls: ToolCallRecord[]): string[] {
  const builtinTools = new Set([
    "run_shell_command",
    "read_file",
    "write_file",
    "edit_file",
    "list_directory",
  ]);
  return toolCalls.map((tc) => tc.name).filter((n) => !builtinTools.has(n));
}

// ─── Trial Execution ────────────────────────────────────────────────────────

function runTrial(
  prompt: string,
  cwd: string,
  mode: Mode,
  geminiBin: string,
  liveLog: boolean
): Promise<TrialResult> {
  return new Promise((resolvePromise, reject) => {
    const systemPrompt =
      mode === "mcp" ? buildMcpSystemPrompt(cwd) : RAW_SYSTEM_PROMPT;
    const fullPrompt = `${systemPrompt}\n\n---\n\nTask: ${prompt}`;

    const args: string[] = [
      "-p",
      fullPrompt,
      "--yolo",
      "--output-format",
      "stream-json",
    ];

    let rawOutput = "";
    let stderrOutput = "";
    let lineBuffer = "";
    let timedOut = false;

    const proc = spawn(geminiBin, args, {
      cwd,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdin.end();

    const timeout = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
      setTimeout(() => proc.kill("SIGKILL"), 5_000);
    }, TRIAL_TIMEOUT_MS);

    proc.stdout.on("data", (data: Buffer) => {
      const chunk = data.toString();
      rawOutput += chunk;

      if (liveLog) {
        lineBuffer += chunk;
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line) as GeminiStreamEvent;
            printLiveEvent(evt, mode);
          } catch {
            // partial or non-JSON line
          }
        }
      }
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderrOutput += data.toString();
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to spawn gemini: ${err.message}`));
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);

      if (timedOut) {
        reject(new Error(`Trial timed out after ${TRIAL_TIMEOUT_MS / 1000}s`));
        return;
      }

      if (!rawOutput.trim()) {
        reject(
          new Error(
            `Gemini CLI exited with code ${code}, no output. stderr: ${stderrOutput.slice(0, 500)}`
          )
        );
        return;
      }

      const parsed = parseGeminiStreamOutput(rawOutput);

      if (!parsed.result && parsed.toolCalls.length === 0) {
        const debugPath = join(RESULTS_DIR, `debug-gemini-${Date.now()}.txt`);
        const debugContent = [
          `=== EXIT CODE: ${code} ===`,
          `=== STDOUT (${rawOutput.length} chars) ===`,
          rawOutput.slice(0, 5000),
          `=== STDERR (${stderrOutput.length} chars) ===`,
          stderrOutput.slice(0, 3000),
        ].join("\n");
        writeFileSync(debugPath, debugContent);
        console.log(`    ! Empty result — debug dump: ${debugPath}`);
      }

      const filesAccessed = extractFilesAccessed(parsed.toolCalls);
      const terraformCommands = extractTerraformCommands(parsed.toolCalls);
      const mcpToolsUsed = extractMcpTools(parsed.toolCalls);
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
        mcp_tools_used: mcpToolsUsed,
        total_tool_output_chars: totalToolOutputChars,
      });
    });
  });
}

// ─── Summary Printer ────────────────────────────────────────────────────────

function printSummary(modeLabel: string, results: PromptResult[]): void {
  console.log(`\n${C.bold}=== ${modeLabel} Summary ===${C.reset}`);
  console.log(
    `| # | Prompt                             | Diff   | Avg Tokens | Tools | Time(s) |`
  );
  console.log(
    `|---|------------------------------------|----- --|------------|-------|---------|`
  );

  let totalTokens = 0,
    totalTools = 0,
    totalTime = 0;

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

    totalTokens += r.trials.reduce(
      (s, t) => s + t.tokens_in + t.tokens_out,
      0
    );
    totalTools += r.trials.reduce((s, t) => s + t.tool_calls, 0);
    totalTime += r.trials.reduce((s, t) => s + t.wall_time_ms, 0);

    const shortP =
      r.prompt.length > 34 ? r.prompt.slice(0, 31) + "..." : r.prompt;
    console.log(
      `| ${String(r.id).padStart(1)} | ${shortP.padEnd(34)} | ${r.difficulty.padEnd(6)} | ${String(avgTokens).padStart(10)} | ${String(avgTools).padStart(5)} | ${avgTime.padStart(7)} |`
    );
  }

  console.log(
    `\n  Total: ${totalTokens.toLocaleString()} tokens, ${totalTools} tool calls, ${(totalTime / 1000).toFixed(1)}s wall time`
  );
}

// ─── Run Trials for a Single Prompt + Mode ─────────────────────────────────

async function runPromptTrials(
  prompt: PromptEntry,
  mode: Mode,
  infraDir: string,
  geminiBin: string,
  trialsPerPrompt: number,
  liveLog: boolean
): Promise<TrialResult[]> {
  const tempDir = createTempInfraDir(infraDir);
  if (mode === "mcp") {
    writeGeminiMcpConfig(tempDir);
  }

  const trials: TrialResult[] = [];

  try {
    for (let t = 1; t <= trialsPerPrompt; t++) {
      if (liveLog) {
        console.log(`\n    ${C.bold}Trial ${t}/${trialsPerPrompt}${C.reset}`);
      } else {
        process.stdout.write(`    Trial ${t}/${trialsPerPrompt}... `);
      }

      try {
        const trial = await runTrial(
          prompt.prompt,
          tempDir,
          mode,
          geminiBin,
          liveLog
        );
        trial.trial = t;
        trials.push(trial);

        const tokens = trial.tokens_in + trial.tokens_out;
        const toolDetail =
          mode === "mcp"
            ? trial.mcp_tools_used.join(", ")
            : trial.terraform_commands.slice(0, 5).join(", ");

        if (liveLog) {
          console.log(
            `\n    ${C.bold}Result:${C.reset} ${C.gray}${trial.tool_calls} tools, ${tokens.toLocaleString()} tokens, ${(trial.wall_time_ms / 1000).toFixed(1)}s, $${trial.cost_usd.toFixed(4)}${C.reset}`
          );
          if (toolDetail)
            console.log(`    Tools: ${C.gray}${toolDetail}${C.reset}`);
          console.log(`\n    ${C.bold}Answer:${C.reset}`);
          const answerPreview = trial.answer.slice(0, 600);
          for (const line of answerPreview.split("\n")) {
            console.log(`      ${line}`);
          }
          if (trial.answer.length > 600)
            console.log(
              `      ${C.gray}... (${trial.answer.length} chars total)${C.reset}`
            );
        } else {
          console.log(
            `${trial.tool_calls} tools, ${tokens.toLocaleString()} tokens, ${(trial.wall_time_ms / 1000).toFixed(1)}s, $${trial.cost_usd.toFixed(4)}, stop: ${trial.stop_reason}`
          );
          if (mode === "raw") {
            console.log(
              `      Files: [${trial.files_accessed.join(", ")}]`
            );
            console.log(
              `      TF:    [${trial.terraform_commands.slice(0, 5).join(", ")}${trial.terraform_commands.length > 5 ? "..." : ""}]`
            );
          } else {
            console.log(`      MCP:   [${toolDetail}]`);
          }
        }
      } catch (err) {
        console.error(
          `\n    ERROR in trial ${t}: ${(err as Error).message}`
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
          mcp_tools_used: [],
          total_tool_output_chars: 0,
        });
      }

      cleanupGemini(tempDir);
      // Re-write MCP config after cleanup so next trial has MCP tools
      if (mode === "mcp") {
        writeGeminiMcpConfig(tempDir);
      }

      if (t < trialsPerPrompt) {
        await new Promise((r) => setTimeout(r, 3_000));
      }
    }
  } finally {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch (err) {
      console.warn(
        `    Warning: failed to clean temp dir: ${(err as Error).message}`
      );
    }
  }

  return trials;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const modeArg = getArg("--mode") ?? "both";
  const trialsPerPrompt = parseInt(getArg("--trials") ?? String(DEFAULT_TRIALS), 10);
  const promptFilter = getArg("--prompt")
    ? parseInt(getArg("--prompt")!, 10)
    : undefined;
  const liveLog = args.includes("--live");

  const modes: Mode[] =
    modeArg === "both"
      ? ["raw", "mcp"]
      : modeArg === "raw"
        ? ["raw"]
        : modeArg === "mcp"
          ? ["mcp"]
          : (() => {
              console.error(
                `Unknown mode: ${modeArg}. Use --mode raw, --mode mcp, or --mode both`
              );
              process.exit(1);
            })();

  if (modes.includes("mcp") && !existsSync(MCP_SERVER_BIN)) {
    console.error(`MCP server not built. Run 'npm run build' first.`);
    console.error(`Expected: ${MCP_SERVER_BIN}`);
    process.exit(1);
  }

  // Detect Gemini binary
  let geminiBin: string;
  try {
    geminiBin = findGeminiBin();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  // Get CLI version
  let cliVersion = "unknown";
  try {
    cliVersion = execSync(`gemini --version`, {
      encoding: "utf-8",
      shell: true,
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

  console.log(`\n${C.bold}=== Gemini Experiment Runner ===${C.reset}`);
  console.log(`Modes:    ${C.cyan}${modes.join(" + ")} (interleaved per prompt)${C.reset}`);
  console.log(`CLI:      ${cliVersion}`);
  console.log(
    `Prompts:  ${prompts.length} (${trialsPerPrompt} trial${trialsPerPrompt > 1 ? "s" : ""} each)`
  );
  console.log(`Infra:    ${infraDir}`);
  if (modes.includes("mcp")) {
    console.log(`Server:   ${MCP_SERVER_BIN}`);
  }
  console.log(
    `Live log: ${liveLog ? "on" : "off (add --live to watch tool calls)"}`
  );
  console.log(`Timeout:  ${TRIAL_TIMEOUT_MS / 1000}s per trial`);
  console.log(`===================================\n`);

  mkdirSync(RESULTS_DIR, { recursive: true });

  // Accumulate results per mode
  const resultsByMode: Map<Mode, PromptResult[]> = new Map();
  for (const mode of modes) {
    resultsByMode.set(mode, []);
  }

  // Interleaved: for each prompt, run all modes before moving to next prompt
  for (let pi = 0; pi < prompts.length; pi++) {
    const prompt = prompts[pi];
    console.log(
      `\n${C.bold}[${prompt.id}/${prompts.length}]${C.reset} "${C.yellow}${prompt.prompt}${C.reset}" ${C.gray}(${prompt.difficulty}, ${prompt.category})${C.reset}`
    );

    for (const mode of modes) {
      console.log(
        `\n  ${C.bold}${C.cyan}--- ${mode.toUpperCase()} ---${C.reset}`
      );

      const trials = await runPromptTrials(
        prompt,
        mode,
        infraDir,
        geminiBin,
        trialsPerPrompt,
        liveLog
      );

      resultsByMode.get(mode)!.push({
        id: prompt.id,
        prompt: prompt.prompt,
        difficulty: prompt.difficulty,
        category: prompt.category,
        scoring: prompt.scoring,
        trials,
      });

      // Brief pause between modes for same prompt
      if (mode !== modes[modes.length - 1]) {
        await new Promise((r) => setTimeout(r, 3_000));
      }
    }

    // Save intermediate results after each prompt (crash recovery)
    for (const mode of modes) {
      const partialPath = join(RESULTS_DIR, `gemini-${mode}-partial.json`);
      const partial: RunResult = {
        metadata: {
          mode,
          model: "gemini-3-flash-preview",
          timestamp: new Date().toISOString(),
          infra_path: infraDir,
          trials_per_prompt: trialsPerPrompt,
          total_prompts: prompts.length,
          gemini_cli_version: cliVersion,
        },
        results: resultsByMode.get(mode)!,
      };
      writeFileSync(partialPath, JSON.stringify(partial, null, 2));
    }

    if (pi < prompts.length - 1) {
      console.log(`\n  ${C.gray}(waiting 5s before next prompt...)${C.reset}`);
      await new Promise((r) => setTimeout(r, 5_000));
    }
  }

  // Write final output files
  const outputFiles: string[] = [];
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);

  for (const mode of modes) {
    const runResult: RunResult = {
      metadata: {
        mode,
        model: "gemini-3-flash-preview",
        timestamp: new Date().toISOString(),
        infra_path: infraDir,
        trials_per_prompt: trialsPerPrompt,
        total_prompts: prompts.length,
        gemini_cli_version: cliVersion,
      },
      results: resultsByMode.get(mode)!,
    };

    const outPath = join(RESULTS_DIR, `gemini-${mode}-${timestamp}.json`);
    writeFileSync(outPath, JSON.stringify(runResult, null, 2));
    outputFiles.push(outPath);

    // Clean up partial file
    const partialPath = join(RESULTS_DIR, `gemini-${mode}-partial.json`);
    if (existsSync(partialPath)) {
      try { unlinkSync(partialPath); } catch { /* ignore */ }
    }

    printSummary(`Gemini ${mode.toUpperCase()}`, resultsByMode.get(mode)!);
  }

  // ─── Score per-mode results ──────────────────────────────────────────────
  console.log(`\n${C.bold}=== Scoring Results ===${C.reset}`);

  const scoredFiles: string[] = [];

  for (const mode of modes) {
    const runResult = JSON.parse(
      readFileSync(
        outputFiles[modes.indexOf(mode)],
        "utf-8"
      )
    );
    const { scoredPath, summaryPath } = scoreAndWrite(runResult, RESULTS_DIR);
    scoredFiles.push(scoredPath);
    console.log(`\n${C.cyan}[${mode.toUpperCase()}]${C.reset} Scored: ${scoredPath}`);
    console.log(`  Summary: ${summaryPath}`);
    // Print summary to console
    console.log(readFileSync(summaryPath, "utf-8"));
  }

  // ─── Build and score combined Raw vs MCP result ─────────────────────────
  if (modes.length === 2 && modes.includes("raw") && modes.includes("mcp")) {
    console.log(`\n${C.bold}=== Combined Raw vs MCP ===${C.reset}`);

    const rawResults = resultsByMode.get("raw")!;
    const mcpResults = resultsByMode.get("mcp")!;

    const combined: CombinedRunResult = {
      metadata: {
        modes: ["raw", "mcp"],
        model: "gemini-3-flash-preview",
        timestamp: new Date().toISOString(),
        infra_path: infraDir,
        trials_per_prompt: trialsPerPrompt,
        total_prompts: prompts.length,
        claude_cli_version: cliVersion, // field name kept for scorer compat
        raw_start: rawResults[0]?.trials[0] ? timestamp : "",
        raw_end: timestamp,
        mcp_start: timestamp,
        mcp_end: timestamp,
      },
      results: prompts.map((p) => {
        const rawPrompt = rawResults.find((r) => r.id === p.id);
        const mcpPrompt = mcpResults.find((r) => r.id === p.id);
        return {
          id: p.id,
          prompt: p.prompt,
          difficulty: p.difficulty,
          category: p.category,
          scoring: p.scoring,
          raw_trials: (rawPrompt?.trials ?? []) as unknown as Record<string, unknown>[],
          mcp_trials: (mcpPrompt?.trials ?? []) as unknown as Record<string, unknown>[],
        };
      }),
    };

    const combinedPath = join(RESULTS_DIR, `combined-${timestamp}.json`);
    writeFileSync(combinedPath, JSON.stringify(combined, null, 2));

    const { scoredPath, summaryPath } = scoreAndWrite(combined, RESULTS_DIR);
    scoredFiles.push(scoredPath);
    console.log(`  Combined scored: ${scoredPath}`);
    console.log(`  Combined summary: ${summaryPath}`);
    console.log(readFileSync(summaryPath, "utf-8"));
  }

  // ─── Final output ───────────────────────────────────────────────────────
  console.log(`\n${C.bold}=== All Done ===${C.reset}`);
  console.log(`\nRaw result files:`);
  for (const f of outputFiles) {
    console.log(`  ${f}`);
  }
  console.log(`\nScored files:`);
  for (const f of scoredFiles) {
    console.log(`  ${f}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
