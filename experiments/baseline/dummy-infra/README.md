# Dummy Infrastructure — 75 null_resources, 6 Modules

Simulates a production 3-tier AWS deployment using only `null_resource` with `triggers`.
Zero cloud charges. All dependency edges are real Terraform graph edges.

## Purpose

This infrastructure exists to generate a realistic Terraform state file that is too
large for an LLM to consume raw. It is the foundation for all three experiments
defined in `GOAL.md`.

**Key metrics after `terraform apply`:**

| Metric | Value |
|--------|-------|
| Total resources | 75 |
| Pretty-printed state lines | 4041 |
| Raw state size | 131 KB (~33K tokens) |
| Graph edges | 106 |
| Cloud charges | $0 |

## Module Breakdown

| Module | Resources | Simulates |
|--------|-----------|-----------|
| **networking** | 15 | VPC, 8 subnets (3 public, 3 private, 2 DB), IGW, NAT, EIP, 3 route tables |
| **security** | 14 | 4-hop SG chain (ALB -> Web -> App -> DB), 4 SG rules, 3 IAM roles, 3 IAM policies |
| **compute** | 16 | Key pair, 2 instance profiles, 2 launch templates, 2 ASGs, 4 EC2 instances, 2 scaling policies, 2 CW alarms, bastion |
| **database** | 10 | DB subnet group, parameter group, option group, RDS primary + replica, ElastiCache (subnet group, params, cluster), Secrets Manager secret + version |
| **loadbalancer** | 10 | ACM cert, ALB, 2 target groups, 2 listeners, 2 listener rules, Route53 record, WAF |
| **monitoring** | 10 | SNS topic, 2 subscriptions, 3 CW alarms, log group, metric filter, dashboard, EventBridge rule |

## Dependency Graph

```
networking --> security --> compute --> monitoring
    |              |            |           ^
    |              |            +-----------+
    |              +--> database --> monitoring
    +--> loadbalancer --> monitoring
```

### Key Chains for Experiments

1. **VPC chain:** VPC -> 8 subnets -> 3 route tables -> NAT/IGW (depth traversal)
2. **SG chain:** sg_alb -> sg_web -> sg_app -> sg_db (4-hop, experiment prompt #6)
3. **Deployment chain:** key_pair -> instance_profile -> launch_template -> ASG -> instances (prompt #7)
4. **Impact chain:** db_subnet_group -> rds_primary -> rds_replica + secrets_manager_version (prompt #4)

## How Dependencies Work

Each `null_resource` holds simulated AWS attributes in its `triggers` map.
Dependencies are created by referencing another resource's trigger value:

```hcl
resource "null_resource" "sg_web" {
  triggers = {
    ingress_source_sg = null_resource.sg_alb.triggers.sg_id  # <-- real graph edge
  }
}
```

This produces the same Terraform dependency graph as real `aws_security_group` resources.

## State Inflation Strategy

Each resource carries 14+ metadata trigger keys (aws_account_id, compliance_check,
cost_allocation, etc.) to push the JSON state above 4000 lines. "Fat" resources
like `rds_primary` carry 40+ triggers. The metadata keys are realistic AWS resource
attributes, not filler.

## Quick Start

```bash
cd experiments/baseline/dummy-infra
terraform init
terraform apply -auto-approve    # instant, no cloud calls
terraform state list | wc -l     # 75
terraform show -json | python3 -m json.tool | wc -l  # 4041
terraform graph | grep -c "\->"  # 106
```

## File Structure

```
dummy-infra/
├── providers.tf          # hashicorp/null ~> 3.0
├── variables.tf          # project_name, environment, region, CIDRs, instance types, etc.
├── main.tf               # Wires all 6 modules with cross-module variable passing
├── outputs.tf            # Re-exposes key values from each module
├── terraform.tfvars      # Default values (project42-prod, us-east-1, etc.)
└── modules/
    ├── networking/        # main.tf, variables.tf, outputs.tf
    ├── security/          # main.tf, variables.tf, outputs.tf
    ├── compute/           # main.tf, variables.tf, outputs.tf
    ├── database/          # main.tf, variables.tf, outputs.tf
    ├── loadbalancer/      # main.tf, variables.tf, outputs.tf
    └── monitoring/        # main.tf, variables.tf, outputs.tf
```

## Cross-Module Variable Wiring (root main.tf)

```
module.networking  -->  vpc_id, subnet_ids       -->  security, compute, database, loadbalancer
module.security    -->  sg_ids, iam_role_arns     -->  compute, database, loadbalancer
module.compute     -->  asg_names, instance_ids   -->  monitoring
module.database    -->  rds_endpoint, primary_id  -->  monitoring
module.loadbalancer --> alb_arn, dns_name         -->  monitoring
```

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-03-28 | ShahParin | Initial build: 75 resources, 6 modules, 4041-line state, 106 edges |
