---
name: terraform-parsing
description: Use when reading, parsing, or discussing .tf files, HCL syntax, resources, modules, variables, outputs, or Terraform dependency declarations.
---

# SKILL: Terraform Parsing

**Triggers when:** reading, parsing, or discussing `.tf` files.

---

## Key Concepts

### Resources
The primary building block of Terraform. Every resource has:
- A **type** (e.g., `aws_vpc`, `aws_s3_bucket`)
- A **name** (local identifier within the module)
- A **config block** (arguments specific to that resource type)

```hcl
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}
```

### Modules
Reusable groups of resources. Modules have:
- **inputs** (declared as `variable` blocks inside the module)
- **outputs** (declared as `output` blocks inside the module)
- A **source** (local path, Terraform registry slug, or git URL)

### Variables
Inputs to a configuration. May or may not have a `default` value.
Treat any variable without a default as **required**.

### Outputs
Values exposed to parent modules or to the root caller.
An output referencing a resource creates an **implicit edge**.

### depends_on
Explicit dependency declaration. Creates a DAG edge regardless of
whether any attribute reference exists.

### Implicit References
Any expression of the form `resource_type.name.attribute`
(e.g., `aws_vpc.main.id`) creates an implicit dependency edge
from the containing resource to the referenced resource.

---

## Gotchas

- **HCL is not JSON.** Do not parse `.tf` files as JSON. HCL has
  its own type system, heredocs, and expression syntax.

- **Module sources vary.** A `source` can be:
  - Local path: `./modules/networking`
  - Terraform registry: `hashicorp/consul/aws`
  - Git URL: `git::https://example.com/module.git`
  Handle all three forms — do not assume local paths only.

- **Variables without defaults are required.** A variable block
  with no `default` argument must be supplied by the caller.
  Do not assume a missing default means `null`.

- **`depends_on` creates an edge with no attribute reference.**
  A resource with `depends_on = [aws_vpc.main]` depends on that
  VPC even if it never references `aws_vpc.main.id` anywhere.
  This edge must be captured and labeled as `explicit`.

- **Module outputs create implicit inter-module edges.**
  If `module.networking` outputs `vpc_id` and another resource
  uses `module.networking.vpc_id`, that creates an implicit edge
  from the consuming resource to `module.networking` — which
  transitively points to whatever emits `vpc_id` inside the module.
