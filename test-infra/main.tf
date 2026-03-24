terraform {
  required_providers {
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }
}

resource "null_resource" "hello" {
  triggers = {
    message = "Hello from Terraform MCP!"
  }
}

output "greeting" {
  value = "Terraform MCP server is working!"
}
