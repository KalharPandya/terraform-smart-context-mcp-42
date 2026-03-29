# DECISIONS.md — Append Only, Never Edit Existing Entries

**Ground truth for everything we have agreed on as a team.**

> If it is not in this file, it is not a decision.
> Append entries at the bottom. Never modify or delete existing entries.
> Format: `[NAME DATE] decision summary`

---

## Open Questions

The team must resolve these before building begins.
Move each question to the Decisions section the moment it is answered.

1. **What is a node?**
   Is a node a `resource`, a `module`, or both? Do variables and outputs become nodes?

2. **What is an edge?**
   Do we track only `depends_on` (explicit), only implicit attribute references, or both?
   How do we handle inter-module edges?

3. **Which HCL parser library?**
   Options include `@cdktf/hcl2cdk`, raw HCL via WASM, or a custom regex-based parser.
   What are the trade-offs for each?

4. **What MCP tools to expose in v1?**
   Candidates: `get_subgraph`, `get_dependencies`, `get_dependents`, `explain_resource`.
   Which are in scope for v1? Which are deferred?

5. **What does reduced context output look like as JSON?**
   Define the exact response shape: what fields per node, what fields per edge,
   do we include a human-readable summary alongside the JSON?

---

## Decisions

<!-- First entry goes here. Format: [NAME DATE] decision summary -->
[ShahParin 2026-03-28] Dummy infra uses null_resource with trigger attribute references to simulate real AWS dependency edges with zero cloud charges
[ShahParin 2026-03-28] Dummy infra is structured as 75 resources across 6 modules: networking=15, security=14, compute=16, database=10, loadbalancer=10, monitoring=10
[ShahParin 2026-03-28] State size target is 4000+ pretty-printed JSON lines, achieved by adding 14+ metadata trigger keys per resource
[ShahParin 2026-03-28] Baseline experiment compares raw CLI vs MCP on five metrics: time taken, tokens utilized, accuracy, tool calls, and context efficiency (tokens per correct answer)
[Kalhar 2026-03-28] Experiment runner uses Claude Code CLI headless mode (claude -p --output-format json --bare) instead of Anthropic SDK directly — built-in token/cost/duration metrics, --bare for clean isolation, --allowedTools "Bash" for raw mode
[Kalhar 2026-03-28] Each experiment trial runs in a temporary directory (os.tmpdir/exp-uuid) with only .tf files copied in — no README, no prompts.json, no .md files — deleted after all trials for a prompt complete; prevents Claude from reading answer hints
[ShahParin 2026-03-29] Baseline runner uses Claude Code CLI headless mode with OAuth auth (not --bare, which requires API key) — isolation via --tools "Bash" --allowedTools "Bash" --dangerously-skip-permissions --disable-slash-commands + temp dir cwd. Also deletes .claude/ dir between trials to prevent cross-trial context leakage.
[ShahParin 2026-03-29] Baseline experiment results: overall accuracy 0.83, easy=0.83, medium=0.75, hard=0.94. Hard prompts scored higher than predicted but at 2.8x token cost vs easy (78K vs 28K avg). Total: 1.49M tokens, $1.73, 30 trials across 10 prompts. Revised thesis: raw CLI problem is cost/latency not accuracy at 75-resource scale.
[Kalhar 2026-03-28] Q1 resolved: Resources are primary DAG nodes. Modules are container nodes with inter-module edges. Variables/outputs are not nodes — they are attributes on module nodes.
[Kalhar 2026-03-28] Q2 resolved: Both explicit (depends_on) and implicit (attribute reference) edges tracked. Deduplicated: one edge with both type labels if both exist between same nodes.
[Kalhar 2026-03-28] Q3 resolved: v1 parses terraform show -json state output (not raw HCL). State JSON contains resource configs and dependency info. HCL parsing deferred to v2.
[Kalhar 2026-03-28] Q4 resolved: v1 tool set = 5 purpose-built DAG tools (list_resources, get_resource, get_dependencies, filter_resources, count_resources) + 2 GraphQL tools (query_graph, get_schema) + 5 CLI tools (init, validate, plan, apply, output) = 12 total. terraform_state_list dropped — subsumed by list_resources.
[Kalhar 2026-03-28] Q5 resolved: Purpose-built tools return {resources/nodes, edges, total, summary}. GraphQL returns {data, errors} + meta with node count and truncation flag. Every response includes a human-readable summary string. Full schema in plans/tool-set-plan.md.
