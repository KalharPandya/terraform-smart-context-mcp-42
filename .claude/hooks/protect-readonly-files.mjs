#!/usr/bin/env node
/**
 * PreToolUse hook — blocks direct edits to protected files.
 * Reads the hook payload from stdin (Claude Code hook protocol).
 *
 * CHANGELOG.md  → exit 2: read-only, update via /end-session only
 * DECISIONS.md  → exit 2: append-only, use /commit-decision
 * Everything else → exit 0
 */

import { readFileSync } from "node:fs";

const raw = readFileSync("/dev/stdin", "utf8").trim();
let payload;
try {
  payload = JSON.parse(raw);
} catch {
  // Non-JSON stdin — skip
  process.exit(0);
}

const filePath = payload?.tool_input?.file_path ?? "";

if (filePath.endsWith("CHANGELOG.md")) {
  process.stderr.write(
    "BLOCKED: CHANGELOG.md is read-only. Update it via /end-session only.\n"
  );
  process.exit(2);
}

if (filePath.endsWith("DECISIONS.md")) {
  process.stderr.write(
    "BLOCKED: DECISIONS.md is append-only. Use /commit-decision to add entries.\n"
  );
  process.exit(2);
}

process.exit(0);
