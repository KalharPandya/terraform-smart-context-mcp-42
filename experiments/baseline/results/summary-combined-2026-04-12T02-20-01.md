# Combined Experiment Results — Raw vs MCP

- **Date:** 2026-04-12T01:11:29.219Z
- **Model:** sonnet
- **Modes:** raw + mcp
- **CLI Version:** 2.1.101 (Claude Code)
- **Trials per prompt:** 2
- **Total prompts:** 30
- **Raw phase:** 2026-04-12T01:11:29.221Z → 2026-04-12T02:20:01.731Z
- **MCP phase:** 2026-04-12T01:11:29.221Z → 2026-04-12T02:20:01.731Z

## Table 1: Head-to-Head Comparison (Raw vs MCP)

| # | Prompt | Diff | Raw Score | MCP Score | Δ Score | Raw Tokens | MCP Tokens | Token Δ% | Raw Cost | MCP Cost |
|---|--------|------|-----------|-----------|---------|------------|------------|----------|----------|----------|
| 1 | What is the CIDR block of the VPC? | easy | 1.00 | 1.00 | +0.00 | 29,813 | 27,731 | -7% | $0.0251 | $0.0391 |
| 2 | What is the public IP of the ba... | easy | 1.00 | 1.00 | +0.00 | 40,345 | 39,434 | -2% | $0.0332 | $0.0505 |
| 3 | What database engine and port d... | easy | 1.00 | 1.00 | +0.00 | 41,977 | 64,555 | 54% | $0.0364 | $0.0653 |
| 4 | List all six modules in the inf... | easy | 1.00 | 1.00 | +0.00 | 24,345 | 16,418 | -33% | $0.0202 | $0.0241 |
| 5 | List all subnets and their avai... | easy | 0.50 | 0.50 | +0.00 | 33,536 | 46,674 | 39% | $0.0463 | $0.0874 |
| 6 | How many resources are there in... | easy | 1.00 | 1.00 | +0.00 | 20,481 | 27,213 | 33% | $0.0237 | $0.0353 |
| 7 | What are the names of all four ... | easy | 1.00 | 1.00 | +0.00 | 39,665 | 46,797 | 18% | $0.0302 | $0.0511 |
| 8 | What is the Redis cache engine ... | easy | 1.00 | 1.00 | +0.00 | 40,151 | 62,466 | 56% | $0.0323 | $0.0743 |
| 9 | What resources directly depend ... | medium | 0.00 | 0.00 | +0.00 | 37,408 | 31,775 | -15% | $0.0345 | $0.0593 |
| 10 | What resources directly depend ... | medium | 1.00 | 1.00 | +0.00 | 57,454 | 50,777 | -12% | $0.0600 | $0.0685 |
| 11 | Which resources in the compute ... | medium | 1.00 | 1.00 | +0.00 | 51,214 | 28,109 | -45% | $0.0412 | $0.0445 |
| 12 | Which resources reference the S... | medium | 1.00 | 1.00 | +0.00 | 87,016 | 63,722 | -27% | $0.0748 | $0.0745 |
| 13 | List all security group rules t... | medium | 1.00 | 0.75 | -0.25 | 61,809 | 43,885 | -29% | $0.0776 | $0.0774 |
| 14 | List all resources in the datab... | medium | 1.00 | 1.00 | +0.00 | 34,809 | 30,375 | -13% | $0.0587 | $0.0570 |
| 15 | What modules does the monitorin... | medium | 1.00 | 1.00 | +0.00 | 42,917 | 32,211 | -25% | $0.0367 | $0.0650 |
| 16 | What ports are exposed by each ... | medium | 1.00 | 1.00 | +0.00 | 61,761 | 50,266 | -19% | $0.0703 | $0.0926 |
| 17 | List all resources that have en... | medium | 1.00 | 1.00 | +0.00 | 126,282 | 86,180 | -32% | $0.1270 | $0.2610 |
| 18 | What is the correct deployment ... | medium | 0.50 | 0.50 | +0.00 | 58,567 | 39,258 | -33% | $0.0715 | $0.0644 |
| 19 | Trace the full dependency chain... | hard | 1.00 | 0.75 | -0.25 | 163,026 | 92,650 | -43% | $0.2771 | $0.1410 |
| 20 | If I destroy the RDS primary in... | hard | 1.00 | 1.00 | +0.00 | 163,152 | 45,791 | -72% | $0.2289 | $0.0678 |
| 21 | If I destroy sg_web, what resou... | hard | 1.00 | 1.00 | +0.00 | 72,550 | 41,495 | -43% | $0.1403 | $0.0661 |
| 22 | What is the correct deployment ... | hard | 1.00 | 1.00 | +0.00 | 133,639 | 83,170 | -38% | $0.2048 | $0.2206 |
| 23 | Which module outputs does the c... | hard | 1.00 | 0.00 | -1.00 | 32,542 | 38,964 | 20% | $0.0389 | $0.0978 |
| 24 | Trace the dependency path from ... | hard | 0.00 | 0.00 | +0.00 | 43,006 | 65,483 | 52% | $0.0582 | $0.0772 |
| 25 | If the NAT gateway fails, which... | hard | 0.00 | 0.00 | +0.00 | 151,321 | 70,131 | -54% | $0.1979 | $0.1219 |
| 26 | What Terraform resources would ... | hard | 1.00 | 1.00 | +0.00 | 91,971 | 53,686 | -42% | $0.1575 | $0.1065 |
| 27 | What is the full dependency cha... | hard | 0.75 | 1.00 | +0.25 | 84,248 | 66,553 | -21% | $0.1095 | $0.0826 |
| 28 | Which resources are leaf nodes ... | hard | 1.00 | 1.00 | +0.00 | 33,254 | 31,529 | -5% | $0.0858 | $0.0578 |
| 29 | Compare the web tier and app ti... | hard | 0.00 | 0.00 | +0.00 | 145,490 | 58,472 | -60% | $0.1729 | $0.1271 |
| 30 | If I need to rotate the RDS cre... | hard | 1.00 | 1.00 | +0.00 | 284,007 | 73,499 | -74% | $0.2313 | $0.1428 |
| - | **TOTALS/MEANS** | | **0.82** | **0.78** | **-0.04** | 2,287,756 | 1,509,269 | -34% | $2.8029 | $2.6004 |

## Table 2: Raw Mode — Scores & Metrics

| # | Prompt | Diff | T1 | T2 | Mean | Avg Tokens | Avg Tools | Avg Time(s) | Avg Cost |
|---|--------|------|----|----|------|------------|-----------|-------------|----------|
| 1 | What is the CIDR block of the VPC? | easy | 1.0 | 1.0 | 1.00 | 29,813 | 2 | 8.0 | $0.0251 |
| 2 | What is the public IP of the ba... | easy | 1.0 | 1.0 | 1.00 | 40,345 | 3 | 10.7 | $0.0332 |
| 3 | What database engine and port d... | easy | 1.0 | 1.0 | 1.00 | 41,977 | 3 | 10.2 | $0.0364 |
| 4 | List all six modules in the inf... | easy | 1.0 | 1.0 | 1.00 | 24,345 | 2 | 7.5 | $0.0202 |
| 5 | List all subnets and their avai... | easy | 0.0 | 1.0 | 0.50 | 33,536 | 2 | 16.4 | $0.0463 |
| 6 | How many resources are there in... | easy | 1.0 | 1.0 | 1.00 | 20,481 | 1 | 9.6 | $0.0237 |
| 7 | What are the names of all four ... | easy | 1.0 | 1.0 | 1.00 | 39,665 | 3 | 11.7 | $0.0302 |
| 8 | What is the Redis cache engine ... | easy | 1.0 | 1.0 | 1.00 | 40,151 | 4 | 11.5 | $0.0323 |
| 9 | What resources directly depend ... | medium | 0.0 | 0.0 | 0.00 | 37,408 | 3 | 14.5 | $0.0345 |
| 10 | What resources directly depend ... | medium | 1.0 | 1.0 | 1.00 | 57,454 | 4 | 22.2 | $0.0600 |
| 11 | Which resources in the compute ... | medium | 1.0 | 1.0 | 1.00 | 51,214 | 4 | 18.5 | $0.0412 |
| 12 | Which resources reference the S... | medium | 1.0 | 1.0 | 1.00 | 87,016 | 10 | 30.7 | $0.0748 |
| 13 | List all security group rules t... | medium | 1.0 | 1.0 | 1.00 | 61,809 | 4 | 30.3 | $0.0776 |
| 14 | List all resources in the datab... | medium | 1.0 | 1.0 | 1.00 | 34,809 | 2 | 26.2 | $0.0587 |
| 15 | What modules does the monitorin... | medium | 1.0 | 1.0 | 1.00 | 42,917 | 4 | 12.4 | $0.0367 |
| 16 | What ports are exposed by each ... | medium | 1.0 | 1.0 | 1.00 | 61,761 | 5 | 24.3 | $0.0703 |
| 17 | List all resources that have en... | medium | 1.0 | 1.0 | 1.00 | 126,282 | 7 | 44.5 | $0.1270 |
| 18 | What is the correct deployment ... | medium | 0.0 | 1.0 | 0.50 | 58,567 | 6 | 26.8 | $0.0715 |
| 19 | Trace the full dependency chain... | hard | 1.0 | 1.0 | 1.00 | 163,026 | 10 | 90.1 | $0.2771 |
| 20 | If I destroy the RDS primary in... | hard | 1.0 | 1.0 | 1.00 | 163,152 | 9 | 85.9 | $0.2289 |
| 21 | If I destroy sg_web, what resou... | hard | 1.0 | 1.0 | 1.00 | 72,550 | 6 | 70.1 | $0.1403 |
| 22 | What is the correct deployment ... | hard | 1.0 | 1.0 | 1.00 | 133,639 | 12 | 66.4 | $0.2048 |
| 23 | Which module outputs does the c... | hard | 1.0 | 1.0 | 1.00 | 32,542 | 3 | 15.2 | $0.0389 |
| 24 | Trace the dependency path from ... | hard | 0.0 | 0.0 | 0.00 | 43,006 | 3 | 23.1 | $0.0582 |
| 25 | If the NAT gateway fails, which... | hard | 0.0 | 0.0 | 0.00 | 151,321 | 11 | 81.2 | $0.1979 |
| 26 | What Terraform resources would ... | hard | 1.0 | 1.0 | 1.00 | 91,971 | 7 | 46.7 | $0.1575 |
| 27 | What is the full dependency cha... | hard | 1.0 | 0.5 | 0.75 | 84,248 | 9 | 44.7 | $0.1095 |
| 28 | Which resources are leaf nodes ... | hard | 1.0 | 1.0 | 1.00 | 33,254 | 2 | 39.3 | $0.0858 |
| 29 | Compare the web tier and app ti... | hard | 0.0 | 0.0 | 0.00 | 145,490 | 9 | 50.7 | $0.1729 |
| 30 | If I need to rotate the RDS cre... | hard | 1.0 | 1.0 | 1.00 | 284,007 | 26 | 82.6 | $0.2313 |

## Table 3: MCP Mode — Scores & Metrics

| # | Prompt | Diff | T1 | T2 | Mean | Avg Tokens | Avg Tools | Avg Time(s) | Avg Cost |
|---|--------|------|----|----|------|------------|-----------|-------------|----------|
| 1 | What is the CIDR block of the VPC? | easy | 1.0 | 1.0 | 1.00 | 27,731 | 2 | 9.9 | $0.0391 |
| 2 | What is the public IP of the ba... | easy | 1.0 | 1.0 | 1.00 | 39,434 | 3 | 10.8 | $0.0505 |
| 3 | What database engine and port d... | easy | 1.0 | 1.0 | 1.00 | 64,555 | 6 | 22.8 | $0.0653 |
| 4 | List all six modules in the inf... | easy | 1.0 | 1.0 | 1.00 | 16,418 | 1 | 5.2 | $0.0241 |
| 5 | List all subnets and their avai... | easy | 0.0 | 1.0 | 0.50 | 46,674 | 3 | 24.0 | $0.0874 |
| 6 | How many resources are there in... | easy | 1.0 | 1.0 | 1.00 | 27,213 | 2 | 9.6 | $0.0353 |
| 7 | What are the names of all four ... | easy | 1.0 | 1.0 | 1.00 | 46,797 | 4 | 16.1 | $0.0511 |
| 8 | What is the Redis cache engine ... | easy | 1.0 | 1.0 | 1.00 | 62,466 | 5 | 19.9 | $0.0743 |
| 9 | What resources directly depend ... | medium | 0.0 | 0.0 | 0.00 | 31,775 | 2 | 17.6 | $0.0593 |
| 10 | What resources directly depend ... | medium | 1.0 | 1.0 | 1.00 | 50,777 | 4 | 22.1 | $0.0685 |
| 11 | Which resources in the compute ... | medium | 1.0 | 1.0 | 1.00 | 28,109 | 2 | 14.8 | $0.0445 |
| 12 | Which resources reference the S... | medium | 1.0 | 1.0 | 1.00 | 63,722 | 5 | 25.7 | $0.0745 |
| 13 | List all security group rules t... | medium | 0.5 | 1.0 | 0.75 | 43,885 | 3 | 25.0 | $0.0774 |
| 14 | List all resources in the datab... | medium | 1.0 | 1.0 | 1.00 | 30,375 | 2 | 20.2 | $0.0570 |
| 15 | What modules does the monitorin... | medium | 1.0 | 1.0 | 1.00 | 32,211 | 2 | 19.2 | $0.0650 |
| 16 | What ports are exposed by each ... | medium | 1.0 | 1.0 | 1.00 | 50,266 | 4 | 32.9 | $0.0926 |
| 17 | List all resources that have en... | medium | 1.0 | 1.0 | 1.00 | 86,180 | 8 | 52.4 | $0.2610 |
| 18 | What is the correct deployment ... | medium | 0.5 | 0.5 | 0.50 | 39,258 | 3 | 37.8 | $0.0644 |
| 19 | Trace the full dependency chain... | hard | 0.5 | 1.0 | 0.75 | 92,650 | 6 | 64.8 | $0.1410 |
| 20 | If I destroy the RDS primary in... | hard | 1.0 | 1.0 | 1.00 | 45,791 | 4 | 27.3 | $0.0678 |
| 21 | If I destroy sg_web, what resou... | hard | 1.0 | 1.0 | 1.00 | 41,495 | 3 | 25.6 | $0.0661 |
| 22 | What is the correct deployment ... | hard | 1.0 | 1.0 | 1.00 | 83,170 | 12 | 117.5 | $0.2206 |
| 23 | Which module outputs does the c... | hard | 0.0 | 0.0 | 0.00 | 38,964 | 2 | 25.9 | $0.0978 |
| 24 | Trace the dependency path from ... | hard | 0.0 | 0.0 | 0.00 | 65,483 | 5 | 31.5 | $0.0772 |
| 25 | If the NAT gateway fails, which... | hard | 0.0 | 0.0 | 0.00 | 70,131 | 7 | 63.2 | $0.1219 |
| 26 | What Terraform resources would ... | hard | 1.0 | 1.0 | 1.00 | 53,686 | 8 | 48.9 | $0.1065 |
| 27 | What is the full dependency cha... | hard | 1.0 | 1.0 | 1.00 | 66,553 | 5 | 27.5 | $0.0826 |
| 28 | Which resources are leaf nodes ... | hard | 1.0 | 1.0 | 1.00 | 31,529 | 2 | 15.1 | $0.0578 |
| 29 | Compare the web tier and app ti... | hard | 0.0 | 0.0 | 0.00 | 58,472 | 5 | 52.8 | $0.1271 |
| 30 | If I need to rotate the RDS cre... | hard | 1.0 | 1.0 | 1.00 | 73,499 | 10 | 70.6 | $0.1428 |

## Table 4: Aggregates by Difficulty — Raw vs MCP

| Difficulty | Raw Score | MCP Score | Δ Score | Raw Tokens | MCP Tokens | Token Δ% | Raw Cost | MCP Cost |
|------------|-----------|-----------|---------|------------|------------|----------|----------|----------|
| easy | 0.94 | 0.94 | +0.00 | 33,789 | 41,411 | 23% | $0.0309 | $0.0534 |
| medium | 0.85 | 0.82 | -0.03 | 61,923 | 45,656 | -26% | $0.0652 | $0.0864 |
| hard | 0.73 | 0.65 | -0.08 | 116,517 | 60,118 | -48% | $0.1586 | $0.1091 |

## Score Details

### Prompt 1: What is the CIDR block of the VPC?
- **Difficulty:** easy | **Category:** attribute-lookup | **Scoring:** substring-match
- Raw Trial 1: **1.0** — Found 1/1: [10.0.0.0/16]
- Raw Trial 2: **1.0** — Found 1/1: [10.0.0.0/16]
- MCP Trial 1: **1.0** — Found 1/1: [10.0.0.0/16]
- MCP Trial 2: **1.0** — Found 1/1: [10.0.0.0/16]

### Prompt 2: What is the public IP of the bastion host?
- **Difficulty:** easy | **Category:** attribute-lookup | **Scoring:** substring-match
- Raw Trial 1: **1.0** — Found 1/1: [54.210.167.100]
- Raw Trial 2: **1.0** — Found 1/1: [54.210.167.100]
- MCP Trial 1: **1.0** — Found 1/1: [54.210.167.100]
- MCP Trial 2: **1.0** — Found 1/1: [54.210.167.100]

### Prompt 3: What database engine and port does the RDS primary instance use?
- **Difficulty:** easy | **Category:** attribute-lookup | **Scoring:** substring-match
- Raw Trial 1: **1.0** — Found 2/2: [postgresql, 5432]
- Raw Trial 2: **1.0** — Found 2/2: [postgresql, 5432]
- MCP Trial 1: **1.0** — Found 2/2: [postgresql, 5432]
- MCP Trial 2: **1.0** — Found 2/2: [postgresql, 5432]

### Prompt 4: List all six modules in the infrastructure.
- **Difficulty:** easy | **Category:** enumeration | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 6/6 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 6/6 (100%). Missing: []
- MCP Trial 1: **1.0** — Matched 6/6 (100%). Missing: []
- MCP Trial 2: **1.0** — Matched 6/6 (100%). Missing: []

### Prompt 5: List all subnets and their availability zones.
- **Difficulty:** easy | **Category:** enumeration | **Scoring:** set-overlap
- Raw Trial 1: **0.0** — Matched 0/8 (0%). Missing: [public_subnet_1 in us-east-1a, public_subnet_2 in us-east-1b, public_subnet_3 in us-east-1c, private_subnet_1 in us-east-1a, private_subnet_2 in us-east-1b, private_subnet_3 in us-east-1c, db_subnet_1 in us-east-1a, db_subnet_2 in us-east-1b]
- Raw Trial 2: **1.0** — Matched 8/8 (100%). Missing: []
- MCP Trial 1: **0.0** — Matched 0/8 (0%). Missing: [public_subnet_1 in us-east-1a, public_subnet_2 in us-east-1b, public_subnet_3 in us-east-1c, private_subnet_1 in us-east-1a, private_subnet_2 in us-east-1b, private_subnet_3 in us-east-1c, db_subnet_1 in us-east-1a, db_subnet_2 in us-east-1b]
- MCP Trial 2: **1.0** — Matched 8/8 (100%). Missing: []

### Prompt 6: How many resources are there in total? Break down the count by module.
- **Difficulty:** easy | **Category:** inventory | **Scoring:** checklist
- Raw Trial 1: **1.0** — Checked 7/7 (need 7 for full, 4 for partial). Found: [75 total, networking: 15, security: 14, compute: 16, database: 10, loadbalancer: 10, monitoring: 10]. Missing: []
- Raw Trial 2: **1.0** — Checked 7/7 (need 7 for full, 4 for partial). Found: [75 total, networking: 15, security: 14, compute: 16, database: 10, loadbalancer: 10, monitoring: 10]. Missing: []
- MCP Trial 1: **1.0** — Checked 7/7 (need 7 for full, 4 for partial). Found: [75 total, networking: 15, security: 14, compute: 16, database: 10, loadbalancer: 10, monitoring: 10]. Missing: []
- MCP Trial 2: **1.0** — Checked 7/7 (need 7 for full, 4 for partial). Found: [75 total, networking: 15, security: 14, compute: 16, database: 10, loadbalancer: 10, monitoring: 10]. Missing: []

### Prompt 7: What are the names of all four security groups?
- **Difficulty:** easy | **Category:** enumeration | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 4/4 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 4/4 (100%). Missing: []
- MCP Trial 1: **1.0** — Matched 4/4 (100%). Missing: []
- MCP Trial 2: **1.0** — Matched 4/4 (100%). Missing: []

### Prompt 8: What is the Redis cache engine version and node type?
- **Difficulty:** easy | **Category:** attribute-lookup | **Scoring:** substring-match
- Raw Trial 1: **1.0** — Found 2/2: [7.0, cache.r6g.large]
- Raw Trial 2: **1.0** — Found 2/2: [7.0, cache.r6g.large]
- MCP Trial 1: **1.0** — Found 2/2: [7.0, cache.r6g.large]
- MCP Trial 2: **1.0** — Found 2/2: [7.0, cache.r6g.large]

### Prompt 9: What resources directly depend on the VPC?
- **Difficulty:** medium | **Category:** dependency-direct | **Scoring:** set-overlap
- Raw Trial 1: **0.0** — Matched 4/12 (33%). Missing: [public_subnet_2, public_subnet_3, private_subnet_2, private_subnet_3, db_subnet_2, route_table_public, route_table_private, route_table_db]
- Raw Trial 2: **0.0** — Matched 4/12 (33%). Missing: [public_subnet_2, public_subnet_3, private_subnet_2, private_subnet_3, db_subnet_2, route_table_public, route_table_private, route_table_db]
- MCP Trial 1: **0.0** — Matched 5/12 (42%). Missing: [public_subnet_2, public_subnet_3, private_subnet_2, private_subnet_3, db_subnet_2, route_table_private, route_table_db]
- MCP Trial 2: **0.0** — Matched 5/12 (42%). Missing: [public_subnet_2, public_subnet_3, private_subnet_2, private_subnet_3, db_subnet_2, route_table_private, route_table_db]

### Prompt 10: What resources directly depend on the ALB?
- **Difficulty:** medium | **Category:** dependency-direct | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 4/4 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 4/4 (100%). Missing: []
- MCP Trial 1: **1.0** — Matched 4/4 (100%). Missing: []
- MCP Trial 2: **1.0** — Matched 4/4 (100%). Missing: []

### Prompt 11: Which resources in the compute module reference the key_pair?
- **Difficulty:** medium | **Category:** dependency-direct | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 7/7 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 7/7 (100%). Missing: []
- MCP Trial 1: **1.0** — Matched 7/7 (100%). Missing: []
- MCP Trial 2: **1.0** — Matched 7/7 (100%). Missing: []

### Prompt 12: Which resources reference the SNS topic?
- **Difficulty:** medium | **Category:** dependency-direct | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 6/6 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 6/6 (100%). Missing: []
- MCP Trial 1: **1.0** — Matched 6/6 (100%). Missing: []
- MCP Trial 2: **1.0** — Matched 6/6 (100%). Missing: []

### Prompt 13: List all security group rules that allow inbound traffic from 0.0.0.0/0.
- **Difficulty:** medium | **Category:** security-filter | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 2/2 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 2/2 (100%). Missing: []
- MCP Trial 1: **0.5** — Matched 1/2 (50%). Missing: [sg_alb: port 443 (HTTPS)]
- MCP Trial 2: **1.0** — Matched 2/2 (100%). Missing: []

### Prompt 14: List all resources in the database module that have no dependencies on other database resources.
- **Difficulty:** medium | **Category:** dependency-direct | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 6/6 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 6/6 (100%). Missing: []
- MCP Trial 1: **1.0** — Matched 6/6 (100%). Missing: []
- MCP Trial 2: **1.0** — Matched 6/6 (100%). Missing: []

### Prompt 15: What modules does the monitoring module consume outputs from?
- **Difficulty:** medium | **Category:** cross-module | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 3/3 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 3/3 (100%). Missing: []
- MCP Trial 1: **1.0** — Matched 3/3 (100%). Missing: []
- MCP Trial 2: **1.0** — Matched 3/3 (100%). Missing: []

### Prompt 16: What ports are exposed by each security group for inbound traffic?
- **Difficulty:** medium | **Category:** security-filter | **Scoring:** checklist
- Raw Trial 1: **1.0** — Checked 4/4 (need 4 for full, 2 for partial). Found: [sg_alb: 443, sg_web: 8080, sg_app: 3000, sg_db: 5432]. Missing: []
- Raw Trial 2: **1.0** — Checked 4/4 (need 4 for full, 2 for partial). Found: [sg_alb: 443, sg_web: 8080, sg_app: 3000, sg_db: 5432]. Missing: []
- MCP Trial 1: **1.0** — Checked 4/4 (need 4 for full, 2 for partial). Found: [sg_alb: 443, sg_web: 8080, sg_app: 3000, sg_db: 5432]. Missing: []
- MCP Trial 2: **1.0** — Checked 4/4 (need 4 for full, 2 for partial). Found: [sg_alb: 443, sg_web: 8080, sg_app: 3000, sg_db: 5432]. Missing: []

### Prompt 17: List all resources that have encryption enabled (storage, at-rest, or in-transit).
- **Difficulty:** medium | **Category:** security-filter | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 6/6 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 6/6 (100%). Missing: []
- MCP Trial 1: **1.0** — Matched 6/6 (100%). Missing: []
- MCP Trial 2: **1.0** — Matched 6/6 (100%). Missing: []

### Prompt 18: What is the correct deployment order for the load balancer module?
- **Difficulty:** medium | **Category:** deployment-order | **Scoring:** topological-validation
- Raw Trial 1: **0.0** — Nodes: 1/10 present. Precedence: 0/0 satisfied. Raw: 0.05. Missing nodes: [acm_certificate, target_group_web, target_group_app, listener_http, listener_https, listener_rule_web, listener_rule_app, route53_record, waf_web_acl]. 
- Raw Trial 2: **1.0** — Nodes: 10/10 present. Precedence: 10/10 satisfied. Raw: 1.00. 
- MCP Trial 1: **0.5** — Nodes: 10/10 present. Precedence: 0/10 satisfied. Raw: 0.50. Violations: [acm_certificate should precede listener_https; alb should precede listener_http; alb should precede listener_https; alb should precede route53_record; alb should precede waf_web_acl; listener_https should precede listener_rule_web; listener_https should precede listener_rule_app; target_group_web should precede listener_https; target_group_web should precede listener_rule_web; target_group_app should precede listener_rule_app]
- MCP Trial 2: **0.5** — Nodes: 10/10 present. Precedence: 0/10 satisfied. Raw: 0.50. Violations: [acm_certificate should precede listener_https; alb should precede listener_http; alb should precede listener_https; alb should precede route53_record; alb should precede waf_web_acl; listener_https should precede listener_rule_web; listener_https should precede listener_rule_app; target_group_web should precede listener_https; target_group_web should precede listener_rule_web; target_group_app should precede listener_rule_app]

### Prompt 19: Trace the full dependency chain from the HTTPS listener to the RDS primary database.
- **Difficulty:** hard | **Category:** dependency-chain | **Scoring:** topological-validation
- Raw Trial 1: **1.0** — Nodes: 7/7 present. Precedence: 5/6 satisfied. Raw: 0.92. Violations: [sg_db should precede rds_primary]
- Raw Trial 2: **1.0** — Nodes: 7/7 present. Precedence: 5/6 satisfied. Raw: 0.92. Violations: [sg_db should precede rds_primary]
- MCP Trial 1: **0.5** — Nodes: 7/7 present. Precedence: 3/6 satisfied. Raw: 0.75. Violations: [alb should precede sg_alb; sg_web should precede sg_app; sg_db should precede rds_primary]
- MCP Trial 2: **1.0** — Nodes: 7/7 present. Precedence: 4/6 satisfied. Raw: 0.83. Violations: [sg_web should precede sg_app; sg_db should precede rds_primary]

### Prompt 20: If I destroy the RDS primary instance, what is the full blast radius? List every affected resource.
- **Difficulty:** hard | **Category:** impact-analysis | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 2/2 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 2/2 (100%). Missing: []
- MCP Trial 1: **1.0** — Matched 2/2 (100%). Missing: []
- MCP Trial 2: **1.0** — Matched 2/2 (100%). Missing: []

### Prompt 21: If I destroy sg_web, what resources across all modules are impacted?
- **Difficulty:** hard | **Category:** impact-analysis | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 5/5 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 5/5 (100%). Missing: []
- MCP Trial 1: **1.0** — Matched 5/5 (100%). Missing: []
- MCP Trial 2: **1.0** — Matched 5/5 (100%). Missing: []

### Prompt 22: What is the correct deployment order for the web tier, starting from the VPC and ending at the CloudWatch alarm?
- **Difficulty:** hard | **Category:** deployment-order | **Scoring:** topological-validation
- Raw Trial 1: **1.0** — Nodes: 10/10 present. Precedence: 8/8 satisfied. Raw: 1.00. 
- Raw Trial 2: **1.0** — Nodes: 10/10 present. Precedence: 8/8 satisfied. Raw: 1.00. 
- MCP Trial 1: **1.0** — Nodes: 10/10 present. Precedence: 6/8 satisfied. Raw: 0.88. Violations: [launch_template_web should precede asg_web; scaling_policy_web should precede cw_alarm_asg_web]
- MCP Trial 2: **1.0** — Nodes: 10/10 present. Precedence: 8/8 satisfied. Raw: 1.00. 

### Prompt 23: Which module outputs does the compute module consume? List each output and the module it comes from.
- **Difficulty:** hard | **Category:** cross-module | **Scoring:** checklist
- Raw Trial 1: **1.0** — Checked 9/9 (need 8 for full, 5 for partial). Found: [networking: private_subnet_ids, networking: public_subnet_ids, security: sg_web_id, security: sg_app_id, security: sg_alb_id, security: iam_role_web_arn, security: iam_role_app_arn, security: iam_role_web_name, security: iam_role_app_name]. Missing: []
- Raw Trial 2: **1.0** — Checked 9/9 (need 8 for full, 5 for partial). Found: [networking: private_subnet_ids, networking: public_subnet_ids, security: sg_web_id, security: sg_app_id, security: sg_alb_id, security: iam_role_web_arn, security: iam_role_app_arn, security: iam_role_web_name, security: iam_role_app_name]. Missing: []
- MCP Trial 1: **0.0** — Checked 0/9 (need 8 for full, 5 for partial). Found: []. Missing: [networking: private_subnet_ids, networking: public_subnet_ids, security: sg_web_id, security: sg_app_id, security: sg_alb_id, security: iam_role_web_arn, security: iam_role_app_arn, security: iam_role_web_name, security: iam_role_app_name]
- MCP Trial 2: **0.0** — Checked 0/9 (need 8 for full, 5 for partial). Found: []. Missing: [networking: private_subnet_ids, networking: public_subnet_ids, security: sg_web_id, security: sg_app_id, security: sg_alb_id, security: iam_role_web_arn, security: iam_role_app_arn, security: iam_role_web_name, security: iam_role_app_name]

### Prompt 24: Trace the dependency path from the CloudWatch dashboard to the VPC. What is the minimum set of resources on that path?
- **Difficulty:** hard | **Category:** dependency-chain | **Scoring:** checklist
- Raw Trial 1: **0.0** — Checked 0/4 (need 3 for full, 2 for partial). Found: []. Missing: [cw_dashboard references compute or database or loadbalancer outputs, monitoring module depends on compute, database, and loadbalancer, compute or loadbalancer depends on networking via security, networking contains vpc]
- Raw Trial 2: **0.0** — Checked 0/4 (need 3 for full, 2 for partial). Found: []. Missing: [cw_dashboard references compute or database or loadbalancer outputs, monitoring module depends on compute, database, and loadbalancer, compute or loadbalancer depends on networking via security, networking contains vpc]
- MCP Trial 1: **0.0** — Checked 0/4 (need 3 for full, 2 for partial). Found: []. Missing: [cw_dashboard references compute or database or loadbalancer outputs, monitoring module depends on compute, database, and loadbalancer, compute or loadbalancer depends on networking via security, networking contains vpc]
- MCP Trial 2: **0.0** — Checked 0/4 (need 3 for full, 2 for partial). Found: []. Missing: [cw_dashboard references compute or database or loadbalancer outputs, monitoring module depends on compute, database, and loadbalancer, compute or loadbalancer depends on networking via security, networking contains vpc]

### Prompt 25: If the NAT gateway fails, which resources and tiers lose connectivity? Trace the impact.
- **Difficulty:** hard | **Category:** impact-analysis | **Scoring:** checklist
- Raw Trial 1: **0.0** — Checked 0/4 (need 3 for full, 2 for partial). Found: []. Missing: [route_table_private directly depends on nat_gateway, private subnets lose internet routing, compute instances in private subnets affected, app tier and web tier lose outbound connectivity]
- Raw Trial 2: **0.0** — Checked 0/4 (need 3 for full, 2 for partial). Found: []. Missing: [route_table_private directly depends on nat_gateway, private subnets lose internet routing, compute instances in private subnets affected, app tier and web tier lose outbound connectivity]
- MCP Trial 1: **0.0** — Checked 0/4 (need 3 for full, 2 for partial). Found: []. Missing: [route_table_private directly depends on nat_gateway, private subnets lose internet routing, compute instances in private subnets affected, app tier and web tier lose outbound connectivity]
- MCP Trial 2: **0.0** — Checked 0/4 (need 3 for full, 2 for partial). Found: []. Missing: [route_table_private directly depends on nat_gateway, private subnets lose internet routing, compute instances in private subnets affected, app tier and web tier lose outbound connectivity]

### Prompt 26: What Terraform resources would I need to add to deploy a new microservice behind the existing ALB?
- **Difficulty:** hard | **Category:** planning | **Scoring:** checklist
- Raw Trial 1: **1.0** — Checked 8/8 (need 7 for full, 4 for partial). Found: [security group, IAM role, instance profile, launch template, auto scaling group, target group, listener rule, scaling policy]. Missing: []
- Raw Trial 2: **1.0** — Checked 8/8 (need 7 for full, 4 for partial). Found: [security group, IAM role, instance profile, launch template, auto scaling group, target group, listener rule, scaling policy]. Missing: []
- MCP Trial 1: **1.0** — Checked 8/8 (need 7 for full, 4 for partial). Found: [security group, IAM role, instance profile, launch template, auto scaling group, target group, listener rule, scaling policy]. Missing: []
- MCP Trial 2: **1.0** — Checked 8/8 (need 7 for full, 4 for partial). Found: [security group, IAM role, instance profile, launch template, auto scaling group, target group, listener rule, scaling policy]. Missing: []

### Prompt 27: What is the full dependency chain from the WAF to the VPC? List every resource on the path.
- **Difficulty:** hard | **Category:** dependency-chain | **Scoring:** topological-validation
- Raw Trial 1: **1.0** — Nodes: 2/2 present. Precedence: 1/1 satisfied. Raw: 1.00. 
- Raw Trial 2: **0.5** — Nodes: 2/2 present. Precedence: 0/1 satisfied. Raw: 0.50. Violations: [waf_web_acl should precede alb]
- MCP Trial 1: **1.0** — Nodes: 2/2 present. Precedence: 1/1 satisfied. Raw: 1.00. 
- MCP Trial 2: **1.0** — Nodes: 2/2 present. Precedence: 1/1 satisfied. Raw: 1.00. 

### Prompt 28: Which resources are leaf nodes (nothing else depends on them) in the security module?
- **Difficulty:** hard | **Category:** dependency-direct | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 8/8 (100%). Missing: []
- Raw Trial 2: **1.0** — Matched 8/8 (100%). Missing: []
- MCP Trial 1: **1.0** — Matched 8/8 (100%). Missing: []
- MCP Trial 2: **1.0** — Matched 8/8 (100%). Missing: []

### Prompt 29: Compare the web tier and app tier deployment stacks. What resources does each tier have and how do they mirror each other?
- **Difficulty:** hard | **Category:** cross-module | **Scoring:** checklist
- Raw Trial 1: **0.0** — Checked 0/7 (need 6 for full, 3 for partial). Found: []. Missing: [launch_template_web / launch_template_app, asg_web / asg_app, web_instance_1,2 / app_instance_1,2, instance_profile_web / instance_profile_app, scaling_policy_web / scaling_policy_app, cw_alarm_asg_web / cw_alarm_asg_app, sg_web / sg_app]
- Raw Trial 2: **0.0** — Checked 0/7 (need 6 for full, 3 for partial). Found: []. Missing: [launch_template_web / launch_template_app, asg_web / asg_app, web_instance_1,2 / app_instance_1,2, instance_profile_web / instance_profile_app, scaling_policy_web / scaling_policy_app, cw_alarm_asg_web / cw_alarm_asg_app, sg_web / sg_app]
- MCP Trial 1: **0.0** — Checked 0/7 (need 6 for full, 3 for partial). Found: []. Missing: [launch_template_web / launch_template_app, asg_web / asg_app, web_instance_1,2 / app_instance_1,2, instance_profile_web / instance_profile_app, scaling_policy_web / scaling_policy_app, cw_alarm_asg_web / cw_alarm_asg_app, sg_web / sg_app]
- MCP Trial 2: **0.0** — Checked 0/7 (need 6 for full, 3 for partial). Found: []. Missing: [launch_template_web / launch_template_app, asg_web / asg_app, web_instance_1,2 / app_instance_1,2, instance_profile_web / instance_profile_app, scaling_policy_web / scaling_policy_app, cw_alarm_asg_web / cw_alarm_asg_app, sg_web / sg_app]

### Prompt 30: If I need to rotate the RDS credentials, trace every resource that stores or references the database connection information.
- **Difficulty:** hard | **Category:** dependency-chain | **Scoring:** set-overlap
- Raw Trial 1: **1.0** — Matched 4/5 (80%). Missing: [cw_dashboard]
- Raw Trial 2: **1.0** — Matched 5/5 (100%). Missing: []
- MCP Trial 1: **1.0** — Matched 5/5 (100%). Missing: []
- MCP Trial 2: **1.0** — Matched 5/5 (100%). Missing: []
