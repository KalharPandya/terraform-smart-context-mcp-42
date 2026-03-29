# Baseline Experiment — Manual Run via Claude Code

## Instructions for the Operator

### Setup
1. Open a **new Claude Code session** from the `experiments/baseline/dummy-infra/` directory
2. Make sure Claude does NOT load CLAUDE.md or any project docs — run from the dummy-infra subdirectory only
3. Paste the **System Context** section below as your first message
4. Then paste each **Task Prompt** one at a time
5. After Claude answers, record the answer in `experiments/baseline/results/manual-run.json` using the template below
6. Note the token count shown in the Claude Code UI after each prompt

### How to Launch

```bash
cd experiments/baseline/dummy-infra
claude
```

This starts Claude Code scoped to dummy-infra/ which has no CLAUDE.md — Claude gets no pre-loaded project context.

---

## System Context (paste this as your FIRST message)

```
You are an infrastructure assistant. There is a Terraform project in the current directory that is already initialized and applied (state exists with 75 resources across 6 modules).

You have access to:
- Bash tool to run terraform commands (e.g., terraform state list, terraform show -json, terraform state show <address>, terraform graph, terraform output -json)
- Read tool to read any .tf file
- Glob tool to find .tf files

Rules:
- Use ONLY terraform CLI commands and file reading to find answers. Do not guess.
- When you have enough information, provide your final answer clearly and precisely.
- Do not dump raw command output as your answer — synthesize the information.
- After your final answer, output a JSON block tagged with ```json that contains EXACTLY this structure:

{
  "prompt_id": <number>,
  "answer": "<your synthesized answer as a single string>",
  "tool_calls_made": [
    {"tool": "<Bash|Read|Glob|Grep>", "detail": "<short description of what you ran>"}
  ]
}

This JSON block is critical — it will be used for automated scoring.

I will now give you 10 task prompts, one at a time. Answer each one independently.
```

---

## Task Prompts (paste one at a time, wait for answer before sending next)

**Record the start time before pasting each prompt.**

### Prompt 1
```
Prompt ID: 1
What is the CIDR block of the VPC?
```

### Prompt 2
```
Prompt ID: 2
List all subnets and their availability zones.
```

### Prompt 3
```
Prompt ID: 3
What resources directly depend on the VPC?
```

### Prompt 4
```
Prompt ID: 4
If I destroy the DB subnet group, what resources are affected?
```

### Prompt 5
```
Prompt ID: 5
List all security group rules that allow inbound traffic from 0.0.0.0/0.
```

### Prompt 6
```
Prompt ID: 6
Trace the full dependency chain from the ALB HTTPS listener to the RDS primary database.
```

### Prompt 7
```
Prompt ID: 7
What is the correct deployment order for the web tier resources?
```

### Prompt 8
```
Prompt ID: 8
Which module outputs does the compute module consume?
```

### Prompt 9
```
Prompt ID: 9
How many resources are there in total? Break down the count by module.
```

### Prompt 10
```
Prompt ID: 10
What Terraform resources would I need to add to deploy a new microservice behind the existing ALB?
```

---

## Recording Results

After each prompt, record in the tracking sheet below:

| Prompt | Start Time | End Time | Tokens (from UI) | Notes |
|--------|-----------|----------|-------------------|-------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |
| 8 | | | | |
| 9 | | | | |
| 10 | | | | |

Then collect all 10 JSON answer blocks from Claude's responses and assemble them into the results file using the template below.
