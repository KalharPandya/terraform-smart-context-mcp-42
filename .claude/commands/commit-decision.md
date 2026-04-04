# /commit-decision — Commit a Decision to DECISIONS.md

Run this immediately after any design decision is made.
Do not wait. Do not batch decisions. Commit each one as it happens.

---

## Steps

**1. Ask: what is the decision in one sentence?**

If I cannot state it in one sentence, it may not be a decision yet.
Help me sharpen it before proceeding.

---

**2. Ask: who made it and what is today's date?**

Format I need: `[NAME YYYY-MM-DD]`

---

**3. Check DECISIONS.md for conflicts.**

Read the existing Decisions section.

- If this decision contradicts an existing entry: **stop and flag the conflict** before writing anything.
  Ask me how to resolve it. Do not silently overwrite history.
- If this decision is genuinely new: continue.

---

**4. Append to DECISIONS.md.**

Add the entry at the bottom of the Decisions section:

```
[NAME YYYY-MM-DD] decision summary in one sentence
```

Do not edit any existing entries above it.

---

**5. Check if this decision answers a Live Question in NOTES.md.**

If yes: remove that question from the Live Questions section in NOTES.md.
The question has been answered — it should not remain open.

---

**6. Stage both files.**

```
git add DECISIONS.md NOTES.md
```

---

**7. Commit with a consistent message format.**

```
git commit -m "decision: <summary in one sentence>

Closes #<issue number if this answers a tracked decision issue>"
```

Keep the subject line under 72 characters. Include `Closes #N` only if a GitHub issue tracks this decision (e.g. #7–#11).

---

**8. Push immediately.**

```
git push
```

---

**9. Check if this decision closes a GitHub issue.**

If the decision answers one of the open questions tracked as GitHub issues (#7–#11):
- Move that issue to **Done** on the GitHub Project board
- Close the issue with a comment referencing the DECISIONS.md entry

```bash
gh issue close <number> --repo KalharPandya/terraform-smart-context-mcp-42 \
  --comment "Resolved via DECISIONS.md: [NAME DATE] <decision summary>"
```

If there is no corresponding issue, skip this step.

---

**10. Confirm to me:**

"Pushed — teammates will see this decision on their next `git pull`."
