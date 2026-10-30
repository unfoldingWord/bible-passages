// Checks a translation run's titles with a model of another family
// (docs/decisions/0002): each translation is judged against its English
// title and the language's glossary, and gets a verdict.
//
//   OPENROUTER_API_KEY=... node scripts/translate/check.ts \
//     --run .cache/translate/<run> --model anthropic/claude-sonnet-5.5 \
//     [--lang ar,es-419] [--out .cache/check/<run>] [--max-cost 1.00]
//
// The key is read only from the environment and is never written or
// printed. Output goes to --out, by default under .cache/ (not committed):
// one `<lang>/<BOOK>.json` of checked titles per language, in the shape of
// data/drafts/<lang>/<BOOK>.json, and `run.json`, the ledger of calls and
// totals. The ledger pins the translation run by the SHA-256 of its
// run.json (`translation.sha256`); `translation.run` is the run's path
// relative to the repository, or null for a run kept outside it, so no
// machine's absolute paths are written (#83). Exit 0: every translation has a verdict. Exit 2: the run stopped
// early, some verdicts are missing, invalid or unreadable, or a language in
// the translation run has no translations file. Exit 1: an error; the
// ledger still holds what was spent.
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { checkBook, family, type TranslatedFile } from "../lib/check.ts";
import { complete } from "../lib/openrouter.ts";
import { BOOK_CODES } from "../lib/gates.ts";
import {
  LANGUAGES,
  sha256,
  type EnglishTitles,
  type Glossary,
} from "../lib/translate.ts";
import { writeJson } from "../lib/write.ts";

const root = new URL("../../", import.meta.url);

const fail = (message: string): never => {
  console.error(`check: ${message}`);
  process.exit(1);
};

const { values } = parseArgs({
  options: {
    run: { type: "string" },
    model: { type: "string" },
    lang: { type: "string" },
    out: { type: "string" },
    "max-cost": { type: "string", default: "1.00" },
  },
});

const apiKey = (process.env.OPENROUTER_API_KEY ?? "").trim();
if (apiKey === "")
  fail("OPENROUTER_API_KEY is not set; the checker reads the key only from it");

const runArg = values.run ?? fail("--run is required (a translation run)");
const model = values.model ?? fail("--model is required (an OpenRouter id)");
const maxCost = Number(values["max-cost"]);
if (!(Number.isFinite(maxCost) && maxCost > 0))
  fail("--max-cost must be a positive number of dollars");

// The translation run: its ledger names the book, the model, the languages
// and the hashes of the English and glossaries it read.
const runDir = pathToFileURL(`${resolve(runArg)}/`);
const ledgerFile = new URL("run.json", runDir);
if (!existsSync(ledgerFile)) fail(`no run.json in ${fileURLToPath(runDir)}`);
const ledgerText = readFileSync(ledgerFile, "utf8");
type Ledger = {
  book: string;
  model: string;
  languages: string[];
  english: { file: string; sha256: string };
  glossaries: Record<string, string | null>;
};
// The ledger's book and languages name paths that are read and written, so
// only known values are accepted: a USFM book code and v0.1 language tags.
const ledger = ((): Ledger => {
  let v: unknown;
  try {
    v = JSON.parse(ledgerText);
  } catch {
    return fail("the translation run's run.json is not JSON");
  }
  const l = (typeof v === "object" && v !== null ? v : {}) as Partial<Ledger>;
  if (typeof l.book !== "string" || !BOOK_CODES.includes(l.book))
    fail("the translation run's book is not a USFM book code");
  if (typeof l.model !== "string") fail("the translation run names no model");
  if (
    !Array.isArray(l.languages) ||
    !l.languages.every(
      (t) => typeof t === "string" && Object.hasOwn(LANGUAGES, t)
    )
  )
    fail("the translation run's languages are not v0.1 language tags");
  if (typeof l.english?.sha256 !== "string")
    fail("the translation run has no English hash");
  if (new Set(l.languages).size !== l.languages?.length)
    fail("the translation run lists a language twice");
  if (
    typeof l.glossaries !== "object" ||
    l.glossaries === null ||
    Array.isArray(l.glossaries)
  )
    fail("the translation run has no glossary hashes");
  return l as Ledger;
})();
const translator = (() => {
  try {
    return family(ledger.model);
  } catch (e) {
    return fail((e as Error).message);
  }
})();
const checker = (() => {
  try {
    return family(model);
  } catch (e) {
    return fail((e as Error).message);
  }
})();
if (translator === checker)
  fail(`${ledger.model} must be checked by another family, not ${model}`);
const tags = values.lang ? values.lang.split(",") : ledger.languages;
if (new Set(tags).size !== tags.length) fail("--lang lists a language twice");
// Every language checked needs the translator's glossary hash, or an
// explicit null (it had no glossary, as zh-Hans): a missing entry is not
// "no glossary".
const glossaryHash = (tag: string): string | null => {
  const hash: unknown = Object.hasOwn(ledger.glossaries, tag)
    ? ledger.glossaries[tag]
    : undefined;
  if (hash === null || typeof hash === "string") return hash;
  return fail(`the translation run has no glossary hash for ${tag}`);
};
for (const tag of tags) {
  if (!ledger.languages.includes(tag))
    fail(`${tag} is not in the translation run`);
  glossaryHash(tag);
}

const book = ledger.book;
const englishPath = `data/titles/en/${book}.json`;
const englishFile = new URL(englishPath, root);
if (!existsSync(englishFile)) fail(`no English titles for ${book}`);
const englishText = readFileSync(englishFile, "utf8");
if (sha256(englishText) !== ledger.english.sha256)
  fail(`${englishPath} has changed since the translation run`);
const english = JSON.parse(englishText) as EnglishTitles;
if (english.book !== book) fail(`${englishPath} is not for ${book}`);

const promptPath = "prompts/check-translations.md";
const promptFile = readFileSync(new URL(promptPath, root), "utf8");

const files: TranslatedFile[] = [];
const glossaries: Record<string, Glossary | null> = {};
// Languages in the run with no file: the translator stopped or failed there.
const notInRun: string[] = [];
for (const tag of tags) {
  const file = new URL(`${tag}/${book}.json`, runDir);
  if (!existsSync(file)) {
    console.log(`${tag}: no translations in the run; not checked`);
    notInRun.push(tag);
    continue;
  }
  const translated = ((): TranslatedFile => {
    try {
      return JSON.parse(readFileSync(file, "utf8")) as TranslatedFile;
    } catch {
      return fail(`${tag}/${book}.json is not JSON`);
    }
  })();
  if (
    typeof translated.titles !== "object" ||
    translated.titles === null ||
    Array.isArray(translated.titles)
  )
    fail(`${tag}/${book}.json has no titles object`);
  // The language a file says it is decides its glossary and where its
  // output is written, so it must be the directory it was found in.
  if (translated.language !== tag || translated.book !== book)
    fail(
      `${tag}/${book}.json is for ${translated.language} ${translated.book}`
    );
  files.push(translated);
  // The checker reads the glossary the translator read, or none if it had
  // none (zh-Hans).
  const hash = glossaryHash(tag);
  if (hash === null) {
    glossaries[tag] = null;
    continue;
  }
  const gFile = new URL(`data/glossaries/${tag}/${book}.json`, root);
  if (!existsSync(gFile)) fail(`no glossary for ${tag} ${book}`);
  const text = readFileSync(gFile, "utf8");
  if (sha256(text) !== hash)
    fail(`the ${tag} glossary has changed since the translation run`);
  glossaries[tag] = JSON.parse(text) as Glossary;
}

// Where the translation run is, relative to the repository; null outside it.
const runInRepo = relative(fileURLToPath(root), fileURLToPath(runDir));
const runPath =
  runInRepo === ".." || runInRepo.startsWith("../") || isAbsolute(runInRepo)
    ? null
    : `${runInRepo === "" ? "." : runInRepo}/`;

const startedAt = new Date();
const runId = `${startedAt.toISOString().replace(/[:.]/g, "-")}-${model.replace(/[^A-Za-z0-9.-]/g, "_")}`;
const out = new URL(
  `${values.out ?? `.cache/check/${runId}`}/`.replace(/\/+$/, "/"),
  root
);
// A run never writes into the dataset, and never over an earlier run.
const inRepo = relative(fileURLToPath(root), fileURLToPath(out));
if (/^(data|dist)(\/|$)/.test(inRepo))
  fail(`--out must not be inside data/ or dist/: ${inRepo}`);
if (existsSync(out))
  fail(`--out already exists: ${fileURLToPath(out)}; choose a new directory`);

try {
  const { stop, summary } = await checkBook({
    english,
    files,
    glossaries,
    promptFile,
    model,
    maxCost,
    complete: (request) => complete(request, { apiKey }),
    write: (path, value) => {
      const file = new URL(path, out);
      if (!file.href.startsWith(out.href))
        throw new Error(`refusing to write outside --out: ${path}`);
      return writeJson(file, value);
    },
    meta: {
      book,
      startedAt: startedAt.toISOString(),
      translation: {
        run: runPath,
        model: ledger.model,
        sha256: sha256(ledgerText),
      },
      prompt: { file: promptPath, sha256: sha256(promptFile) },
      english: { file: englishPath, sha256: sha256(englishText) },
      notInRun,
      glossaries: Object.fromEntries(tags.map((t) => [t, glossaryHash(t)])),
    },
    log: (line) => console.log(line),
  });
  console.log(JSON.stringify(summary));
  console.log(`written to ${out.pathname}`);
  if (stop !== "done") {
    console.error(`check: stopped early: ${JSON.stringify(stop)}`);
    process.exit(2);
  }
  if (notInRun.length > 0) {
    console.error(`check: no translations to check for ${notInRun.join(", ")}`);
    process.exit(2);
  }
  if (summary.missing + summary.invalid + summary.unreadable > 0) {
    console.error("check: some verdicts are missing, invalid or unreadable");
    process.exit(2);
  }
} catch (e) {
  console.error(`check: ${(e as Error).message}`);
  console.error(`check: the ledger is in ${out.pathname}run.json`);
  process.exit(1);
}
