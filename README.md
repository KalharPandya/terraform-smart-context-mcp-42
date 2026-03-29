# terraform-smart-context-mcp

An MCP server that parses Terraform state into a DAG and serves token-efficient, filtered infrastructure views to LLMs — so agents query exactly what they need instead of drowning in raw state.

Works with Claude Desktop, Claude Code, Cursor, and any MCP-compliant client.

## Why This Exists

Running `terraform show -json` on a 75-resource project produces 4000+ lines (~33K tokens). An LLM can't process that raw. Our [baseline experiment](experiments/baseline/RAW_Claude_Code_Experiments.md) proved it: hard infrastructure queries cost **$0.10+ and 79K tokens** with raw CLI tools. The same queries through purpose-built MCP tools should cost **~$0.01 and ~8K tokens** — a 6x reduction.

## Tools (v1)

### DAG Query Tools (purpose-built, high-frequency)

| Tool | Description |
|---|---|
| `list_resources` | List resources filtered by module/type — returns summaries, never full state |
| `get_resource` | One resource's config + direct neighbors |
| `get_dependencies` | Dependency subgraph around a resource (depth 1-3) |
| `filter_resources` | Find resources matching attribute conditions (e.g., SG rules with 0.0.0.0/0) |
| `count_resources` | Count resources grouped by module, type, or tag |

### GraphQL Query Tool (complex/ad-hoc queries)

| Tool | Description |
|---|---|
| `query_graph` | Execute a GraphQL query against the infrastructure DAG |
| `get_schema` | Return the GraphQL SDL + example queries |

The LLM uses purpose-built tools for common operations and falls back to GraphQL for impact analysis, path tracing, cross-module queries, and planning.

### Terraform CLI Tools (retained)

| Tool | Description |
|---|---|
| `terraform_init` | Run `terraform init` to initialize a working directory |
| `terraform_validate` | Validate configuration syntax and internal consistency |
| `terraform_plan` | Preview infrastructure changes (safe, no apply) |
| `terraform_apply` | Apply changes — requires `confirm: true` guard |
| `terraform_output` | Retrieve output values as pretty-printed JSON |

All tools accept a `workingDir` parameter — the absolute path to your Terraform config directory.

## Install

```bash
npm install
```

Requires Node.js 18+ and [Terraform CLI](https://developer.hashicorp.com/terraform/install) in your PATH.

## Configuration

> **Note:** Claude Desktop does not support a `cwd` config field. Use absolute paths as shown below.

Replace `<PROJECT_PATH>` with the absolute path where you cloned/placed this repo (e.g. `P:\\42-Terraform-MCP` on Windows).

### Claude Desktop

`%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "terraform": {
      "command": "<PROJECT_PATH>\\node_modules\\.bin\\tsx.cmd",
      "args": ["<PROJECT_PATH>\\src\\index.ts"]
    }
  }
}
```

### Claude Code

`~/.claude/settings.json` (global) or `.claude/settings.json` (per project):

```json
{
  "mcpServers": {
    "terraform": {
      "command": "<PROJECT_PATH>/node_modules/.bin/tsx",
      "args": ["<PROJECT_PATH>/src/index.ts"]
    }
  }
}
```

Or add via CLI:

```bash
claude mcp add terraform -- <PROJECT_PATH>/node_modules/.bin/tsx <PROJECT_PATH>/src/index.ts
```

### Cursor

`.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "terraform": {
      "command": "<PROJECT_PATH>/node_modules/.bin/tsx",
      "args": ["<PROJECT_PATH>/src/index.ts"]
    }
  }
}
```

## Test

Run the smoke test (validates and plans against the bundled `test-infra/`):

```bash
node test-mcp.mjs
```

Expected output: both `terraform_validate` and `terraform_plan` succeed against `test-infra/main.tf`.

## Test Infrastructure

`test-infra/main.tf` contains a minimal Terraform config using the `null` provider — useful for testing the MCP server without touching real cloud infrastructure:

```hcl
terraform {
  required_providers {
    null = { source = "hashicorp/null", version = "~> 3.0" }
  }
}
```

Run `terraform init` inside `test-infra/` before testing state/output tools.

## Experiments

The `experiments/` directory contains baseline experiments proving the need for MCP tools.

### Dummy Infrastructure (`experiments/baseline/dummy-infra/`)

A 75-resource Terraform project using only `null_resource` with trigger attribute references
to simulate a production 3-tier AWS deployment. Generates 4041 lines of pretty-printed JSON
state (~33K tokens) — too large for any LLM to process raw.

Six modules: networking (15), security (14), compute (16), database (10), loadbalancer (10), monitoring (10).

```bash
cd experiments/baseline/dummy-infra
terraform init && terraform apply -auto-approve  # instant, zero charges
```

See [`experiments/baseline/dummy-infra/README.md`](experiments/baseline/dummy-infra/README.md) for full details.

### Baseline Results

10 prompts x 3 trials, Claude Sonnet via raw CLI only (no MCP tools):

| Difficulty | Accuracy | Avg Tokens | Avg Cost | Avg Tool Calls |
|-----------|----------|-----------|----------|---------------|
| Easy | 0.83 | 28K | $0.028 | 2 |
| Medium | 0.75 | 44K | $0.047 | 3 |
| Hard | 0.94 | 79K | $0.102 | 6 |
| **Overall** | **0.83** | **50K** | **$0.058** | **3.5** |

**Key finding:** Accuracy stays high even on hard prompts, but cost and latency scale 3-4x. The problem is context inefficiency — 97.9% of tokens are input (accumulated tool output resent each turn). See [`RAW_Claude_Code_Experiments.md`](experiments/baseline/RAW_Claude_Code_Experiments.md) for full analysis.

## Development

```bash
npm run dev      # run with tsx (no build needed)
npm run build    # compile to dist/
npm run start    # run compiled output
```

## Architecture

The server starts on stdio and implements the [Model Context Protocol](https://modelcontextprotocol.io).

**Current (CLI wrappers):** Each tool spawns `terraform` as a subprocess, captures stdout/stderr, returns raw output. On Windows, `shell: true` is set automatically.

**v1 (DAG + GraphQL):** On first DAG tool call, the server runs `terraform show -json`, parses the state into an in-memory directed acyclic graph (nodes = resources, edges = dependencies), builds precomputed indexes, and serves filtered subgraphs via purpose-built tools and a GraphQL query engine. CLI tools are retained for mutations (plan, apply). See [`plans/tool-set-plan.md`](plans/tool-set-plan.md) for the full design.
