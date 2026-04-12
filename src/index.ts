// MCP server entry point — bootstrap with gate enforcement and MCP roots

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getGateLevel, isToolAllowed } from "./gate.js";
import { INSTRUCTIONS } from "./instructions.js";
import { getAllToolRegistrations, type ToolRegistrationContext } from "./terraform/tools.js";
import { registerQueryGraph } from "./tools/query_graph.js";
import { registerGetSchema } from "./tools/get_schema.js";
import { registerUnifiedTool } from "./tools/unified.js";
import { dagGraph } from "./dag/graph.js";

const UNIFIED = process.env.TERRAFORM_MCP_UNIFIED !== "0";

// ─── Server ───────────────────────────────────────────────────────────────────

const gate = getGateLevel();

const server = new McpServer(
  { name: "terraform-mcp", version: "1.0.0" },
  { instructions: INSTRUCTIONS }
);

// ─── MCP roots ────────────────────────────────────────────────────────────────

// Will be set when a client provides a workspace root via the roots capability.
// Until then, workingDir is required on every tool call.
let rootDir: string | null = null;

// ─── Register tools based on gate tier ───────────────────────────────────────

let registered = 0;

if (UNIFIED) {
  // Unified mode — single "terraform" tool replaces all 12 read-tier tools
  if (isToolAllowed("terraform", gate)) {
    registerUnifiedTool(server, rootDir);
    registered = 1;
  }
} else {
  // Standard mode — individual tools
  const dagInvalidate = () => dagGraph.invalidate();

  const ctx: ToolRegistrationContext = {
    server,
    rootDir,
    dagInvalidate,
  };

  const allCliTools = getAllToolRegistrations();

  for (const [toolName, registerFn] of Object.entries(allCliTools)) {
    if (isToolAllowed(toolName, gate)) {
      registerFn(ctx);
      registered++;
    }
  }

  if (isToolAllowed("query_graph", gate)) {
    registerQueryGraph(server, rootDir);
    registered++;
  }

  if (isToolAllowed("get_schema", gate)) {
    registerGetSchema(server, rootDir);
    registered++;
  }
}

const totalTools = UNIFIED ? 1 : Object.keys(getAllToolRegistrations()).length + 2;

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `Terraform MCP server running on stdio (gate=${gate}, ${UNIFIED ? "unified" : "standard"}, ${registered}/${totalTools} tools registered)`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
