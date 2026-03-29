# Plan: MCP Tool Set v1 — Purpose-Built Tools + GraphQL Escape Hatch

## Context

Project 42's current MCP server has 6 raw Terraform CLI wrapper tools. The LLM gets raw `terraform show -json` output (4000+ lines, ~33K tokens) and must parse it manually. This plan designs the v1 tool set where the LLM gets purpose-built DAG query tools for common operations, plus a GraphQL tool for complex/ad-hoc queries. Both tool types query the same in-memory DAG built from Terraform state.

Open questions Q1-Q5 in DECISIONS.md are answered implicitly by this design (node model, edge model, tool list, output shape). Decisions committed 2026-03-28.

---

## Experiment Findings That Validate This Design

Baseline experiment ran 2026-03-29: 10 prompts × 3 trials, raw CLI only (Bash tool). Full results in `experiments/baseline/RAW_Claude_Code_Experiments.md`.

### Key Numbers

| | Easy | Medium | Hard |
|---|------|--------|------|
| Accuracy | 0.83 | 0.75 | **0.94** |
| Avg tokens | 28K | 44K | **79K** |
| Avg tool calls | 2 | 3 | **6** |
| Avg cost | $0.028 | $0.047 | **$0.102** |
| Tool output chars | 5K | 9K | **34K** |

**Total: 1.49M tokens, $1.73, 697s across 30 trials.**

### Revised Thesis

The raw CLI problem at 75-resource scale is **cost/latency/context inefficiency** — not accuracy. Hard prompts score well but burn 2.8× more tokens and 3.9× more time. 97.9% of all tokens were input (context accumulation from prior tool outputs resent each turn).

### Where Each Tool Saves the Most

| Tool in this plan | Replaces this raw CLI pattern | Saves |
|---|---|---|
| **`get_dependencies`** | `state list` → `terraform graph \| grep` → `state show` per hop | Prompt 3: 48K→~5K tokens, 3 calls→1 |
| **`filter_resources`** | `state list` → loop `state show` over all SGs | Prompt 5: 48K→~2K tokens (19K chars of SG dumps → 500 chars filtered) |
| **`query_graph` (path)** | `state list` → `terraform graph` → `cat modules/*.tf` × 5 | Prompt 6: 76K→~8K tokens, 6 calls→1 (most expensive prompt at $0.125) |
| **`query_graph` (impact)** | Recursive `terraform graph \| grep` per dependency hop | Prompt 4: 76K→~5K tokens (T3 used 98K tokens with same correct answer as T1's 51K) |
| **`list_resources`** | `state list \| grep` + loop `state show` per match | Prompt 2: 33K→~3K tokens |
| **`count_resources`** | `state list` (then manual counting — T3 miscounted: 74 vs 75) | Prompt 9: 21K→~1K tokens, eliminates counting errors |
| **`get_resource`** | `state list \| grep` → `state show` (2 calls, 30K tokens) | Prompt 1: 30K→~3K tokens |

### Projected MCP Mode Improvement

Conservative estimate based on replacing raw CLI patterns with pre-filtered tool responses:

| Metric | Raw CLI (actual) | MCP (projected) | Reduction |
|---|---|---|---|
| Avg tokens/prompt | 49,732 | ~8,000 | **~6× fewer** |
| Avg tool calls | 3.5 | 1.2 | **~3× fewer** |
| Avg cost/prompt | $0.058 | ~$0.012 | **~5× cheaper** |
| Token variance | High (2-3× across trials) | Low (deterministic responses) | Stable |

### Specific Failure Patterns the Tools Fix

1. **Prompt 3 scored 0.00** — `get_dependencies("vpc", direction: "dependents", depth: 1)` returns an exact set, eliminating ambiguity of "directly depends on"
2. **Prompt 6 T2 used 94K tokens / 10 calls** — `query_graph` with `path(from, to)` collapses to 1 call with deterministic output
3. **Prompt 9 T3 miscounted (74 vs 75)** — `count_resources(groupBy: "module")` returns exact counts from the index
4. **Prompt 5 dumped 19K chars of SG state** — `filter_resources(ingress_cidr: "0.0.0.0/0")` returns only the 2 matching rules

---

## Tool Set Summary (12 tools)

| # | Tool | Category | Answers Prompts | One-liner |
|---|------|----------|-----------------|-----------|
| 1 | `list_resources` | DAG | 2, 9 | List resources filtered by module/type, returns summaries |
| 2 | `get_resource` | DAG | 1 | One resource's config + direct neighbors |
| 3 | `get_dependencies` | DAG | 3, 7 | Dependency subgraph around a resource (depth 1-3) |
| 4 | `filter_resources` | DAG | 5 | Find resources matching attribute conditions |
| 5 | `count_resources` | DAG | 9 | Count resources grouped by module/type/tag |
| 6 | `query_graph` | GraphQL | 4, 6, 8, 10 | Execute GraphQL query against the DAG |
| 7 | `get_schema` | GraphQL | — | Return GraphQL SDL + example queries |
| 8-12 | `terraform_init/validate/plan/apply/output` | CLI | — | Existing CLI wrappers (retained) |

**Dropped:** `terraform_state_list` — subsumed by `list_resources`.

**LLM selection logic:** Tool descriptions steer the LLM to purpose-built tools first. `query_graph` description says "Use only when purpose-built tools cannot answer" with specific use cases listed.

---

## Internal DAG Architecture

### Data Model

```typescript
// dag/types.ts
interface DagNode {
  id: string;                    // "module.networking.null_resource.vpc"
  shortName: string;             // "vpc"
  resourceType: string;          // "null_resource"
  simulatedType: string;         // "aws_vpc" (inferred from naming)
  module: string;                // "networking"
  attributes: Record<string, string>;  // trigger map (full config)
  tags: Record<string, string>;
  summary: { name: string; tier: string; arn: string };
}

interface DagEdge {
  from: string;   // dependent
  to: string;     // dependency
  type: "explicit" | "implicit";
  source: string; // why edge exists
}
```

### DAG Lifecycle

1. **Lazy init:** First DAG tool call runs `terraform show -json`, parses state, builds indexes
2. **Cached:** Subsequent calls use cached DAG (zero overhead)
3. **Rebuild on apply:** `terraform_apply` success triggers DAG rebuild
4. **CLI tools unaffected:** init/validate/plan/output don't touch the DAG

### Precomputed Indexes

| Index | Type | Used By |
|-------|------|---------|
| `nodeById` | `Map<string, DagNode>` | All tools |
| `nodeByShortName` | `Map<string, DagNode[]>` | get_resource fuzzy lookup |
| `edgesByFrom` | `Map<string, DagEdge[]>` | get_dependencies (dependencies direction) |
| `edgesByTo` | `Map<string, DagEdge[]>` | get_dependencies (dependents direction) |
| `nodesByModule` | `Map<string, DagNode[]>` | list_resources, count_resources |
| `nodesByType` | `Map<string, DagNode[]>` | list_resources, filter_resources |
| `moduleInputs` | `Map<string, ModuleInput[]>` | query_graph cross-module |
| `topologicalOrder` | `string[]` | query_graph deployment order |

---

## GraphQL Schema (key types)

```graphql
type Query {
  resource(id: String!): Resource
  resources(module: String, type: String, limit: Int = 50): ResourceConnection!
  module(name: String!): Module
  modules: [Module!]!
  path(fromId: String!, toId: String!, maxDepth: Int = 3): PathResult
  impact(resourceId: String!, depth: Int = 2): ImpactResult!
  deploymentOrder(module: String, resourceIds: [String!]): [Resource!]!
}

type Resource {
  id: String!
  shortName: String!
  module: String!
  simulatedType: String!
  summary: ResourceSummary!
  attributes(keys: [String!]): JSON
  dependencies(depth: Int = 1): [DependencyEdge!]!
  dependents(depth: Int = 1): [DependencyEdge!]!
}

type Module {
  name: String!
  resourceCount: Int!
  resources: [Resource!]!
  inputs: [ModuleInput!]!
  outputs: [ModuleOutput!]!
  dependsOn: [Module!]!
}

type ImpactResult {
  target: Resource!
  affected: [AffectedResource!]!
  totalAffected: Int!
}

type PathResult {
  found: Boolean!
  path: [Resource!]!
  length: Int!
}
```

**Safeguards:** Depth limit 3 (enforced via AST validation), node count limit 50, bare `resources {}` without filters rejected, 5s execution timeout.

---

## File Structure

```
src/
  index.ts                     # Server bootstrap, register all 12 tools
  dag/
    types.ts                   # DagNode, DagEdge, index types
    builder.ts                 # terraform show -json → nodes + edges
    indexes.ts                 # Build all precomputed indexes
    traversal.ts               # BFS, shortest path, impact, topo sort
  tools/
    list_resources.ts          # Purpose-built tool
    get_resource.ts            # Purpose-built tool
    get_dependencies.ts        # Purpose-built tool
    filter_resources.ts        # Purpose-built tool
    count_resources.ts         # Purpose-built tool
    query_graph.ts             # GraphQL executor with guards
    get_schema.ts              # Return SDL + examples
  graphql/
    schema.ts                  # SDL string + buildSchema()
    resolvers.ts               # Resolver functions → DAG indexes
    validation.ts              # Depth/node count validation rules
  terraform/
    cli.ts                     # Extracted runTerraform + CLI handlers
  shared/
    errors.ts                  # Structured error builder
    summarize.ts               # Human-readable summaries
```

**New dependency:** `graphql` (npm, ^16.9.0) — zero-dependency reference implementation. No HTTP server framework needed; in-process query engine only.

---

## Implementation Phases

| Phase | What | Files |
|-------|------|-------|
| 1 | DAG data model + state parser + indexes | `dag/types.ts`, `dag/builder.ts`, `dag/indexes.ts` |
| 2 | Graph traversal algorithms (BFS, path, impact, topo) | `dag/traversal.ts` |
| 3 | Simple purpose-built tools (list, get, count) | `tools/list_resources.ts`, `tools/get_resource.ts`, `tools/count_resources.ts` |
| 4 | Complex purpose-built tools (dependencies, filter) | `tools/get_dependencies.ts`, `tools/filter_resources.ts` |
| 5 | GraphQL schema + resolvers + validation | `graphql/schema.ts`, `graphql/resolvers.ts`, `graphql/validation.ts` |
| 6 | GraphQL MCP tools | `tools/query_graph.ts`, `tools/get_schema.ts` |
| 7 | Integration: wire into index.ts, extract CLI tools, drop state_list | `index.ts`, `terraform/cli.ts` |

---

## Prompt Coverage Mapping

| Prompt | Difficulty | Tool | Call |
|--------|-----------|------|------|
| 1. VPC CIDR | Easy | `get_resource` | `("vpc", includeAttributes: true)` |
| 2. Subnets/AZs | Easy | `list_resources` | `(module: "networking", type: "aws_subnet")` |
| 3. VPC dependents | Medium | `get_dependencies` | `("vpc", direction: "dependents", depth: 1)` |
| 4. DB subnet impact | Hard | `query_graph` | `impact(resourceId: "db_subnet_group")` |
| 5. SG 0.0.0.0/0 | Medium | `filter_resources` | `(attributeFilters: [{key: "ingress_cidr", op: "equals", value: "0.0.0.0/0"}])` |
| 6. ALB→DB chain | Hard | `query_graph` | `path(fromId: "listener_https", toId: "rds_primary")` |
| 7. Deploy order | Medium | `query_graph` | `deploymentOrder(module: "compute")` |
| 8. Cross-module | Medium | `query_graph` | `module(name: "compute") { inputs { ... } }` |
| 9. Resource count | Easy | `count_resources` | `(groupBy: "module")` |
| 10. Add microservice | Hard | `query_graph` | Multi-module pattern query |

Purpose-built: 5/10 prompts. GraphQL: 5/10 prompts. Clean split.

---

## Decisions to Commit (resolves Q1-Q5)

| Q | Decision |
|---|----------|
| Q1 (nodes) | Resources are primary nodes. Modules are container nodes with inter-module edges. Variables/outputs are not nodes — they are attributes on module nodes. |
| Q2 (edges) | Both explicit (`depends_on`) and implicit (attribute references). Deduplicated: one edge with both type labels if both exist. |
| Q3 (parser) | For v1: parse `terraform show -json` state output (not raw HCL). The state JSON contains resource configs and dependency info. HCL parsing deferred to v2. |
| Q4 (tools) | 5 purpose-built DAG tools + 2 GraphQL tools + 5 CLI tools = 12 total. `terraform_state_list` dropped. |
| Q5 (output shape) | Purpose-built tools: `{resources/nodes, edges, total, summary}`. GraphQL: standard `{data, errors}` + `meta` with node count and truncation flag. Every response includes a `summary` string. |

---

## Verification

1. `npm run build` — TypeScript compiles with no errors
2. `terraform init && terraform apply` in `experiments/baseline/dummy-infra/`
3. Start MCP server, call each tool against the 75-resource state:
   - `count_resources(groupBy: "module")` → 75 total, 6 modules
   - `get_resource("vpc")` → returns CIDR 10.0.0.0/16
   - `get_dependencies("vpc", direction: "dependents")` → 12 direct dependents
   - `filter_resources(attributeFilters: [{key: "ingress_cidr", op: "equals", value: "0.0.0.0/0"}])` → 2 matches
   - `query_graph` with `impact(resourceId: "db_subnet_group")` → 3 affected
   - `query_graph` with `path(fromId: "listener_https", toId: "rds_primary")` → 7-node chain
4. All 10 prompts answerable via the tool set with correct ground truth
5. No tool returns more than 50 nodes or exceeds depth 3
