// Builds data/ from the pinned sources: the structure and the English
// pericope titles for each book, and the verse counts the checks use.
//
//   node scripts/data/build.ts
import { readSource } from "../lib/sources.ts";
import { clearJson, writeJson } from "../lib/write.ts";
import {
  buildStructure,
  parseChunks,
  parseHeadings,
  parseVrs,
} from "../lib/structure.ts";

/** Books built so far: one book end to end before the next (AGENTS.md). */
const BOOKS = ["TIT"];

const data = new URL("../../data/", import.meta.url);

const write = (path: string, value: unknown) =>
  writeJson(new URL(path, data), value);

const vrs = parseVrs(await readSource("ufw-vrs"));

// Only what this script writes, so a book dropped from BOOKS leaves no file.
for (const dir of ["structure/", "titles/en/", "versification/"]) {
  clearJson(new URL(dir, data));
}

await write("versification/ufw.json", vrs);

for (const book of BOOKS) {
  const id = book.toLowerCase();
  const usfm = await readSource(`bsb-${id}`);
  const lastVerses = vrs[book];
  if (!lastVerses) throw new Error(`${book} is not in ufw.vrs`);
  const headings = parseHeadings(usfm);
  const chunks = parseChunks(await readSource(`ufw-chunks-${id}`));
  const structure = buildStructure(book, lastVerses, headings, chunks);
  await write(`structure/${book}.json`, structure);

  const name = /^\\h\s+(.+)$/m.exec(usfm)?.[1]?.trim();
  if (!name) throw new Error(`${book}: no \\h book name`);
  const source = `bsb-${id}`;
  const titles: Record<
    string,
    { text: string; status: string; source: string }
  > = {};
  for (const h of headings) {
    const p = structure.pericopes.find(
      (p) => p.start[0] === h.chapter && p.start[1] === h.verse
    );
    if (!p)
      throw new Error(
        `${book} ${h.chapter}:${h.verse}: heading without a pericope`
      );
    titles[p.key] = { text: h.text, status: "unreviewed", source };
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
