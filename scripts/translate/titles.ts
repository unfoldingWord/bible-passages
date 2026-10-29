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
// one `<lang>/<BOOK>.json` of translations per language whose reply could be
// read (a failed reply's error is in the ledger only), and `run.json`, the
// ledger of calls and totals, rewritten after every call and on any failure.
// Exit 0: every requested title came back. Exit 2: the run stopped early
// (spend limit or unknown cost) or some titles are missing, invalid or
// unreadable. Exit 1: an error; the ledger still holds what was spent.
import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { BOOK_CODES } from "../lib/gates.ts";
import { complete } from "../lib/openrouter.ts";
import {
  LANGUAGES,
  runBook,
  sha256,
  usableTerm,
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

// Trimmed once: the value checked is the value sent.
const apiKey = (process.env.OPENROUTER_API_KEY ?? "").trim();
if (apiKey === "")
  fail("OPENROUTER_API_KEY is not set; the runner reads the key only from it");

const book = values.book ?? fail("--book is required (e.g. TIT)");
// The book code names files that are read and written, so only a known code
// is accepted.
if (!BOOK_CODES.includes(book)) fail(`not a USFM book code: ${book}`);
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
if (english.book !== book) fail(`${englishPath} is not for ${book}`);
const keys = values.keys ? values.keys.split(",") : undefined;
for (const key of keys ?? [])
  if (!english.titles[key]) fail(`${book} has no English title for ${key}`);

const promptPath = "prompts/translate-titles.md";
const promptFile = readFileSync(new URL(promptPath, root), "utf8");

const glossaries: Record<string, Glossary | null> = {};
const glossaryHashes: Record<string, string | null> = {};
for (const tag of tags) {
  const file = new URL(`data/glossaries/${tag}/${book}.json`, root);
  const text = existsSync(file) ? readFileSync(file, "utf8") : undefined;
  const glossary =
    text === undefined ? undefined : (JSON.parse(text) as Glossary);
  // A glossary whose terms all wait for review (AI-drafted, not yet read by
  // a person) gives titles nothing, so it counts as no glossary.
  if (
    text !== undefined &&
    glossary &&
    Object.values(glossary.terms).some(usableTerm)
  ) {
    glossaries[tag] = glossary;
    glossaryHashes[tag] = sha256(text);
  } else if (values["allow-no-glossary"]) {
    glossaries[tag] = null;
    glossaryHashes[tag] = null;
  } else {
    fail(
      `no glossary${text === undefined ? "" : " with reviewed terms"} for ${tag} ${book}; pass --allow-no-glossary to run without`
    );
  }
}

const startedAt = new Date();
const runId = `${startedAt.toISOString().replace(/[:.]/g, "-")}-${model.replace(/[^A-Za-z0-9.-]/g, "_")}`;
const out = new URL(
  `${values.out ?? `.cache/translate/${runId}`}/`.replace(/\/+$/, "/"),
  root
);
// A run never writes into the dataset: its output is AI drafts for review,
// and data/ and dist/ are inputs and generated files.
const inRepo = relative(fileURLToPath(root), fileURLToPath(out));
if (/^(data|dist)(\/|$)/.test(inRepo))
  fail(`--out must not be inside data/ or dist/: ${inRepo}`);
// One directory per run: a second run there would replace the first run's
// ledger and leave its translations unaccounted for.
if (existsSync(out))
  fail(`--out already exists: ${fileURLToPath(out)}; choose a new directory`);

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
