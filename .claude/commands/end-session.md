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
- If I want to commit: help me write a clear commit message and commit.
- If I want to stash: run `git stash` with a descriptive name.

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

**6. Show a summary of today's work.**

```
git log --oneline -5
```

Show me the last 5 commits. This is my summary of what I shipped today.

---

**7. Confirm clean close.**

"Session ended cleanly. Teammates will see your context on their next `git pull`."
