// Builds site/review.json, the titles the project site's Review page asks
// about: every draft title in data/drafts/, as it stands, with its passage
// (BSB, public domain) for the reviewer to read. scripts/site/build.mjs
// inlines it into the page.
//
//   node scripts/review/queue.ts
import { readdirSync, readFileSync } from "node:fs";
import { ALL_BOOKS } from "../lib/books.ts";
import {
  current,
  direction,
  verseText,
  type DraftFile,
} from "../lib/review.ts";
import { readSource } from "../lib/sources.ts";
import type { Structure } from "../lib/structure.ts";
import { writeJson } from "../lib/write.ts";

const root = new URL("../../", import.meta.url);
const read = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, root), "utf8")) as T;

type Table = {
  name: { text: string };
  titles: Record<string, { text: string }>;
};
const order = new Map(ALL_BOOKS.map(([code], i) => [code, i]));
const ref = (s: { start: number[]; end: number[] }) =>
  s.start[0] === s.end[0]
    ? s.start[1] === s.end[1]
      ? `${s.start[0]}:${s.start[1]}`
      : `${s.start[0]}:${s.start[1]}–${s.end[1]}`
    : `${s.start[0]}:${s.start[1]}–${s.end[0]}:${s.end[1]}`;

const langs = readdirSync(new URL("data/drafts/", root)).sort((a, b) =>
  a === "en" ? -1 : b === "en" ? 1 : a.localeCompare(b)
);
const sets = [];
for (const lang of langs) {
  const books = readdirSync(new URL(`data/drafts/${lang}/`, root))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5))
    .sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99));
  for (const book of books) {
    const drafts = read<DraftFile>(`data/drafts/${lang}/${book}.json`);
    const english = read<DraftFile>(`data/drafts/en/${book}.json`);
    const structure = read<Structure>(`data/structure/${book}.json`);
    const enTable = read<Table>(`data/titles/en/${book}.json`);
    const table = read<Table>(`data/titles/${lang}/${book}.json`);
    const verses = verseText(await readSource(`bsb-${book.toLowerCase()}`));
    const items = [];
    for (const s of structure.segments) {
      const d = drafts.titles[s.key];
      if (!d) continue;
      const passage: [string, string][] = [];
      for (let c = s.start[0]; c <= s.end[0]; c++) {
        const from = c === s.start[0] ? s.start[1] : 1;
        for (let v = from; ; v++) {
          if (c === s.end[0] && v > s.end[1]) break;
          const t = verses.get(`${c}:${v}`);
          if (t === undefined) {
            if (c < s.end[0]) break;
            throw new Error(`${book} ${c}:${v}: no verse text`);
          }
          passage.push([`${c}:${v}`, t]);
        }
      }
      const en = english.titles[s.key];
      items.push({
        key: s.key,
        ref: ref(s),
        pericope: enTable.titles[s.pericope]?.text ?? "",
        text: current(d),
        status: d.review?.status ?? d.status,
        ...(lang === "en" ? {} : { en: en ? current(en) : "" }),
        verses: passage,
      });
    }
    sets.push({
      lang,
      dir: direction(lang),
      book,
      name: table.name.text,
      items,
    });
  }
}

await writeJson(new URL("site/review.json", root), {
  schema: "bp.review-queue",
  v: 1,
  passage: "Berean Standard Bible (public domain), as pinned in sources.json",
  sets,
});
console.log(
  sets.map((s) => `${s.lang}/${s.book}: ${s.items.length} titles`).join("\n")
);
