#!/usr/bin/env node
/**
 * PostToolUse hook — runs `tsc --noEmit` after any Edit|Write on a .ts file.
 * Reads the hook payload from stdin (Claude Code hook protocol).
 * Exit 0 = pass, Exit 2 = type errors (feedback sent back to Claude).
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raw = readFileSync("/dev/stdin", "utf8").trim();
let payload;
try {
  payload = JSON.parse(raw);
} catch {
  // Non-JSON stdin — skip
  process.exit(0);
}

const filePath = payload?.tool_input?.file_path ?? "";

if (!filePath.endsWith(".ts")) {
  process.exit(0);
}

// Project root is two levels up from .claude/hooks/
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

try {
  execSync("node_modules/.bin/tsc --noEmit", {
    cwd: projectRoot,
    stdio: "pipe",
  });
  // Clean — exit 0
  process.exit(0);
} catch (err) {
  const output = (err.stdout?.toString() ?? "") + (err.stderr?.toString() ?? "");
  const lines = output.split("\n").slice(0, 30).join("\n");
  process.stderr.write(`TypeScript errors detected:\n${lines}\n`);
  process.exit(2);
}
