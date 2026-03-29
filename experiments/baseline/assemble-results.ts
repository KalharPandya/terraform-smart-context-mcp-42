#!/usr/bin/env npx tsx
/**
 * Assemble Manual Run Results
 *
 * Takes the JSON answer blocks from a manual Claude Code run and
 * merges them into the results template for scoring.
 *
 * Usage:
 *   npx tsx experiments/baseline/assemble-results.ts experiments/baseline/results/answers.jsonl
 *
 * Input: a JSONL file where each line is the JSON block Claude produced:
 *   {"prompt_id": 1, "answer": "...", "tool_calls_made": [...]}
 *   {"prompt_id": 2, "answer": "...", "tool_calls_made": [...]}
 *   ...
 *
 * You can also pass per-prompt metrics as extra fields:
 *   {"prompt_id": 1, "answer": "...", "tool_calls_made": [...], "tokens_in": 5000, "tokens_out": 800, "wall_time_ms": 12000}
 *
 * Output: experiments/baseline/results/manual-run-<timestamp>.json (scorer-compatible)
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, join } from "path";

const SCRIPT_DIR = resolve(
  decodeURIComponent(
    new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")
  )
);

interface AnswerEntry {
  prompt_id: number;
  answer: string;
  tool_calls_made: Array<{ tool: string; detail: string }>;
  tokens_in?: number;
  tokens_out?: number;
  wall_time_ms?: number;
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error(
      "Usage: npx tsx assemble-results.ts <answers.jsonl>\n\n" +
        "Create answers.jsonl by copying each JSON block from Claude's responses,\n" +
        "one per line. Example:\n" +
        '  {"prompt_id": 1, "answer": "10.0.0.0/16", "tool_calls_made": [{"tool": "Bash", "detail": "terraform state show module.networking.null_resource.vpc"}]}'
    );
    process.exit(1);
  }

  // Load template
  const templatePath = join(SCRIPT_DIR, "results", "manual-run-template.json");
  const template = JSON.parse(readFileSync(templatePath, "utf-8"));

  // Load answers
  const lines = readFileSync(resolve(inputPath), "utf-8")
    .split("\n")
    .filter((l) => l.trim());

  const answers: AnswerEntry[] = lines.map((line, i) => {
    try {
      return JSON.parse(line);
    } catch {
      console.error(`Error parsing line ${i + 1}: ${line.slice(0, 80)}...`);
      process.exit(1);
    }
  });

  console.log(`Loaded ${answers.length} answers from ${inputPath}`);

  // Merge into template
  let merged = 0;
  for (const answer of answers) {
    const result = template.results.find(
      (r: { id: number }) => r.id === answer.prompt_id
    );
    if (!result) {
      console.warn(`Warning: no template entry for prompt_id ${answer.prompt_id}, skipping`);
      continue;
    }

    result.trials[0].answer = answer.answer;
    result.trials[0].tool_calls = answer.tool_calls_made.length;
    result.trials[0].tool_call_details = answer.tool_calls_made.map((tc) => ({
      name: tc.tool,
      input: { detail: tc.detail },
      output: "(manual run — not captured)",
      is_error: false,
    }));

    if (answer.tokens_in !== undefined) result.trials[0].tokens_in = answer.tokens_in;
    if (answer.tokens_out !== undefined) result.trials[0].tokens_out = answer.tokens_out;
    if (answer.wall_time_ms !== undefined) result.trials[0].wall_time_ms = answer.wall_time_ms;

    merged++;
  }

  // Update metadata
  template.metadata.timestamp = new Date().toISOString();
  template.metadata.runner = "manual-claude-code";

  // Write output
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outPath = join(SCRIPT_DIR, "results", `manual-run-${timestamp}.json`);
  writeFileSync(outPath, JSON.stringify(template, null, 2));

  console.log(`Merged ${merged}/${answers.length} answers`);
  console.log(`Results written to: ${outPath}`);
  console.log(`\nRun scorer: npx tsx experiments/baseline/scorer.ts ${outPath}`);
}

main();
