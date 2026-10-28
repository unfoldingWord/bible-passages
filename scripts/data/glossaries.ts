// Builds data/glossaries/<lang>/<BOOK>.json from the pinned Translation Word
// Links and Translation Words: each key term a book links, with its headword
// in each language that has Translation Words. Reads only pinned sources.
//
//   node scripts/data/glossaries.ts
import { existsSync, readdirSync } from "node:fs";
import { BOOKS } from "../lib/books.ts";
import {
  buildGlossary,
  parseTwl,
  TW,
  twId,
  twlId,
  type TwRepo,
} from "../lib/glossaries.ts";
import { readSource, sources } from "../lib/sources.ts";
import { clearJson, writeJson } from "../lib/write.ts";

const out = new URL("../../data/glossaries/", import.meta.url);

// Only what this script writes: every language directory under glossaries/,
// so a language or book dropped from the build leaves no file behind.
if (existsSync(out)) {
  for (const entry of readdirSync(out, { withFileTypes: true })) {
    if (entry.isDirectory()) clearJson(new URL(`${entry.name}/`, out));
  }
}

const pinned = new Set(sources().map((s) => s.id));

// Fetch the glossary inputs into the cache a few at a time; the build below
// then reads them in order. readSource checks every file against its pin.
const inputs = [...pinned].filter(
  (id) => id.startsWith("tw-") || id.startsWith("twl-")
);
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (let id = inputs.pop(); id !== undefined; id = inputs.pop()) {
      await readSource(id);
    }
  })
);
const reader = (repo: TwRepo) => async (article: string) => {
  const id = twId(repo.language, article);
  return pinned.has(id) ? readSource(id) : undefined;
};
const en = TW.find((r) => r.language === "en");
if (!en) throw new Error("no English Translation Words configured");
const readEnglish = reader(en);
const english = async (article: string) => {
  const md = await readEnglish(article);
  if (md === undefined) throw new Error(`en: ${article} is not pinned`);
  return md;
};

for (const book of BOOKS) {
  const rows = parseTwl(await readSource(twlId(book)));
  for (const repo of TW) {
    const glossary = await buildGlossary(
      repo,
      book,
      rows,
      english,
      reader(repo)
    );
    await writeJson(new URL(`${repo.language}/${book}.json`, out), glossary);
    console.log(
      `${book} ${repo.language}: ${Object.keys(glossary.terms).length} terms, ${Object.keys(glossary.gaps).length} gaps`
    );
  }
}
