---
name: mcp-server-patterns
description: Use when building, reviewing, or discussing MCP tools — naming conventions, tool structure, error handling, input validation, or context efficiency rules.
---

# SKILL: MCP Server Patterns

**Triggers when:** building, discussing, or reviewing MCP tools.

---

## Tool Naming

**Format: `verb_noun` only. No exceptions.**

| Correct | Wrong |
|---------|-------|
| `get_subgraph` | `getSubgraph` |
| `get_dependencies` | `GetDeps` |
| `get_dependents` | `dependents_get` |
| `explain_resource` | `explainResource` |

Every tool name that ships must follow this format.
Review all tool names before committing.

---

## Tool Structure

Every MCP tool must have all four of these:

```typescript
server.registerTool(
  "verb_noun",                                      // verb_noun string
  {
    title: "Human Readable Title",
    description: "One sentence, under 20 words.",   // short — every word costs context
    inputSchema: z.object({                         // zod schema — never z.any() or empty
      requiredField: z.string().describe("..."),
      optionalField: z.boolean().optional().describe("..."),
    }),
  },
  async ({ requiredField, optionalField }) => {     // destructured from zod shape
    try {
      // implementation
      return { content: [{ type: "text" as const, text: "..." }] };
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

Do not ship a tool missing any of these four fields.

---

## Error Handling

**Never throw. Always return a structured error object.**

```typescript
// Wrong
throw new Error("Resource not found")

// Correct
return {
  error: true,
  code: "RESOURCE_NOT_FOUND",
  message: "No resource with id 'aws_vpc.main' found in graph"
}
```

The caller should never see an unhandled exception.
All `async` handlers must have a `try/catch` that returns a structured error.

---

## Context Efficiency Rules

These rules exist because the whole point of this server is reducing context.

- **Keep tool descriptions short.** Every word in a description consumes
  tokens when the LLM reads the tool list. Under 20 words.

- **Return only what the LLM needs.** If the LLM asked for dependencies,
  return dependency IDs and types — not the full resource config of each one.

- **Strip internal fields from responses.** Fields like `metadata.filePath`
  and `metadata.lineNumber` are useful for debugging but not for LLM consumption.
  Keep them out of tool responses unless explicitly requested.

---

## Gotchas

- **MCP tools appear synchronous to the caller.**
  The caller does not see async. Handle all async internally and always
  return a resolved value, never a promise the caller must await.

- **Validate all inputs before any processing.**
  Check required fields, types, and known node IDs before touching the graph.
  Return a structured validation error early rather than failing deep in processing.

- **A tool that returns too much data defeats the entire purpose.**
  If a tool response could contain the full Terraform graph, something is wrong.
  Every tool should have an implicit or explicit size contract.
  See the `context-reduction` skill for traversal depth rules.
