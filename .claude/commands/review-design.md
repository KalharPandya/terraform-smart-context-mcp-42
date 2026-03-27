# /review-design — Review a Proposed Approach Before Building

Use this before writing code to validate that a design aligns with team decisions
and domain skill conventions. Catching misalignment here costs nothing.
Catching it after implementation costs a rewrite.

---

## Steps

**1. Collect the design using the team prompt structure.**

Ask for the design using this format:

```
Context: [what part of the system this design touches]
Goal: [what problem this design solves]
Decision: [relevant DECISIONS.md entry — or "none"]
Ask: [what you want reviewed about this design]
```

If the user provides a free-form description, restate it in this format before
proceeding. Confirm it is accurate before moving forward.

---

**2. Read DECISIONS.md fully.**

This is not optional for design review.

Check every existing decision for:
- Direct conflicts — the proposed design contradicts a committed decision
- Partial overlaps — the design assumes something that is partially decided
- Open questions — the design depends on a question still unresolved

Flag all three. A design that depends on an unresolved open question cannot
pass review — the question must be resolved first via `/commit-decision`.

---

**3. Identify which domain skills apply.**

Based on what the design touches:

| If the design involves... | Apply skill |
|--------------------------|-------------|
| Parsing `.tf` files or HCL | `terraform-parsing` |
| DAG structure, nodes, edges | `dag-design` |
| MCP tool definitions | `mcp-server-patterns` |
| What to return to an LLM | `context-reduction` |

Load all applicable skills and check the design against their conventions.
A design that violates a skill convention is a WARNING unless it also violates
a committed decision — in that case it is BLOCKING.

---

**4. Check for decisions the design implies but has not committed.**

A design review often surfaces new decisions hiding inside assumptions.

Examples:
- "I'll use resource nodes only" → implies a decision about what a node is
- "I'll return depth 3 by default" → contradicts the context-reduction skill
- "I'll use a WASM HCL parser" → implies a decision about the parser library

For each implied decision found:
- Flag it explicitly
- Ask: "Is this already decided? If not, run `/commit-decision` before building."

Do not let a design go to implementation with unresolved embedded decisions.

---

**5. Apply the `code-review` skill framework — adapted for design.**

Run these categories against the proposed design (not code):

- **Decisions Compliance** — does the design conflict with any DECISIONS.md entry?
- **Skill Compliance** — does the design follow domain skill conventions?
- **Correctness** — does this design actually solve the stated goal?
- **Context Efficiency** — if this ships, will it return more data than necessary?
- **Security** — does the design introduce any input validation or exposure risks?
- **Error Handling** — does the design account for failure paths?

---

**6. Output the structured review.**

```
## Review: [design name or description]
Type: Design Review
Date: YYYY-MM-DD

### BLOCKING
- [SOURCE → RULE] Description of conflict or violation.

### WARNING
- [SOURCE → RULE] Description of concern.

### SUGGESTION
- [SOURCE → RULE] Optional improvement.

### Implied Decisions
- [description of assumption that needs a committed decision]

### Skipped Categories
- [Category]: reason

### Verdict
PASS | PASS WITH WARNINGS | FAIL

One or two sentence reasoning.
```

---

**7. If verdict is PASS or PASS WITH WARNINGS:**

Ask: "Do any of the implied decisions need to be committed before you start?"
If yes: run `/commit-decision` for each one before the user writes any code.

**8. If verdict is FAIL:**

Do not proceed to implementation.
Work through each BLOCKING finding and revise the design.
Re-run `/review-design` on the revised design before building.
