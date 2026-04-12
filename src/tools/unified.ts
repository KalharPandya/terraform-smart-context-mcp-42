// Unified single-tool MCP registration — collapses 12 read-tier tools into one
// to minimize system prompt token overhead in Claude Code.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { graphql } from "graphql";
import { schema as gqlSchema, SDL } from "../graphql/schema.js";
import { rootValue } from "../graphql/resolvers.js";
import { validateQuery, getTimeout } from "../graphql/validation.js";
import {
  generateForInfra,
  generateForModule,
  generateForResource,
} from "../graphql/prebuilt.js";
import { dagGraph } from "../dag/graph.js";
import { runTerraform, toolResult } from "../terraform/cli.js";

// ─── Minimal description — every token here × every API turn ─────────────────

const DESCRIPTION = `Terraform infrastructure tool. Use \`type\` to pick the operation.

Types:
  query        — GraphQL against the dependency DAG (requires \`query\`)
  schema       — SDL + prebuilt queries (optional: module, resource)
  state_list   — List resources in state (optional: filter)
  state_show   — Show one resource (requires \`address\`)
  validate     — Check config syntax
  plan         — Preview changes (optional: varFile, vars, destroy)
  show         — Full state JSON
  output       — Read outputs (optional: name)
  graph        — DOT dependency graph
  providers    — List required providers
  fmt          — Check formatting
  init         — Initialize (optional: upgrade)

GraphQL (type=query): resource(id), resources(module?,type?,limit?), module(name), modules, path(fromId,toId), impact(resourceId,depth?), deploymentOrder(module?), summary.
Fields — cheap: id, shortName, module, resourceType, dependencies(depth?), dependents(depth?). Heavy (avoid bulk): attributes, tags.
Constraints: depth≤5, nodes≤100, resources() requires module or type filter.
Call type=schema first to get SDL + prebuilt queries with real resource IDs.`;

// ─── Input schema ────────────────────────────────────────────────────────────

const OP_TYPES = [
  "query", "schema", "state_list", "state_show", "validate", "plan",
  "show", "output", "graph", "providers", "fmt", "init",
] as const;

function buildInputSchema(rootDir: string | null) {
  return z.object({
    type: z.enum(OP_TYPES),
    workingDir: rootDir
      ? z.string().optional().default(rootDir)
      : z.string().describe("Absolute path to Terraform config directory"),
    // GraphQL
    query: z.string().optional().describe("GraphQL query (type=query)"),
    variables: z.record(z.unknown()).optional(),
    // Scoping
    module: z.string().optional(),
    resource: z.string().optional(),
    // CLI params
    address: z.string().optional().describe("Resource address (type=state_show)"),
    filter: z.string().optional(),
    name: z.string().optional().describe("Output name (type=output)"),
    varFile: z.string().optional(),
    vars: z.record(z.string()).optional(),
    destroy: z.boolean().optional(),
    upgrade: z.boolean().optional(),
    check: z.boolean().optional().default(true),
    graphType: z.enum(["plan", "plan-refresh-only", "plan-destroy", "apply"]).optional(),
  });
}

// ─── Handlers ────────────────────────────────────────────────────────────────

type Input = z.infer<ReturnType<typeof buildInputSchema>>;
type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

function text(t: string, isError = false): ToolResult {
  return { content: [{ type: "text" as const, text: t }], isError };
}

function run(args: string[], cwd: string): ToolResult {
  const r = runTerraform(args, cwd);
  return toolResult(r.stdout, r.stderr, r.exitCode);
}

async function handleQuery(input: Input): Promise<ToolResult> {
  const cwd = input.workingDir!;
  if (!input.query) return text("Missing `query` parameter", true);

  try { await dagGraph.ensureBuilt(cwd); } catch (e) {
    return text(`DAG build failed: ${e instanceof Error ? e.message : e}`, true);
  }

  const v = validateQuery(input.query);
  if (!v.ok) return text(`Query error: ${v.error}`, true);

  try {
    const result = await Promise.race([
      graphql({ schema: gqlSchema, source: input.query, rootValue, variableValues: input.variables as Record<string, unknown> }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Timeout (5s)")), getTimeout())),
    ]);
    if (result.errors?.length) return text(`GraphQL errors:\n${result.errors.map(e => e.message).join("\n")}`, true);
    return text(JSON.stringify(result.data, null, 2));
  } catch (e) {
    return text(`Execution error: ${e instanceof Error ? e.message : e}`, true);
  }
}

async function handleSchema(input: Input): Promise<ToolResult> {
  const cwd = input.workingDir!;
  try { await dagGraph.ensureBuilt(cwd); } catch (e) {
    return text(`DAG build failed: ${e instanceof Error ? e.message : e}`, true);
  }

  const prebuilt = input.resource
    ? generateForResource(input.resource)
    : input.module
      ? generateForModule(input.module)
      : generateForInfra();

  const sections = [
    "# GraphQL SDL\n```graphql\n" + SDL + "\n```",
    prebuilt.queries.length
      ? "# Prebuilt Queries\n_" + prebuilt.note + "_\n\n" +
        prebuilt.queries.map(q => `## ${q.title}\n\`\`\`graphql\n# ${q.description}\n${q.query}\n\`\`\``).join("\n\n")
      : "# Prebuilt Queries\n_" + prebuilt.note + "_",
  ];
  return text(sections.join("\n\n---\n\n"));
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

async function dispatch(input: Input): Promise<ToolResult> {
  const cwd = input.workingDir!;

  switch (input.type) {
    case "query":      return handleQuery(input);
    case "schema":     return handleSchema(input);
    case "state_list": {
      const args = ["state", "list", "-no-color"];
      if (input.filter) args.push(input.filter);
      return run(args, cwd);
    }
    case "state_show": {
      if (!input.address) return text("Missing `address` parameter", true);
      return run(["state", "show", "-no-color", input.address], cwd);
    }
    case "validate":   return run(["validate", "-no-color"], cwd);
    case "plan": {
      const args = ["plan", "-no-color", "-input=false"];
      if (input.destroy) args.push("-destroy");
      if (input.varFile) args.push(`-var-file=${input.varFile}`);
      if (input.vars) for (const [k, v] of Object.entries(input.vars)) args.push(`-var`, `${k}=${v}`);
      return run(args, cwd);
    }
    case "show":       return run(["show", "-json", "-no-color"], cwd);
    case "output": {
      const args = ["output", "-json", "-no-color"];
      if (input.name) args.push(input.name);
      return run(args, cwd);
    }
    case "graph": {
      const args = ["graph"];
      if (input.graphType) args.push(`-type=${input.graphType}`);
      return run(args, cwd);
    }
    case "providers":  return run(["providers", "-no-color"], cwd);
    case "fmt":        return run(["fmt", "-check", "-diff", "-no-color"], cwd);
    case "init": {
      const args = ["init", "-no-color"];
      if (input.upgrade) args.push("-upgrade");
      return run(args, cwd);
    }
    default:
      return text(`Unknown type: ${input.type}`, true);
  }
}

// ─── Registration ────────────────────────────────────────────────────────────

export function registerUnifiedTool(server: McpServer, rootDir: string | null) {
  server.registerTool(
    "terraform",
    {
      title: "Terraform",
      description: DESCRIPTION,
      inputSchema: buildInputSchema(rootDir),
    },
    async (input) => dispatch(input as unknown as Input)
  );
}
