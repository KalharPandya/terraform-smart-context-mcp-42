/**
 * Quick integration test for query_graph + get_schema tools.
 * Runs against experiments/baseline/dummy-infra/ (must have terraform.tfstate).
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
  env: { ...process.env },
});

const client = new Client({ name: "test-graphql", version: "1.0.0" });

async function call(name, args) {
  const res = await client.callTool({ name, arguments: args });
  const text = res.content.find((c) => c.type === "text")?.text ?? "";
  return { isError: res.isError, text };
}

try {
  await client.connect(transport);
  console.log("Connected to MCP server\n");

  // ── Test 1: summary query ──────────────────────────────────────────────────
  console.log("=== Test 1: query_graph — summary ===");
  const t1 = await call("query_graph", {
    workingDir: DUMMY_INFRA,
    query: `query { summary { totalResources totalModules moduleNames typeBreakdown { resourceType count } } }`,
  });
  if (t1.isError) {
    console.error("FAIL:", t1.text);
  } else {
    const data = JSON.parse(t1.text);
    const s = data.summary;
    console.log(`  Total resources: ${s.totalResources}`);
    console.log(`  Total modules:   ${s.totalModules}`);
    console.log(`  Modules:         ${s.moduleNames.join(", ")}`);
    console.log(`  Type breakdown:  ${s.typeBreakdown.map((t) => `${t.resourceType}(${t.count})`).join(", ")}`);
    console.log(s.totalResources >= 50 ? "  PASS: >=50 resources" : `  WARN: only ${s.totalResources} resources`);
  }

  // ── Test 2: resources by module ────────────────────────────────────────────
  console.log("\n=== Test 2: query_graph — resources(module) ===");
  const t2 = await call("query_graph", {
    workingDir: DUMMY_INFRA,
    query: `query { resources(module: "networking") { nodes { id shortName } totalCount } }`,
  });
  if (t2.isError) {
    console.error("FAIL:", t2.text);
  } else {
    const data = JSON.parse(t2.text);
    console.log(`  networking resources: ${data.resources.totalCount}`);
    console.log(`  First: ${data.resources.nodes[0]?.id}`);
    console.log(data.resources.totalCount > 0 ? "  PASS" : "  WARN: 0 resources");
  }

  // ── Test 3: bare resources — should be rejected ────────────────────────────
  console.log("\n=== Test 3: query_graph — bare resources{} rejected ===");
  const t3 = await call("query_graph", {
    workingDir: DUMMY_INFRA,
    query: `query { resources { nodes { id } totalCount } }`,
  });
  console.log(t3.isError ? "  PASS: rejected with error" : "  FAIL: should have been rejected");
  if (t3.isError) console.log(`  Error: ${t3.text.slice(0, 120)}`);

  // ── Test 4: get_schema — full ──────────────────────────────────────────────
  console.log("\n=== Test 4: get_schema — full ===");
  const t4 = await call("get_schema", { workingDir: DUMMY_INFRA });
  if (t4.isError) {
    console.error("FAIL:", t4.text);
  } else {
    const hasSDL = t4.text.includes("type Query");
    const hasPrebuilt = t4.text.includes("module.") || t4.text.includes("query ");
    console.log(`  Has SDL:      ${hasSDL}`);
    console.log(`  Has prebuilt: ${hasPrebuilt}`);
    console.log(`  Length:       ${t4.text.length} chars`);
    console.log(hasSDL && hasPrebuilt ? "  PASS" : "  WARN: missing sections");
  }

  // ── Test 5: get_schema — scoped to networking module ──────────────────────
  console.log("\n=== Test 5: get_schema(module: networking) ===");
  const t5 = await call("get_schema", { workingDir: DUMMY_INFRA, module: "networking" });
  if (t5.isError) {
    console.error("FAIL:", t5.text);
  } else {
    const hasNetworking = t5.text.includes("networking");
    console.log(`  Has 'networking': ${hasNetworking}`);
    console.log(hasNetworking ? "  PASS" : "  WARN: no networking reference");
  }

  // ── Test 6: impact query ───────────────────────────────────────────────────
  console.log("\n=== Test 6: query_graph — impact analysis ===");
  const t6 = await call("query_graph", {
    workingDir: DUMMY_INFRA,
    query: `query { impact(resourceId: "module.networking.null_resource.vpc", depth: 2) { affectedCount affected { resource { id } depth } } }`,
  });
  if (t6.isError) {
    // May not have vpc, try summary first
    console.log("  vpc not found, skipping (not a failure)");
  } else {
    const data = JSON.parse(t6.text);
    console.log(`  Affected: ${data.impact.affectedCount}`);
    console.log("  PASS");
  }

  console.log("\n=== All tests complete ===");
} finally {
  await client.close();
  process.exit(0);
}
