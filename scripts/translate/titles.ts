// Translates one book's English titles into the v0.1 languages with one
// model through OpenRouter, gates every result, and records each call's
// model, tokens, cost and time.
//
//   OPENROUTER_API_KEY=... node scripts/translate/titles.ts \
//     --book TIT --model google/gemini-3.8-flash [--lang ar,es-419] \
//     [--keys TIT.1.1-3,TIT.1.4-4] [--out .cache/translate/<run>] \
//     [--max-cost 1.00] [--allow-no-glossary]
//
// The key is read only from the environment and is never written or
// printed. Output goes to --out, by default under .cache/ (not committed):
// one `<lang>/<BOOK>.json` of translations per language, and `run.json`, the
// ledger of calls and totals, rewritten after every call and on any failure.
// Exit 0: every requested title came back. Exit 2: the run stopped early
// (spend limit or unknown cost) or some titles are missing, invalid or
// unreadable. Exit 1: an error; the ledger still holds what was spent.
import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { complete } from "../lib/openrouter.ts";
import {
  LANGUAGES,
  runBook,
  sha256,
  type EnglishTitles,
  type Glossary,
} from "../lib/translate.ts";
import { writeJson } from "../lib/write.ts";

const root = new URL("../../", import.meta.url);

const fail = (message: string): never => {
  console.error(`translate: ${message}`);
  process.exit(1);
};

const { values } = parseArgs({
  options: {
    book: { type: "string" },
    model: { type: "string" },
    lang: { type: "string" },
    keys: { type: "string" },
    out: { type: "string" },
    "max-cost": { type: "string", default: "1.00" },
    "allow-no-glossary": { type: "boolean", default: false },
  },
});

const apiKey = process.env.OPENROUTER_API_KEY ?? "";
if (apiKey.trim() === "")
  fail("OPENROUTER_API_KEY is not set; the runner reads the key only from it");

const book = values.book ?? fail("--book is required (e.g. TIT)");
const model = values.model ?? fail("--model is required (an OpenRouter id)");
const tags = values.lang ? values.lang.split(",") : Object.keys(LANGUAGES);
for (const tag of tags)
  if (LANGUAGES[tag] === undefined) fail(`not a v0.1 language: ${tag}`);
const maxCost = Number(values["max-cost"]);
if (!(Number.isFinite(maxCost) && maxCost > 0))
  fail("--max-cost must be a positive number of dollars");

const englishPath = `data/titles/en/${book}.json`;
const englishFile = new URL(englishPath, root);
if (!existsSync(englishFile)) fail(`no English titles for ${book}`);
const englishText = readFileSync(englishFile, "utf8");
const english = JSON.parse(englishText) as EnglishTitles;
const keys = values.keys ? values.keys.split(",") : undefined;
for (const key of keys ?? [])
  if (!english.titles[key]) fail(`${book} has no English title for ${key}`);

const promptPath = "prompts/translate-titles.md";
const promptFile = readFileSync(new URL(promptPath, root), "utf8");

const glossaries: Record<string, Glossary | null> = {};
const glossaryHashes: Record<string, string | null> = {};
for (const tag of tags) {
  const file = new URL(`data/glossaries/${tag}/${book}.json`, root);
  if (existsSync(file)) {
    const text = readFileSync(file, "utf8");
    glossaries[tag] = JSON.parse(text) as Glossary;
    glossaryHashes[tag] = sha256(text);
  } else if (values["allow-no-glossary"]) {
    glossaries[tag] = null;
    glossaryHashes[tag] = null;
  } else {
    fail(
      `no glossary for ${tag} ${book}; pass --allow-no-glossary to run without`
    );
  }
}

const startedAt = new Date();
const runId = `${startedAt.toISOString().replace(/[:.]/g, "-")}-${model.replace(/[^A-Za-z0-9.-]/g, "_")}`;
const out = new URL(
  `${values.out ?? `.cache/translate/${runId}`}/`.replace(/\/+$/, "/"),
  root
);

try {
  const { stop, summary } = await runBook({
    english,
    tags,
    glossaries,
    promptFile,
    model,
    keys,
    maxCost,
    complete: (request) => complete(request, { apiKey }),
    write: (path, value) => writeJson(new URL(path, out), value),
    meta: {
      book,
      startedAt: startedAt.toISOString(),
      prompt: { file: promptPath, sha256: sha256(promptFile) },
      english: { file: englishPath, sha256: sha256(englishText) },
      glossaries: glossaryHashes,
    },
    log: (line) => console.log(line),
  });
  console.log(JSON.stringify(summary));
  console.log(`written to ${out.pathname}`);
  if (stop !== "done") {
    console.error(`translate: stopped early: ${JSON.stringify(stop)}`);
    process.exit(2);
  }
  if (summary.missing + summary.invalid + summary.unreadable > 0) {
    console.error("translate: some titles are missing, invalid or unreadable");
    process.exit(2);
  }
} catch (e) {
  console.error(`translate: ${(e as Error).message}`);
  console.error(`translate: the ledger is in ${out.pathname}run.json`);
  process.exit(1);
}
