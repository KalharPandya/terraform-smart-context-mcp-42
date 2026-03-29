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
- Researched Claude Code CLI headless mode for experiment runner — confirmed `claude -p --output-format json --bare` returns built-in token, cost, duration metrics; stream-json mode counts tool_use events. Documented in RAW_Claude_Code_Experiments.md.
- `experiments/baseline/RAW_Claude_Code_Experiments.md` — runner design, temp directory approach, metrics schema, results table (pending runs), research notes.
- Updated `plans/experiments-plan.md` to reflect Claude Code CLI runner design and per-trial temp directory isolation approach.
- 2 new decisions in DECISIONS.md: Claude Code CLI headless runner, temp dir isolation per trial.

### Changed

### Fixed

### Removed
