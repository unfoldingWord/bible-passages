// The third check (ADR 0005 item 6, issue #198): sends every English segment
// title the checker disagreed with to a third model, which reads the verses
// in the pinned ULT and sorts the dispute as factual or taste, then sends
// every title it gives back through the record's checker (#207). See
// scripts/lib/dispute-titles.ts and prompts/dispute-titles.md.
//
//   OPENROUTER_API_KEY=... node scripts/translate/dispute-titles.ts \
//     --book PHP --model openai/gpt-6.1-sol \
//     [--recheck-model google/gemini-3.8-flash] \
//     [--record data/drafts/en/PHP.json] [--out .cache/dispute-titles/<run>]
//
// Run after scripts/translate/segment-titles.ts, on its record. Inputs, all
// offline apart from the two calls: the record, the book's structure, its
// BSB text and headings and ULT text (`ult-<book>`), read through their pins,
// the Titus record for the voice (data/drafts/en/TIT.json), and the
// segment-title prompt the record's drafts were checked with (found by its
// SHA-256 in prompts/ or prompts/history/). The recheck model is the
// record's checking model unless --recheck-model names another.
//
// The key is read only from the environment and is never written or printed.
// Output goes to --out, by default under .cache/ (not committed):
// `en/<BOOK>.json`, the record with each answer added as `dispute`,
// `run.json`, the ledger of both calls, and `review.md`, the review sheet
// for a person (#207). To keep a run, copy the record
// unchanged to data/drafts/en/<BOOK>.json and rebuild.
// Exit 0: every disputed title settled (or none to settle). Exit 2: the run
// stopped or some answers are missing or unreadable. Exit 1: an error.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { STRUCTURE_BOOKS } from "../lib/books.ts";
import {
  settleDisputes,
  reviewSheet,
  ultVerseTexts,
  voiceOf,
  type DisputedRecord,
} from "../lib/dispute-titles.ts";
import { complete } from "../lib/openrouter.ts";
import { segmentInputs, verseTexts } from "../lib/segment-titles.ts";
import { sha256 } from "../lib/translate.ts";
import { readSource } from "../lib/sources.ts";
import { parseHeadings, type Structure } from "../lib/structure.ts";
import { writeJson } from "../lib/write.ts";

const root = new URL("../../", import.meta.url);

const fail = (message: string): never => {
  console.error(`dispute-titles: ${message}`);
  process.exit(1);
};

const { values } = parseArgs({
  options: {
    book: { type: "string" },
    model: { type: "string" },
    "recheck-model": { type: "string" },
    record: { type: "string" },
    out: { type: "string" },
  },
});

const apiKey = (process.env.OPENROUTER_API_KEY ?? "").trim();
if (apiKey === "")
  fail("OPENROUTER_API_KEY is not set; the runner reads the key only from it");

const book = values.book ?? fail("--book is required (e.g. PHP)");
const model = values.model ?? fail("--model is required");
if (!STRUCTURE_BOOKS.includes(book)) fail(`not a book code: ${book}`);

const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-en-${book}`;
const out = new URL(
  `${values.out ?? `.cache/dispute-titles/${runId}`}/`.replace(/\/+$/, "/"),
  root
);
const inRepo = relative(fileURLToPath(root), fileURLToPath(out));
if (/^(data|dist)(\/|$)/.test(inRepo))
  fail(`--out must not be inside data/ or dist/: ${inRepo}`);
if (existsSync(out))
  fail(`--out already exists: ${fileURLToPath(out)}; choose a new directory`);

const recordFile = new URL(
  values.record ?? `data/drafts/en/${book}.json`,
  root
);
if (!existsSync(recordFile)) fail(`no record: ${fileURLToPath(recordFile)}`);
const record = JSON.parse(readFileSync(recordFile, "utf8")) as DisputedRecord;
if (record.language !== "en" || record.book !== book)
  fail(`the record is not English ${book}`);

const structure = JSON.parse(
  readFileSync(new URL(`data/structure/${book}.json`, root), "utf8")
) as Structure;
const id = book.toLowerCase();
const verses = `ult-${id}`;
const ult = ultVerseTexts(await readSource(verses));
const bsbText = await readSource(record.bible);
const headings = parseHeadings(bsbText);
const { inputs } = segmentInputs(structure, headings, ult);
const { inputs: bsbInputs } = segmentInputs(
  structure,
  headings,
  verseTexts(bsbText)
);

// The segment-title prompt the record's drafts were checked with: the
// current file or a kept one in prompts/history/, by SHA-256.
const checkPromptFile = (() => {
  const want = record.prompt.sha256;
  if (!/^[0-9a-f]{64}$/.test(want)) return fail("the record's prompt hash");
  for (const f of [
    "prompts/segment-titles.md",
    `prompts/history/segment-titles-${want.slice(0, 12)}.md`,
  ]) {
    const u = new URL(f, root);
    if (existsSync(u) && sha256(readFileSync(u, "utf8")) === want) return f;
  }
  return fail("no kept prompt matches the record's prompt SHA-256");
})();

const voiceFile = "data/drafts/en/TIT.json";
const voiceText = readFileSync(new URL(voiceFile, root), "utf8");
const promptPath = "prompts/dispute-titles.md";

try {
  const { record: settled, outcome } = await settleDisputes({
    record,
    inputs,
    verses,
    voice: {
      file: voiceFile,
      text: voiceText,
      titles: voiceOf(JSON.parse(voiceText) as DisputedRecord),
    },
    prompt: {
      file: promptPath,
      text: readFileSync(new URL(promptPath, root), "utf8"),
    },
    model,
    recheck: {
      prompt: {
        file: checkPromptFile,
        text: readFileSync(new URL(checkPromptFile, root), "utf8"),
      },
      inputs: bsbInputs,
      ...(values["recheck-model"] ? { model: values["recheck-model"] } : {}),
    },
    complete: (request) => complete(request, { apiKey }),
    write: (ledger) => writeJson(new URL("run.json", out), ledger),
  });
  if (settled) {
    await writeJson(new URL(`en/${book}.json`, out), settled);
    writeFileSync(new URL("review.md", out), reviewSheet(settled, inputs));
    const ds = Object.entries(settled.titles).filter(([, t]) => t.dispute);
    const count = (kind: string) =>
      ds.filter(([, t]) => t.dispute?.kind === kind).length;
    console.log(
      `en ${book}: ${ds.length} disputes settled: ${count("taste")} taste, ` +
        `${count("factual")} factual, ` +
        `${ds.filter(([, t]) => t.dispute?.gates).length} gate failures; ` +
        `the checker agreed with ${ds.filter(([, t]) => t.dispute?.recheck?.verdict === "agree").length}, ` +
        `${ds.filter(([, t]) => t.dispute?.status === "ai-checked").length} ai-checked`
    );
    for (const c of settled.calls.filter(
      (c) => c.role === "dispute" || c.role === "recheck"
    ))
      console.log(
        `${c.role} ${c.model}: ${c.promptTokens}+${c.completionTokens} tokens` +
          ` (${c.reasoningTokens ?? "?"} reasoning), $${c.cost?.toFixed(6) ?? "unknown"}, ${c.ms} ms`
      );
  }
  console.log(`written to ${out.pathname}`);
  if (outcome !== "done" && outcome !== "nothing to settle") {
    console.error(`dispute-titles: ${JSON.stringify(outcome)}`);
    process.exit(2);
  }
} catch (e) {
  console.error(`dispute-titles: ${(e as Error).message}`);
  console.error(`dispute-titles: the ledger is in ${out.pathname}run.json`);
  process.exit(1);
}
