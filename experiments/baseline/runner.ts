#!/usr/bin/env npx tsx
/**
 * Baseline Experiment Runner — Claude Code CLI Headless Mode
 *
 * Sends each prompt to Claude via the Claude Code CLI (`claude -p`) and captures
 * granular metrics per prompt trial.
 *
 * Usage:
 *   npx tsx experiments/baseline/runner.ts                             # all prompts, 3 trials, raw
 *   npx tsx experiments/baseline/runner.ts --prompt 6                  # only prompt #6
 *   npx tsx experiments/baseline/runner.ts --trials 1                  # 1 trial per prompt
 *   npx tsx experiments/baseline/runner.ts --mode raw                  # raw CLI (default)
 *   npx tsx experiments/baseline/runner.ts --mode mcp                  # MCP tools mode
 *   npx tsx experiments/baseline/runner.ts --mode mcp --prompt 6 --trials 1 --live
 *   npx tsx experiments/baseline/runner.ts --mode mcp --unified --prompt 1 --trials 1 --live
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
    claude_cli_version: string;
  };
  results: PromptResult[];
}

// ─── Config ──────────────────────────────────────────────────────────────────

const MODEL = "sonnet";
const MAX_BUDGET_USD = 2.0;

const SCRIPT_DIR = resolve(
  decodeURIComponent(
    new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")
  )
);
const REPO_ROOT = resolve(SCRIPT_DIR, "../..");
const PROMPTS_PATH = join(SCRIPT_DIR, "prompts.json");
const RESULTS_DIR = join(SCRIPT_DIR, "results");
const MCP_SERVER_BIN = join(REPO_ROOT, "dist", "index.js");

// ─── Claude Binary Detection ─────────────────────────────────────────────────

function findClaudeBin(): string {
  // On Windows, NVM and other package managers create .cmd shims that Node's
  // spawn can't execute directly. Return just "claude" and rely on shell: true.
  if (process.platform === "win32") {
    return "claude";
  }

  // Unix: find the actual binary path
  try {
    const found = execSync("which claude", { encoding: "utf-8" }).trim();
    if (found && existsSync(found)) return found;
  } catch {
    // fall through
  }

  const mac =
    "/Users/parinshah/Library/Application Support/Claude/claude-code/2.1.85/claude.app/Contents/MacOS/claude";
  if (existsSync(mac)) return mac;

  throw new Error(
    "Claude CLI not found. Make sure `claude` is in your PATH or install Claude Code."
  );
}

// ─── System Prompts ──────────────────────────────────────────────────────────

const RAW_SYSTEM_PROMPT = `You are an infrastructure assistant. There is a Terraform project in the current directory that is already initialized and applied (state exists with 75+ resources across 6 modules).

You have access to Bash to run:
- terraform commands (state list, show -json, state show <address>, graph, output -json, etc.)
- cat/head/tail to read .tf files
- find/ls to list files

Rules:
- Use ONLY terraform CLI commands and file reading to answer
- Do not guess — verify with commands
- Synthesize your answer clearly — do not dump raw command output`;

function buildMcpSystemPrompt(infraPath: string, useUnified: boolean): string {
  // Normalize to forward slashes so Claude doesn't misread on Windows
  const dir = infraPath.replace(/\\/g, "/");

  if (useUnified) {
    return `You are an infrastructure assistant. The Terraform project is at: ${dir}

The project is already initialized and applied. There are 75 resources across 6 modules in the state.

You have one MCP tool: terraform. Use the "type" parameter to pick the operation.
Always pass workingDir: "${dir}" in every call.

Start with type: "schema" to discover GraphQL queries, then use type: "query" for dependency/relationship questions.

Rules:
- Use ONLY the terraform MCP tool. Do NOT use Bash or read files directly.
- Do not guess — verify with tools.
- Synthesize your answer clearly — do not dump raw tool output.`;
  }

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
- Use ONLY MCP tools. Do NOT use Bash or read files directly.
- Always pass workingDir: "${dir}" in every call.
- Start with get_schema to discover available prebuilt queries.
- Prefer query_graph for dependency and relationship questions.
- Do not guess — verify with tools.
- Synthesize your answer clearly — do not dump raw tool output.`;
}

// ─── MCP Tool List ───────────────────────────────────────────────────────────

// These are the tool names as registered by the MCP server named "terraform".
const MCP_ALLOWED_TOOLS = [
  "mcp__terraform__get_schema",
  "mcp__terraform__query_graph",
  "mcp__terraform__terraform_state_list",
  "mcp__terraform__terraform_state_show",
  "mcp__terraform__terraform_graph",
  "mcp__terraform__terraform_show",
  "mcp__terraform__terraform_validate",
  "mcp__terraform__terraform_plan",
  "mcp__terraform__terraform_output",
  "mcp__terraform__terraform_providers",
  "mcp__terraform__terraform_fmt",
  "mcp__terraform__terraform_init",
];

// Unified mode: single tool replaces all 12
const MCP_UNIFIED_ALLOWED_TOOLS = ["mcp__terraform__terraform"];

// ─── MCP Config File ─────────────────────────────────────────────────────────

function writeMcpConfig(useUnified: boolean): string {
  const serverEntry: Record<string, unknown> = {
    command: "node",
    args: [MCP_SERVER_BIN.replace(/\\/g, "/")],
  };
  if (useUnified) {
    serverEntry.env = { TERRAFORM_MCP_UNIFIED: "1" };
  }
  const config = {
    mcpServers: {
      terraform: serverEntry,
    },
  };
  const configPath = join(tmpdir(), `mcp-config-${randomUUID()}.json`);
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

// ─── Temp Directory Management ───────────────────────────────────────────────

function createTempInfraDir(infraDir: string): string {
  const tempDir = join(tmpdir(), `exp-${randomUUID()}`);
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
  // Bash tools: { stdout, stderr }
  // MCP tools: [{ type: "text", text: "..." }]
  tool_use_result?:
    | { stdout?: string; stderr?: string }
    | Array<{ type: string; text?: string }>;
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

/** Extract text from a tool_use_result regardless of format (Bash vs MCP) */
function extractToolOutput(result: StreamEvent["tool_use_result"]): string {
  if (!result) return "";
  // MCP tools: top-level array [{type:"text", text:"..."}]
  if (Array.isArray(result)) {
    return result
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text!)
      .join("\n");
  }
  // Bash tools: {stdout, stderr}
  const stdout = (result as any).stdout ?? "";
  const stderr = (result as any).stderr ?? "";
  return [stdout, stderr].filter(Boolean).join("\n");
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

  const pendingToolUses: Map<
    string,
    { name: string; input: Record<string, unknown> }
  > = new Map();

  let lastTurnTokensIn = 0;
  let lastTurnTokensOut = 0;

  for (const line of lines) {
    let event: StreamEvent;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }

    if (event.type === "assistant" && event.message?.content) {
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

    if (event.type === "user" && event.tool_use_result) {
      const fullOutput = extractToolOutput(event.tool_use_result);

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

    if (event.type === "result") {
      result = event.result ?? "";
      cost_usd = event.total_cost_usd ?? 0;
      duration_ms = event.duration_ms ?? 0;
      num_turns = event.num_turns ?? 0;
      stop_reason = event.stop_reason ?? "unknown";

      if (event.modelUsage) {
        const modelStats = Object.values(event.modelUsage)[0];
        if (modelStats) {
          tokens_in =
            modelStats.inputTokens +
            (modelStats.cacheReadInputTokens ?? 0) +
            (modelStats.cacheCreationInputTokens ?? 0);
          tokens_out = modelStats.outputTokens;
        }
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

// ─── Live Event Printer ───────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  gray: "\x1b[90m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function printLiveEvent(evt: StreamEvent, mode: Mode): void {
  if (evt.type === "assistant" && evt.message?.content) {
    for (const block of evt.message.content) {
      if (block.type === "tool_use" && block.name) {
        let inputSummary = "";
        if (mode === "mcp") {
          const q = (block.input as any)?.query;
          const module_ = (block.input as any)?.module;
          const resource = (block.input as any)?.resource;
          const address = (block.input as any)?.address;
          if (q) inputSummary = `query: "${String(q).slice(0, 70).replace(/\n/g, " ")}"`;
          else if (address) inputSummary = `address: ${address}`;
          else if (module_) inputSummary = `module: ${module_}`;
          else if (resource) inputSummary = `resource: ${resource}`;
        } else {
          inputSummary = String((block.input as any)?.command ?? "").slice(0, 90).replace(/\n/g, " ");
        }
        // Shorten mcp__ prefix for display
        const displayName = block.name.startsWith("mcp__terraform__")
          ? block.name.replace("mcp__terraform__", "")
          : block.name;
        process.stdout.write(
          `    ${C.blue}→ [${displayName}]${C.reset} ${C.gray}${inputSummary}${C.reset}\n`
        );
      } else if (block.type === "text" && block.text?.trim()) {
        const firstLine = block.text.trim().split("\n")[0].slice(0, 100);
        process.stdout.write(`    ${C.gray}💬 ${firstLine}${C.reset}\n`);
      }
    }
  }

  if (evt.type === "user" && evt.tool_use_result) {
    const out = extractToolOutput(evt.tool_use_result);
    const preview = out.slice(0, 80).replace(/\n/g, " ");
    process.stdout.write(
      `    ${C.green}← ${out.length.toLocaleString()} chars${C.reset} ${C.gray}${preview ? `"${preview}..."` : ""}${C.reset}\n`
    );
  }
}

// ─── Derived Metrics ─────────────────────────────────────────────────────────

function extractFilesAccessed(toolCalls: ToolCallRecord[]): string[] {
  const files = new Set<string>();
  for (const tc of toolCalls) {
    const cmd = String(tc.input.command ?? "");
    const fileMatch = cmd.match(
      /(?:cat|head|tail|less|more)\s+(?:-[^\s]+\s+)*([^\s|>]+)/
    );
    if (fileMatch) files.add(fileMatch[1]);
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
  return toolCalls
    .map((tc) => tc.name)
    .filter((n) => n.startsWith("mcp__"));
}

// ─── Trial Execution ─────────────────────────────────────────────────────────

function runTrial(
  prompt: string,
  cwd: string,
  mode: Mode,
  claudeBin: string,
  mcpConfigPath: string | undefined,
  liveLog: boolean,
  dumpRaw: boolean = false,
  useUnified: boolean = false
): Promise<TrialResult> {
  return new Promise((resolvePromise, reject) => {
    const systemPrompt =
      mode === "mcp" ? buildMcpSystemPrompt(cwd, useUnified) : RAW_SYSTEM_PROMPT;
    const fullPrompt = `${systemPrompt}\n\n---\n\nTask: ${prompt}`;

    // On Windows with shell: true, long/complex args get mangled by cmd.exe.
    // Instead, pass a short -p trigger and pipe the full prompt via stdin.
    // Claude CLI reads stdin as context when piped data is available.
    const useStdin = process.platform === "win32";

    const args: string[] = [
      "-p",
      useStdin
        ? "Follow the instructions and complete the task provided via stdin."
        : fullPrompt,
      "--output-format",
      "stream-json",
      "--verbose",
      "--model",
      MODEL,
      "--max-budget-usd",
      String(MAX_BUDGET_USD),
      "--dangerously-skip-permissions",
      "--disable-slash-commands",
      "--no-session-persistence",
    ];

    if (mode === "raw") {
      args.push("--tools", "Bash", "--allowedTools", "Bash");
    } else {
      // MCP mode: load the server, only load + allow MCP tools (no built-in tools)
      args.push("--mcp-config", mcpConfigPath!);
      const allowedTools = useUnified ? MCP_UNIFIED_ALLOWED_TOOLS : MCP_ALLOWED_TOOLS;
      args.push("--tools", allowedTools.join(","));
      args.push("--allowedTools", allowedTools.join(","));
    }

    let rawOutput = "";
    let stderrOutput = "";
    let lineBuffer = "";

    const proc = spawn(claudeBin, args, {
      cwd,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
      // On Windows, shell: true lets cmd.exe resolve .cmd shims (e.g. from NVM)
      shell: process.platform === "win32",
    });

    // On Windows, pipe the full prompt via stdin to avoid shell escaping issues
    if (useStdin) {
      proc.stdin.write(fullPrompt);
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }

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
            const evt = JSON.parse(line) as StreamEvent;
            printLiveEvent(evt, mode);
            // Debug: dump raw tool result events to understand MCP format
            if (dumpRaw && evt.type === "user") {
              const debugLine = JSON.stringify(evt).slice(0, 500);
              process.stdout.write(`    ${C.yellow}[RAW] ${debugLine}${C.reset}\n`);
            }
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

      // Debug: dump raw output when result looks empty
      const parsed = parseStreamOutput(rawOutput);
      if (!parsed.result && parsed.toolCalls.length === 0) {
        const debugPath = join(RESULTS_DIR, `debug-${Date.now()}.txt`);
        const debugContent = [
          `=== EXIT CODE: ${code} ===`,
          `=== STDOUT (${rawOutput.length} chars) ===`,
          rawOutput.slice(0, 5000),
          `=== STDERR (${stderrOutput.length} chars) ===`,
          stderrOutput.slice(0, 3000),
        ].join("\n");
        writeFileSync(debugPath, debugContent);
        console.log(`    ⚠ Empty result — debug dump: ${debugPath}`);
      }
      const filesAccessed = extractFilesAccessed(parsed.toolCalls);
      const terraformCommands = extractTerraformCommands(parsed.toolCalls);
      const mcpToolsUsed = extractMcpTools(parsed.toolCalls);
      const totalToolOutputChars = parsed.toolCalls.reduce(
        (sum, tc) => sum + tc.output_chars,
        0
      );

      resolvePromise({
        trial: 0,
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

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const mode = (getArg("--mode") ?? "raw") as Mode;
  const trialsPerPrompt = parseInt(getArg("--trials") ?? "3", 10);
  const promptFilter = getArg("--prompt")
    ? parseInt(getArg("--prompt")!, 10)
    : undefined;
  const liveLog = args.includes("--live");
  const dumpRaw = args.includes("--dump-raw");
  const unified = args.includes("--unified");

  if (mode !== "raw" && mode !== "mcp") {
    console.error(`Unknown mode: ${mode}. Use --mode raw or --mode mcp`);
    process.exit(1);
  }

  if (unified && mode !== "mcp") {
    console.error(`--unified only works with --mode mcp`);
    process.exit(1);
  }

  if (mode === "mcp" && !existsSync(MCP_SERVER_BIN)) {
    console.error(`MCP server not built. Run 'npm run build' first.`);
    console.error(`Expected: ${MCP_SERVER_BIN}`);
    process.exit(1);
  }

  // Detect Claude binary
  let claudeBin: string;
  try {
    claudeBin = findClaudeBin();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  // Get CLI version
  let cliVersion = "unknown";
  try {
    cliVersion = execSync(`claude --version`, {
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

  // Write MCP config if needed
  let mcpConfigPath: string | undefined;
  if (mode === "mcp") {
    mcpConfigPath = writeMcpConfig(unified);
  }

  console.log(`\n${C.bold}=== Baseline Experiment Runner ===${C.reset}`);
  console.log(`Mode:     ${C.cyan}${mode}${unified ? " (unified)" : ""}${C.reset}`);
  console.log(`Model:    ${MODEL}`);
  console.log(`CLI:      ${cliVersion}`);
  console.log(`Prompts:  ${prompts.length} (${trialsPerPrompt} trial${trialsPerPrompt > 1 ? "s" : ""} each)`);
  console.log(`Infra:    ${infraDir}`);
  if (mode === "mcp") {
    console.log(`Server:   ${MCP_SERVER_BIN}`);
    console.log(`MCP cfg:  ${mcpConfigPath}`);
  }
  console.log(`Live log: ${liveLog ? "on" : "off (add --live to watch tool calls)"}`);
  console.log(`===================================\n`);

  const results: PromptResult[] = [];

  try {
    for (const prompt of prompts) {
      console.log(
        `${C.bold}[${prompt.id}]${C.reset} "${C.yellow}${prompt.prompt}${C.reset}" ${C.gray}(${prompt.difficulty}, ${prompt.category})${C.reset}`
      );

      const tempDir = createTempInfraDir(infraDir);
      console.log(`  Temp dir: ${tempDir}`);

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
              mode,
              claudeBin,
              mcpConfigPath,
              liveLog,
              dumpRaw,
              unified
            );
            trial.trial = t;
            trials.push(trial);

            const tokens = trial.tokens_in + trial.tokens_out;
            const toolDetail =
              mode === "mcp"
                ? trial.mcp_tools_used.map((n) => n.replace("mcp__terraform__", "")).join(", ")
                : trial.terraform_commands.slice(0, 5).join(", ");

            if (liveLog) {
              console.log(
                `\n  ${C.bold}Result:${C.reset} ${C.gray}${trial.tool_calls} tools, ${tokens.toLocaleString()} tokens, ${(trial.wall_time_ms / 1000).toFixed(1)}s, $${trial.cost_usd.toFixed(4)}${C.reset}`
              );
              if (toolDetail) console.log(`  Tools: ${C.gray}${toolDetail}${C.reset}`);
              console.log(`\n  ${C.bold}Answer:${C.reset}`);
              // Print first 600 chars of answer
              const answerPreview = trial.answer.slice(0, 600);
              for (const line of answerPreview.split("\n")) {
                console.log(`    ${line}`);
              }
              if (trial.answer.length > 600) console.log(`    ${C.gray}... (${trial.answer.length} chars total)${C.reset}`);
            } else {
              console.log(
                `${trial.tool_calls} tools, ${tokens.toLocaleString()} tokens, ${(trial.wall_time_ms / 1000).toFixed(1)}s, $${trial.cost_usd.toFixed(4)}, stop: ${trial.stop_reason}`
              );
              if (mode === "raw") {
                console.log(`    Files: [${trial.files_accessed.join(", ")}]`);
                console.log(`    TF:    [${trial.terraform_commands.slice(0, 5).join(", ")}${trial.terraform_commands.length > 5 ? "..." : ""}]`);
              } else {
                console.log(`    MCP:   [${toolDetail}]`);
              }
            }
          } catch (err) {
            console.error(`\n  ERROR in trial ${t}: ${(err as Error).message}`);
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

          cleanupClaude(tempDir);

          if (t < trialsPerPrompt) {
            await new Promise((r) => setTimeout(r, 5_000));
          }
        }
      } finally {
        try {
          rmSync(tempDir, { recursive: true, force: true });
          if (!liveLog) console.log(`  Cleaned temp dir.`);
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

      if (prompt !== prompts[prompts.length - 1]) {
        console.log(`  (waiting 5s...)\n`);
        await new Promise((r) => setTimeout(r, 5_000));
      }
    }
  } finally {
    if (mcpConfigPath && existsSync(mcpConfigPath)) {
      try { unlinkSync(mcpConfigPath); } catch { /* ignore */ }
    }
  }

  // ─── Write output ──────────────────────────────────────────────────────────

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

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const modeTag = unified ? "mcp-unified" : mode;
  const outPath = join(RESULTS_DIR, `baseline-${modeTag}-${timestamp}.json`);
  writeFileSync(outPath, JSON.stringify(runResult, null, 2));
  console.log(`\nResults: ${outPath}`);

  // ─── Summary table ─────────────────────────────────────────────────────────

  console.log(`\n${C.bold}=== Summary ===${C.reset}`);
  console.log(
    `| # | Prompt                             | Diff   | Avg Tokens | Tools | Time(s) | Cost    |`
  );
  console.log(
    `|---|------------------------------------|----- --|------------|-------|---------|---------|`
  );

  let totalTokens = 0, totalTools = 0, totalTime = 0, totalCost = 0;

  for (const r of results) {
    const avgTokens = Math.round(
      r.trials.reduce((s, t) => s + t.tokens_in + t.tokens_out, 0) / r.trials.length
    );
    const avgTools = Math.round(
      r.trials.reduce((s, t) => s + t.tool_calls, 0) / r.trials.length
    );
    const avgTime = (
      r.trials.reduce((s, t) => s + t.wall_time_ms, 0) / r.trials.length / 1000
    ).toFixed(1);
    const avgCost = (
      r.trials.reduce((s, t) => s + t.cost_usd, 0) / r.trials.length
    ).toFixed(4);

    totalTokens += r.trials.reduce((s, t) => s + t.tokens_in + t.tokens_out, 0);
    totalTools  += r.trials.reduce((s, t) => s + t.tool_calls, 0);
    totalTime   += r.trials.reduce((s, t) => s + t.wall_time_ms, 0);
    totalCost   += r.trials.reduce((s, t) => s + t.cost_usd, 0);

    const shortP = r.prompt.length > 34 ? r.prompt.slice(0, 31) + "..." : r.prompt;
    console.log(
      `| ${String(r.id).padStart(1)} | ${shortP.padEnd(34)} | ${r.difficulty.padEnd(6)} | ${String(avgTokens).padStart(10)} | ${String(avgTools).padStart(5)} | ${avgTime.padStart(7)} | $${avgCost} |`
    );
  }

  console.log(
    `| - | ${"TOTAL".padEnd(34)} | ${"".padEnd(6)} | ${String(totalTokens).padStart(10)} | ${String(totalTools).padStart(5)} | ${(totalTime / 1000).toFixed(1).padStart(7)} | $${totalCost.toFixed(4)} |`
  );
  console.log();
}

main().catch((err) => {
  console.error("Runner failed:", err);
  process.exit(1);
});
