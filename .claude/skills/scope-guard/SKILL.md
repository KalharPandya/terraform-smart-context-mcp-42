# Skill: scope-guard

**User-invocable:** false — Claude invokes this automatically
**Purpose:** Catch v1 scope drift before any implementation begins.

---

## When This Skill Triggers

Automatically apply this skill when ANY of the following are proposed:

- A new tool, feature, capability, or integration not yet in `src/index.ts` or `plans/tool-set-plan.md`
- An experiment, infrastructure component, or provider not in `experiments/baseline/`
- A change to the MCP protocol, agent orchestration, or cross-service coordination

**Do not wait for the user to ask.** If a proposal pattern-matches any out-of-scope item below, issue the SCOPE ALERT before writing a single line of code.

---

## Out-of-Scope Patterns (from GOAL.md)

| Pattern | Example requests that trigger this |
|---------|-----------------------------------|
| Distributed scaling / concurrent provisioning / state locking | "add multi-user support", "handle concurrent runs", "state lock manager" |
| Autonomous agent orchestration | "make the agent decide when to apply", "auto-remediation loop", "self-healing infra" |
| Saga-based rollback / multi-step workflow coordination | "rollback on failure", "compensating transactions", "workflow engine" |
| Real cloud infrastructure in experiments | "test against real AWS", "provision actual EC2", "use a live account" |
| Provider documentation lookups | "look up resource arguments", "fetch registry docs", "provider schema search" |

---

## Behaviour

When a proposal matches any out-of-scope pattern, output this block **before any other response**:

```
⚠️  SCOPE ALERT

Proposed: <one-line summary of what was proposed>
Status:   Out of scope for v1 (GOAL.md)
Reason:   <which out-of-scope pattern it matches>

Options:
  A) Drop it — stay in v1 scope, proceed with what was originally asked
  B) Expand scope — run /commit-decision to formally record this as a team decision first

Which do you want to do?
```

**Do not proceed with implementation until the user picks A or B.**

If the user picks B, remind them: "Run `/commit-decision` first. Once committed to DECISIONS.md, we can build it."

---

## What Is NOT a Scope Alert

Do not trigger on:

- Adding v1 tools from `plans/tool-set-plan.md` — already in scope
- Improving existing tool responses (filtering, formatting, summarizing)
- Experiment work within `experiments/baseline/` using null_resource
- Documentation, NOTES.md, DECISIONS.md, or CHANGELOG.md updates
- Refactoring `src/index.ts` without adding new capabilities
