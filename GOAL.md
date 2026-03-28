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
| Get only network resources | No — must read full state | Yes — `list_resources(type="aws_subnet")` |
| See dependency graph of one resource | No — must parse entire state | Yes — `get_dependencies(resource_id)` |
| Read plan as clean diff | No — raw plan JSON | Yes — diffed, human-readable summary |
| Validate cloud CLI auth before starting | No | Yes — startup auth check |
| Works with GPT, Gemini, Cursor, Copilot | No — Anthropic only | Yes — any MCP-compliant client |
| Token cost for "what's deployed?" | High (full state in context) | Low (one filtered tool call) |

The difference is the abstraction layer. Claude Code gives you a terminal.
Project 42 gives you purpose-built queries. The first floods context.
The second answers the question.

---

## What We Are Building (v1 Scope)

### Infrastructure State Tools
| Tool | What It Returns |
|---|---|
| `list_resources` | Resources filtered by type — never a full state dump |
| `get_resource_config` | One resource's full configuration |
| `find_resource_by_tag` | Resources matching a tag, name, or type query |
| `get_drift_status` | Detected configuration drift on a resource |

### Terraform CLI Tools
| Tool | What It Returns |
|---|---|
| `tf_plan` | Diffed plan output — clean change summary, not raw JSON |
| `tf_apply` | Applies changes with explicit confirm gate |
| `read_logs` | Terraform and provider log access |

### The Abstraction Layer (core design work)
- Filtered views scoped per resource type — agent never sees full state
- Dependency graphs as structured edges — not raw JSON
- Diffed plan output the agent can reason over
- Pre-authenticated CLI access: server validates cloud CLI auth on startup
  (AWS, GCP, Azure, or any CLI-configured provider)

---

## What v1 Success Looks Like

Given a real Terraform project with 50+ resources:

1. `list_resources(type="aws_instance")` returns only EC2 instances, not the
   full state, in under 500ms
2. `get_resource_config(id)` returns one resource's config without the agent
   seeing any other resource
3. `tf_plan` returns a clean diff summary the agent can describe in plain English
   without parsing raw plan JSON
4. The same tools work identically when connected from Claude Desktop,
   Claude Code, and Cursor

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
