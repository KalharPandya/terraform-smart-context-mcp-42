#!/usr/bin/env npx tsx
/**
 * Codex CLI Experiment Runner
 *
 * Runs all 30 prompts through OpenAI Codex CLI in raw and/or mcp modes.
 * Default (no --mode flag) runs BOTH modes back-to-back and prints a
 * side-by-side token comparison at the end.
 *
 * Usage:
 *   npx tsx experiments/baseline/runner-codex.ts                   # both modes, 2 trials
 *   npx tsx experiments/baseline/runner-codex.ts --mode raw        # raw only
 *   npx tsx experiments/baseline/runner-codex.ts --mode mcp        # mcp only
 *   npx tsx experiments/baseline/runner-codex.ts --prompt 6        # single prompt
 *   npx tsx experiments/baseline/runner-codex.ts --trials 1        # 1 trial per prompt
 *   npx tsx experiments/baseline/runner-codex.ts --live            # stream live events
 *   npx tsx experiments/baseline/runner-codex.ts --dump-raw        # save raw JSONL for debugging
 *
 * Output files: experiments/baseline/results/codex-raw-<ts>.json
 *               experiments/baseline/results/codex-mcp-<ts>.json
 *
 * TrialResult schema is identical to runner.ts — scorer.ts works unchanged.
 * cost_usd is always 0 (Codex does not expose cost in the JSONL stream).
 */

import { execSync, spawn } from "child_process";
import {
  readFileSync,
  writeFileSync,
  rmSync,
  cpSync,
  existsSync,
  readdirSync,
  mkdirSync,
} from "fs";
import { resolve, join, relative } from "path";
import { tmpdir, homedir } from "os";
import { randomUUID } from "crypto";

// ─── Types ───────────────────────────────────────────────────────────────────

type Mode = "raw" | "mcp";

interface PromptEntry {
  id: number;
  prompt: string;
  difficulty: string;
  category: string;
  scoring: { type: string; ground_truth: Record<string, unknown> };
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
    codex_cli_version: string;
  };
  results: PromptResult[];
}

// ─── Config ──────────────────────────────────────────────────────────────────

const SCRIPT_DIR = resolve(
  decodeURIComponent(
    new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")
  )
);
const REPO_ROOT = resolve(SCRIPT_DIR, "../..");
const PROMPTS_PATH = join(SCRIPT_DIR, "prompts.json");
const RESULTS_DIR = join(SCRIPT_DIR, "results");
const MCP_SERVER_BIN = join(REPO_ROOT, "dist", "index.js");

// ─── Colors ──────────────────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  gray: "\x1b[90m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  bold: "\x1b[1m",
};

// ─── Binary Detection ────────────────────────────────────────────────────────

function findCodexBin(): string {
  // Windows: codex is a .cmd shim; shell: true handles resolution
  if (process.platform === "win32") return "codex";
  try {
    const found = execSync("which codex", { encoding: "utf-8" }).trim();
    if (found && existsSync(found)) return found;
  } catch { /* fall through */ }
  throw new Error(
    "codex CLI not found. Install: npm install -g @openai/codex"
  );
}

// ─── System Prompts ──────────────────────────────────────────────────────────

const RAW_SYSTEM_PROMPT = `You are an infrastructure assistant. There is a Terraform project in the current directory that is already initialized and applied (state exists with 75 resources across 6 modules).

You have access to shell commands to run:
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

You have ONE MCP tool: terraform. Use the "type" parameter to pick the operation.
Always pass workingDir: "${dir}" in every call.

Start with type: "schema" to discover GraphQL queries and prebuilt queries,
then use type: "query" for dependency/relationship questions.

Rules:
- Use ONLY the terraform MCP tool. Do NOT run shell commands or read files directly.
- Do not guess — verify with tools.
- Synthesize your answer clearly — do not dump raw tool output.`;
}

// ─── AGENTS.md ───────────────────────────────────────────────────────────────
// Codex reads AGENTS.md from the working directory as the system/project prompt.

function writeAgentsMd(tempDir: string, mode: Mode): void {
  const content =
    mode === "raw"
      ? RAW_SYSTEM_PROMPT
      : buildMcpSystemPrompt(tempDir);
  writeFileSync(join(tempDir, "AGENTS.md"), content + "\n");
}

// ─── Codex Config (TOML) ─────────────────────────────────────────────────────
// We isolate each mode's config in a temp CODEX_HOME dir so trials don't
// interfere with the global ~/.codex/config.toml.

function writeCodexConfig(mode: Mode, codexHomeDir: string): void {
  // Seed the temp CODEX_HOME from ~/.codex so auth tokens and other settings
  // are preserved. We then overwrite only config.toml with our custom MCP config.
  const globalCodexHome = join(homedir(), ".codex");
  if (existsSync(globalCodexHome)) {
    cpSync(globalCodexHome, codexHomeDir, { recursive: true });
  } else {
    mkdirSync(codexHomeDir, { recursive: true });
  }

  let toml: string;
  if (mode === "raw") {
    toml = "# Raw mode — no MCP servers\n";
  } else {
    const serverBin = MCP_SERVER_BIN.replace(/\\/g, "/");
    toml =
      `[mcp_servers.terraform]\n` +
      `command = "node"\n` +
      `args = ["${serverBin}"]\n` +
      `tool_timeout_sec = 120\n` +
      `startup_timeout_sec = 30\n` +
      `\n` +
      `[mcp_servers.terraform.env]\n` +
      `TERRAFORM_MCP_GATE = "read"\n`;
  }

  writeFileSync(join(codexHomeDir, "config.toml"), toml);
}

// ─── Temp Infra Dir ──────────────────────────────────────────────────────────

function createTempInfraDir(infraDir: string): string {
  const tempDir = join(tmpdir(), `exp-codex-${randomUUID()}`);
  mkdirSync(tempDir, { recursive: true });

  copyTfFiles(infraDir, tempDir, infraDir);

  for (const file of [
    ".terraform.lock.hcl",
    "terraform.tfstate",
    "terraform.tfvars",
  ]) {
    const src = join(infraDir, file);
    if (existsSync(src)) cpSync(src, join(tempDir, file));
  }

  const tfDir = join(infraDir, ".terraform");
  if (existsSync(tfDir)) {
    cpSync(tfDir, join(tempDir, ".terraform"), { recursive: true });
  }

  return tempDir;
}

function copyTfFiles(srcDir: string, destDir: string, rootDir: string): void {
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
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

// ─── JSONL Parser ────────────────────────────────────────────────────────────
// Codex emits one JSON object per line with --json.
// Event type names are not fully documented; we handle known types and fall
// back gracefully. Use --dump-raw on the first run to inspect the raw stream.

interface CodexEvent {
  type?: string;
  // item.agent_message
  content?: Array<{ type?: string; text?: string }> | string;
  // item.mcp_tool_call
  name?: string;
  server_label?: string;
  server?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  // item.command_execution
  command?: string;
  // usage (turn.completed or summary)
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cached_tokens?: number;
    total_tokens?: number;
  };
  stop_reason?: string;
  [key: string]: unknown;
}

interface ParsedResult {
  answer: string;
  toolCalls: ToolCallRecord[];
  tokens_in: number;
  tokens_out: number;
  duration_ms: number;
  num_turns: number;
  stop_reason: string;
}

function extractContent(content: CodexEvent["content"]): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((c) => c.text)
      .map((c) => c.text!)
      .join("\n");
  }
  return "";
}

function parseCodexJsonl(rawOutput: string): ParsedResult {
  const lines = rawOutput.split("\n").filter((l) => l.trim());

  const toolCalls: ToolCallRecord[] = [];
  const answerParts: string[] = [];
  let tokens_in = 0;
  let tokens_out = 0;
  let duration_ms = 0;
  let num_turns = 0;
  let stop_reason = "unknown";

  for (const line of lines) {
    let ev: CodexEvent;
    try {
      ev = JSON.parse(line);
    } catch {
      continue;
    }

    const evType = ev.type ?? "";

    // ── Nested item events (item.completed wraps the actual payload) ───────
    // All substantive events arrive as:
    //   { type: "item.completed", item: { type: "agent_message"|"command_execution"|"mcp_tool_call", ... } }
    if (evType === "item.completed" && ev.item && typeof ev.item === "object") {
      const item = ev.item as Record<string, unknown>;
      const itemType = String(item.type ?? "");

      // Answer
      if (itemType === "agent_message") {
        const text = String(item.text ?? "").trim();
        if (text) answerParts.push(text);
      }

      // Shell command
      if (itemType === "command_execution") {
        const cmd = String(item.command ?? "");
        const out = String(item.aggregated_output ?? "");
        const exitCode = item.exit_code;
        const status = String(item.status ?? "");
        toolCalls.push({
          name: "Bash",
          input: { command: cmd },
          output_preview: out.slice(0, 500),
          output_chars: out.length,
          tokens_in_this_turn: 0,
          tokens_out_this_turn: 0,
          is_error: status === "declined" || (exitCode !== null && exitCode !== 0),
        });
      }

      // MCP tool call
      if (itemType === "mcp_tool_call") {
        const server = String(item.server ?? "terraform");
        const tool   = String(item.tool ?? "unknown");
        const qName  = `mcp__${server}__${tool}`;
        const args   = (item.arguments as Record<string, unknown>) ?? {};

        let outputText = "";
        if (item.result != null) {
          outputText = typeof item.result === "string"
            ? item.result
            : JSON.stringify(item.result).slice(0, 2000);
        } else if (item.error != null) {
          outputText = `[error] ${JSON.stringify(item.error)}`;
        }

        toolCalls.push({
          name: qName,
          input: args,
          output_preview: outputText.slice(0, 500),
          output_chars: outputText.length,
          tokens_in_this_turn: 0,
          tokens_out_this_turn: 0,
          is_error: item.status === "failed",
        });
      }
    }

    // ── Token usage on turn.completed ──────────────────────────────────────
    if (evType === "turn.completed") {
      num_turns += 1;
      stop_reason = "end_turn";
      if (ev.usage && typeof ev.usage === "object") {
        const u = ev.usage;
        if (u.input_tokens)  tokens_in  = u.input_tokens;
        if (u.output_tokens) tokens_out = u.output_tokens;
      }
    }

    if (evType === "turn.failed") stop_reason = "error";

    if (typeof (ev as any).duration_ms === "number")
      duration_ms = (ev as any).duration_ms as number;
  }

  return {
    answer: answerParts.length > 0 ? answerParts[answerParts.length - 1] : "",
    toolCalls,
    tokens_in,
    tokens_out,
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
    const m = cmd.match(
      /(?:cat|head|tail|less|more)\s+(?:-[^\s]+\s+)*([^\s|>]+)/
    );
    if (m) files.add(m[1]);
  }
  return Array.from(files).sort();
}

function extractTerraformCommands(toolCalls: ToolCallRecord[]): string[] {
  const cmds: string[] = [];
  for (const tc of toolCalls) {
    const cmd = String(tc.input.command ?? "");
    // Works for both Unix (`terraform plan`) and Windows PowerShell wrappers
    const m = cmd.match(/terraform\s+(['"]?)(.+?)\1\s*(?:'|")?$/m);
    if (m) cmds.push(m[2].trim());
  }
  return cmds;
}

function extractMcpTools(toolCalls: ToolCallRecord[]): string[] {
  return toolCalls.map((tc) => tc.name).filter((n) => n.startsWith("mcp__"));
}

// ─── Live Event Printer ───────────────────────────────────────────────────────

function printLiveEvent(ev: CodexEvent): void {
  if (ev.type !== "item.completed" || !ev.item) return;
  const item = ev.item as Record<string, unknown>;
  const itemType = String(item.type ?? "");

  if (itemType === "agent_message") {
    const text = String(item.text ?? "").trim();
    if (text) {
      const first = text.split("\n")[0].slice(0, 100);
      process.stdout.write(`    ${C.gray}💬 ${first}${C.reset}\n`);
    }
  }

  if (itemType === "mcp_tool_call") {
    const tool = String(item.tool ?? "unknown");
    const args = item.arguments
      ? JSON.stringify(item.arguments).slice(0, 80).replace(/\n/g, " ")
      : "";
    const status = String(item.status ?? "");
    const color = status === "failed" ? C.red : C.blue;
    process.stdout.write(
      `    ${color}→ [${tool}]${C.reset} ${C.gray}${args}${C.reset}\n`
    );
    if (item.result) {
      const out = typeof item.result === "string"
        ? item.result
        : JSON.stringify(item.result);
      process.stdout.write(
        `    ${C.green}← ${out.length} chars${C.reset} ${C.gray}"${out.slice(0, 60).replace(/\n/g, " ")}..."${C.reset}\n`
      );
    } else if (item.error) {
      process.stdout.write(
        `    ${C.red}✗ ${JSON.stringify(item.error)}${C.reset}\n`
      );
    }
  }

  if (itemType === "command_execution") {
    const cmd = String(item.command ?? "").slice(0, 90).replace(/\n/g, " ");
    process.stdout.write(
      `    ${C.blue}→ [bash]${C.reset} ${C.gray}${cmd}${C.reset}\n`
    );
  }
}

// ─── Trial Execution ─────────────────────────────────────────────────────────

function runTrial(
  promptText: string,
  tempDir: string,
  codexBin: string,
  codexHomeDir: string,
  liveLog: boolean,
  dumpRaw: boolean
): Promise<TrialResult> {
  return new Promise((resolvePromise, reject) => {
    const startMs = Date.now();

    // codex exec --json --full-auto --skip-git-repo-check -C <dir> -
    // The system prompt is in AGENTS.md in tempDir; codex reads it automatically.
    // We pass "-" so codex reads the prompt from stdin, avoiding cmd.exe
    // argument splitting issues on Windows with multi-word prompts.
    const args = [
      "exec",
      "--json",
      "--dangerously-bypass-approvals-and-sandbox",
      "--skip-git-repo-check",
      "-C",
      tempDir,
      "-",
    ];

    let rawOutput = "";
    let stderrOutput = "";
    let lineBuffer = "";

    const proc = spawn(codexBin, args, {
      cwd: tempDir,
      env: {
        ...process.env,
        CODEX_HOME: codexHomeDir,
      },
      stdio: ["pipe", "pipe", "pipe"],
      // Windows: shell: true lets cmd.exe resolve the .cmd shim
      shell: process.platform === "win32",
    });

    // Pipe the prompt via stdin — avoids all shell quoting/escaping issues
    proc.stdin.write(promptText);
    proc.stdin.end();

    proc.stdout.on("data", (data: Buffer) => {
      const chunk = data.toString();
      rawOutput += chunk;

      if (liveLog) {
        lineBuffer += chunk;
        const evLines = lineBuffer.split("\n");
        lineBuffer = evLines.pop() ?? "";
        for (const evLine of evLines) {
          if (!evLine.trim()) continue;
          try {
            printLiveEvent(JSON.parse(evLine) as CodexEvent);
          } catch { /* partial or non-JSON line */ }
        }
      }
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderrOutput += data.toString();
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn codex: ${err.message}`));
    });

    proc.on("close", (code) => {
      const wallMs = Date.now() - startMs;

      if (dumpRaw) {
        const debugPath = join(
          RESULTS_DIR,
          `debug-codex-${Date.now()}.jsonl`
        );
        writeFileSync(
          debugPath,
          [
            `=== EXIT CODE: ${code} ===`,
            `=== STDOUT (${rawOutput.length} chars) ===`,
            rawOutput,
            `=== STDERR (${stderrOutput.length} chars) ===`,
            stderrOutput,
          ].join("\n")
        );
        console.log(`    ${C.yellow}[dump-raw] ${debugPath}${C.reset}`);
      }

      if (!rawOutput.trim()) {
        reject(
          new Error(
            `codex exited ${code}, no stdout. stderr: ${stderrOutput.slice(0, 400)}`
          )
        );
        return;
      }

      const parsed = parseCodexJsonl(rawOutput);
      const duration = parsed.duration_ms > 0 ? parsed.duration_ms : wallMs;

      resolvePromise({
        trial: 0,
        answer: parsed.answer,
        tokens_in: parsed.tokens_in,
        tokens_out: parsed.tokens_out,
        cost_usd: 0,
        tool_calls: parsed.toolCalls.length,
        tool_call_details: parsed.toolCalls,
        wall_time_ms: duration,
        num_turns: parsed.num_turns,
        stop_reason: parsed.stop_reason,
        files_accessed: extractFilesAccessed(parsed.toolCalls),
        terraform_commands: extractTerraformCommands(parsed.toolCalls),
        mcp_tools_used: extractMcpTools(parsed.toolCalls),
        total_tool_output_chars: parsed.toolCalls.reduce(
          (s, tc) => s + tc.output_chars,
          0
        ),
      });
    });
  });
}

// ─── Run One Mode ─────────────────────────────────────────────────────────────

async function runMode(
  mode: Mode,
  prompts: PromptEntry[],
  trialsPerPrompt: number,
  infraDir: string,
  codexBin: string,
  codexVersion: string,
  liveLog: boolean,
  dumpRaw: boolean
): Promise<{ results: PromptResult[]; outPath: string }> {
  console.log(
    `\n${C.bold}=== Mode: ${C.cyan}${mode.toUpperCase()}${C.reset}${C.bold} — ${prompts.length} prompts × ${trialsPerPrompt} trials ===${C.reset}\n`
  );

  // One shared CODEX_HOME per mode run — all trials for this mode use the
  // same server config so MCP server starts once per trial, not once globally.
  const codexHomeDir = join(tmpdir(), `codex-home-${randomUUID()}`);
  writeCodexConfig(mode, codexHomeDir);

  const results: PromptResult[] = [];

  try {
    for (const prompt of prompts) {
      console.log(
        `${C.bold}[${prompt.id}]${C.reset} "${C.yellow}${prompt.prompt}${C.reset}" ${C.gray}(${prompt.difficulty}, ${prompt.category})${C.reset}`
      );

      const tempDir = createTempInfraDir(infraDir);
      writeAgentsMd(tempDir, mode);

      const trials: TrialResult[] = [];

      try {
        for (let t = 1; t <= trialsPerPrompt; t++) {
          if (liveLog) {
            console.log(`\n  ${C.bold}Trial ${t}/${trialsPerPrompt}${C.reset}`);
          } else {
            process.stdout.write(`  Trial ${t}/${trialsPerPrompt}... `);
          }

          try {
            const trial = await runTrial(
              prompt.prompt,
              tempDir,
              codexBin,
              codexHomeDir,
              liveLog,
              dumpRaw
            );
            trial.trial = t;
            trials.push(trial);

            const tokens = trial.tokens_in + trial.tokens_out;
            const toolDetail =
              mode === "mcp"
                ? trial.mcp_tools_used
                    .map((n) => n.replace("mcp__terraform__", ""))
                    .join(", ")
                : trial.terraform_commands.slice(0, 4).join(", ");

            if (liveLog) {
              console.log(
                `\n  ${C.bold}Result:${C.reset} ${C.gray}${trial.tool_calls} tools, ${tokens.toLocaleString()} tokens, ${(trial.wall_time_ms / 1000).toFixed(1)}s${C.reset}`
              );
              if (toolDetail)
                console.log(`  Tools: ${C.gray}${toolDetail}${C.reset}`);
              console.log(`\n  ${C.bold}Answer:${C.reset}`);
              const preview = trial.answer.slice(0, 400);
              for (const line of preview.split("\n"))
                console.log(`    ${line}`);
              if (trial.answer.length > 400)
                console.log(
                  `    ${C.gray}... (${trial.answer.length} chars total)${C.reset}`
                );
            } else {
              console.log(
                `${trial.tool_calls} tools, ${tokens.toLocaleString()} tokens, ${(trial.wall_time_ms / 1000).toFixed(1)}s, stop: ${trial.stop_reason}`
              );
              if (mode === "raw") {
                console.log(
                  `    TF: [${trial.terraform_commands.slice(0, 4).join(", ")}${trial.terraform_commands.length > 4 ? "..." : ""}]`
                );
              } else if (toolDetail) {
                console.log(`    MCP: [${toolDetail}]`);
              }
            }
          } catch (err) {
            console.error(
              `\n  ${C.red}ERROR trial ${t}: ${(err as Error).message}${C.reset}`
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

          if (t < trialsPerPrompt) {
            await new Promise((r) => setTimeout(r, 3_000));
          }
        }
      } finally {
        try {
          rmSync(tempDir, { recursive: true, force: true });
        } catch { /* ignore */ }
      }

      results.push({
        id: prompt.id,
        prompt: prompt.prompt,
        difficulty: prompt.difficulty,
        category: prompt.category,
        scoring: prompt.scoring,
        trials,
      });

      if (prompt !== prompts[prompts.length - 1]) {
        await new Promise((r) => setTimeout(r, 3_000));
      }
    }
  } finally {
    try {
      rmSync(codexHomeDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }

  const runResult: RunResult = {
    metadata: {
      mode,
      model: "gpt-5.4",
      timestamp: new Date().toISOString(),
      infra_path: infraDir,
      trials_per_prompt: trialsPerPrompt,
      total_prompts: prompts.length,
      codex_cli_version: codexVersion,
    },
    results,
  };

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outPath = join(RESULTS_DIR, `codex-${mode}-${ts}.json`);
  writeFileSync(outPath, JSON.stringify(runResult, null, 2));
  console.log(`\n${C.green}✓ Results: ${outPath}${C.reset}`);

  return { results, outPath };
}

// ─── Summary Table ────────────────────────────────────────────────────────────

function printSummary(mode: Mode, results: PromptResult[]): void {
  console.log(`\n${C.bold}=== ${mode.toUpperCase()} Summary ===${C.reset}`);
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
    const n = r.trials.length || 1;
    const avgTokens = Math.round(
      r.trials.reduce((s, t) => s + t.tokens_in + t.tokens_out, 0) / n
    );
    const avgTools = Math.round(
      r.trials.reduce((s, t) => s + t.tool_calls, 0) / n
    );
    const avgTime = (
      r.trials.reduce((s, t) => s + t.wall_time_ms, 0) /
      n /
      1000
    ).toFixed(1);

    totalTokens += r.trials.reduce((s, t) => s + t.tokens_in + t.tokens_out, 0);
    totalTools += r.trials.reduce((s, t) => s + t.tool_calls, 0);
    totalTime += r.trials.reduce((s, t) => s + t.wall_time_ms, 0);

    const shortP =
      r.prompt.length > 34 ? r.prompt.slice(0, 31) + "..." : r.prompt;
    console.log(
      `| ${String(r.id).padStart(2)} | ${shortP.padEnd(34)} | ${r.difficulty.padEnd(6)} | ${String(avgTokens).padStart(10)} | ${String(avgTools).padStart(5)} | ${avgTime.padStart(7)} |`
    );
  }

  const allTrials = results.flatMap((r) => r.trials);
  const totalIn = allTrials.reduce((s, t) => s + t.tokens_in, 0);
  const totalOut = allTrials.reduce((s, t) => s + t.tokens_out, 0);

  console.log(
    `|    | ${"TOTAL".padEnd(34)} | ${"".padEnd(6)} | ${String(totalTokens).padStart(10)} | ${String(totalTools).padStart(5)} | ${(totalTime / 1000).toFixed(1).padStart(7)} |`
  );
  console.log(
    `\nTotal tokens: ${C.cyan}${totalTokens.toLocaleString()}${C.reset}  (in: ${totalIn.toLocaleString()}, out: ${totalOut.toLocaleString()})  tools: ${totalTools}  time: ${(totalTime / 1000).toFixed(0)}s`
  );
}

// ─── Cross-mode Comparison ───────────────────────────────────────────────────

function printComparison(
  rawResults: PromptResult[],
  mcpResults: PromptResult[]
): void {
  const sum = (rs: PromptResult[], fn: (t: TrialResult) => number) =>
    rs.flatMap((r) => r.trials).reduce((s, t) => s + fn(t), 0);

  const rawTok = sum(rawResults, (t) => t.tokens_in + t.tokens_out);
  const mcpTok = sum(mcpResults, (t) => t.tokens_in + t.tokens_out);
  const rawIn  = sum(rawResults, (t) => t.tokens_in);
  const mcpIn  = sum(mcpResults, (t) => t.tokens_in);
  const rawOut = sum(rawResults, (t) => t.tokens_out);
  const mcpOut = sum(mcpResults, (t) => t.tokens_out);
  const rawTools = sum(rawResults, (t) => t.tool_calls);
  const mcpTools = sum(mcpResults, (t) => t.tool_calls);
  const rawTime  = sum(rawResults, (t) => t.wall_time_ms);
  const mcpTime  = sum(mcpResults, (t) => t.wall_time_ms);

  const delta = (a: number, b: number, pct = false): string => {
    const d = b - a;
    const sign = d >= 0 ? "+" : "";
    if (pct && a > 0) {
      return `${sign}${((d / a) * 100).toFixed(1)}%`;
    }
    return `${sign}${d.toLocaleString()}`;
  };

  console.log(`\n${C.bold}=== Raw vs MCP — Token Comparison ===${C.reset}`);
  console.log(
    `${"Metric".padEnd(22)} ${"Raw".padStart(14)} ${"MCP".padStart(14)} ${"Delta".padStart(14)} ${"Change".padStart(10)}`
  );
  console.log("".padEnd(74, "-"));

  const row = (
    label: string,
    a: number,
    b: number,
    fmt: (n: number) => string = (n) => n.toLocaleString()
  ) => {
    console.log(
      `${label.padEnd(22)} ${fmt(a).padStart(14)} ${fmt(b).padStart(14)} ${delta(a, b).padStart(14)} ${delta(a, b, true).padStart(10)}`
    );
  };

  row("Total tokens", rawTok, mcpTok);
  row("  Input tokens", rawIn, mcpIn);
  row("  Output tokens", rawOut, mcpOut);
  row("Tool calls", rawTools, mcpTools);
  row("Wall time (s)", rawTime / 1000, mcpTime / 1000, (n) => n.toFixed(1));

  const tokSaved = rawTok - mcpTok;
  if (tokSaved > 0) {
    console.log(
      `\n${C.green}MCP saved ${tokSaved.toLocaleString()} tokens (${((tokSaved / rawTok) * 100).toFixed(1)}% reduction)${C.reset}`
    );
  } else {
    console.log(
      `\n${C.yellow}MCP used ${Math.abs(tokSaved).toLocaleString()} more tokens than raw${C.reset}`
    );
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };

  const modeArg = getArg("--mode");
  const trialsPerPrompt = parseInt(getArg("--trials") ?? "2", 10);
  const promptFilter = getArg("--prompt")
    ? parseInt(getArg("--prompt")!, 10)
    : undefined;
  const liveLog = args.includes("--live");
  const dumpRaw = args.includes("--dump-raw");

  // Default: run both modes so we always get a comparison
  const modesToRun: Mode[] =
    modeArg === "raw" ? ["raw"] :
    modeArg === "mcp" ? ["mcp"] :
    ["raw", "mcp"];

  if (modesToRun.includes("mcp") && !existsSync(MCP_SERVER_BIN)) {
    console.error(
      `MCP server not built. Run 'npm run build' first.\nExpected: ${MCP_SERVER_BIN}`
    );
    process.exit(1);
  }

  let codexBin: string;
  try {
    codexBin = findCodexBin();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  let codexVersion = "unknown";
  try {
    codexVersion = execSync("codex --version", {
      encoding: "utf-8",
      shell: true,
    }).trim();
  } catch { /* ignore */ }

  const promptsFile: PromptsFile = JSON.parse(
    readFileSync(PROMPTS_PATH, "utf-8")
  );
  let prompts = promptsFile.prompts;
  if (promptFilter !== undefined) {
    prompts = prompts.filter((p) => p.id === promptFilter);
    if (!prompts.length) {
      console.error(`No prompt with id ${promptFilter}`);
      process.exit(1);
    }
  }

  const infraDir = resolve(SCRIPT_DIR, promptsFile.infra_path);

  console.log(`\n${C.bold}=== Codex Experiment Runner ===${C.reset}`);
  console.log(`Codex:    ${codexVersion}`);
  console.log(`Modes:    ${C.cyan}${modesToRun.join(", ")}${C.reset}`);
  console.log(
    `Prompts:  ${prompts.length} × ${trialsPerPrompt} trials × ${modesToRun.length} mode(s) = ${prompts.length * trialsPerPrompt * modesToRun.length} total runs`
  );
  console.log(`Infra:    ${infraDir}`);
  if (modesToRun.includes("mcp"))
    console.log(`Server:   ${MCP_SERVER_BIN}`);
  console.log(`Results:  ${RESULTS_DIR}`);
  console.log(`Live log: ${liveLog ? "on" : "off"}`);
  console.log(`================================\n`);

  const allResults: Partial<Record<Mode, PromptResult[]>> = {};

  for (let i = 0; i < modesToRun.length; i++) {
    const mode = modesToRun[i];
    const { results } = await runMode(
      mode,
      prompts,
      trialsPerPrompt,
      infraDir,
      codexBin,
      codexVersion,
      liveLog,
      dumpRaw
    );
    allResults[mode] = results;

  }

  // Print per-mode summaries
  for (const mode of modesToRun) {
    printSummary(mode, allResults[mode]!);
  }

  // Print comparison if both modes ran
  if (allResults.raw && allResults.mcp) {
    printComparison(allResults.raw, allResults.mcp);
  }
}

main().catch((err) => {
  console.error(`${C.red}Fatal: ${(err as Error).message}${C.reset}`);
  process.exit(1);
});
