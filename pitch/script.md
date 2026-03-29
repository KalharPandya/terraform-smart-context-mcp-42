# Elevator Pitch Script — Project 42

**Speaker:** Vinal Dsouza
**Duration:** ~2 minutes
**Format:** Solo, screen recording with slides

---

## Slide 1 — Hook

Every AI coding tool — Cursor, Copilot, Claude Code — solved the same core problem:
don't dump the entire codebase into the model. Read only what's relevant.
That insight built a $10 billion market.

Infrastructure has the exact same problem. And nobody has solved it.

---

## Slide 2 — Problem

Today, if an AI agent needs to reason over your cloud environment, it runs
`terraform show -json` and gets back six thousand lines of raw state.
Every resource, every attribute, all at once. No structure. No filtering.
No dependency graph.

The agent either hallucinates because the state doesn't fit in context —
or burns through tokens parsing noise to find the two resources it actually needed.
At scale, across hundreds of resources and multiple environments,
that compounds into real cost.

---

## Slide 3 — Solution

We are building the missing layer. It's an MCP server — the same protocol that powers
tool use in Claude, Cursor, and Copilot — that turns raw Terraform state into
a queryable dependency graph.

Instead of dumping state, the agent asks: "what depends on this database instance?"
— and gets back exactly that subgraph. Typed nodes, edges, a clean summary.
One tool call. Nothing else in context.

Twelve purpose-built tools. Resource queries, dependency traversal, drift detection,
plan diffing. Works with Claude, GPT, Gemini, Cursor —
any MCP-compatible agent, today.

---

## Slide 4 — Proof

We ran a controlled baseline to quantify the problem: 75-resource infrastructure,
10 task categories, 30 trials. Raw CLI consumed 1.49 million tokens at $1.73 per run.
That's on a toy environment. Real production runs 500, 1,000, 5,000 resources.
That cost curve doesn't stay at $1.73. Our server eliminates the noise before it
ever hits the context window — same accuracy, a fraction of the cost, at any scale.

---

## Slide 5 — Close

The abstraction layer that infrastructure has been missing. We're building it.

---

## Delivery Notes

- Know the 5 beats cold — don't read word for word
- Pause after "nobody has solved it" — full stop, hold eye contact, then continue
- Slow down on the numbers: 1.49 million, $1.73, 30 trials — say them clearly
- On slide 4, let each scale number land: "500... 1,000... 5,000 resources"
- After the final line, hold eye contact with the camera for 2 seconds before stopping
- Do 3–4 takes, pick the best one — first take is warmup
