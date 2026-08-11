# 🏭 Fable Factory FTW

**Friends build with Claude. The crowd decides.**

**[→ The live board](https://markcfa.github.io/fable-factory-ftw/)** · [Voting issues](https://github.com/markcfa/fable-factory-ftw/issues?q=is%3Aissue+label%3Avote) · [Run your own](#run-your-own-factory)

A zero-backend leaderboard for people building things with Claude. Entries are JSON files merged by pull request. Votes are 👍 reactions on GitHub issues. A nightly Action does the counting and redeploys the page. There is nothing to host, nothing to sign up for, and no database — if you have a GitHub account, you can enter and you can vote.

Fittingly, the scoreboard itself is entry **#001** — built with Claude in one session.

## The boards

**👍 Crowd** — the official board. Every entry gets a voting issue; the group (and anyone else on GitHub) votes by reacting 👍 to the issue's top post. The leader holds **The Claude Cup** 🏆.

**✨ Stars** — the bragging-rights track. For repo-backed entries, the Action snapshots your star count when the entry merges and ranks by **stars gained since entry** — so nobody imports a pre-existing following. Work that isn't a public repo (a skill, a workflow, an agent setup) still competes on Crowd.

## Enter your build

**The fun way** — this repo bundles a Claude skill. Clone it (or just point your Claude at this repo) and say:

> *"Enter my project on the leaderboard."*

Claude collects your details, forks, writes the entry, and opens the PR. The skill lives at [`.claude/skills/enter-the-factory/SKILL.md`](.claude/skills/enter-the-factory/SKILL.md).

**The manual way** — copy [`entries/_template.json`](entries/_template.json) to `entries/<your-slug>.json`, fill it in, and open a PR:

```json
{
  "project": "My Cool Agent",
  "builder": "your-github-handle",
  "oneLiner": "What it is and why it's good, in ≤140 characters.",
  "builtWith": "Claude Sonnet in Claude Code",
  "repo": "https://github.com/you/my-cool-agent",
  "demo": "https://you.github.io/my-cool-agent/",
  "screenshot": "assets/my-cool-agent.png",
  "crew": null,
  "enteredAt": "2026-08-11",
  "voteIssue": null,
  "starsAtEntry": null
}
```

Leave `voteIssue` and `starsAtEntry` as `null` — the Action fills them after merge, opens your voting issue, and you're live on the next deploy. Screenshots go in `assets/` (≤ 300 KB) or use any https URL.

## Voting

React **👍 to the top post** of an entry's voting issue ([all of them here](https://github.com/markcfa/fable-factory-ftw/issues?q=is%3Aissue+label%3Avote)). One vote per account, enforced by GitHub. The tally excludes the builder's own vote, bot accounts, and accounts younger than **30 days** (anti-sockpuppet — configurable in [`factory.config.json`](factory.config.json)). Re-tallied nightly at 03:17 UTC and on every merge.

## Run your own factory

This repo is a **template**. To spin up a leaderboard for your own group:

1. Click **Use this template** → create your repo (public, so Pages is free).
2. Edit `factory.config.json` — title, tagline, cup name, `repo`, guardrails.
3. Delete the entries in `entries/` (keep `_template.json`), add your first one.
4. Push. The Action tallies, opens voting issues, and deploys the page to `https://<you>.github.io/<repo>/`.

If the page doesn't appear after the first run: **Settings → Pages → Source: "GitHub Actions"** (one-time), then re-run the workflow.

## House rules

Work must be **substantially built with Claude** — any model, any surface; say how in `builtWith`. Ship something real: a repo, a demo, a writeup, screenshots — vapourware gets closed with affection. One entry per project; meaningful new versions may re-enter. No vote brigading: sockpuppet votes get pruned and repeat offenders' entries are dropped. Maintainer merge is light curation, not gatekeeping — banter encouraged, malice not.

## How it works

```
entries/*.json ──▶ scripts/tally.js ──▶ data/leaderboard.json ──▶ index.html (Pages)
                        │
                        ├── opens a voting issue per entry (label: vote)
                        ├── counts 👍 reactions (self/bots/young accounts filtered)
                        └── snapshots stars at entry → ranks stars gained since
```

One workflow ([`factory.yml`](.github/workflows/factory.yml)) runs on push, nightly, and on demand. No secrets to configure — the default `GITHUB_TOKEN` does everything.

## Credits

Built with **Claude Fable 5** in a single [Cowork](https://claude.com) session — spec to shipped. MIT licensed. 🏆
