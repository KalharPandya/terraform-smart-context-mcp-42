// Baked-in LLM guidance — passed to McpServer via { instructions } option

export const INSTRUCTIONS = `# Terraform MCP Server — Tool Usage Guide

## Tool Mode

This server runs in **unified mode** by default: one tool named \`terraform\` with a
\`type\` parameter selects the operation. If you see individual tools named
\`query_graph\`, \`get_schema\`, \`terraform_state_list\`, etc., the server is running
in standard mode (TERRAFORM_MCP_UNIFIED=0) — use those tool names directly instead.

## Unified Mode — Operations via \`type\` Parameter

| type | What It Does |
|------|-------------|
| \`schema\` | GraphQL SDL + prebuilt queries scoped to live infra (start here) |
| \`query\` | Execute a GraphQL query against the dependency DAG |
| \`state_list\` | List all deployed resources |
| \`state_show\` | Show one resource's full attributes |
| \`validate\` | Check configuration syntax |
| \`plan\` | Preview changes (read-only) |
| \`show\` | Full state as structured JSON |
| \`output\` | Retrieve output values |
| \`graph\` | Graphviz DOT dependency graph |
| \`providers\` | List required providers |
| \`fmt\` | Check formatting |
| \`init\` | Initialise working directory |

Write/destroy operations (apply, import, state_mv, destroy, state_rm) are available
only when the gate is set to write or destroy tier.

## Tool Preference — Graph First, Terminal Last

**Prefer \`type:"schema"\` + \`type:"query"\` over CLI operations whenever possible.**

- Graph queries work without Terraform being installed, never mutate state,
  and return structured data the LLM can reason over efficiently.
- Fall back to CLI types (plan, show, state_list, etc.) only when the graph
  cannot answer the question (e.g., live plan output, provider schema).

**If a tool call is denied or fails with a permissions error:**
- Do **not** retry it or try a different operation to work around it.
- Treat denial as the user saying "I do not want you using the terminal for this."
- Stop and ask: "This requires running a terminal command. Should I proceed?"

## Recommended Workflow

1. Call \`terraform(type:"schema", workingDir:"...")\` first.
   Returns the GraphQL SDL + ready-to-run queries using YOUR actual resource IDs.
   Scope with \`module\` or \`resource\` param for focused context.

2. For dependency/impact questions, use \`type:"query"\` with GraphQL:
   - \`impact(resourceId, depth?)\` — blast radius of destroying a resource
   - \`path(fromId, toId)\` — shortest dependency path
   - \`deploymentOrder(module?)\` — topological build order
   - \`resource(id) { dependents dependencies }\` — direct edges

3. For simple attribute lookups, use \`type:"state_show"\` with the resource address.

4. For making changes (write/destroy gate only):
   Always \`type:"plan"\` first, review, then \`type:"apply"\` with confirm: true.

## Field Selection (GraphQL)

Not all Resource fields are equal in cost:

| Field | Cost | When to Use |
|-------|------|-------------|
| id, shortName, module, resourceType | Minimal | Always safe. Use in every query. |
| summary { name, arn } | Minimal | When you need a resource's display name or ARN without full state. |
| tags | Moderate | When filtering by tags or showing tag info for a small set. |
| dependencies, dependents | Moderate | Relationship queries. Keep depth <= 2 for bulk. |
| attributes | **Heavy** | Full resource state (40+ keys). Single-resource deep inspection only. |

Rule of thumb: Start with lightweight fields. Add attributes only for single resources
or very small result sets (limit <= 5).

## Output Format
- CLI tools return raw Terraform output as text.
- query_graph returns { data, errors, meta } as JSON.
- get_schema returns the SDL, constraints, and prebuilt queries as markdown.

## Key Constraints
- GraphQL query depth limit: 5 levels
- resources() requires a module or type filter, or explicit limit
- impact() analysis depth limited to 3
- Node limit: 100 per query (default 50)
`;
