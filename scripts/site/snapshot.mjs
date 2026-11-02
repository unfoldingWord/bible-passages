// Builds the project site's live snapshot ("bp.snapshot" v1) from GitHub's
// REST API and prints it as JSON. GraphQL is avoided on purpose: cloud
// routines block it. GITHUB_TOKEN is optional; the repos read are public.
//
//   node scripts/site/snapshot.mjs > site/snapshot.json

const API = "https://api.github.com";
const REPO = "unfoldingWord/bible-passages";
const LANGS = [
  "en",
  "ar",
  "fr",
  "hi",
  "id",
  "zh-Hans",
  "pt-BR",
  "ru",
  "es-419",
  "sw",
];

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "bible-passages-site",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
};

// A token the API rejects (401) is dropped and the request retried without
// it: some sandboxes export a GITHUB_TOKEN that only works through a proxy.
// Redirects are refused, not followed: a 3xx would reach a URL that the
// host check in getAll never saw.
async function request(url) {
  const send = async (h) => {
    try {
      return await fetch(url, { headers: h, redirect: "error" });
    } catch (e) {
      throw new Error(`GET ${url}: ${e.cause?.message ?? e.message}`);
    }
  };
  let res = await send(headers);
  if (res.status === 401 && headers.Authorization) {
    const { Authorization, ...anonymous } = headers;
    res = await send(anonymous);
  }
  if (!res.ok) throw new Error(`GET ${url}: ${res.status}`);
  return res;
}

async function get(path) {
  return (await request(`${API}/${path}`)).json();
}

// A Link header (RFC 8288, section 3) is a list of link-values: a URL in
// angle brackets, then parameters, each value a token or a quoted string.
const LINK_VALUE =
  /\s*<([^>]*)>((?:\s*;\s*[^\s=;,]+(?:\s*=\s*(?:"(?:[^"\\]|\\.)*"|[^\s";,]*))?)*)\s*(?:,|$)/y;
const PARAM =
  /;\s*([^\s=;,]+)(?:\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^\s";,]*)))?/g;

// The URL of the first link whose relation types include "next", or
// undefined when there is none. A rel value holds relation types separated
// by spaces, compared without case; only a link's first rel counts (RFC 8288,
// section 3.3). A header that does not parse throws if it says "next"
// anywhere, rather than end the list early.
function nextLink(header, path) {
  LINK_VALUE.lastIndex = 0;
  while (/\S/.test(header.slice(LINK_VALUE.lastIndex))) {
    const at = LINK_VALUE.lastIndex;
    const m = LINK_VALUE.exec(header);
    if (!m) {
      if (/next/i.test(header.slice(at))) {
        throw new Error(
          `GET ${path}: Link names a next page it cannot read: ${header}`
        );
      }
      return undefined;
    }
    const rel = [...m[2].matchAll(PARAM)].find(
      (p) => p[1].toLowerCase() === "rel"
    );
    const value = rel ? (rel[2]?.replace(/\\(.)/g, "$1") ?? rel[3] ?? "") : "";
    if (value.toLowerCase().split(/\s+/).includes("next")) return m[1];
  }
  return undefined;
}

// A list read in full: every page, following the Link header's next link
// until there is none. A partial list would show as if it were complete
// (on 30 Oct a one-page read showed 17 open issues where GitHub had 30).
// Only api.github.com links are followed. The run stops, rather than return
// a partial list, when a link is seen twice, when a Link header that does
// not parse mentions a next page, or after MAX_PAGES pages.
// 100 pages of 100 is 10,000 items. The longest list, issues with pull
// requests, held 169 items on 2 Nov 2026, measured with
// gh api -X GET search/issues -f q='repo:unfoldingWord/bible-passages'
// (total_count; 81 issues and 88 pull requests), so 2 pages.
const MAX_PAGES = 100;

async function getAll(path) {
  const all = [];
  const seen = new Set();
  let url = `${API}/${path}`;
  while (url) {
    if (seen.has(url)) throw new Error(`GET ${url}: pagination repeats`);
    if (seen.size === MAX_PAGES) {
      throw new Error(`GET ${path}: more than ${MAX_PAGES} pages`);
    }
    seen.add(url);
    const res = await request(url);
    const page = await res.json();
    if (!Array.isArray(page)) throw new Error(`GET ${url}: not a list`);
    all.push(...page);
    const link = res.headers.get("link") ?? "";
    url = nextLink(link, path);
    if (url && !url.startsWith(`${API}/`)) {
      throw new Error(`GET ${path}: next page outside ${API}: ${url}`);
    }
  }
  return all;
}

const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));

const [repo, pulls, issues, milestones, runs, commits] = await Promise.all([
  get(`repos/${REPO}`),
  getAll(`repos/${REPO}/pulls?state=all&per_page=100`),
  getAll(`repos/${REPO}/issues?state=all&per_page=100`),
  getAll(`repos/${REPO}/milestones?state=all&per_page=100`),
  // The latest runs and commits only, by design: the page shows recent ones.
  get(`repos/${REPO}/actions/runs?per_page=20`),
  get(`repos/${REPO}/commits?per_page=15`),
]);

// Coverage: which books have structure, and which languages have titles,
// on the default branch. Empty until the first data PR merges.
// An empty repository has no tree (409); any other failure stops the run.
const tree = await get(
  `repos/${REPO}/git/trees/${repo.default_branch}?recursive=1`
).catch((e) => {
  if (/: 409$/.test(e.message)) return { tree: [], truncated: false };
  throw e;
});
if (tree.truncated) throw new Error("git tree truncated; coverage would be partial");
const paths = tree.tree.map((t) => t.path);
const books = (re) =>
  paths.flatMap((p) => {
    const m = re.exec(p);
    return m ? [m[1]] : [];
  });
const structure = books(/^data\/structure\/([1-3A-Z]{3})\.json$/);
const titles = Object.fromEntries(
  LANGS.map((l) => [
    l,
    books(new RegExp(`^data/titles/${l.replace(/[-]/g, "\\-")}/([1-3A-Z]{3})\\.json$`)),
  ])
);

const [s1, s1comments, tcm] = await Promise.all([
  get("repos/unfoldingWord/servant.bible/issues/1"),
  getAll("repos/unfoldingWord/servant.bible/issues/1/comments?per_page=100"),
  get("repos/unfoldingWord/tc-mobile/issues/1459"),
]);

const snapshot = {
  schema: "bp.snapshot",
  v: 1,
  asOf: new Date().toISOString(),
  repo: {
    pushedAt: repo.pushed_at,
    defaultBranch: repo.default_branch,
    openIssues: repo.open_issues_count,
  },
  commits: commits.map((c) => ({
    sha: c.sha.slice(0, 7),
    msg: c.commit.message.split("\n")[0],
    at: c.commit.committer.date,
  })),
  pulls: pulls.map((p) => ({
    ...pick(p, ["number", "title", "state", "draft"]),
    merged: Boolean(p.merged_at),
    at: p.updated_at,
  })),
  issues: issues
    .filter((i) => !i.pull_request)
    .map((i) => ({
      ...pick(i, ["number", "title", "state"]),
      milestone: i.milestone?.title ?? null,
      closedAt: i.closed_at,
    })),
  milestones: milestones.map((m) => ({
    ...pick(m, ["number", "title", "open_issues", "closed_issues", "state"]),
    due: m.due_on,
  })),
  runs: runs.workflow_runs.map((r) => ({
    sha: r.head_sha.slice(0, 7),
    branch: r.head_branch,
    conclusion: r.conclusion ?? r.status,
    at: r.created_at,
    url: r.html_url,
  })),
  coverage: { structure, titles },
  external: {
    servant1: {
      state: s1.state,
      comments: s1comments.length,
      lastCommentAt: s1comments.at(-1)?.created_at ?? null,
      assignees: s1.assignees.length,
    },
    tcm1459: {
      state: tcm.state,
      milestone: tcm.milestone?.title ?? null,
    },
  },
};

process.stdout.write(JSON.stringify(snapshot, null, 2) + "\n");
