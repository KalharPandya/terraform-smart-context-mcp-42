/**
 * Quick smoke-test: spawns the MCP server, lists its tools,
 * then calls terraform_validate and terraform_plan.
 */
import { spawn } from "child_process";
import { createInterface } from "readline";

const server = spawn("npx", ["tsx", "src/index.ts"], {
  cwd: "P:\\42-Terraform-MCP",
  shell: true,
  stdio: ["pipe", "pipe", "pipe"],
});

const rl = createInterface({ input: server.stdout });
const pending = new Map();
let nextId = 1;

server.stderr.on("data", (d) => process.stderr.write("[server] " + d));

rl.on("line", (line) => {
  try {
    const msg = JSON.parse(line);
    const resolve = pending.get(msg.id);
    if (resolve) {
      pending.delete(msg.id);
      resolve(msg);
    }
  } catch {}
});

function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    server.stdin.write(msg + "\n");
  });
}

async function run() {
  // 1. Initialize
  await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0" },
  });

  // 2. List tools
  const toolsRes = await send("tools/list");
  const tools = toolsRes.result?.tools ?? [];
  console.log("\n=== Available Tools ===");
  tools.forEach((t) => console.log(` ✓ ${t.name} — ${t.description}`));

  const wd = "P:\\\\42-Terraform-MCP\\\\test-infra";

  // 3. Call terraform_validate
  console.log("\n=== terraform_validate ===");
  const validateRes = await send("tools/call", {
    name: "terraform_validate",
    arguments: { workingDir: wd },
  });
  console.log(validateRes.result?.content?.[0]?.text);

  // 4. Call terraform_plan
  console.log("\n=== terraform_plan ===");
  const planRes = await send("tools/call", {
    name: "terraform_plan",
    arguments: { workingDir: wd },
  });
  console.log(planRes.result?.content?.[0]?.text);

  server.kill();
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
