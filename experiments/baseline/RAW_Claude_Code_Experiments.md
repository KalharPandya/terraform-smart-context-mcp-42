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

## Per-Trial Raw Data

### Prompt 1: What is the CIDR block of the VPC? (easy, attribute-lookup)

| Trial | Score | Tokens In | Tokens Out | Cost | Tool Calls | Time (ms) | Output Chars | Turns |
|-------|-------|-----------|------------|------|------------|-----------|-------------|-------|
| 1 | **1.0** | 30,055 | 321 | $0.0313 | 2 | 8,517 | 2,318 | 3 |
| 2 | **1.0** | 30,086 | 361 | $0.0181 | 2 | 7,905 | 2,318 | 3 |
| 3 | **1.0** | 30,043 | 339 | $0.0177 | 2 | 8,646 | 2,318 | 3 |

**Tool calls (consistent across trials):**
1. `terraform state list | grep -i vpc` → 35 chars (found: `module.networking.null_resource.vpc`)
2. `terraform state show module.networking.null_resource.vpc` → 2,283 chars (full resource state)

**Scoring:** substring-match for "10.0.0.0/16" — Found 1/1 in all trials.

---

### Prompt 2: List all subnets and their availability zones. (easy, enumeration)

| Trial | Score | Tokens In | Tokens Out | Cost | Tool Calls | Time (ms) | Output Chars | Turns |
|-------|-------|-----------|------------|------|------------|-----------|-------------|-------|
| 1 | **1.0** | 31,142 | 939 | $0.0435 | 2 | 16,109 | 4,214 | 3 |
| 2 | **0.0** | 35,087 | 1,056 | $0.0468 | 2 | 15,837 | 17,937 | 3 |
| 3 | **1.0** | 31,134 | 1,069 | $0.0321 | 2 | 16,971 | 4,207 | 3 |

**Tool calls:**
1. `terraform state list | grep -i subnet` → 479 chars (found 10 subnet resources)
2. Loop over `terraform state show` for each subnet → 3,735-17,458 chars

**Scoring:** set-overlap for 8 subnets+AZs. Trial 2 scored 0.0 because Claude used display names (`project42-prod-public-1`) instead of resource names (`public_subnet_1`) and the AZs were `us-east-1a` in the answer (matched in T1/T3 via AZ short-code mapping `use1-az1` but T2 used display names without resource names).

**Note:** Trial 2 pulled 17,937 chars of tool output (4x more than T1/T3) because it dumped full `state show` output per subnet instead of using grep to filter.

---

### Prompt 3: What resources directly depend on the VPC? (medium, dependency-direct)

| Trial | Score | Tokens In | Tokens Out | Cost | Tool Calls | Time (ms) | Output Chars | Turns |
|-------|-------|-----------|------------|------|------------|-----------|-------------|-------|
| 1 | **0.0** | 54,685 | 858 | $0.0516 | 4 | 18,451 | 5,380 | 5 |
| 2 | **0.0** | 42,981 | 680 | $0.0303 | 3 | 15,872 | 5,332 | 4 |
| 3 | **0.0** | 42,971 | 709 | $0.0337 | 3 | 13,396 | 5,332 | 4 |

**Tool calls (T1):**
1. `terraform state list | head -50` → 2,346 chars
2. `terraform state list | tail -40` → 1,797 chars
3. `terraform show -json | python3 -c ...` → 48 chars (failed to parse)
4. `terraform graph | grep vpc` → 1,189 chars (DOT edges involving VPC)

**Scoring:** set-overlap for 12 expected resources. Matched 4/12 (33%) consistently. Claude used grouped notation (`public_subnet_1/2/3`) which the scorer couldn't expand, and listed cross-module dependents (sg_alb, target_group_web, target_group_app) not in the ground truth.

**Analysis:** This was the hardest prompt by score despite being "medium" difficulty. The ambiguity of "directly depends on" is the root cause — Claude interpreted cross-module references as dependencies, while the ground truth only counted resources within the networking module's dependency graph.

---

### Prompt 4: If I destroy the DB subnet group, what resources are affected? (hard, impact-analysis)

| Trial | Score | Tokens In | Tokens Out | Cost | Tool Calls | Time (ms) | Output Chars | Turns |
|-------|-------|-----------|------------|------|------------|-----------|-------------|-------|
| 1 | **1.0** | 51,474 | 891 | $0.0487 | 4 | 18,308 | 2,797 | 5 |
| 2 | **1.0** | 74,794 | 1,220 | $0.0510 | 6 | 26,907 | 3,113 | 7 |
| 3 | **1.0** | 98,778 | 1,453 | $0.0652 | 8 | 27,598 | 3,395 | 9 |

**Tool calls (T1 — most efficient):**
1. `terraform state list | grep -i subnet_group` → 100 chars
2. `terraform graph | grep -i "subnet_group"` → 958 chars
3. `terraform graph | grep rds_primary` → 766 chars
4. `terraform graph | grep rds_replica|secrets_manager_version|cw_dashboard` → 973 chars

**Scoring:** set-overlap for [rds_primary, rds_replica, secrets_manager_version]. 3/3 matched in all trials.

**Note:** Despite perfect scores, T3 used 8 tool calls and 98K tokens — 2x the tokens of T1 with the same result. This illustrates the non-deterministic cost variability of raw CLI exploration.

---

### Prompt 5: List all security group rules that allow inbound traffic from 0.0.0.0/0. (medium, security-filter)

| Trial | Score | Tokens In | Tokens Out | Cost | Tool Calls | Time (ms) | Output Chars | Turns |
|-------|-------|-----------|------------|------|------------|-----------|-------------|-------|
| 1 | **1.0** | 47,033 | 1,234 | $0.0700 | 3 | 20,722 | 19,571 | 4 |
| 2 | **1.0** | 47,053 | 1,216 | $0.0612 | 3 | 19,927 | 19,564 | 4 |
| 3 | **1.0** | 47,038 | 1,000 | $0.0531 | 3 | 20,104 | 19,571 | 4 |

**Tool calls (consistent):**
1. `terraform state list | grep -i security_group` → 0 chars (no match — SG resources are under different names)
2. `terraform state list` → 3,443 chars (full list)
3. Loop over `terraform state show` for each SG → ~16,128 chars

**Scoring:** set-overlap for [sg_alb: port 443 (HTTPS), sg_rule_alb: port 80 (HTTP)]. Multi-part matching found both.

**Note:** ~19K chars of tool output per trial — Claude dumped the full state of all SG resources to find the two with `0.0.0.0/0`. An MCP tool with filtering would reduce this to ~500 chars.

---

### Prompt 6: Trace the full dependency chain from the ALB HTTPS listener to the RDS primary database. (hard, dependency-chain)

| Trial | Score | Tokens In | Tokens Out | Cost | Tool Calls | Time (ms) | Output Chars | Turns |
|-------|-------|-----------|------------|------|------------|-----------|-------------|-------|
| 1 | **0.5** | 37,742 | 4,196 | $0.1138 | 2 | 65,637 | 22,309 | 3 |
| 2 | **1.0** | 94,154 | 3,969 | $0.1504 | 10 | 61,484 | 48,475 | 11 |
| 3 | **1.0** | 82,849 | 3,780 | $0.1109 | 5 | 58,978 | 16,781 | 6 |

**This was the most expensive prompt.** Trial 2 consumed 94K input tokens, 10 tool calls, and produced 48K chars of tool output.

**Tool calls (T2 — 10 calls):**
1. `ls && terraform state list | head -80` → 3,531 chars
2. `terraform state show -json listener_https | python3 -m json.tool` → 0 chars (failed)
3. `terraform state show -json rds_primary | python3 -m json.tool` → 0 chars (failed)
4. `find modules -name "*.tf" | sort` → 0 chars (failed)
5. `terraform state show listener_https` → 1,901 chars
6. `find modules -name "*.tf" | sort && ls modules/` → 579 chars
7. `cat modules/loadbalancer/main.tf` → 15,619 chars
8. `cat modules/database/main.tf` → 17,103 chars
9. `cat main.tf && cat modules/loadbalancer/variables.tf && cat modules/security/main.tf | grep -A 5 "sg"` → 6,504 chars
10. `cat modules/networking/main.tf | grep -E "resource|null_resource|vpc|subnet|depends" | head -50` → 3,238 chars

**Scoring:** topological-validation with 7 required nodes and 6 precedence rules.
- T1: All 7 nodes found but only 3/6 precedence satisfied (raw: 0.75 → score 0.5). Violations: listener_https before alb, sg_web before sg_app, sg_db before rds_primary.
- T2: 7/7 nodes, 5/6 precedence (raw: 0.92 → score 1.0). Only violation: sg_db before rds_primary.
- T3: 7/7 nodes, 4/6 precedence (raw: 0.83 → score 1.0). Violations: listener_https before alb, sg_db before rds_primary.

**Analysis:** Claude found all the right nodes every time but struggled with ordering in the answer text. The chain goes: listener_https → alb → sg_alb → sg_web → sg_app → sg_db → rds_primary. This is exactly the kind of query where `get_dependency_chain(from, to)` would shine.

---

### Prompt 7: What is the correct deployment order for the web tier resources? (medium, deployment-order)

| Trial | Score | Tokens In | Tokens Out | Cost | Tool Calls | Time (ms) | Output Chars | Turns |
|-------|-------|-----------|------------|------|------------|-----------|-------------|-------|
| 1 | **1.0** | 30,939 | 1,729 | $0.0544 | 2 | 23,138 | 4,127 | 3 |
| 2 | **1.0** | 66,608 | 2,151 | $0.0640 | 7 | 32,211 | 7,057 | 8 |
| 3 | **1.0** | 30,936 | 1,711 | $0.0421 | 2 | 22,799 | 4,127 | 3 |

**Tool calls (T1/T3 — efficient):**
1. `terraform state list | grep -i web` → 633 chars
2. `terraform graph | grep -E web` → 3,494 chars

**Scoring:** topological-validation with 8 required nodes and 7 precedence rules. All 3 trials found 8/8 nodes and satisfied 6/7 precedence (raw: 0.93 → score 1.0). Consistent violation: key_pair should precede launch_template_web (Claude listed key_pair but in a separate prerequisites section).

**Note:** T2 used 7 tool calls (vs 2 for T1/T3) and 66K tokens (vs 31K). Same result. This is the cost variability problem.

---

### Prompt 8: Which module outputs does the compute module consume? (medium, cross-module)

| Trial | Score | Tokens In | Tokens Out | Cost | Tool Calls | Time (ms) | Output Chars | Turns |
|-------|-------|-----------|------------|------|------------|-----------|-------------|-------|
| 1 | **1.0** | 40,597 | 719 | $0.0414 | 3 | 11,714 | 2,957 | 4 |
| 2 | **1.0** | 33,269 | 665 | $0.0295 | 2 | 11,396 | 5,617 | 3 |
| 3 | **1.0** | 33,273 | 679 | $0.0297 | 2 | 13,123 | 5,617 | 3 |

**Tool calls (T2/T3):**
1. `find ... -name "*.tf"` → 2,807 chars (found all .tf files)
2. `cat main.tf` → 2,810 chars (read root module to see compute module inputs)

**Scoring:** set-overlap for 9 expected outputs. 9/9 matched in all trials.

**Analysis:** This prompt was efficiently solved by reading `main.tf` which wires all module inputs. Claude correctly identified all 9 module outputs from networking and security that the compute module consumes.

---

### Prompt 9: How many resources are there in total? Break down the count by module. (easy, inventory)

| Trial | Score | Tokens In | Tokens Out | Cost | Tool Calls | Time (ms) | Output Chars | Turns |
|-------|-------|-----------|------------|------|------------|-----------|-------------|-------|
| 1 | **1.0** | 20,453 | 275 | $0.0278 | 1 | 7,897 | 3,443 | 2 |
| 2 | **1.0** | 20,457 | 425 | $0.0167 | 1 | 8,838 | 3,443 | 2 |
| 3 | **0.5** | 20,451 | 275 | $0.0144 | 1 | 6,235 | 3,443 | 2 |

**Tool calls (consistent):**
1. `terraform state list` → 3,443 chars (full resource list, counted per module)

**Scoring:** checklist for "75 total" + 6 module breakdowns.
- T1: 7/7 matched (full score)
- T2: 7/7 matched (full score)
- T3: 5/7 matched (partial score 0.5) — missing "75 total" and "networking: 15". Claude said "74 resources" instead of 75.

**Analysis:** T3 miscounted — Claude said 74 instead of 75. This is a counting error on a simple task, showing that even easy prompts have non-zero failure rates with raw CLI output.

---

### Prompt 10: What Terraform resources would I need to add to deploy a new microservice behind the existing ALB? (hard, planning)

| Trial | Score | Tokens In | Tokens Out | Cost | Tool Calls | Time (ms) | Output Chars | Turns |
|-------|-------|-----------|------------|------|------------|-----------|-------------|-------|
| 1 | **1.0** | 69,669 | 1,822 | $0.1186 | 5 | 32,943 | 47,320 | 6 |
| 2 | **1.0** | 96,344 | 2,991 | $0.1260 | 9 | 47,258 | 93,339 | 10 |
| 3 | **1.0** | 79,072 | 2,055 | $0.1338 | 4 | 37,770 | 64,654 | 5 |

**Tool calls (T1):**
1. `find . -name "*.tf"` → 699 chars
2. `cat modules/loadbalancer/main.tf` → 15,619 chars
3. `cat modules/compute/main.tf` → 25,413 chars
4. `cat modules/security/main.tf | grep -A5 "resource|sg_|ingress|egress|port" | head -100` → 4,557 chars
5. `cat modules/loadbalancer/variables.tf && cat modules/compute/variables.tf | head -60` → 1,032 chars

**Scoring:** checklist for 8 resource types. 8/8 matched in all trials.

**Analysis:** This was the most context-heavy prompt. T2 consumed **93K chars of tool output** (reading multiple full module files). Claude read the existing infrastructure patterns from .tf source files to infer what a new microservice would need. An MCP `explain_resource_pattern` tool could provide this as a structured template.

---

## Tool Usage Summary

### Terraform Commands Across All 30 Trials

| Command | Total Uses | Avg Output Size | Primary Use Case |
|---------|-----------|-----------------|------------------|
| `state list` | 25 | 3,443 chars | Resource discovery, grep filtering |
| `state show <resource>` | 18 | 2,000-16,000 chars | Detailed resource inspection |
| `graph` | 11 | 1,000-3,500 chars | Dependency chain tracing (DOT format) |
| `show -json` | 4 | 4,500-19,000 chars | Full state dump (most expensive) |

### File Access Across All 30 Trials

| File | Times Read | By Prompts | Purpose |
|------|-----------|------------|---------|
| `main.tf` | 6 | P6, P8, P10 | Module wiring, input/output mapping |
| `modules/compute/main.tf` | 4 | P10 | Existing compute resource patterns |
| `modules/loadbalancer/main.tf` | 4 | P6, P10 | ALB, listener, target group patterns |
| `modules/security/main.tf` | 3 | P6, P10 | Security group patterns |
| `modules/database/main.tf` | 2 | P6 | RDS, ElastiCache patterns |
| `modules/networking/main.tf` | 1 | P6 | VPC, subnet structure |

### Strategy by Prompt Category

| Category | Strategy | Avg Tool Calls | Avg Tokens |
|----------|----------|---------------|------------|
| attribute-lookup | `state list` → `state show` | 2 | 30K |
| enumeration | `state list | grep` → loop `state show` | 2 | 33K |
| inventory | `state list` (count manually) | 1 | 21K |
| dependency-direct | `state list` → `terraform graph | grep` | 3 | 48K |
| security-filter | `state list` → loop `state show` (dump all SGs) | 3 | 48K |
| deployment-order | `state list | grep` → `terraform graph | grep` | 2-7 | 45K |
| cross-module | `find *.tf` → `cat main.tf` | 2-3 | 36K |
| impact-analysis | `state list | grep` → recursive `terraform graph | grep` | 4-8 | 76K |
| dependency-chain | `state list` → `terraform show -json` / `cat *.tf` | 2-10 | 76K |
| planning | `find *.tf` → `cat modules/*.tf` | 4-9 | 84K |

---

## Token Breakdown by Component

| Component | Total Tokens | % of Total | Notes |
|-----------|-------------|-----------|-------|
| Input tokens | 1,460,877 | 97.9% | System prompt + accumulated context |
| Output tokens | 31,078 | 2.1% | Claude's responses + tool call requests |
| **Total** | **1,491,955** | **100%** | |

The 97.9% input ratio shows the context accumulation problem: as Claude makes more tool calls, the accumulated conversation history (with all prior tool outputs) gets re-sent with each API call. This is the core inefficiency that MCP tools can address by returning pre-filtered, smaller responses.

---

## Variance Analysis

| Prompt | Score Variance | Token Variance | Cost Variance | Notes |
|--------|---------------|----------------|---------------|-------|
| 1 | 0.0 (all 1.0) | ±21 | ±$0.008 | Very consistent |
| 2 | 0.33 (1.0, 0.0, 1.0) | ±2,204 | ±$0.007 | T2 used display names |
| 3 | 0.0 (all 0.0) | ±6,747 | ±$0.011 | Consistent failure |
| 4 | 0.0 (all 1.0) | ±23,652 | ±$0.008 | Same answer, 2x token range |
| 5 | 0.0 (all 1.0) | ±10 | ±$0.008 | Very consistent |
| 6 | 0.25 (0.5, 1.0, 1.0) | ±28,206 | ±$0.018 | Highest variance |
| 7 | 0.0 (all 1.0) | ±20,548 | ±$0.011 | T2 used 3.5x more tokens |
| 8 | 0.0 (all 1.0) | ±4,224 | ±$0.007 | Consistent |
| 9 | 0.25 (1.0, 1.0, 0.5) | ±3 | ±$0.007 | T3 miscounted |
| 10 | 0.0 (all 1.0) | ±13,338 | ±$0.008 | High token variance |

**Key insight:** Score variance is low (most prompts score consistently) but **token variance is very high** — Claude may use 2-3x more tokens on one trial than another for the same prompt with the same result. This non-deterministic cost is problematic for production use.

---

## Charts

See `results/charts/index.html` for interactive visualizations:
1. Accuracy by Difficulty (bar chart)
2. Token Usage by Prompt (stacked bar)
3. Tool Calls vs Accuracy (bubble chart)
4. Token Efficiency by Prompt (bar chart)
5. Context Growth by Difficulty (line chart)
6. Terraform Command Distribution (grouped bar)

---

## Raw Data Files

| File | Description |
|------|-------------|
| `results/baseline-2026-03-29T05-03-30.json` | Raw runner output with all 30 trial results, tool call details, and metrics |
| `results/scored-2026-03-29T05-05-02.json` | Scored results with per-trial scores and score details |
| `results/summary-2026-03-29T05-05-02.md` | Auto-generated scorer summary tables |
| `results/charts/index.html` | Interactive Chart.js dashboard |
