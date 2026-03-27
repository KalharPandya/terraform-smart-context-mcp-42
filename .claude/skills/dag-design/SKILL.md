# SKILL: DAG Design

**Triggers when:** building, querying, or discussing the DAG structure.

---

## Node Conventions

Every node in the graph represents a Terraform entity.

**Node ID format varies by entity type:**

| Entity | Format | ID Example |
|--------|--------|-----------|
| Resource | `resource_type.resource_name` | `aws_vpc.main` |
| Resource | `resource_type.resource_name` | `aws_subnet.public` |
| Module | `module.module_name` | `module.networking` |
| Module | `module.module_name` | `module.database` |

**Every node must carry:**
- `id` — the canonical ID string (format above)
- `type` — `"resource"` or `"module"`
- `config` — the parsed HCL config block (arguments)
- `metadata` — source file path, line number, module path

---

## Edge Conventions

An edge represents a dependency relationship between two nodes.

**Edge direction:** dependent → dependency

```
aws_subnet.public → aws_vpc.main
```

Means: `aws_subnet.public` depends on `aws_vpc.main`.

**Every edge must carry:**
- `from` — ID of the dependent node
- `to` — ID of the dependency node
- `type` — `"explicit"` (from `depends_on`) or `"implicit"` (from attribute reference)
- `source` — why the edge exists (e.g., `"depends_on"`, `"aws_vpc.main.id"`)

---

## Gotchas

- **Circular dependencies are invalid Terraform, but handle them gracefully.**
  If a cycle is detected, do not crash or throw. Log the cycle, flag the nodes
  involved, and continue building the rest of the graph. Return the cycle info
  in the node's metadata so callers can surface it.

- **Module outputs create implicit inter-module edges.**
  If `module.networking` exposes `vpc_id` and a resource consumes
  `module.networking.vpc_id`, create an edge:
  `consuming_resource → module.networking`
  Label it `implicit` with the source set to `"module.networking.vpc_id"`.

- **One resource can have both explicit and implicit edges to the same target.**
  Example: a resource has `depends_on = [aws_vpc.main]` AND references
  `aws_vpc.main.id` in its config.
  This produces two raw edges. **Deduplicate to one edge** in the final graph,
  but preserve **both edge type labels** (`["explicit", "implicit"]`) on that edge.
  Do not discard either — both are meaningful for explaining the dependency.
