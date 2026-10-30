// The files a release attaches, and the checks they must pass first
// (docs/schema.md, "Releases"). Pure apart from reading `dir`.
import { type Dirent, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { STRUCTURE_BOOKS } from "./books.ts";

/** A file to attach: `file` on disk, attached under the asset `name`. */
export type Asset = { file: string; name: string };
export type Assets = { assets: Asset[]; problems: string[] };

/**
 * The asset grammar is an allowlist: a package is `<BOOK>.json` and a title
 * table `titles/<lang>/<BOOK>.json`, attached as `titles.<lang>.<BOOK>.json`,
 * where `<BOOK>` is a known book code (scripts/lib/books.ts) and `<lang>`
 * matches LANGUAGE_TAG. Neither alphabet holds a tab, CR, LF or `#`, which
 * run.sh's "<name><TAB><file>" lines and `gh release create`'s
 * "file#label" would misread, and a package name cannot equal a table's.
 */
const LANGUAGE_TAG = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const isBook = (code: string): boolean => STRUCTURE_BOOKS.includes(code);
/** The book code of a package file name `<BOOK>.json`, or null. */
const packageBook = (name: string): string | null => {
  const book = name.slice(0, -".json".length);
  return name === `${book}.json` && isBook(book) ? book : null;
};

/**
 * Whether `name` is in the asset grammar: `<BOOK>.json`, or
 * `titles.<lang>.<BOOK>.json`.
 */
export const isAssetName = (name: string): boolean => {
  const table = /^titles\.([^.]*)\.([^.]*\.json)$/.exec(name);
  return table === null
    ? packageBook(name) !== null
    : LANGUAGE_TAG.test(table[1]!) && packageBook(table[2]!) !== null;
};

/**
 * Why `names`, the asset names of one release, cannot be attached: each
 * distinct name outside the grammar, and each name held by more than one
 * file (saying how many), sorted by name. Names are JSON-quoted, as they
 * may hold a tab, CR or LF. run.sh copies each file to `<stage>/<name>`,
 * so a repeated name would overwrite the first copy and attach one file
 * silently; checkAssets cannot build such a list today, and this is the
 * guard if that changes.
 */
export const assetNameProblems = (names: readonly string[]): string[] => {
  const count = new Map<string, number>();
  for (const name of names) count.set(name, (count.get(name) ?? 0) + 1);
  return [...count.keys()]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .flatMap((name) => [
      ...(isAssetName(name)
        ? []
        : [`${JSON.stringify(name)}: not a release asset name`]),
      ...(count.get(name)! > 1
        ? [
            `${JSON.stringify(name)}: ${count.get(name)} files share this asset name`,
          ]
        : []),
    ]);
};

/**
 * `message` as the data of a workflow command such as `::error::`: `%`,
 * CR and LF encoded as `%25`, `%0D` and `%0A`. The runner decodes exactly
 * these three in a command's data (actions/runner, ActionCommand.cs,
 * `_escapeDataMappings`), so an unencoded `%0A` would become a line break
 * and a raw LF would end the command. Same mapping, `%` first, as
 * `escapeData` in actions/toolkit (packages/core/src/command.ts).
 */
export const escapeCommandData = (message: string): string =>
  message.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

const isObject = (v: unknown): boolean =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Why a title table's body is not a table's (scripts/lib/title-table.ts,
 * TitleTable), one message per failing limb: `chapters` and `segments` are
 * objects and there is no `source` block.
 */
const bodyProblems = (t: Record<string, unknown>): string[] => [
  ...(["chapters", "segments"] as const)
    .filter((field) => !isObject(t[field]))
    .map((field) => `${field} is ${JSON.stringify(t[field])}, not an object`),
  ...(Object.hasOwn(t, "source")
    ? ["has a source block; a title table has none"]
    : []),
];

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
 * - The top level holds only regular files `<BOOK>.json` with a known book
 *   code (the packages), the regular file `.gitkeep` that keeps the
 *   directory in git, and directories (whose nested files are checked as
 *   above). Anything else, `ab.json`, a symlink or a directory named
 *   `x.json` included, is reported and neither read nor attached.
 * - There is at least one package.
 * - Every package's `source.revision` is the tag: a file built without
 *   RELEASE_TAG says "unreleased", and must never be attached.
 * - A title table has no `source` (scripts/lib/title-table.ts), so
 *   RELEASE_TAG does not reach it and it carries no revision to check.
 *   What ties it to the release is its package: the table's `packageId` and
 *   `version` must equal the `id` and `version` of `<BOOK>.json`, a package
 *   in this release (whose revision is checked), and its `language` must
 *   be the `<lang>` it sits under. Its body must be a table's:
 *   `chapters` and `segments` objects and no `source`, each failing limb
 *   reported on its own, and checked even when the package is missing or
 *   unreadable, so one pass lists every reason. When `<BOOK>.json` is
 *   present but unreadable (it does not parse as JSON, or parses to
 *   something other than an object), the table says the package failed
 *   validation rather than that it is missing.
 * - Every asset name is in the allowlisted grammar above, so none holds a
 *   tab, CR, LF or `#`, and no two share a name (assetNameProblems).
 * - Every name in a message is JSON-quoted where it may hold a tab, CR or
 *   LF, which would split the CLI's "::error::" line; `dir` is quoted too.
 *   The CLI also encodes each message with escapeCommandData, since a
 *   message can still hold `%` or, from JSON.parse, a raw CR or LF.
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
      problems.push(
        `${JSON.stringify(at(e))}: nested ${kind(e)} is not a regular file`
      );
      continue;
    }
    const parts = at(e).split(sep);
    const [titles, language = "", name = ""] = parts;
    const book = name.replace(/\.json$/, "");
    if (
      parts.length === 3 &&
      titles === "titles" &&
      LANGUAGE_TAG.test(language) &&
      packageBook(name) === book
    )
      tables.push({ file: join(e.parentPath, e.name), language, book });
    else
      problems.push(
        `${JSON.stringify(at(e))}: nested file has no release asset name`
      );
  }
  problems.sort();
  const files: string[] = [];
  const top = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  );
  for (const e of top) {
    if (e.isFile() && packageBook(e.name) !== null)
      files.push(join(dir, e.name));
    else if (e.isFile() && e.name === ".gitkeep") continue;
    else if (e.isDirectory() && !e.name.endsWith(".json")) continue;
    else if (e.isFile())
      problems.push(
        `${JSON.stringify(e.name)}: top-level file is not a package <BOOK>.json`
      );
    else
      problems.push(
        `${JSON.stringify(e.name)}: top-level ${kind(e)} is not a regular file`
      );
  }
  if (files.length === 0)
    problems.push(`${JSON.stringify(dir)} has no packages`);
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
  // Present but unreadable, whether it does not parse as JSON or parses to
  // a non-object; its own problem is already reported.
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
    for (const p of bodyProblems(table)) problems.push(`${where}: ${p}`);
    const pkg = packages.get(`${book}.json`);
    if (pkg === undefined) {
      problems.push(
        invalid.has(`${book}.json`)
          ? `${where}: package ${book}.json failed validation`
          : `${where}: no package ${book}.json in this release`
      );
      continue;
    }
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
  // Already true of every name built above; checked here because run.sh and
  // `gh` rely on it (tested on name lists directly).
  problems.push(...assetNameProblems(assets.map((a) => a.name)));
  return { assets, problems };
}
