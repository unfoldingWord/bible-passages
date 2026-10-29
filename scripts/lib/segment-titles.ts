// Drafts one book's English segment titles with one model and checks every
// title with a second model of another family (issue #8; prompts/
// segment-titles.md). Pure apart from the injected `complete` and `write`,
// so tests run it with a fake model.
//
// Everything it returns is AI output: `source: "ai:<model>"`, and a title is
// `ai-checked` only when the checker agreed and every gate passed; anything
// else stays `unreviewed` and goes to a person first (AGENTS.md).
//
// A segment that is its pericope's only segment is not drafted: it reuses
// the pericope title (decision 12, docs/decisions/0003), which the build
// fills in (scripts/data/build.ts).
import { callRecord, type CallRecord } from "./key-terms.ts";
import type { Completion, Message } from "./openrouter.ts";
import type { Heading, Structure } from "./structure.ts";
import { parseReply, sha256 } from "./translate.ts";

/** The longest title, in characters (prompts/segment-titles.md, rule 6). */
export const MAX_TITLE = 60;

/** What the checker judges (prompts/segment-titles.md, the check part). */
export const CRITERIA = ["accurate", "covers", "plain", "style"] as const;
export type Criterion = (typeof CRITERIA)[number];

// Lines that are not verse text: identification, book names, section
// headings and their cross-references.
const SKIP = /^\\(id|usfm|ide|h|toc\d|mt\d?|ms\d?|s\d?|r|d|sp|cl)(\s|$)/;

/**
 * Each verse's text, keyed `<chapter>:<verse>`, from a BSB USFM file:
 * alignment, word and paragraph markers removed, footnotes and headings
 * dropped, whitespace collapsed. Anything left that still looks like USFM
 * fails rather than reaching a model.
 */
export function verseTexts(usfm: string): Map<string, string> {
  const body = usfm
    .split(/\r?\n/)
    .filter((line) => !SKIP.test(line))
    .join("\n")
    .replace(/\\f\s.*?\\f\*/gs, "")
    .replace(/\\x\s.*?\\x\*/gs, "")
    .replace(/\\zaln-s\s[^\\]*\\\*/g, "")
    .replace(/\\zaln-e\\\*/g, "")
    .replace(/\\w\s+([^|\\]*)(\|[^\\]*)?\\w\*/g, "$1");
  const out = new Map<string, string>();
  let chapter = 0;
  let verse: string | null = null;
  const marker = /\\(c|v)\s+(\d+)\s?/g;
  let last = 0;
  const flush = (end: number) => {
    if (verse === null) return;
    const text = body
      .slice(last, end)
      .replace(/\\(m|mi|p|pi\d?|q\d?|b|nb|pc|li\d?)(\s|$)/g, " ")
      .replace(/\s+/g, " ")
      .replace(/ ([,.;:!?)’”])/g, "$1")
      .trim();
    if (text === "" || text.includes("\\"))
      throw new Error(`cannot read verse ${verse}: "${text.slice(0, 80)}"`);
    out.set(verse, text);
  };
  for (const m of body.matchAll(marker)) {
    flush(m.index);
    if (m[1] === "c") {
      chapter = Number(m[2]);
      verse = null;
    } else {
      verse = `${chapter}:${Number(m[2])}`;
    }
    last = m.index + m[0].length;
  }
  flush(body.length);
  return out;
}

/** What both models are told about one segment. */
export type SegmentInput = {
  key: string;
  /** `1:3–6`, or `1:21` for one verse. */
  verses: string;
  /** The BSB heading of its pericope, for context only. */
  pericope: string;
  /** The segment's verses, plain BSB text. */
  text: string;
};

/**
 * The segments to draft, in reading order, and the keys left out because
 * the segment is its pericope's only one (decision 12).
 */
export function segmentInputs(
  structure: Structure,
  headings: Heading[],
  verses: Map<string, string>
): { inputs: SegmentInput[]; reused: string[] } {
  const titleOf = new Map<string, string>();
  for (const h of headings) {
    const p = structure.pericopes.find(
      (p) => p.start[0] === h.chapter && p.start[1] === h.verse
    );
    if (!p)
      throw new Error(`${h.chapter}:${h.verse}: heading without pericope`);
    titleOf.set(p.key, h.text);
  }
  const count = new Map<string, number>();
  for (const s of structure.segments)
    count.set(s.pericope, (count.get(s.pericope) ?? 0) + 1);
  const inputs: SegmentInput[] = [];
  const reused: string[] = [];
  for (const s of structure.segments) {
    if (count.get(s.pericope) === 1) {
      reused.push(s.key);
      continue;
    }
    const [c, from] = s.start;
    const to = s.end[1];
    if (s.end[0] !== c) throw new Error(`${s.key} crosses a chapter`);
    const text: string[] = [];
    for (let v = from; v <= to; v++) {
      const t = verses.get(`${c}:${v}`);
      // A verse BSB leaves out (none in the New Testament books measured so
      // far) would silently shorten the input, so it fails instead.
      if (t === undefined) throw new Error(`${s.key}: no text for ${c}:${v}`);
      text.push(t);
    }
    const pericope = titleOf.get(s.pericope);
    if (pericope === undefined)
      throw new Error(`${s.key}: pericope ${s.pericope} has no heading`);
    inputs.push({
      key: s.key,
      verses: from === to ? `${c}:${from}` : `${c}:${from}–${to}`,
      pericope,
      text: text.join(" "),
    });
  }
  return { inputs, reused };
}

/** The system prompt between `<!-- <part>:start -->` and `<!-- <part>:end -->`. */
export function promptPart(file: string, part: "draft" | "check"): string {
  const open = `<!-- ${part}:start -->`;
  const close = `<!-- ${part}:end -->`;
  const start = file.indexOf(open);
  const end = file.indexOf(close);
  if (start < 0 || end < start)
    throw new Error(`prompt file has no ${part}:start/${part}:end markers`);
  return file.slice(start + open.length, end).trim();
}

/** The drafting model's user message. */
export const draftMessage = (book: string, inputs: SegmentInput[]): string =>
  JSON.stringify({ book, segments: inputs }, null, 2);

/** The checking model's user message: the same, with each draft. */
export function checkMessage(
  book: string,
  inputs: SegmentInput[],
  drafts: Record<string, string>
): string {
  const segments = inputs
    .filter((s) => drafts[s.key] !== undefined)
    .map((s) => ({ ...s, draft: drafts[s.key] }));
  return JSON.stringify({ book, segments }, null, 2);
}

const isText = (v: unknown): v is string =>
  typeof v === "string" && v.trim() !== "";

/** Reads the drafting model's reply: `{ "<key>": "<title>" }`. */
export function readDraft(
  reply: Record<string, unknown>,
  keys: string[]
): { titles: Record<string, string>; missing: string[]; invalid: string[] } {
  const titles: Record<string, string> = {};
  const missing: string[] = [];
  const invalid: string[] = [];
  for (const k of keys) {
    const v = reply[k];
    if (v === undefined) missing.push(k);
    else if (!isText(v)) invalid.push(k);
    else titles[k] = v.trim().normalize("NFC");
  }
  return { titles, missing, invalid };
}

/** The checker's verdict on one draft, as data/drafts/ records it. */
export type Check =
  | { by: string; verdict: "agree" }
  | {
      by: string;
      verdict: "disagree";
      criteria: Criterion[];
      why: string;
      suggestion: string;
    };

/**
 * Reads the checker's reply: `{ "<key>": { "verdict": "agree" } }` or
 * `{ "verdict": "disagree", "criteria", "why", "suggestion" }`. A
 * disagreement must name at least one known criterion.
 */
export function readCheck(
  reply: Record<string, unknown>,
  keys: string[],
  by: string
): { checks: Record<string, Check>; missing: string[]; invalid: string[] } {
  const checks: Record<string, Check> = {};
  const missing: string[] = [];
  const invalid: string[] = [];
  const known = new Set<string>(CRITERIA);
  for (const k of keys) {
    const raw = reply[k];
    if (raw === undefined) {
      missing.push(k);
      continue;
    }
    const v =
      typeof raw === "object" && raw !== null && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : null;
    if (v?.verdict === "agree") {
      checks[k] = { by, verdict: "agree" };
      continue;
    }
    const criteria = v?.criteria;
    if (
      v?.verdict === "disagree" &&
      Array.isArray(criteria) &&
      criteria.length > 0 &&
      criteria.every((c) => typeof c === "string" && known.has(c)) &&
      isText(v.why) &&
      isText(v.suggestion)
    ) {
      checks[k] = {
        by,
        verdict: "disagree",
        // In the prompt's order, once each.
        criteria: CRITERIA.filter((c) => criteria.includes(c)),
        why: v.why.trim(),
        suggestion: v.suggestion.trim().normalize("NFC"),
      };
    } else {
      invalid.push(k);
    }
  }
  return { checks, missing, invalid };
}

/**
 * The mechanical rules a title must meet (prompts/segment-titles.md, rules
 * 3, 6 and 7). Sentence case and the rest need a reader: the checker and
 * then a person.
 */
export function gateProblems(text: string): string[] {
  const problems: string[] = [];
  if ([...text].length > MAX_TITLE) problems.push("length");
  if (/[.]$/.test(text)) problems.push("full-stop");
  if (/["“”]/.test(text)) problems.push("quotes");
  if (/'/.test(text)) problems.push("straight-apostrophe");
  if (/[\r\n]/.test(text)) problems.push("line-break");
  if (/[<>\\*_`]/.test(text)) problems.push("markup");
  return problems;
}

/** One title of the record. */
export type DraftTitle = {
  text: string;
  source: string;
  status: "unreviewed" | "ai-checked";
  /** Gate problems; absent when every gate passed. */
  gates?: string[];
  /** Absent only when the checker gave no usable verdict for the title. */
  check?: Check;
};

/** data/drafts/en/<BOOK>.json: a recorded AI output. */
export type DraftRecord = {
  language: "en";
  book: string;
  /** sources.json id of the BSB text both models were given. */
  bible: string;
  prompt: { file: string; sha256: string };
  /** The two calls, with tokens and cost as OpenRouter billed them. */
  calls: CallRecord[];
  titles: Record<string, DraftTitle>;
};

/**
 * A model's family: the provider in its OpenRouter id (`anthropic`,
 * `google`). The check is by another family (ADR 0002, AGENTS.md).
 */
export const family = (model: string): string => model.split("/")[0] ?? model;

export type Complete = (request: {
  model: string;
  messages: Message[];
}) => Promise<Completion>;

export type DraftOutcome =
  | "done"
  | { stopped: string }
  | { incomplete: { draft: string[]; check: string[] } };

/**
 * Drafts and checks one book's segment titles: one call to `draftModel`,
 * then one to `checkModel`, which must differ. `write` gets the ledger after
 * each call and before any throw, so money spent is on record. The check
 * call is not made once `maxCost` is spent, or when the draft's cost is
 * unknown (the fuse fails closed).
 */
export async function draftSegmentTitles(args: {
  book: string;
  bible: string;
  inputs: SegmentInput[];
  prompt: { file: string; text: string };
  draftModel: string;
  checkModel: string;
  maxCost: number;
  complete: Complete;
  write: (ledger: unknown) => Promise<void>;
}): Promise<{ record: DraftRecord | null; outcome: DraftOutcome }> {
  const { book, inputs, draftModel, checkModel } = args;
  if (family(draftModel) === family(checkModel))
    throw new Error(
      "the checking model must be of a different family from the drafting model"
    );
  if (inputs.length === 0) throw new Error(`${book}: no segment to draft`);
  const keys = inputs.map((s) => s.key);
  const prompt = { file: args.prompt.file, sha256: sha256(args.prompt.text) };
  const calls: CallRecord[] = [];
  // The parsed draft, kept in the ledger so a run that stops before the
  // check does not lose titles already paid for.
  let draftTitles: Record<string, string> | null = null;
  const ledger = (outcome: DraftOutcome | "running") =>
    args.write({
      language: "en",
      book,
      draftModel,
      checkModel,
      maxCost: args.maxCost,
      prompt,
      segments: keys.length,
      outcome,
      updatedAt: new Date().toISOString(),
      calls,
      draftTitles,
      totals: {
        promptTokens: calls.reduce((s, c) => s + c.promptTokens, 0),
        completionTokens: calls.reduce((s, c) => s + c.completionTokens, 0),
        cost: calls.every((c) => c.cost !== null)
          ? calls.reduce((s, c) => s + (c.cost ?? 0), 0)
          : null,
        ms: calls.reduce((s, c) => s + c.ms, 0),
      },
    });

  const ask = async (
    role: CallRecord["role"],
    model: string,
    user: string
  ): Promise<Record<string, unknown> | string> => {
    const c = await args.complete({
      model,
      messages: [
        { role: "system", content: promptPart(args.prompt.text, role) },
        { role: "user", content: user },
      ],
    });
    calls.push(callRecord(role, c));
    await ledger("running");
    if (c.problem !== undefined) return `no reply: ${c.problem}`;
    try {
      return parseReply(c.text);
    } catch (e) {
      return `unreadable reply: ${(e as Error).message}`;
    }
  };

  let outcome: DraftOutcome = "done";
  try {
    const draftReply = await ask(
      "draft",
      draftModel,
      draftMessage(book, inputs)
    );
    if (typeof draftReply === "string") {
      outcome = { stopped: `draft: ${draftReply}` };
      return { record: null, outcome };
    }
    const draft = readDraft(draftReply, keys);
    draftTitles = draft.titles;
    await ledger("running");
    const spent = calls[0]?.cost ?? null;
    if (spent === null) {
      outcome = { stopped: "draft cost unknown; check not run" };
      return { record: null, outcome };
    }
    if (spent >= args.maxCost) {
      outcome = { stopped: `spent ${spent} of ${args.maxCost} before check` };
      return { record: null, outcome };
    }
    const checkReply = await ask(
      "check",
      checkModel,
      checkMessage(book, inputs, draft.titles)
    );
    if (typeof checkReply === "string") {
      outcome = { stopped: `check: ${checkReply}` };
      return { record: null, outcome };
    }
    // Two requested ids can resolve to one model. A model never checks its
    // own drafts, nor one of its family, so judge by the models OpenRouter
    // says answered.
    const draftedBy = calls[0]?.model ?? draftModel;
    const checkedBy = calls[1]?.model ?? checkModel;
    if (draftedBy === checkedBy) {
      outcome = {
        stopped: `check answered by the drafting model ${draftedBy}`,
      };
      return { record: null, outcome };
    }
    if (family(draftedBy) === family(checkedBy)) {
      outcome = {
        stopped: `check answered by ${checkedBy}, of the drafting model's family`,
      };
      return { record: null, outcome };
    }
    const drafted = keys.filter((k) => draft.titles[k] !== undefined);
    // Labelled with the model OpenRouter says answered, as key-terms.ts does.
    const check = readCheck(checkReply, drafted, `ai:${checkedBy}`);
    const source = `ai:${draftedBy}`;
    const titles: Record<string, DraftTitle> = {};
    for (const k of drafted) {
      const text = draft.titles[k]!;
      const problems = gateProblems(text);
      const gates = problems.length > 0 ? problems : undefined;
      const c = check.checks[k];
      titles[k] = {
        text,
        source,
        status:
          c?.verdict === "agree" && gates === undefined
            ? "ai-checked"
            : "unreviewed",
        ...(gates ? { gates } : {}),
        ...(c ? { check: c } : {}),
      };
    }
    const unreadDraft = [...draft.missing, ...draft.invalid];
    const unreadCheck = [...check.missing, ...check.invalid];
    if (unreadDraft.length + unreadCheck.length > 0)
      outcome = { incomplete: { draft: unreadDraft, check: unreadCheck } };
    const record: DraftRecord = {
      language: "en",
      book,
      bible: args.bible,
      prompt,
      calls,
      titles,
    };
    return { record, outcome };
  } catch (e) {
    outcome = { stopped: `error: ${(e as Error).message}` };
    throw e;
  } finally {
    await ledger(outcome);
  }
}
