// GraphQL query validation guards — depth, size, bare-query rejection

import { parse, validate, DocumentNode, Kind, type FieldNode } from "graphql";
import { schema } from "./schema.js";

const MAX_DEPTH = 5;
const MAX_LIMIT = 100;
const EXEC_TIMEOUT_MS = 5000;

export interface ValidationResult {
  ok: boolean;
  error?: string;
  document?: DocumentNode;
}

export function validateQuery(queryStr: string): ValidationResult {
  // Reject empty / whitespace-only
  if (!queryStr.trim()) {
    return { ok: false, error: "Query string is empty." };
  }

  // Parse
  let document: DocumentNode;
  try {
    document = parse(queryStr);
  } catch (err) {
    return { ok: false, error: `Parse error: ${err instanceof Error ? err.message : String(err)}` };
  }

  // Schema validation (type errors, unknown fields, etc.)
  const errors = validate(schema, document);
  if (errors.length) {
    return { ok: false, error: errors.map((e) => e.message).join("; ") };
  }

  // Depth guard
  const depthError = checkDepth(document);
  if (depthError) return { ok: false, error: depthError };

  // Bare resources{} guard — resources without module/type filter is expensive
  const bareError = checkBareResources(queryStr, document);
  if (bareError) return { ok: false, error: bareError };

  return { ok: true, document };
}

export function getTimeout(): number {
  return EXEC_TIMEOUT_MS;
}

// ─── Private guards ───────────────────────────────────────────────────────────

function checkDepth(doc: DocumentNode): string | null {
  for (const def of doc.definitions) {
    if (def.kind !== "OperationDefinition") continue;
    const depth = maxSelectionDepth(def.selectionSet, 0);
    if (depth > MAX_DEPTH) {
      return `Query depth ${depth} exceeds maximum of ${MAX_DEPTH}. Reduce nesting.`;
    }
  }
  return null;
}

function maxSelectionDepth(
  selectionSet: { selections: readonly { kind: string; selectionSet?: unknown }[] } | undefined | null,
  current: number
): number {
  if (!selectionSet) return current;
  let max = current;
  for (const sel of selectionSet.selections) {
    if (sel.kind === "Field" && sel.selectionSet) {
      const d = maxSelectionDepth(
        sel.selectionSet as Parameters<typeof maxSelectionDepth>[0],
        current + 1
      );
      if (d > max) max = d;
    }
  }
  return max;
}

function checkBareResources(_queryStr: string, doc?: DocumentNode): string | null {
  if (!doc) return null;

  // Walk only the root-level selections (the Query type fields)
  for (const def of doc.definitions) {
    if (def.kind !== Kind.OPERATION_DEFINITION) continue;
    for (const sel of def.selectionSet.selections) {
      if (sel.kind !== Kind.FIELD) continue;
      const field = sel as FieldNode;
      if (field.name.value !== "resources") continue;

      // Check if module or type argument is present
      const hasFilter = field.arguments?.some(
        (arg) => arg.name.value === "module" || arg.name.value === "type"
      );
      if (!hasFilter) {
        return (
          'resources{} without a module or type filter is rejected. ' +
          'Use resources(module: "...") or resources(type: "...") to scope the query.'
        );
      }
    }
  }
  return null;
}

export { MAX_LIMIT };
