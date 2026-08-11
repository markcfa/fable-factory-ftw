---
name: enter-the-factory
description: Submit the user's project as an entry to the Fable Factory FTW leaderboard (or any factory-style leaderboard repo). Use when the user says things like "enter my project on the leaderboard", "submit to the factory", "add me to fable factory", or "put my build on the board". Drafts the entry JSON, validates it, and opens the pull request.
---

# Enter the Factory

You are submitting the user's project to a **Fable Factory** leaderboard — a GitHub-native competition where entries are JSON files merged by PR and ranked by 👍 votes on per-entry issues.

Target repo (default): `markcfa/fable-factory-ftw`. If the user names a different factory repo, use that instead.

## Step 1 — Collect the entry details

Ask only for what's missing; infer what you can from the current project/repo:

| Field | Required | Notes |
|---|---|---|
| `project` | ✅ | Display name |
| `builder` | ✅ | The **user's GitHub handle**, no `@` |
| `oneLiner` | ✅ | ≤ 140 chars. Make it sell — this is the card copy |
| `builtWith` | ✅ | Model + surface, e.g. "Claude Sonnet in Claude Code" |
| `repo` | ⬜ | Public GitHub URL — required to compete on the Stars board |
| `demo` | ⬜ | Live URL or writeup |
| `screenshot` | ⬜ | Add file to `assets/<slug>.png` (≤ 300 KB) or use a full https URL |
| `crew` | ⬜ | Group tag if the user belongs to one |
| `enteredAt` | ✅ | Today's date, `YYYY-MM-DD` |
| `voteIssue` | ✅ | **Always `null`** — the Action sets it |
| `starsAtEntry` | ✅ | **Always `null`** — the Action sets it |

Slug = kebab-case of the project name (e.g. `My Cool Agent` → `my-cool-agent`). The filename `entries/<slug>.json` is the entry id.

## Step 2 — Fork, branch, write

```bash
gh repo fork <owner>/<factory-repo> --clone --default-branch-only
cd <factory-repo>
git checkout -b entry/<slug>
# write entries/<slug>.json  (and optional assets/<slug>.png)
```

No `gh`? Fork via the web UI and clone, or use the GitHub API with the user's token.

## Step 3 — Validate before committing

- JSON parses; all required fields present; `oneLiner` ≤ 140 chars.
- `voteIssue` and `starsAtEntry` are `null` — never pre-set scores.
- Slug doesn't already exist in `entries/` on upstream `main`.
- Exactly one new entry file in the PR (plus optional screenshot).
- Screenshot ≤ 300 KB.

## Step 4 — Open the PR

```bash
git add entries/<slug>.json assets/<slug>.png 2>/dev/null; git add entries/<slug>.json
git commit -m "Entry: <project> — @<builder>"
git push -u origin entry/<slug>
gh pr create --repo <owner>/<factory-repo> --title "Entry: <project> — @<builder>" --fill
```

Fill the PR template checklist honestly — the maintainer merges by hand.

## Step 5 — Tell the user what happens next

After merge, the factory Action opens their **voting issue** (label `vote`) and snapshots their repo's stars. Votes = 👍 reactions on that issue's top post — self-votes don't count, accounts younger than the configured minimum age are filtered, and the board re-tallies nightly. Send them the issue link once it exists and suggest they campaign for votes.
