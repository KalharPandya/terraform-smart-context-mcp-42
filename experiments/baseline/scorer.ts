#!/usr/bin/env npx tsx
/**
 * Baseline Experiment Scorer
 *
 * Evaluates experiment results against ground truth from prompts.json.
 * Supports 4 scoring types: substring-match, set-overlap, topological-validation, checklist.
 *
 * Usage:
 *   npx tsx experiments/baseline/scorer.ts <results-json-path>
 *
 * Output:
 *   results/scored-<timestamp>.json  — input results with score added per trial
 *   results/summary-<timestamp>.md   — markdown summary tables
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, join } from "path";
import { fileURLToPath } from "url";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GroundTruth {
  // substring-match
  substrings?: string[];
  // set-overlap
  expected?: string[];
  order_matters?: boolean;
  // topological-validation
  required_nodes?: string[];
  must_precede?: [string, string][];
  // checklist
  items?: string[];
  min_for_full?: number;
  min_for_partial?: number;
}

interface ScoredTrial {
  trial: number;
  answer: string;
  score: number;
  score_details: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  tool_calls: number;
  tool_call_details: unknown[];
  wall_time_ms: number;
  num_turns: number;
  stop_reason: string;
  files_accessed: string[];
  terraform_commands: string[];
  total_tool_output_chars: number;
}

export interface CombinedPromptResult {
  id: number;
  prompt: string;
  difficulty: string;
  category: string;
  scoring: { type: string; ground_truth: GroundTruth };
  raw_trials: Record<string, unknown>[];
  mcp_trials: Record<string, unknown>[];
}

export interface CombinedRunResult {
  metadata: {
    modes: string[];
    model: string;
    timestamp: string;
    infra_path: string;
    trials_per_prompt: number;
    total_prompts: number;
    claude_cli_version: string;
    raw_start: string;
    raw_end: string;
    mcp_start: string;
    mcp_end: string;
  };
  results: CombinedPromptResult[];
}

// ─── Normalization ───────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fuzzyContains(haystack: string, needle: string): boolean {
  const normHay = normalize(haystack);
  const normNeedle = normalize(needle);

  // Direct substring match
  if (normHay.includes(normNeedle)) return true;

  // Also try without spaces (e.g., "publicsubnet1" matches "public subnet 1")
  const compactHay = normHay.replace(/\s+/g, "");
  const compactNeedle = normNeedle.replace(/\s+/g, "");
  if (compactHay.includes(compactNeedle)) return true;

  // Multi-part matching: split needle on common separators and check all parts present
  // e.g., "sg_alb: port 443 (HTTPS)" → check "sg_alb", "port 443", "HTTPS" all present
  const parts = normNeedle.split(/[:()|,]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1 && parts.every((part) => normHay.includes(part))) return true;

  // Handle "X in Y" format with alternate Y representations
  // e.g., "public_subnet_1 in us-east-1a" should match "public_subnet_1" with "use1-az1"
  const inMatch = normNeedle.match(/^(.+?)\s+in\s+(.+)$/);
  if (inMatch) {
    const [, namePart, locationPart] = inMatch;
    const nameFound = normHay.includes(namePart) || compactHay.includes(namePart.replace(/\s+/g, ""));
    if (nameFound) {
      // Check location directly
      if (normHay.includes(locationPart)) return true;
      // Map AZ long names to short codes: us-east-1a → use1-az1
      const azMap: Record<string, string[]> = {
        "us east 1a": ["use1 az1", "use1az1"],
        "us east 1b": ["use1 az2", "use1az2"],
        "us east 1c": ["use1 az3", "use1az3"],
        "us west 2a": ["usw2 az1", "usw2az1"],
        "us west 2b": ["usw2 az2", "usw2az2"],
        "us west 2c": ["usw2 az3", "usw2az3"],
      };
      const normLoc = locationPart.replace(/[_\-]/g, " ");
      const alternates = azMap[normLoc] ?? [];
      if (alternates.some((alt) => normHay.includes(alt) || compactHay.includes(alt.replace(/\s+/g, "")))) {
        return true;
      }
    }
  }

  // Handle "label: number" format — match with separator variants
  // e.g., "networking: 15" should match "networking | 15" or "networking: 15" or "networking 15"
  const colonMatch = normNeedle.match(/^(.+?):\s*(\d+.*)$/);
  if (colonMatch) {
    const [, label, value] = colonMatch;
    // Check if both label and value appear near each other (within a line)
    const lines = normHay.split("\n");
    for (const line of lines) {
      if (line.includes(label.trim()) && line.includes(value.trim())) return true;
    }
  }

  // Handle "N total" format — also match "N resources", "total: N", "total N"
  const totalMatch = normNeedle.match(/^(\d+)\s+total$/);
  if (totalMatch) {
    const num = totalMatch[1];
    if (
      normHay.includes(`${num} total`) ||
      normHay.includes(`total: ${num}`) ||
      normHay.includes(`total ${num}`) ||
      normHay.includes(`${num} resources`) ||
      normHay.includes(`total** | **${num}`)
    ) {
      return true;
    }
    // Check markdown bold: **75**
    if (normHay.includes(`**${num}**`)) return true;
  }

  return false;
}

function findPosition(text: string, needle: string): number {
  const normText = normalize(text);
  const normNeedle = normalize(needle);

  let pos = normText.indexOf(normNeedle);
  if (pos !== -1) return pos;

  // Try compact form
  const compactText = normText.replace(/\s+/g, "");
  const compactNeedle = normNeedle.replace(/\s+/g, "");
  pos = compactText.indexOf(compactNeedle);
  return pos;
}

// ─── Scoring Functions ───────────────────────────────────────────────────────

function scoreSubstringMatch(
  answer: string,
  gt: GroundTruth
): { score: number; details: string } {
  const substrings = gt.substrings ?? [];
  if (substrings.length === 0)
    return { score: 0, details: "No substrings defined" };

  const found: string[] = [];
  const missing: string[] = [];

  for (const sub of substrings) {
    if (fuzzyContains(answer, sub)) {
      found.push(sub);
    } else {
      missing.push(sub);
    }
  }

  const ratio = found.length / substrings.length;
  let score: number;
  if (ratio >= 1.0) score = 1.0;
  else if (ratio >= 0.5) score = 0.5;
  else score = 0.0;

  return {
    score,
    details: `Found ${found.length}/${substrings.length}: [${found.join(", ")}]${missing.length > 0 ? ` Missing: [${missing.join(", ")}]` : ""}`,
  };
}

function scoreSetOverlap(
  answer: string,
  gt: GroundTruth
): { score: number; details: string } {
  const expected = gt.expected ?? [];
  if (expected.length === 0)
    return { score: 0, details: "No expected items defined" };

  const found: string[] = [];
  const missing: string[] = [];

  for (const item of expected) {
    if (fuzzyContains(answer, item)) {
      found.push(item);
    } else {
      missing.push(item);
    }
  }

  const ratio = found.length / expected.length;
  let score: number;
  if (ratio >= 0.8) score = 1.0;
  else if (ratio >= 0.5) score = 0.5;
  else score = 0.0;

  return {
    score,
    details: `Matched ${found.length}/${expected.length} (${(ratio * 100).toFixed(0)}%). Missing: [${missing.join(", ")}]`,
  };
}

function scoreTopologicalValidation(
  answer: string,
  gt: GroundTruth
): { score: number; details: string } {
  const requiredNodes = gt.required_nodes ?? [];
  const mustPrecede = gt.must_precede ?? [];

  // Check which required nodes are present
  const presentNodes: string[] = [];
  const missingNodes: string[] = [];

  for (const node of requiredNodes) {
    if (fuzzyContains(answer, node)) {
      presentNodes.push(node);
    } else {
      missingNodes.push(node);
    }
  }

  const nodesFraction =
    requiredNodes.length > 0 ? presentNodes.length / requiredNodes.length : 0;

  // Check precedence constraints
  let satisfiedCount = 0;
  let checkableCount = 0;
  const violations: string[] = [];

  for (const [a, b] of mustPrecede) {
    const posA = findPosition(answer, a);
    const posB = findPosition(answer, b);

    // Only check precedence if both nodes are found
    if (posA === -1 || posB === -1) continue;

    checkableCount++;
    if (posA < posB) {
      satisfiedCount++;
    } else {
      violations.push(`${a} should precede ${b}`);
    }
  }

  const precedenceFraction =
    checkableCount > 0 ? satisfiedCount / checkableCount : 0;

  const rawScore = nodesFraction * 0.5 + precedenceFraction * 0.5;
  let score: number;
  if (rawScore >= 0.8) score = 1.0;
  else if (rawScore >= 0.4) score = 0.5;
  else score = 0.0;

  return {
    score,
    details:
      `Nodes: ${presentNodes.length}/${requiredNodes.length} present. ` +
      `Precedence: ${satisfiedCount}/${checkableCount} satisfied. ` +
      `Raw: ${rawScore.toFixed(2)}. ` +
      (missingNodes.length > 0
        ? `Missing nodes: [${missingNodes.join(", ")}]. `
        : "") +
      (violations.length > 0
        ? `Violations: [${violations.join("; ")}]`
        : ""),
  };
}

function scoreChecklist(
  answer: string,
  gt: GroundTruth
): { score: number; details: string } {
  const items = gt.items ?? [];
  const minForFull = gt.min_for_full ?? items.length;
  const minForPartial = gt.min_for_partial ?? Math.ceil(items.length / 2);

  const found: string[] = [];
  const missing: string[] = [];

  for (const item of items) {
    if (fuzzyContains(answer, item)) {
      found.push(item);
    } else {
      missing.push(item);
    }
  }

  let score: number;
  if (found.length >= minForFull) score = 1.0;
  else if (found.length >= minForPartial) score = 0.5;
  else score = 0.0;

  return {
    score,
    details: `Checked ${found.length}/${items.length} (need ${minForFull} for full, ${minForPartial} for partial). Found: [${found.join(", ")}]. Missing: [${missing.join(", ")}]`,
  };
}

// ─── Score Router ────────────────────────────────────────────────────────────

export function scoreAnswer(
  answer: string,
  scoringType: string,
  groundTruth: GroundTruth
): { score: number; details: string } {
  switch (scoringType) {
    case "substring-match":
      return scoreSubstringMatch(answer, groundTruth);
    case "set-overlap":
      return scoreSetOverlap(answer, groundTruth);
    case "topological-validation":
      return scoreTopologicalValidation(answer, groundTruth);
    case "checklist":
      return scoreChecklist(answer, groundTruth);
    default:
      return { score: 0, details: `Unknown scoring type: ${scoringType}` };
  }
}

// ─── Scoring Helpers ─────────────────────────────────────────────────────────

const SCORER_SCRIPT_DIR = resolve(
  decodeURIComponent(
    new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")
  )
);
const SCORER_RESULTS_DIR = join(SCORER_SCRIPT_DIR, "results");

function scoreSingle(resultsData: any, resultsDir: string): { scoredPath: string; summaryPath: string } {
  for (const result of resultsData.results) {
    const scoringType = result.scoring.type;
    const groundTruth = result.scoring.ground_truth as GroundTruth;
    for (const trial of result.trials) {
      const { score, details } = scoreAnswer(trial.answer, scoringType, groundTruth);
      trial.score = score;
      trial.score_details = details;
    }
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const scoredPath = join(resultsDir, `scored-${timestamp}.json`);
  writeFileSync(scoredPath, JSON.stringify(resultsData, null, 2));
  const md = generateSummary(resultsData);
  const summaryPath = join(resultsDir, `summary-${timestamp}.md`);
  writeFileSync(summaryPath, md);
  return { scoredPath, summaryPath };
}

function scoreCombined(data: CombinedRunResult, resultsDir: string): { scoredPath: string; summaryPath: string } {
  for (const result of data.results) {
    const scoringType = result.scoring.type;
    const groundTruth = result.scoring.ground_truth as GroundTruth;
    for (const trial of result.raw_trials) {
      const { score, details } = scoreAnswer(trial.answer, scoringType, groundTruth);
      (trial as any).score = score;
      (trial as any).score_details = details;
    }
    for (const trial of result.mcp_trials) {
      const { score, details } = scoreAnswer(trial.answer, scoringType, groundTruth);
      (trial as any).score = score;
      (trial as any).score_details = details;
    }
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const scoredPath = join(resultsDir, `scored-combined-${timestamp}.json`);
  writeFileSync(scoredPath, JSON.stringify(data, null, 2));
  const md = generateCombinedSummary(data);
  const summaryPath = join(resultsDir, `summary-combined-${timestamp}.md`);
  writeFileSync(summaryPath, md);
  return { scoredPath, summaryPath };
}

export function scoreAndWrite(
  data: any,
  resultsDir: string = SCORER_RESULTS_DIR
): { scoredPath: string; summaryPath: string } {
  const isCombined = Array.isArray(data?.metadata?.modes);
  if (isCombined) {
    return scoreCombined(data as CombinedRunResult, resultsDir);
  }
  return scoreSingle(data, resultsDir);
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const resultsPath = process.argv[2];
  if (!resultsPath) {
    console.error("Usage: npx tsx scorer.ts <results-json-path>");
    process.exit(1);
  }

  const resultsData = JSON.parse(readFileSync(resolve(resultsPath), "utf-8"));
  const { scoredPath, summaryPath } = scoreAndWrite(resultsData, SCORER_RESULTS_DIR);
  console.log(`Scored results: ${scoredPath}`);
  console.log(`Summary: ${summaryPath}`);
  console.log("\n" + readFileSync(summaryPath, "utf-8"));
}

// ─── Summary Generation ─────────────────────────────────────────────────────

function generateSummary(data: any): string {
  const lines: string[] = [];
  const meta = data.metadata;

  lines.push("# Baseline Experiment Results");
  lines.push("");
  lines.push(`- **Date:** ${meta.timestamp}`);
  lines.push(`- **Model:** ${meta.model}`);
  lines.push(`- **Mode:** ${meta.mode}`);
  lines.push(`- **CLI Version:** ${meta.claude_cli_version ?? "N/A"}`);
  lines.push(
    `- **Trials per prompt:** ${meta.trials_per_prompt}`
  );
  lines.push(`- **Total prompts:** ${meta.total_prompts}`);
  lines.push("");

  // Table 1: Scores & Metrics
  lines.push("## Table 1: Scores & Metrics");
  lines.push("");

  const trialCount = meta.trials_per_prompt;
  const trialHeaders = Array.from(
    { length: trialCount },
    (_, i) => `T${i + 1}`
  ).join(" | ");
  lines.push(
    `| # | Prompt | Diff | ${trialHeaders} | Mean | Avg Tokens (In/Out) | Avg Tools | Avg Time(s) | Avg Cost |`
  );
  lines.push(
    `|---|--------|------|${Array(trialCount).fill("----").join("|")}|------|---------------------|-----------|-------------|----------|`
  );

  let grandTotalTokensIn = 0;
  let grandTotalTokensOut = 0;
  let grandTotalCost = 0;
  let grandTotalTime = 0;

  for (const r of data.results) {
    const trialScores = r.trials
      .map((t: any) => (t.score ?? 0).toFixed(1))
      .join(" | ");
    const meanScore =
      r.trials.reduce((s: number, t: any) => s + (t.score ?? 0), 0) /
      r.trials.length;
    const avgTokensIn = Math.round(
      r.trials.reduce((s: number, t: any) => s + (t.tokens_in ?? 0), 0) /
        r.trials.length
    );
    const avgTokensOut = Math.round(
      r.trials.reduce((s: number, t: any) => s + (t.tokens_out ?? 0), 0) /
        r.trials.length
    );
    const avgTools = Math.round(
      r.trials.reduce((s: number, t: any) => s + (t.tool_calls ?? 0), 0) /
        r.trials.length
    );
    const avgTime = (
      r.trials.reduce((s: number, t: any) => s + (t.wall_time_ms ?? 0), 0) /
      r.trials.length /
      1000
    ).toFixed(1);
    const avgCost = (
      r.trials.reduce((s: number, t: any) => s + (t.cost_usd ?? 0), 0) /
      r.trials.length
    ).toFixed(4);

    grandTotalTokensIn += r.trials.reduce(
      (s: number, t: any) => s + (t.tokens_in ?? 0),
      0
    );
    grandTotalTokensOut += r.trials.reduce(
      (s: number, t: any) => s + (t.tokens_out ?? 0),
      0
    );
    grandTotalCost += r.trials.reduce(
      (s: number, t: any) => s + (t.cost_usd ?? 0),
      0
    );
    grandTotalTime += r.trials.reduce(
      (s: number, t: any) => s + (t.wall_time_ms ?? 0),
      0
    );

    const shortPrompt =
      r.prompt.length > 40 ? r.prompt.slice(0, 37) + "..." : r.prompt;
    lines.push(
      `| ${r.id} | ${shortPrompt} | ${r.difficulty} | ${trialScores} | ${meanScore.toFixed(2)} | ${avgTokensIn}/${avgTokensOut} | ${avgTools} | ${avgTime} | $${avgCost} |`
    );
  }

  lines.push("");
  lines.push(
    `**Totals:** ${grandTotalTokensIn + grandTotalTokensOut} tokens, $${grandTotalCost.toFixed(4)}, ${(grandTotalTime / 1000).toFixed(1)}s`
  );
  lines.push("");

  // Table 2: Tool Usage Breakdown
  lines.push("## Table 2: Tool Usage Breakdown");
  lines.push("");
  lines.push(
    "| # | Prompt | Terraform Cmds Used | Files Read | Tool Output (chars) | Tokens/Tool Call |"
  );
  lines.push(
    "|---|--------|---------------------|------------|---------------------|------------------|"
  );

  for (const r of data.results) {
    // Aggregate terraform commands across trials
    const allTfCmds = new Set<string>();
    const allFiles = new Set<string>();
    let totalOutputChars = 0;
    let totalToolCalls = 0;
    let totalTokens = 0;

    for (const t of r.trials) {
      for (const cmd of t.terraform_commands ?? []) {
        // Extract just the subcommand (e.g., "state list" from "state list")
        allTfCmds.add(cmd.split(/\s+/).slice(0, 2).join(" "));
      }
      for (const f of t.files_accessed ?? []) {
        allFiles.add(f);
      }
      totalOutputChars += t.total_tool_output_chars ?? 0;
      totalToolCalls += t.tool_calls ?? 0;
      totalTokens += (t.tokens_in ?? 0) + (t.tokens_out ?? 0);
    }

    const avgOutputChars = Math.round(totalOutputChars / r.trials.length);
    const tokensPerCall =
      totalToolCalls > 0 ? Math.round(totalTokens / totalToolCalls) : 0;

    const shortPrompt =
      r.prompt.length > 30 ? r.prompt.slice(0, 27) + "..." : r.prompt;
    lines.push(
      `| ${r.id} | ${shortPrompt} | ${Array.from(allTfCmds).join(", ")} | ${Array.from(allFiles).slice(0, 3).join(", ")}${allFiles.size > 3 ? "..." : ""} | ${avgOutputChars.toLocaleString()} | ${tokensPerCall.toLocaleString()} |`
    );
  }

  lines.push("");

  // Table 3: Aggregates by Difficulty
  lines.push("## Table 3: Aggregates by Difficulty");
  lines.push("");
  lines.push(
    "| Difficulty | Mean Score | Avg Tokens | Avg Tools | Avg Time(s) | Avg Cost | Tokens/Correct Answer |"
  );
  lines.push(
    "|------------|------------|------------|-----------|-------------|----------|----------------------|"
  );

  for (const diff of ["easy", "medium", "hard"]) {
    const diffResults = data.results.filter(
      (r: any) => r.difficulty === diff
    );
    if (diffResults.length === 0) continue;

    let totalScore = 0;
    let totalTokens = 0;
    let totalTools = 0;
    let totalTime = 0;
    let totalCost = 0;
    let totalTrials = 0;
    let correctTrials = 0;
    let correctTokens = 0;

    for (const r of diffResults) {
      for (const t of r.trials) {
        totalScore += t.score ?? 0;
        const trialTokens = (t.tokens_in ?? 0) + (t.tokens_out ?? 0);
        totalTokens += trialTokens;
        totalTools += t.tool_calls ?? 0;
        totalTime += t.wall_time_ms ?? 0;
        totalCost += t.cost_usd ?? 0;
        totalTrials++;
        if ((t.score ?? 0) >= 1.0) {
          correctTrials++;
          correctTokens += trialTokens;
        }
      }
    }

    const meanScore = totalTrials > 0 ? totalScore / totalTrials : 0;
    const avgTokens = totalTrials > 0 ? Math.round(totalTokens / totalTrials) : 0;
    const avgTools = totalTrials > 0 ? Math.round(totalTools / totalTrials) : 0;
    const avgTime =
      totalTrials > 0 ? (totalTime / totalTrials / 1000).toFixed(1) : "0";
    const avgCost =
      totalTrials > 0 ? (totalCost / totalTrials).toFixed(4) : "0";
    const tokensPerCorrect =
      correctTrials > 0
        ? Math.round(correctTokens / correctTrials).toLocaleString()
        : "N/A (no correct)";

    lines.push(
      `| ${diff} | ${meanScore.toFixed(2)} | ${avgTokens.toLocaleString()} | ${avgTools} | ${avgTime} | $${avgCost} | ${tokensPerCorrect} |`
    );
  }

  lines.push("");

  // Score details per prompt
  lines.push("## Score Details");
  lines.push("");
  for (const r of data.results) {
    lines.push(`### Prompt ${r.id}: ${r.prompt}`);
    lines.push(`- **Difficulty:** ${r.difficulty} | **Category:** ${r.category} | **Scoring:** ${r.scoring.type}`);
    for (const t of r.trials) {
      lines.push(
        `- Trial ${t.trial}: **${(t.score ?? 0).toFixed(1)}** — ${t.score_details ?? "N/A"}`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Combined Summary Generation ─────────────────────────────────────────────

function generateCombinedSummary(data: CombinedRunResult): string {
  const lines: string[] = [];
  const meta = data.metadata;

  lines.push("# Combined Experiment Results — Raw vs MCP");
  lines.push("");
  lines.push(`- **Date:** ${meta.timestamp}`);
  lines.push(`- **Model:** ${meta.model}`);
  lines.push(`- **Modes:** raw + mcp`);
  lines.push(`- **CLI Version:** ${meta.claude_cli_version ?? "N/A"}`);
  lines.push(`- **Trials per prompt:** ${meta.trials_per_prompt}`);
  lines.push(`- **Total prompts:** ${meta.total_prompts}`);
  lines.push(`- **Raw phase:** ${meta.raw_start} → ${meta.raw_end}`);
  lines.push(`- **MCP phase:** ${meta.mcp_start} → ${meta.mcp_end}`);
  lines.push("");

  // ── Table 1: Head-to-Head Comparison ───────────────────────────────────────
  lines.push("## Table 1: Head-to-Head Comparison (Raw vs MCP)");
  lines.push("");
  lines.push("| # | Prompt | Diff | Raw Score | MCP Score | Δ Score | Raw Tokens | MCP Tokens | Token Δ% | Raw Cost | MCP Cost |");
  lines.push("|---|--------|------|-----------|-----------|---------|------------|------------|----------|----------|----------|");

  let totalRawScore = 0, totalMcpScore = 0;
  let totalRawTokens = 0, totalMcpTokens = 0;
  let totalRawCost = 0, totalMcpCost = 0;
  let totalPrompts = 0;

  for (const r of data.results) {
    const rawTrials = r.raw_trials as any[];
    const mcpTrials = r.mcp_trials as any[];

    const rawScore = rawTrials.length > 0
      ? rawTrials.reduce((s, t) => s + (t.score ?? 0), 0) / rawTrials.length : 0;
    const mcpScore = mcpTrials.length > 0
      ? mcpTrials.reduce((s, t) => s + (t.score ?? 0), 0) / mcpTrials.length : 0;
    const rawTokens = rawTrials.length > 0
      ? Math.round(rawTrials.reduce((s, t) => s + (t.tokens_in ?? 0) + (t.tokens_out ?? 0), 0) / rawTrials.length) : 0;
    const mcpTokens = mcpTrials.length > 0
      ? Math.round(mcpTrials.reduce((s, t) => s + (t.tokens_in ?? 0) + (t.tokens_out ?? 0), 0) / mcpTrials.length) : 0;
    const rawCost = rawTrials.length > 0
      ? rawTrials.reduce((s, t) => s + (t.cost_usd ?? 0), 0) / rawTrials.length : 0;
    const mcpCost = mcpTrials.length > 0
      ? mcpTrials.reduce((s, t) => s + (t.cost_usd ?? 0), 0) / mcpTrials.length : 0;

    const deltaScore = mcpScore - rawScore;
    const tokenDeltaPct = rawTokens > 0
      ? ((mcpTokens - rawTokens) / rawTokens * 100).toFixed(0) + "%" : "N/A";
    const shortPrompt = r.prompt.length > 34 ? r.prompt.slice(0, 31) + "..." : r.prompt;

    lines.push(
      `| ${r.id} | ${shortPrompt} | ${r.difficulty} | ${rawScore.toFixed(2)} | ${mcpScore.toFixed(2)} | ${deltaScore >= 0 ? "+" : ""}${deltaScore.toFixed(2)} | ${rawTokens.toLocaleString()} | ${mcpTokens.toLocaleString()} | ${tokenDeltaPct} | $${rawCost.toFixed(4)} | $${mcpCost.toFixed(4)} |`
    );

    totalRawScore += rawScore; totalMcpScore += mcpScore;
    totalRawTokens += rawTokens; totalMcpTokens += mcpTokens;
    totalRawCost += rawCost; totalMcpCost += mcpCost;
    totalPrompts++;
  }

  const overallDelta = totalPrompts > 0 ? (totalMcpScore - totalRawScore) / totalPrompts : 0;
  const overallTokenDeltaPct = totalRawTokens > 0
    ? ((totalMcpTokens - totalRawTokens) / totalRawTokens * 100).toFixed(0) + "%" : "N/A";
  const meanRawScore = totalPrompts > 0 ? totalRawScore / totalPrompts : 0;
  const meanMcpScore = totalPrompts > 0 ? totalMcpScore / totalPrompts : 0;

  lines.push(
    `| - | **TOTALS/MEANS** | | **${meanRawScore.toFixed(2)}** | **${meanMcpScore.toFixed(2)}** | **${overallDelta >= 0 ? "+" : ""}${overallDelta.toFixed(2)}** | ${totalRawTokens.toLocaleString()} | ${totalMcpTokens.toLocaleString()} | ${overallTokenDeltaPct} | $${totalRawCost.toFixed(4)} | $${totalMcpCost.toFixed(4)} |`
  );
  lines.push("");

  // ── Table 2: Raw — Scores & Metrics ────────────────────────────────────────
  lines.push("## Table 2: Raw Mode — Scores & Metrics");
  lines.push("");
  const trialCount = meta.trials_per_prompt;
  const trialHeaders = Array.from({ length: trialCount }, (_, i) => `T${i + 1}`).join(" | ");
  lines.push(`| # | Prompt | Diff | ${trialHeaders} | Mean | Avg Tokens | Avg Tools | Avg Time(s) | Avg Cost |`);
  lines.push(`|---|--------|------|${Array(trialCount).fill("----").join("|")}|------|------------|-----------|-------------|----------|`);

  for (const r of data.results) {
    const trials = r.raw_trials as any[];
    if (trials.length === 0) continue;
    const trialScores = trials.map(t => (t.score ?? 0).toFixed(1)).join(" | ");
    const mean = trials.reduce((s, t) => s + (t.score ?? 0), 0) / trials.length;
    const avgTok = Math.round(trials.reduce((s, t) => s + (t.tokens_in ?? 0) + (t.tokens_out ?? 0), 0) / trials.length);
    const avgTools = Math.round(trials.reduce((s, t) => s + (t.tool_calls ?? 0), 0) / trials.length);
    const avgTime = (trials.reduce((s, t) => s + (t.wall_time_ms ?? 0), 0) / trials.length / 1000).toFixed(1);
    const avgCost = (trials.reduce((s, t) => s + (t.cost_usd ?? 0), 0) / trials.length).toFixed(4);
    const shortPrompt = r.prompt.length > 34 ? r.prompt.slice(0, 31) + "..." : r.prompt;
    lines.push(`| ${r.id} | ${shortPrompt} | ${r.difficulty} | ${trialScores} | ${mean.toFixed(2)} | ${avgTok.toLocaleString()} | ${avgTools} | ${avgTime} | $${avgCost} |`);
  }
  lines.push("");

  // ── Table 3: MCP — Scores & Metrics ────────────────────────────────────────
  lines.push("## Table 3: MCP Mode — Scores & Metrics");
  lines.push("");
  lines.push(`| # | Prompt | Diff | ${trialHeaders} | Mean | Avg Tokens | Avg Tools | Avg Time(s) | Avg Cost |`);
  lines.push(`|---|--------|------|${Array(trialCount).fill("----").join("|")}|------|------------|-----------|-------------|----------|`);

  for (const r of data.results) {
    const trials = r.mcp_trials as any[];
    if (trials.length === 0) continue;
    const trialScores = trials.map(t => (t.score ?? 0).toFixed(1)).join(" | ");
    const mean = trials.reduce((s, t) => s + (t.score ?? 0), 0) / trials.length;
    const avgTok = Math.round(trials.reduce((s, t) => s + (t.tokens_in ?? 0) + (t.tokens_out ?? 0), 0) / trials.length);
    const avgTools = Math.round(trials.reduce((s, t) => s + (t.tool_calls ?? 0), 0) / trials.length);
    const avgTime = (trials.reduce((s, t) => s + (t.wall_time_ms ?? 0), 0) / trials.length / 1000).toFixed(1);
    const avgCost = (trials.reduce((s, t) => s + (t.cost_usd ?? 0), 0) / trials.length).toFixed(4);
    const shortPrompt = r.prompt.length > 34 ? r.prompt.slice(0, 31) + "..." : r.prompt;
    lines.push(`| ${r.id} | ${shortPrompt} | ${r.difficulty} | ${trialScores} | ${mean.toFixed(2)} | ${avgTok.toLocaleString()} | ${avgTools} | ${avgTime} | $${avgCost} |`);
  }
  lines.push("");

  // ── Table 4: Aggregates by Difficulty — Raw vs MCP ─────────────────────────
  lines.push("## Table 4: Aggregates by Difficulty — Raw vs MCP");
  lines.push("");
  lines.push("| Difficulty | Raw Score | MCP Score | Δ Score | Raw Tokens | MCP Tokens | Token Δ% | Raw Cost | MCP Cost |");
  lines.push("|------------|-----------|-----------|---------|------------|------------|----------|----------|----------|");

  for (const diff of ["easy", "medium", "hard"]) {
    const diffResults = data.results.filter(r => r.difficulty === diff);
    if (diffResults.length === 0) continue;

    let rScore = 0, mScore = 0, rTok = 0, mTok = 0, rCost = 0, mCost = 0;
    let rCount = 0, mCount = 0;

    for (const r of diffResults) {
      for (const t of r.raw_trials as any[]) {
        rScore += t.score ?? 0;
        rTok += (t.tokens_in ?? 0) + (t.tokens_out ?? 0);
        rCost += t.cost_usd ?? 0;
        rCount++;
      }
      for (const t of r.mcp_trials as any[]) {
        mScore += t.score ?? 0;
        mTok += (t.tokens_in ?? 0) + (t.tokens_out ?? 0);
        mCost += t.cost_usd ?? 0;
        mCount++;
      }
    }

    const meanR = rCount > 0 ? rScore / rCount : 0;
    const meanM = mCount > 0 ? mScore / mCount : 0;
    const avgRTok = rCount > 0 ? Math.round(rTok / rCount) : 0;
    const avgMTok = mCount > 0 ? Math.round(mTok / mCount) : 0;
    const tokDelta = avgRTok > 0 ? ((avgMTok - avgRTok) / avgRTok * 100).toFixed(0) + "%" : "N/A";
    const avgRCost = rCount > 0 ? rCost / rCount : 0;
    const avgMCost = mCount > 0 ? mCost / mCount : 0;
    const delta = meanM - meanR;

    lines.push(
      `| ${diff} | ${meanR.toFixed(2)} | ${meanM.toFixed(2)} | ${delta >= 0 ? "+" : ""}${delta.toFixed(2)} | ${avgRTok.toLocaleString()} | ${avgMTok.toLocaleString()} | ${tokDelta} | $${avgRCost.toFixed(4)} | $${avgMCost.toFixed(4)} |`
    );
  }
  lines.push("");

  // ── Score Details ───────────────────────────────────────────────────────────
  lines.push("## Score Details");
  lines.push("");
  for (const r of data.results) {
    lines.push(`### Prompt ${r.id}: ${r.prompt}`);
    lines.push(`- **Difficulty:** ${r.difficulty} | **Category:** ${r.category} | **Scoring:** ${r.scoring.type}`);
    for (const t of r.raw_trials as any[]) {
      lines.push(`- Raw Trial ${t.trial}: **${(t.score ?? 0).toFixed(1)}** — ${t.score_details ?? "N/A"}`);
    }
    for (const t of r.mcp_trials as any[]) {
      lines.push(`- MCP Trial ${t.trial}: **${(t.score ?? 0).toFixed(1)}** — ${t.score_details ?? "N/A"}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
