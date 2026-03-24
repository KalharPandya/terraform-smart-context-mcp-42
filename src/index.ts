import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { spawnSync } from "child_process";
import { z } from "zod";

// ─── Helper ──────────────────────────────────────────────────────────────────

function runTerraform(
  args: string[],
  cwd: string
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("terraform", args, {
    cwd,
    encoding: "utf-8",
    shell: process.platform === "win32", // required on Windows
    maxBuffer: 10 * 1024 * 1024,
  });

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? (result.error?.message ?? ""),
    exitCode: result.status ?? 1,
  };
}

function toolResult(stdout: string, stderr: string, exitCode: number) {
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

// ─── Server ───────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "terraform-mcp",
  version: "1.0.0",
});

// ─── Tool: terraform_init ─────────────────────────────────────────────────────

server.registerTool(
  "terraform_init",
  {
    title: "Terraform Init",
    description:
      "Run `terraform init` to initialize a Terraform working directory. Downloads providers and modules.",
    inputSchema: z.object({
      workingDir: z
        .string()
        .describe("Absolute path to the Terraform configuration directory"),
      upgrade: z
        .boolean()
        .optional()
        .describe("Pass -upgrade to upgrade modules and providers"),
    }),
  },
  async ({ workingDir, upgrade }) => {
    const args = ["init", "-no-color"];
    if (upgrade) args.push("-upgrade");
    const { stdout, stderr, exitCode } = runTerraform(args, workingDir);
    return toolResult(stdout, stderr, exitCode);
  }
);

// ─── Tool: terraform_validate ─────────────────────────────────────────────────

server.registerTool(
  "terraform_validate",
  {
    title: "Terraform Validate",
    description:
      "Run `terraform validate` to check whether the configuration is syntactically valid and internally consistent.",
    inputSchema: z.object({
      workingDir: z
        .string()
        .describe("Absolute path to the Terraform configuration directory"),
    }),
  },
  async ({ workingDir }) => {
    const { stdout, stderr, exitCode } = runTerraform(
      ["validate", "-no-color"],
      workingDir
    );
    return toolResult(stdout, stderr, exitCode);
  }
);

// ─── Tool: terraform_plan ─────────────────────────────────────────────────────

server.registerTool(
  "terraform_plan",
  {
    title: "Terraform Plan",
    description:
      "Run `terraform plan` to preview the changes Terraform will make to your infrastructure. Does NOT apply anything.",
    inputSchema: z.object({
      workingDir: z
        .string()
        .describe("Absolute path to the Terraform configuration directory"),
      varFile: z
        .string()
        .optional()
        .describe("Path to a .tfvars file to pass with -var-file"),
      vars: z
        .record(z.string())
        .optional()
        .describe("Key-value pairs to pass as -var arguments"),
      destroy: z
        .boolean()
        .optional()
        .describe("Plan a destroy operation instead of create/update"),
    }),
  },
  async ({ workingDir, varFile, vars, destroy }) => {
    const args = ["plan", "-no-color"];
    if (destroy) args.push("-destroy");
    if (varFile) args.push(`-var-file=${varFile}`);
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        args.push(`-var=${k}=${v}`);
      }
    }
    const { stdout, stderr, exitCode } = runTerraform(args, workingDir);
    return toolResult(stdout, stderr, exitCode);
  }
);

// ─── Tool: terraform_apply ────────────────────────────────────────────────────

server.registerTool(
  "terraform_apply",
  {
    title: "Terraform Apply",
    description:
      "Run `terraform apply -auto-approve` to apply the Terraform plan. " +
      "WARNING: This makes real infrastructure changes. Set `confirm: true` to proceed.",
    inputSchema: z.object({
      workingDir: z
        .string()
        .describe("Absolute path to the Terraform configuration directory"),
      confirm: z
        .boolean()
        .describe(
          "Must be set to true to confirm you want to apply real changes"
        ),
      varFile: z
        .string()
        .optional()
        .describe("Path to a .tfvars file to pass with -var-file"),
      vars: z
        .record(z.string())
        .optional()
        .describe("Key-value pairs to pass as -var arguments"),
    }),
  },
  async ({ workingDir, confirm, varFile, vars }) => {
    if (!confirm) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Aborted: `confirm` must be set to true to run terraform apply. This prevents accidental infrastructure changes.",
          },
        ],
        isError: true,
      };
    }

    const args = ["apply", "-auto-approve", "-no-color"];
    if (varFile) args.push(`-var-file=${varFile}`);
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        args.push(`-var=${k}=${v}`);
      }
    }
    const { stdout, stderr, exitCode } = runTerraform(args, workingDir);
    return toolResult(stdout, stderr, exitCode);
  }
);

// ─── Tool: terraform_state_list ───────────────────────────────────────────────

server.registerTool(
  "terraform_state_list",
  {
    title: "Terraform State List",
    description:
      "Run `terraform state list` to list all resources tracked in the Terraform state.",
    inputSchema: z.object({
      workingDir: z
        .string()
        .describe("Absolute path to the Terraform configuration directory"),
      filter: z
        .string()
        .optional()
        .describe("Optional resource address prefix to filter results"),
    }),
  },
  async ({ workingDir, filter }) => {
    const args = ["state", "list"];
    if (filter) args.push(filter);
    const { stdout, stderr, exitCode } = runTerraform(args, workingDir);
    return toolResult(stdout, stderr, exitCode);
  }
);

// ─── Tool: terraform_output ───────────────────────────────────────────────────

server.registerTool(
  "terraform_output",
  {
    title: "Terraform Output",
    description:
      "Run `terraform output -json` to retrieve all output values from the Terraform state.",
    inputSchema: z.object({
      workingDir: z
        .string()
        .describe("Absolute path to the Terraform configuration directory"),
      name: z
        .string()
        .optional()
        .describe("Specific output name to retrieve (returns all if omitted)"),
    }),
  },
  async ({ workingDir, name }) => {
    const args = ["output", "-json"];
    if (name) args.push(name);
    const { stdout, stderr, exitCode } = runTerraform(args, workingDir);

    // Pretty-print JSON if successful
    if (exitCode === 0 && stdout.trim()) {
      try {
        const parsed = JSON.parse(stdout);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(parsed, null, 2),
            },
          ],
        };
      } catch {
        // fall through to raw output
      }
    }

    return toolResult(stdout, stderr, exitCode);
  }
);

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Terraform MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
