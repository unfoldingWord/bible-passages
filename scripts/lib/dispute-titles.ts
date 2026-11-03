// The third check on disputed English segment titles (ADR 0005 item 6,
// issue #198; prompts/dispute-titles.md). After the checker, every title it
// disagreed with goes to a third model, of a family other than the drafting
// and the checking model's, which reads the verses (ULT) and sorts the
// dispute:
//
// - `taste`: its title replaces the draft and is `ai-checked` when it passes
//   the gates;
// - `factual`: its title is a proposal; the title stays `unreviewed` and is
//   listed for the content team.
//
// The draft's own `text`, `source`, `status`, `gates` and `check` are never
// changed: the third model's answer is added beside them as `dispute`, as a
// person's review is added as `review` (docs/schema.md). No AI title rises
// above `ai-checked`. Pure apart from the injected `complete` and `write`,
// so tests run it with a fake model.
import { callRecord, type CallRecord } from "./key-terms.ts";
import type { Completion, Message } from "./openrouter.ts";
import {
  family,
  gateProblems,
  type DraftRecord,
  type DraftTitle,
  type SegmentInput,
  verseTexts,
} from "./segment-titles.ts";
import { parseReply, sha256 } from "./translate.ts";

export const KINDS = ["factual", "taste"] as const;
export type Kind = (typeof KINDS)[number];

/** The third model's answer on one disputed title, as data/drafts/ records it. */
export type Dispute = {
  /** `ai:<model>`, the model OpenRouter says answered. */
  by: string;
  kind: Kind;
  /** The third model's title: the replacement (taste) or the proposal (factual). */
  text: string;
  why: string;
  /** `ai-checked` only for a taste title that passes every gate. */
  status: "ai-checked" | "unreviewed";
  /** Gate problems of `text`; absent when it passes every gate. */
  gates?: string[];
};

/** A title of a record, with the review and dispute it may carry. */
export type Title = DraftTitle & {
  review?: { by: string; status: string; text?: string };
  dispute?: Dispute;
};

/** The dispute call in a record's `calls`. */
export type DisputeCall = Omit<CallRecord, "role"> & { role: "dispute" };

/** What a record that went through the third check also carries. */
export type DisputeCheck = {
  /** The instructions file and its SHA-256. */
  prompt: { file: string; sha256: string };
  /** sources.json id of the ULT text the third model read. */
  verses: string;
  /** The Titus record whose titles set the voice, and its SHA-256. */
  voice: { file: string; sha256: string };
};

/** The sources.json id of a book's ULT text: what the third model reads. */
export const ultSource = (book: string): string => `ult-${book.toLowerCase()}`;

/**
 * What is wrong with a record's `disputeCheck`, if anything: its ULT must be
 * the book's own (`ult-<book>`), as the runner reads it (#206). That the id
 * is pinned is checked against sources.json by the build.
 */
export const disputeCheckProblems = (
  book: string,
  check: DisputeCheck | undefined
): string[] =>
  check === undefined || check.verses === ultSource(book)
    ? []
    : [`verses is ${check.verses}, not ${ultSource(book)}`];

export type DisputedRecord = Omit<DraftRecord, "calls" | "titles"> & {
  calls: (CallRecord | DisputeCall)[];
  disputeCheck?: DisputeCheck;
  titles: Record<string, Title>;
};

/** The status a dispute leaves: no AI title rises above `ai-checked`. */
export const disputeStatus = (
  kind: Kind,
  gates: string[] | undefined
): Dispute["status"] =>
  kind === "taste" && gates === undefined ? "ai-checked" : "unreviewed";

/**
 * The title as the build takes it: a person's review decides; else the
 * third model's dispute; else the draft (scripts/data/build.ts).
 */
export function builtTitle(t: Title): {
  text: string;
  status: string;
  source: string;
} {
  const ai = t.dispute
    ? { text: t.dispute.text, status: t.dispute.status, source: t.dispute.by }
    : { text: t.text, status: t.status, source: t.source };
  const r = t.review;
  if (!r) return ai;
  return {
    text: r.text ?? ai.text,
    status: r.status,
    source: r.text ? r.by : ai.source,
  };
}

/**
 * What is wrong with a title's `dispute`, if anything: the rules the build
 * and the tests hold every committed record to.
 */
export function disputeProblems(t: Title): string[] {
  const d = t.dispute;
  if (d === undefined) return [];
  const p: string[] = [];
  const allowed = new Set(["by", "kind", "text", "why", "status", "gates"]);
  for (const k of Object.keys(d)) if (!allowed.has(k)) p.push(`field ${k}`);
  if (t.check?.verdict !== "disagree") p.push("no disagreement to settle");
  if (!/^ai:[^/\s]+\/\S+$/.test(d.by)) p.push("by is not ai:<model>");
  else {
    const fam = family(d.by.slice(3));
    if (fam === family(t.source.replace(/^ai:/, "")))
      p.push("by is of the drafting model's family");
    if (t.check && fam === family(t.check.by.replace(/^ai:/, "")))
      p.push("by is of the checking model's family");
  }
  if (!(KINDS as readonly string[]).includes(d.kind)) p.push("kind");
  if (
    typeof d.text !== "string" ||
    d.text === "" ||
    d.text !== d.text.trim() ||
    d.text !== d.text.normalize("NFC")
  )
    p.push("text is not trimmed, non-empty NFC");
  if (
    typeof d.why !== "string" ||
    d.why.trim() === "" ||
    d.why !== d.why.trim()
  )
    p.push("why is not trimmed and non-empty");
  const problems = typeof d.text === "string" ? gateProblems(d.text) : [];
  const gates = problems.length > 0 ? problems : undefined;
  if (JSON.stringify(d.gates) !== JSON.stringify(gates))
    p.push(
      gates === undefined
        ? "gates must be absent"
        : `gates are not ${JSON.stringify(gates)}`
    );
  if (d.status !== disputeStatus(d.kind, gates))
    p.push(`status is not ${disputeStatus(d.kind, gates)}`);
  return p;
}

/**
 * Each verse's text from a ULT USFM file, as `verseTexts` reads BSB. ULT
 * also marks translation-section breaks with `\ts\*`, which BSB has not and
 * `verseTexts` would refuse as unread markup; they carry no words, so they
 * are removed first.
 */
export const ultVerseTexts = (usfm: string): Map<string, string> =>
  verseTexts(usfm.replace(/\\ts\\\*/g, ""));

/** One disputed title as the third model is told it. */
export type DisputeInput = SegmentInput & {
  draft: string;
  criteria: string[];
  why: string;
  suggestion: string;
};

/**
 * The titles to settle, in reading order: every title the checker disagreed
 * with that has neither a dispute yet nor a person's review (a review
 * already decides it). `inputs` carry the ULT text of each segment.
 */
export function disputeInputs(
  record: DisputedRecord,
  inputs: SegmentInput[]
): DisputeInput[] {
  const out: DisputeInput[] = [];
  for (const s of inputs) {
    const t = Object.hasOwn(record.titles, s.key)
      ? record.titles[s.key]
      : undefined;
    if (!t || t.check?.verdict !== "disagree" || t.review || t.dispute)
      continue;
    out.push({
      ...s,
      draft: t.text,
      criteria: [...t.check.criteria],
      why: t.check.why,
      suggestion: t.check.suggestion,
    });
  }
  return out;
}

/** The reviewed voice: each Titus title as the build takes it. */
export const voiceOf = (titus: {
  titles: Record<string, Title>;
}): { key: string; title: string }[] =>
  Object.entries(titus.titles).map(([key, t]) => ({
    key,
    title: builtTitle(t).text,
  }));

/** The system prompt between `<!-- dispute:start -->` and `<!-- dispute:end -->`. */
export function disputePrompt(file: string): string {
  const open = "<!-- dispute:start -->";
  const close = "<!-- dispute:end -->";
  const start = file.indexOf(open);
  const end = file.indexOf(close);
  if (start < 0 || end < start)
    throw new Error("prompt file has no dispute:start/dispute:end markers");
  return file.slice(start + open.length, end).trim();
}

/** The third model's user message. */
export const disputeMessage = (
  book: string,
  voice: { key: string; title: string }[],
  segments: DisputeInput[]
): string => JSON.stringify({ book, voice, segments }, null, 2);

const isText = (v: unknown): v is string =>
  typeof v === "string" && v.trim() !== "";

/**
 * Reads the third model's reply: `{ "<key>": { "kind", "title", "why" } }`.
 * A kind it does not know, or an empty title or reason, is unreadable.
 */
export function readDisputes(
  reply: Record<string, unknown>,
  keys: string[],
  by: string
): {
  disputes: Record<string, Dispute>;
  missing: string[];
  invalid: string[];
} {
  const disputes: Record<string, Dispute> = {};
  const missing: string[] = [];
  const invalid: string[] = [];
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
    const kind = v?.kind;
    if (
      typeof kind !== "string" ||
      !(KINDS as readonly string[]).includes(kind) ||
      !isText(v?.title) ||
      !isText(v?.why)
    ) {
      invalid.push(k);
      continue;
    }
    const text = v.title.trim().normalize("NFC");
    const problems = gateProblems(text);
    const gates = problems.length > 0 ? problems : undefined;
    disputes[k] = {
      by,
      kind: kind as Kind,
      text,
      why: v.why.trim(),
      status: disputeStatus(kind as Kind, gates),
      ...(gates ? { gates } : {}),
    };
  }
  return { disputes, missing, invalid };
}

export type Complete = (request: {
  model: string;
  messages: Message[];
}) => Promise<Completion>;

export type DisputeOutcome =
  "done" | "nothing to settle" | { stopped: string } | { incomplete: string[] };

/**
 * Sends a record's disputed titles to `model` in one call and returns the
 * record with each answer added as `dispute`, the call appended to `calls`
 * and `disputeCheck` set. The model, and the model OpenRouter says
 * answered, must be of a family other than the drafting and the checking
 * model's. `write` gets the ledger after the call and before any throw, so
 * money spent is on record.
 */
export async function settleDisputes(args: {
  record: DisputedRecord;
  /** Every drafted segment, with its ULT text. */
  inputs: SegmentInput[];
  verses: string;
  voice: {
    file: string;
    text: string;
    titles: { key: string; title: string }[];
  };
  prompt: { file: string; text: string };
  model: string;
  complete: Complete;
  write: (ledger: unknown) => Promise<void>;
}): Promise<{ record: DisputedRecord | null; outcome: DisputeOutcome }> {
  const { record, model } = args;
  const book = record.book;
  // Every model that answered a draft or a check call: since #208 a book
  // can have several draft calls as well as several check calls.
  const models = (role: "draft" | "check") => [
    ...new Set(record.calls.filter((c) => c.role === role).map((c) => c.model)),
  ];
  const drafted = models("draft");
  const checked = models("check");
  if (drafted.length === 0 || checked.length === 0)
    throw new Error(`${book}: the record has no draft and check call`);
  const used = new Set([...drafted, ...checked].map(family));
  const third = (m: string) => !used.has(family(m));
  if (!third(model))
    throw new Error(
      `${model} must be of a family other than the drafting (${drafted.join(", ")}) and checking (${checked.join(", ")}) model's`
    );
  const segments = disputeInputs(record, args.inputs);
  const disputed = Object.values(record.titles).filter(
    (t) => t.check?.verdict === "disagree" && !t.review && !t.dispute
  ).length;
  if (segments.length !== disputed)
    throw new Error(
      `${book}: ${disputed} titles to settle but ${segments.length} have verses`
    );
  const prompt = { file: args.prompt.file, sha256: sha256(args.prompt.text) };
  const disputeCheck: DisputeCheck = {
    prompt,
    verses: args.verses,
    voice: { file: args.voice.file, sha256: sha256(args.voice.text) },
  };
  // A record has one disputeCheck, which every dispute in it answers to: a
  // later run on the same record must use the same prompt, ULT and voice,
  // or it would attest to answers it did not produce. Refused before any
  // spend.
  const prior = record.disputeCheck;
  if (prior && JSON.stringify(prior) !== JSON.stringify(disputeCheck))
    throw new Error(
      `${book}: the record's disputeCheck names another prompt, ULT pin or voice than this run's`
    );
  // After the guard, so a run with nothing left to settle still refuses a
  // record whose disputeCheck this run could not have produced (#206).
  if (segments.length === 0) return { record, outcome: "nothing to settle" };
  const keys = segments.map((s) => s.key);
  const calls: DisputeCall[] = [];
  let reply: Record<string, unknown> | null = null;
  // The reply as sent, kept only when it cannot be parsed, so the paid-for
  // text is on record to read (#206).
  let replyText: string | null = null;
  const ledger = (outcome: DisputeOutcome | "running") =>
    args.write({
      language: "en",
      book,
      model,
      prompt,
      verses: args.verses,
      disputed: keys,
      outcome,
      updatedAt: new Date().toISOString(),
      calls,
      reply,
      ...(replyText !== null ? { replyText } : {}),
    });

  let outcome: DisputeOutcome = "done";
  try {
    const c = await args.complete({
      model,
      messages: [
        { role: "system", content: disputePrompt(args.prompt.text) },
        {
          role: "user",
          content: disputeMessage(book, args.voice.titles, segments),
        },
      ],
    });
    calls.push({ ...callRecord("check", c), role: "dispute" });
    await ledger("running");
    if (c.problem !== undefined) {
      outcome = { stopped: `no reply: ${c.problem}` };
      return { record: null, outcome };
    }
    try {
      reply = parseReply(c.text);
    } catch (e) {
      replyText = c.text;
      outcome = { stopped: `unreadable reply: ${(e as Error).message}` };
      return { record: null, outcome };
    }
    // Two requested ids can resolve to one model: judge by the model
    // OpenRouter says answered, as segment-titles.ts does.
    const answered = c.model;
    if (!third(answered)) {
      outcome = {
        stopped: `answered by ${answered}, of the drafting or checking model's family`,
      };
      return { record: null, outcome };
    }
    const read = readDisputes(reply, keys, `ai:${answered}`);
    const titles: Record<string, Title> = {};
    for (const [k, t] of Object.entries(record.titles)) {
      const d = read.disputes[k];
      titles[k] = d ? { ...t, dispute: d } : t;
    }
    const unread = [...read.missing, ...read.invalid];
    if (unread.length > 0) outcome = { incomplete: unread };
    // A run that settled nothing leaves nothing to commit; its call is in
    // the ledger.
    if (Object.keys(read.disputes).length === 0)
      return { record: null, outcome };
    return {
      record: {
        ...record,
        calls: [...record.calls, ...calls],
        disputeCheck,
        titles,
      },
      outcome,
    };
  } catch (e) {
    outcome = { stopped: `error: ${(e as Error).message}` };
    throw e;
  } finally {
    await ledger(outcome);
  }
}

/** One title for the content team's list. */
export type Listed = {
  key: string;
  kind: Kind;
  draft: string;
  text: string;
  status: string;
  why: string;
  by: string;
};

/** A record's disputes, in record order; factual ones only unless `all`. */
export function listDisputes(record: DisputedRecord, all = false): Listed[] {
  const out: Listed[] = [];
  for (const [key, t] of Object.entries(record.titles)) {
    const d = t.dispute;
    if (!d || (!all && d.kind !== "factual")) continue;
    out.push({
      key,
      kind: d.kind,
      draft: t.text,
      text: d.text,
      status: builtTitle(t).status,
      why: d.why,
      by: d.by,
    });
  }
  return out;
}
