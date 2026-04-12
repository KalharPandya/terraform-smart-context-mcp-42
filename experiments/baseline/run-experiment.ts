#!/usr/bin/env npx tsx
/**
 * Parallel Codex Experiment Launcher
 *
 * Runs raw and mcp modes simultaneously as two child processes.
 * Each mode gets its own log file. The terminal shows a live status
 * line for both processes until both complete.
 *
 * Usage:
 *   npx tsx experiments/baseline/run-experiment.ts
 *   npx tsx experiments/baseline/run-experiment.ts --trials 1
 *   npx tsx experiments/baseline/run-experiment.ts --prompt 5
 *
 * Output:
 *   experiments/baseline/results/codex-raw-<ts>.json
 *   experiments/baseline/results/codex-mcp-<ts>.json
 *   experiments/baseline/logs/raw-<ts>.log
 *   experiments/baseline/logs/mcp-<ts>.log
 */

import { spawn } from "child_process";
import { createWriteStream, mkdirSync, existsSync } from "fs";
import { resolve, join } from "path";

// ─── Paths ───────────────────────────────────────────────────────────────────

const SCRIPT_DIR = resolve(
  decodeURIComponent(
    new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")
  )
);
const RUNNER = join(SCRIPT_DIR, "runner-codex.ts");
const LOGS_DIR = join(SCRIPT_DIR, "logs");

mkdirSync(LOGS_DIR, { recursive: true });

// ─── Colors ──────────────────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

// ─── State ───────────────────────────────────────────────────────────────────

interface ModeState {
  mode: "raw" | "mcp";
  color: string;
  label: string;
  logPath: string;
  lastLine: string;
  promptsDone: number;
  totalPrompts: number;
  trialsDone: number;
  tokens: number;
  exitCode: number | null;
  startMs: number;
}

// ─── Status Renderer ─────────────────────────────────────────────────────────

function renderStatus(states: ModeState[]): void {
  // Move cursor up N lines to overwrite previous status block
  // We print 2 lines per mode + 1 separator = 2*N+1 lines
  process.stdout.write(`\n`);
  for (const s of states) {
    const elapsed = ((Date.now() - s.startMs) / 1000).toFixed(0);
    const status =
      s.exitCode === null
        ? `${C.cyan}running${C.reset}`
        : s.exitCode === 0
        ? `${C.green}done${C.reset}`
        : `${C.red}failed (exit ${s.exitCode})${C.reset}`;

    const progress =
      s.totalPrompts > 0
        ? `prompt ${s.promptsDone}/${s.totalPrompts}`
        : "starting...";

    const tokenStr =
      s.tokens > 0 ? ` | ${C.gray}${s.tokens.toLocaleString()} tokens${C.reset}` : "";

    console.log(
      `  ${s.color}[${s.label.toUpperCase()}]${C.reset} ${status}  ${C.gray}${progress}${C.reset}  ${elapsed}s${tokenStr}`
    );

    if (s.lastLine) {
      const trimmed = s.lastLine.slice(0, 90);
      console.log(`         ${C.gray}${trimmed}${C.reset}`);
    } else {
      console.log(`         ${C.gray}(waiting...)${C.reset}`);
    }
  }
}

// ─── Log Line Classifier ──────────────────────────────────────────────────────

function classifyLine(line: string, state: ModeState): void {
  // Extract prompt progress: "[5]" pattern
  const promptMatch = line.match(/^\[(\d+)\]\s/);
  if (promptMatch) {
    state.promptsDone = parseInt(promptMatch[1], 10) - 1;
  }

  // Extract total prompts from header: "30 prompts × 2 trials"
  const totalMatch = line.match(/(\d+) prompts/);
  if (totalMatch && state.totalPrompts === 0) {
    state.totalPrompts = parseInt(totalMatch[1], 10);
  }

  // Extract tokens from trial result line: "5 tools, 44,896 tokens"
  const tokenMatch = line.match(/([\d,]+)\s+tokens/);
  if (tokenMatch) {
    const t = parseInt(tokenMatch[1].replace(/,/g, ""), 10);
    if (!isNaN(t)) state.tokens += t;
  }

  // Completed prompt increments
  if (line.includes("Trial 2/2") || line.match(/Trial \d+\/\d+/)) {
    // last trial of a prompt
  }

  // Use non-empty lines as the "last line" display
  const stripped = line.replace(/\x1b\[[0-9;]*m/g, "").trim();
  if (stripped && !stripped.startsWith("===") && !stripped.startsWith("---")) {
    state.lastLine = stripped;
  }
}

// ─── Spawn One Mode ───────────────────────────────────────────────────────────

function spawnMode(
  state: ModeState,
  extraArgs: string[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    const logStream = createWriteStream(state.logPath, { flags: "a" });

    const header = [
      `${"=".repeat(60)}`,
      `Codex Experiment — mode: ${state.mode}`,
      `Started: ${new Date().toISOString()}`,
      `Log: ${state.logPath}`,
      `${"=".repeat(60)}`,
      "",
    ].join("\n");
    logStream.write(header);

    const args = [
      "tsx",
      RUNNER,
      "--mode",
      state.mode,
      ...extraArgs,
    ];

    const proc = spawn("npx", args, {
      cwd: SCRIPT_DIR,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    let lineBuffer = "";

    const onData = (data: Buffer) => {
      const chunk = data.toString();
      logStream.write(chunk);

      lineBuffer += chunk;
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() ?? "";
      for (const line of lines) {
        classifyLine(line, state);
      }
    };

    proc.stdout.on("data", onData);
    proc.stderr.on("data", (data: Buffer) => {
      logStream.write(`[stderr] ${data.toString()}`);
    });

    proc.on("error", (err) => {
      logStream.write(`\n[launcher error] ${err.message}\n`);
      logStream.end();
      reject(err);
    });

    proc.on("close", (code) => {
      state.exitCode = code ?? 0;
      if (state.totalPrompts > 0) state.promptsDone = state.totalPrompts;

      logStream.write(
        `\n${"=".repeat(60)}\nFinished: ${new Date().toISOString()}  exit: ${code}\n${"=".repeat(60)}\n`
      );
      logStream.end();

      if (code !== 0) {
        reject(new Error(`${state.mode} runner exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  // Forward --trials and --prompt flags to the child runners
  const forwardArgs: string[] = [];
  const getArg = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };
  if (getArg("--trials")) forwardArgs.push("--trials", getArg("--trials")!);
  if (getArg("--prompt")) forwardArgs.push("--prompt", getArg("--prompt")!);

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  const states: ModeState[] = [
    {
      mode: "raw",
      color: C.blue,
      label: "raw",
      logPath: join(LOGS_DIR, `raw-${ts}.log`),
      lastLine: "",
      promptsDone: 0,
      totalPrompts: 0,
      trialsDone: 0,
      tokens: 0,
      exitCode: null,
      startMs: Date.now(),
    },
    {
      mode: "mcp",
      color: C.magenta,
      label: "mcp",
      logPath: join(LOGS_DIR, `mcp-${ts}.log`),
      lastLine: "",
      promptsDone: 0,
      totalPrompts: 0,
      trialsDone: 0,
      tokens: 0,
      exitCode: null,
      startMs: Date.now(),
    },
  ];

  console.log(`\n${C.bold}=== Codex Parallel Experiment ===${C.reset}`);
  console.log(`Modes:   raw + mcp (running in parallel)`);
  console.log(`Logs:    ${LOGS_DIR}`);
  console.log(`Forward: ${forwardArgs.join(" ") || "(none)"}`);
  console.log(`${"=".repeat(36)}\n`);

  for (const s of states) {
    console.log(
      `  ${s.color}[${s.label.toUpperCase()}]${C.reset} log → ${C.gray}${s.logPath}${C.reset}`
    );
  }

  // Status refresh every 5 seconds
  const statusInterval = setInterval(() => {
    renderStatus(states);
  }, 5_000);

  // Launch both in parallel
  const promises = states.map((s) =>
    spawnMode(s, forwardArgs).catch((err) => {
      // Don't let one mode failure kill the other — log and continue
      console.error(
        `\n${C.red}[${s.mode.toUpperCase()}] failed: ${err.message}${C.reset}`
      );
    })
  );

  await Promise.all(promises);

  clearInterval(statusInterval);

  // Final status
  renderStatus(states);

  console.log(`\n${C.bold}=== Complete ===${C.reset}`);
  for (const s of states) {
    const elapsed = ((Date.now() - s.startMs) / 1000).toFixed(0);
    const ok = s.exitCode === 0;
    console.log(
      `  ${s.color}[${s.label.toUpperCase()}]${C.reset}  ${ok ? C.green + "✓" : C.red + "✗"}${C.reset}  ${elapsed}s  ${s.tokens.toLocaleString()} tokens accumulated  log: ${C.gray}${s.logPath}${C.reset}`
    );
  }
  console.log();
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
