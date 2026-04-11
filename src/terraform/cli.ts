// Terraform CLI helpers — extracted from index.ts

import { spawnSync } from "child_process";

export function runTerraform(
  args: string[],
  cwd: string
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("terraform", args, {
    cwd,
    encoding: "utf-8",
    shell: process.platform === "win32",
    maxBuffer: 10 * 1024 * 1024,
  });

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? (result.error?.message ?? ""),
    exitCode: result.status ?? 1,
  };
}

export function toolResult(stdout: string, stderr: string, exitCode: number) {
  const success = exitCode === 0;
  const output = [stdout, stderr].filter(Boolean).join("\n").trim();
  return {
    content: [
      {
        type: "text" as const,
        text: output || (success ? "(no output)" : "Command failed with no output"),
      },
    ],
    isError: !success,
  };
}
