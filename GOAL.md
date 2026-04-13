# GOAL.md — Project 42: Terraform MCP Server

> Read this before DECISIONS.md at every session start.
> This is the "why" behind every decision. When a choice is unclear, come back here.

---

## The Project in One Sentence

Build an MCP server that gives any AI agent structured, token-efficient access
to live Terraform infrastructure — so the agent queries exactly what it needs
instead of drowning in raw state.

---

## The Problem (Three Specific Failures)

**1. State is too large for context windows.**
A real Terraform state file contains thousands of resources, nested configs,
and provider metadata. You cannot dump it into an LLM. Even truncated versions
lose the resource relationships that make the state meaningful.

**2. Every interaction starts blind.**
The agent has no memory of what is deployed, no way to inspect running services,
and no access to plan output or logs. Each session begins from zero.

**3. Agents guess instead of looking.**
Without structured access to live infrastructure, LLMs hallucinate resource
arguments, generate deprecated attributes, and produce configs that look correct
but fail the moment Terraform touches a real cloud API. Provider schemas are
not static — models are trained on a snapshot, not the live registry.

**The analogy:**
Code editing agents (Cursor, Claude Code) solved this for programming by giving
the AI structured tools: read_file, edit_file, run_terminal. Terraform has no
equivalent. There is no standard way for an agent to ask "what's deployed" or
"show me this resource's config" without getting the entire state.

Project 42 builds that equivalent for infrastructure.

---

## How This Differs from Existing Tools

### vs HashiCorp terraform-mcp-server (github.com/hashicorp/terraform-mcp-server)

| | HashiCorp MCP | Project 42 |
|---|---|---|
| **What it answers** | "What arguments does `aws_instance` accept?" | "What is deployed in MY environment?" |
| **Data source** | Terraform Registry API (documentation) | Live Terraform state + CLI |
| **Runs local commands** | No | Yes |
| **Parses deployed state** | No | Yes |
| **Filtered/summarized views** | No | Core feature |
| **Dependency graph** | No | Yes |
| **Problem solved** | Provider documentation lookup | Context window overload + blind agents |

HashiCorp's MCP is a documentation tool. Project 42 is an infrastructure
introspection and interaction tool. They do not overlap in problem space.

### vs Claude Code (answering "can't Claude Code do it already?")

Claude Code CAN run `terraform show -json` or `terraform state list` through
its bash tool. That is precisely the problem.

When Claude Code runs `terraform show -json` on a real project, it gets the
entire raw state JSON — thousands of lines — dumped directly into its context
window. No filtering. No structure. No dependency graph. The agent has to parse
it all. This is the context window overflow problem in action, not a solution to it.

**What Claude Code lacks and Project 42 provides:**

| Capability | Claude Code | Project 42 MCP |
|---|---|---|
| Run terraform commands | Yes (raw output) | Yes (structured, filtered output) |
| Get only network resources | No — must read full state | Yes — `query_graph` with `resources(module:"networking")` |
| See dependency graph of one resource | No — must parse entire state | Yes — `impact(resourceId)` or `path(from, to)` via GraphQL |
| Deployment ordering | No — must trace manually | Yes — `deploymentOrder(module?)` query |
| Works with GPT, Gemini, Cursor, Codex | No — Anthropic only | Yes — any MCP-compliant client |
| Token cost for "what's deployed?" | High (full state in context) | Low (one DAG query call) |

The difference is the abstraction layer. Claude Code gives you a terminal.
Project 42 gives you purpose-built queries. The first floods context.
The second answers the question.

---

## What We Are Building (v1 Scope)

### Primary Interface — Unified Tool (default)

In the default configuration (`TERRAFORM_MCP_UNIFIED=1`), the LLM sees a single
`terraform` tool with a `type` parameter selecting the operation. This minimises
tool-enumeration overhead and keeps the LLM focused on queries rather than picking
between 17 tool names.

| `type` value | What It Does |
|---|---|
| `schema` | Return GraphQL SDL + prebuilt queries scoped to live infrastructure |
| `query` | Execute a GraphQL query against the dependency DAG |
| `state_list` | List all deployed resources |
| `state_show` | Show one resource's full attributes |
| `plan` | Preview changes (read-only, no side effects) |
| `validate` | Check configuration syntax |
| `show` | Full state as structured JSON |
| `output` | Retrieve output values |
| `graph` | Graphviz DOT dependency graph |
| `init` | Initialise working directory |

### DAG Query Layer (GraphQL)

The core abstraction. Parses `terraform show -json` into an in-memory directed graph
and exposes it via GraphQL — so the agent queries exactly the infrastructure slice it
needs, not the full state.

| Query | What It Returns |
|---|---|
| `resource(id)` | One resource: attributes, tags, dependencies, dependents |
| `resources(module?, type?)` | Filtered list — never a full state dump |
| `impact(resourceId, depth?)` | Blast radius — everything that breaks if a resource is destroyed |
| `path(fromId, toId)` | Shortest dependency path between two resources |
| `deploymentOrder(module?)` | Topological build/deploy order |
| `module(name)` | All resources in a module |
| `summary` | Total counts and type breakdown |

### Access Control — 3-Tier Gate

Tools are gated by the `TERRAFORM_MCP_GATE` environment variable.
The LLM can only discover and call tools at or below the configured tier.

| Gate | What's Added | Use Case |
|---|---|---|
| `read` (default) | Graph queries + read-only CLI tools | Exploration, planning, auditing |
| `write` | + apply, import, state mv | Controlled infrastructure changes |
| `destroy` | + destroy, state rm | Full control including deletion |

### Standard Tool Mode (`TERRAFORM_MCP_UNIFIED=0`)

When unified mode is disabled, the server exposes 17 individual named tools:
2 GraphQL tools (`query_graph`, `get_schema`) + 10 CLI wrappers + 3 write-tier + 2 destroy-tier.
This is useful for clients that benefit from named tool selection.

---

## What v1 Success Looks Like

Given a real Terraform project with 50+ resources:

1. `terraform(type="schema")` returns the GraphQL SDL and live prebuilt queries
   in under 1s — the agent knows exactly what to query without reading raw state
2. `terraform(type="query", query="{ impact(resourceId: \"...\") { affected { resource { id } } } }")`
   returns the blast radius of destroying one resource without the agent
   seeing any unrelated infrastructure
3. `terraform(type="plan")` returns Terraform plan output the agent can reason over
4. The same tools work identically when connected from Claude Desktop,
   Claude Code, Cursor, and Codex CLI

---

## What Is Explicitly Out of Scope for v1

- Distributed scaling, concurrent provisioning, or multi-user state locking
- Autonomous agent orchestration (we build the layer, not the agent)
- Saga-based rollback or multi-step workflow coordination
- Real cloud infrastructure in experiments (null provider is sufficient for
  validating tool behavior)
- Provider documentation lookups (that is HashiCorp's problem to solve)

---

## The Three Experiments

**Experiment 1 — Tool-Augmented vs. Raw State**
Same tasks: agent with MCP tools vs. agent with raw state dump in context.
Measures: task accuracy and token cost.
Answers: do the abstraction layers help, or just add noise?

**Experiment 2 — Abstraction Granularity**
Coarse tools (full resource dump) vs. fine-grained tools (filtered, summarized).
Measures: task success rate at each abstraction level.
Answers: what is the optimal granularity for tool responses?

**Experiment 3 — Cross-Model Portability**
Same tasks through Claude, GPT, and Gemini via the MCP server.
Measures: completion rates and tool usage patterns across models.
Answers: does the MCP add value across providers, or only with one?
If it only works well with one provider, the project has not solved the problem.

---

## Team and Ownership

| Person | Owns |
|---|---|
| **Kalhar** | Technical prototyping, MCP implementation, architecture slides |
| **Vinal** | AI-first development workflow, team alignment policies, project structure |
| **Parin** | MCP theory, protocol design, prompt engineering, tool naming and parameter design |

Shared: experiments, tool curation decisions, abstraction layer design.

---

## The One Design Principle

> The MCP server is a translation layer that turns thousands of lines of state
> into precise, token-efficient tool responses the agent can actually reason over.
> Get the abstractions wrong and the agent hallucinates.
> Get them right and any model becomes a competent infrastructure operator.

---

## Course Context

- **Course:** CS 6650 — Distributed Systems
- **University:** Northeastern University Vancouver
- **All members:** Master's in CS students
- **Presentation:** 5-minute pitch, all 3 members presenting

---

## One-Sentence Answer to Every Objection

| Objection | Answer |
|---|---|
| "Can't Claude Code do it already?" | Claude Code gives you raw terminal output. We give you filtered queries. Raw state is the problem, not the solution. |
| "Isn't this just HashiCorp's MCP?" | HashiCorp answers "what does this provider support?" We answer "what is actually deployed?" |
| "Doesn't this reinvent the wheel?" | We build one protocol layer. Every MCP-compliant agent gets it for free — Claude, GPT, Gemini, Cursor, Copilot. |
| "Why not just give the agent the state file?" | We did. It didn't fit in the context window. That is why this project exists. |
