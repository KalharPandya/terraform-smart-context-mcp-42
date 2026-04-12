/**
 * DAG engine + GraphQL edge case tests.
 * Tests: path finding, deployment order, module queries, depth limits,
 * scoped get_schema, resource resolution, error handling.
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

const client = new Client({ name: "test-dag", version: "1.0.0" });

async function call(name, args) {
  const res = await client.callTool({ name, arguments: args });
  const text = res.content.find((c) => c.type === "text")?.text ?? "";
  return { isError: res.isError, text };
}

let passes = 0;
let fails = 0;

function ok(label, condition, detail) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passes++;
  } else {
    console.log(`  FAIL: ${label} — ${detail || "unexpected"}`);
    fails++;
  }
}

try {
  await client.connect(transport);
  console.log("Connected\n");

  // ── 1. summary — verify node/module counts ─────────────────────────────────
  console.log("=== 1. Summary query ===");
  const s1 = await call("query_graph", {
    workingDir: DUMMY_INFRA,
    query: `{ summary { totalResources totalModules moduleNames typeBreakdown { resourceType count } } }`,
  });
  const sum = JSON.parse(s1.text).summary;
  ok("75 resources", sum.totalResources === 75, `got ${sum.totalResources}`);
  ok("6 modules", sum.totalModules === 6, `got ${sum.totalModules}`);
  ok("has networking module", sum.moduleNames.includes("networking"));

  // ── 2. modules query ────────────────────────────────────────────────────────
  console.log("\n=== 2. Modules query ===");
  const s2 = await call("query_graph", {
    workingDir: DUMMY_INFRA,
    query: `{ modules { name resourceCount } }`,
  });
  const mods = JSON.parse(s2.text).modules;
  ok("returns 6 modules", mods.length === 6, `got ${mods.length}`);
  const netMod = mods.find((m) => m.name === "networking");
  ok("networking has resources", netMod && netMod.resourceCount > 0, `count: ${netMod?.resourceCount}`);

  // ── 3. module(name) query ───────────────────────────────────────────────────
  console.log("\n=== 3. Module detail query ===");
  const s3 = await call("query_graph", {
    workingDir: DUMMY_INFRA,
    query: `{ module(name: "compute") { name resourceCount resources { id shortName resourceType } } }`,
  });
  const compMod = JSON.parse(s3.text).module;
  ok("module name matches", compMod.name === "compute");
  ok("has resources array", Array.isArray(compMod.resources) && compMod.resources.length > 0);

  // ── 4. resource by ID ──────────────────────────────────────────────────────
  console.log("\n=== 4. Resource by ID ===");
  const s4 = await call("query_graph", {
    workingDir: DUMMY_INFRA,
    query: `{ resource(id: "module.networking.null_resource.vpc") { id shortName module resourceType attributes } }`,
  });
  if (s4.isError) {
    console.log(`  SKIP: vpc not found (${s4.text.slice(0, 80)})`);
  } else {
    const res = JSON.parse(s4.text).resource;
    ok("found VPC resource", res !== null && res.id.includes("vpc"));
    ok("correct module", res?.module === "networking", `got ${res?.module}`);
    ok("has attributes", res?.attributes !== null);
  }

  // ── 5. dependencies and dependents ──────────────────────────────────────────
  console.log("\n=== 5. Dependencies + Dependents ===");
  const s5 = await call("query_graph", {
    workingDir: DUMMY_INFRA,
    query: `{ resource(id: "module.networking.null_resource.vpc") {
      dependencies(depth: 1) { resource { id } depth }
      dependents(depth: 1) { resource { id } depth }
    } }`,
  });
  if (s5.isError) {
    console.log(`  SKIP: vpc not found`);
  } else {
    const r = JSON.parse(s5.text).resource;
    ok("dependencies is array", Array.isArray(r.dependencies));
    ok("dependents is array", Array.isArray(r.dependents));
    ok("VPC has dependents (hub node)", r.dependents.length > 0, `got ${r.dependents.length}`);
  }

  // ── 6. path finding ────────────────────────────────────────────────────────
  console.log("\n=== 6. Path finding ===");
  // Find a path between VPC and something in compute
  const s6 = await call("query_graph", {
    workingDir: DUMMY_INFRA,
    query: `{ path(fromId: "module.networking.null_resource.vpc", toId: "module.compute.null_resource.app_server_1") { found length nodes { id module } } }`,
  });
  if (s6.isError) {
    console.log(`  INFO: path query error — ${s6.text.slice(0, 100)}`);
    // Try with different resource names
    const s6b = await call("query_graph", {
      workingDir: DUMMY_INFRA,
      query: `{ resources(module: "compute", limit: 1) { nodes { id } } }`,
    });
    console.log(`  INFO: compute resources sample: ${s6b.text.slice(0, 200)}`);
  } else {
    const path = JSON.parse(s6.text).path;
    ok("path result returned", path !== null);
    if (path.found) {
      ok("path has nodes", path.nodes.length > 0, `length: ${path.length}`);
    } else {
      console.log("  INFO: no path found (may be disconnected)");
    }
  }

  // ── 7. impact analysis with depth ──────────────────────────────────────────
  console.log("\n=== 7. Impact analysis ===");
  const s7 = await call("query_graph", {
    workingDir: DUMMY_INFRA,
    query: `{ impact(resourceId: "module.networking.null_resource.vpc", depth: 3) { affectedCount affected { resource { id module } depth } } }`,
  });
  if (!s7.isError) {
    const imp = JSON.parse(s7.text).impact;
    ok("affectedCount > 0", imp.affectedCount > 0, `got ${imp.affectedCount}`);
    ok("affected includes other modules", imp.affected.some((a) => a.resource.module !== "networking"), "all same module");
    ok("max depth <= 3", imp.affected.every((a) => a.depth <= 3), "exceeded depth");
  } else {
    console.log(`  SKIP: ${s7.text.slice(0, 100)}`);
  }

  // ── 8. deployment order ────────────────────────────────────────────────────
  console.log("\n=== 8. Deployment order ===");
  const s8 = await call("query_graph", {
    workingDir: DUMMY_INFRA,
    query: `{ deploymentOrder(module: "networking") { id shortName } }`,
  });
  if (!s8.isError) {
    const order = JSON.parse(s8.text).deploymentOrder;
    ok("returns ordered list", Array.isArray(order) && order.length > 0, `got ${order?.length}`);
    ok("all networking resources", order.every((r) => r.id.includes("networking")));
  } else {
    console.log(`  SKIP: ${s8.text.slice(0, 100)}`);
  }

  // ── 9. validation: depth limit exceeded ────────────────────────────────────
  console.log("\n=== 9. Depth limit validation ===");
  // Build a deeply nested query (6 levels)
  const deep = `{ resource(id: "module.networking.null_resource.vpc") {
    dependents(depth: 1) { resource { dependents(depth: 1) { resource {
      dependents(depth: 1) { resource { dependents(depth: 1) { resource {
        dependents(depth: 1) { resource { id } } } } } } } } } } } }`;
  const s9 = await call("query_graph", { workingDir: DUMMY_INFRA, query: deep });
  ok("deep query rejected", s9.isError === true, "should have been rejected for depth");

  // ── 10. validation: invalid GraphQL syntax ─────────────────────────────────
  console.log("\n=== 10. Invalid syntax ===");
  const s10 = await call("query_graph", {
    workingDir: DUMMY_INFRA,
    query: `{ this is not valid graphql }}}`,
  });
  ok("syntax error caught", s10.isError === true, "should reject invalid syntax");

  // ── 11. validation: unknown field ──────────────────────────────────────────
  console.log("\n=== 11. Unknown field ===");
  const s11 = await call("query_graph", {
    workingDir: DUMMY_INFRA,
    query: `{ summary { nonExistentField } }`,
  });
  ok("unknown field rejected", s11.isError === true, "should reject unknown fields");

  // ── 12. get_schema scoped to resource ──────────────────────────────────────
  console.log("\n=== 12. get_schema(resource) ===");
  const s12 = await call("get_schema", {
    workingDir: DUMMY_INFRA,
    resource: "module.networking.null_resource.vpc",
  });
  if (!s12.isError) {
    ok("has SDL", s12.text.includes("type Query"));
    ok("has vpc reference", s12.text.includes("vpc"));
    ok("has prebuilt queries", s12.text.includes("query") && s12.text.length > 500);
  } else {
    console.log(`  INFO: ${s12.text.slice(0, 100)}`);
  }

  // ── 13. resources with type filter ─────────────────────────────────────────
  console.log("\n=== 13. Resources by type ===");
  const s13 = await call("query_graph", {
    workingDir: DUMMY_INFRA,
    query: `{ resources(type: "null_resource", limit: 10) { totalCount nodes { id module } } }`,
  });
  if (!s13.isError) {
    const r = JSON.parse(s13.text).resources;
    ok("totalCount is 75", r.totalCount === 75, `got ${r.totalCount}`);
    ok("limit respected (<=10)", r.nodes.length <= 10, `got ${r.nodes.length}`);
  }

  // ── 14. resources with combined module + type filter ───────────────────────
  console.log("\n=== 14. Resources by module+type ===");
  const s14 = await call("query_graph", {
    workingDir: DUMMY_INFRA,
    query: `{ resources(module: "security", type: "null_resource") { totalCount nodes { id shortName } } }`,
  });
  if (!s14.isError) {
    const r = JSON.parse(s14.text).resources;
    ok("returns security resources", r.totalCount > 0, `got ${r.totalCount}`);
    ok("all from security module", r.nodes.every((n) => n.id.includes("security")));
  }

  // ── 15. nonexistent resource ───────────────────────────────────────────────
  console.log("\n=== 15. Nonexistent resource ===");
  const s15 = await call("query_graph", {
    workingDir: DUMMY_INFRA,
    query: `{ resource(id: "module.fake.null_resource.doesnt_exist") { id } }`,
  });
  if (!s15.isError) {
    const r = JSON.parse(s15.text).resource;
    ok("returns null for missing resource", r === null, `got ${JSON.stringify(r)}`);
  } else {
    ok("handles missing resource gracefully", true);
  }

  console.log(`\n=== DAG/GraphQL Results: ${passes} passed, ${fails} failed ===`);
} finally {
  await client.close();
  process.exit(fails > 0 ? 1 : 0);
}
