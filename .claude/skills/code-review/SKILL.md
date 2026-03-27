---
name: code-review
description: Use when reviewing code, designs, or PRs — applies severity levels, rule citations, and structured verdict format across all review types.
---

# SKILL: Code Review (Meta-Framework)

**Triggers when:** conducting any review — code, design, or PR.

This skill defines *how* to review. Domain skills define *what* correct looks like.
Always apply this skill alongside the relevant domain skill(s).

---

## Core Principle

**Every piece of feedback must cite a rule.**

Claude cannot say "this is wrong" or "this could be better" without linking the
feedback to one of:
- A `DECISIONS.md` entry (cite the name and date)
- A skill convention (cite the skill and section)
- A general principle listed in this file

Subjective feedback — "I'd prefer", "this feels off", "cleaner to" — is not
valid review feedback. If you cannot cite a rule, it is a suggestion at most,
and must be labeled as such.

---

## Severity Levels

Every finding must carry exactly one severity level.

### BLOCKING
Must be resolved before this work merges or ships.
Use when: the code violates a team decision, breaks a documented convention,
introduces a security vulnerability, or produces incorrect behavior.

### WARNING
Should be resolved but does not block merge.
Use when: the code does not follow a best practice from a skill, introduces
technical debt that will matter soon, or is unclear enough to cause future bugs.

### SUGGESTION
Optional improvement. No action required.
Use when: there is a cleaner approach, a naming improvement, or a minor
readability gain. The current code is not wrong — this is preference territory.

**Default up, not down.** When unsure between BLOCKING and WARNING, use BLOCKING.
When unsure between WARNING and SUGGESTION, use WARNING.

---

## Review Categories

Apply all relevant categories for every review. Skip a category only if it
genuinely does not apply — note the skip and why.

| Category | What to check |
|----------|--------------|
| **Decisions Compliance** | Does this violate any entry in DECISIONS.md? |
| **Skill Compliance** | Does this follow conventions in the relevant domain skill(s)? |
| **Correctness** | Does this do what it claims? Are edge cases handled? |
| **Context Efficiency** | Does this return or process more data than necessary? |
| **Security** | Any input validation gaps, injection risks, or exposed internals? |
| **Error Handling** | Are all failure paths handled? Are errors structured, not thrown? |

---

## Rule Citation Format

Every finding must include a citation in this format:

```
[SOURCE → RULE]
```

Examples:
```
[DECISIONS.md → Alice 2026-03-20: nodes are resource_type.resource_name]
[SKILL: mcp-server-patterns → Tool Naming: verb_noun format only]
[SKILL: context-reduction → Traversal Rules: never exceed depth 3]
[SKILL: code-review → Error Handling: never throw, always return structured error]
```

If no citation exists for a finding, it cannot be BLOCKING or WARNING.
Downgrade it to SUGGESTION and note that a decision may need to be made.

---

## Structured Output Format

Every review must produce output in exactly this format.
Do not deviate from this structure — consistency is what makes this a framework.

```
## Review: [name of file, PR, or design]
Type: Code Review | Design Review | PR Review
Date: YYYY-MM-DD

### BLOCKING
- [SOURCE → RULE] Description of violation. Line or location if applicable.

### WARNING
- [SOURCE → RULE] Description of concern. Line or location if applicable.

### SUGGESTION
- [SOURCE → RULE] Optional improvement. Why it would help.

### Skipped Categories
- [Category name]: reason skipped

### Verdict
PASS | PASS WITH WARNINGS | FAIL

Verdict reasoning in one or two sentences.
```

**Verdict rules:**
- `FAIL` — any BLOCKING finding
- `PASS WITH WARNINGS` — no BLOCKING, one or more WARNING findings
- `PASS` — no BLOCKING, no WARNING findings (SUGGESTION only or clean)

If a section has no findings, write `None.` — do not omit the section.

---

## Applying Domain Skills During Review

Before starting any review:

1. Identify which domain skills apply based on what is being reviewed:
   - `.tf` files or HCL → `terraform-parsing`
   - DAG nodes, edges, graph logic → `dag-design`
   - MCP tool definitions or handlers → `mcp-server-patterns`
   - Subgraph selection or response construction → `context-reduction`

2. Load and apply those skills alongside this one.

3. Each domain skill violation is a finding. Cite the skill and section.

4. If no domain skill applies to a file, note it and review against
   general correctness and error handling only.

---

## What Review Is Not

- Not a style guide enforcement session — formatting is not a finding unless
  it causes misreads or bugs
- Not a refactoring session — do not suggest rewrites unless correctness is at stake
- Not a preference exercise — if the code works and follows the rules, it passes
- Not exhaustive — focus on what matters, not everything that could be different
