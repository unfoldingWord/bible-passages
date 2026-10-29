// The files a release attaches, and the checks they must pass first
// (docs/schema.md, "Releases"). Pure apart from reading `dir`.
import { type Dirent, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export type Assets = { files: string[]; problems: string[] };

/**
 * The top-level `.json` packages in `dir` (dist/tc-mobile/), sorted, and
 * what stops them being attached for `tag`, one message per problem; the
 * release goes ahead only when `problems` is empty.
 *
 * - Release assets are flat. Title tables (titles/<lang>/<BOOK>.json) share
 *   their package's file name, so a nested file stops the release until
 *   their asset names are decided, rather than being left out silently.
 * - The top level holds only regular `.json` files (the packages), the
 *   regular file `.gitkeep` that keeps the directory in git, and
 *   directories (whose nested files are reported above, as is any nested
 *   entry that is not a regular file). Anything else, a
 *   symlink or a directory named `x.json` included, would be neither
 *   checked nor attached, so it is reported.
 * - There is at least one package.
 * - Every package's `source.revision` is the tag: a file built without
 *   RELEASE_TAG says "unreleased", and must never be attached.
 */
const kind = (e: Dirent) =>
  e.isDirectory() ? "directory" : e.isSymbolicLink() ? "symlink" : "entry";

export function checkAssets(dir: string, tag: string): Assets {
  // Nested by parent directory, not by a "/" in the path: win32 joins
  // with "\", and there a nested file would be in neither list.
  const below = readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => resolve(e.parentPath) !== resolve(dir))
    .filter((e) => !e.isDirectory());
  const at = (e: Dirent) => relative(dir, join(e.parentPath, e.name));
  const problems = [
    ...below
      .filter((e) => e.isFile() && e.name.endsWith(".json"))
      .map((e) => `${at(e)}: nested file has no release asset name yet`),
    // A nested symlink or other non-regular entry would otherwise slip past
    // the nested-file stop: neither attached nor checked nor reported.
    ...below
      .filter((e) => !e.isFile())
      .map((e) => `${at(e)}: nested ${kind(e)} is not a regular file`),
  ].sort();
  const files: string[] = [];
  const top = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  );
  for (const e of top) {
    const json = e.name.endsWith(".json");
    if (e.isFile() && json) files.push(join(dir, e.name));
    else if (e.isFile() && e.name === ".gitkeep") continue;
    else if (e.isDirectory() && !json) continue;
    else if (e.isFile())
      problems.push(`${e.name}: top-level file is not a .json package`);
    else problems.push(`${e.name}: top-level ${kind(e)} is not a regular file`);
  }
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
