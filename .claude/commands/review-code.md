# /review-code — Review a File or Diff Against Project Standards

Use this to review a specific file or set of changes before committing or merging.
For a full PR review across all changed files, use `/review-pr` instead.

---

## Steps

**1. Ask: what are we reviewing?**

Accept any of:
- A file path (e.g., `src/parser.ts`)
- A git diff (e.g., `git diff HEAD~1 -- src/parser.ts`)
- A pasted code block

If a file path is given, read the file.
If nothing is specified, run `git diff --staged` and review staged changes.

---

**2. Identify which domain skills apply.**

Based on what is being reviewed, determine which skills are relevant:

| If reviewing... | Apply skill |
|----------------|-------------|
| `.tf` files or HCL parsing logic | `terraform-parsing` |
| DAG nodes, edges, graph construction | `dag-design` |
| MCP tool definitions or handlers | `mcp-server-patterns` + `add-tool` |
| Subgraph selection, response building | `context-reduction` |
| New feature or capability proposal | `scope-guard` |

Load all applicable skills. A single file may trigger multiple skills.

---

**3. Read DECISIONS.md.**

Scan all entries in the Decisions section.
Flag any decision that is directly relevant to what is being reviewed.
This is the highest-priority check — a decision violation is always BLOCKING.

---

**4. Apply the `code-review` skill framework.**

Run through all six review categories:

- **Decisions Compliance** — does anything violate DECISIONS.md?
- **Skill Compliance** — does anything violate domain skill conventions?
- **Correctness** — does the code do what it claims? Are edge cases handled?
- **Context Efficiency** — is data returned or processed beyond what is needed?
- **Security** — any input validation gaps, injection risks, exposed internals?
- **Error Handling** — are all failure paths handled with structured errors, not throws?

For each finding: assign severity (BLOCKING / WARNING / SUGGESTION) and cite the rule.

---

**5. Output the structured review.**

Use exactly this format:

```
## Review: [filename or description]
Type: Code Review
Date: YYYY-MM-DD

### BLOCKING
- [SOURCE → RULE] Description. Line or location if applicable.

### WARNING
- [SOURCE → RULE] Description. Line or location if applicable.

### SUGGESTION
- [SOURCE → RULE] Optional improvement.

### Skipped Categories
- [Category]: reason

### Verdict
PASS | PASS WITH WARNINGS | FAIL

One or two sentence reasoning.
```

Write `None.` in any section with no findings. Do not omit sections.

---

**6. If verdict is FAIL:**

List the BLOCKING findings clearly.
Ask: "Do you want to fix these now, or commit them to NOTES.md as a blocker?"

- If fixing now: work through each BLOCKING finding one at a time
- If logging as blocker: run `/sync-context` to add to Open Blockers
