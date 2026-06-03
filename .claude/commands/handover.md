# /handover — End-of-session handover

You are wrapping up a myNefesh work session. Execute all steps below in order. Be concise throughout — Dan reads this on his phone the next day.

---

## Step 1 — Identify what shipped

Run `git log --oneline` for the last 20 commits, then run `git status`. Compare against the session start (use today's date and recent commit timestamps to identify session commits).

List the commits that landed this session. If nothing was committed, note that.

---

## Step 2 — Handle uncommitted changes

Run `git diff --stat` and `git status` to surface any uncommitted work.

For each unstaged/staged change, decide:
- **Worth keeping?** Ask Dan: "I see uncommitted changes to X and Y — should I commit these before we close?" Wait for his answer before committing anything.
- **Scratch/throwaway?** Mention it but don't commit.

If Dan says yes to a commit, stage the relevant files and commit with a clear message. Never `git add .` blindly — add specific files.

---

## Step 3 — Update STATUS.md

File is at `H:\myNefesh\STATUS.md`. Update **only these three sections** — do not touch other sections:

### "Recently shipped (last ~2 weeks)"
- Prepend what shipped this session (1–2 bullet lines per feature, tight).
- Prune entries older than 2 weeks that future-Dan no longer needs in a 30-second brief.
- Keep the most important historical items if they're still load-bearing context.

### "Likely next steps (in priority order, my opinion)"
- Reorder / rewrite based on what's now done and what's newly unblocked.
- Max 5 items. Each under one line.

### "Known caveats / gotchas"
- Add any new gotchas that surfaced this session (broken assumptions, surprising behavior, environment quirks).
- Remove any that are now resolved.

**Filter rule:** if future-Dan doesn't need it in under 30 seconds, cut it.

---

## Step 4 — Update CLAUDE.md (only if needed)

File is at `H:\myNefesh\CLAUDE.md`. Update **only if** one of the following changed this session:
- Tech stack (new dependency, service, hosting change)
- Architecture or key patterns
- Data model (schema, table, column, relationship, migration)
- Server routes (new endpoint, changed behavior)
- Client screens (new screen, renamed screen, deleted screen)

If nothing in those categories changed, **skip this step entirely**.

---

## Step 5 — Copy docs to F:\All\

After updating STATUS.md (and optionally CLAUDE.md), copy both files:

```powershell
Copy-Item "H:\myNefesh\STATUS.md" "F:\All\STATUS.md" -Force
Copy-Item "H:\myNefesh\CLAUDE.md" "F:\All\CLAUDE.md" -Force
```

---

## Step 6 — Print the handover note

Output this exact structure. Keep each section to 3–5 lines max. Dan reads this on his phone — no walls of text.

```
## Handover — YYYY-MM-DD

### ✅ What shipped
[List commits/features. One line each. If nothing shipped, say so plainly.]

### 🔄 Still in flight
[Anything started but not finished. Include enough cold-reader context that Dan knows where to pick up — file name, what's done, what's left.]

### ⚠️ Watch-outs
[Gotchas, broken assumptions, surprises discovered this session. If none, write "None."]

### ❓ Open questions for Dan
[Decisions that are Dan's to make. If none, write "None."]
```

---

## Step 7 — Commit the updated docs

Stage and commit only `STATUS.md` and `CLAUDE.md` (whichever were actually changed):

```
git commit -m "docs: handover YYYY-MM-DD"
```

Replace `YYYY-MM-DD` with today's actual date.

Then push to master:

```
git push origin master
```

Confirm the push succeeded. If the push fails (bridge flakiness — a known issue), tell Dan and give him the manual command to run.

---

## Done

Report back: commit hash + whether the push succeeded. Nothing else needed.
