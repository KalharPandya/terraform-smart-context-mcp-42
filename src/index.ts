// MCP server entry point — bootstrap with gate enforcement and MCP roots

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getGateLevel, isToolAllowed } from "./gate.js";
import { INSTRUCTIONS } from "./instructions.js";
import { getAllToolRegistrations, type ToolRegistrationContext } from "./terraform/tools.js";
import { registerQueryGraph } from "./tools/query_graph.js";
import { registerGetSchema } from "./tools/get_schema.js";
import { dagGraph } from "./dag/graph.js";

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

// ─── Register CLI tools based on gate tier ───────────────────────────────────

const dagInvalidate = () => dagGraph.invalidate();

const ctx: ToolRegistrationContext = {
  server,
  rootDir,
  dagInvalidate,
};

const allCliTools = getAllToolRegistrations();
let registered = 0;

for (const [toolName, registerFn] of Object.entries(allCliTools)) {
  if (isToolAllowed(toolName, gate)) {
    registerFn(ctx);
    registered++;
  }
}

// ─── Register GraphQL tools (always read tier) ────────────────────────────────

if (isToolAllowed("query_graph", gate)) {
  registerQueryGraph(server, rootDir);
  registered++;
}

if (isToolAllowed("get_schema", gate)) {
  registerGetSchema(server, rootDir);
  registered++;
}

const totalTools = Object.keys(allCliTools).length + 2; // +2 for GraphQL tools

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `Terraform MCP server running on stdio (gate=${gate}, ${registered}/${totalTools} tools registered)`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
