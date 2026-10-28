// Pure functions that turn the pinned sources into pericopes and segments.
// The rules and the cases they handle are in docs/scoping/pipeline.md
// (sections 1, 3 and 4); the shapes are in docs/schema.md.

export type Ref = [chapter: number, verse: number];
export type Span = { key: string; start: Ref; end: Ref };
export type Pericope = Span;
export type Segment = Span & { pericope: string };
export type Heading = { chapter: number; verse: number; text: string };
export type Structure = {
  book: string;
  versification: "ufw";
  pericopes: Pericope[];
  segments: Segment[];
};

/** Last verse of each chapter per book, from a `.vrs` file. */
export function parseVrs(text: string): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.includes("=")) continue;
    const [book, ...chapters] = line.split(/\s+/);
    if (!book || !/^[0-9A-Z]{3}$/.test(book)) continue;
    out[book] = chapters.map((c, i) => {
      const m = /^(\d+):(\d+)$/.exec(c);
      if (!m || Number(m[1]) !== i + 1) {
        throw new Error(`${book}: unexpected chapter entry "${c}"`);
      }
      return Number(m[2]);
    });
  }
  return out;
}

/** Inline USFM markers removed, whitespace collapsed. */
function plain(text: string): string {
  const out = text
    .replace(/\\w\s+([^|\\]*)(\|[^\\]*)?\\w\*/g, "$1")
    .replace(/\\\+?[a-z0-9-]+\*?/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (out.includes("\\") || out === "") {
    throw new Error(`cannot read heading text "${text}"`);
  }
  return out;
}

/**
 * Each `\s1` heading with the verse its pericope starts at: the next verse
 * marker in the same chapter, or verse 1 when the heading comes before the
 * chapter's first verse marker (34 Psalms chapters have a superscription and
 * no `\v 1`). Verse markers are found anywhere in a line (`\q1 \v 17`).
 */
export function parseHeadings(usfm: string): Heading[] {
  const out: Heading[] = [];
  const marker = /\\(c|v)\s+(\d+)|\\s1\s+([^\n]*)/g;
  let chapter = 0;
  let sawVerse = false;
  let pending: string | null = null;
  for (const m of usfm.matchAll(marker)) {
    if (m[1] === "c") {
      if (pending !== null) {
        throw new Error(
          `heading "${pending}" has no verse in chapter ${chapter}`
        );
      }
      chapter = Number(m[2]);
      sawVerse = false;
    } else if (m[1] === "v") {
      if (pending !== null) {
        out.push({
          chapter,
          verse: sawVerse ? Number(m[2]) : 1,
          text: pending,
        });
        pending = null;
      }
      sawVerse = true;
    } else {
      if (pending !== null)
        throw new Error(`two headings in a row: "${pending}"`);
      if (chapter === 0) throw new Error(`heading before the first chapter`);
      pending = plain(m[3] ?? "");
    }
  }
  if (pending !== null) throw new Error(`heading "${pending}" has no verse`);
  return out;
}

/** Chunk start verses per chapter, from a UFW `chunks/<book>.json` file. */
export function parseChunks(json: string): number[][] {
  const rows = JSON.parse(json) as {
    chapter: number;
    first_verses: number[];
  }[];
  return rows.map((row, i) => {
    if (row.chapter !== i + 1)
      throw new Error(`chunk file skips chapter ${i + 1}`);
    return row.first_verses;
  });
}

export const segmentKey = (book: string, c: number, from: number, to: number) =>
  `${book}.${c}.${from}-${to}`;
export const pericopeKey = (
  book: string,
  c: number,
  from: number,
  to: number
) => `${book}.P.${c}.${from}-${to}`;

/** Consecutive start verses into [from, to] runs ending at the chapter's last verse. */
function runs(starts: number[], last: number): [number, number][] {
  const sorted = [...new Set(starts)].sort((a, b) => a - b);
  if (sorted[0] !== 1)
    throw new Error(`first start is ${sorted[0]}, not verse 1`);
  return sorted.map((from, i) => {
    if (from > last)
      throw new Error(`start ${from} is past the last verse ${last}`);
    return [from, (sorted[i + 1] ?? last + 1) - 1];
  });
}

/**
 * Pericopes from the headings; segments are the chunks, each split where a
 * pericope starts inside it, so every segment sits in exactly one pericope.
 * Nothing crosses a chapter: a chapter whose first verse has no heading is an
 * error rather than a pericope carried over from the chapter before.
 */
export function buildStructure(
  book: string,
  lastVerses: number[],
  headings: Heading[],
  chunkStarts: number[][]
): Structure {
  if (chunkStarts.length !== lastVerses.length) {
    throw new Error(
      `${book}: ${chunkStarts.length} chapters of chunks, ${lastVerses.length} in the versification`
    );
  }
  const pericopes: Pericope[] = [];
  const segments: Segment[] = [];
  lastVerses.forEach((last, i) => {
    const c = i + 1;
    const starts = headings.filter((h) => h.chapter === c).map((h) => h.verse);
    if (new Set(starts).size !== starts.length) {
      throw new Error(`${book} ${c}: two headings start at the same verse`);
    }
    if (!starts.includes(1)) {
      throw new Error(
        `${book} ${c}: no heading at verse 1, a pericope would cross the chapter`
      );
    }
    const inChapter = runs(starts, last).map(([from, to]) => ({
      key: pericopeKey(book, c, from, to),
      start: [c, from] as Ref,
      end: [c, to] as Ref,
    }));
    pericopes.push(...inChapter);
    for (const [from, to] of runs(
      [...(chunkStarts[i] ?? []), ...starts],
      last
    )) {
      const home = inChapter.find(
        (p) => p.start[1] <= from && from <= p.end[1]
      );
      if (!home) throw new Error(`${book} ${c}:${from} is in no pericope`);
      segments.push({
        key: segmentKey(book, c, from, to),
        pericope: home.key,
        start: [c, from],
        end: [c, to],
      });
    }
  });
  return { book, versification: "ufw", pericopes, segments };
}
