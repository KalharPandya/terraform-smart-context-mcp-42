# SKILL: Context Reduction

**Triggers when:** deciding what subgraph to return to an LLM.

---

## Core Principle

**The goal is minimum viable context.**

More context is not better — excess context is the problem this server exists to solve.
When in doubt, return less. Let the LLM ask for more if it needs it.

---

## Traversal Rules

| Rule | Value |
|------|-------|
| Default depth | 2 hops from queried node |
| Coverage | Depth 2 covers ~80% of real use cases |
| Hard limit | Never exceed depth 3 without explicit user request |
| Anchor | Always include the queried node itself |

**Depth 1** = direct dependencies and direct dependents of the queried node.
**Depth 2** = nodes with a direct relationship to any depth-1 node.
**Depth 3+** = only on explicit request. Flag to the caller that this is a large response.

---

## What to Include

- The queried node (always)
- Direct dependencies — nodes this node depends on (1 hop out)
- Direct dependents — nodes that depend on this node (1 hop in)
- At depth 2: only nodes with a direct edge to a depth-1 node

---

## What to Exclude

- Unrelated resources with no path to the queried node
- Full module internals — expose only module `inputs` and `outputs`, not internal resources
- Internal metadata fields the LLM does not need (`filePath`, `lineNumber`, etc.)
- Duplicate edges — deduplicate before returning

---

## Output Format

Return minimal JSON. Every field in the response is a cost.

**Per node:**
```json
{ "id": "aws_subnet.public", "type": "resource", "config": { /* relevant fields only */ } }
```

**Per edge:**
```json
{ "from": "aws_subnet.public", "to": "aws_vpc.main", "type": "implicit" }
```

**Include a human-readable summary** alongside the JSON — one short paragraph
describing what the subgraph contains and why these nodes are related.
This helps the LLM orient without parsing the full JSON.

---

## Gotchas

- **Deeper traversal = more context = defeats the purpose.**
  Do not increase default depth because it feels safer to include more.
  It is not safer. It is the failure mode we are building against.

- **A full graph dump is never the right answer.**
  If a code path can return the entire graph, add a guard. It should not be possible
  to accidentally return every node through a normal tool call.

- **When in doubt, return less and let the LLM ask for more.**
  An LLM that gets too little can ask a follow-up question.
  An LLM that gets a 10,000-token graph dump cannot unsee it.
