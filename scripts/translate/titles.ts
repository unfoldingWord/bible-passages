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
// one `<lang>/<BOOK>.json` of translations and a `run.json` of calls and
// totals.
import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { complete } from "../lib/openrouter.ts";
import {
  LANGUAGES,
  sha256,
  summarise,
  translateLanguage,
  type Call,
  type EnglishTitles,
  type Glossary,
  type Translation,
} from "../lib/translate.ts";
import { writeJson } from "../lib/write.ts";

const root = new URL("../../", import.meta.url);

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

const fail = (message: string): never => {
  console.error(`translate: ${message}`);
  process.exit(1);
};

const apiKey = process.env.OPENROUTER_API_KEY ?? "";
if (apiKey.trim() === "")
  fail("OPENROUTER_API_KEY is not set; the runner reads the key only from it");

const book = values.book ?? fail("--book is required (e.g. TIT)");
const model = values.model ?? fail("--model is required (an OpenRouter id)");
const tags = values.lang ? values.lang.split(",") : Object.keys(LANGUAGES);
for (const tag of tags)
  if (LANGUAGES[tag] === undefined) fail(`not a v0.1 language: ${tag}`);
const maxCost = Number(values["max-cost"]);
if (!(maxCost > 0)) fail("--max-cost must be a positive number of dollars");

const englishFile = new URL(`data/titles/en/${book}.json`, root);
if (!existsSync(englishFile)) fail(`no English titles for ${book}`);
const english = JSON.parse(readFileSync(englishFile, "utf8")) as EnglishTitles;
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

const calls: Call[] = [];
let spent = 0;
let titleCount = 0;
let gateFailures = 0;
const missing: Record<string, string[]> = {};

for (const tag of tags) {
  if (spent >= maxCost) {
    console.error(
      `translate: stopped before ${tag}: $${spent.toFixed(4)} spent, limit $${maxCost}`
    );
    break;
  }
  const result = await translateLanguage({
    english,
    tag,
    glossary: glossaries[tag] ?? null,
    promptFile,
    model,
    keys,
    complete: (request) => complete(request, { apiKey }),
  });
  calls.push(result.call);
  spent += result.call.cost ?? 0;
  const translated = Object.keys(result.titles).length;
  const failed = Object.values(result.titles).filter(
    (t: Translation) => t.gates
  ).length;
  titleCount += translated;
  gateFailures += failed;
  if (result.missing.length > 0) missing[tag] = result.missing;
  await writeJson(new URL(`${tag}/${book}.json`, out), {
    language: tag,
    book,
    titles: result.titles,
  });
  console.log(
    `${tag}: ${translated} titles, ${failed} gate failures, ${result.missing.length} missing, ` +
      `${result.call.promptTokens}+${result.call.completionTokens} tokens, ` +
      `$${result.call.cost?.toFixed(6) ?? "unknown"}, ${result.call.ms} ms`
  );
}

const summary = summarise(calls, titleCount, gateFailures);
await writeJson(new URL("run.json", out), {
  book,
  model,
  startedAt: startedAt.toISOString(),
  finishedAt: new Date().toISOString(),
  prompt: { file: promptPath, sha256: sha256(promptFile) },
  english: {
    file: `data/titles/en/${book}.json`,
    sha256: sha256(readFileSync(englishFile, "utf8")),
  },
  glossaries: glossaryHashes,
  missing,
  calls,
  summary,
});
console.log(JSON.stringify(summary));
console.log(`written to ${out.pathname}`);
