#!/usr/bin/env npx tsx
/**
 * Combined Experiment Runner — runs raw + mcp modes sequentially, writes one
 * combined JSON file, then auto-scores and generates comparison summary.
 *
 * Usage:
 *   npx tsx experiments/baseline/run-all.ts                   # all prompts, 3 trials each mode
 *   npx tsx experiments/baseline/run-all.ts --trials 2        # 2 trials each mode
 *   npx tsx experiments/baseline/run-all.ts --prompt 5        # only prompt #5, both modes
 *   npx tsx experiments/baseline/run-all.ts --trials 1 --live # watch tool calls live
 */

import { execSync } from "child_process";
import { writeFileSync, existsSync, unlinkSync, readFileSync, rmSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

import {
  findClaudeBin,
  writeMcpConfig,
  createTempInfraDir,
  cleanupClaude,
  runTrial,
  C,
  PROMPTS_PATH,
  RESULTS_DIR,
  MCP_SERVER_BIN,
  MODEL,
} from "./runner.js";
import type { TrialResult, PromptsFile } from "./runner.js";
import { scoreAndWrite } from "./scorer.js";
import type { CombinedRunResult, CombinedPromptResult } from "./scorer.js";

// ─── runPromptTrials ──────────────────────────────────────────────────────────
// Runs N trials for one prompt in one mode. tempDir is provided by the caller.

async function runPromptTrials(
  mode: "raw" | "mcp",
  prompt: PromptsFile["prompts"][number],
  trialsPerPrompt: number,
  tempDir: string,
  claudeBin: string,
  mcpConfigPath: string | undefined,
  liveLog: boolean,
): Promise<TrialResult[]> {
  const trials: TrialResult[] = [];

  for (let t = 1; t <= trialsPerPrompt; t++) {
    if (liveLog) {
      console.log(`\n  ${C.bold}[${mode.toUpperCase()}] Trial ${t}/${trialsPerPrompt}${C.reset}`);
    } else {
      process.stdout.write(`  [${mode.toUpperCase()}] Trial ${t}/${trialsPerPrompt}... `);
    }

    cleanupClaude(tempDir);

    try {
      const trial = await runTrial(
        prompt.prompt,
        tempDir,
        mode,
        claudeBin,
        mcpConfigPath,
        liveLog,
        false,
        false
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
        const answerPreview = trial.answer.slice(0, 300);
        console.log(`  ${C.green}${answerPreview}${answerPreview.length < trial.answer.length ? "..." : ""}${C.reset}`);
      } else {
        console.log(
          `${C.green}done${C.reset} ${C.gray}(${tokens.toLocaleString()} tokens, ${(trial.wall_time_ms / 1000).toFixed(1)}s, $${trial.cost_usd.toFixed(4)})${C.reset}`
        );
      }
    } catch (err) {
      console.error(`\n  ${C.yellow}[${mode.toUpperCase()}] Trial ${t} failed: ${(err as Error).message}${C.reset}`);
      trials.push({
        trial: t,
        answer: "",
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
  }

  return trials;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const trialsPerPrompt = parseInt(getArg("--trials") ?? "3", 10);
  const promptFilter = getArg("--prompt") ? parseInt(getArg("--prompt")!, 10) : undefined;
  const liveLog = args.includes("--live");

  // SIGINT cleanup registry
  const cleanupFns: Array<() => void> = [];
  let mcpConfigPath: string | undefined;

  process.on("SIGINT", () => {
    console.log("\nInterrupted — cleaning up...");
    for (const fn of cleanupFns) { try { fn(); } catch {} }
    if (mcpConfigPath && existsSync(mcpConfigPath)) {
      try { unlinkSync(mcpConfigPath); } catch {}
    }
    process.exit(130);
  });

  // ── Preflight ──────────────────────────────────────────────────────────────

  if (!existsSync(MCP_SERVER_BIN)) {
    console.error(`MCP server not built. Run 'npm run build' first.`);
    console.error(`Expected: ${MCP_SERVER_BIN}`);
    process.exit(1);
  }

  let claudeBin: string;
  try {
    claudeBin = findClaudeBin();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  let cliVersion = "unknown";
  try {
    cliVersion = execSync("claude --version", { encoding: "utf-8", shell: true }).trim();
  } catch {}

  // ── Load prompts ───────────────────────────────────────────────────────────

  const promptsFile: PromptsFile = JSON.parse(readFileSync(PROMPTS_PATH, "utf-8"));
  let prompts = promptsFile.prompts;
  if (promptFilter !== undefined) {
    prompts = prompts.filter((p) => p.id === promptFilter);
    if (prompts.length === 0) {
      console.error(`No prompt with id ${promptFilter} found.`);
      process.exit(1);
    }
  }

  const infraDir = resolve(
    PROMPTS_PATH.replace(/prompts\.json$/, ""),
    promptsFile.infra_path
  );

  // Verify terraform state
  try {
    execSync("terraform state list", { cwd: infraDir, encoding: "utf-8", timeout: 10_000 });
  } catch {
    console.error(
      "Terraform state not found. Run 'terraform init && terraform apply -auto-approve' in dummy-infra/ first."
    );
    process.exit(1);
  }

  // ── Write MCP config ───────────────────────────────────────────────────────

  mcpConfigPath = writeMcpConfig(false);
  cleanupFns.push(() => {
    if (mcpConfigPath && existsSync(mcpConfigPath)) {
      try { unlinkSync(mcpConfigPath); } catch {}
    }
  });

  // ── Header ─────────────────────────────────────────────────────────────────

  const runTimestamp = new Date().toISOString();
  console.log(`\n${C.bold}=== Combined Experiment Runner ===${C.reset}`);
  console.log(`Model:    ${MODEL}`);
  console.log(`CLI:      ${cliVersion}`);
  console.log(`Prompts:  ${prompts.length} (${trialsPerPrompt} trial${trialsPerPrompt > 1 ? "s" : ""} × 2 modes)`);
  console.log(`Infra:    ${infraDir}`);
  console.log(`Server:   ${MCP_SERVER_BIN}`);
  console.log(`Live log: ${liveLog ? "on" : "off (add --live to watch tool calls)"}`);
  console.log(`===================================\n`);

  // ── Interleaved prompt loop: raw then mcp for each prompt ─────────────────

  const runStart = new Date().toISOString();
  console.log(`${C.bold}${C.cyan}=== Running ${prompts.length} prompts × ${trialsPerPrompt} trials × 2 modes (interleaved) ===${C.reset}\n`);

  const combinedResults: CombinedPromptResult[] = [];

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    console.log(
      `${C.bold}[${prompt.id}/${prompts.length}]${C.reset} "${C.yellow}${prompt.prompt}${C.reset}" ${C.gray}(${prompt.difficulty}, ${prompt.category})${C.reset}`
    );

    const tempDir = createTempInfraDir(infraDir);
    console.log(`  Temp dir: ${tempDir}`);

    const cleanupTempDir = () => {
      try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
    };
    cleanupFns.push(cleanupTempDir);

    let rawTrials: TrialResult[] = [];
    let mcpTrials: TrialResult[] = [];

    try {
      rawTrials = await runPromptTrials("raw", prompt, trialsPerPrompt, tempDir, claudeBin, undefined, liveLog);
      mcpTrials = await runPromptTrials("mcp", prompt, trialsPerPrompt, tempDir, claudeBin, mcpConfigPath, liveLog);
    } finally {
      cleanupTempDir();
      const idx = cleanupFns.indexOf(cleanupTempDir);
      if (idx !== -1) cleanupFns.splice(idx, 1);
    }

    combinedResults.push({
      id: prompt.id,
      prompt: prompt.prompt,
      difficulty: prompt.difficulty,
      category: prompt.category,
      scoring: prompt.scoring as { type: string; ground_truth: any },
      raw_trials: rawTrials as Record<string, unknown>[],
      mcp_trials: mcpTrials as Record<string, unknown>[],
    });

    console.log();
  }

  const runEnd = new Date().toISOString();
  console.log(`${C.green}✓ All prompts complete${C.reset}\n`);

  const combined: CombinedRunResult = {
    metadata: {
      modes: ["raw", "mcp"],
      model: MODEL,
      timestamp: runTimestamp,
      infra_path: infraDir,
      trials_per_prompt: trialsPerPrompt,
      total_prompts: prompts.length,
      claude_cli_version: cliVersion,
      raw_start: runStart,
      raw_end: runEnd,
      mcp_start: runStart,
      mcp_end: runEnd,
    },
    results: combinedResults,
  };

  const fileTimestamp = runTimestamp.replace(/[:.]/g, "-").slice(0, 19);
  const combinedPath = join(RESULTS_DIR, `combined-${fileTimestamp}.json`);
  writeFileSync(combinedPath, JSON.stringify(combined, null, 2));
  console.log(`${C.bold}✓ Combined results:${C.reset} ${combinedPath}\n`);

  // ── Auto-score ────────────────────────────────────────────────────────────

  console.log(`${C.bold}Scoring...${C.reset}`);
  const { scoredPath, summaryPath } = scoreAndWrite(combined, RESULTS_DIR);
  console.log(`${C.green}✓ Scored:${C.reset}  ${scoredPath}`);
  console.log(`${C.green}✓ Summary:${C.reset} ${summaryPath}`);

  // ── Final comparison ──────────────────────────────────────────────────────

  let rawTotalScore = 0, mcpTotalScore = 0, rawCount = 0, mcpCount = 0;
  let rawTotalTokens = 0, mcpTotalTokens = 0;
  let rawTotalCost = 0, mcpTotalCost = 0;

  for (const r of combinedResults) {
    for (const t of r.raw_trials as any[]) {
      rawTotalScore += t.score ?? 0;
      rawTotalTokens += (t.tokens_in ?? 0) + (t.tokens_out ?? 0);
      rawTotalCost += t.cost_usd ?? 0;
      rawCount++;
    }
    for (const t of r.mcp_trials as any[]) {
      mcpTotalScore += t.score ?? 0;
      mcpTotalTokens += (t.tokens_in ?? 0) + (t.tokens_out ?? 0);
      mcpTotalCost += t.cost_usd ?? 0;
      mcpCount++;
    }
  }

  const meanRaw = rawCount > 0 ? rawTotalScore / rawCount : 0;
  const meanMcp = mcpCount > 0 ? mcpTotalScore / mcpCount : 0;
  const tokenDelta = rawTotalTokens > 0
    ? ((mcpTotalTokens - rawTotalTokens) / rawTotalTokens * 100).toFixed(0) : "N/A";

  console.log(`\n${C.bold}=== Final Comparison ===${C.reset}`);
  console.log(`${C.bold}Mode  | Mean Score | Total Tokens   | Total Cost${C.reset}`);
  console.log(`------|------------|----------------|------------`);
  console.log(`RAW   | ${meanRaw.toFixed(2).padStart(10)} | ${rawTotalTokens.toLocaleString().padStart(14)} | $${rawTotalCost.toFixed(4)}`);
  console.log(`MCP   | ${meanMcp.toFixed(2).padStart(10)} | ${mcpTotalTokens.toLocaleString().padStart(14)} | $${mcpTotalCost.toFixed(4)}`);
  console.log(`Delta | ${(meanMcp - meanRaw >= 0 ? "+" : "")}${(meanMcp - meanRaw).toFixed(2).padStart(9)} | ${tokenDelta}% tokens   |`);
  console.log();

  // Cleanup MCP config
  if (mcpConfigPath && existsSync(mcpConfigPath)) {
    try { unlinkSync(mcpConfigPath); } catch {}
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("run-all failed:", err);
    process.exit(1);
  });
}
