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
