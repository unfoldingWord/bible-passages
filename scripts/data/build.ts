// Builds data/ from the pinned sources: the structure of every book, the
// English titles of the books in BOOKS (the book name only for the others),
// and the verse counts the checks use.
//
//   node scripts/data/build.ts
import { existsSync, readFileSync } from "node:fs";
import { BOOKS, STRUCTURE_BOOKS } from "../lib/books.ts";
import { readSource } from "../lib/sources.ts";
import { clearJson, writeJson } from "../lib/write.ts";
import {
  buildStructure,
  parseChunks,
  parseHeadings,
  parseVrs,
  plain,
} from "../lib/structure.ts";

const data = new URL("../../data/", import.meta.url);

const write = (path: string, value: unknown) =>
  writeJson(new URL(path, data), value);

const vrs = parseVrs(await readSource("ufw-vrs"));

// Only what this script writes, so a book dropped from the build leaves no
// file.
for (const dir of ["structure/", "titles/en/", "versification/"]) {
  clearJson(new URL(dir, data));
}

await write("versification/ufw.json", vrs);

for (const book of STRUCTURE_BOOKS) {
  const id = book.toLowerCase();
  const usfm = await readSource(`bsb-${id}`);
  const lastVerses = vrs[book];
  if (!lastVerses) throw new Error(`${book} is not in ufw.vrs`);
  const headings = parseHeadings(usfm);
  const chunks = parseChunks(await readSource(`ufw-chunks-${id}`));
  const structure = buildStructure(book, lastVerses, headings, chunks);
  await write(`structure/${book}.json`, structure);

  const h = /^\\h\s+(.+)$/m.exec(usfm)?.[1];
  if (!h) throw new Error(`${book}: no \\h book name`);
  const name = plain(h);
  const source = `bsb-${id}`;
  const titles: Record<
    string,
    { text: string; status: string; source: string }
  > = {};
  // Titles are built one book at a time (AGENTS.md); until a book is in
  // BOOKS its table holds the book name, which its package needs, and no
  // titles.
  const titled = BOOKS.includes(book);
  for (const h of titled ? headings : []) {
    const p = structure.pericopes.find(
      (p) => p.start[0] === h.chapter && p.start[1] === h.verse
    );
    if (!p)
      throw new Error(
        `${book} ${h.chapter}:${h.verse}: heading without a pericope`
      );
    titles[p.key] = { text: h.text, status: "unreviewed", source };
  }
  // AI drafts are committed inputs in data/drafts/, which the build never
  // clears, so a rebuild cannot wipe them. A draft for a key that is not a
  // segment fails the build.
  const draftFile = new URL(`drafts/en/${book}.json`, data);
  if (existsSync(draftFile)) {
    if (!titled) throw new Error(`${book}: drafts for a book not in BOOKS`);
    const drafts = (
      JSON.parse(readFileSync(draftFile, "utf8")) as {
        titles: Record<
          string,
          {
            text: string;
            status: string;
            source: string;
            review?: { by: string; status: string; text?: string };
          }
        >;
      }
    ).titles;
    const segmentKeys = new Set(structure.segments.map((s) => s.key));
    for (const [key, draft] of Object.entries(drafts)) {
      if (!segmentKeys.has(key))
        throw new Error(`${book}: draft for unknown segment key ${key}`);
      // The check's details stay in data/drafts/; the table gets the title.
      // A person's review, when there is one, decides the title: its status,
      // and its own wording (with the reviewer as source) if it gave one.
      const { review } = draft;
      titles[key] = review
        ? {
            text: review.text ?? draft.text,
            status: review.status,
            source: review.text ? review.by : draft.source,
          }
        : { text: draft.text, status: draft.status, source: draft.source };
    }
  }
  await write(`titles/en/${book}.json`, {
    language: "en",
    book,
    name: { text: name, status: "unreviewed", source },
    titles,
  });
  console.log(
    `${book}: ${structure.pericopes.length} pericopes, ${structure.segments.length} segments`
  );
}
