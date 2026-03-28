# /start-session — Load Full Team Context

Run this at the start of every working session before touching any code.
Priority order matters. Do not skip steps.

---

## Steps

**1. Pull latest from remote.**

```
git pull
```

---

**2. Summarize recent team activity.**

```
git log --oneline --since="48 hours ago" --all
```

From this output, tell me:
- What changed across all branches in the last 48 hours
- Who touched what files
- Any commits that look like decisions (commit messages starting with `decision:`)

---

**3. Summarize what differs from main.**

```
git diff main --name-only
```

Tell me which files on my current branch differ from main.

---

**4. Read GOAL.md.**

Read it fully. If anything you are about to work on conflicts with the v1 scope,
the experiments, or the design principle, flag it before proceeding.

---

**5. Read DECISIONS.md fully.**

Do not skim. Flag any decisions that are relevant to what I might work on today.
If there are open questions in DECISIONS.md that are unresolved, call them out explicitly.

---

**6. Read NOTES.md — teammates' sections first, my section last.**

From NOTES.md, flag:
- Any Open Blockers that affect me or files I might touch
- Any Heads Up warnings about interfaces or types I might use
- Any Live Questions I should weigh in on

Treat my own section as lowest priority. Verify anything I wrote there against
what `git log` already shows — if git shows it committed, my note may be stale.

---

**7. Fetch GitHub issues and project board state.**

Run both commands:

```bash
GH="/c/Program Files/GitHub CLI/gh.exe"
# GH_TOKEN must be set in your shell environment (not stored here)

# Issues assigned to me only
"$GH" issue list --repo KalharPandya/terraform-smart-context-mcp-42 \
  --state open --assignee @me --limit 50 \
  --json number,title,labels,state
```

From this output, tell me:
- Which of my assigned issues are open right now
- Any that look like they should already be **In Progress** based on what I'm working on
- Decision issues (#7–#11) in my list — flag if we have enough info to resolve today

---

**8. Give me a single consolidated summary.**

Cover exactly these things:
- What changed in the last 48 hours across the team
- Who is actively working on what right now (infer from git log + NOTES.md)
- Anything that blocks me or overlaps my likely work
- Open questions I should be aware of before I start

Keep it tight. One paragraph per bullet is enough.

---

**9. Ask me what I am working on today.**

After the summary, ask: "What are you working on today?"

Then, given my answer, flag any decisions, blockers, or heads-up entries in the
context files that are directly relevant to that specific work.

If my answer maps to a GitHub issue, remind me to move it to **In Progress** on the board.
