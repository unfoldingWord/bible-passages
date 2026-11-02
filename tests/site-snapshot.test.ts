import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// scripts/site/snapshot.mjs must read every page of a list. The script runs
// as it does in production, with fetch replaced before it loads: no network.
// The issues list comes in two pages, joined by the Link header GitHub sends.
const script = new URL("../scripts/site/snapshot.mjs", import.meta.url);
const API = "https://api.github.com";
const REPO = "repos/unfoldingWord/bible-passages";

const stub = `
const API = ${JSON.stringify(API)};
const REPO = ${JSON.stringify(REPO)};
const issue = (number, state) => ({ number, title: "Issue " + number, state,
  milestone: null, closed_at: null });
const page1 = Array.from({ length: 100 }, (_, i) =>
  issue(i + 1, i % 2 ? "closed" : "open"));
page1[0] = { ...page1[0], pull_request: {} };
const page2 = [issue(101, "open"), issue(102, "closed")];
const next = API + "/repositories/1/issues?state=all&per_page=100&page=2";
const routes = {
  [API + "/" + REPO]: [{ pushed_at: "t", default_branch: "main",
    open_issues_count: 0 }],
  [API + "/" + REPO + "/pulls?state=all&per_page=100"]: [[]],
  [API + "/" + REPO + "/issues?state=all&per_page=100"]: [page1,
    '<' + next + '>; rel="next", <' + next + '>; rel="last"'],
  // LOOP=1 makes the last page point back at the first.
  [next]: [page2, '<' + API + "/" + REPO + '/issues?state=all&per_page=100>; ' +
    (process.env.LOOP ? 'rel="next"' : 'rel="first"')],
  [API + "/" + REPO + "/milestones?state=all&per_page=100"]: [[]],
  [API + "/" + REPO + "/actions/runs?per_page=20"]: [{ workflow_runs: [] }],
  [API + "/" + REPO + "/commits?per_page=15"]: [[]],
  [API + "/" + REPO + "/git/trees/main?recursive=1"]: [{ tree: [],
    truncated: false }],
  [API + "/repos/unfoldingWord/servant.bible/issues/1"]: [{ state: "open",
    assignees: [] }],
  [API + "/repos/unfoldingWord/servant.bible/issues/1/comments?per_page=100"]:
    [[]],
  [API + "/repos/unfoldingWord/tc-mobile/issues/1459"]: [{ state: "open",
    milestone: null }],
};
globalThis.fetch = async (url) => {
  const route = routes[url];
  if (!route) return new Response("{}", { status: 404 });
  const [body, link] = route;
  return new Response(JSON.stringify(body), {
    headers: link ? { link } : {},
  });
};
`;

interface Issue {
  number: number;
  state: string;
}

function run(env: Record<string, string> = {}): { issues: Issue[] } {
  const dir = mkdtempSync(join(tmpdir(), "bp-snapshot-"));
  const preload = join(dir, "stub.mjs");
  writeFileSync(preload, stub);
  const { GITHUB_TOKEN: _, ...rest } = process.env;
  const out = execFileSync(
    process.execPath,
    ["--import", preload, fileURLToPath(script)],
    { env: { ...rest, ...env }, stdio: ["ignore", "pipe", "pipe"] }
  );
  return JSON.parse(out.toString());
}

describe("site snapshot paging", () => {
  const snapshot = run();

  it("reads both pages of issues", () => {
    const numbers = snapshot.issues.map((i) => i.number);
    // 102 items over two pages, less the one pull request.
    expect(numbers).toHaveLength(101);
    expect(numbers).toContain(101);
    expect(numbers).toContain(102);
    expect(numbers).not.toContain(1);
  });

  it("counts open issues across pages", () => {
    const open = snapshot.issues.filter((i) => i.state === "open");
    // Page 1: odd numbers 3..99 are open (49; #1 is a pull request).
    // Page 2: #101.
    expect(open).toHaveLength(50);
  });

  it("stops rather than loop when a next link repeats", () => {
    expect(() => run({ LOOP: "1" })).toThrow(/pagination repeats/);
  });
});
