# Project 42: Terraform Smart Context MCP Server -- Submission

**Course:** CS 6650 -- Distributed Systems, Northeastern University Vancouver
**Team:** Kalhar Pandya, Vinal Dsouza, Parin Shah

---

## 1. Repository

**GitHub:** [https://github.com/KalharPandya/terraform-smart-context-mcp-42](https://github.com/KalharPandya/terraform-smart-context-mcp-42)

Code: `src/index.ts` (MCP server entry point)
Tests: `test-mcp.mjs` (smoke test), `experiments/baseline/runner.ts` (experiment runner), `experiments/baseline/scorer.ts` (automated scorer)

## 2. Project Plan

**GitHub Projects Board:** [https://github.com/users/KalharPandya/projects/1](https://github.com/users/KalharPandya/projects/1)

23 issues across 2 sprints (Sprint 1 complete, Sprint 2 ends Apr 10). Includes status, priority, size, and sprint assignment per issue.

## 3. Charts and Graphs

Included in the progress report (Section 7: Preliminary Results):
- Accuracy vs Token Cost by Difficulty (Mermaid bar chart)
- Avg Token Usage by Prompt (Mermaid bar chart)
- Gantt timeline (Section 2)

**File:** [`reports/progress-report.md`](reports/progress-report.md)

## 4. Elevator Pitch Video (2 min)

**File:** [`reports/Elevator-pitch.mp4`](reports/Elevator-pitch.mp4)

Pitch deck used in recording: [`pitch/slides.html`](pitch/slides.html), script: [`pitch/script.md`](pitch/script.md)

## 5. Progress Report (5 pages)

**Markdown:** [`reports/progress-report.md`](reports/progress-report.md)
**PDF:** [`reports/progress-report.pdf`](reports/progress-report.pdf)

Covers: Problem, Team, Experiments, Project Plan, Claude Code-First Development, Objectives, Related Work (10 references), Methodology and Hypothesis, Preliminary Results, Impact.

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

**Full repo on GitHub:** [https://github.com/KalharPandya/terraform-smart-context-mcp-42](https://github.com/KalharPandya/terraform-smart-context-mcp-42)
