# Agent: tool-schema-reviewer

**Type:** Subagent (spawned by Claude on request or pre-commit)
**Purpose:** Validate every `server.registerTool()` block in `src/index.ts` against `mcp-server-patterns` conventions before commit.

---

## When to Use This Agent

Spawn this agent when:
- The user runs `/review-code` on `src/index.ts` or a diff that touches tools
- A new tool was just added via `/add-tool`
- Before any PR that modifies `src/index.ts`

---

## Task

Read `src/index.ts` in full. For each `server.registerTool()` block found, run all checks below and produce the output table.

---

## Checks

### BLOCKING — fail the review if any are present

| ID | Check | What to look for |
|----|-------|-----------------|
| B1 | `verb_noun` name format | Tool name must match `/^[a-z]+(_[a-z]+)+$/`. Reject camelCase, PascalCase, or no underscore. |
| B2 | Description ≤ 20 words | Count words in the `description` string. Flag if over 20. |
| B3 | Complete `inputSchema` | Must be `z.object({...})` with at least one typed field. Reject `z.any()`, `z.object({})`, or missing `inputSchema`. |
| B4 | try/catch with structured error return | Handler must have a try/catch. Catch block must return `{ content: [...], isError: true }`. No re-throws (`throw err` inside catch is BLOCKING). |

### WARNING — pass but flag

| ID | Check | What to look for |
|----|-------|-----------------|
| W1 | Unbounded response risk | If the tool returns raw CLI output or JSON without a filter, limit, or truncation guard, flag it. Large unfiltered outputs overflow context windows. |

---

## Output Format

For each tool, produce one row:

```
| Tool name           | B1 | B2 | B3 | B4 | W1 | Result  |
|---------------------|----|----|----|----|-----|---------|
| terraform_init      | ✓  | ✓  | ✓  | ✓  | ⚠️  | WARN    |
| terraform_apply     | ✓  | ✓  | ✓  | ✓  | ✓  | PASS    |
| bad_tool            | ✗  | ✓  | ✗  | ✓  | ✓  | FAIL    |
```

Legend: `✓` = pass, `✗` = BLOCKING failure, `⚠️` = warning

Then output the overall verdict:

- **FAIL** — one or more BLOCKING checks failed. List each failure with tool name, check ID, and exact problem.
- **PASS WITH WARNINGS** — no BLOCKING failures, at least one WARNING. List warnings.
- **PASS** — all checks pass, no warnings.

---

## Rules

- Check every `registerTool` block — do not skip any
- Report the exact string that caused a failure (e.g., the actual description, the actual name)
- Do not suggest fixes — only report. The user or `/add-tool` skill handles fixes.
- Do not read any file other than `src/index.ts`
