#!/usr/bin/env node
/**
 * Fable Factory tally engine.
 *
 * Runs in GitHub Actions (nightly + on push) or locally.
 *  1. Ensures every entry has a voting issue (creates one, writes the number back).
 *  2. Snapshots stargazer count at entry time for repo-backed entries.
 *  3. Counts 👍 reactions on each voting issue — excluding self-votes, bots,
 *     and accounts younger than minVoterAccountAgeDays.
 *  4. Computes the Crowd board (votes) and Stars board (stars gained since entry).
 *  5. Writes data/leaderboard.json for the static page.
 *
 * Env:
 *   GITHUB_TOKEN        — provided by Actions; needed for issue creation + API headroom
 *   GITHUB_REPOSITORY   — owner/repo; falls back to factory.config.json "repo"
 *   DRY_RUN=1           — no network at all; zero scores (useful for first render / local dev)
 *
 * Zero dependencies. Node 18+.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const API = "https://api.github.com";
const DRY = process.env.DRY_RUN === "1";
const TOKEN = process.env.GITHUB_TOKEN || "";

const config = readJson(path.join(ROOT, "factory.config.json"));
const REPO_FULL = process.env.GITHUB_REPOSITORY || config.repo; // "owner/repo"
const [OWNER, REPO] = REPO_FULL.split("/");
const PAGES_URL = `https://${OWNER.toLowerCase()}.github.io/${REPO}/`;
const MIN_AGE_DAYS = Number(config.minVoterAccountAgeDays ?? 30);
const COUNTED = new Set(config.countedReactions ?? ["+1"]);
const EXCLUDE_BOTS = config.excludeBots !== false;

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}

async function gh(pathname, init = {}) {
  const res = await fetch(API + pathname, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "fable-factory-tally",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`GitHub ${init.method || "GET"} ${pathname} → ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function paginate(pathname) {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const sep = pathname.includes("?") ? "&" : "?";
    const batch = await gh(`${pathname}${sep}per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

function loadEntries() {
  const dir = path.join(ROOT, "entries");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => {
      const slug = f.replace(/\.json$/, "");
      const entry = readJson(path.join(dir, f));
      return { slug, file: path.join(dir, f), entry };
    })
    .filter(({ slug, entry }) => {
      const ok = entry.project && entry.builder && entry.oneLiner;
      if (!ok) console.warn(`⚠️  entries/${slug}.json missing required fields — skipped`);
      return ok;
    });
}

function parseGithubRepo(url) {
  const m = /^https:\/\/github\.com\/([^/]+)\/([^/#?]+)/.exec(url || "");
  return m ? { owner: m[1], name: m[2].replace(/\.git$/, "") } : null;
}

async function ensureVoteLabel() {
  try {
    await gh(`/repos/${OWNER}/${REPO}/labels`, {
      method: "POST",
      body: JSON.stringify({ name: "vote", color: "e3b341", description: "🗳️ React with 👍 on the issue body to vote" }),
    });
  } catch (e) {
    if (e.status !== 422) console.warn(`label: ${e.message}`); // 422 = already exists
  }
}

async function ensureVotingIssue(slug, entry) {
  if (entry.voteIssue || DRY) return false;
  const lines = [
    `**${entry.project}** by @${entry.builder}`,
    "",
    entry.oneLiner,
    "",
    [entry.repo && `📦 [Repo](${entry.repo})`, entry.demo && `🔗 [Demo](${entry.demo})`].filter(Boolean).join(" · "),
    "",
    "---",
    "",
    "🗳️ **React to THIS post with 👍 to vote.**",
    "",
    `One vote per account · your own vote doesn't count · accounts younger than ${MIN_AGE_DAYS} days are filtered · tallied nightly → [standings](${PAGES_URL})`,
  ];
  const issue = await gh(`/repos/${OWNER}/${REPO}/issues`, {
    method: "POST",
    body: JSON.stringify({
      title: `🗳️ Vote: ${entry.project} — @${entry.builder}`,
      body: lines.join("\n"),
      labels: ["vote"],
    }),
  });
  entry.voteIssue = issue.number;
  console.log(`🆕 voting issue #${issue.number} for ${slug}`);
  return true;
}

const userAgeCache = new Map();
async function accountOldEnough(login) {
  if (MIN_AGE_DAYS <= 0) return true;
  if (!userAgeCache.has(login)) {
    try {
      const u = await gh(`/users/${encodeURIComponent(login)}`);
      const ageDays = (Date.now() - new Date(u.created_at).getTime()) / 86400000;
      userAgeCache.set(login, ageDays >= MIN_AGE_DAYS);
    } catch (e) {
      console.warn(`age check ${login}: ${e.message} — counting vote`);
      userAgeCache.set(login, true); // fail open on lookup errors
    }
  }
  return userAgeCache.get(login);
}

async function countVotes(entry) {
  if (DRY || !entry.voteIssue) return { votes: 0, votesRaw: 0 };
  const reactions = await paginate(`/repos/${OWNER}/${REPO}/issues/${entry.voteIssue}/reactions`);
  const counted = reactions.filter((r) => COUNTED.has(r.content) && r.user);
  let votes = 0;
  for (const r of counted) {
    const login = r.user.login;
    if (login.toLowerCase() === String(entry.builder).toLowerCase()) continue; // self-vote
    if (EXCLUDE_BOTS && (r.user.type === "Bot" || /\[bot\]$/i.test(login))) continue;
    if (!(await accountOldEnough(login))) continue;
    votes++;
  }
  return { votes, votesRaw: counted.length };
}

const repoCache = new Map();
async function starCount(repoUrl) {
  const r = parseGithubRepo(repoUrl);
  if (!r || DRY) return null;
  const key = `${r.owner}/${r.name}`;
  if (!repoCache.has(key)) {
    try {
      const data = await gh(`/repos/${key}`);
      repoCache.set(key, data.stargazers_count ?? 0);
    } catch (e) {
      console.warn(`stars ${key}: ${e.message}`);
      repoCache.set(key, null);
    }
  }
  return repoCache.get(key);
}

(async () => {
  const items = loadEntries();
  console.log(`🏭 Fable Factory tally — ${items.length} entr${items.length === 1 ? "y" : "ies"}${DRY ? " (dry run)" : ""}`);
  if (!DRY) await ensureVoteLabel().catch(() => {});

  for (const it of items) {
    let dirty = false;
    try {
      dirty = (await ensureVotingIssue(it.slug, it.entry)) || dirty;
    } catch (e) {
      console.warn(`issue ${it.slug}: ${e.message}`);
    }
    const starsNow = await starCount(it.entry.repo);
    if (starsNow !== null && (it.entry.starsAtEntry === null || it.entry.starsAtEntry === undefined)) {
      it.entry.starsAtEntry = starsNow; // snapshot at first successful tally after merge
      dirty = true;
      console.log(`⭐ snapshot ${it.slug}: ${starsNow} stars at entry`);
    }
    let votes = 0, votesRaw = 0;
    try {
      ({ votes, votesRaw } = await countVotes(it.entry));
    } catch (e) {
      console.warn(`votes ${it.slug}: ${e.message}`);
    }
    it.computed = {
      votes,
      votesRaw,
      starsNow,
      starsGained: starsNow !== null && it.entry.starsAtEntry != null ? Math.max(0, starsNow - it.entry.starsAtEntry) : null,
    };
    if (dirty) writeJson(it.file, it.entry);
  }

  const byDateThenSlug = (a, b) =>
    String(a.entry.enteredAt || "9999").localeCompare(String(b.entry.enteredAt || "9999")) || a.slug.localeCompare(b.slug);

  const crowd = [...items].sort((a, b) => b.computed.votes - a.computed.votes || byDateThenSlug(a, b));
  crowd.forEach((it, i) => (it.computed.crowdRank = i + 1));

  const starrable = items.filter((it) => it.computed.starsGained !== null);
  starrable.sort((a, b) => b.computed.starsGained - a.computed.starsGained || byDateThenSlug(a, b));
  starrable.forEach((it, i) => (it.computed.starsRank = i + 1));

  const board = {
    generatedAt: new Date().toISOString(),
    repo: `${OWNER}/${REPO}`,
    pagesUrl: PAGES_URL,
    config: {
      title: config.title,
      tagline: config.tagline,
      cupName: config.cupName,
      minVoterAccountAgeDays: MIN_AGE_DAYS,
    },
    entries: crowd.map((it) => ({
      slug: it.slug,
      project: it.entry.project,
      builder: it.entry.builder,
      oneLiner: it.entry.oneLiner,
      builtWith: it.entry.builtWith || null,
      repo: it.entry.repo || null,
      demo: it.entry.demo || null,
      screenshot: it.entry.screenshot || null,
      crew: it.entry.crew || null,
      enteredAt: it.entry.enteredAt || null,
      voteIssue: it.entry.voteIssue || null,
      ...it.computed,
    })),
  };

  const dataDir = path.join(ROOT, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  writeJson(path.join(dataDir, "leaderboard.json"), board);

  const champ = crowd[0];
  console.log(
    champ
      ? `🏆 ${config.cupName}: ${champ.entry.project} (@${champ.entry.builder}) with ${champ.computed.votes} vote${champ.computed.votes === 1 ? "" : "s"}`
      : "🏭 No entries yet."
  );
  console.log(`✅ wrote data/leaderboard.json`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
