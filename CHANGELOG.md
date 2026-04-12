# Changelog

<!-- AI should never edit this file manually. -->
<!-- This file is only updated when a feature ships, via /end-session. -->
<!-- Format follows Keep a Changelog: https://keepachangelog.com/en/1.0.0/ -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **v1 MCP server implementation** — 17 tools (12 read, 3 write, 2 destroy) with 3-tier gate system, GraphQL DAG engine, and prebuilt query generator.
- Gate system (`src/gate.ts`): `TERRAFORM_MCP_GATE` env var controls tool visibility — `read` (default, 12 tools), `write` (15 tools), `destroy` (17 tools). Tools above the gate are never registered.
- DAG engine (`src/dag/`): parses `terraform show -json` into a graphology `DirectedGraph` with BFS traversal, topological sort, shortest path, and Map indexes (byModule, byType, byShortName). Lazy init, cached, auto-detects out-of-band `.tfstate` changes via mtime/size fingerprint.
- GraphQL layer (`src/graphql/`): 8 query roots — `resource`, `resources`, `module`, `modules`, `path`, `impact`, `deploymentOrder`, `summary`. Depth guard (5), node limit (100), bare `resources{}` rejection, 5s timeout.
- Prebuilt query generator (`src/graphql/prebuilt.ts`): generates ready-to-run GraphQL queries using real resource IDs from the live graph. Scoped by infrastructure, module, or resource.
- `query_graph` MCP tool: executes GraphQL with compact schema summary baked into the tool description (always visible to the LLM).
- `get_schema` MCP tool: returns full SDL + prebuilt queries, with optional `module` or `resource` parameter for scoped context.
- 9 new CLI tools: `terraform_show`, `terraform_state_show`, `terraform_graph`, `terraform_providers`, `terraform_fmt`, `terraform_destroy`, `terraform_import`, `terraform_state_rm`, `terraform_state_mv`.
- Baked-in LLM guidance (`src/instructions.ts`): workflow recommendations, tool categories, output format, constraints.
- DAG auto-invalidation: `terraform_apply` and `terraform_destroy` invalidate the graph cache on success.
- GraphQL integration test (`test-graphql.mjs`): 6 test scenarios against 75-resource dummy-infra.
- PreToolUse hook (`protect-readonly-files.mjs`) that blocks direct edits to DECISIONS.md — enforces append-only contract at the tooling level. Closes #2.
- Three Claude automation files: `/add-tool` skill for scaffolding new MCP tools with zod schema and tsc verification, `scope-guard` skill that auto-triggers on out-of-scope proposals before any code is written, and `tool-schema-reviewer` agent that validates all `registerTool()` blocks against mcp-server-patterns conventions. Closes #3, #4, #5.
- Dummy Terraform infrastructure: 75 null_resources across 6 modules (networking, security, compute, database, loadbalancer, monitoring) simulating a 3-tier AWS deployment. State produces 4041 pretty-printed JSON lines (~33K tokens). Zero cloud charges. Closes #12.
- 4 design decisions committed to DECISIONS.md: null_resource trigger refs, 75-resource module layout, 4000+ line state target, experiment comparison metrics.
- `/end-session` command now includes a step to update CHANGELOG.md with `feat:` and `fix:` commits before closing — closes the gap where the file claimed to be auto-updated but had no instruction to do so.
- 10 experiment prompts with ground truth answers (prompts.json): 3 easy, 4 medium, 3 hard across 6 categories with 4 scoring types. All ground truth verified against .tf source files. Closes #13.
- Researched Claude Code CLI headless mode for experiment runner — confirmed `claude -p --output-format json --bare` returns built-in token, cost, duration metrics; stream-json mode counts tool_use events. Design documented in `plans/experiments-plan.md`.
- Updated `plans/experiments-plan.md` to reflect Claude Code CLI runner design and per-trial temp directory isolation approach. `RAW_Claude_Code_Experiments.md` noted as a future output file created after runs complete.
- 2 new decisions in DECISIONS.md: Claude Code CLI headless runner, temp dir isolation per trial.
- Baseline experiment runner (`runner.ts`): Claude Code CLI headless mode with stream-json parsing, temp dir isolation, per-tool-call granular metrics (tokens, output size, files accessed, terraform commands). Closes #14.
- Baseline experiment scorer (`scorer.ts`): 4 scoring types (substring-match, set-overlap, topological-validation, checklist) with fuzzy matching for AZ short codes, multi-part format matching, and separator-agnostic number matching. Closes #15.
- Baseline experiment visualizer (`visualize.ts`): Chart.js HTML dashboard with 6 interactive charts (accuracy by difficulty, token usage, tool calls vs accuracy, token efficiency, context growth, command distribution).
- Manual run support: `assemble-results.ts` for merging manual Claude Code answers into scorer format, `manual-run-prompt.md` with step-by-step instructions, `results/manual-run-template.json` as scorer-compatible template.
- Baseline experiment results (`RAW_Claude_Code_Experiments.md`): Full analysis of 10 prompts x 3 trials. Overall accuracy 0.83, easy=0.83, medium=0.75, hard=0.94. Total: 1.49M tokens, $1.73, 30 trials. Key finding: hard prompts cost 2.8x more than easy but maintain high accuracy — the raw CLI problem is cost/latency, not accuracy at 75-resource scale. Closes #16.
- 2 new decisions: CLI headless runner uses OAuth not --bare, baseline experiment results and revised thesis.
- v1 MCP tool set plan (`plans/tool-set-plan.md`): 5 purpose-built DAG tools + 2 GraphQL tools + 5 CLI tools = 12 total. Experiment-backed — each tool targets specific raw CLI inefficiency patterns found in baseline. Projected 6x token reduction.
- 5 architecture decisions resolving DECISIONS.md Q1-Q5: node model (resources + module containers), edge model (explicit + implicit, deduplicated), parser (terraform show -json for v1), tool list (12 tools), output shape (summary string on every response).
- GitHub issues #17-#23 for 7 implementation phases of the tool set plan, all assigned to KalharPandya.
- Progress report (`reports/progress-report.md`): 10-section Markdown report covering problem, team, experiments, project plan (Mermaid Gantt), Claude Code-first development workflow, objectives, related work (10 references), hypothesis (original + revised), methodology, preliminary results (Mermaid charts), and impact. Closes #24.
- Elevator pitch deck and script (`pitch/`): single-page HTML slide (`slides.html`) with 3-column layout covering problem, solution, and baseline proof — plus solo presenter script (`script.md`) with delivery notes for 2-minute video recording.

- Unified tool mode (`src/tools/unified.ts`): single `terraform` tool replaces all 12 read-tier tools when `TERRAFORM_MCP_UNIFIED=1` — reduces tool enumeration overhead for LLMs.
- Test scripts for CLI tools, DAG/GraphQL, gates, and prebuilt queries (`test-cli-tools.mjs`, `test-dag-graphql.mjs`, `test-gates.mjs`, `test-prebuilt.mjs`).
- v2 GraphQL plan (`plans/v2-graphql-plan`).
- Experiment prompts v2.0 (`prompts.json`): 30 prompts (8 easy, 10 medium, 12 hard) across 10 categories with 4 scoring types. 70% graph-advantage prompts covering dependency traversal, impact analysis, blast radius, cross-module chains, and deployment ordering.

### Changed
- `src/index.ts` refactored from monolithic 6-tool file into modular bootstrap: reads gate, iterates tool registrations, wires DAG invalidation.
- README.md rewritten: full MCP configuration guide (Claude Desktop, Claude Code, Cursor), all 17 tools documented with tiers, architecture diagram, GraphQL schema reference, testing instructions.
- CLAUDE.md: source file map updated with all new files across `src/gate.ts`, `src/terraform/`, `src/dag/`, `src/graphql/`, `src/tools/`.
- `package.json` dependencies: added `graphql`, `graphology`, `graphology-dag`, `graphology-traversal`, `graphology-shortest-path`.

### Fixed
- `/start-session` command now runs `git fetch --all` before `git pull` — prevents stale remote tracking branches from causing missed commits at session start.

### Removed
