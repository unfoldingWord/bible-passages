// Drafts one book's English segment titles with one model and checks every
// title with a second model, through OpenRouter. See
// scripts/lib/segment-titles.ts and prompts/segment-titles.md.
//
//   OPENROUTER_API_KEY=... node scripts/translate/segment-titles.ts \
//     --book PHP \
//     --draft-model anthropic/claude-sonnet-5.5 \
//     --check-model google/gemini-3.8-flash \
//     [--out .cache/segment-titles/<run>] [--max-cost 1.00]
//
// Inputs, all offline apart from the two calls: the book's structure
// (data/structure/<BOOK>.json) and its BSB text, read through its pin.
//
// The key is read only from the environment and is never written or printed.
// Output goes to --out, by default under .cache/ (not committed):
// `en/<BOOK>.json`, the record, and `run.json`, the ledger of both calls,
// rewritten after each call and on any failure. To keep a run, copy the record
// unchanged to data/drafts/en/<BOOK>.json and rebuild.
// Exit 0: every segment drafted and checked. Exit 2: the run stopped early or
// some titles are missing or unreadable. Exit 1: an error.
import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { complete } from "../lib/openrouter.ts";
import {
  draftSegmentTitles,
  segmentInputs,
  verseTexts,
} from "../lib/segment-titles.ts";
import { readSource } from "../lib/sources.ts";
import { parseHeadings, type Structure } from "../lib/structure.ts";
import { writeJson } from "../lib/write.ts";

const root = new URL("../../", import.meta.url);

const fail = (message: string): never => {
  console.error(`segment-titles: ${message}`);
  process.exit(1);
};

const { values } = parseArgs({
  options: {
    book: { type: "string" },
    "draft-model": { type: "string" },
    "check-model": { type: "string" },
    out: { type: "string" },
    "max-cost": { type: "string", default: "1.00" },
  },
});

const apiKey = process.env.OPENROUTER_API_KEY ?? "";
if (apiKey.trim() === "")
  fail("OPENROUTER_API_KEY is not set; the runner reads the key only from it");

const book = values.book ?? fail("--book is required (e.g. PHP)");
const draftModel = values["draft-model"] ?? fail("--draft-model is required");
const checkModel = values["check-model"] ?? fail("--check-model is required");
const maxCost = Number(values["max-cost"]);
if (!(Number.isFinite(maxCost) && maxCost > 0))
  fail("--max-cost must be a positive number of dollars");
if (draftModel === checkModel)
  fail("--check-model must differ from --draft-model");

const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-en-${book}`;
const out = new URL(
  `${values.out ?? `.cache/segment-titles/${runId}`}/`.replace(/\/+$/, "/"),
  root
);
// A run never writes into the dataset: the record is committed by hand,
// unchanged, after a person has looked at the run.
const inRepo = relative(fileURLToPath(root), fileURLToPath(out));
if (/^(data|dist)(\/|$)/.test(inRepo))
  fail(`--out must not be inside data/ or dist/: ${inRepo}`);
if (existsSync(out))
  fail(`--out already exists: ${fileURLToPath(out)}; choose a new directory`);

const structureFile = new URL(`data/structure/${book}.json`, root);
if (!existsSync(structureFile)) fail(`no structure for ${book}`);
const structure = JSON.parse(readFileSync(structureFile, "utf8")) as Structure;
const bible = `bsb-${book.toLowerCase()}`;
const usfm = await readSource(bible);
const { inputs, reused } = segmentInputs(
  structure,
  parseHeadings(usfm),
  verseTexts(usfm)
);

const promptPath = "prompts/segment-titles.md";
const promptText = readFileSync(new URL(promptPath, root), "utf8");

try {
  const { record, outcome } = await draftSegmentTitles({
    book,
    bible,
    inputs,
    prompt: { file: promptPath, text: promptText },
    draftModel,
    checkModel,
    maxCost,
    complete: (request) => complete(request, { apiKey }),
    write: (ledger) => writeJson(new URL("run.json", out), ledger),
  });
  if (record) {
    await writeJson(new URL(`en/${book}.json`, out), record);
    const titles = Object.values(record.titles);
    console.log(
      `en ${book}: ${titles.length} of ${inputs.length} segments drafted ` +
        `(${reused.length} reuse their pericope title), ` +
        `${titles.filter((t) => t.status === "ai-checked").length} ai-checked, ` +
        `${titles.filter((t) => t.check?.verdict === "disagree").length} disagreements, ` +
        `${titles.filter((t) => t.gates).length} gate failures`
    );
    for (const c of record.calls)
      console.log(
        `${c.role} ${c.model}: ${c.promptTokens}+${c.completionTokens} tokens` +
          ` (${c.reasoningTokens ?? "?"} reasoning), $${c.cost?.toFixed(6) ?? "unknown"}, ${c.ms} ms`
      );
  }
  console.log(`written to ${out.pathname}`);
  if (outcome !== "done") {
    console.error(`segment-titles: ${JSON.stringify(outcome)}`);
    process.exit(2);
  }
} catch (e) {
  console.error(`segment-titles: ${(e as Error).message}`);
  console.error(`segment-titles: the ledger is in ${out.pathname}run.json`);
  process.exit(1);
}
