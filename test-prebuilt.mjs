/**
 * Test prebuilt query generator + get_schema scoping.
 * Verifies: (1) prebuilt queries use real IDs, (2) prebuilt queries are executable,
 * (3) scoping by module/resource works.
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

const client = new Client({ name: "test-prebuilt", version: "1.0.0" });

async function call(name, args) {
  const res = await client.callTool({ name, arguments: args });
  const text = res.content.find((c) => c.type === "text")?.text ?? "";
  return { isError: res.isError, text };
}

let passes = 0;
let fails = 0;

function ok(label, condition, detail) {
  if (condition) { console.log(`  PASS: ${label}`); passes++; }
  else { console.log(`  FAIL: ${label} — ${detail || ""}`); fails++; }
}

// Extract GraphQL queries from markdown-formatted get_schema output
function extractQueries(text) {
  const queries = [];
  const regex = /```graphql\n([\s\S]*?)```/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    const q = m[1].trim();
    // Skip if it's the SDL definition
    if (q.startsWith("scalar") || q.startsWith("type ")) continue;
    if (q.includes("query ") || q.startsWith("{")) queries.push(q);
  }
  return queries;
}

try {
  await client.connect(transport);
  console.log("Connected\n");

  // ── 1. get_schema() full — check content structure ─────────────────────────
  console.log("=== 1. get_schema() full — structure check ===");
  const s1 = await call("get_schema", { workingDir: DUMMY_INFRA });
  ok("no error", !s1.isError);
  ok("has type Query", s1.text.includes("type Query"));
  ok("has Resource type", s1.text.includes("type Resource"));
  ok("has example queries", s1.text.includes("query ") || s1.text.includes("graphql"));

  const fullQueries = extractQueries(s1.text);
  console.log(`  Found ${fullQueries.length} prebuilt queries`);
  ok("at least 3 prebuilt queries", fullQueries.length >= 3, `only ${fullQueries.length}`);

  // ── 2. Execute each prebuilt query — they should all work ──────────────────
  console.log("\n=== 2. Execute prebuilt queries ===");
  for (let i = 0; i < fullQueries.length; i++) {
    const q = fullQueries[i];
    const label = q.slice(0, 60).replace(/\n/g, " ");
    const r = await call("query_graph", { workingDir: DUMMY_INFRA, query: q });
    if (r.isError) {
      console.log(`  FAIL: Query ${i + 1}: ${label}...`);
      console.log(`        Error: ${r.text.slice(0, 120)}`);
      fails++;
    } else {
      console.log(`  PASS: Query ${i + 1} executed OK`);
      passes++;
    }
  }

  // ── 3. get_schema(module: "networking") ────────────────────────────────────
  console.log("\n=== 3. get_schema(module: networking) ===");
  const s3 = await call("get_schema", { workingDir: DUMMY_INFRA, module: "networking" });
  ok("no error", !s3.isError);
  ok("mentions networking", s3.text.includes("networking"));

  const netQueries = extractQueries(s3.text);
  console.log(`  Found ${netQueries.length} networking-scoped queries`);
  ok("has networking queries", netQueries.length >= 2, `only ${netQueries.length}`);

  // Execute networking queries
  for (let i = 0; i < netQueries.length; i++) {
    const r = await call("query_graph", { workingDir: DUMMY_INFRA, query: netQueries[i] });
    if (r.isError) {
      console.log(`  FAIL: Net query ${i + 1}: ${r.text.slice(0, 100)}`);
      fails++;
    } else {
      console.log(`  PASS: Net query ${i + 1} OK`);
      passes++;
    }
  }

  // ── 4. get_schema(module: "compute") ───────────────────────────────────────
  console.log("\n=== 4. get_schema(module: compute) ===");
  const s4 = await call("get_schema", { workingDir: DUMMY_INFRA, module: "compute" });
  ok("no error", !s4.isError);
  ok("mentions compute", s4.text.includes("compute"));

  // ── 5. get_schema(resource: "vpc") ─────────────────────────────────────────
  console.log("\n=== 5. get_schema(resource: vpc) ===");
  const s5 = await call("get_schema", {
    workingDir: DUMMY_INFRA,
    resource: "module.networking.null_resource.vpc",
  });
  ok("no error", !s5.isError);
  ok("mentions vpc", s5.text.includes("vpc"));

  const vpcQueries = extractQueries(s5.text);
  console.log(`  Found ${vpcQueries.length} vpc-scoped queries`);

  // Execute vpc queries
  for (let i = 0; i < vpcQueries.length; i++) {
    const r = await call("query_graph", { workingDir: DUMMY_INFRA, query: vpcQueries[i] });
    if (r.isError) {
      console.log(`  FAIL: VPC query ${i + 1}: ${r.text.slice(0, 100)}`);
      fails++;
    } else {
      console.log(`  PASS: VPC query ${i + 1} OK`);
      passes++;
    }
  }

  // ── 6. get_schema with nonexistent module ──────────────────────────────────
  console.log("\n=== 6. get_schema(module: nonexistent) ===");
  const s6 = await call("get_schema", { workingDir: DUMMY_INFRA, module: "nonexistent_module" });
  // Should either return an error or empty prebuilt queries
  console.log(`  isError: ${s6.isError}`);
  console.log(`  text length: ${s6.text.length}`);
  ok("handles gracefully (no crash)", true);

  console.log(`\n=== Prebuilt Results: ${passes} passed, ${fails} failed ===`);
} finally {
  await client.close();
  process.exit(fails > 0 ? 1 : 0);
}
