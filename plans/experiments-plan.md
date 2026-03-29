# Plan: Baseline Experiment — Proving the Problem Exists

## Context

Project 42 claims raw Terraform state overflows LLM context windows and kills accuracy. We have no data proving this. Before building DAG tools, we need a measurable "before" baseline showing how Claude performs with only raw CLI tools against a realistically complex Terraform project. This baseline feeds directly into GOAL.md's Experiment 1 and shares infrastructure with Experiments 2 and 3.

---

## What We're Building

1. **A 75-resource dummy Terraform project** (null_resource only, no real cloud) that simulates a 3-tier AWS deployment with realistic dependency chains
2. **10 task prompts** with ground truth answers (3 easy, 4 medium, 3 hard)
3. **An experiment runner** (TypeScript, Anthropic SDK) that sends prompts to Claude with raw CLI tools and captures token usage, tool calls, accuracy, and wall time
4. **A scorer** that evaluates answers against ground truth and produces summary tables

---

## Directory Structure

```
experiments/baseline/
├── README.md
├── prompts.json              # 10 prompts + ground truth
├── runner.ts                 # Claude Code CLI headless runner
├── scorer.ts                 # Automated scoring
├── RAW_Claude_Code_Experiments.md  # Research findings + run summary
├── results/                  # Output (gitignored except .gitkeep)
│   ├── raw_YYYYMMDD_HHMMSS.json    # Per-run raw metrics
│   └── summary_YYYYMMDD.md         # Scored summary table
└── dummy-infra/
    ├── providers.tf
    ├── variables.tf
    ├── main.tf               # Wires all modules
    ├── outputs.tf
    ├── terraform.tfvars
    └── modules/
        ├── networking/       # 15 resources: VPC, subnets, IGW, NAT, routes
        ├── security/         # 14 resources: SGs (chained), IAM roles/policies
        ├── compute/          # 16 resources: instances, ASGs, scaling, bastion
        ├── database/         # 10 resources: RDS, ElastiCache, secrets
        ├── loadbalancer/     # 10 resources: ALB, TGs, listeners, rules
        └── monitoring/       # 10 resources: SNS, CloudWatch alarms, dashboard

Note: Each experiment trial also creates a temp dir (OS tmpdir) with only .tf files copied
in — no README, no prompts.json — then deletes it after all trials for that prompt finish.
```

---

## Dummy Infrastructure Design (75 resources)

Each "resource" is a `null_resource` with `triggers` holding simulated attributes (IPs, ARNs, CIDRs). Dependencies created via trigger attribute references (`null_resource.vpc.triggers.vpc_id`) which produce real Terraform graph edges.

**Key dependency chains:**
- VPC -> subnets (8) -> route tables (3) -> NAT/IGW
- Security group chain: sg_alb -> sg_web -> sg_app -> sg_db (4-hop)
- Cross-module: compute refs networking (subnets) + security (SGs); loadbalancer refs compute (instances) + security (sg_alb); monitoring refs everything

**Target state size:** 4000-6000 lines from `terraform show -json` — enough to overflow useful context.

**Module resource counts:** networking=15, security=14, compute=16, database=10, loadbalancer=10, monitoring=10

---

## 10 Task Prompts

| # | Prompt | Difficulty | Category |
|---|--------|-----------|----------|
| 1 | What is the CIDR block of the VPC? | Easy | attribute-lookup |
| 2 | List all subnets and their AZs | Easy | enumeration |
| 3 | What resources directly depend on the VPC? | Medium | dependency-direct |
| 4 | If I destroy the DB subnet group, what's affected? | Hard | impact-analysis |
| 5 | List SG rules allowing inbound from 0.0.0.0/0 | Medium | security-filter |
| 6 | Trace the dependency chain from ALB HTTPS listener to DB primary | Hard | dependency-chain |
| 7 | What's the deployment order for the web tier? | Medium | deployment-order |
| 8 | Which module outputs does compute consume? | Medium | cross-module |
| 9 | How many resources total? Break down by module | Easy | inventory |
| 10 | What do I need to add a new microservice behind the ALB? | Hard | planning |

---

## Experiment Runner

- Uses **Claude Code CLI headless mode** (`claude -p`) — not the Anthropic SDK directly
- Claude Code CLI returns `--output-format json` with built-in metrics: tokens, cost, duration, session_id
- Tool call counting via `--output-format stream-json` (counts `tool_use` events in the stream)
- **Raw mode:** `--allowedTools "Bash"` + `--bare` so Claude only has a terminal — no MCP, no skills, no CLAUDE.md auto-loading
- **MCP mode (future):** `--allowedTools "mcp__terraform__*"` to compare against raw CLI arm
- `--max-turns 10` per run, `--max-budget-usd 2.00` per prompt as cost guard
- 3 trials per prompt for statistical validity (mean ± stddev)
- `--mode raw|mcp` flag in runner selects tool set; only `raw` implemented in baseline

### Temporary Directory Per Run

Each experiment run gets an isolated temporary directory:
- Copy all `.tf` files from `dummy-infra/` (including modules/) — **no README.md, no .gitignore**
- Run `terraform init` in the temp dir before first use (cached across trials)
- Invoke `claude -p` with `cwd` set to the temp dir so Claude cannot read any answer hints
- Delete temp dir after all trials for a prompt complete
- Purpose: prevent Claude from reading `dummy-infra/README.md` or `prompts.json` ground truth

### Metrics Captured Per Prompt Trial

| Metric | Source |
|--------|--------|
| `tokens_in` | `json.usage.input_tokens` |
| `tokens_out` | `json.usage.output_tokens` |
| `cost_usd` | `json.cost` |
| `wall_time_ms` | `json.duration` |
| `tool_calls` | count of `tool_use` events in stream-json |
| `answer` | `json.result` |
| `session_id` | `json.session_id` |

Final output: `results/raw_YYYYMMDD_HHMMSS.json` + `RAW_Claude_Code_Experiments.md` summary.

---

## Scorer

- Loads results JSON + prompts JSON
- Category-specific scoring (substring match, set overlap, topological validation, checklist)
- Scores: correct (1.0), partial (0.5), wrong (0.0)
- Outputs: detailed JSON + markdown summary table

---

## Implementation Order

| Step | What | Files | Status |
|------|------|-------|--------|
| 1 | Create directory structure + .gitignore | `experiments/baseline/**` | Done |
| 2 | Build networking module | `modules/networking/*.tf` | Done |
| 3 | Build security module | `modules/security/*.tf` | Done |
| 4 | Build compute module | `modules/compute/*.tf` | Done |
| 5 | Build database module | `modules/database/*.tf` | Done |
| 6 | Build loadbalancer module | `modules/loadbalancer/*.tf` | Done |
| 7 | Build monitoring module | `modules/monitoring/*.tf` | Done |
| 8 | Wire root main.tf + outputs.tf + variables | Root `*.tf` files | Done |
| 9 | `terraform init && apply` — verify 75 resources | Validate state | Done |
| 10 | Verify `terraform show -json` is 4000+ lines | Validate size | Done (4041 lines) |
| 11 | Create prompts.json with ground truth | `prompts.json` | Done |
| 12 | Research runner approach — Claude Code CLI vs SDK | `RAW_Claude_Code_Experiments.md` | Done |
| 13 | Implement runner.ts using Claude Code CLI headless mode | `runner.ts` | **Next** |
| 14 | Implement scorer.ts | `scorer.ts` | Pending |
| 15 | Run baseline (10 prompts x 3 trials) | `results/` | Pending |
| 16 | Write summary + update RAW_Claude_Code_Experiments.md | `RAW_Claude_Code_Experiments.md` | Pending |

---

## Verification

1. `terraform init && terraform apply -auto-approve` in dummy-infra — should create 75 resources
2. `terraform show -json | wc -l` — should be 4000+ lines
3. `terraform graph | dot -Tpng` — verify cross-module dependency edges exist
4. Run runner on 1 prompt end-to-end before full experiment
5. Run scorer on a manually crafted result to verify scoring logic
6. Full run: 10 prompts x 3 trials, generate summary table

---

## Expected Hypothesis

| | Easy | Medium | Hard |
|---|------|--------|------|
| Accuracy | 80-100% | 50-75% | 10-30% |
| Avg Tokens In | 5-15K | 15-30K | 30-50K |
| Avg Tool Calls | 2-4 | 5-8 | 8-15 |

Hard prompt degradation is the core finding — raw CLI forces iterative state dumps that burn tokens and lose accuracy. The MCP DAG tools should collapse these to 1-3 calls with higher accuracy.

---

## Reuse for GOAL.md Experiments

- **Experiment 1:** Same runner with `--mode mcp` once DAG tools exist
- **Experiment 2:** Swap tool definitions between coarse and fine-grained
- **Experiment 3:** Swap Anthropic SDK for OpenAI/Google SDKs in runner
- Dummy infra and prompts shared across all three
