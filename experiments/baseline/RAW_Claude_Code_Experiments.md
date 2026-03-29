# Baseline Experiment Results — Raw CLI Mode

## Experiment Metadata

| Field | Value |
|-------|-------|
| **Date** | 2026-03-29 |
| **Model** | Claude Sonnet (via Claude Code CLI) |
| **CLI Version** | 2.1.85 |
| **Mode** | Raw (Bash tool only) |
| **Trials per prompt** | 3 |
| **Total prompts** | 10 (3 easy, 4 medium, 3 hard) |
| **Total API calls** | 30 |
| **Total tokens** | 1,491,955 |
| **Total cost** | $1.73 |
| **Total wall time** | 696.7s (~11.6 min) |
| **Infrastructure** | 75 null_resources across 6 modules |

---

## Summary Table

| # | Prompt | Difficulty | Mean Score | Avg Tokens | Avg Tools | Avg Time(s) | Avg Cost |
|---|--------|-----------|------------|------------|-----------|-------------|----------|
| 1 | VPC CIDR block | easy | **1.00** | 30,401 | 2 | 8.4 | $0.022 |
| 2 | List subnets + AZs | easy | **0.67** | 33,475 | 2 | 16.3 | $0.041 |
| 3 | Direct VPC dependents | medium | **0.00** | 47,628 | 3 | 15.9 | $0.039 |
| 4 | DB subnet group impact | hard | **1.00** | 76,203 | 6 | 24.3 | $0.055 |
| 5 | SG rules from 0.0.0.0/0 | medium | **1.00** | 48,191 | 3 | 20.3 | $0.061 |
| 6 | ALB-to-RDS dependency chain | hard | **0.83** | 75,563 | 6 | 62.0 | $0.125 |
| 7 | Web tier deployment order | medium | **1.00** | 44,691 | 4 | 26.0 | $0.054 |
| 8 | Compute module inputs | medium | **1.00** | 36,401 | 2 | 12.1 | $0.034 |
| 9 | Total resource count | easy | **0.83** | 20,779 | 1 | 7.7 | $0.020 |
| 10 | New microservice resources | hard | **1.00** | 83,984 | 6 | 39.3 | $0.126 |

---

## Accuracy by Difficulty

| Difficulty | Mean Score | Avg Tokens | Avg Tool Calls | Avg Time(s) | Avg Cost | Tokens/Correct Answer |
|------------|-----------|------------|----------------|-------------|----------|----------------------|
| **Easy** | 0.83 | 28,219 | 2 | 10.8 | $0.028 | 28,157 |
| **Medium** | 0.75 | 44,228 | 3 | 18.6 | $0.047 | 43,094 |
| **Hard** | 0.94 | 78,584 | 6 | 41.9 | $0.102 | 83,164 |
| **Overall** | **0.83** | **49,732** | **3.5** | **23.2** | **$0.058** | — |

---

## Key Findings

### 1. Token Cost Scales 3x from Easy to Hard

The most striking pattern: hard prompts consume **~79K tokens** (avg) vs **~28K** for easy — a **2.8x increase**. This maps directly to the Project 42 thesis: complex infrastructure questions force iterative state exploration that floods the context window.

- **Easy prompts** (1-2 tool calls): Claude targets a specific resource with `state show`, gets the answer in one shot
- **Medium prompts** (2-4 tool calls): Require cross-referencing multiple resources or using `terraform graph`
- **Hard prompts** (4-10 tool calls): Force multi-hop exploration — Claude must chain `state list` → `graph` → `state show` across modules, accumulating massive context

### 2. Accuracy Does NOT Degrade on Hard Prompts (Counter to Hypothesis)

The initial hypothesis predicted easy: 80-100%, medium: 50-75%, hard: 10-30%. Actual results:

| | Predicted | Actual |
|---|-----------|--------|
| Easy | 80-100% | 83% |
| Medium | 50-75% | 75% |
| Hard | 10-30% | **94%** |

Hard prompts scored *higher* than medium. This suggests Claude Sonnet (4.5) is surprisingly capable at multi-hop reasoning even with raw CLI tools — but at enormous token cost. The problem is not accuracy degradation; it's **cost and latency explosion**.

### 3. The Real Problem: Cost Efficiency

| Metric | Easy | Medium | Hard | Hard/Easy Ratio |
|--------|------|--------|------|-----------------|
| Cost per prompt | $0.028 | $0.047 | $0.102 | **3.6x** |
| Time per prompt | 10.8s | 18.6s | 41.9s | **3.9x** |
| Tool calls | 2 | 3 | 6 | **3x** |
| Tool output (chars) | 4,849 | 8,688 | 33,576 | **6.9x** |

Hard prompts produce **7x more tool output** than easy prompts. This raw data floods context and drives cost. MCP tools that pre-filter and summarize should collapse this ratio significantly.

### 4. Prompt 3 (Direct VPC Dependents) Was the Hardest

Despite being categorized as "medium", prompt 3 scored 0.00 across all 3 trials. Claude consistently:
- Found the correct **count** (12 resources)
- Identified the correct **resource types** (subnets, IGW, route tables)
- But listed resources using **grouped notation** ("public_subnet_1/2/3") that the scorer couldn't fully match
- Also included **cross-module dependents** (sg_alb, target groups) not in the ground truth

This reveals a scorer limitation: set-overlap scoring struggles with grouped references. It also shows the ambiguity of "directly depends on" — Claude interpreted this more broadly than the ground truth defined.

### 5. `terraform graph` Was Critical for Dependency Questions

Claude's tool strategy varied by question type:
- **Attribute lookups**: `state list` + `state show <resource>` (2 calls)
- **Enumeration**: `state list | grep` + loop over `state show` (2-3 calls)
- **Dependency/impact**: `terraform graph | grep` + `state show` for verification (4-6 calls)
- **Planning**: `cat modules/*.tf` + `state list` for existing patterns (4-9 calls)

The `terraform graph` command was the primary tool for dependency questions, producing DOT-format output that Claude parsed to trace edges.

### 6. Context Growth Pattern

Tool output volume grows non-linearly with complexity:
- Easy: ~5K chars of tool output per prompt
- Medium: ~9K chars
- Hard: ~34K chars (with prompt 10 hitting **68K chars**)

Prompt 6 (ALB-to-RDS chain) was the most expensive at $0.125 avg, with trial 2 consuming **98K tokens** across 10 tool calls. This is the "context overflow" scenario where an MCP server providing `get_dependency_chain` in a single call would be transformative.

---

## Tool Usage Patterns

### Most Common Terraform Commands

| Command | Count (across all trials) | Used For |
|---------|--------------------------|----------|
| `state list` | 25 | Initial resource discovery, filtering with grep |
| `state show` | 18 | Detailed resource inspection |
| `graph` | 11 | Dependency chain tracing |
| `show -json` | 4 | Full state dump (expensive!) |

### File Access

Claude accessed `.tf` source files primarily for planning prompts (prompt 10), reading module configurations to understand the existing resource patterns before suggesting additions.

---

## Comparison to Hypothesis

| Prediction | Result | Analysis |
|-----------|--------|----------|
| Easy accuracy 80-100% | **83%** | Confirmed. Simple lookups are reliable. |
| Medium accuracy 50-75% | **75%** | Confirmed. Set-based queries have partial failures. |
| Hard accuracy 10-30% | **94%** | **Not confirmed.** Claude handles hard prompts well but at high cost. |
| Token escalation on hard | **2.8x vs easy** | Confirmed. Hard prompts burn 3x tokens. |
| Tool call escalation on hard | **3x vs easy** | Confirmed. Hard prompts need 3x tool calls. |

**Revised thesis:** The problem with raw CLI is not accuracy degradation — it's **cost, latency, and context inefficiency**. A 75-resource project already costs $0.10+ per complex query. At real-world scale (500+ resources), context overflow would force truncation and *then* accuracy would degrade.

---

## What MCP Tools Should Target

Based on these results, the highest-value MCP tools are:

1. **`get_dependency_chain(from, to)`** — Would collapse prompt 6 from 6 tool calls / 75K tokens to 1 call / ~5K tokens
2. **`get_dependents(resource)`** — Would collapse prompt 3 from 3 calls to 1, with pre-filtered results
3. **`list_resources(type, module)`** — Would eliminate the `state list | grep` + loop pattern
4. **`get_resource_config(id)`** — Filtered single-resource view vs raw `state show`

These four tools would target the exact patterns where raw CLI forces iterative context accumulation.

---

## Charts

See `results/charts/index.html` for interactive visualizations:
1. Accuracy by Difficulty (bar chart)
2. Token Usage by Prompt (stacked bar)
3. Tool Calls vs Accuracy (bubble chart)
4. Token Efficiency by Prompt (bar chart)
5. Context Growth by Difficulty (line chart)
6. Terraform Command Distribution (grouped bar)
