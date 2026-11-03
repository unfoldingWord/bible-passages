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
import { FORMAT_ALLOWED, hasFormat } from "./format.ts";
import { callRecord, type CallRecord } from "./key-terms.ts";
import { LINE_BREAK } from "./line-breaks.ts";
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
 * then a person. A title is also on one line (`line-break`: every mandatory
 * break) and has no control or invisible format character (`format`: see
 * FORMAT in format.ts; English allows none), as the key-term and translation
 * gates require.
 */
export function gateProblems(text: string): string[] {
  const problems: string[] = [];
  if ([...text].length > MAX_TITLE) problems.push("length");
  if (/[.]$/.test(text)) problems.push("full-stop");
  if (/["“”]/.test(text)) problems.push("quotes");
  if (/'/.test(text)) problems.push("straight-apostrophe");
  if (LINE_BREAK.test(text)) problems.push("line-break");
  if (hasFormat(text, FORMAT_ALLOWED.en!)) problems.push("format");
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
  maxTokens?: number;
}) => Promise<Completion>;

export type DraftOutcome =
  | "done"
  | { stopped: string }
  | { incomplete: { draft: string[]; check: string[] } };

/**
 * The most drafts one check call judges (#201). One reply must hold every
 * verdict of its batch, and the longest book has 1,134 titles to draft
 * (Psalms), past what one reply can hold. Each draft is still judged against
 * its own verses with the same criteria; only the number per call changes.
 * 35 keeps a batch within the whole-book checks measured so far (Colossians
 * 33, Philippians 37): docs/scoping/sizing.md.
 */
export const CHECK_BATCH = 35;

/**
 * The completion limit of each check call, reasoning included (#201). Under
 * MAX_TOKENS (16,384) Gemini Flash reasoned to the limit on Colossians and
 * its reply was cut off or empty; with this limit a whole Colossians check
 * reasoned 17,252 tokens and replied in 1,261. A reasoning budget did not
 * hold (8,192 asked, 16,394 used, no reply), so the call gets room instead
 * of a cap. Measured: docs/scoping/sizing.md.
 */
export const CHECK_MAX_TOKENS = 32_768;

/**
 * The most segments one draft call titles (#208). One reply must hold every
 * title of its batch, after the drafting model's reasoning, under MAX_TOKENS
 * (16,384): a whole Colossians draft of 33 titles used 5,622 to 6,311
 * completion tokens, and Genesis has 642 titles to draft, Psalms 1,134. Each
 * segment is still drafted from its own verses and pericope heading with the
 * same prompt; only the number per call changes. 35, as for the check, keeps
 * a batch within the whole-book drafts measured so far (Colossians 33,
 * Philippians 37): docs/scoping/sizing.md.
 */
export const DRAFT_BATCH = 35;

/**
 * `items` split, in order, into the fewest batches of at most `size`, as
 * even as they can be (37 at 35 gives 19 and 18).
 */
export function batches<T>(items: T[], size: number): T[][] {
  if (!(Number.isSafeInteger(size) && size > 0))
    throw new Error(`batch size must be a positive integer: ${size}`);
  const count = Math.ceil(items.length / size);
  const out: T[][] = [];
  let from = 0;
  for (let i = 0; i < count; i++) {
    const n = Math.ceil((items.length - from) / (count - i));
    out.push(items.slice(from, from + n));
    from += n;
  }
  return out;
}

/**
 * Drafts and checks one book's segment titles: one call to `draftModel` per
 * batch of at most `draftBatch` segments (default DRAFT_BATCH), then one
 * call to `checkModel` per batch of at most `checkBatch` drafts (default
 * CHECK_BATCH). A draft call is allowed MAX_TOKENS, a check call
 * CHECK_MAX_TOKENS. The two models must be of different families. `write`
 * gets the ledger after each call and before any throw, so money spent is
 * on record. No call, draft or check, is made once `maxCost` is spent, or
 * while any cost so far is unknown (the fuse fails closed). A draft or check reply that cannot be read stops the run,
 * as does a check answered by a model that drafted any title of its batch,
 * or by one of that model's family.
 */
export async function draftSegmentTitles(args: {
  book: string;
  bible: string;
  inputs: SegmentInput[];
  prompt: { file: string; text: string };
  draftModel: string;
  checkModel: string;
  maxCost: number;
  draftBatch?: number;
  checkBatch?: number;
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
  // The parsed drafts, batch by batch, kept in the ledger so a run that
  // stops before the check does not lose titles already paid for.
  let draftTitles: Record<string, string> | null = null;
  // The parsed verdicts, batch by batch, kept in the ledger for the same
  // reason: a later batch that stops the run does not lose earlier ones
  // (#211). `checkUnread` are the keys a batch left out or answered
  // unreadably.
  let checkVerdicts: Record<string, Check> | null = null;
  let checkUnread: string[] = [];
  const ledger = (outcome: DraftOutcome | "running") =>
    args.write({
      language: "en",
      book,
      draftModel,
      checkModel,
      maxCost: args.maxCost,
      draftBatch: args.draftBatch ?? DRAFT_BATCH,
      checkBatch: args.checkBatch ?? CHECK_BATCH,
      checkMaxTokens: CHECK_MAX_TOKENS,
      prompt,
      segments: keys.length,
      outcome,
      updatedAt: new Date().toISOString(),
      calls,
      draftTitles,
      checks: checkVerdicts,
      checkUnread,
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
      // A draft call keeps MAX_TOKENS (openrouter.ts), the default.
      ...(role === "check" ? { maxTokens: CHECK_MAX_TOKENS } : {}),
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
  // The spend fuse, before every call: null when the call may go ahead.
  // Every stop names the call it stopped at, as `<at>: <why>` (#211).
  const fuse = (at: string): string | null => {
    const costs = calls.map((c) => c.cost);
    if (costs.some((c) => c === null)) return `${at}: cost unknown, not run`;
    const spent = costs.reduce<number>((s, c) => s + (c ?? 0), 0);
    return spent >= args.maxCost
      ? `${at}: spent ${spent} of ${args.maxCost}, not run`
      : null;
  };
  try {
    const titlesDrafted: Record<string, string> = {};
    // The model OpenRouter says answered each title's draft call.
    const draftedBy: Record<string, string> = {};
    const unreadDraft: string[] = [];
    const toDraft = batches(inputs, args.draftBatch ?? DRAFT_BATCH);
    for (const [i, batch] of toDraft.entries()) {
      const stop = fuse(`draft batch ${i + 1} of ${toDraft.length}`);
      if (stop !== null) {
        outcome = { stopped: stop };
        return { record: null, outcome };
      }
      const draftReply = await ask(
        "draft",
        draftModel,
        draftMessage(book, batch)
      );
      if (typeof draftReply === "string") {
        outcome = {
          stopped: `draft batch ${i + 1} of ${toDraft.length}: ${draftReply}`,
        };
        return { record: null, outcome };
      }
      const by = calls.at(-1)?.model ?? draftModel;
      const draft = readDraft(
        draftReply,
        batch.map((s) => s.key)
      );
      for (const [k, t] of Object.entries(draft.titles)) {
        titlesDrafted[k] = t;
        draftedBy[k] = by;
      }
      unreadDraft.push(...draft.missing, ...draft.invalid);
      draftTitles = { ...titlesDrafted };
      await ledger("running");
    }
    const drafted = keys.filter((k) => titlesDrafted[k] !== undefined);
    const checks: Record<string, Check> = {};
    const unreadCheck: string[] = [];
    const toCheck = batches(
      inputs.filter((s) => titlesDrafted[s.key] !== undefined),
      args.checkBatch ?? CHECK_BATCH
    );
    // With no draft to check no call follows, but a run whose cost is
    // unknown or over the cap still ends stopped, as it did when the check
    // was one call (#211).
    if (toCheck.length === 0) {
      const stop = fuse("check");
      if (stop !== null) {
        outcome = { stopped: stop };
        return { record: null, outcome };
      }
    }
    for (const [i, batch] of toCheck.entries()) {
      // Which check call was refused; earlier ones are in the ledger.
      const at = `check batch ${i + 1} of ${toCheck.length}`;
      const stop = fuse(at);
      if (stop !== null) {
        outcome = { stopped: stop };
        return { record: null, outcome };
      }
      const checkReply = await ask(
        "check",
        checkModel,
        checkMessage(book, batch, titlesDrafted)
      );
      if (typeof checkReply === "string") {
        outcome = { stopped: `${at}: ${checkReply}` };
        return { record: null, outcome };
      }
      // Two requested ids can resolve to one model. A model never checks
      // its own drafts, nor one of its family, so judge by the models
      // OpenRouter says answered: this check call and every draft call
      // that titled a segment of this batch.
      const checkedBy = calls.at(-1)?.model ?? checkModel;
      const drafters = new Set(batch.map((s) => draftedBy[s.key]!));
      for (const d of drafters) {
        if (d === checkedBy) {
          outcome = {
            stopped: `${at}: answered by the drafting model ${d}`,
          };
          return { record: null, outcome };
        }
        if (family(d) === family(checkedBy)) {
          outcome = {
            stopped: `${at}: answered by ${checkedBy}, of the drafting model's family`,
          };
          return { record: null, outcome };
        }
      }
      // Labelled with the model OpenRouter says answered, as key-terms.ts does.
      const check = readCheck(
        checkReply,
        batch.map((s) => s.key),
        `ai:${checkedBy}`
      );
      Object.assign(checks, check.checks);
      unreadCheck.push(...check.missing, ...check.invalid);
      checkVerdicts = { ...checks };
      checkUnread = [...unreadCheck];
      await ledger("running");
    }
    const titles: Record<string, DraftTitle> = {};
    for (const k of drafted) {
      const text = titlesDrafted[k]!;
      // Labelled with the model that answered this title's draft call.
      const source = `ai:${draftedBy[k]!}`;
      const problems = gateProblems(text);
      const gates = problems.length > 0 ? problems : undefined;
      const c = checks[k];
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
