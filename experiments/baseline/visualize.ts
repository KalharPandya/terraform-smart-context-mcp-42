#!/usr/bin/env npx tsx
/**
 * Baseline Experiment Visualizer
 *
 * Generates an HTML dashboard with Chart.js visualizations from scored results.
 *
 * Usage:
 *   npx tsx experiments/baseline/visualize.ts <scored-results-json-path>
 *
 * Output:
 *   results/charts/index.html — single-page dashboard with all charts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, join } from "path";

const SCRIPT_DIR = resolve(
  decodeURIComponent(
    new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")
  )
);
const CHARTS_DIR = join(SCRIPT_DIR, "results", "charts");

// ─── Data Extraction ─────────────────────────────────────────────────────────

interface ChartData {
  promptLabels: string[];
  difficulties: string[];
  scores: number[][];        // per-prompt, per-trial
  meanScores: number[];
  tokensIn: number[];        // per-prompt avg
  tokensOut: number[];
  toolCalls: number[];       // per-prompt avg
  wallTimeS: number[];       // per-prompt avg
  costUsd: number[];         // per-prompt avg
  toolOutputChars: number[]; // per-prompt avg
  difficultyLabels: string[];
  difficultyScores: number[];
  difficultyTokens: number[];
  difficultyTools: number[];
  difficultyCost: number[];
  // Per-trial tool call sequence data for context growth chart
  contextGrowth: {
    difficulty: string;
    trials: Array<{
      cumulativeChars: number[];
    }>;
  }[];
  // Terraform command distribution
  commandDist: Record<string, Record<string, number>>; // difficulty -> command -> count
}

function extractChartData(data: any): ChartData {
  const results = data.results;

  const promptLabels = results.map(
    (r: any) => `P${r.id}: ${r.prompt.slice(0, 25)}...`
  );
  const difficulties = results.map((r: any) => r.difficulty);

  const scores = results.map((r: any) =>
    r.trials.map((t: any) => t.score ?? 0)
  );
  const meanScores = results.map(
    (r: any) =>
      r.trials.reduce((s: number, t: any) => s + (t.score ?? 0), 0) /
      r.trials.length
  );

  const tokensIn = results.map(
    (r: any) =>
      Math.round(
        r.trials.reduce((s: number, t: any) => s + (t.tokens_in ?? 0), 0) /
          r.trials.length
      )
  );
  const tokensOut = results.map(
    (r: any) =>
      Math.round(
        r.trials.reduce((s: number, t: any) => s + (t.tokens_out ?? 0), 0) /
          r.trials.length
      )
  );
  const toolCalls = results.map(
    (r: any) =>
      Math.round(
        r.trials.reduce((s: number, t: any) => s + (t.tool_calls ?? 0), 0) /
          r.trials.length
      )
  );
  const wallTimeS = results.map(
    (r: any) =>
      r.trials.reduce((s: number, t: any) => s + (t.wall_time_ms ?? 0), 0) /
      r.trials.length /
      1000
  );
  const costUsd = results.map(
    (r: any) =>
      r.trials.reduce((s: number, t: any) => s + (t.cost_usd ?? 0), 0) /
      r.trials.length
  );
  const toolOutputChars = results.map(
    (r: any) =>
      Math.round(
        r.trials.reduce(
          (s: number, t: any) => s + (t.total_tool_output_chars ?? 0),
          0
        ) / r.trials.length
      )
  );

  // Aggregates by difficulty
  const difficultyLabels = ["easy", "medium", "hard"];
  const difficultyScores: number[] = [];
  const difficultyTokens: number[] = [];
  const difficultyTools: number[] = [];
  const difficultyCost: number[] = [];

  for (const diff of difficultyLabels) {
    const diffResults = results.filter((r: any) => r.difficulty === diff);
    let totalScore = 0;
    let totalTokens = 0;
    let totalTools = 0;
    let totalCost = 0;
    let count = 0;
    for (const r of diffResults) {
      for (const t of r.trials) {
        totalScore += t.score ?? 0;
        totalTokens += (t.tokens_in ?? 0) + (t.tokens_out ?? 0);
        totalTools += t.tool_calls ?? 0;
        totalCost += t.cost_usd ?? 0;
        count++;
      }
    }
    difficultyScores.push(count > 0 ? totalScore / count : 0);
    difficultyTokens.push(count > 0 ? Math.round(totalTokens / count) : 0);
    difficultyTools.push(count > 0 ? Math.round(totalTools / count) : 0);
    difficultyCost.push(count > 0 ? totalCost / count : 0);
  }

  // Context growth: cumulative tool output chars per trial
  const contextGrowth: ChartData["contextGrowth"] = [];
  for (const diff of difficultyLabels) {
    const diffResults = results.filter((r: any) => r.difficulty === diff);
    const trials: Array<{ cumulativeChars: number[] }> = [];
    for (const r of diffResults) {
      for (const t of r.trials) {
        const details = t.tool_call_details ?? [];
        const cumulative: number[] = [];
        let sum = 0;
        for (const d of details) {
          sum += d.output_chars ?? 0;
          cumulative.push(sum);
        }
        if (cumulative.length > 0) {
          trials.push({ cumulativeChars: cumulative });
        }
      }
    }
    contextGrowth.push({ difficulty: diff, trials });
  }

  // Terraform command distribution by difficulty
  const commandDist: Record<string, Record<string, number>> = {};
  for (const diff of difficultyLabels) {
    commandDist[diff] = {};
    const diffResults = results.filter((r: any) => r.difficulty === diff);
    for (const r of diffResults) {
      for (const t of r.trials) {
        for (const cmd of t.terraform_commands ?? []) {
          const subCmd = cmd.split(/\s+/).slice(0, 2).join(" ");
          commandDist[diff][subCmd] = (commandDist[diff][subCmd] ?? 0) + 1;
        }
      }
    }
  }

  return {
    promptLabels,
    difficulties,
    scores,
    meanScores,
    tokensIn,
    tokensOut,
    toolCalls,
    wallTimeS,
    costUsd,
    toolOutputChars,
    difficultyLabels,
    difficultyScores,
    difficultyTokens,
    difficultyTools,
    difficultyCost,
    contextGrowth,
    commandDist,
  };
}

// ─── HTML Generation ─────────────────────────────────────────────────────────

function generateHTML(data: any, chartData: ChartData): string {
  const meta = data.metadata;
  const diffColors: Record<string, string> = {
    easy: "rgba(75, 192, 192, 0.8)",
    medium: "rgba(255, 206, 86, 0.8)",
    hard: "rgba(255, 99, 132, 0.8)",
  };
  const diffBorders: Record<string, string> = {
    easy: "rgba(75, 192, 192, 1)",
    medium: "rgba(255, 206, 86, 1)",
    hard: "rgba(255, 99, 132, 1)",
  };

  const bgColors = chartData.difficulties.map(
    (d) => diffColors[d] ?? "rgba(153, 102, 255, 0.8)"
  );
  const borderColors = chartData.difficulties.map(
    (d) => diffBorders[d] ?? "rgba(153, 102, 255, 1)"
  );

  // Context growth: average cumulative chars per step for each difficulty
  const maxSteps = Math.max(
    ...chartData.contextGrowth.flatMap((cg) =>
      cg.trials.map((t) => t.cumulativeChars.length)
    ),
    1
  );
  const contextGrowthDatasets = chartData.contextGrowth
    .map((cg) => {
      if (cg.trials.length === 0) return null;
      const avgCum: number[] = [];
      for (let step = 0; step < maxSteps; step++) {
        const vals = cg.trials
          .filter((t) => step < t.cumulativeChars.length)
          .map((t) => t.cumulativeChars[step]);
        avgCum.push(
          vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
        );
      }
      // Trim trailing zeros
      while (avgCum.length > 1 && avgCum[avgCum.length - 1] === 0) avgCum.pop();
      return {
        label: cg.difficulty,
        data: avgCum,
        borderColor: diffBorders[cg.difficulty],
        backgroundColor: diffColors[cg.difficulty],
        fill: false,
        tension: 0.3,
      };
    })
    .filter(Boolean);

  // Command distribution datasets
  const allCommands = new Set<string>();
  for (const diff of chartData.difficultyLabels) {
    for (const cmd of Object.keys(chartData.commandDist[diff] ?? {})) {
      allCommands.add(cmd);
    }
  }
  const cmdLabels = Array.from(allCommands).sort();
  const cmdDatasets = chartData.difficultyLabels.map((diff) => ({
    label: diff,
    data: cmdLabels.map((cmd) => chartData.commandDist[diff]?.[cmd] ?? 0),
    backgroundColor: diffColors[diff],
    borderColor: diffBorders[diff],
    borderWidth: 1,
  }));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Baseline Experiment Results — Project 42</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; padding: 20px; }
    h1 { text-align: center; margin-bottom: 5px; color: #1a1a1a; }
    .meta { text-align: center; color: #666; margin-bottom: 30px; font-size: 14px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; max-width: 1400px; margin: 0 auto; }
    .chart-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .chart-card.full { grid-column: 1 / -1; }
    .chart-card h2 { font-size: 16px; margin-bottom: 15px; color: #444; }
    canvas { max-height: 400px; }
    .summary { max-width: 1400px; margin: 30px auto; background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .summary h2 { margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 8px 12px; border: 1px solid #e0e0e0; text-align: left; }
    th { background: #f8f8f8; font-weight: 600; }
    .score-1 { color: #2e7d32; font-weight: bold; }
    .score-05 { color: #f57f17; font-weight: bold; }
    .score-0 { color: #c62828; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Baseline Experiment Results</h1>
  <p class="meta">
    Model: ${meta.model} | CLI: ${meta.claude_cli_version ?? "N/A"} |
    ${meta.total_prompts} prompts x ${meta.trials_per_prompt} trials |
    ${meta.timestamp}
  </p>

  <div class="grid">
    <!-- Chart 1: Accuracy by Difficulty -->
    <div class="chart-card">
      <h2>1. Accuracy by Difficulty</h2>
      <canvas id="chart1"></canvas>
    </div>

    <!-- Chart 2: Token Usage by Prompt -->
    <div class="chart-card">
      <h2>2. Token Usage by Prompt</h2>
      <canvas id="chart2"></canvas>
    </div>

    <!-- Chart 3: Tool Calls vs Accuracy -->
    <div class="chart-card">
      <h2>3. Tool Calls vs Accuracy</h2>
      <canvas id="chart3"></canvas>
    </div>

    <!-- Chart 4: Token Efficiency -->
    <div class="chart-card">
      <h2>4. Token Efficiency (Tokens per Prompt)</h2>
      <canvas id="chart4"></canvas>
    </div>

    <!-- Chart 5: Context Growth -->
    <div class="chart-card full">
      <h2>5. Context Growth (Cumulative Tool Output by Step)</h2>
      <canvas id="chart5"></canvas>
    </div>

    <!-- Chart 6: Command Distribution -->
    <div class="chart-card full">
      <h2>6. Terraform Command Distribution by Difficulty</h2>
      <canvas id="chart6"></canvas>
    </div>
  </div>

  <!-- Summary Table -->
  <div class="summary">
    <h2>Score Summary</h2>
    <table>
      <thead>
        <tr>
          <th>#</th><th>Prompt</th><th>Difficulty</th>
          ${Array.from({ length: meta.trials_per_prompt }, (_, i) => `<th>T${i + 1}</th>`).join("")}
          <th>Mean</th><th>Avg Tokens</th><th>Avg Tools</th><th>Avg Cost</th>
        </tr>
      </thead>
      <tbody>
        ${data.results
          .map(
            (r: any) => `
          <tr>
            <td>${r.id}</td>
            <td>${r.prompt.slice(0, 50)}${r.prompt.length > 50 ? "..." : ""}</td>
            <td>${r.difficulty}</td>
            ${r.trials
              .map((t: any) => {
                const s = t.score ?? 0;
                const cls = s >= 1 ? "score-1" : s >= 0.5 ? "score-05" : "score-0";
                return `<td class="${cls}">${s.toFixed(1)}</td>`;
              })
              .join("")}
            <td>${(r.trials.reduce((s: number, t: any) => s + (t.score ?? 0), 0) / r.trials.length).toFixed(2)}</td>
            <td>${Math.round(r.trials.reduce((s: number, t: any) => s + (t.tokens_in ?? 0) + (t.tokens_out ?? 0), 0) / r.trials.length).toLocaleString()}</td>
            <td>${Math.round(r.trials.reduce((s: number, t: any) => s + (t.tool_calls ?? 0), 0) / r.trials.length)}</td>
            <td>$${(r.trials.reduce((s: number, t: any) => s + (t.cost_usd ?? 0), 0) / r.trials.length).toFixed(4)}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  </div>

  <script>
    // Chart 1: Accuracy by Difficulty (bar)
    new Chart(document.getElementById('chart1'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(chartData.difficultyLabels)},
        datasets: [{
          label: 'Mean Score',
          data: ${JSON.stringify(chartData.difficultyScores.map(s => +s.toFixed(3)))},
          backgroundColor: [${chartData.difficultyLabels.map(d => `'${diffColors[d]}'`).join(",")}],
          borderColor: [${chartData.difficultyLabels.map(d => `'${diffBorders[d]}'`).join(",")}],
          borderWidth: 2
        }]
      },
      options: {
        scales: { y: { beginAtZero: true, max: 1.0, title: { display: true, text: 'Mean Score' } } },
        plugins: { legend: { display: false } }
      }
    });

    // Chart 2: Token Usage by Prompt (stacked bar)
    new Chart(document.getElementById('chart2'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(chartData.promptLabels)},
        datasets: [
          { label: 'Input Tokens', data: ${JSON.stringify(chartData.tokensIn)}, backgroundColor: 'rgba(54, 162, 235, 0.7)' },
          { label: 'Output Tokens', data: ${JSON.stringify(chartData.tokensOut)}, backgroundColor: 'rgba(255, 159, 64, 0.7)' }
        ]
      },
      options: {
        scales: { x: { stacked: true }, y: { stacked: true, title: { display: true, text: 'Tokens' } } },
        plugins: { legend: { position: 'top' } }
      }
    });

    // Chart 3: Tool Calls vs Accuracy (scatter/bubble)
    new Chart(document.getElementById('chart3'), {
      type: 'bubble',
      data: {
        datasets: [{
          label: 'Prompts',
          data: ${JSON.stringify(
            chartData.toolCalls.map((tc, i) => ({
              x: tc,
              y: chartData.meanScores[i],
              r: Math.max(5, Math.min(25, (chartData.tokensIn[i] + chartData.tokensOut[i]) / 5000)),
            }))
          )},
          backgroundColor: ${JSON.stringify(bgColors)},
          borderColor: ${JSON.stringify(borderColors)},
          borderWidth: 1
        }]
      },
      options: {
        scales: {
          x: { title: { display: true, text: 'Avg Tool Calls' } },
          y: { beginAtZero: true, max: 1.1, title: { display: true, text: 'Mean Score' } }
        }
      }
    });

    // Chart 4: Token Efficiency (total tokens per prompt)
    new Chart(document.getElementById('chart4'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(chartData.promptLabels)},
        datasets: [{
          label: 'Avg Total Tokens',
          data: ${JSON.stringify(chartData.tokensIn.map((t, i) => t + chartData.tokensOut[i]))},
          backgroundColor: ${JSON.stringify(bgColors)},
          borderColor: ${JSON.stringify(borderColors)},
          borderWidth: 1
        }]
      },
      options: {
        scales: { y: { title: { display: true, text: 'Total Tokens (In+Out)' } } },
        plugins: { legend: { display: false } }
      }
    });

    // Chart 5: Context Growth (line)
    new Chart(document.getElementById('chart5'), {
      type: 'line',
      data: {
        labels: Array.from({length: ${maxSteps}}, (_, i) => 'Call ' + (i+1)),
        datasets: ${JSON.stringify(contextGrowthDatasets)}
      },
      options: {
        scales: {
          x: { title: { display: true, text: 'Tool Call Sequence' } },
          y: { title: { display: true, text: 'Cumulative Tool Output (chars)' } }
        }
      }
    });

    // Chart 6: Command Distribution (grouped bar)
    new Chart(document.getElementById('chart6'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(cmdLabels)},
        datasets: ${JSON.stringify(cmdDatasets)}
      },
      options: {
        scales: { y: { title: { display: true, text: 'Count' } } },
        plugins: { legend: { position: 'top' } }
      }
    });
  </script>
</body>
</html>`;
}

// ─── Combined Format Support ─────────────────────────────────────────────────

interface CombinedChartData {
  promptLabels: string[];
  difficulties: string[];
  categories: string[];
  rawMeanScores: number[];
  mcpMeanScores: number[];
  rawAvgTokens: number[];
  mcpAvgTokens: number[];
  tokenDeltaPct: number[];           // (mcp - raw) / raw * 100
  rawAvgCost: number[];
  mcpAvgCost: number[];
  rawAvgTools: number[];
  mcpAvgTools: number[];
  rawAvgOutputChars: number[];
  mcpAvgOutputChars: number[];
  difficultyLabels: string[];
  diffRawScore: number[];
  diffMcpScore: number[];
  diffRawTokens: number[];
  diffMcpTokens: number[];
  diffRawCost: number[];
  diffMcpCost: number[];
  diffRawOutputChars: number[];
  diffMcpOutputChars: number[];
}

function avg(vals: number[]): number {
  return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

export function extractCombinedChartData(data: any): CombinedChartData {
  const results = data.results;

  const promptLabels = results.map((r: any) => `P${r.id}`);
  const difficulties = results.map((r: any) => r.difficulty);
  const categories = results.map((r: any) => r.category);

  const rawMeanScores = results.map((r: any) => avg(r.raw_trials.map((t: any) => t.score ?? 0)));
  const mcpMeanScores = results.map((r: any) => avg(r.mcp_trials.map((t: any) => t.score ?? 0)));

  const rawAvgTokens = results.map((r: any) =>
    Math.round(avg(r.raw_trials.map((t: any) => (t.tokens_in ?? 0) + (t.tokens_out ?? 0))))
  );
  const mcpAvgTokens = results.map((r: any) =>
    Math.round(avg(r.mcp_trials.map((t: any) => (t.tokens_in ?? 0) + (t.tokens_out ?? 0))))
  );

  const tokenDeltaPct = rawAvgTokens.map((raw: number, i: number) =>
    raw > 0 ? +((mcpAvgTokens[i] - raw) / raw * 100).toFixed(1) : 0
  );

  const rawAvgCost = results.map((r: any) => avg(r.raw_trials.map((t: any) => t.cost_usd ?? 0)));
  const mcpAvgCost = results.map((r: any) => avg(r.mcp_trials.map((t: any) => t.cost_usd ?? 0)));

  const rawAvgTools = results.map((r: any) => Math.round(avg(r.raw_trials.map((t: any) => t.tool_calls ?? 0))));
  const mcpAvgTools = results.map((r: any) => Math.round(avg(r.mcp_trials.map((t: any) => t.tool_calls ?? 0))));

  const rawAvgOutputChars = results.map((r: any) =>
    Math.round(avg(r.raw_trials.map((t: any) => t.total_tool_output_chars ?? 0)))
  );
  const mcpAvgOutputChars = results.map((r: any) =>
    Math.round(avg(r.mcp_trials.map((t: any) => t.total_tool_output_chars ?? 0)))
  );

  const difficultyLabels = ["easy", "medium", "hard"];
  const diffRawScore: number[] = [];
  const diffMcpScore: number[] = [];
  const diffRawTokens: number[] = [];
  const diffMcpTokens: number[] = [];
  const diffRawCost: number[] = [];
  const diffMcpCost: number[] = [];
  const diffRawOutputChars: number[] = [];
  const diffMcpOutputChars: number[] = [];

  for (const diff of difficultyLabels) {
    const dr = results.filter((r: any) => r.difficulty === diff);
    const allRaw = dr.flatMap((r: any) => r.raw_trials);
    const allMcp = dr.flatMap((r: any) => r.mcp_trials);
    diffRawScore.push(+avg(allRaw.map((t: any) => t.score ?? 0)).toFixed(3));
    diffMcpScore.push(+avg(allMcp.map((t: any) => t.score ?? 0)).toFixed(3));
    diffRawTokens.push(Math.round(avg(allRaw.map((t: any) => (t.tokens_in ?? 0) + (t.tokens_out ?? 0)))));
    diffMcpTokens.push(Math.round(avg(allMcp.map((t: any) => (t.tokens_in ?? 0) + (t.tokens_out ?? 0)))));
    diffRawCost.push(+avg(allRaw.map((t: any) => t.cost_usd ?? 0)).toFixed(5));
    diffMcpCost.push(+avg(allMcp.map((t: any) => t.cost_usd ?? 0)).toFixed(5));
    diffRawOutputChars.push(Math.round(avg(allRaw.map((t: any) => t.total_tool_output_chars ?? 0))));
    diffMcpOutputChars.push(Math.round(avg(allMcp.map((t: any) => t.total_tool_output_chars ?? 0))));
  }

  return {
    promptLabels, difficulties, categories,
    rawMeanScores, mcpMeanScores,
    rawAvgTokens, mcpAvgTokens, tokenDeltaPct,
    rawAvgCost, mcpAvgCost,
    rawAvgTools, mcpAvgTools,
    rawAvgOutputChars, mcpAvgOutputChars,
    difficultyLabels,
    diffRawScore, diffMcpScore,
    diffRawTokens, diffMcpTokens,
    diffRawCost, diffMcpCost,
    diffRawOutputChars, diffMcpOutputChars,
  };
}

export function generateCombinedHTML(data: any, cd: CombinedChartData): string {
  const meta = data.metadata;

  const RAW_COLOR = "rgba(54, 162, 235, 0.8)";
  const RAW_BORDER = "rgba(54, 162, 235, 1)";
  const MCP_COLOR = "rgba(255, 159, 64, 0.8)";
  const MCP_BORDER = "rgba(255, 159, 64, 1)";

  const diffColors: Record<string, string> = {
    easy: "rgba(75, 192, 192, 0.8)",
    medium: "rgba(255, 206, 86, 0.8)",
    hard: "rgba(255, 99, 132, 0.8)",
  };
  const diffBorders: Record<string, string> = {
    easy: "rgba(75, 192, 192, 1)",
    medium: "rgba(255, 206, 86, 1)",
    hard: "rgba(255, 99, 132, 1)",
  };

  const promptBgColors = cd.difficulties.map((d) => diffColors[d] ?? "rgba(153,102,255,0.8)");
  const promptBorderColors = cd.difficulties.map((d) => diffBorders[d] ?? "rgba(153,102,255,1)");

  // Scatter data: one point per prompt per mode
  const scatterRaw = cd.rawAvgTokens.map((tok, i) => ({ x: tok, y: cd.rawMeanScores[i] }));
  const scatterMcp = cd.mcpAvgTokens.map((tok, i) => ({ x: tok, y: cd.mcpMeanScores[i] }));

  // Delta bar colors: green if MCP saves (negative), red if MCP costs more (positive)
  const deltaBgColors = cd.tokenDeltaPct.map((d) =>
    d <= 0 ? "rgba(75, 192, 192, 0.8)" : "rgba(255, 99, 132, 0.8)"
  );

  // Summary table rows
  const tableRows = data.results.map((r: any) => {
    const rawT = r.raw_trials;
    const mcpT = r.mcp_trials;
    const rawS = rawT.length > 0 ? avg(rawT.map((t: any) => t.score ?? 0)) : 0;
    const mcpS = mcpT.length > 0 ? avg(mcpT.map((t: any) => t.score ?? 0)) : 0;
    const delta = mcpS - rawS;
    const rawTok = Math.round(avg(rawT.map((t: any) => (t.tokens_in ?? 0) + (t.tokens_out ?? 0))));
    const mcpTok = Math.round(avg(mcpT.map((t: any) => (t.tokens_in ?? 0) + (t.tokens_out ?? 0))));
    const tokDelta = rawTok > 0 ? ((mcpTok - rawTok) / rawTok * 100).toFixed(0) : "N/A";
    const rawTrialCells = rawT.map((t: any) => {
      const s = t.score ?? 0;
      const cls = s >= 1 ? "score-1" : s >= 0.5 ? "score-05" : "score-0";
      return `<td class="${cls}">${s.toFixed(1)}</td>`;
    }).join("");
    const mcpTrialCells = mcpT.map((t: any) => {
      const s = t.score ?? 0;
      const cls = s >= 1 ? "score-1" : s >= 0.5 ? "score-05" : "score-0";
      return `<td class="${cls}">${s.toFixed(1)}</td>`;
    }).join("");
    const deltaClass = delta > 0 ? "score-1" : delta < 0 ? "score-0" : "";
    return `
      <tr>
        <td>${r.id}</td>
        <td class="prompt-cell" title="${r.prompt}">${r.prompt.slice(0, 55)}${r.prompt.length > 55 ? "…" : ""}</td>
        <td><span class="badge badge-${r.difficulty}">${r.difficulty}</span></td>
        ${rawTrialCells}
        <td><strong>${rawS.toFixed(2)}</strong></td>
        ${mcpTrialCells}
        <td><strong>${mcpS.toFixed(2)}</strong></td>
        <td class="${deltaClass}">${delta >= 0 ? "+" : ""}${delta.toFixed(2)}</td>
        <td>${rawTok.toLocaleString()}</td>
        <td>${mcpTok.toLocaleString()}</td>
        <td class="${parseFloat(tokDelta) <= 0 ? "score-1" : "score-0"}">${tokDelta}%</td>
      </tr>`;
  }).join("");

  const trialHeaders = Array.from({ length: meta.trials_per_prompt }, (_: unknown, i: number) =>
    `<th>R${i + 1}</th>`).join("") +
    Array.from({ length: meta.trials_per_prompt }, (_: unknown, i: number) =>
      `<th>M${i + 1}</th>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Raw vs MCP — Baseline Experiment Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f2f5; color: #222; padding: 24px; }
    h1 { text-align: center; margin-bottom: 4px; font-size: 24px; color: #111; }
    .meta { text-align: center; color: #666; margin-bottom: 28px; font-size: 13px; }
    .legend { display: flex; justify-content: center; gap: 24px; margin-bottom: 20px; font-size: 13px; }
    .legend-item { display: flex; align-items: center; gap: 6px; }
    .legend-dot { width: 14px; height: 14px; border-radius: 3px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; max-width: 1500px; margin: 0 auto; }
    .chart-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .chart-card.full { grid-column: 1 / -1; }
    .chart-card h2 { font-size: 14px; font-weight: 600; margin-bottom: 14px; color: #333; letter-spacing: 0.02em; }
    canvas { max-height: 380px; }
    .table-wrap { max-width: 1500px; margin: 24px auto; background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow-x: auto; }
    .table-wrap h2 { margin-bottom: 14px; font-size: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; white-space: nowrap; }
    th, td { padding: 7px 10px; border: 1px solid #e8e8e8; text-align: center; }
    th { background: #f5f7fa; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    td.prompt-cell { text-align: left; max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 11px; }
    .score-1 { color: #1b7c3a; font-weight: 700; }
    .score-05 { color: #c07000; font-weight: 700; }
    .score-0 { color: #b71c1c; font-weight: 700; }
    .badge { display: inline-block; padding: 2px 7px; border-radius: 10px; font-size: 10px; font-weight: 600; }
    .badge-easy { background: #e0f7f4; color: #00796b; }
    .badge-medium { background: #fff8e1; color: #f57f17; }
    .badge-hard { background: #fce4ec; color: #c62828; }
  </style>
</head>
<body>
  <h1>Raw CLI vs MCP — Baseline Experiment Dashboard</h1>
  <p class="meta">
    Model: ${meta.model} &nbsp;|&nbsp; CLI: ${meta.claude_cli_version ?? "N/A"} &nbsp;|&nbsp;
    ${meta.total_prompts} prompts × ${meta.trials_per_prompt} trials × 2 modes &nbsp;|&nbsp;
    ${meta.timestamp.slice(0, 10)}
  </p>
  <div class="legend">
    <div class="legend-item"><div class="legend-dot" style="background:${RAW_COLOR}"></div> Raw CLI</div>
    <div class="legend-item"><div class="legend-dot" style="background:${MCP_COLOR}"></div> MCP</div>
    <div class="legend-item"><div class="legend-dot" style="background:${diffColors.easy}"></div> Easy</div>
    <div class="legend-item"><div class="legend-dot" style="background:${diffColors.medium}"></div> Medium</div>
    <div class="legend-item"><div class="legend-dot" style="background:${diffColors.hard}"></div> Hard</div>
  </div>

  <div class="grid">

    <!-- Chart 1: Score by Difficulty -->
    <div class="chart-card">
      <h2>1 — Accuracy by Difficulty (Raw vs MCP)</h2>
      <canvas id="c1"></canvas>
    </div>

    <!-- Chart 2: Per-Prompt Head-to-Head Score -->
    <div class="chart-card">
      <h2>2 — Per-Prompt Score (Raw vs MCP)</h2>
      <canvas id="c2"></canvas>
    </div>

    <!-- Chart 3: Token Usage by Prompt -->
    <div class="chart-card">
      <h2>3 — Avg Tokens per Prompt (Raw vs MCP)</h2>
      <canvas id="c3"></canvas>
    </div>

    <!-- Chart 4: Token Reduction % -->
    <div class="chart-card">
      <h2>4 — Token Δ% by Prompt (negative = MCP saves)</h2>
      <canvas id="c4"></canvas>
    </div>

    <!-- Chart 5: Cost by Difficulty -->
    <div class="chart-card">
      <h2>5 — Avg Cost per Query by Difficulty</h2>
      <canvas id="c5"></canvas>
    </div>

    <!-- Chart 6: Score vs Tokens Scatter -->
    <div class="chart-card">
      <h2>6 — Score vs Tokens (per prompt, both modes)</h2>
      <canvas id="c6"></canvas>
    </div>

    <!-- Chart 7: Tool Output Chars by Difficulty -->
    <div class="chart-card full">
      <h2>7 — Avg Tool Output Chars by Difficulty (how much context each mode injects)</h2>
      <canvas id="c7"></canvas>
    </div>

  </div>

  <!-- Summary Table -->
  <div class="table-wrap">
    <h2>Per-Prompt Results (R=Raw trial, M=MCP trial)</h2>
    <table>
      <thead>
        <tr>
          <th>#</th><th style="text-align:left">Prompt</th><th>Diff</th>
          ${trialHeaders}
          <th>Raw Mean</th><th>MCP Mean</th><th>Δ Score</th>
          <th>Raw Tokens</th><th>MCP Tokens</th><th>Token Δ%</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>

  <script>
  const diffColors = ${JSON.stringify(cd.difficulties.map((d) => diffColors[d] ?? "rgba(153,102,255,0.8)"))};
  const diffBorders = ${JSON.stringify(cd.difficulties.map((d) => diffBorders[d] ?? "rgba(153,102,255,1)"))};

  // Chart 1 — Score by Difficulty
  new Chart(document.getElementById('c1'), {
    type: 'bar',
    data: {
      labels: ${JSON.stringify(cd.difficultyLabels)},
      datasets: [
        { label: 'Raw', data: ${JSON.stringify(cd.diffRawScore)}, backgroundColor: '${RAW_COLOR}', borderColor: '${RAW_BORDER}', borderWidth: 2 },
        { label: 'MCP',  data: ${JSON.stringify(cd.diffMcpScore)},  backgroundColor: '${MCP_COLOR}',  borderColor: '${MCP_BORDER}',  borderWidth: 2 }
      ]
    },
    options: { scales: { y: { beginAtZero: true, max: 1.05, title: { display: true, text: 'Mean Score' } } }, plugins: { legend: { position: 'top' } } }
  });

  // Chart 2 — Per-Prompt Head-to-Head
  new Chart(document.getElementById('c2'), {
    type: 'bar',
    data: {
      labels: ${JSON.stringify(cd.promptLabels)},
      datasets: [
        { label: 'Raw', data: ${JSON.stringify(cd.rawMeanScores.map((s) => +s.toFixed(3)))}, backgroundColor: '${RAW_COLOR}', borderColor: '${RAW_BORDER}', borderWidth: 1 },
        { label: 'MCP',  data: ${JSON.stringify(cd.mcpMeanScores.map((s) => +s.toFixed(3)))},  backgroundColor: '${MCP_COLOR}',  borderColor: '${MCP_BORDER}',  borderWidth: 1 }
      ]
    },
    options: { scales: { y: { beginAtZero: true, max: 1.05, title: { display: true, text: 'Mean Score' } } }, plugins: { legend: { position: 'top' } } }
  });

  // Chart 3 — Token Usage by Prompt
  new Chart(document.getElementById('c3'), {
    type: 'bar',
    data: {
      labels: ${JSON.stringify(cd.promptLabels)},
      datasets: [
        { label: 'Raw Tokens', data: ${JSON.stringify(cd.rawAvgTokens)}, backgroundColor: '${RAW_COLOR}', borderColor: '${RAW_BORDER}', borderWidth: 1 },
        { label: 'MCP Tokens', data: ${JSON.stringify(cd.mcpAvgTokens)}, backgroundColor: '${MCP_COLOR}', borderColor: '${MCP_BORDER}', borderWidth: 1 }
      ]
    },
    options: { scales: { y: { title: { display: true, text: 'Avg Tokens' } } }, plugins: { legend: { position: 'top' } } }
  });

  // Chart 4 — Token Delta %
  new Chart(document.getElementById('c4'), {
    type: 'bar',
    data: {
      labels: ${JSON.stringify(cd.promptLabels)},
      datasets: [{
        label: 'Token Δ% (MCP vs Raw)',
        data: ${JSON.stringify(cd.tokenDeltaPct)},
        backgroundColor: ${JSON.stringify(deltaBgColors)},
        borderWidth: 1
      }]
    },
    options: {
      scales: { y: { title: { display: true, text: 'Token Δ%' } } },
      plugins: { legend: { display: false } }
    }
  });

  // Chart 5 — Cost by Difficulty
  new Chart(document.getElementById('c5'), {
    type: 'bar',
    data: {
      labels: ${JSON.stringify(cd.difficultyLabels)},
      datasets: [
        { label: 'Raw Cost', data: ${JSON.stringify(cd.diffRawCost)}, backgroundColor: '${RAW_COLOR}', borderColor: '${RAW_BORDER}', borderWidth: 2 },
        { label: 'MCP Cost', data: ${JSON.stringify(cd.diffMcpCost)}, backgroundColor: '${MCP_COLOR}', borderColor: '${MCP_BORDER}', borderWidth: 2 }
      ]
    },
    options: { scales: { y: { title: { display: true, text: 'Avg Cost USD' } } }, plugins: { legend: { position: 'top' } } }
  });

  // Chart 6 — Score vs Tokens Scatter
  new Chart(document.getElementById('c6'), {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Raw',
          data: ${JSON.stringify(scatterRaw)},
          backgroundColor: diffColors,
          borderColor: diffBorders,
          borderWidth: 1,
          pointRadius: 7,
          pointStyle: 'circle',
        },
        {
          label: 'MCP',
          data: ${JSON.stringify(scatterMcp)},
          backgroundColor: '${MCP_COLOR}',
          borderColor: '${MCP_BORDER}',
          borderWidth: 1,
          pointRadius: 7,
          pointStyle: 'triangle',
        }
      ]
    },
    options: {
      scales: {
        x: { title: { display: true, text: 'Avg Tokens' } },
        y: { beginAtZero: true, max: 1.1, title: { display: true, text: 'Mean Score' } }
      },
      plugins: { legend: { position: 'top' } }
    }
  });

  // Chart 7 — Tool Output Chars by Difficulty
  new Chart(document.getElementById('c7'), {
    type: 'bar',
    data: {
      labels: ${JSON.stringify(cd.difficultyLabels)},
      datasets: [
        { label: 'Raw Bash Output', data: ${JSON.stringify(cd.diffRawOutputChars)}, backgroundColor: '${RAW_COLOR}', borderColor: '${RAW_BORDER}', borderWidth: 2 },
        { label: 'MCP Tool Output', data: ${JSON.stringify(cd.diffMcpOutputChars)}, backgroundColor: '${MCP_COLOR}', borderColor: '${MCP_BORDER}', borderWidth: 2 }
      ]
    },
    options: {
      scales: { y: { title: { display: true, text: 'Avg Tool Output (chars)' } } },
      plugins: { legend: { position: 'top' }, tooltip: {
        callbacks: { label: (ctx) => ctx.dataset.label + ': ' + ctx.raw.toLocaleString() + ' chars' }
      }}
    }
  });
  </script>
</body>
</html>`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error(
      "Usage: npx tsx visualize.ts <scored-results-json-path>"
    );
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(resolve(inputPath), "utf-8"));

  // Ensure charts directory exists
  if (!existsSync(CHARTS_DIR)) {
    mkdirSync(CHARTS_DIR, { recursive: true });
  }

  const isCombined = Array.isArray(data?.metadata?.modes);

  let html: string;
  if (isCombined) {
    console.log("Detected combined (raw+mcp) format — generating comparison dashboard...");
    const chartData = extractCombinedChartData(data);
    html = generateCombinedHTML(data, chartData);
  } else {
    const chartData = extractChartData(data);
    html = generateHTML(data, chartData);
  }

  const outPath = join(CHARTS_DIR, "index.html");
  writeFileSync(outPath, html);
  console.log(`Dashboard written to: ${outPath}`);
  console.log(`Open in browser: file://${outPath}`);
}

// Only run CLI when executed directly (not when imported)
const isDirectRun =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isDirectRun) {
  main();
}
