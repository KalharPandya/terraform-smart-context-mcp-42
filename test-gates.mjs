/**
 * Gate enforcement test — verifies tool visibility at each tier level.
 * Spawns the MCP server 3 times with different TERRAFORM_MCP_GATE values.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const SERVER = join(__dir, "src/index.ts");

const READ_TOOLS = [
  "terraform_init", "terraform_validate", "terraform_plan", "terraform_show",
  "terraform_state_list", "terraform_state_show", "terraform_output",
  "terraform_graph", "terraform_providers", "terraform_fmt",
  "query_graph", "get_schema",
];

const WRITE_TOOLS = ["terraform_apply", "terraform_import", "terraform_state_mv"];
const DESTROY_TOOLS = ["terraform_destroy", "terraform_state_rm"];

async function testGate(gateLevel, expectedTools, unexpectedTools) {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", SERVER],
    env: { ...process.env, TERRAFORM_MCP_GATE: gateLevel },
  });
  const client = new Client({ name: "test-gates", version: "1.0.0" });

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    const toolNames = tools.map((t) => t.name);

    let pass = true;
    for (const name of expectedTools) {
      if (!toolNames.includes(name)) {
        console.log(`  FAIL: ${name} should be visible at gate=${gateLevel} but is missing`);
        pass = false;
      }
    }
    for (const name of unexpectedTools) {
      if (toolNames.includes(name)) {
        console.log(`  FAIL: ${name} should be HIDDEN at gate=${gateLevel} but is visible`);
        pass = false;
      }
    }
    console.log(`  Tools visible: ${toolNames.length} | Expected: ${expectedTools.length}`);
    if (pass && toolNames.length === expectedTools.length) {
      console.log(`  PASS`);
    } else if (pass) {
      console.log(`  WARN: count mismatch (${toolNames.length} vs ${expectedTools.length})`);
    }
    return pass;
  } finally {
    await client.close();
  }
}

console.log("=== Gate: read (default) ===");
const r1 = await testGate("read", READ_TOOLS, [...WRITE_TOOLS, ...DESTROY_TOOLS]);

console.log("\n=== Gate: write ===");
const r2 = await testGate("write", [...READ_TOOLS, ...WRITE_TOOLS], DESTROY_TOOLS);

console.log("\n=== Gate: destroy ===");
const r3 = await testGate("destroy", [...READ_TOOLS, ...WRITE_TOOLS, ...DESTROY_TOOLS], []);

console.log(`\n=== Results: ${[r1, r2, r3].every(Boolean) ? "ALL PASS" : "SOME FAILURES"} ===`);
process.exit([r1, r2, r3].every(Boolean) ? 0 : 1);
