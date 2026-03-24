# terraform-smart-context-mcp

A Model Context Protocol (MCP) server that exposes Terraform CLI commands as tools — usable directly from Claude Desktop, Claude Code, and Cursor.

## Tools

| Tool | Description |
|---|---|
| `terraform_init` | Run `terraform init` to initialize a working directory |
| `terraform_validate` | Validate configuration syntax and internal consistency |
| `terraform_plan` | Preview infrastructure changes (safe, no apply) |
| `terraform_apply` | Apply changes — requires `confirm: true` guard |
| `terraform_state_list` | List all resources in Terraform state |
| `terraform_output` | Retrieve output values as pretty-printed JSON |

All tools accept a `workingDir` parameter — the absolute path to your Terraform config directory.

## Install

```bash
npm install
```

Requires Node.js 18+ and [Terraform CLI](https://developer.hashicorp.com/terraform/install) in your PATH.

## Configuration

> **Note:** Claude Desktop does not support a `cwd` config field. Use absolute paths as shown below.

Replace `<PROJECT_PATH>` with the absolute path where you cloned/placed this repo (e.g. `P:\\42-Terraform-MCP` on Windows).

### Claude Desktop

`%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "terraform": {
      "command": "<PROJECT_PATH>\\node_modules\\.bin\\tsx.cmd",
      "args": ["<PROJECT_PATH>\\src\\index.ts"]
    }
  }
}
```

### Claude Code

`~/.claude/settings.json` (global) or `.claude/settings.json` (per project):

```json
{
  "mcpServers": {
    "terraform": {
      "command": "<PROJECT_PATH>/node_modules/.bin/tsx",
      "args": ["<PROJECT_PATH>/src/index.ts"]
    }
  }
}
```

Or add via CLI:

```bash
claude mcp add terraform -- <PROJECT_PATH>/node_modules/.bin/tsx <PROJECT_PATH>/src/index.ts
```

### Cursor

`.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "terraform": {
      "command": "<PROJECT_PATH>/node_modules/.bin/tsx",
      "args": ["<PROJECT_PATH>/src/index.ts"]
    }
  }
}
```

## Test

Run the smoke test (validates and plans against the bundled `test-infra/`):

```bash
node test-mcp.mjs
```

Expected output: both `terraform_validate` and `terraform_plan` succeed against `test-infra/main.tf`.

## Test Infrastructure

`test-infra/main.tf` contains a minimal Terraform config using the `null` provider — useful for testing the MCP server without touching real cloud infrastructure:

```hcl
terraform {
  required_providers {
    null = { source = "hashicorp/null", version = "~> 3.0" }
  }
}
```

Run `terraform init` inside `test-infra/` before testing state/output tools.

## Development

```bash
npm run dev      # run with tsx (no build needed)
npm run build    # compile to dist/
npm run start    # run compiled output
```

## How it works

The server starts on stdio and implements the [Model Context Protocol](https://modelcontextprotocol.io). Each tool spawns `terraform` as a subprocess in the given `workingDir`, captures stdout/stderr, and returns the result as MCP tool output. On Windows, `shell: true` is set automatically for compatibility.
