// Builds data/ from the pinned sources: the structure of every book, the
// English book name and pericope titles of every book (BSB; two names come
// from ULT, see NAME_OVERRIDES), the English segment titles of the books in
// BOOKS, and the verse counts the checks use.
//
//   node scripts/data/build.ts
import { existsSync, readFileSync } from "node:fs";
import { BOOKS, STRUCTURE_BOOKS } from "../lib/books.ts";
import {
  builtTitle,
  disputeCheckProblems,
  disputeProblems,
  type DisputedRecord,
} from "../lib/dispute-titles.ts";
import { readSource, source as source_ } from "../lib/sources.ts";
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

/**
 * Book names taken from unfoldingWord's ULT instead of BSB, decided by the
 * maintainer on #39 (2026-10-29): BSB's `\h` reads "Psalm" and "Song". The
 * name is ULT's `\toc2` in `ult-<book>`, and it must be the decided text, so
 * a new ULT pin that changes it stops the build rather than shipping an
 * undecided name. Being a person's decision, not a draft, it is `approved`.
 */
const NAME_OVERRIDES: Record<string, string> = {
  PSA: "Psalms",
  SNG: "Song of Songs",
};

/** The book name, its source and status: BSB `\h`, or a decided override. */
async function bookName(book: string, bsb: string) {
  const id = book.toLowerCase();
  const decided = NAME_OVERRIDES[book];
  if (decided !== undefined) {
    const source = `ult-${id}`;
    const toc2 = /^\\toc2\s+(.+)$/m.exec(await readSource(source))?.[1];
    if (!toc2) throw new Error(`${book}: no \\toc2 book name in ${source}`);
    const text = plain(toc2);
    if (text !== decided) {
      throw new Error(
        `${book}: ${source} \\toc2 is "${text}", not the decided "${decided}"`
      );
    }
    return { text, status: "approved", source };
  }
  const h = /^\\h\s+(.+)$/m.exec(bsb)?.[1];
  if (!h) throw new Error(`${book}: no \\h book name`);
  return { text: plain(h), status: "unreviewed", source: `bsb-${id}` };
}

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

  const name = await bookName(book, usfm);
  const source = `bsb-${id}`;
  const titles: Record<
    string,
    { text: string; status: string; source: string }
  > = {};
  // Every book's pericope titles are BSB's \s1 headings, the same headings
  // its pericopes were cut at, so each pericope gets exactly one (#196).
  // Segment titles are built one book at a time (AGENTS.md): only a book in
  // BOOKS has drafts or reuses a pericope title for a segment (decision 12).
  const titled = BOOKS.includes(book);
  for (const h of headings) {
    const p = structure.pericopes.find(
      (p) => p.start[0] === h.chapter && p.start[1] === h.verse
    );
    if (!p)
      throw new Error(
        `${book} ${h.chapter}:${h.verse}: heading without a pericope`
      );
    if (titles[p.key])
      throw new Error(
        `${book} ${h.chapter}:${h.verse}: two headings for ${p.key}`
      );
    titles[p.key] = { text: h.text, status: "unreviewed", source };
  }
  for (const p of structure.pericopes)
    if (!titles[p.key]) throw new Error(`${p.key}: pericope without a title`);
  // AI drafts are committed inputs in data/drafts/, which the build never
  // clears, so a rebuild cannot wipe them. A draft for a key that is not a
  // segment fails the build.
  const draftFile = new URL(`drafts/en/${book}.json`, data);
  if (existsSync(draftFile)) {
    if (!titled) throw new Error(`${book}: drafts for a book not in BOOKS`);
    const record = JSON.parse(
      readFileSync(draftFile, "utf8")
    ) as DisputedRecord;
    // A third check's answers name the ULT they read; it must be the
    // book's own, and pinned. A record that names a recheck has one on
    // every dispute (#223).
    const checkProblems = disputeCheckProblems(book, record);
    if (checkProblems.length > 0)
      throw new Error(`${book}: disputeCheck: ${checkProblems.join("; ")}`);
    if (record.disputeCheck) source_(record.disputeCheck.verses);
    if (record.disputeCheck?.recheck)
      source_(record.disputeCheck.recheck.bible);
    const segmentKeys = new Set(structure.segments.map((s) => s.key));
    for (const [key, draft] of Object.entries(record.titles)) {
      if (!segmentKeys.has(key))
        throw new Error(`${book}: draft for unknown segment key ${key}`);
      const problems = disputeProblems(draft);
      if (problems.length > 0)
        throw new Error(`${book} ${key}: dispute: ${problems.join("; ")}`);
      if (draft.dispute && !record.disputeCheck)
        throw new Error(`${book} ${key}: a dispute with no disputeCheck`);
      // A recheck names the check it went through (#207).
      if (draft.dispute?.recheck && !record.disputeCheck?.recheck)
        throw new Error(
          `${book} ${key}: a recheck with no disputeCheck.recheck`
        );
      // The check's details stay in data/drafts/; the table gets the title.
      // A person's review, when there is one, decides the title: its status,
      // and its own wording (with the reviewer as source) if it gave one.
      // Else the third model's answer on a disputed title (ADR 0005 item 6):
      // its wording, status and model. Else the draft.
      titles[key] = builtTitle(draft);
    }
  }
  // Decision 12 (docs/decisions/0003): a segment that is its pericope's only
  // segment reuses the pericope title, unless a draft gives it its own
  // (Titus 3:9-11 was drafted before the decision). Pericope titles first,
  // then segment titles, each in reading order.
  const ordered: typeof titles = {};
  for (const p of structure.pericopes)
    if (titles[p.key]) ordered[p.key] = titles[p.key]!;
  for (const s of titled ? structure.segments : []) {
    const only =
      structure.segments.filter((t) => t.pericope === s.pericope).length === 1;
    const title = titles[s.key] ?? (only ? titles[s.pericope] : undefined);
    if (title) ordered[s.key] = { ...title };
  }
  await write(`titles/en/${book}.json`, {
    language: "en",
    book,
    name,
    titles: ordered,
  });
  console.log(
    `${book}: ${structure.pericopes.length} pericopes, ${structure.segments.length} segments`
  );
}
