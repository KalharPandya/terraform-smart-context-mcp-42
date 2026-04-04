# /end-session — Clean Up and Push Before Stopping

Run this before ending every working session.
Do not stop working without running this.

---

## Steps

**1. Check for uncommitted work.**

```
git status
```

If there is uncommitted work:
- Ask me: "Do you want to commit this, stash it, or leave it?"
- Do not proceed until I answer.
- If I want to stash: run `git stash` with a descriptive name.
- If I want to commit: first run the tool-schema-reviewer check below if `src/index.ts` is in the staged files, then use the standard commit format.

#### Tool schema check (only if `src/index.ts` is staged)

```bash
git diff --staged --name-only | grep -q "src/index.ts"
```

If it matches: spawn the `tool-schema-reviewer` agent against `src/index.ts`.
- If verdict is **FAIL**: do not commit. Fix the BLOCKING issues first.
- If verdict is **PASS WITH WARNINGS** or **PASS**: proceed to commit.

---

### Commit Message Format

```
<type>(<scope>): <short summary>

[optional body — explain WHY, not what]

Closes #<issue>   ← use if this fully resolves the issue
Refs #<issue>     ← use if this is partial work or just related
```

**Types:**

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change that isn't a fix or feature |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `chore` | Build process, tooling, dependencies |
| `decision` | DECISIONS.md update only |
| `context` | NOTES.md / CHANGELOG.md housekeeping |

**Rules:**
- Subject line: max 72 chars, imperative mood ("add" not "added"), no period
- Scope is optional but recommended when the change is isolated (e.g., `dag`, `parser`, `mcp`, `runner`)
- Always include `Closes #N` or `Refs #N` — every commit should trace to an issue
- Body is optional but use it when the *why* is not obvious from the summary

**Examples:**
```
feat(dag): add edge traversal for module dependencies

Closes #17
```
```
fix(parser): handle empty resource blocks without crashing

Refs #18
```
```
refactor(mcp): extract subgraph builder into separate function

Closes #20
```

---

**2. Run /sync-context.**

Update NOTES.md to reflect end-of-session state.
Follow all steps in `/sync-context`.

---

**3. Clear stale Heads Up entries.**

Review my Heads Up entries in NOTES.md.
For each one: is the work now committed?
- If yes: remove the entry. It is in git now.
- If no: leave it and make sure the wording is still accurate.

---

**4. Clear resolved Open Blockers.**

Review my Open Blockers entries.
For each one: is the blocker resolved?
- If yes: remove the entry.
- If no: update the entry if the situation has changed.

---

**5. Close answered Live Questions.**

Review my Live Questions entries.
For each one that is now answered:
- Run `/commit-decision` for it.
- Remove it from Live Questions once committed.

---

**6. Sync the GitHub Project board.**

For any issue you completed this session, move it to **Done**:

```bash
gh project item-edit --project-id PVT_kwHOA_Tuhs4BTFq_ \
  --id <PVTI_item_id> --field-id PVTSSF_lAHOA_Tuhs4BTFq_zhAbqaA \
  --single-select-option-id 98236657
```

For any issue you started but did not finish, confirm it is set to **In Progress** (option id: `47fc9ee4`).

If you are unsure which item IDs to use, run:
```bash
gh project item-list 1 --owner KalharPandya
```

---

**7. Update CHANGELOG.md.**

```
git log --oneline --since="session start" --all
```

From the commits this session, find any with `feat:` or `fix:` prefixes.
For each one:
- `feat:` commits → add a line under `### Added` in the `[Unreleased]` section
- `fix:` commits → add a line under `### Fixed` in the `[Unreleased]` section

Format each line as:
```
- <commit summary, rewritten as a plain English description of what shipped>
```

Do not add entries for `decision:`, `context:`, `chore:`, or housekeeping commits.
Do not edit any existing entries — only append under the correct section heading.

Commit the change:
```
git add CHANGELOG.md && git commit -m "chore: update CHANGELOG.md for session"
```

---

**8. Show a summary of today's work.**

```
git log --oneline -5
```

Show me the last 5 commits. This is my summary of what I shipped today.

---

**9. Confirm clean close.**

"Session ended cleanly. Teammates will see your context on their next `git pull`."
