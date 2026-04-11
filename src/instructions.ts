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
