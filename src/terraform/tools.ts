// All 15 Terraform CLI tool registrations
// Each function registers one tool on the MCP server

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runTerraform, toolResult } from "./cli.js";

// Shared schema fragment — workingDir is optional when MCP roots provide a default
function workingDirSchema(rootDir: string | null) {
  return rootDir
    ? z
        .string()
        .optional()
        .default(rootDir)
        .describe("Terraform config directory (defaults to MCP root)")
    : z.string().describe("Absolute path to the Terraform configuration directory");
}

// Run terraform and return MCP tool result
function run(args: string[], cwd: string) {
  const r = runTerraform(args, cwd);
  return toolResult(r.stdout, r.stderr, r.exitCode);
}

type DagInvalidateFn = (() => void) | null;

// ─── Read Tier ───────────────────────────────────────────────────────────────

export function registerTerraformInit(server: McpServer, rootDir: string | null) {
  server.registerTool(
    "terraform_init",
    {
      title: "Terraform Init",
      description:
        "Run `terraform init` to initialize a Terraform working directory. Downloads providers and modules.",
      inputSchema: z.object({
        workingDir: workingDirSchema(rootDir),
        upgrade: z.boolean().optional().describe("Pass -upgrade to upgrade modules and providers"),
      }),
    },
    async ({ workingDir, upgrade }) => {
      const args = ["init", "-no-color"];
      if (upgrade) args.push("-upgrade");
      return run(args, workingDir!);
    }
  );
}

export function registerTerraformValidate(server: McpServer, rootDir: string | null) {
  server.registerTool(
    "terraform_validate",
    {
      title: "Terraform Validate",
      description:
        "Run `terraform validate` to check whether the configuration is syntactically valid and internally consistent.",
      inputSchema: z.object({ workingDir: workingDirSchema(rootDir) }),
    },
    async ({ workingDir }) => {
      return run(["validate", "-no-color"], workingDir!);
    }
  );
}

export function registerTerraformPlan(server: McpServer, rootDir: string | null) {
  server.registerTool(
    "terraform_plan",
    {
      title: "Terraform Plan",
      description:
        "Run `terraform plan` to preview changes Terraform will make. Does NOT apply anything.",
      inputSchema: z.object({
        workingDir: workingDirSchema(rootDir),
        varFile: z.string().optional().describe("Path to a .tfvars file"),
        vars: z.record(z.string()).optional().describe("Key-value pairs as -var arguments"),
        destroy: z.boolean().optional().describe("Plan a destroy operation"),
      }),
    },
    async ({ workingDir, varFile, vars, destroy }) => {
      const args = ["plan", "-no-color"];
      if (destroy) args.push("-destroy");
      if (varFile) args.push(`-var-file=${varFile}`);
      if (vars) for (const [k, v] of Object.entries(vars)) args.push(`-var=${k}=${v}`);
      return run(args, workingDir!);
    }
  );
}

export function registerTerraformShow(server: McpServer, rootDir: string | null) {
  server.registerTool(
    "terraform_show",
    {
      title: "Terraform Show",
      description:
        "Run `terraform show -json` to display the current state as structured JSON. " +
        "WARNING: Returns the ENTIRE state (often 4000+ lines). " +
        "For targeted queries, prefer query_graph or terraform_state_show.",
      inputSchema: z.object({ workingDir: workingDirSchema(rootDir) }),
    },
    async ({ workingDir }) => {
      const { stdout, stderr, exitCode } = runTerraform(["show", "-json", "-no-color"], workingDir!);
      if (exitCode === 0 && stdout.trim()) {
        try {
          const parsed = JSON.parse(stdout);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(parsed, null, 2) }],
          };
        } catch { /* fall through */ }
      }
      return toolResult(stdout, stderr, exitCode);
    }
  );
}

export function registerTerraformStateList(server: McpServer, rootDir: string | null) {
  server.registerTool(
    "terraform_state_list",
    {
      title: "Terraform State List",
      description: "Run `terraform state list` to list all resources tracked in the Terraform state.",
      inputSchema: z.object({
        workingDir: workingDirSchema(rootDir),
        filter: z.string().optional().describe("Resource address prefix to filter results"),
      }),
    },
    async ({ workingDir, filter }) => {
      const args = ["state", "list"];
      if (filter) args.push(filter);
      return run(args, workingDir!);
    }
  );
}

export function registerTerraformStateShow(server: McpServer, rootDir: string | null) {
  server.registerTool(
    "terraform_state_show",
    {
      title: "Terraform State Show",
      description:
        "Run `terraform state show` to display a single resource's attributes from the state. " +
        "Returns 50-200 lines per resource. For dependency/relationship queries, prefer query_graph.",
      inputSchema: z.object({
        workingDir: workingDirSchema(rootDir),
        address: z.string().describe("Full resource address (e.g. module.compute.aws_instance.web)"),
      }),
    },
    async ({ workingDir, address }) => {
      return run(["state", "show", address], workingDir!);
    }
  );
}

export function registerTerraformOutput(server: McpServer, rootDir: string | null) {
  server.registerTool(
    "terraform_output",
    {
      title: "Terraform Output",
      description: "Run `terraform output -json` to retrieve output values from the Terraform state.",
      inputSchema: z.object({
        workingDir: workingDirSchema(rootDir),
        name: z.string().optional().describe("Specific output name (returns all if omitted)"),
      }),
    },
    async ({ workingDir, name }) => {
      const args = ["output", "-json"];
      if (name) args.push(name);
      const { stdout, stderr, exitCode } = runTerraform(args, workingDir!);
      if (exitCode === 0 && stdout.trim()) {
        try {
          return {
            content: [{ type: "text" as const, text: JSON.stringify(JSON.parse(stdout), null, 2) }],
          };
        } catch { /* fall through */ }
      }
      return toolResult(stdout, stderr, exitCode);
    }
  );
}

export function registerTerraformGraph(server: McpServer, rootDir: string | null) {
  server.registerTool(
    "terraform_graph",
    {
      title: "Terraform Graph",
      description:
        "Run `terraform graph` to generate a Graphviz DOT representation of the dependency graph.",
      inputSchema: z.object({
        workingDir: workingDirSchema(rootDir),
        type: z
          .enum(["plan", "plan-refresh-only", "plan-destroy", "apply"])
          .optional()
          .describe("Graph type (defaults to plan)"),
      }),
    },
    async ({ workingDir, type }) => {
      const args = ["graph"];
      if (type) args.push(`-type=${type}`);
      return run(args, workingDir!);
    }
  );
}

export function registerTerraformProviders(server: McpServer, rootDir: string | null) {
  server.registerTool(
    "terraform_providers",
    {
      title: "Terraform Providers",
      description: "Run `terraform providers` to list the providers required for this configuration.",
      inputSchema: z.object({ workingDir: workingDirSchema(rootDir) }),
    },
    async ({ workingDir }) => {
      return run(["providers"], workingDir!);
    }
  );
}

export function registerTerraformFmt(server: McpServer, rootDir: string | null) {
  server.registerTool(
    "terraform_fmt",
    {
      title: "Terraform Fmt",
      description:
        "Run `terraform fmt -check -diff` to check formatting. Does NOT modify files.",
      inputSchema: z.object({
        workingDir: workingDirSchema(rootDir),
        check: z
          .boolean()
          .optional()
          .default(true)
          .describe("Check only, don't modify files (default true)"),
      }),
    },
    async ({ workingDir, check }) => {
      const args = ["fmt"];
      if (check !== false) args.push("-check", "-diff");
      return run(args, workingDir!);
    }
  );
}

// ─── Write Tier ──────────────────────────────────────────────────────────────

export function registerTerraformApply(
  server: McpServer,
  rootDir: string | null,
  onSuccess: DagInvalidateFn
) {
  server.registerTool(
    "terraform_apply",
    {
      title: "Terraform Apply",
      description:
        "Run `terraform apply -auto-approve` to apply the Terraform plan. " +
        "WARNING: This makes real infrastructure changes. Set `confirm: true` to proceed.",
      inputSchema: z.object({
        workingDir: workingDirSchema(rootDir),
        confirm: z.boolean().describe("Must be true to confirm real changes"),
        varFile: z.string().optional().describe("Path to a .tfvars file"),
        vars: z.record(z.string()).optional().describe("Key-value pairs as -var arguments"),
      }),
    },
    async ({ workingDir, confirm, varFile, vars }) => {
      if (!confirm) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Aborted: `confirm` must be set to true to run terraform apply.",
            },
          ],
          isError: true,
        };
      }
      const args = ["apply", "-auto-approve", "-no-color"];
      if (varFile) args.push(`-var-file=${varFile}`);
      if (vars) for (const [k, v] of Object.entries(vars)) args.push(`-var=${k}=${v}`);
      const { stdout, stderr, exitCode } = runTerraform(args, workingDir!);
      if (exitCode === 0 && onSuccess) onSuccess();
      return toolResult(stdout, stderr, exitCode);
    }
  );
}

export function registerTerraformImport(server: McpServer, rootDir: string | null) {
  server.registerTool(
    "terraform_import",
    {
      title: "Terraform Import",
      description:
        "Run `terraform import` to associate existing infrastructure with a Terraform resource.",
      inputSchema: z.object({
        workingDir: workingDirSchema(rootDir),
        address: z.string().describe("Resource address to import into (e.g. aws_instance.web)"),
        id: z.string().describe("Provider-specific resource ID to import"),
      }),
    },
    async ({ workingDir, address, id }) => {
      return run(["import", "-no-color", address, id], workingDir!);
    }
  );
}

export function registerTerraformStateMv(server: McpServer, rootDir: string | null) {
  server.registerTool(
    "terraform_state_mv",
    {
      title: "Terraform State Mv",
      description: "Run `terraform state mv` to move/rename a resource in the state.",
      inputSchema: z.object({
        workingDir: workingDirSchema(rootDir),
        source: z.string().describe("Source resource address"),
        destination: z.string().describe("Destination resource address"),
      }),
    },
    async ({ workingDir, source, destination }) => {
      return run(["state", "mv", source, destination], workingDir!);
    }
  );
}

// ─── Destroy Tier ────────────────────────────────────────────────────────────

export function registerTerraformDestroy(
  server: McpServer,
  rootDir: string | null,
  onSuccess: DagInvalidateFn
) {
  server.registerTool(
    "terraform_destroy",
    {
      title: "Terraform Destroy",
      description:
        "Run `terraform destroy -auto-approve` to destroy all managed infrastructure. " +
        "WARNING: This permanently removes resources. Set `confirm: true` to proceed.",
      inputSchema: z.object({
        workingDir: workingDirSchema(rootDir),
        confirm: z.boolean().describe("Must be true to confirm destruction"),
        target: z
          .string()
          .optional()
          .describe("Specific resource address to target for destruction"),
      }),
    },
    async ({ workingDir, confirm, target }) => {
      if (!confirm) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Aborted: `confirm` must be set to true to run terraform destroy.",
            },
          ],
          isError: true,
        };
      }
      const args = ["destroy", "-auto-approve", "-no-color"];
      if (target) args.push(`-target=${target}`);
      const { stdout, stderr, exitCode } = runTerraform(args, workingDir!);
      if (exitCode === 0 && onSuccess) onSuccess();
      return toolResult(stdout, stderr, exitCode);
    }
  );
}

export function registerTerraformStateRm(server: McpServer, rootDir: string | null) {
  server.registerTool(
    "terraform_state_rm",
    {
      title: "Terraform State Rm",
      description:
        "Run `terraform state rm` to remove a resource from state without destroying it. " +
        "WARNING: This permanently removes the resource from state tracking.",
      inputSchema: z.object({
        workingDir: workingDirSchema(rootDir),
        address: z.string().describe("Resource address to remove from state"),
        confirm: z.boolean().describe("Must be true to confirm state removal"),
      }),
    },
    async ({ workingDir, address, confirm }) => {
      if (!confirm) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Aborted: `confirm` must be set to true to run terraform state rm.",
            },
          ],
          isError: true,
        };
      }
      return run(["state", "rm", address], workingDir!);
    }
  );
}

// ─── Registration map ────────────────────────────────────────────────────────

export interface ToolRegistrationContext {
  server: McpServer;
  rootDir: string | null;
  dagInvalidate: DagInvalidateFn;
}

// All tools with their registration functions, keyed by tool name
export function getAllToolRegistrations(): Record<
  string,
  (ctx: ToolRegistrationContext) => void
> {
  return {
    // Read
    terraform_init: (ctx) => registerTerraformInit(ctx.server, ctx.rootDir),
    terraform_validate: (ctx) => registerTerraformValidate(ctx.server, ctx.rootDir),
    terraform_plan: (ctx) => registerTerraformPlan(ctx.server, ctx.rootDir),
    terraform_show: (ctx) => registerTerraformShow(ctx.server, ctx.rootDir),
    terraform_state_list: (ctx) => registerTerraformStateList(ctx.server, ctx.rootDir),
    terraform_state_show: (ctx) => registerTerraformStateShow(ctx.server, ctx.rootDir),
    terraform_output: (ctx) => registerTerraformOutput(ctx.server, ctx.rootDir),
    terraform_graph: (ctx) => registerTerraformGraph(ctx.server, ctx.rootDir),
    terraform_providers: (ctx) => registerTerraformProviders(ctx.server, ctx.rootDir),
    terraform_fmt: (ctx) => registerTerraformFmt(ctx.server, ctx.rootDir),
    // Write
    terraform_apply: (ctx) =>
      registerTerraformApply(ctx.server, ctx.rootDir, ctx.dagInvalidate),
    terraform_import: (ctx) => registerTerraformImport(ctx.server, ctx.rootDir),
    terraform_state_mv: (ctx) => registerTerraformStateMv(ctx.server, ctx.rootDir),
    // Destroy
    terraform_destroy: (ctx) =>
      registerTerraformDestroy(ctx.server, ctx.rootDir, ctx.dagInvalidate),
    terraform_state_rm: (ctx) => registerTerraformStateRm(ctx.server, ctx.rootDir),
  };
}
