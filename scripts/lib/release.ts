// The files a release attaches, and the checks they must pass first
// (docs/schema.md, "Releases"). Pure apart from reading `dir`.
import { type Dirent, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";

/** A file to attach: `file` on disk, attached under the asset `name`. */
export type Asset = { file: string; name: string };
export type Assets = { assets: Asset[]; problems: string[] };

/** A title table's path under dist/tc-mobile/: titles/<lang>/<BOOK>.json. */
const LANGUAGE_TAG = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const BOOK = /^[0-9A-Z]{3}$/;
/** Characters an asset name may not hold (see the end of checkAssets). */
const UNSAFE_NAME = /[\t\r\n#]/;

const isObject = (v: unknown): boolean =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * A title table's body (scripts/lib/title-table.ts, TitleTable): `chapters`
 * and `segments` are objects and there is no `source` block.
 */
const isTableBody = (t: Record<string, unknown>): boolean =>
  isObject(t.chapters) && isObject(t.segments) && !Object.hasOwn(t, "source");

/** The release asset name of a title table: `titles.<lang>.<BOOK>.json`. */
export const titleAssetName = (language: string, book: string): string =>
  `titles.${language}.${book}.json`;

/**
 * What `dir` (dist/tc-mobile/) attaches for `tag`, sorted by asset name,
 * and what stops it, one message per problem; the release goes ahead only
 * when `problems` is empty.
 *
 * - Release assets are flat. A package `<BOOK>.json` is attached under its
 *   own name. A title table `titles/<lang>/<BOOK>.json` shares its
 *   package's file name, so it is attached as `titles.<lang>.<BOOK>.json`
 *   (decided by the maintainer, #61). Any other nested file, or a nested
 *   entry that is not a regular file, stops the release rather than being
 *   left out silently.
 * - The top level holds only regular `.json` files (the packages), the
 *   regular file `.gitkeep` that keeps the directory in git, and
 *   directories (whose nested files are checked as above). Anything else, a
 *   symlink or a directory named `x.json` included, would be neither
 *   checked nor attached, so it is reported.
 * - There is at least one package.
 * - Every package's `source.revision` is the tag: a file built without
 *   RELEASE_TAG says "unreleased", and must never be attached.
 * - A title table has no `source` (scripts/lib/title-table.ts), so
 *   RELEASE_TAG does not reach it and it carries no revision to check.
 *   What ties it to the release is its package: the table's `packageId` and
 *   `version` must equal the `id` and `version` of `<BOOK>.json`, a package
 *   in this release (whose revision is checked), and its `language` must
 *   be the `<lang>` it sits under. Its body must be a table's:
 *   `chapters` and `segments` objects and no `source`. When `<BOOK>.json`
 *   is present but not a JSON object, the table says the package failed
 *   validation rather than that it is missing.
 * - No asset name holds a tab, CR, LF or `#` (run.sh and `gh` would misread
 *   it).
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
  const problems: string[] = [];
  const tables: { file: string; language: string; book: string }[] = [];
  for (const e of below) {
    if (!e.isFile()) {
      problems.push(`${at(e)}: nested ${kind(e)} is not a regular file`);
      continue;
    }
    const parts = at(e).split(sep);
    const [titles, language = "", name = ""] = parts;
    const book = name.replace(/\.json$/, "");
    if (
      parts.length === 3 &&
      titles === "titles" &&
      LANGUAGE_TAG.test(language) &&
      name === `${book}.json` &&
      BOOK.test(book)
    )
      tables.push({ file: join(e.parentPath, e.name), language, book });
    else problems.push(`${at(e)}: nested file has no release asset name`);
  }
  problems.sort();
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
  const read = (file: string): Record<string, unknown> | null => {
    try {
      const value: unknown = JSON.parse(readFileSync(file, "utf8"));
      if (isObject(value)) return value as Record<string, unknown>;
      problems.push(`${relative(dir, file)}: not a JSON object`);
    } catch (e) {
      problems.push(`${relative(dir, file)}: not JSON (${String(e)})`);
    }
    return null;
  };
  const packages = new Map<string, Record<string, unknown>>();
  // Present but not a JSON object: its own problem is already reported.
  const invalid = new Set<string>();
  for (const file of files) {
    const pkg = read(file);
    if (pkg === null) {
      invalid.add(basename(file));
      continue;
    }
    packages.set(basename(file), pkg);
    const revision = (pkg.source as { revision?: unknown } | undefined)
      ?.revision;
    if (revision !== tag) {
      problems.push(
        `${relative(dir, file)}: source.revision is ${JSON.stringify(revision)}, not "${tag}"`
      );
    }
  }
  const assets: Asset[] = files.map((file) => ({
    file,
    name: basename(file),
  }));
  const byName = (a: { name: string }, b: { name: string }) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  const named = tables
    .map((t) => ({ ...t, name: titleAssetName(t.language, t.book) }))
    .sort(byName);
  for (const { file, language, book, name } of named) {
    const where = relative(dir, file);
    const table = read(file);
    if (table === null) continue;
    const pkg = packages.get(`${book}.json`);
    if (pkg === undefined) {
      problems.push(
        invalid.has(`${book}.json`)
          ? `${where}: package ${book}.json failed validation`
          : `${where}: no package ${book}.json in this release`
      );
      continue;
    }
    if (!isTableBody(table))
      problems.push(
        `${where}: body must have object chapters and segments, and no source`
      );
    for (const [field, want] of [
      ["packageId", pkg.id],
      ["version", pkg.version],
      ["language", language],
    ] as const) {
      if (table[field] !== want || typeof want !== "string")
        problems.push(
          `${where}: ${field} is ${JSON.stringify(table[field])}, not ${JSON.stringify(want)}` +
            (field === "language"
              ? ""
              : ` (${book}.json's ${field === "packageId" ? "id" : field})`)
        );
    }
    assets.push({ file, name });
  }
  assets.sort(byName);
  // A top-level file named like a title table's asset would be overwritten.
  for (let i = 1; i < assets.length; i++)
    if (assets[i]!.name === assets[i - 1]!.name)
      problems.push(`${assets[i]!.name}: two files share this asset name`);
  // run.sh splits "<name><TAB><file>" lines and `gh release create` reads
  // "file#label", so these characters would split a line or become a label.
  for (const { name } of assets)
    if (UNSAFE_NAME.test(name))
      problems.push(
        `${JSON.stringify(name)}: asset name contains a tab, CR, LF or "#"`
      );
  return { assets, problems };
}
