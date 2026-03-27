# /sync-context — Update NOTES.md With Current State

Only sync things that `git log` cannot tell the team.
Do not summarize code changes here — `git log` does that better.

---

## Steps

**1. Ask: are you blocked on anything right now?**

- If **yes**: add an entry to the Open Blockers section in NOTES.md.
  Format: `[NAME YYYY-MM-DD] blocked on: what, waiting for: who`
- If **no**: check if you have an existing entry in Open Blockers and remove it.
  A resolved blocker should not linger.

---

**2. Ask: any questions that need a team answer before you can continue?**

- If **yes**: add an entry to the Live Questions section in NOTES.md.
  Format: `[NAME YYYY-MM-DD] question`
  Remind me: if this goes unanswered for 24 hours, escalate or decide unilaterally and commit.
- If **no**: scan Live Questions for any entries I wrote that are now resolved.
  Remove resolved questions — move answers to DECISIONS.md via `/commit-decision` if needed.

---

**3. Ask: anything teammates should know that is not yet committed?**

- If **yes**: add an entry to the Heads Up section in NOTES.md.
  Format: `[NAME YYYY-MM-DD] warning or notice`
  Examples: refactoring a shared interface, changing a shared type, about to rebase a branch.
- If **no**: scan Heads Up for any of my entries that are now committed.
  Remove them — once it is in git, it does not belong here.

---

**4. Stage NOTES.md.**

```
git add NOTES.md
```

---

**5. Commit with a consistent message format.**

```
git commit -m "context: sync [name] [YYYY-MM-DD]"
```

---

**6. Push.**

```
git push
```

---

**7. Remind me:**

"Run `/end-session` when you are done for the day."
