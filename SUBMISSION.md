# Project 42: Terraform Smart Context MCP Server -- Submission

**Course:** CS 6650 -- Distributed Systems, Northeastern University Vancouver
**Team:** Kalhar Pandya, Vinal Dsouza, Parin Shah

---

## 1. Repository

**GitHub:** [https://github.com/KalharPandya/terraform-smart-context-mcp-42](https://github.com/KalharPandya/terraform-smart-context-mcp-42)

| File | Description | GitHub Link |
|------|------------|-------------|
| `src/index.ts` | MCP server entry point | [View](https://github.com/KalharPandya/terraform-smart-context-mcp-42/blob/main/src/index.ts) |
| `test-mcp.mjs` | Smoke test | [View](https://github.com/KalharPandya/terraform-smart-context-mcp-42/blob/main/test-mcp.mjs) |
| `experiments/baseline/runner.ts` | Experiment runner | [View](https://github.com/KalharPandya/terraform-smart-context-mcp-42/blob/main/experiments/baseline/runner.ts) |
| `experiments/baseline/scorer.ts` | Automated scorer | [View](https://github.com/KalharPandya/terraform-smart-context-mcp-42/blob/main/experiments/baseline/scorer.ts) |

## 2. Project Plan

**GitHub Projects Board:** [https://github.com/users/KalharPandya/projects/1](https://github.com/users/KalharPandya/projects/1)

23 issues across 2 sprints (Sprint 1 complete, Sprint 2 ends Apr 10). Includes status, priority, size, and sprint assignment per issue.

## 3. Charts and Graphs

Included in the progress report (Section 7: Preliminary Results):
- Accuracy vs Token Cost by Difficulty (Mermaid bar chart)
- Avg Token Usage by Prompt (Mermaid bar chart)
- Gantt timeline (Section 2)

**File:** [reports/progress-report.md](https://github.com/KalharPandya/terraform-smart-context-mcp-42/blob/main/reports/progress-report.md)

## 4. Elevator Pitch Video (2 min)

**File:** [reports/Elevator-pitch.mp4](https://github.com/KalharPandya/terraform-smart-context-mcp-42/blob/main/reports/Elevator-pitch.mp4)

| File | Description | GitHub Link |
|------|------------|-------------|
| `pitch/slides.html` | Pitch deck (single-page HTML) | [View](https://github.com/KalharPandya/terraform-smart-context-mcp-42/blob/main/pitch/slides.html) |
| `pitch/script.md` | Presenter script | [View](https://github.com/KalharPandya/terraform-smart-context-mcp-42/blob/main/pitch/script.md) |

## 5. Progress Report (5 pages)

| Format | GitHub Link |
|--------|-------------|
| Markdown | [reports/progress-report.md](https://github.com/KalharPandya/terraform-smart-context-mcp-42/blob/main/reports/progress-report.md) |
| PDF | [reports/progress-report.pdf](https://github.com/KalharPandya/terraform-smart-context-mcp-42/blob/main/reports/progress-report.pdf) |

Covers: Problem, Team, Experiments, Project Plan, Claude Code-First Development, Objectives, Related Work (10 references), Methodology and Hypothesis, Preliminary Results, Impact.

---

## Key Links

| Resource | URL |
|----------|-----|
| **Repository** | [github.com/KalharPandya/terraform-smart-context-mcp-42](https://github.com/KalharPandya/terraform-smart-context-mcp-42) |
| **Project Board** | [github.com/users/KalharPandya/projects/1](https://github.com/users/KalharPandya/projects/1) |
| **Progress Report (MD)** | [reports/progress-report.md](https://github.com/KalharPandya/terraform-smart-context-mcp-42/blob/main/reports/progress-report.md) |
| **Progress Report (PDF)** | [reports/progress-report.pdf](https://github.com/KalharPandya/terraform-smart-context-mcp-42/blob/main/reports/progress-report.pdf) |
| **Elevator Pitch Video** | [reports/Elevator-pitch.mp4](https://github.com/KalharPandya/terraform-smart-context-mcp-42/blob/main/reports/Elevator-pitch.mp4) |
| **Baseline Results** | [RAW_Claude_Code_Experiments.md](https://github.com/KalharPandya/terraform-smart-context-mcp-42/blob/main/experiments/baseline/RAW_Claude_Code_Experiments.md) |
| **Dummy Infrastructure** | [experiments/baseline/dummy-infra/](https://github.com/KalharPandya/terraform-smart-context-mcp-42/tree/main/experiments/baseline/dummy-infra) |

---

## Zip Contents

```
42-Terraform-MCP/
  SUBMISSION.md                          <-- this file
  reports/
    progress-report.md                   <-- 5-page report (markdown)
    progress-report.pdf                  <-- 5-page report (PDF)
    Elevator-pitch.mp4                   <-- 2-min elevator pitch video
  pitch/
    slides.html                          <-- pitch deck (single-page HTML)
    script.md                            <-- presenter script
  src/
    index.ts                             <-- MCP server code
  test-mcp.mjs                           <-- smoke test
  experiments/
    baseline/
      runner.ts                          <-- experiment runner
      scorer.ts                          <-- automated scorer
      visualize.ts                       <-- chart generator
      prompts.json                       <-- 10 prompts + ground truth
      RAW_Claude_Code_Experiments.md     <-- full baseline results
      dummy-infra/                       <-- 75-resource test infrastructure
```
