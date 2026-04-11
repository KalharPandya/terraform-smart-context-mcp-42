// MCP tool: get_schema — returns GraphQL SDL + prebuilt queries scoped to module/resource

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SDL } from "../graphql/schema.js";
import {
  generateForInfra,
  generateForModule,
  generateForResource,
} from "../graphql/prebuilt.js";
import { dagGraph } from "../dag/graph.js";

export function registerGetSchema(
  server: McpServer,
  rootDir: string | null
) {
  server.registerTool(
    "get_schema",
    {
      title: "Get GraphQL Schema",
      description:
        "Return the full GraphQL SDL and ready-to-run example queries built from your live infrastructure. " +
        "Scope with `module` or `resource` to get queries focused on a specific area. " +
        "Copy any example query and run it with query_graph.",
      inputSchema: z.object({
        workingDir: rootDir
          ? z.string().optional().default(rootDir).describe("Terraform config directory (defaults to MCP root)")
          : z.string().describe("Absolute path to the Terraform configuration directory"),
        module: z
          .string()
          .optional()
          .describe("Scope prebuilt queries to this module name"),
        resource: z
          .string()
          .optional()
          .describe("Scope prebuilt queries to this resource ID or short name"),
      }),
    },
    async ({ workingDir, module, resource }) => {
      const cwd = workingDir!;

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

      // Generate scoped prebuilt queries
      let prebuilt;
      if (resource) {
        prebuilt = generateForResource(resource);
      } else if (module) {
        prebuilt = generateForModule(module);
      } else {
        prebuilt = generateForInfra();
      }

      // Format output
      const sections: string[] = [];

      sections.push("# GraphQL SDL\n\n```graphql\n" + SDL + "\n```");

      if (prebuilt.queries.length) {
        const queryBlocks = prebuilt.queries
          .map(
            (q) =>
              `## ${q.title}\n\`\`\`graphql\n# ${q.description}\n${q.query}\n\`\`\``
          )
          .join("\n\n");
        sections.push(
          `# Prebuilt Queries\n\n_${prebuilt.note}_\n\n${queryBlocks}`
        );
      } else {
        sections.push(`# Prebuilt Queries\n\n_${prebuilt.note}_`);
      }

      sections.push(
        "# Usage\n\nCopy any query above and call `query_graph` with it:\n```\nquery_graph(query: \"<paste query here>\")\n```"
      );

      return {
        content: [
          {
            type: "text" as const,
            text: sections.join("\n\n---\n\n"),
          },
        ],
      };
    }
  );
}
