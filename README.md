# terraform-smart-context-mcp

An MCP server that parses Terraform state into a dependency DAG and exposes it via GraphQL — so AI agents query exactly the infrastructure slice they need instead of drowning in raw state.

Works with **Claude Desktop**, **Claude Code**, **Cursor**, and any MCP-compliant client.

## Why This Exists

Running `terraform show -json` on a 75-resource project produces 4000+ lines (~33K tokens). An LLM can't process that raw. Our [baseline experiment](experiments/baseline/RAW_Claude_Code_Experiments.md) proved it: hard infrastructure queries cost **$0.10+ and 79K tokens** with raw CLI tools. The same queries through purpose-built MCP tools cost **~$0.01 and ~8K tokens** — a 6x reduction.

**What makes this different:**

| Feature | HashiCorp terraform-mcp-server | Terraform CLI | This project |
|---------|-------------------------------|---------------|-------------|
| Local `.tf` / state files | No (cloud API only) | Yes | Yes |
| Dependency graph queries | No | `terraform graph` (DOT text) | GraphQL with BFS, impact, paths |
| LLM guidance | No | No | Schema context + prebuilt queries |
| Access control | No | No | 3-tier gate system |

---

## Quick Start

```bash
git clone https://github.com/KalharPandya/terraform-smart-context-mcp.git
cd terraform-smart-context-mcp
npm install
```

Requires **Node.js 18+** and [Terraform CLI](https://developer.hashicorp.com/terraform/install) in your PATH.

---

## Configuration

### 1. Add the MCP Server to Your Client

Every MCP client needs to know how to start the server. The server runs on **stdio** — the client spawns it as a subprocess.

> **Note:** Replace `<PROJECT_PATH>` with the absolute path where you cloned this repo (e.g., `P:\42-Terraform-MCP` on Windows, `/home/user/terraform-smart-context-mcp` on Linux/Mac).

#### Claude Desktop

Edit `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "terraform": {
      "command": "<PROJECT_PATH>/node_modules/.bin/tsx",
      "args": ["<PROJECT_PATH>/src/index.ts"],
      "env": {
        "TERRAFORM_MCP_GATE": "read"
      }
    }
  }
}
```

On Windows, use backslash-escaped paths:

```json
{
  "mcpServers": {
    "terraform": {
      "command": "<PROJECT_PATH>\\node_modules\\.bin\\tsx.cmd",
      "args": ["<PROJECT_PATH>\\src\\index.ts"],
      "env": {
        "TERRAFORM_MCP_GATE": "read"
      }
    }
  }
}
```

#### Claude Code

Add via CLI (recommended):

```bash
claude mcp add terraform -- npx tsx <PROJECT_PATH>/src/index.ts
```

Or manually in `~/.claude/settings.json` (global) or `.claude/settings.json` (per project):

```json
{
  "mcpServers": {
    "terraform": {
      "command": "npx",
      "args": ["tsx", "<PROJECT_PATH>/src/index.ts"],
      "env": {
        "TERRAFORM_MCP_GATE": "read"
      }
    }
  }
}
```

#### Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "terraform": {
      "command": "npx",
      "args": ["tsx", "<PROJECT_PATH>/src/index.ts"],
      "env": {
        "TERRAFORM_MCP_GATE": "read"
      }
    }
  }
}
```

#### Any MCP-Compliant Client

The server communicates over **stdio**. Start it with:

```bash
npx tsx <PROJECT_PATH>/src/index.ts
```

Set environment variables before launching (see [Gate System](#2-set-the-gate-level) below).

### 2. Set the Gate Level

The **gate system** controls which tools the LLM can see. Tools above the configured tier are never registered — the LLM cannot discover or call them.

Set the `TERRAFORM_MCP_GATE` environment variable:

| Gate | Tools Visible | Use When |
|------|--------------|----------|
| `read` (default) | 12/17 — all read-only tools | Exploring, querying, planning. No infrastructure changes possible. |
| `write` | 15/17 — adds apply, import, state mv | You want the LLM to create/modify infrastructure. |
| `destroy` | 17/17 — adds destroy, state rm | You want the LLM to have full control, including deletion. |

Each tier includes all tools from lower tiers. The default is `read` — safe for exploration.

**Defense-in-depth:** Even at `write`/`destroy` tier, `terraform_apply`, `terraform_destroy`, and `terraform_state_rm` require an explicit `confirm: true` parameter. The LLM must intentionally confirm destructive actions.

### 3. Point the Tools at Your Terraform Project

Every tool accepts a `workingDir` parameter — the absolute path to your Terraform configuration directory. This is where your `.tf` files and `terraform.tfstate` live.

```
query_graph(workingDir: "/path/to/your/terraform/project", query: "{ summary { ... } }")
```

If the MCP client sends a workspace root via the MCP roots protocol, `workingDir` becomes optional and defaults to that root.

---

## Tools (17 total)

### GraphQL Query Tools (read tier)

The core of the server. These parse `terraform show -json` into an in-memory dependency graph and expose it via GraphQL.

| Tool | Description |
|------|-------------|
| `query_graph` | Execute a GraphQL query against the infrastructure DAG. Tool description includes a compact schema summary — the LLM always knows what's queryable. |
| `get_schema` | Return the full GraphQL SDL + ready-to-run example queries built from your live infrastructure. Accepts optional `module` or `resource` parameter to scope the examples. |

#### GraphQL Schema

Available query roots:

```graphql
resource(id)                        # Single resource: details, attributes, tags
resources(module?, type?, limit?)   # Filtered list (module or type filter required)
module(name)                        # Module with its resource list
modules                             # All modules with resource counts
path(fromId, toId)                  # Shortest dependency path between two resources
impact(resourceId, depth?)          # What breaks if a resource is destroyed
deploymentOrder(module?)            # Topological build/deploy order
summary                             # Total counts and type breakdown
```

Each `Resource` exposes:
- `id`, `shortName`, `module`, `resourceType`
- `attributes` — the **full** resource state (entire `resource.values` from Terraform, nothing filtered)
- `tags` — parsed from `attributes.tags`
- `dependencies(depth?)` — resources this node depends ON
- `dependents(depth?)` — resources that depend ON this node

**Constraints:** depth limit 5, node limit 100 (default 50), `resources()` requires a `module` or `type` filter.

#### Example: Get Schema with Prebuilt Queries

```
get_schema(workingDir: "/path/to/project")
```

Returns the full SDL plus ready-to-run queries using your **real resource IDs**:

```graphql
# What depends on the VPC? (12 dependents)
query VpcDependents {
  resource(id: "module.networking.null_resource.vpc") {
    dependents(depth: 2) { resource { id shortName module } depth }
  }
}
```

Scope it for focused context:
```
get_schema(module: "networking")     # Queries focused on the networking module
get_schema(resource: "...vpc")       # Queries centered on the VPC resource
```

#### Example: Impact Analysis

```
query_graph(query: """
  query {
    impact(resourceId: "module.networking.null_resource.vpc", depth: 3) {
      affectedCount
      affected { resource { id shortName module } depth }
    }
  }
""")
```

### Terraform CLI Tools (read tier — 10 tools)

Direct wrappers around Terraform CLI commands. Each spawns `terraform` as a subprocess.

| Tool | CLI Command | Description |
|------|-------------|-------------|
| `terraform_init` | `terraform init` | Initialize working directory, download providers/modules |
| `terraform_validate` | `terraform validate` | Check configuration syntax and consistency |
| `terraform_plan` | `terraform plan` | Preview changes (supports `-var`, `-var-file`, `-destroy`) |
| `terraform_show` | `terraform show -json` | Display current state as structured JSON |
| `terraform_state_list` | `terraform state list` | List all resources in state (optional address filter) |
| `terraform_state_show` | `terraform state show` | Show a single resource's attributes |
| `terraform_output` | `terraform output -json` | Retrieve output values |
| `terraform_graph` | `terraform graph` | Generate Graphviz DOT dependency graph |
| `terraform_providers` | `terraform providers` | List required providers |
| `terraform_fmt` | `terraform fmt -check -diff` | Check formatting (read-only by default) |

### Write Tier Tools (3 tools)

Only visible when `TERRAFORM_MCP_GATE=write` or `destroy`.

| Tool | CLI Command | Description |
|------|-------------|-------------|
| `terraform_apply` | `terraform apply -auto-approve` | Apply changes. Requires `confirm: true`. |
| `terraform_import` | `terraform import` | Import existing infrastructure into state |
| `terraform_state_mv` | `terraform state mv` | Move/rename a resource in state |

### Destroy Tier Tools (2 tools)

Only visible when `TERRAFORM_MCP_GATE=destroy`.

| Tool | CLI Command | Description |
|------|-------------|-------------|
| `terraform_destroy` | `terraform destroy -auto-approve` | Destroy all infrastructure. Requires `confirm: true`. |
| `terraform_state_rm` | `terraform state rm` | Remove resource from state tracking. Requires `confirm: true`. |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  MCP Client (Claude Desktop / Claude Code / Cursor)     │
└───────────────┬─────────────────────────────────────────┘
                │ stdio (MCP protocol)
┌───────────────▼─────────────────────────────────────────┐
│  src/index.ts — MCP Server Bootstrap                    │
│  ├─ gate.ts        — 3-tier access control              │
│  ├─ instructions.ts — baked-in LLM guidance             │
│  │                                                      │
│  ├─ terraform/                                          │
│  │  ├─ cli.ts      — runTerraform() subprocess helper   │
│  │  └─ tools.ts    — 15 CLI tool registrations          │
│  │                                                      │
│  ├─ dag/                                                │
│  │  ├─ types.ts    — DagNode, DagEdge, DagIndexes       │
│  │  ├─ builder.ts  — terraform show -json → nodes/edges │
│  │  ├─ indexes.ts  — Map indexes (byModule, byType, ...) │
│  │  └─ graph.ts    — DagGraph singleton (graphology)    │
│  │                                                      │
│  ├─ graphql/                                            │
│  │  ├─ schema.ts   — GraphQL SDL + buildSchema()        │
│  │  ├─ resolvers.ts — root resolvers → DagGraph lookups │
│  │  ├─ validation.ts — depth/size/bare-query guards     │
│  │  └─ prebuilt.ts — generates example queries from live graph │
│  │                                                      │
│  └─ tools/                                              │
│     ├─ query_graph.ts — MCP tool: execute GraphQL       │
│     └─ get_schema.ts  — MCP tool: SDL + prebuilt queries│
└─────────────────────────────────────────────────────────┘
```

### How the DAG Works

1. On the first `query_graph` or `get_schema` call, the server runs `terraform show -json`
2. The JSON output is parsed into `DagNode[]` (resources) and `DagEdge[]` (from `depends_on`)
3. Nodes and edges are loaded into a [graphology](https://graphology.github.io/) `DirectedGraph`
4. Domain-specific Map indexes are built on top (byModule, byType, byShortName, modules)
5. GraphQL resolvers query the graph via BFS traversal, topological sort, and shortest path algorithms
6. The graph is **cached** — subsequent queries are instant
7. If the `.tfstate` file changes (e.g., someone runs `terraform apply` in another terminal), the server **auto-detects** via mtime/size fingerprinting and rebuilds
8. `terraform_apply` and `terraform_destroy` explicitly invalidate the cache on success

### Graph Library: graphology

The DAG uses [graphology](https://graphology.github.io/) with these extensions:
- `graphology-dag` — topological sort (Kahn's algorithm), cycle detection
- `graphology-traversal` — BFS/DFS with configurable direction (inbound/outbound)
- `graphology-shortest-path` — bidirectional shortest path

Domain-specific Map indexes are built on top for O(1) lookups by module, type, and short name.

---

## Testing

### Smoke Test (CLI tools)

```bash
node test-mcp.mjs
```

Spawns the MCP server, calls `terraform_validate` and `terraform_plan` against `test-infra/main.tf`.

### GraphQL Integration Test

```bash
# First, ensure dummy-infra has state:
cd experiments/baseline/dummy-infra
terraform init && terraform apply -auto-approve
cd ../../..

# Run the test:
node test-graphql.mjs
```

Tests 6 scenarios against the 75-resource dummy infrastructure:

| Test | What it verifies |
|------|-----------------|
| Summary query | DAG builds, returns 75 resources across 6 modules |
| `resources(module:)` | Module filtering works |
| Bare `resources{}` | Rejected by validation guard |
| `get_schema` full | Returns SDL + prebuilt queries with real resource IDs |
| `get_schema(module:)` | Scoped prebuilt queries for a specific module |
| Impact analysis | Dependency traversal returns affected resources |

### Test Infrastructure

`test-infra/main.tf` — minimal `null_resource` for smoke testing (not the experiment infra).

`experiments/baseline/dummy-infra/` — 75 `null_resource`s across 6 modules simulating a 3-tier AWS deployment. Zero cloud charges. See its [README](experiments/baseline/dummy-infra/README.md).

---

## Development

```bash
npm run dev      # run with tsx (no build step)
npm run build    # compile TypeScript to dist/
npm start        # run compiled output
```

### Adding a New Index

The DAG supports fast Map-based lookups. To add a new index:

1. Define the Map type in `src/dag/types.ts` (extend `DagIndexes`)
2. Add one entry to the build loop in `src/dag/indexes.ts`
3. Add an accessor method on `DagGraph` in `src/dag/graph.ts`

Cost: O(n) per index during build, one Map entry per node. At 75-500 resources: <1ms.

---

## Experiments

The `experiments/` directory contains baseline experiments proving the need for MCP tools.

### Baseline Results

10 prompts x 3 trials, Claude Sonnet via raw CLI only (no MCP tools):

| Difficulty | Accuracy | Avg Tokens | Avg Cost | Avg Tool Calls |
|-----------|----------|-----------|----------|---------------|
| Easy | 0.83 | 28K | $0.028 | 2 |
| Medium | 0.75 | 44K | $0.047 | 3 |
| Hard | 0.94 | 79K | $0.102 | 6 |
| **Overall** | **0.83** | **50K** | **$0.058** | **3.5** |

**Key finding:** Accuracy stays high, but cost scales 3-4x on hard prompts. 97.9% of tokens are input (accumulated tool output resent each turn). See [RAW_Claude_Code_Experiments.md](experiments/baseline/RAW_Claude_Code_Experiments.md) for full analysis.

---

## License

MIT
