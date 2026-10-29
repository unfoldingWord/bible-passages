// Drafts a key-term glossary for a language with no Translation Words
// (zh-Hans), with one model, and checks every term with a second model, through
// OpenRouter. See scripts/lib/key-terms.ts and docs/scoping/glossaries.md.
//
//   OPENROUTER_API_KEY=... node scripts/translate/key-terms.ts \
//     --book TIT --lang zh-Hans \
//     --draft-model google/gemini-3.8-flash \
//     --check-model anthropic/claude-sonnet-5.5 \
//     [--out .cache/key-terms/<run>] [--max-cost 1.00]
//
// Inputs, all offline apart from the two calls: the English glossary
// (data/glossaries/en/<BOOK>.json, built from pins), each linked English tW
// article and the reference term list, both read through their pins.
//
// The key is read only from the environment and is never written or printed.
// Output goes to --out, by default under .cache/ (not committed):
// `<lang>/<BOOK>.json`, the record, and `run.json`, the ledger of both calls,
// rewritten after each call and on any failure. To keep a run, copy the record
// unchanged to data/glossary-drafts/<lang>/<BOOK>.json and rebuild.
// Exit 0: every term drafted and checked. Exit 2: the run stopped early or
// some terms are missing or unreadable. Exit 1: an error.
import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { STRUCTURE_BOOKS } from "../lib/books.ts";
import { twId } from "../lib/glossaries.ts";
import {
  assertFamilies,
  definition,
  draftKeyTerms,
  DRAFT_LANGUAGES,
  parseFia,
  PROMPT_FILE,
  type TermInput,
} from "../lib/key-terms.ts";
import { complete } from "../lib/openrouter.ts";
import { readSource } from "../lib/sources.ts";
import { writeJson } from "../lib/write.ts";

const root = new URL("../../", import.meta.url);

const fail = (message: string): never => {
  console.error(`key-terms: ${message}`);
  process.exit(1);
};

const { values } = parseArgs({
  options: {
    book: { type: "string" },
    lang: { type: "string" },
    "draft-model": { type: "string" },
    "check-model": { type: "string" },
    out: { type: "string" },
    "max-cost": { type: "string", default: "1.00" },
  },
});

// Trimmed once: the value checked is the value sent.
const apiKey = (process.env.OPENROUTER_API_KEY ?? "").trim();
if (apiKey === "")
  fail("OPENROUTER_API_KEY is not set; the runner reads the key only from it");

const book = values.book ?? fail("--book is required (e.g. TIT)");
// The book code goes into file paths, so only a known code is accepted.
if (!STRUCTURE_BOOKS.includes(book)) fail(`not a book code: ${book}`);
const tag = values.lang ?? fail("--lang is required (e.g. zh-Hans)");
const lang = DRAFT_LANGUAGES[tag] ?? fail(`not a draft language: ${tag}`);
const draftModel = values["draft-model"] ?? fail("--draft-model is required");
const checkModel = values["check-model"] ?? fail("--check-model is required");
const maxCost = Number(values["max-cost"]);
if (!(Number.isFinite(maxCost) && maxCost > 0))
  fail("--max-cost must be a positive number of dollars");

// Of another family, checked before any call (ADR 0002).
try {
  assertFamilies(draftModel, checkModel);
} catch (e) {
  fail((e as Error).message);
}

const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${tag}-${book}`;
const out = new URL(
  `${values.out ?? `.cache/key-terms/${runId}`}/`.replace(/\/+$/, "/"),
  root
);
// A run never writes into the dataset: the record is committed by hand,
// unchanged, after a person has looked at the run.
const inRepo = relative(fileURLToPath(root), fileURLToPath(out));
if (/^(data|dist)(\/|$)/.test(inRepo))
  fail(`--out must not be inside data/ or dist/: ${inRepo}`);
if (existsSync(out))
  fail(`--out already exists: ${fileURLToPath(out)}; choose a new directory`);

const englishFile = new URL(`data/glossaries/en/${book}.json`, root);
if (!existsSync(englishFile)) fail(`no English glossary for ${book}`);
const english = JSON.parse(readFileSync(englishFile, "utf8")) as {
  terms: Record<string, { en: string; refs: string[] }>;
};
const inputs: TermInput[] = [];
for (const [article, t] of Object.entries(english.terms)) {
  inputs.push({
    article,
    en: t.en,
    definition: definition(await readSource(twId("en", article))),
    refs: t.refs,
  });
}
const reference = {
  id: lang.reference,
  terms: parseFia(await readSource(lang.reference)),
};

const promptPath = PROMPT_FILE;
const promptText = readFileSync(new URL(promptPath, root), "utf8");

try {
  const { record, outcome } = await draftKeyTerms({
    tag,
    book,
    inputs,
    reference,
    prompt: { file: promptPath, text: promptText },
    draftModel,
    checkModel,
    maxCost,
    complete: (request) => complete(request, { apiKey }),
    write: (ledger) => writeJson(new URL("run.json", out), ledger),
  });
  if (record) {
    await writeJson(new URL(`${tag}/${book}.json`, out), record);
    const terms = Object.values(record.terms);
    console.log(
      `${tag} ${book}: ${terms.length} of ${inputs.length} terms, ` +
        `${terms.filter((t) => t.status === "ai-checked").length} ai-checked, ` +
        `${terms.filter((t) => t.check?.verdict === "disagree").length} disagreements, ` +
        `${terms.filter((t) => t.gates).length} gate failures`
    );
    for (const c of record.calls)
      console.log(
        `${c.role} ${c.model}: ${c.promptTokens}+${c.completionTokens} tokens` +
          ` (${c.reasoningTokens ?? "?"} reasoning), $${c.cost?.toFixed(6) ?? "unknown"}, ${c.ms} ms`
      );
  }
  console.log(`written to ${out.pathname}`);
  if (outcome !== "done") {
    console.error(`key-terms: ${JSON.stringify(outcome)}`);
    process.exit(2);
  }
} catch (e) {
  console.error(`key-terms: ${(e as Error).message}`);
  console.error(`key-terms: the ledger is in ${out.pathname}run.json`);
  process.exit(1);
}
