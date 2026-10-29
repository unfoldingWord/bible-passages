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
// totals. Exit 0: every translation has a verdict. Exit 2: the run stopped
// early or some verdicts are missing, invalid or unreadable. Exit 1: an
// error; the ledger still holds what was spent.
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { checkBook, family, type TranslatedFile } from "../lib/check.ts";
import { complete } from "../lib/openrouter.ts";
import { sha256, type EnglishTitles, type Glossary } from "../lib/translate.ts";
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
const ledger = JSON.parse(ledgerText) as {
  book: string;
  model: string;
  languages: string[];
  english: { file: string; sha256: string };
  glossaries: Record<string, string | null>;
};
if (family(ledger.model) === family(model))
  fail(`${ledger.model} must be checked by another family, not ${model}`);
const tags = values.lang ? values.lang.split(",") : ledger.languages;
for (const tag of tags)
  if (!ledger.languages.includes(tag))
    fail(`${tag} is not in the translation run`);

const book = ledger.book;
const englishPath = `data/titles/en/${book}.json`;
const englishFile = new URL(englishPath, root);
if (!existsSync(englishFile)) fail(`no English titles for ${book}`);
const englishText = readFileSync(englishFile, "utf8");
if (sha256(englishText) !== ledger.english.sha256)
  fail(`${englishPath} has changed since the translation run`);
const english = JSON.parse(englishText) as EnglishTitles;

const promptPath = "prompts/check-translations.md";
const promptFile = readFileSync(new URL(promptPath, root), "utf8");

const files: TranslatedFile[] = [];
const glossaries: Record<string, Glossary | null> = {};
for (const tag of tags) {
  const file = new URL(`${tag}/${book}.json`, runDir);
  if (!existsSync(file)) {
    console.log(`${tag}: no translations in the run; not checked`);
    continue;
  }
  files.push(JSON.parse(readFileSync(file, "utf8")) as TranslatedFile);
  // The checker reads the glossary the translator read, or none if it had
  // none (zh-Hans).
  const hash = ledger.glossaries[tag] ?? null;
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
    write: (path, value) => writeJson(new URL(path, out), value),
    meta: {
      book,
      startedAt: startedAt.toISOString(),
      translation: {
        run: fileURLToPath(runDir),
        model: ledger.model,
        sha256: sha256(ledgerText),
      },
      prompt: { file: promptPath, sha256: sha256(promptFile) },
      english: { file: englishPath, sha256: sha256(englishText) },
      glossaries: Object.fromEntries(
        tags.map((t) => [t, ledger.glossaries[t] ?? null])
      ),
    },
    log: (line) => console.log(line),
  });
  console.log(JSON.stringify(summary));
  console.log(`written to ${out.pathname}`);
  if (stop !== "done") {
    console.error(`check: stopped early: ${JSON.stringify(stop)}`);
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
