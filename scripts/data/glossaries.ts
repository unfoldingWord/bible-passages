// Builds data/glossaries/<lang>/<BOOK>.json from the pinned Translation Word
// Links and Translation Words: each key term a book links, with its headword
// in each language that has Translation Words. For a language without them
// (zh-Hans), from its committed AI record in data/glossary-drafts/ instead
// (scripts/lib/key-terms.ts). Reads only pinned sources and committed files;
// never calls a model.
//
//   node scripts/data/glossaries.ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import {
  buildGlossary,
  GLOSSARY_BOOKS,
  isGlossaryInput,
  parseTwl,
  TW,
  TWL_BOOKS,
  twId,
  twlId,
  type Glossary,
  type TwRepo,
} from "../lib/glossaries.ts";
import {
  buildDraftGlossary,
  DRAFT_LANGUAGES,
  type DraftGlossary,
  type DraftRecord,
} from "../lib/key-terms.ts";
import { readSource, sources, type Source } from "../lib/sources.ts";
import { clearJson, writeJson } from "../lib/write.ts";

const out = new URL("../../data/glossaries/", import.meta.url);
const drafts = new URL("../../data/glossary-drafts/", import.meta.url);

// sources.json is read once: source() re-reads and parses it on every call,
// which over thousands of pins is most of a build's time.
const pins = new Map(sources().map((s) => [s.id, s]));
const pinned = new Set(pins.keys());
const pinOf = (id: string): Source => {
  const pin = pins.get(id);
  if (!pin) throw new Error(`${id} is not pinned in sources.json`);
  return pin;
};
const read = (id: string) => readSource(id, { pin: pinOf(id) });

// Fetch the glossary inputs into the cache a few at a time; the build below
// then reads them in order. readSource checks every file against its pin.
const inputs = [...pinned].filter(isGlossaryInput);
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (let id = inputs.pop(); id !== undefined; id = inputs.pop()) {
      await read(id);
    }
  })
);
const reader = (repo: TwRepo) => async (article: string) => {
  const id = twId(repo.language, article);
  return pinned.has(id) ? read(id) : undefined;
};
const en = TW.find((r) => r.language === "en");
if (!en) throw new Error("no English Translation Words configured");
const readEnglish = reader(en);
const english = async (article: string) => {
  const md = await readEnglish(article);
  if (md === undefined) throw new Error(`en: ${article} is not pinned`);
  return md;
};

// Every glossary is built before anything is deleted, so a failed fetch or
// a bad pin leaves the committed data/glossaries/ untouched.
const built: { file: URL; glossary: Glossary | DraftGlossary }[] = [];
for (const book of GLOSSARY_BOOKS) {
  if (!TWL_BOOKS.includes(book)) {
    throw new Error(`${book}: the pinned TWL release has no file for it`);
  }
  const rows = parseTwl(await read(twlId(book)));
  const englishHeadwords = new Map<string, string>();
  for (const repo of TW) {
    const glossary = await buildGlossary(
      repo,
      book,
      rows,
      english,
      reader(repo),
      pinOf
    );
    built.push({
      file: new URL(`${repo.language}/${book}.json`, out),
      glossary,
    });
    if (repo.language === "en")
      for (const [a, t] of Object.entries(glossary.terms))
        englishHeadwords.set(a, t.headword);
  }
  // AI-drafted languages: one committed record per language and book.
  for (const language of Object.keys(DRAFT_LANGUAGES)) {
    const path = `data/glossary-drafts/${language}/${book}.json`;
    const file = new URL(`${language}/${book}.json`, drafts);
    if (!existsSync(file)) continue;
    const record = JSON.parse(readFileSync(file, "utf8")) as DraftRecord;
    if (record.language !== language || record.book !== book)
      throw new Error(`${path}: names ${record.language} ${record.book}`);
    const glossary = buildDraftGlossary({
      record,
      file: path,
      rows,
      english: (a) => {
        const word = englishHeadwords.get(a);
        if (word === undefined) throw new Error(`en: no headword for ${a}`);
        return word;
      },
      credit: pinOf,
    });
    built.push({ file: new URL(`${language}/${book}.json`, out), glossary });
  }
}

// A record for a language or book the build does not cover is an error, not
// a file silently left out of data/glossaries/.
if (existsSync(drafts)) {
  for (const entry of readdirSync(drafts, { withFileTypes: true })) {
    const known =
      entry.isDirectory() && DRAFT_LANGUAGES[entry.name] !== undefined;
    const files = known ? readdirSync(new URL(`${entry.name}/`, drafts)) : [];
    const stray = files.filter(
      (f) => !GLOSSARY_BOOKS.some((b) => f === `${b}.json`)
    );
    if (!known || stray.length > 0)
      throw new Error(
        `data/glossary-drafts/${entry.name}: not a draft language or book (${stray.join(", ")})`
      );
  }
}

// Only what this script writes: every language directory under glossaries/,
// so a language or book dropped from the build leaves no file behind.
if (existsSync(out)) {
  for (const entry of readdirSync(out, { withFileTypes: true })) {
    if (entry.isDirectory()) clearJson(new URL(`${entry.name}/`, out));
  }
}

for (const { file, glossary } of built) {
  await writeJson(file, glossary);
  console.log(
    `${glossary.book} ${glossary.language}: ${Object.keys(glossary.terms).length} terms, ${Object.keys(glossary.gaps).length} gaps`
  );
}
