// Builds the project site's live snapshot ("bp.snapshot" v1) from GitHub's
// REST API and prints it as JSON. GraphQL is avoided on purpose: cloud
// routines block it. GITHUB_TOKEN is optional; the repos read are public.
//
//   node scripts/site/snapshot.mjs > snapshot.json

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
  "es",
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
// `whole` lists must fit in one page: the snapshot fails rather than show a
// partial list as if it were complete.
async function get(path, { whole = false } = {}) {
  let res = await fetch(`${API}/${path}`, { headers });
  if (res.status === 401 && headers.Authorization) {
    const { Authorization, ...anonymous } = headers;
    res = await fetch(`${API}/${path}`, { headers: anonymous });
  }
  if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
  if (whole && /rel="next"/.test(res.headers.get("link") ?? "")) {
    throw new Error(`GET ${path}: more than one page; the snapshot would be partial`);
  }
  return res.json();
}

const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));

const [repo, pulls, issues, milestones, runs, commits] = await Promise.all([
  get(`repos/${REPO}`),
  get(`repos/${REPO}/pulls?state=all&per_page=100`, { whole: true }),
  get(`repos/${REPO}/issues?state=all&per_page=100`, { whole: true }),
  get(`repos/${REPO}/milestones?state=all&per_page=100`, { whole: true }),
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
  get("repos/unfoldingWord/servant.bible/issues/1/comments?per_page=100", {
    whole: true,
  }),
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
