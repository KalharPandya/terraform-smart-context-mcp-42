---
name: add-tool
description: Use when scaffolding a new MCP tool in src/index.ts — enforces verb_noun naming, zod schema, try/catch, and tsc verification.
---

# Skill: add-tool

**User-invocable:** `/add-tool`
**Purpose:** Scaffold a new MCP tool block in `src/index.ts` following project conventions.

---

## When This Skill Is Used

When the user runs `/add-tool`, guide them through collecting inputs, validate the name format, check for conflicts, generate the full `server.registerTool()` block, insert it into the correct location in `src/index.ts`, and verify the result compiles.

---

## Steps

### 1. Collect inputs

Ask the user for the following (all at once, in one message):

- **Tool name** — must be `verb_noun` format (e.g., `get_subgraph`, `list_resources`). Reject anything that uses camelCase, PascalCase, or has no underscore.
- **Title** — short human-readable display name (e.g., `"Get Subgraph"`)
- **Description** — one sentence, ≤ 20 words, starting with a verb. Explain what the tool returns, not how it works.
- **Inputs** — list each input as: `name: type (optional?) — description`. At minimum one input is required.

Do not proceed until all four are provided.

### 2. Validate tool name

- Must match `/^[a-z]+(_[a-z]+)+$/` — all lowercase, at least one underscore, no numbers
- If invalid: explain the `verb_noun` rule and ask again
- If valid: grep `src/index.ts` for the name to check for conflicts

```bash
grep -n "\"<tool_name>\"" src/index.ts
```

If a conflict is found, tell the user and stop. Do not overwrite existing tools.

### 3. Generate the tool block

Use this exact template. Replace all `<placeholders>`.

```typescript
// ─── Tool: <tool_name> ─────────────────────────────────────────────────────────

server.registerTool(
  "<tool_name>",
  {
    title: "<Title>",
    description: "<Description — ≤ 20 words, starts with a verb>",
    inputSchema: z.object({
      <input_name>: z
        .<zod_type>()
        <.optional() if optional>
        .describe("<input description>"),
      // ... repeat for each input
    }),
  },
  async ({ <destructured_inputs> }) => {
    try {
      // TODO: implement
      return {
        content: [{ type: "text" as const, text: "" }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);
```

**Zod type mapping:**
| Input type | Zod |
|-----------|-----|
| string | `z.string()` |
| number | `z.number()` |
| boolean | `z.boolean()` |
| string[] | `z.array(z.string())` |
| key-value object | `z.record(z.string())` |

### 4. Insert into `src/index.ts`

Insert the generated block immediately **before** the `// ─── Start ───` comment line.

Preserve the blank line between the new block and the Start comment.

### 5. Run tsc to verify

```bash
node_modules/.bin/tsc --noEmit
```

If there are errors, show them and fix before finishing.

If clean, confirm: "Tool `<tool_name>` added. Run `/review-code` before committing."

---

## Rules

- Never use `z.any()` or an empty `z.object({})` — every tool must have at least one typed input
- Never skip the try/catch — structured error returns are required by `mcp-server-patterns`
- Never re-throw inside the handler — catch and return `{ isError: true }`
- Description must be ≤ 20 words — count and enforce
- Section header comment must match the format exactly: `// ─── Tool: <tool_name> ───...` (use em-dashes `─`, not hyphens)
