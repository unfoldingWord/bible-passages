// Prints the release notes for <tag> in Markdown (scripts/lib/release-notes.ts),
// or fails with every problem: segment and pericope titles counted by status
// per language and in total from the built data/, checked against the
// title tables in dist/tc-mobile/, what the release holds and what follows,
// and the known issues from the committed known-issues.json. Called by scripts/release/run.sh after the build.
//
//   node scripts/release/notes.ts <tag>
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { STRUCTURE_BOOKS } from "../lib/books.ts";
import type { DisputedRecord } from "../lib/dispute-titles.ts";
import {
  countBook,
  distProblems,
  emptyCounts,
  addCounts,
  isSegmentMap,
  knownIssueProblems,
  renderNotes,
  shippedSegments,
  tableProblems,
  type Counts,
  type KnownIssue,
} from "../lib/release-notes.ts";
import { escapeCommandData } from "../lib/release.ts";
import type { Structure } from "../lib/structure.ts";
import type { TitleEntries } from "../lib/title-table.ts";

const tag = process.argv[2];
if (!tag) {
  console.error("usage: node scripts/release/notes.ts <tag>");
  process.exit(2);
}

const root = new URL("../../", import.meta.url);
const has = (path: string) => existsSync(new URL(path, root));
const read = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(path, root), "utf8"));

const titlesOf = (language: string, book: string): TitleEntries => {
  const path = `data/titles/${language}/${book}.json`;
  return has(path) ? (read(path) as { titles: TitleEntries }).titles : {};
};

const languages = readdirSync(new URL("data/titles/", root), {
  withFileTypes: true,
})
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

const problems: string[] = [];
const counted: [string, Counts][] = [];
const shippedBooks: [string, [string, number][]][] = [];
for (const language of languages) {
  const total = emptyCounts();
  const books: [string, number][] = [];
  for (const book of STRUCTURE_BOOKS) {
    const structure = read(`data/structure/${book}.json`) as Structure;
    const draftPath = `data/drafts/${language}/${book}.json`;
    const drafts = has(draftPath)
      ? (read(draftPath) as DisputedRecord)
      : undefined;
    const titles = titlesOf(language, book);
    let c: Counts;
    try {
      c = countBook(language, structure, titles, drafts);
    } catch (e) {
      problems.push(`${language} ${book}: ${(e as Error).message}`);
      continue;
    }
    addCounts(total, c);
    // The title tables must ship exactly the titles counted as shipped:
    // the same keys with the same text, not just as many.
    const tablePath = `dist/tc-mobile/titles/${language}/${book}.json`;
    const table: unknown = has(tablePath)
      ? (read(tablePath) as { segments?: unknown } | null)?.segments
      : {};
    problems.push(
      ...tableProblems(tablePath, shippedSegments(structure, titles), table)
    );
    const inTable = isSegmentMap(table) ? Object.keys(table).length : 0;
    if (inTable > 0) books.push([book, inTable]);
  }
  counted.push([language, total]);
  shippedBooks.push([language, books]);
}

const title = (language: string, key: string) => {
  const book = key.split(".")[0]!;
  if (!STRUCTURE_BOOKS.includes(book) || !languages.includes(language))
    return undefined;
  const t = titlesOf(language, book);
  return Object.hasOwn(t, key) ? t[key] : undefined;
};
// Every entry under dist/, at any depth, for the metadata guard.
const dist = fileURLToPath(new URL("dist/", root));
problems.push(
  ...distProblems(
    readdirSync(dist, { withFileTypes: true, recursive: true }).map((e) => ({
      path: relative(dist, join(e.parentPath, e.name)).split(sep).join("/"),
      kind: e.isFile() ? "file" : e.isDirectory() ? "directory" : "other",
    }))
  )
);

const known = read("known-issues.json");
problems.push(...knownIssueProblems(known, title));

for (const p of problems) console.error(`::error::${escapeCommandData(p)}`);
if (problems.length > 0) process.exit(1);

process.stdout.write(
  renderNotes({
    tag,
    books: STRUCTURE_BOOKS.length,
    languages: counted,
    shippedBooks,
    issues: (known as { issues: KnownIssue[] }).issues,
    title,
  })
);
