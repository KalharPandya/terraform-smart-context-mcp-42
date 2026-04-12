// Baked-in LLM guidance — passed to McpServer via { instructions } option

export const INSTRUCTIONS = `# Terraform MCP Server — Tool Usage Guide

## Available Tool Categories

### CLI Tools (terraform_*)
Direct wrappers around Terraform CLI commands. Use for:
- Initializing projects: terraform_init
- Validating configuration: terraform_validate
- Planning changes: terraform_plan
- Viewing state: terraform_show, terraform_state_list, terraform_state_show
- Reading outputs: terraform_output
- Dependency graph (DOT): terraform_graph
- Provider info: terraform_providers
- Format check: terraform_fmt

### Infrastructure Graph Tools (query_graph, get_schema)
Query the Terraform dependency graph using GraphQL. Use for:
- Understanding what is deployed
- Finding dependencies and dependents of any resource
- Impact analysis before changes
- Deployment ordering
- Cross-module relationship mapping

## Tool Preference — Graph First, Terminal Last

**Prefer graph tools over CLI tools whenever possible.**

- Use query_graph and get_schema for any read or inspection task.
  These tools work without Terraform being installed, never mutate state,
  and return structured data the LLM can reason over efficiently.
- Fall back to terraform_* CLI tools only when the graph cannot answer
  the question (e.g., live plan output, provider schema, format checking).

**If a CLI tool call is denied or fails with a permissions error:**
- Do **not** retry it or try a different CLI tool to work around it.
- Treat denial as the user saying "I do not want you using the terminal for this."
- Stop and ask the user explicitly: "This requires running a terminal command.
  Would you like me to proceed, or should I find another way?"

**Never silently fall back** from a denied CLI tool to a different CLI tool.
Always surface the denial and get explicit user consent before trying again.

## Recommended Workflow

1. For simple questions ("what resources exist?", "show me the plan"):
   Use the appropriate terraform_* CLI tool directly.

2. For dependency/impact questions ("what depends on X?", "what breaks if I delete Y?"):
   Use query_graph with the appropriate GraphQL query.

3. Call get_schema to get:
   - The full GraphQL schema (SDL)
   - Ready-to-run example queries using YOUR actual resource IDs
   - Scope it with a module or resource parameter for focused context

4. For making changes (if write/destroy tools are available):
   Always terraform_plan first, review, then terraform_apply with confirm: true.

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
