// MCP tool: query_graph — executes GraphQL against the live Terraform DAG

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { graphql } from "graphql";
import { schema } from "../graphql/schema.js";
import { rootValue } from "../graphql/resolvers.js";
import { validateQuery, getTimeout } from "../graphql/validation.js";
import { dagGraph } from "../dag/graph.js";

// Compact schema summary baked into the tool description — always visible to LLM
const SCHEMA_SUMMARY = `Execute a GraphQL query against the Terraform infrastructure DAG.

Available queries:
  resource(id)                        → Resource details, attributes, tags
  resources(module?, type?, limit?)   → Filtered resource list (filter required)
  module(name)                        → Module with resource list
  modules                             → All modules with resource counts
  path(fromId, toId)                  → Shortest dependency path between two resources
  impact(resourceId, depth?)          → What breaks if this resource is destroyed
  deploymentOrder(module?)            → Topological build/deploy order
  summary                             → Total counts and type breakdown

Resource fields: id, shortName, module, resourceType, attributes (full state), tags
  .dependencies(depth?)  → Resources this node depends ON
  .dependents(depth?)    → Resources that depend ON this node

Constraints: depth limit 5, node limit 100 (default 50), resources() requires module or type filter.
Call get_schema for the full SDL and ready-to-run example queries built from your infrastructure.`;

export function registerQueryGraph(
  server: McpServer,
  rootDir: string | null
) {
  server.registerTool(
    "query_graph",
    {
      title: "Query Infrastructure Graph",
      description: SCHEMA_SUMMARY,
      inputSchema: z.object({
        query: z.string().describe("GraphQL query string"),
        workingDir: rootDir
          ? z.string().optional().default(rootDir).describe("Terraform config directory (defaults to MCP root)")
          : z.string().describe("Absolute path to the Terraform configuration directory"),
        variables: z
          .record(z.unknown())
          .optional()
          .describe("GraphQL variables (optional)"),
      }),
    },
    async ({ query, workingDir, variables }) => {
      const cwd = workingDir!;

      // Ensure DAG is built / up to date
      try {
        await dagGraph.ensureBuilt(cwd);
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `DAG build failed: ${err instanceof Error ? err.message : String(err)}\n\nRun terraform_init then terraform_apply first.`,
            },
          ],
          isError: true,
        };
      }

      // Validate query
      const validation = validateQuery(query);
      if (!validation.ok) {
        return {
          content: [{ type: "text" as const, text: `Query validation error: ${validation.error}` }],
          isError: true,
        };
      }

      // Execute with timeout
      let result: Awaited<ReturnType<typeof graphql>>;
      try {
        result = await Promise.race([
          graphql({ schema, source: query, rootValue, variableValues: variables as Record<string, unknown> }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Query timed out (5s)")), getTimeout())
          ),
        ]);
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Execution error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }

      if (result.errors?.length) {
        return {
          content: [
            {
              type: "text" as const,
              text: `GraphQL errors:\n${result.errors.map((e) => e.message).join("\n")}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    }
  );
}
