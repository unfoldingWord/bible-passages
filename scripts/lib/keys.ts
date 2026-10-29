// Key stability across releases. A released key never disappears unless it
// is recorded as retired and never changes its span. A retired key may be
// live again only for the span it spells (docs/decisions/0001; tc-mobile
// contract, "Keys").
//
// checkKeys is pure. The rest reads a release from its git tag: the tag holds
// data/structure/ (pericopes and segments, with spans) and
// data/retired-keys.json, which the release's attached dist/ files do not
// (they carry segments only), and git needs no network or token.
import { execFileSync } from "node:child_process";
import type { Ref, Structure } from "./structure.ts";

export type Spans = Map<string, { start: Ref; end: Ref }>;
export type Retired = { key: string; successor: string }[];
export type Release = { spans: Spans; retired: Retired };

/** Every pericope and segment key with its span. */
export function spans(structures: Structure[]): Spans {
  const out: Spans = new Map();
  for (const s of structures) {
    for (const { key, start, end } of [...s.pericopes, ...s.segments]) {
      out.set(key, { start, end });
    }
  }
  return out;
}

const same = (a: Ref, b: Ref) => a[0] === b[0] && a[1] === b[1];
/** Whether `key` (`<BOOK>.<c>.<v>-<v>` or `<BOOK>.P.<c>.<v>-<v>`) spells `s`. */
const names = (key: string, s: { start: Ref; end: Ref }) => {
  const m = /\.(\d+)\.(\d+)-(\d+)$/.exec(key);
  return (
    !!m &&
    s.start[0] === Number(m[1]) &&
    s.end[0] === Number(m[1]) &&
    s.start[1] === Number(m[2]) &&
    s.end[1] === Number(m[3])
  );
};
const span = ({ start, end }: { start: Ref; end: Ref }) =>
  `${start.join(":")}-${end.join(":")}`;

/**
 * What breaks key stability between `previous`, a release, and now, one message
 * per problem; empty when nothing does. With no earlier release there is
 * nothing to compare, but the retired-keys record is still checked.
 */
export function checkKeys(
  previous: Release | null,
  current: Release
): string[] {
  const problems: string[] = [];
  // The record is an append-only log; the latest row for a key is in force
  // (a revived key retired again gets a new row; decisions/0001).
  const retired = new Map<string, string>();
  for (const { key, successor } of current.retired) {
    retired.set(key, successor);
  }

  for (const [key, successor] of retired) {
    // A key is its span (docs/decisions/0001): a retired span that is live
    // again is live under the same key, and its retirement is history. It
    // must still name that span.
    const live = current.spans.get(key);
    if (live) {
      if (!names(key, live)) {
        problems.push(
          `${key} is retired and used again for ${span(live)}, a different span`
        );
      }
      continue;
    }
    // Follow the chain: a successor may itself be retired later. A live key
    // ends the walk; its own retirement row is history (decisions/0001).
    const seen = new Set([key]);
    let next = successor;
    while (retired.has(next) && !current.spans.has(next) && !seen.has(next)) {
      seen.add(next);
      next = retired.get(next) ?? next;
    }
    if (seen.has(next)) {
      problems.push(`${key}: its successors loop back to ${next}`);
    } else if (!current.spans.has(next)) {
      problems.push(`${key}: successor ${next} is not a current key`);
    }
  }

  if (!previous) return problems;

  // Append-only: the released record must be a prefix of the current one.
  // Report the first row that differs; every later row shifts with it.
  const changed = previous.retired.findIndex(({ key, successor }, i) => {
    const now = current.retired[i];
    return now?.key !== key || now.successor !== successor;
  });
  const first = previous.retired[changed];
  if (first) {
    problems.push(
      `${first.key}: its retirement record (successor ${first.successor}) was removed or changed`
    );
  }
  for (const [key, was] of previous.spans) {
    const now = current.spans.get(key);
    if (!now) {
      if (!retired.has(key)) {
        problems.push(
          `${key} was released and is missing, with no record in data/retired-keys.json`
        );
      }
    } else if (!same(was.start, now.start) || !same(was.end, now.end)) {
      problems.push(`${key} moved from ${span(was)} to ${span(now)}`);
    }
  }
  return problems;
}

/** Release tags are exactly `vX.Y.Z`. */
export const TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/**
 * The most recent release tag among `tags` by version, leaving out
 * `exclude` (the tag being released, so a release is checked against the
 * one before it). Tags that are not `vX.Y.Z` are ignored.
 */
export function lastTag(tags: string[], exclude?: string): string | null {
  const versions = tags.flatMap((tag) => {
    const m = TAG.exec(tag);
    return m && tag !== exclude
      ? [{ tag, v: [Number(m[1]), Number(m[2]), Number(m[3])] }]
      : [];
  });
  const order = (a: number[], b: number[]) =>
    (a[0] ?? 0) - (b[0] ?? 0) ||
    (a[1] ?? 0) - (b[1] ?? 0) ||
    (a[2] ?? 0) - (b[2] ?? 0);
  versions.sort((a, b) => order(a.v, b.v));
  return versions.at(-1)?.tag ?? null;
}

const git = (cwd: string, args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 1 << 28 });

/** The repository's tags. Refuses a shallow clone, which may lack them. */
export function gitTags(cwd: string): string[] {
  if (git(cwd, ["rev-parse", "--is-shallow-repository"]).trim() === "true") {
    throw new Error(
      "shallow clone: release tags may be missing; fetch full history (fetch-depth: 0)"
    );
  }
  return git(cwd, ["tag", "--list"]).split("\n").filter(Boolean);
}

/** `package.json`'s version at `tag`, or null when there is none. */
function versionAt(cwd: string, tag: string): string | null {
  try {
    const pkg = JSON.parse(
      git(cwd, ["show", `refs/tags/${tag}:package.json`])
    ) as { version?: unknown };
    return typeof pkg.version === "string" ? pkg.version : null;
  } catch {
    return null;
  }
}

/**
 * The tags that are releases as the release workflow defines them:
 * `vX.Y.Z`, in the history of `main` (`origin/main`, or `HEAD` in a clone
 * without it) and naming the `package.json` version of their commit. A tag
 * the workflow would refuse is never the baseline. Refuses a shallow clone.
 */
export function releaseTags(cwd: string, main?: string): string[] {
  const all = gitTags(cwd);
  let ref = main;
  if (!ref) {
    try {
      git(cwd, [
        "rev-parse",
        "--verify",
        "--quiet",
        "refs/remotes/origin/main",
      ]);
      ref = "refs/remotes/origin/main";
    } catch {
      ref = "HEAD";
    }
  }
  const merged = new Set(
    git(cwd, ["tag", "--list", "--merged", ref]).split("\n")
  );
  return all.filter(
    (tag) =>
      TAG.test(tag) && merged.has(tag) && versionAt(cwd, tag) === tag.slice(1)
  );
}

/** data/structure/ and data/retired-keys.json as they were at `tag`. */
export function readRelease(cwd: string, tag: string): Release {
  const ref = `refs/tags/${tag}`;
  const read = (path: string) =>
    JSON.parse(git(cwd, ["show", `${ref}:${path}`])) as unknown;
  const structures = git(cwd, [
    "ls-tree",
    "--name-only",
    ref,
    "data/structure/",
  ])
    .split("\n")
    .filter((f) => f.endsWith(".json"))
    .map((f) => read(f) as Structure);
  const hasRecord = git(cwd, [
    "ls-tree",
    "--name-only",
    ref,
    "data/retired-keys.json",
  ]).trim();
  const retired = hasRecord
    ? (read("data/retired-keys.json") as { retired: Retired }).retired
    : [];
  return { spans: spans(structures), retired };
}

/**
 * checkKeys against every release tag (see releaseTags) except `exclude`,
 * the tag being released; with no release, against none. Every tag, not
 * only the last: a tag that failed this check can stay on main, and taking
 * it alone as the baseline would hide the keys it dropped. Each problem
 * names the tag it was found against.
 */
export function checkHistory(
  cwd: string,
  current: Release,
  exclude?: string
): string[] {
  const tags = releaseTags(cwd).filter((tag) => tag !== exclude);
  if (tags.length === 0) return checkKeys(null, current);
  return tags.flatMap((tag) =>
    checkKeys(readRelease(cwd, tag), current).map((p) => `${tag}: ${p}`)
  );
}
