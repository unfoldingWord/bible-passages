// Generates dist/tc-mobile/ from data/: one tc-mobile template package per
// book, and a title table per package per language that has titles to ship
// (titles/<lang>/<BOOK>.json). dist/ is never edited by hand (AGENTS.md);
// tests/dist.test.ts runs tc-mobile's own checker over the output.
//
//   node scripts/data/dist.ts
import { existsSync, readFileSync, rmSync } from "node:fs";
import { STRUCTURE_BOOKS } from "../lib/books.ts";
import { source } from "../lib/sources.ts";
import type { Structure } from "../lib/structure.ts";
import { titleTable, type TitleEntries } from "../lib/title-table.ts";
import { clearJson, writeJson } from "../lib/write.ts";

const root = new URL("../../", import.meta.url);
const read = (path: string) =>
  JSON.parse(readFileSync(new URL(path, root), "utf8")) as unknown;

/** Set by the release workflow from the tag; unreleased builds say so. */
const VERSION = (read("package.json") as { version: string }).version;
const REVISION = process.env.RELEASE_TAG ?? "unreleased";

type Titles = { name: { text: string }; titles: TitleEntries };

// A book or language dropped from the build leaves no stale package or table.
const out = new URL("dist/tc-mobile/", root);
clearJson(out);
rmSync(new URL("titles/", out), { recursive: true, force: true });

for (const book of STRUCTURE_BOOKS) {
  const id = book.toLowerCase();
  const structure = read(`data/structure/${book}.json`) as Structure;
  const titles = read(`data/titles/en/${book}.json`) as Titles;
  const used = [`bsb-${id}`, "ufw-vrs", `ufw-chunks-${id}`].map(source);

  const chapters = new Map<number, Structure["segments"]>();
  for (const s of structure.segments) {
    chapters.set(s.start[0], [...(chapters.get(s.start[0]) ?? []), s]);
  }

  const pkg = {
    format: "tc-mobile-template",
    formatVersion: 0,
    id: `bible-passages:${book}`,
    version: VERSION,
    kind: "bible-book",
    bookCode: book,
    title: { en: titles.name.text },
    titleLanguages: ["en"],
    dataLicence: "CC-BY-SA-4.0",
    recordingLicence: "CC-BY-SA-4.0",
    attribution: used.map((s) => s.attribution).join("; "),
    source: {
      url: "https://github.com/unfoldingWord/bible-passages",
      revision: REVISION,
    },
    chapters: [...chapters].map(([number, segments]) => ({
      key: `${book}.${number}`,
      number,
      segments: segments.map((s) => ({
        key: s.key,
        reference: {
          book,
          startChapter: s.start[0],
          startVerse: s.start[1],
          endChapter: s.end[0],
          endVerse: s.end[1],
        },
        thumbnail: null,
      })),
    })),
  };
  await writeJson(new URL(`${book}.json`, out), pkg);
  console.log(
    `dist/tc-mobile/${book}.json: ${structure.segments.length} segments`
  );

  // One title table per language with titles to ship (scripts/lib/title-table.ts).
  const segmentKeys = pkg.chapters.flatMap((c) => c.segments.map((s) => s.key));
  for (const language of pkg.titleLanguages) {
    const path = `data/titles/${language}/${book}.json`;
    if (!existsSync(new URL(path, root))) continue;
    const entries = (read(path) as Titles).titles;
    const table = titleTable(pkg, language, segmentKeys, entries, path);
    if (table === null) continue;
    const count = Object.keys(table.segments).length;
    await writeJson(new URL(`titles/${language}/${book}.json`, out), table);
    console.log(
      `dist/tc-mobile/titles/${language}/${book}.json: ${count} of ${structure.segments.length} segments titled`
    );
  }
}
