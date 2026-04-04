# /review-pr — Full PR Review Across All Changed Files

Use this as the gate before any branch merges to main.
Runs a structured review across every changed file and produces a single report.
For reviewing a single file during development, use `/review-code` instead.

---

## Steps

**1. Get the changeset.**

If a PR number is provided:
```
gh pr diff <number>
```

If on a branch with no PR yet:
```
git diff main...HEAD
```

If reviewing staged changes only:
```
git diff --staged
```

List every changed file before proceeding. Confirm with the user if the file
list looks correct before starting the review.

---

**2. Read DECISIONS.md fully.**

Load all committed decisions into context before touching any file.
Every file review will check against these. Do not re-read DECISIONS.md
per file — load it once here and apply throughout.

---

**3. Check NOTES.md for active Heads Up warnings.**

If any Heads Up entry mentions files in this PR, flag it immediately.
A teammate may have warned about an interface change or in-progress refactor
that makes this PR's changes dangerous to merge right now.

---

**4. Run tool-schema-reviewer if `src/index.ts` is in the changeset.**

If `src/index.ts` appears in the changed file list, spawn the `tool-schema-reviewer` agent before reviewing any other file.

- If verdict is **FAIL**: stop the PR review immediately. List the BLOCKING findings and ask the author to fix them before continuing.
- If verdict is **PASS WITH WARNINGS** or **PASS**: include the result in the final report and proceed.

---

**5. Review each changed file.**

For each file in the changeset, run the full `/review-code` logic:

- Identify applicable domain skills
- Check Decisions Compliance
- Check Skill Compliance
- Check Correctness
- Check Context Efficiency
- Check Security
- Check Error Handling

Record findings per file. Do not produce output yet — collect all findings first.

---

**5. Aggregate findings across all files.**

After reviewing every file, compile findings into a single report.
Deduplicate findings that appear in multiple files — list the pattern once
and note all files affected.

Group by severity:
- All BLOCKING findings across all files
- All WARNING findings across all files
- All SUGGESTION findings across all files

---

**6. Output the full PR review report.**

```
## PR Review: [branch name or PR title]
Type: PR Review
Date: YYYY-MM-DD
Files reviewed: [count]
Files changed: [list]

---

### BLOCKING
- [SOURCE → RULE] Description. File: path/to/file.ts, line if known.

### WARNING
- [SOURCE → RULE] Description. File: path/to/file.ts, line if known.

### SUGGESTION
- [SOURCE → RULE] Optional improvement. File: path/to/file.ts.

### Per-File Summary
| File | Verdict | Findings |
|------|---------|----------|
| src/parser.ts | FAIL | 2 BLOCKING, 1 WARNING |
| src/tools/get_subgraph.ts | PASS WITH WARNINGS | 1 WARNING |
| src/graph.ts | PASS | None |

### Skipped Files
- [filename]: reason (e.g., config file, no applicable skills)

### Overall Verdict
PASS | PASS WITH WARNINGS | FAIL

Summary in two to three sentences. What is the state of this PR?
What must be resolved before merge?
```

---

**7. After the report:**

**If FAIL:**
- List each BLOCKING finding clearly
- Ask: "Do you want to fix these now or open a follow-up?"
- Do not suggest merging with unresolved BLOCKING findings

**If PASS WITH WARNINGS:**
- Ask: "Do you want to resolve any warnings before merging, or proceed?"
- If proceeding: run `/sync-context` to log unresolved warnings as Heads Up entries

**If PASS:**
- Confirm: "This PR is clean against all project standards. Ready to merge."
- Remind: run `/end-session` after merging to update CHANGELOG.md and clean context
