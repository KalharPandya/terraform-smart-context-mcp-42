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
