// The files a release attaches, and the checks they must pass first
// (docs/schema.md, "Releases"). Pure apart from reading `dir`.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

export type Assets = { files: string[]; problems: string[] };

/**
 * The top-level `.json` packages in `dir` (dist/tc-mobile/), sorted, and
 * what stops them being attached for `tag`, one message per problem; the
 * release goes ahead only when `problems` is empty.
 *
 * - Release assets are flat. Title tables (titles/<lang>/<BOOK>.json) share
 *   their package's file name, so a nested file stops the release until
 *   their asset names are decided, rather than being left out silently.
 * - There is at least one package.
 * - Every package's `source.revision` is the tag: a file built without
 *   RELEASE_TAG says "unreleased", and must never be attached.
 */
export function checkAssets(dir: string, tag: string): Assets {
  const entries = readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith(".json"))
    .map((e) => join(e.parentPath, e.name));
  const files = entries.filter((f) => !relative(dir, f).includes("/")).sort();
  const problems = entries
    .filter((f) => relative(dir, f).includes("/"))
    .sort()
    .map(
      (f) => `${relative(dir, f)}: nested file has no release asset name yet`
    );
  if (files.length === 0) problems.push(`${dir} has no packages`);
  for (const file of files) {
    let revision: unknown;
    try {
      const pkg = JSON.parse(readFileSync(file, "utf8")) as {
        source?: { revision?: unknown };
      };
      revision = pkg.source?.revision;
    } catch (e) {
      problems.push(`${relative(dir, file)}: not JSON (${String(e)})`);
      continue;
    }
    if (revision !== tag) {
      problems.push(
        `${relative(dir, file)}: source.revision is ${JSON.stringify(revision)}, not "${tag}"`
      );
    }
  }
  return { files, problems };
}
