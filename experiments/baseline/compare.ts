#!/usr/bin/env npx tsx
/**
 * Codex Experiment Comparison — Raw vs MCP
 *
 * Reads codex-raw and codex-mcp result files, generates:
 *   results/compare-<ts>.html  — interactive Chart.js dashboard
 *   results/compare-<ts>.md   — copyable markdown tables + key findings
 *
 * Usage:
 *   npx tsx experiments/baseline/compare.ts                              # auto-detect latest files
 *   npx tsx experiments/baseline/compare.ts --raw <path> --mcp <path>   # explicit paths
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve, join, basename } from "path";

// ─── Paths ───────────────────────────────────────────────────────────────────

const SCRIPT_DIR = resolve(
  decodeURIComponent(
    new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")
  )
);
const RESULTS_DIR = join(SCRIPT_DIR, "results");

// ─── Types ───────────────────────────────────────────────────────────────────

interface TrialResult {
  trial: number;
  answer: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  tool_calls: number;
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
  trials: TrialResult[];
}

interface RunResult {
  metadata: {
    mode: string;
    model: string;
    timestamp: string;
    trials_per_prompt: number;
    total_prompts: number;
    codex_cli_version?: string;
    claude_cli_version?: string;
  };
  results: PromptResult[];
}

interface ModeStats {
  tokens: number;
  time: number;
  tools: number;
  outputChars: number;
}

interface PromptStats {
  id: number;
  prompt: string;
  difficulty: string;
  category: string;
  raw: ModeStats;
  mcp: ModeStats;
  delta: { tokens: number; pct: number; time: number; tools: number };
}

// ─── File Detection ───────────────────────────────────────────────────────────

function latestFile(prefix: string): string {
  const files = readdirSync(RESULTS_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .sort()
    .reverse();
  if (!files.length) throw new Error(`No ${prefix}*.json found in ${RESULTS_DIR}`);
  return join(RESULTS_DIR, files[0]);
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

function avg(trials: TrialResult[], fn: (t: TrialResult) => number): number {
  if (!trials.length) return 0;
  return trials.reduce((s, t) => s + fn(t), 0) / trials.length;
}

function buildStats(raw: RunResult, mcp: RunResult): PromptStats[] {
  const mcpMap = new Map(mcp.results.map((r) => [r.id, r]));
  return raw.results.map((rawR) => {
    const mcpR = mcpMap.get(rawR.id);
    const rawStats: ModeStats = {
      tokens: avg(rawR.trials, (t) => t.tokens_in + t.tokens_out),
      time: avg(rawR.trials, (t) => t.wall_time_ms) / 1000,
      tools: avg(rawR.trials, (t) => t.tool_calls),
      outputChars: avg(rawR.trials, (t) => t.total_tool_output_chars),
    };
    const mcpStats: ModeStats = mcpR
      ? {
          tokens: avg(mcpR.trials, (t) => t.tokens_in + t.tokens_out),
          time: avg(mcpR.trials, (t) => t.wall_time_ms) / 1000,
          tools: avg(mcpR.trials, (t) => t.tool_calls),
          outputChars: avg(mcpR.trials, (t) => t.total_tool_output_chars),
        }
      : { tokens: 0, time: 0, tools: 0, outputChars: 0 };
    const deltaTokens = mcpStats.tokens - rawStats.tokens;
    return {
      id: rawR.id,
      prompt: rawR.prompt,
      difficulty: rawR.difficulty,
      category: rawR.category,
      raw: rawStats,
      mcp: mcpStats,
      delta: {
        tokens: deltaTokens,
        pct: rawStats.tokens > 0 ? (deltaTokens / rawStats.tokens) * 100 : 0,
        time: mcpStats.time - rawStats.time,
        tools: mcpStats.tools - rawStats.tools,
      },
    };
  });
}

function groupBy<T>(
  items: T[],
  key: (item: T) => string
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return map;
}

function groupStats(
  items: PromptStats[],
  key: (s: PromptStats) => string
): Array<{
  label: string;
  n: number;
  rawTok: number;
  mcpTok: number;
  deltaPct: number;
  rawTools: number;
  mcpTools: number;
  rawTime: number;
  mcpTime: number;
}> {
  const grouped = groupBy(items, key);
  return Array.from(grouped.entries()).map(([label, group]) => {
    const rawTok = group.reduce((s, g) => s + g.raw.tokens, 0) / group.length;
    const mcpTok = group.reduce((s, g) => s + g.mcp.tokens, 0) / group.length;
    return {
      label,
      n: group.length,
      rawTok,
      mcpTok,
      deltaPct: rawTok > 0 ? ((mcpTok - rawTok) / rawTok) * 100 : 0,
      rawTools: group.reduce((s, g) => s + g.raw.tools, 0) / group.length,
      mcpTools: group.reduce((s, g) => s + g.mcp.tools, 0) / group.length,
      rawTime: group.reduce((s, g) => s + g.raw.time, 0) / group.length,
      mcpTime: group.reduce((s, g) => s + g.mcp.time, 0) / group.length,
    };
  });
}

// ─── HTML Generation ──────────────────────────────────────────────────────────

function difficultyColor(d: string): string {
  return d === "easy" ? "#22c55e" : d === "medium" ? "#f59e0b" : "#ef4444";
}

function buildHtml(
  stats: PromptStats[],
  rawMeta: RunResult["metadata"],
  mcpMeta: RunResult["metadata"],
  rawFile: string,
  mcpFile: string,
  markdown: string
): string {
  const ids = stats.map((s) => s.id);
  const rawTokens = stats.map((s) => Math.round(s.raw.tokens));
  const mcpTokens = stats.map((s) => Math.round(s.mcp.tokens));
  const rawTimes = stats.map((s) => +s.raw.time.toFixed(1));
  const mcpTimes = stats.map((s) => +s.mcp.time.toFixed(1));
  const rawTools = stats.map((s) => +s.raw.tools.toFixed(1));
  const mcpTools = stats.map((s) => +s.mcp.tools.toFixed(1));
  const diffColors = stats.map((s) => difficultyColor(s.difficulty));

  // Summary totals
  const totalRaw = stats.reduce((s, p) => s + p.raw.tokens * 2, 0); // ×2 for trials
  const totalMcp = stats.reduce((s, p) => s + p.mcp.tokens * 2, 0);
  const totalDelta = totalMcp - totalRaw;
  const totalDeltaPct = totalRaw > 0 ? (totalDelta / totalRaw) * 100 : 0;
  const avgRawTime = stats.reduce((s, p) => s + p.raw.time, 0) / stats.length;
  const avgMcpTime = stats.reduce((s, p) => s + p.mcp.time, 0) / stats.length;
  const avgRawTools = stats.reduce((s, p) => s + p.raw.tools, 0) / stats.length;
  const avgMcpTools = stats.reduce((s, p) => s + p.mcp.tools, 0) / stats.length;

  // Difficulty groups
  const diffGroups = groupStats(stats, (s) => s.difficulty);
  const diffOrder = ["easy", "medium", "hard"];
  const diffSorted = diffOrder.map((d) => diffGroups.find((g) => g.label === d)!).filter(Boolean);

  // Category groups sorted by raw token desc
  const catGroups = groupStats(stats, (s) => s.category).sort(
    (a, b) => b.rawTok - a.rawTok
  );

  // Scatter data: one point per prompt
  const scatterRaw = stats.map((s) => ({ x: Math.round(s.raw.tokens), y: Math.round(s.mcp.tokens) }));
  const scatterColors = diffColors;
  const scatterLabels = stats.map((s) => `#${s.id}: ${s.prompt.slice(0, 40)}`);

  // Parity line range
  const maxTok = Math.max(...rawTokens, ...mcpTokens);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Codex: Raw vs MCP — Experiment Results</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; }
  header { background: #1e293b; padding: 24px 32px; border-bottom: 1px solid #334155; }
  header h1 { font-size: 1.5rem; font-weight: 700; color: #f1f5f9; }
  header p { color: #94a3b8; font-size: 0.85rem; margin-top: 4px; }
  .cards { display: flex; flex-wrap: wrap; gap: 12px; padding: 20px 32px; background: #1e293b; border-bottom: 1px solid #334155; }
  .card { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 12px 18px; min-width: 140px; }
  .card .label { font-size: 0.7rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
  .card .value { font-size: 1.2rem; font-weight: 600; color: #f1f5f9; margin-top: 2px; }
  .card .sub { font-size: 0.75rem; color: #94a3b8; margin-top: 2px; }
  .card.win .value { color: #22c55e; }
  .card.loss .value { color: #ef4444; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 24px 32px; }
  .chart-box { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 20px; }
  .chart-box h2 { font-size: 0.9rem; font-weight: 600; color: #cbd5e1; margin-bottom: 14px; }
  .chart-box.full { grid-column: 1 / -1; }
  canvas { max-height: 320px; }
  .legend { display: flex; gap: 16px; margin-bottom: 8px; font-size: 0.75rem; color: #94a3b8; }
  .legend span { display: flex; align-items: center; gap: 4px; }
  .dot { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
  .md-section { padding: 24px 32px 32px; }
  .md-section h2 { font-size: 0.95rem; font-weight: 600; color: #cbd5e1; margin-bottom: 10px; }
  .md-section p { font-size: 0.8rem; color: #64748b; margin-bottom: 10px; }
  .md-copy-btn { background: #334155; color: #e2e8f0; border: 1px solid #475569; border-radius: 6px; padding: 6px 14px; font-size: 0.8rem; cursor: pointer; margin-bottom: 10px; }
  .md-copy-btn:hover { background: #475569; }
  textarea.md-box { width: 100%; height: 520px; background: #1e293b; color: #e2e8f0; border: 1px solid #334155; border-radius: 8px; padding: 16px; font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace; font-size: 0.78rem; line-height: 1.6; resize: vertical; outline: none; }
  footer { text-align: center; padding: 20px; color: #475569; font-size: 0.8rem; border-top: 1px solid #1e293b; }
</style>
</head>
<body>

<header>
  <h1>Codex — Raw CLI vs MCP · Experiment Results</h1>
  <p>
    Model: <strong>${rawMeta.model}</strong> &nbsp;|&nbsp;
    Codex: <strong>${rawMeta.codex_cli_version ?? "unknown"}</strong> &nbsp;|&nbsp;
    Prompts: <strong>${stats.length}</strong> × 2 trials &nbsp;|&nbsp;
    Raw: <strong>${basename(rawFile)}</strong> &nbsp;|&nbsp;
    MCP: <strong>${basename(mcpFile)}</strong>
  </p>
</header>

<div class="cards">
  <div class="card">
    <div class="label">Total Raw Tokens</div>
    <div class="value">${totalRaw.toLocaleString()}</div>
    <div class="sub">60 trials</div>
  </div>
  <div class="card">
    <div class="label">Total MCP Tokens</div>
    <div class="value">${totalMcp.toLocaleString()}</div>
    <div class="sub">60 trials</div>
  </div>
  <div class="card ${totalDelta < 0 ? "win" : "loss"}">
    <div class="label">Token Delta (MCP−Raw)</div>
    <div class="value">${totalDelta > 0 ? "+" : ""}${totalDelta.toLocaleString()}</div>
    <div class="sub">${totalDeltaPct > 0 ? "+" : ""}${totalDeltaPct.toFixed(1)}%</div>
  </div>
  <div class="card">
    <div class="label">Avg Time Raw</div>
    <div class="value">${avgRawTime.toFixed(1)}s</div>
    <div class="sub">per prompt avg</div>
  </div>
  <div class="card">
    <div class="label">Avg Time MCP</div>
    <div class="value">${avgMcpTime.toFixed(1)}s</div>
    <div class="sub">per prompt avg</div>
  </div>
  <div class="card">
    <div class="label">Avg Tool Calls Raw</div>
    <div class="value">${avgRawTools.toFixed(1)}</div>
  </div>
  <div class="card">
    <div class="label">Avg Tool Calls MCP</div>
    <div class="value">${avgMcpTools.toFixed(1)}</div>
  </div>
</div>

<div class="grid">

  <!-- Chart 1: Token Usage per Prompt -->
  <div class="chart-box full">
    <h2>Token Usage per Prompt — Raw vs MCP (avg across 2 trials)</h2>
    <div class="legend">
      <span><span class="dot" style="background:#3b82f6"></span> Raw</span>
      <span><span class="dot" style="background:#a855f7"></span> MCP</span>
      <span><span class="dot" style="background:#22c55e"></span> Easy</span>
      <span><span class="dot" style="background:#f59e0b"></span> Medium</span>
      <span><span class="dot" style="background:#ef4444"></span> Hard</span>
    </div>
    <canvas id="chart1"></canvas>
  </div>

  <!-- Chart 2: Wall Time per Prompt -->
  <div class="chart-box full">
    <h2>Wall Time per Prompt (seconds) — Raw vs MCP</h2>
    <canvas id="chart2"></canvas>
  </div>

  <!-- Chart 3: Tool Calls per Prompt -->
  <div class="chart-box full">
    <h2>Tool Calls per Prompt — Raw vs MCP</h2>
    <canvas id="chart3"></canvas>
  </div>

  <!-- Chart 4: By Difficulty -->
  <div class="chart-box">
    <h2>Avg Tokens by Difficulty</h2>
    <canvas id="chart4"></canvas>
  </div>

  <!-- Chart 5: By Category -->
  <div class="chart-box">
    <h2>Avg Tokens by Category (sorted by Raw desc)</h2>
    <canvas id="chart5"></canvas>
  </div>

  <!-- Chart 6: Scatter -->
  <div class="chart-box full">
    <h2>Token Parity Scatter — Raw (X) vs MCP (Y) · below diagonal = MCP cheaper</h2>
    <canvas id="chart6" style="max-height:420px"></canvas>
  </div>

</div>

<div class="md-section">
  <h2>Markdown Report — Copy into poster / doc</h2>
  <p>Plain markdown text. Select all and copy, or use the button.</p>
  <button class="md-copy-btn" onclick="copyMd()">Copy all</button>
  <textarea class="md-box" id="mdBox" readonly>${markdown.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</textarea>
</div>

<footer>Generated by compare.ts · ${new Date().toISOString()}</footer>

<script>
function copyMd() {
  const el = document.getElementById('mdBox');
  el.select();
  document.execCommand('copy');
  const btn = document.querySelector('.md-copy-btn');
  btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = 'Copy all', 2000);
}
</script>

<script>
const ids = ${JSON.stringify(ids)};
const labels = ids.map(i => '#' + i);
const rawTokens = ${JSON.stringify(rawTokens)};
const mcpTokens = ${JSON.stringify(mcpTokens)};
const rawTimes  = ${JSON.stringify(rawTimes)};
const mcpTimes  = ${JSON.stringify(mcpTimes)};
const rawTools  = ${JSON.stringify(rawTools)};
const mcpTools  = ${JSON.stringify(mcpTools)};
const diffColors = ${JSON.stringify(diffColors)};

const chartDefaults = {
  animation: false,
  plugins: { legend: { labels: { color: '#94a3b8' } } },
  scales: {
    x: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } },
    y: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } }
  }
};

// Chart 1 — Tokens per prompt
new Chart(document.getElementById('chart1'), {
  type: 'bar',
  data: {
    labels,
    datasets: [
      { label: 'Raw', data: rawTokens, backgroundColor: '#3b82f6aa', borderColor: '#3b82f6', borderWidth: 1 },
      { label: 'MCP', data: mcpTokens, backgroundColor: '#a855f7aa', borderColor: '#a855f7', borderWidth: 1 }
    ]
  },
  options: {
    ...chartDefaults,
    plugins: {
      ...chartDefaults.plugins,
      tooltip: { callbacks: { afterBody: (items) => {
        const i = items[0].dataIndex;
        const delta = mcpTokens[i] - rawTokens[i];
        const pct = rawTokens[i] > 0 ? ((delta/rawTokens[i])*100).toFixed(1) : '0';
        return ['Δ: ' + (delta>0?'+':'') + delta.toLocaleString() + ' (' + (delta>0?'+':'') + pct + '%)'];
      }}}
    },
    scales: {
      x: { ticks: { color: (ctx) => diffColors[ctx.index] ?? '#64748b' }, grid: { color: '#1e293b' } },
      y: { ticks: { color: '#64748b', callback: v => (v/1000).toFixed(0)+'k' }, grid: { color: '#1e293b' } }
    }
  }
});

// Chart 2 — Time per prompt
new Chart(document.getElementById('chart2'), {
  type: 'bar',
  data: {
    labels,
    datasets: [
      { label: 'Raw (s)', data: rawTimes, backgroundColor: '#0ea5e9aa', borderColor: '#0ea5e9', borderWidth: 1 },
      { label: 'MCP (s)', data: mcpTimes, backgroundColor: '#8b5cf6aa', borderColor: '#8b5cf6', borderWidth: 1 }
    ]
  },
  options: { ...chartDefaults }
});

// Chart 3 — Tool calls per prompt
new Chart(document.getElementById('chart3'), {
  type: 'bar',
  data: {
    labels,
    datasets: [
      { label: 'Raw tools', data: rawTools, backgroundColor: '#f97316aa', borderColor: '#f97316', borderWidth: 1 },
      { label: 'MCP tools', data: mcpTools, backgroundColor: '#10b981aa', borderColor: '#10b981', borderWidth: 1 }
    ]
  },
  options: { ...chartDefaults }
});

// Chart 4 — By difficulty
const diffLabels = ${JSON.stringify(diffSorted.map((g) => g.label))};
const diffRawTok = ${JSON.stringify(diffSorted.map((g) => Math.round(g.rawTok)))};
const diffMcpTok = ${JSON.stringify(diffSorted.map((g) => Math.round(g.mcpTok)))};
new Chart(document.getElementById('chart4'), {
  type: 'bar',
  data: {
    labels: diffLabels,
    datasets: [
      { label: 'Raw avg tokens', data: diffRawTok, backgroundColor: '#3b82f6' },
      { label: 'MCP avg tokens', data: diffMcpTok, backgroundColor: '#a855f7' }
    ]
  },
  options: {
    ...chartDefaults,
    plugins: {
      ...chartDefaults.plugins,
      tooltip: { callbacks: { afterBody: (items) => {
        const i = items[0].dataIndex;
        const d = diffMcpTok[i] - diffRawTok[i];
        const pct = ((d/diffRawTok[i])*100).toFixed(1);
        return ['Δ: ' + (d>0?'+':'') + d.toLocaleString() + ' (' + (d>0?'+':'') + pct + '%)'];
      }}}
    }
  }
});

// Chart 5 — By category (horizontal)
const catLabels = ${JSON.stringify(catGroups.map((g) => g.label))};
const catRawTok = ${JSON.stringify(catGroups.map((g) => Math.round(g.rawTok)))};
const catMcpTok = ${JSON.stringify(catGroups.map((g) => Math.round(g.mcpTok)))};
new Chart(document.getElementById('chart5'), {
  type: 'bar',
  data: {
    labels: catLabels,
    datasets: [
      { label: 'Raw avg tokens', data: catRawTok, backgroundColor: '#3b82f6' },
      { label: 'MCP avg tokens', data: catMcpTok, backgroundColor: '#a855f7' }
    ]
  },
  options: {
    ...chartDefaults,
    indexAxis: 'y',
    scales: {
      x: { ticks: { color: '#64748b', callback: v => (v/1000).toFixed(0)+'k' }, grid: { color: '#1e293b' } },
      y: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } }
    }
  }
});

// Chart 6 — Scatter
const scatterData = ${JSON.stringify(scatterRaw)};
const scatterColors = ${JSON.stringify(scatterColors)};
const scatterLabels = ${JSON.stringify(scatterLabels)};
new Chart(document.getElementById('chart6'), {
  type: 'scatter',
  data: {
    datasets: [{
      label: 'Prompts',
      data: scatterData,
      backgroundColor: scatterColors.map(c => c + 'cc'),
      borderColor: scatterColors,
      borderWidth: 1.5,
      pointRadius: 7,
      pointHoverRadius: 9
    }, {
      label: 'Parity (y=x)',
      data: [{x:0,y:0},{x:${maxTok},y:${maxTok}}],
      type: 'line',
      borderColor: '#475569',
      borderDash: [6,4],
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false
    }]
  },
  options: {
    ...chartDefaults,
    plugins: {
      ...chartDefaults.plugins,
      tooltip: {
        callbacks: {
          label: (ctx) => {
            if (ctx.datasetIndex !== 0) return null;
            const i = ctx.dataIndex;
            const d = ctx.parsed.y - ctx.parsed.x;
            const pct = ((d/ctx.parsed.x)*100).toFixed(1);
            return [
              scatterLabels[i],
              'Raw: ' + ctx.parsed.x.toLocaleString(),
              'MCP: ' + ctx.parsed.y.toLocaleString(),
              'Δ: ' + (d>0?'+':'') + d.toLocaleString() + ' (' + (d>0?'+':'') + pct + '%)'
            ];
          }
        }
      }
    },
    scales: {
      x: { title: { display: true, text: 'Raw avg tokens', color: '#64748b' }, ticks: { color: '#64748b', callback: v => (v/1000).toFixed(0)+'k' }, grid: { color: '#1e293b' } },
      y: { title: { display: true, text: 'MCP avg tokens', color: '#64748b' }, ticks: { color: '#64748b', callback: v => (v/1000).toFixed(0)+'k' }, grid: { color: '#1e293b' } }
    }
  }
});
</script>
</body>
</html>`;
}

// ─── Markdown Generation ──────────────────────────────────────────────────────

function pad(s: string, n: number): string {
  // Strip markdown bold/emoji for length calculation so columns align
  const stripped = s.replace(/\*\*/g, "").replace(/[^\x00-\x7F]/g, "  ");
  const pad = n - stripped.length;
  return pad <= 0 ? s : s + " ".repeat(pad);
}

/** Format a Δ% value with bold + emoji indicator */
function fmtDelta(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  const val = `${sign}${pct.toFixed(1)}%`;
  if (pct <= -30) return `🟢 **${val}**`;
  if (pct <= -10) return `🟢 ${val}`;
  if (pct >= 80)  return `🔴 **${val}**`;
  if (pct >= 20)  return `🔴 ${val}`;
  return val;
}

/** Format a token count, bolding the lower of the two */
function fmtTok(val: number, other: number): string {
  const s = Math.round(val).toLocaleString();
  return val < other ? `**${s}**` : s;
}

function buildMarkdown(
  stats: PromptStats[],
  rawMeta: RunResult["metadata"],
  mcpMeta: RunResult["metadata"],
  rawFile: string,
  mcpFile: string
): string {
  const lines: string[] = [];
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  lines.push(`# Codex Experiment — Raw vs MCP Comparison`);
  lines.push(`**Generated:** ${now}  `);
  lines.push(`**Model:** ${rawMeta.model} · **Codex:** ${rawMeta.codex_cli_version ?? "unknown"}  `);
  lines.push(`**Raw file:** \`${basename(rawFile)}\`  `);
  lines.push(`**MCP file:** \`${basename(mcpFile)}\``);
  lines.push(``);

  // ── Table 1: Full comparison matrix ────────────────────────────────────────
  lines.push(`## Table 1 — Full Comparison (30 prompts × avg 2 trials)`);
  lines.push(``);

  const h = ["#", "Prompt", "Diff", "Category", "Raw Tok", "MCP Tok", "Δ Tok", "Δ%", "Raw Tools", "MCP Tools", "Raw s", "MCP s"];
  const cols = [3, 42, 6, 18, 10, 10, 10, 7, 9, 9, 7, 7];

  lines.push("| " + h.map((t, i) => pad(t, cols[i])).join(" | ") + " |");
  lines.push("|" + cols.map((n) => "-".repeat(n + 2)).join("|") + "|");

  for (const s of stats) {
    const delta = Math.round(s.delta.tokens);
    const sign = delta > 0 ? "+" : "";
    const diffLabel = s.difficulty === "easy" ? "easy" : s.difficulty === "medium" ? "medium" : "**hard**";
    const row = [
      String(s.id),
      s.prompt.length > 42 ? s.prompt.slice(0, 39) + "..." : s.prompt,
      diffLabel,
      s.category,
      fmtTok(s.raw.tokens, s.mcp.tokens),
      fmtTok(s.mcp.tokens, s.raw.tokens),
      sign + delta.toLocaleString(),
      fmtDelta(s.delta.pct),
      s.raw.tools.toFixed(1),
      s.mcp.tools.toFixed(1),
      s.raw.time.toFixed(1),
      s.mcp.time.toFixed(1),
    ];
    lines.push("| " + row.map((v, i) => pad(v, cols[i])).join(" | ") + " |");
  }
  lines.push(``);

  // ── Table 2: By Difficulty ──────────────────────────────────────────────────
  lines.push(`## Table 2 — By Difficulty`);
  lines.push(``);

  const diffGroups = groupStats(stats, (s) => s.difficulty);
  const diffOrder = ["easy", "medium", "hard"];
  const diffSorted = diffOrder.map((d) => diffGroups.find((g) => g.label === d)!).filter(Boolean);

  const h2 = ["Difficulty", "N", "Raw Avg Tok", "MCP Avg Tok", "Δ%", "Raw Tools", "MCP Tools", "Raw s", "MCP s"];
  const c2 = [10, 3, 11, 11, 7, 9, 9, 7, 7];
  lines.push("| " + h2.map((t, i) => pad(t, c2[i])).join(" | ") + " |");
  lines.push("|" + c2.map((n) => "-".repeat(n + 2)).join("|") + "|");

  for (const g of diffSorted) {
    const row = [
      g.label === "hard" ? "**hard**" : g.label,
      String(g.n),
      fmtTok(g.rawTok, g.mcpTok),
      fmtTok(g.mcpTok, g.rawTok),
      fmtDelta(g.deltaPct),
      g.rawTools.toFixed(1),
      g.mcpTools.toFixed(1),
      g.rawTime.toFixed(1),
      g.mcpTime.toFixed(1),
    ];
    lines.push("| " + row.map((v, i) => pad(v, c2[i])).join(" | ") + " |");
  }
  lines.push(``);

  // ── Table 3: By Category ────────────────────────────────────────────────────
  lines.push(`## Table 3 — By Category (sorted by Raw Avg Tokens desc)`);
  lines.push(``);

  const catGroups = groupStats(stats, (s) => s.category).sort((a, b) => b.rawTok - a.rawTok);

  const h3 = ["Category", "N", "Raw Avg Tok", "MCP Avg Tok", "Δ%", "Raw Tools", "MCP Tools"];
  const c3 = [18, 3, 11, 11, 7, 9, 9];
  lines.push("| " + h3.map((t, i) => pad(t, c3[i])).join(" | ") + " |");
  lines.push("|" + c3.map((n) => "-".repeat(n + 2)).join("|") + "|");

  for (const g of catGroups) {
    const row = [
      g.label,
      String(g.n),
      fmtTok(g.rawTok, g.mcpTok),
      fmtTok(g.mcpTok, g.rawTok),
      fmtDelta(g.deltaPct),
      g.rawTools.toFixed(1),
      g.mcpTools.toFixed(1),
    ];
    lines.push("| " + row.map((v, i) => pad(v, c3[i])).join(" | ") + " |");
  }
  lines.push(``);

  // ── Key Findings ─────────────────────────────────────────────────────────────
  lines.push(`## Key Findings`);
  lines.push(``);

  const sorted = [...stats].sort((a, b) => a.delta.tokens - b.delta.tokens);
  const top3wins = sorted.slice(0, 3);
  const top3losses = sorted.slice(-3).reverse();

  const totalRaw = stats.reduce((s, p) => s + p.raw.tokens * 2, 0);
  const totalMcp = stats.reduce((s, p) => s + p.mcp.tokens * 2, 0);
  const overallDelta = totalMcp - totalRaw;
  const overallPct = ((overallDelta / totalRaw) * 100).toFixed(1);

  const bestCat = catGroups.reduce((a, b) => (a.deltaPct < b.deltaPct ? a : b));
  const worstCat = catGroups.reduce((a, b) => (a.deltaPct > b.deltaPct ? a : b));

  const avgRawTime = stats.reduce((s, p) => s + p.raw.time, 0) / stats.length;
  const avgMcpTime = stats.reduce((s, p) => s + p.mcp.time, 0) / stats.length;
  const timeDelta = ((avgMcpTime - avgRawTime) / avgRawTime * 100).toFixed(1);

  lines.push(`### Token Usage`);
  lines.push(`- **Overall:** MCP used ${overallDelta > 0 ? "+" : ""}${overallDelta.toLocaleString()} tokens vs Raw across all 60 trials (${overallDelta > 0 ? "+" : ""}${overallPct}%).`);
  lines.push(``);
  lines.push(`### Top 3 Prompts Where MCP Saved Most Tokens`);
  for (const s of top3wins) {
    lines.push(`- **#${s.id}** "${s.prompt.slice(0, 55)}" — MCP saved ${Math.abs(Math.round(s.delta.tokens)).toLocaleString()} tokens (${s.delta.pct.toFixed(1)}%)`);
  }
  lines.push(``);
  lines.push(`### Top 3 Prompts Where MCP Cost Most Extra Tokens`);
  for (const s of top3losses) {
    lines.push(`- **#${s.id}** "${s.prompt.slice(0, 55)}" — MCP used +${Math.round(s.delta.tokens).toLocaleString()} more tokens (+${s.delta.pct.toFixed(1)}%)`);
  }
  lines.push(``);
  lines.push(`### Category Insights`);
  lines.push(`- **Best category for MCP:** \`${bestCat.label}\` — ${bestCat.deltaPct.toFixed(1)}% token delta vs raw (n=${bestCat.n})`);
  lines.push(`- **Worst category for MCP:** \`${worstCat.label}\` — +${worstCat.deltaPct.toFixed(1)}% more tokens than raw (n=${worstCat.n})`);
  lines.push(``);
  lines.push(`### Speed`);
  lines.push(`- Raw avg: ${avgRawTime.toFixed(1)}s/prompt · MCP avg: ${avgMcpTime.toFixed(1)}s/prompt (${Number(timeDelta) > 0 ? "+" : ""}${timeDelta}%)`);

  return lines.join("\n") + "\n";
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const getArg = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };

  const rawPath = getArg("--raw")
    ? resolve(SCRIPT_DIR, getArg("--raw")!)
    : latestFile("codex-raw");

  const mcpPath = getArg("--mcp")
    ? resolve(SCRIPT_DIR, getArg("--mcp")!)
    : latestFile("codex-mcp");

  console.log(`Raw: ${rawPath}`);
  console.log(`MCP: ${mcpPath}`);

  const rawResult: RunResult = JSON.parse(readFileSync(rawPath, "utf-8"));
  const mcpResult: RunResult = JSON.parse(readFileSync(mcpPath, "utf-8"));

  const stats = buildStats(rawResult, mcpResult);

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const htmlPath = join(RESULTS_DIR, `compare-${ts}.html`);
  const mdPath   = join(RESULTS_DIR, `compare-${ts}.md`);

  const md = buildMarkdown(stats, rawResult.metadata, mcpResult.metadata, rawPath, mcpPath);
  writeFileSync(htmlPath, buildHtml(stats, rawResult.metadata, mcpResult.metadata, rawPath, mcpPath, md));
  writeFileSync(mdPath, md);

  console.log(`\nHTML: ${htmlPath}`);
  console.log(`MD:   ${mdPath}`);
}

main();
