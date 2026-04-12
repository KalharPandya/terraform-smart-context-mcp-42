/**
 * CLI tools integration test — exercises all read-tier CLI tools against dummy-infra.
 * dummy-infra must already have terraform.tfstate (from prior apply).
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const DUMMY_INFRA = join(__dir, "experiments/baseline/dummy-infra");
const SERVER = join(__dir, "src/index.ts");

const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", SERVER],
  env: { ...process.env, TERRAFORM_MCP_GATE: "read" },
});

const client = new Client({ name: "test-cli", version: "1.0.0" });

async function call(name, args) {
  const res = await client.callTool({ name, arguments: args });
  const text = res.content.find((c) => c.type === "text")?.text ?? "";
  return { isError: res.isError, text };
}

function check(label, condition, detail) {
  if (condition) {
    console.log(`  PASS: ${label}`);
  } else {
    console.log(`  FAIL: ${label} — ${detail}`);
  }
  return condition;
}

let passes = 0;
let fails = 0;

function record(ok) {
  if (ok) passes++;
  else fails++;
}

try {
  await client.connect(transport);
  console.log("Connected\n");

  // 1. terraform_validate
  console.log("=== terraform_validate ===");
  const v = await call("terraform_validate", { workingDir: DUMMY_INFRA });
  record(check("runs without error", !v.isError, v.text.slice(0, 100)));
  record(check("mentions valid", v.text.toLowerCase().includes("valid"), "no 'valid' in output"));

  // 2. terraform_plan
  console.log("\n=== terraform_plan ===");
  const p = await call("terraform_plan", { workingDir: DUMMY_INFRA });
  record(check("runs without error", !p.isError, p.text.slice(0, 100)));
  record(check("mentions null_resource", p.text.includes("null_resource"), "no null_resource"));

  // 3. terraform_show
  console.log("\n=== terraform_show ===");
  const sh = await call("terraform_show", { workingDir: DUMMY_INFRA });
  record(check("runs without error", !sh.isError, sh.text.slice(0, 100)));
  record(check("returns JSON with values", sh.text.includes('"values"'), "no 'values' key in JSON"));

  // 4. terraform_state_list
  console.log("\n=== terraform_state_list ===");
  const sl = await call("terraform_state_list", { workingDir: DUMMY_INFRA });
  record(check("runs without error", !sl.isError, sl.text.slice(0, 100)));
  const stateLines = sl.text.trim().split("\n").filter(l => l.includes("null_resource"));
  record(check(`lists resources (found ${stateLines.length})`, stateLines.length >= 50, `only ${stateLines.length}`));

  // 5. terraform_state_show (pick first resource from state list)
  console.log("\n=== terraform_state_show ===");
  const firstAddr = stateLines[0]?.trim();
  if (firstAddr) {
    const ss = await call("terraform_state_show", { workingDir: DUMMY_INFRA, address: firstAddr });
    record(check("runs without error", !ss.isError, ss.text.slice(0, 100)));
    record(check("shows resource details", ss.text.includes("null_resource"), "no null_resource in output"));
  } else {
    console.log("  SKIP: no state resources found");
    fails++;
  }

  // 6. terraform_output
  console.log("\n=== terraform_output ===");
  const o = await call("terraform_output", { workingDir: DUMMY_INFRA });
  record(check("runs without error", !o.isError, o.text.slice(0, 100)));

  // 7. terraform_graph
  console.log("\n=== terraform_graph ===");
  const g = await call("terraform_graph", { workingDir: DUMMY_INFRA });
  record(check("runs without error", !g.isError, g.text.slice(0, 100)));
  record(check("returns DOT format", g.text.includes("digraph"), "no 'digraph' keyword"));

  // 8. terraform_providers
  console.log("\n=== terraform_providers ===");
  const pr = await call("terraform_providers", { workingDir: DUMMY_INFRA });
  record(check("runs without error", !pr.isError, pr.text.slice(0, 100)));
  record(check("mentions hashicorp/null", pr.text.includes("null"), "no 'null' provider"));

  // 9. terraform_fmt
  console.log("\n=== terraform_fmt ===");
  const f = await call("terraform_fmt", { workingDir: DUMMY_INFRA });
  record(check("runs without error", !f.isError, f.text.slice(0, 100)));

  // 10. terraform_init (last — slower)
  console.log("\n=== terraform_init ===");
  const i = await call("terraform_init", { workingDir: DUMMY_INFRA });
  record(check("runs without error", !i.isError, i.text.slice(0, 200)));
  record(check("mentions initialized", i.text.toLowerCase().includes("initialized") || i.text.toLowerCase().includes("initializing"), "no init confirmation"));

  console.log(`\n=== CLI Results: ${passes} passed, ${fails} failed ===`);
} finally {
  await client.close();
  process.exit(fails > 0 ? 1 : 0);
}
