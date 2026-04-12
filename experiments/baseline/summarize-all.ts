#!/usr/bin/env npx tsx
/**
 * Gemini Experiment Summarizer
 *
 * Loads Gemini raw + MCP result files, scores them, computes costs,
 * and generates a combined markdown summary + Chart.js HTML dashboard.
 *
 * Usage:
 *   npx tsx experiments/baseline/summarize-all.ts
 *
 * Output:
 *   results/scored-combined-gemini-<ts>.json
 *   results/summary-combined-gemini-<ts>.md
 *   results/charts/gemini.html
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, join } from "path";
import { scoreAnswer, scoreAndWrite, type CombinedRunResult } from "./scorer.ts";
import { extractCombinedChartData, generateCombinedHTML } from "./visualize.ts";

const SCRIPT_DIR = resolve(
  decodeURIComponent(
    new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")
  )
);
const RESULTS_DIR = join(SCRIPT_DIR, "results");
const CHARTS_DIR = join(RESULTS_DIR, "charts");

// ─── Gemini Pricing ─────────────────────────────────────────────────────────
// gemini-3-flash-preview: $0.15/M input, $0.60/M output

function computeGeminiCost(tokens_in: number, tokens_out: number): number {
  return (tokens_in / 1_000_000) * 0.15 + (tokens_out / 1_000_000) * 0.60;
}

// ─── Source Files ───────────────────────────────────────────────────────────

const GEMINI_RAW_FILE = join(RESULTS_DIR, "gemini-raw-2026-04-12T01-50-50.json");
const GEMINI_MCP_FILE = join(RESULTS_DIR, "gemini-mcp-2026-04-12T02-23-31.json");

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log("Loading Gemini results...");
  const rawData = JSON.parse(readFileSync(GEMINI_RAW_FILE, "utf-8"));
  const mcpData = JSON.parse(readFileSync(GEMINI_MCP_FILE, "utf-8"));

  console.log(`  Raw: ${rawData.results.length} prompts, ${rawData.metadata.trials_per_prompt} trials`);
  console.log(`  MCP: ${mcpData.results.length} prompts, ${mcpData.metadata.trials_per_prompt} trials`);

  // ─── Step 1: Score and enrich raw trials ────────────────────────────────
  console.log("\nScoring raw trials...");
  for (const result of rawData.results) {
    for (const trial of result.trials) {
      // Back-compute cost
      trial.cost_usd = computeGeminiCost(trial.tokens_in ?? 0, trial.tokens_out ?? 0);
      // Score
      const { score, details } = scoreAnswer(
        trial.answer,
        result.scoring.type,
        result.scoring.ground_truth
      );
      trial.score = score;
      trial.score_details = details;
    }
  }

  // ─── Step 2: Score and filter MCP trials (Trial 1 only) ────────────────
  console.log("Scoring MCP trials (Trial 1 only — Trial 2 has config bug)...");
  for (const result of mcpData.results) {
    // Keep only Trial 1 (Trial 2 lost MCP tools due to .gemini/ cleanup bug)
    result.trials = result.trials.filter((t: any) => t.trial === 1);
    for (const trial of result.trials) {
      // Back-compute cost
      trial.cost_usd = computeGeminiCost(trial.tokens_in ?? 0, trial.tokens_out ?? 0);
      // Score
      const { score, details } = scoreAnswer(
        trial.answer,
        result.scoring.type,
        result.scoring.ground_truth
      );
      trial.score = score;
      trial.score_details = details;
    }
  }

  // ─── Step 3: Build CombinedRunResult ────────────────────────────────────
  console.log("\nBuilding combined result...");
  const combined: CombinedRunResult = {
    metadata: {
      modes: ["raw", "mcp"],
      model: "gemini-3-flash-preview",
      timestamp: new Date().toISOString(),
      infra_path: rawData.metadata.infra_path,
      trials_per_prompt: 2, // raw has 2, MCP has 1 (filtered)
      total_prompts: 30,
      claude_cli_version: `Gemini CLI ${rawData.metadata.gemini_cli_version ?? "0.37.1"}`,
      raw_start: rawData.metadata.timestamp,
      raw_end: rawData.metadata.timestamp,
      mcp_start: mcpData.metadata.timestamp,
      mcp_end: mcpData.metadata.timestamp,
    },
    results: rawData.results.map((rawResult: any) => {
      const mcpResult = mcpData.results.find((m: any) => m.id === rawResult.id);
      return {
        id: rawResult.id,
        prompt: rawResult.prompt,
        difficulty: rawResult.difficulty,
        category: rawResult.category,
        scoring: rawResult.scoring,
        raw_trials: rawResult.trials,
        mcp_trials: mcpResult?.trials ?? [],
      };
    }),
  };

  // ─── Step 4: Score and write combined ───────────────────────────────────
  console.log("Writing scored combined result + markdown summary...");
  const { scoredPath, summaryPath } = scoreAndWrite(combined, RESULTS_DIR);
  console.log(`  Scored: ${scoredPath}`);
  console.log(`  Summary: ${summaryPath}`);

  // ─── Step 5: Generate chart dashboard ───────────────────────────────────
  console.log("\nGenerating chart dashboard...");
  mkdirSync(CHARTS_DIR, { recursive: true });

  const scoredCombined = JSON.parse(readFileSync(scoredPath, "utf-8"));
  const chartData = extractCombinedChartData(scoredCombined);
  const html = generateCombinedHTML(scoredCombined, chartData);

  const htmlPath = join(CHARTS_DIR, "gemini.html");
  writeFileSync(htmlPath, html);
  console.log(`  Dashboard: ${htmlPath}`);

  // ─── Print summary stats ───────────────────────────────────────────────
  const rawTrials = combined.results.flatMap((r) => r.raw_trials as any[]);
  const mcpTrials = combined.results.flatMap((r) => r.mcp_trials as any[]);

  const rawMeanScore = rawTrials.reduce((s, t) => s + (t.score ?? 0), 0) / rawTrials.length;
  const mcpMeanScore = mcpTrials.reduce((s, t) => s + (t.score ?? 0), 0) / mcpTrials.length;
  const rawTotalTokens = rawTrials.reduce((s, t) => s + (t.tokens_in ?? 0) + (t.tokens_out ?? 0), 0);
  const mcpTotalTokens = mcpTrials.reduce((s, t) => s + (t.tokens_in ?? 0) + (t.tokens_out ?? 0), 0);
  const rawTotalCost = rawTrials.reduce((s, t) => s + (t.cost_usd ?? 0), 0);
  const mcpTotalCost = mcpTrials.reduce((s, t) => s + (t.cost_usd ?? 0), 0);

  console.log("\n=== Gemini Results Overview ===");
  console.log(`  Raw: score=${rawMeanScore.toFixed(2)}, tokens=${rawTotalTokens.toLocaleString()}, cost=$${rawTotalCost.toFixed(4)}, trials=${rawTrials.length}`);
  console.log(`  MCP: score=${mcpMeanScore.toFixed(2)}, tokens=${mcpTotalTokens.toLocaleString()}, cost=$${mcpTotalCost.toFixed(4)}, trials=${mcpTrials.length}`);
  console.log(`  Token delta: ${((mcpTotalTokens / rawTrials.length - rawTotalTokens / rawTrials.length) / (rawTotalTokens / rawTrials.length) * 100).toFixed(0)}% (MCP vs Raw per-trial avg)`);
  console.log(`\nDone! Open ${htmlPath} in a browser to view charts.`);
}

main();
