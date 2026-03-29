# Changelog

<!-- AI should never edit this file manually. -->
<!-- This file is only updated when a feature ships, via /end-session. -->
<!-- Format follows Keep a Changelog: https://keepachangelog.com/en/1.0.0/ -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Dummy Terraform infrastructure: 75 null_resources across 6 modules (networking, security, compute, database, loadbalancer, monitoring) simulating a 3-tier AWS deployment. State produces 4041 pretty-printed JSON lines (~33K tokens). Zero cloud charges. Closes #12.
- 4 design decisions committed to DECISIONS.md: null_resource trigger refs, 75-resource module layout, 4000+ line state target, experiment comparison metrics.
- `/end-session` command now includes a step to update CHANGELOG.md with `feat:` and `fix:` commits before closing — closes the gap where the file claimed to be auto-updated but had no instruction to do so.
- 10 experiment prompts with ground truth answers (prompts.json): 3 easy, 4 medium, 3 hard across 6 categories with 4 scoring types. All ground truth verified against .tf source files. Closes #13.
- Researched Claude Code CLI headless mode for experiment runner — confirmed `claude -p --output-format json --bare` returns built-in token, cost, duration metrics; stream-json mode counts tool_use events. Design documented in `plans/experiments-plan.md`.
- Updated `plans/experiments-plan.md` to reflect Claude Code CLI runner design and per-trial temp directory isolation approach. `RAW_Claude_Code_Experiments.md` noted as a future output file created after runs complete.
- 2 new decisions in DECISIONS.md: Claude Code CLI headless runner, temp dir isolation per trial.
- Baseline experiment runner (`runner.ts`): Claude Code CLI headless mode with stream-json parsing, temp dir isolation, per-tool-call granular metrics (tokens, output size, files accessed, terraform commands). Closes #14.
- Baseline experiment scorer (`scorer.ts`): 4 scoring types (substring-match, set-overlap, topological-validation, checklist) with fuzzy matching for AZ short codes, multi-part format matching, and separator-agnostic number matching. Closes #15.
- Baseline experiment visualizer (`visualize.ts`): Chart.js HTML dashboard with 6 interactive charts (accuracy by difficulty, token usage, tool calls vs accuracy, token efficiency, context growth, command distribution).
- Manual run support: `assemble-results.ts` for merging manual Claude Code answers into scorer format, `manual-run-prompt.md` with step-by-step instructions, `results/manual-run-template.json` as scorer-compatible template.
- Baseline experiment results (`RAW_Claude_Code_Experiments.md`): Full analysis of 10 prompts x 3 trials. Overall accuracy 0.83, easy=0.83, medium=0.75, hard=0.94. Total: 1.49M tokens, $1.73, 30 trials. Key finding: hard prompts cost 2.8x more than easy but maintain high accuracy — the raw CLI problem is cost/latency, not accuracy at 75-resource scale. Closes #16.
- 2 new decisions: CLI headless runner uses OAuth not --bare, baseline experiment results and revised thesis.

### Changed

### Fixed

### Removed
