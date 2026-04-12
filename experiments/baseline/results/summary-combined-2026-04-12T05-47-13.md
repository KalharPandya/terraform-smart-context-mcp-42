# Combined Experiment Results — Raw vs MCP

- **Date:** 2026-04-12T05:47:13.337Z
- **Model:** gemini-3-flash-preview
- **Modes:** raw + mcp
- **CLI Version:** Gemini CLI 0.37.1
- **Trials per prompt:** 2
- **Total prompts:** 30
- **Raw phase:** 2026-04-12T01:50:50.831Z → 2026-04-12T01:50:50.831Z
- **MCP phase:** 2026-04-12T02:23:31.563Z → 2026-04-12T02:23:31.563Z

## Table 1: Head-to-Head Comparison (Raw vs MCP)

| # | Prompt | Diff | Raw Score | MCP Score | Δ Score | Raw Tokens | MCP Tokens | Token Δ% | Raw Cost | MCP Cost |
|---|--------|------|-----------|-----------|---------|------------|------------|----------|----------|----------|
| 1 | What is the CIDR block of the VPC? | easy | 1.00 | 1.00 | +0.00 | 31,461 | 41,791 | 33% | $0.0048 | $0.0065 |
| 2 | What is the public IP of the ba... | easy | 1.00 | 1.00 | +0.00 | 36,612 | 42,169 | 15% | $0.0056 | $0.0066 |
| 3 | What database engine and port d... | easy | 1.00 | 1.00 | +0.00 | 42,401 | 63,264 | 49% | $0.0065 | $0.0098 |
| 4 | List all six modules in the inf... | easy | 1.00 | 1.00 | +0.00 | 15,960 | 29,699 | 86% | $0.0025 | $0.0046 |
| 5 | List all subnets and their avai... | easy | 1.00 | 1.00 | +0.00 | 63,599 | 39,356 | -38% | $0.0100 | $0.0062 |
| 6 | How many resources are there in... | easy | 0.75 | 1.00 | +0.25 | 24,534 | 29,934 | 22% | $0.0038 | $0.0047 |
| 7 | What are the names of all four ... | easy | 1.00 | 1.00 | +0.00 | 31,095 | 30,804 | -1% | $0.0048 | $0.0048 |
| 8 | What is the Redis cache engine ... | easy | 1.00 | 1.00 | +0.00 | 39,174 | 52,115 | 33% | $0.0060 | $0.0081 |
| 9 | What resources directly depend ... | medium | 1.00 | 1.00 | +0.00 | 342,588 | 34,236 | -90% | $0.0520 | $0.0055 |
| 10 | What resources directly depend ... | medium | 1.00 | 0.00 | -1.00 | 312,272 | 1,810 | -99% | $0.0475 | $0.0003 |
| 11 | Which resources in the compute ... | medium | 1.00 | 0.00 | -1.00 | 100,526 | 1,783 | -98% | $0.0154 | $0.0003 |
| 12 | Which resources reference the S... | medium | 1.00 | 0.00 | -1.00 | 218,986 | 1,778 | -99% | $0.0333 | $0.0003 |
| 13 | List all security group rules t... | medium | 0.50 | 0.00 | -0.50 | 358,225 | 1,826 | -99% | $0.0544 | $0.0003 |
| 14 | List all resources in the datab... | medium | 1.00 | 0.00 | -1.00 | 141,336 | 1,786 | -99% | $0.0216 | $0.0003 |
| 15 | What modules does the monitorin... | medium | 1.00 | 0.00 | -1.00 | 16,216 | 1,785 | -89% | $0.0025 | $0.0003 |
| 16 | What ports are exposed by each ... | medium | 1.00 | 0.00 | -1.00 | 68,668 | 1,798 | -97% | $0.0106 | $0.0003 |
| 17 | List all resources that have en... | medium | 1.00 | 0.00 | -1.00 | 169,661 | 1,840 | -99% | $0.0260 | $0.0003 |
| 18 | What is the correct deployment ... | medium | 0.50 | 0.00 | -0.50 | 532,461 | 1,820 | -100% | $0.0805 | $0.0003 |
| 19 | Trace the full dependency chain... | hard | 0.75 | 0.00 | -0.75 | 502,742 | 1,800 | -100% | $0.0763 | $0.0003 |
| 20 | If I destroy the RDS primary in... | hard | 1.00 | 0.00 | -1.00 | 449,727 | 1,830 | -100% | $0.0681 | $0.0003 |
| 21 | If I destroy sg_web, what resou... | hard | 1.00 | 0.00 | -1.00 | 79,608 | 1,814 | -98% | $0.0124 | $0.0003 |
| 22 | What is the correct deployment ... | hard | 0.50 | 0.00 | -0.50 | 241,136 | 1,827 | -99% | $0.0367 | $0.0003 |
| 23 | Which module outputs does the c... | hard | 1.00 | 0.00 | -1.00 | 24,865 | 1,792 | -93% | $0.0039 | $0.0003 |
| 24 | Trace the dependency path from ... | hard | 0.00 | 0.00 | +0.00 | 903,056 | 1,840 | -100% | $0.1361 | $0.0003 |
| 25 | If the NAT gateway fails, which... | hard | 0.00 | 0.00 | +0.00 | 128,514 | 1,838 | -99% | $0.0198 | $0.0003 |
| 26 | What Terraform resources would ... | hard | 1.00 | 0.00 | -1.00 | 90,631 | 1,827 | -98% | $0.0140 | $0.0003 |
| 27 | What is the full dependency cha... | hard | 0.75 | 0.00 | -0.75 | 310,593 | 1,805 | -99% | $0.0472 | $0.0003 |
| 28 | Which resources are leaf nodes ... | hard | 1.00 | 0.00 | -1.00 | 201,103 | 1,806 | -99% | $0.0308 | $0.0003 |
| 29 | Compare the web tier and app ti... | hard | 0.00 | 0.00 | +0.00 | 65,398 | 1,844 | -97% | $0.0102 | $0.0003 |
| 30 | If I need to rotate the RDS cre... | hard | 1.00 | 0.00 | -1.00 | 260,210 | 1,819 | -99% | $0.0397 | $0.0003 |
| - | **TOTALS/MEANS** | | **0.82** | **0.30** | **-0.53** | 5,803,358 | 401,436 | -93% | $0.8832 | $0.0633 |

## Table 2: Raw Mode — Scores & Metrics

| # | Prompt | Diff | T1 | T2 | Mean | Avg Tokens | Avg Tools | Avg Time(s) | Avg Cost |
|---|--------|------|----|----|------|------------|-----------|-------------|----------|
| 1 | What is the CIDR block of the VPC? | easy | 1.0 | 1.0 | 1.00 | 31,461 | 2 | 10.6 | $0.0048 |
| 2 | What is the public IP of the ba... | easy | 1.0 | 1.0 | 1.00 | 36,612 | 3 | 11.6 | $0.0056 |
| 3 | What database engine and port d... | easy | 1.0 | 1.0 | 1.00 | 42,401 | 4 | 12.7 | $0.0065 |
| 4 | List all six modules in the inf... | easy | 1.0 | 1.0 | 1.00 | 15,960 | 2 | 7.6 | $0.0025 |
| 5 | List all subnets and their avai... | easy | 1.0 | 1.0 | 1.00 | 63,599 | 7 | 27.4 | $0.0100 |
| 6 | How many resources are there in... | easy | 0.5 | 1.0 | 0.75 | 24,534 | 2 | 15.8 | $0.0038 |
| 7 | What are the names of all four ... | easy | 1.0 | 1.0 | 1.00 | 31,095 | 3 | 12.7 | $0.0048 |
| 8 | What is the Redis cache engine ... | easy | 1.0 | 1.0 | 1.00 | 39,174 | 3 | 13.7 | $0.0060 |
| 9 | What resources directly depend ... | medium | 1.0 | 1.0 | 1.00 | 342,588 | 12 | 57.4 | $0.0520 |
| 10 | What resources directly depend ... | medium | 1.0 | 1.0 | 1.00 | 312,272 | 19 | 69.5 | $0.0475 |
| 11 | Which resources in the compute ... | medium | 1.0 | 1.0 | 1.00 | 100,526 | 8 | 24.7 | $0.0154 |
| 12 | Which resources reference the S... | medium | 1.0 | 1.0 | 1.00 | 218,986 | 12 | 43.2 | $0.0333 |
| 13 | List all security group rules t... | medium | 0.0 | 1.0 | 0.50 | 358,225 | 11 | 44.5 | $0.0544 |
| 14 | List all resources in the datab... | medium | 1.0 | 1.0 | 1.00 | 141,336 | 6 | 32.5 | $0.0216 |
| 15 | What modules does the monitorin... | medium | 1.0 | 1.0 | 1.00 | 16,216 | 1 | 8.8 | $0.0025 |
| 16 | What ports are exposed by each ... | medium | 1.0 | 1.0 | 1.00 | 68,668 | 5 | 22.1 | $0.0106 |
| 17 | List all resources that have en... | medium | 1.0 | 1.0 | 1.00 | 169,661 | 9 | 36.9 | $0.0260 |
| 18 | What is the correct deployment ... | medium | 0.5 | 0.5 | 0.50 | 532,461 | 17 | 82.8 | $0.0805 |
| 19 | Trace the full dependency chain... | hard | 0.5 | 1.0 | 0.75 | 502,742 | 17 | 83.3 | $0.0763 |
| 20 | If I destroy the RDS primary in... | hard | 1.0 | 1.0 | 1.00 | 449,727 | 16 | 63.9 | $0.0681 |
| 21 | If I destroy sg_web, what resou... | hard | 1.0 | 1.0 | 1.00 | 79,608 | 5 | 26.4 | $0.0124 |
| 22 | What is the correct deployment ... | hard | 0.0 | 1.0 | 0.50 | 241,136 | 10 | 52.6 | $0.0367 |
| 23 | Which module outputs does the c... | hard | 1.0 | 1.0 | 1.00 | 24,865 | 3 | 12.8 | $0.0039 |
| 24 | Trace the dependency path from ... | hard | 0.0 | 0.0 | 0.00 | 903,056 | 17 | 106.9 | $0.1361 |
| 25 | If the NAT gateway fails, which... | hard | 0.0 | 0.0 | 0.00 | 128,514 | 5 | 33.4 | $0.0198 |
| 26 | What Terraform resources would ... | hard | 1.0 | 1.0 | 1.00 | 90,631 | 4 | 26.3 | $0.0140 |
| 27 | What is the full dependency cha... | hard | 1.0 | 0.5 | 0.75 | 310,593 | 11 | 59.0 | $0.0472 |
| 28 | Which resources are leaf nodes ... | hard | 1.0 | 1.0 | 1.00 | 201,103 | 12 | 74.2 | $0.0308 |
| 29 | Compare the web tier and app ti... | hard | 0.0 | 0.0 | 0.00 | 65,398 | 3 | 23.3 | $0.0102 |
| 30 | If I need to rotate the RDS cre... | hard | 1.0 | 1.0 | 1.00 | 260,210 | 8 | 42.2 | $0.0397 |

## Table 3: MCP Mode — Scores & Metrics

| # | Prompt | Diff | T1 | T2 | Mean | Avg Tokens | Avg Tools | Avg Time(s) | Avg Cost |
|---|--------|------|----|----|------|------------|-----------|-------------|----------|
| 1 | What is the CIDR block of the VPC? | easy | 1.0 | 1.00 | 41,791 | 3 | 12.6 | $0.0065 |
| 2 | What is the public IP of the ba... | easy | 1.0 | 1.00 | 42,169 | 3 | 13.8 | $0.0066 |
| 3 | What database engine and port d... | easy | 1.0 | 1.00 | 63,264 | 5 | 17.3 | $0.0098 |
| 4 | List all six modules in the inf... | easy | 1.0 | 1.00 | 29,699 | 2 | 12.1 | $0.0046 |
| 5 | List all subnets and their avai... | easy | 1.0 | 1.00 | 39,356 | 2 | 11.4 | $0.0062 |
| 6 | How many resources are there in... | easy | 1.0 | 1.00 | 29,934 | 2 | 11.8 | $0.0047 |
| 7 | What are the names of all four ... | easy | 1.0 | 1.00 | 30,804 | 2 | 12.7 | $0.0048 |
| 8 | What is the Redis cache engine ... | easy | 1.0 | 1.00 | 52,115 | 4 | 15.1 | $0.0081 |
| 9 | What resources directly depend ... | medium | 1.0 | 1.00 | 34,236 | 2 | 12.0 | $0.0055 |
| 10 | What resources directly depend ... | medium | 0.0 | 0.00 | 1,810 | 0 | 0.0 | $0.0003 |
| 11 | Which resources in the compute ... | medium | 0.0 | 0.00 | 1,783 | 0 | 0.0 | $0.0003 |
| 12 | Which resources reference the S... | medium | 0.0 | 0.00 | 1,778 | 0 | 0.0 | $0.0003 |
| 13 | List all security group rules t... | medium | 0.0 | 0.00 | 1,826 | 0 | 0.0 | $0.0003 |
| 14 | List all resources in the datab... | medium | 0.0 | 0.00 | 1,786 | 0 | 0.0 | $0.0003 |
| 15 | What modules does the monitorin... | medium | 0.0 | 0.00 | 1,785 | 0 | 0.0 | $0.0003 |
| 16 | What ports are exposed by each ... | medium | 0.0 | 0.00 | 1,798 | 0 | 0.0 | $0.0003 |
| 17 | List all resources that have en... | medium | 0.0 | 0.00 | 1,840 | 0 | 0.0 | $0.0003 |
| 18 | What is the correct deployment ... | medium | 0.0 | 0.00 | 1,820 | 0 | 0.0 | $0.0003 |
| 19 | Trace the full dependency chain... | hard | 0.0 | 0.00 | 1,800 | 0 | 0.0 | $0.0003 |
| 20 | If I destroy the RDS primary in... | hard | 0.0 | 0.00 | 1,830 | 0 | 0.0 | $0.0003 |
| 21 | If I destroy sg_web, what resou... | hard | 0.0 | 0.00 | 1,814 | 0 | 0.0 | $0.0003 |
| 22 | What is the correct deployment ... | hard | 0.0 | 0.00 | 1,827 | 0 | 0.0 | $0.0003 |
| 23 | Which module outputs does the c... | hard | 0.0 | 0.00 | 1,792 | 0 | 0.0 | $0.0003 |
| 24 | Trace the dependency path from ... | hard | 0.0 | 0.00 | 1,840 | 0 | 0.0 | $0.0003 |
| 25 | If the NAT gateway fails, which... | hard | 0.0 | 0.00 | 1,838 | 0 | 0.0 | $0.0003 |
| 26 | What Terraform resources would ... | hard | 0.0 | 0.00 | 1,827 | 0 | 0.0 | $0.0003 |
| 27 | What is the full dependency cha... | hard | 0.0 | 0.00 | 1,805 | 0 | 0.0 | $0.0003 |
| 28 | Which resources are leaf nodes ... | hard | 0.0 | 0.00 | 1,806 | 0 | 0.0 | $0.0003 |
| 29 | Compare the web tier and app ti... | hard | 0.0 | 0.00 | 1,844 | 0 | 0.0 | $0.0003 |
| 30 | If I need to rotate the RDS cre... | hard | 0.0 | 0.00 | 1,819 | 0 | 0.0 | $0.0003 |

## Table 4: Aggregates by Difficulty — Raw vs MCP

| Difficulty | Raw Score | MCP Score | Δ Score | Raw Tokens | MCP Tokens | Token Δ% | Raw Cost | MCP Cost |
|------------|-----------|-----------|---------|------------|------------|----------|----------|----------|
| easy | 0.97 | 1.00 | +0.03 | 35,604 | 41,142 | 16% | $0.0055 | $0.0064 |
| medium | 0.90 | 0.10 | -0.80 | 226,094 | 5,046 | -98% | $0.0344 | $0.0008 |
| hard | 0.67 | 0.00 | -0.67 | 271,465 | 1,820 | -99% | $0.0413 | $0.0003 |

## Score Details

### Prompt 1: What is the CIDR block of the VPC?
- **Difficulty:** easy | **Category:** attribute-lookup | **Scoring:** substring-match
- Raw Trial 1: **1.0** — Found 1/1: [10.0.0.0/16]
- Raw Trial 2: **1.0** — Found 1/1: [10.0.0.0/16]
- MCP Trial 1: **1.0** — Found 1/1: [10.0.0.0/16]

### Prompt 2: What is the public IP of the bastion host?
- **Difficulty:** easy | **Category:** attribute-lookup | **Scoring:** substring-match
- Raw Trial 1: **1.0** — Found 1/1: [54.210.167.100]
- Raw Trial 2: **1.0** — Found 1/1: [54.210.167.100]
- MCP Trial 1: **1.0** — Found 1/1: [54.210.167.100]

### Prompt 3: What database engine and port does the RDS primary instance use?
- **Difficulty:** easy | **Category:** attribute-lookup | **Scoring:** substring-match
- Raw Trial 1: **1.0** — Found 2/2: [postgresql, 5432]
- Raw Trial 2: **1.0** — Found 2/2: [postgresql, 5432]
- MCP Trial 1: **1.0** — Found 2/2: [postgresql, 5432]

### Prompt 4: List all six modules in the infrastructure.
- **Difficulty:** easy | **Category:** enumeration | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 6/6 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 6/6 (100%). Missing: []
- MCP Trial 1: **1.0** — Matched 6/6 (100%). Missing: []

### Prompt 5: List all subnets and their availability zones.
- **Difficulty:** easy | **Category:** enumeration | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 8/8 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 8/8 (100%). Missing: []
- MCP Trial 1: **1.0** — Matched 8/8 (100%). Missing: []

### Prompt 6: How many resources are there in total? Break down the count by module.
- **Difficulty:** easy | **Category:** inventory | **Scoring:** checklist
- Raw Trial 1: **0.5** — Checked 6/7 (need 7 for full, 4 for partial). Found: [75 total, networking: 15, security: 14, compute: 16, database: 10, monitoring: 10]. Missing: [loadbalancer: 10]
- Raw Trial 2: **1.0** — Checked 7/7 (need 7 for full, 4 for partial). Found: [75 total, networking: 15, security: 14, compute: 16, database: 10, loadbalancer: 10, monitoring: 10]. Missing: []
- MCP Trial 1: **1.0** — Checked 7/7 (need 7 for full, 4 for partial). Found: [75 total, networking: 15, security: 14, compute: 16, database: 10, loadbalancer: 10, monitoring: 10]. Missing: []

### Prompt 7: What are the names of all four security groups?
- **Difficulty:** easy | **Category:** enumeration | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 4/4 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 4/4 (100%). Missing: []
- MCP Trial 1: **1.0** — Matched 4/4 (100%). Missing: []

### Prompt 8: What is the Redis cache engine version and node type?
- **Difficulty:** easy | **Category:** attribute-lookup | **Scoring:** substring-match
- Raw Trial 1: **1.0** — Found 2/2: [7.0, cache.r6g.large]
- Raw Trial 2: **1.0** — Found 2/2: [7.0, cache.r6g.large]
- MCP Trial 1: **1.0** — Found 2/2: [7.0, cache.r6g.large]

### Prompt 9: What resources directly depend on the VPC?
- **Difficulty:** medium | **Category:** dependency-direct | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 12/12 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 12/12 (100%). Missing: []
- MCP Trial 1: **1.0** — Matched 12/12 (100%). Missing: []

### Prompt 10: What resources directly depend on the ALB?
- **Difficulty:** medium | **Category:** dependency-direct | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 4/4 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 4/4 (100%). Missing: []
- MCP Trial 1: **0.0** — Matched 0/4 (0%). Missing: [listener_http, listener_https, route53_record, waf_web_acl]

### Prompt 11: Which resources in the compute module reference the key_pair?
- **Difficulty:** medium | **Category:** dependency-direct | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 7/7 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 7/7 (100%). Missing: []
- MCP Trial 1: **0.0** — Matched 0/7 (0%). Missing: [launch_template_web, launch_template_app, web_instance_1, web_instance_2, app_instance_1, app_instance_2, bastion]

### Prompt 12: Which resources reference the SNS topic?
- **Difficulty:** medium | **Category:** dependency-direct | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 6/6 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 6/6 (100%). Missing: []
- MCP Trial 1: **0.0** — Matched 0/6 (0%). Missing: [sns_subscription_email, sns_subscription_slack, cw_alarm_cpu, cw_alarm_memory, cw_alarm_5xx, eventbridge_rule]

### Prompt 13: List all security group rules that allow inbound traffic from 0.0.0.0/0.
- **Difficulty:** medium | **Category:** security-filter | **Scoring:** set-overlap
- Raw Trial 1: **0.0** — Matched 0/2 (0%). Missing: [sg_alb: port 443 (HTTPS), sg_rule_alb: port 80 (HTTP)]
- Raw Trial 2: **1.0** — Matched 2/2 (100%). Missing: []
- MCP Trial 1: **0.0** — Matched 0/2 (0%). Missing: [sg_alb: port 443 (HTTPS), sg_rule_alb: port 80 (HTTP)]

### Prompt 14: List all resources in the database module that have no dependencies on other database resources.
- **Difficulty:** medium | **Category:** dependency-direct | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 6/6 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 6/6 (100%). Missing: []
- MCP Trial 1: **0.0** — Matched 0/6 (0%). Missing: [db_subnet_group, db_parameter_group, db_option_group, elasticache_subnet_group, elasticache_parameter_group, secrets_manager_secret]

### Prompt 15: What modules does the monitoring module consume outputs from?
- **Difficulty:** medium | **Category:** cross-module | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 3/3 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 3/3 (100%). Missing: []
- MCP Trial 1: **0.0** — Matched 0/3 (0%). Missing: [compute, database, loadbalancer]

### Prompt 16: What ports are exposed by each security group for inbound traffic?
- **Difficulty:** medium | **Category:** security-filter | **Scoring:** checklist
- Raw Trial 1: **1.0** — Checked 4/4 (need 4 for full, 2 for partial). Found: [sg_alb: 443, sg_web: 8080, sg_app: 3000, sg_db: 5432]. Missing: []
- Raw Trial 2: **1.0** — Checked 4/4 (need 4 for full, 2 for partial). Found: [sg_alb: 443, sg_web: 8080, sg_app: 3000, sg_db: 5432]. Missing: []
- MCP Trial 1: **0.0** — Checked 0/4 (need 4 for full, 2 for partial). Found: []. Missing: [sg_alb: 443, sg_web: 8080, sg_app: 3000, sg_db: 5432]

### Prompt 17: List all resources that have encryption enabled (storage, at-rest, or in-transit).
- **Difficulty:** medium | **Category:** security-filter | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 6/6 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 6/6 (100%). Missing: []
- MCP Trial 1: **0.0** — Matched 0/6 (0%). Missing: [rds_primary, rds_replica, elasticache_cluster, sns_topic, cw_log_group, secrets_manager_secret]

### Prompt 18: What is the correct deployment order for the load balancer module?
- **Difficulty:** medium | **Category:** deployment-order | **Scoring:** topological-validation
- Raw Trial 1: **0.5** — Nodes: 2/10 present. Precedence: 1/1 satisfied. Raw: 0.60. Missing nodes: [acm_certificate, target_group_web, target_group_app, listener_http, listener_https, listener_rule_web, listener_rule_app, waf_web_acl]. 
- Raw Trial 2: **0.5** — Nodes: 2/10 present. Precedence: 1/1 satisfied. Raw: 0.60. Missing nodes: [acm_certificate, target_group_web, target_group_app, listener_http, listener_https, listener_rule_web, listener_rule_app, waf_web_acl]. 
- MCP Trial 1: **0.0** — Nodes: 0/10 present. Precedence: 0/0 satisfied. Raw: 0.00. Missing nodes: [acm_certificate, alb, target_group_web, target_group_app, listener_http, listener_https, listener_rule_web, listener_rule_app, route53_record, waf_web_acl]. 

### Prompt 19: Trace the full dependency chain from the HTTPS listener to the RDS primary database.
- **Difficulty:** hard | **Category:** dependency-chain | **Scoring:** topological-validation
- Raw Trial 1: **0.5** — Nodes: 5/7 present. Precedence: 2/3 satisfied. Raw: 0.69. Missing nodes: [sg_alb, sg_web]. Violations: [sg_db should precede rds_primary]
- Raw Trial 2: **1.0** — Nodes: 7/7 present. Precedence: 5/6 satisfied. Raw: 0.92. Violations: [sg_db should precede rds_primary]
- MCP Trial 1: **0.0** — Nodes: 0/7 present. Precedence: 0/0 satisfied. Raw: 0.00. Missing nodes: [listener_https, alb, sg_alb, sg_web, sg_app, sg_db, rds_primary]. 

### Prompt 20: If I destroy the RDS primary instance, what is the full blast radius? List every affected resource.
- **Difficulty:** hard | **Category:** impact-analysis | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 2/2 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 2/2 (100%). Missing: []
- MCP Trial 1: **0.0** — Matched 0/2 (0%). Missing: [rds_replica, secrets_manager_version]

### Prompt 21: If I destroy sg_web, what resources across all modules are impacted?
- **Difficulty:** hard | **Category:** impact-analysis | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 5/5 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 5/5 (100%). Missing: []
- MCP Trial 1: **0.0** — Matched 0/5 (0%). Missing: [sg_app, sg_db, sg_rule_web, sg_rule_app, sg_rule_db]

### Prompt 22: What is the correct deployment order for the web tier, starting from the VPC and ending at the CloudWatch alarm?
- **Difficulty:** hard | **Category:** deployment-order | **Scoring:** topological-validation
- Raw Trial 1: **0.0** — Nodes: 3/10 present. Precedence: 0/0 satisfied. Raw: 0.15. Missing nodes: [private_subnet_1, iam_role_web, key_pair, instance_profile_web, launch_template_web, scaling_policy_web, cw_alarm_asg_web]. 
- Raw Trial 2: **1.0** — Nodes: 7/10 present. Precedence: 5/5 satisfied. Raw: 0.85. Missing nodes: [key_pair, scaling_policy_web, cw_alarm_asg_web]. 
- MCP Trial 1: **0.0** — Nodes: 0/10 present. Precedence: 0/0 satisfied. Raw: 0.00. Missing nodes: [vpc, private_subnet_1, sg_web, iam_role_web, key_pair, instance_profile_web, launch_template_web, asg_web, scaling_policy_web, cw_alarm_asg_web]. 

### Prompt 23: Which module outputs does the compute module consume? List each output and the module it comes from.
- **Difficulty:** hard | **Category:** cross-module | **Scoring:** checklist
- Raw Trial 1: **1.0** — Checked 9/9 (need 8 for full, 5 for partial). Found: [networking: private_subnet_ids, networking: public_subnet_ids, security: sg_web_id, security: sg_app_id, security: sg_alb_id, security: iam_role_web_arn, security: iam_role_app_arn, security: iam_role_web_name, security: iam_role_app_name]. Missing: []
- Raw Trial 2: **1.0** — Checked 9/9 (need 8 for full, 5 for partial). Found: [networking: private_subnet_ids, networking: public_subnet_ids, security: sg_web_id, security: sg_app_id, security: sg_alb_id, security: iam_role_web_arn, security: iam_role_app_arn, security: iam_role_web_name, security: iam_role_app_name]. Missing: []
- MCP Trial 1: **0.0** — Checked 0/9 (need 8 for full, 5 for partial). Found: []. Missing: [networking: private_subnet_ids, networking: public_subnet_ids, security: sg_web_id, security: sg_app_id, security: sg_alb_id, security: iam_role_web_arn, security: iam_role_app_arn, security: iam_role_web_name, security: iam_role_app_name]

### Prompt 24: Trace the dependency path from the CloudWatch dashboard to the VPC. What is the minimum set of resources on that path?
- **Difficulty:** hard | **Category:** dependency-chain | **Scoring:** checklist
- Raw Trial 1: **0.0** — Checked 0/4 (need 3 for full, 2 for partial). Found: []. Missing: [cw_dashboard references compute or database or loadbalancer outputs, monitoring module depends on compute, database, and loadbalancer, compute or loadbalancer depends on networking via security, networking contains vpc]
- Raw Trial 2: **0.0** — Checked 0/4 (need 3 for full, 2 for partial). Found: []. Missing: [cw_dashboard references compute or database or loadbalancer outputs, monitoring module depends on compute, database, and loadbalancer, compute or loadbalancer depends on networking via security, networking contains vpc]
- MCP Trial 1: **0.0** — Checked 0/4 (need 3 for full, 2 for partial). Found: []. Missing: [cw_dashboard references compute or database or loadbalancer outputs, monitoring module depends on compute, database, and loadbalancer, compute or loadbalancer depends on networking via security, networking contains vpc]

### Prompt 25: If the NAT gateway fails, which resources and tiers lose connectivity? Trace the impact.
- **Difficulty:** hard | **Category:** impact-analysis | **Scoring:** checklist
- Raw Trial 1: **0.0** — Checked 0/4 (need 3 for full, 2 for partial). Found: []. Missing: [route_table_private directly depends on nat_gateway, private subnets lose internet routing, compute instances in private subnets affected, app tier and web tier lose outbound connectivity]
- Raw Trial 2: **0.0** — Checked 0/4 (need 3 for full, 2 for partial). Found: []. Missing: [route_table_private directly depends on nat_gateway, private subnets lose internet routing, compute instances in private subnets affected, app tier and web tier lose outbound connectivity]
- MCP Trial 1: **0.0** — Checked 0/4 (need 3 for full, 2 for partial). Found: []. Missing: [route_table_private directly depends on nat_gateway, private subnets lose internet routing, compute instances in private subnets affected, app tier and web tier lose outbound connectivity]

### Prompt 26: What Terraform resources would I need to add to deploy a new microservice behind the existing ALB?
- **Difficulty:** hard | **Category:** planning | **Scoring:** checklist
- Raw Trial 1: **1.0** — Checked 8/8 (need 7 for full, 4 for partial). Found: [security group, IAM role, instance profile, launch template, auto scaling group, target group, listener rule, scaling policy]. Missing: []
- Raw Trial 2: **1.0** — Checked 8/8 (need 7 for full, 4 for partial). Found: [security group, IAM role, instance profile, launch template, auto scaling group, target group, listener rule, scaling policy]. Missing: []
- MCP Trial 1: **0.0** — Checked 0/8 (need 7 for full, 4 for partial). Found: []. Missing: [security group, IAM role, instance profile, launch template, auto scaling group, target group, listener rule, scaling policy]

### Prompt 27: What is the full dependency chain from the WAF to the VPC? List every resource on the path.
- **Difficulty:** hard | **Category:** dependency-chain | **Scoring:** topological-validation
- Raw Trial 1: **1.0** — Nodes: 2/2 present. Precedence: 1/1 satisfied. Raw: 1.00. 
- Raw Trial 2: **0.5** — Nodes: 2/2 present. Precedence: 0/1 satisfied. Raw: 0.50. Violations: [waf_web_acl should precede alb]
- MCP Trial 1: **0.0** — Nodes: 0/2 present. Precedence: 0/0 satisfied. Raw: 0.00. Missing nodes: [waf_web_acl, alb]. 

### Prompt 28: Which resources are leaf nodes (nothing else depends on them) in the security module?
- **Difficulty:** hard | **Category:** dependency-direct | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 7/8 (88%). Missing: [sg_db]
- Raw Trial 2: **1.0** — Matched 8/8 (100%). Missing: []
- MCP Trial 1: **0.0** — Matched 0/8 (0%). Missing: [sg_db, sg_rule_alb, sg_rule_web, sg_rule_app, sg_rule_db, iam_policy_web, iam_policy_app, iam_policy_db]

### Prompt 29: Compare the web tier and app tier deployment stacks. What resources does each tier have and how do they mirror each other?
- **Difficulty:** hard | **Category:** cross-module | **Scoring:** checklist
- Raw Trial 1: **0.0** — Checked 0/7 (need 6 for full, 3 for partial). Found: []. Missing: [launch_template_web / launch_template_app, asg_web / asg_app, web_instance_1,2 / app_instance_1,2, instance_profile_web / instance_profile_app, scaling_policy_web / scaling_policy_app, cw_alarm_asg_web / cw_alarm_asg_app, sg_web / sg_app]
- Raw Trial 2: **0.0** — Checked 0/7 (need 6 for full, 3 for partial). Found: []. Missing: [launch_template_web / launch_template_app, asg_web / asg_app, web_instance_1,2 / app_instance_1,2, instance_profile_web / instance_profile_app, scaling_policy_web / scaling_policy_app, cw_alarm_asg_web / cw_alarm_asg_app, sg_web / sg_app]
- MCP Trial 1: **0.0** — Checked 0/7 (need 6 for full, 3 for partial). Found: []. Missing: [launch_template_web / launch_template_app, asg_web / asg_app, web_instance_1,2 / app_instance_1,2, instance_profile_web / instance_profile_app, scaling_policy_web / scaling_policy_app, cw_alarm_asg_web / cw_alarm_asg_app, sg_web / sg_app]

### Prompt 30: If I need to rotate the RDS credentials, trace every resource that stores or references the database connection information.
- **Difficulty:** hard | **Category:** dependency-chain | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 5/5 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 5/5 (100%). Missing: []
- MCP Trial 1: **0.0** — Matched 0/5 (0%). Missing: [rds_primary, rds_replica, secrets_manager_secret, secrets_manager_version, cw_dashboard]
