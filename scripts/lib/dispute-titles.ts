// The third check on disputed English segment titles (ADR 0005 item 6,
// issue #198; prompts/dispute-titles.md). After the checker, every title it
// disagreed with goes to a third model, of a family other than the drafting
// and the checking model's, which reads the verses (ULT) and sorts the
// dispute:
//
// - `taste`: its title replaces the draft and is `ai-checked` when it passes
//   the gates and the checker agrees with it (#207);
// - `factual`: its title is a proposal; the title stays `unreviewed` and is
//   listed for the content team.
//
// Every title the third model gives goes back to the record's checker, with
// the same check prompt and BSB verses the draft was checked with (the
// `recheck`, #207). The third model is never told the checker's suggestion
// or any verdict on the titles (blind, #207).
//
// The draft's own `text`, `source`, `status`, `gates` and `check` are never
// changed: the third model's answer is added beside them as `dispute`, as a
// person's review is added as `review` (docs/schema.md). No AI title rises
// above `ai-checked`. Pure apart from the injected `complete` and `write`,
// so tests run it with a fake model.
import { callRecord, type CallRecord } from "./key-terms.ts";
import type { Completion, Message } from "./openrouter.ts";
import {
  CHECK_MAX_TOKENS,
  CRITERIA,
  checkMessage,
  family,
  gateProblems,
  promptPart,
  readCheck,
  type Check,
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
  /**
   * `ai-checked` only for a taste title that passes every gate and that the
   * recheck agreed with.
   */
  status: "ai-checked" | "unreviewed";
  /** Gate problems of `text`; absent when it passes every gate. */
  gates?: string[];
  /**
   * The checker's verdict on `text`, judged as a draft is (#207); absent
   * when the recheck gave none.
   */
  recheck?: Check;
};

/** A title of a record, with the review and dispute it may carry. */
export type Title = DraftTitle & {
  review?: { by: string; status: string; text?: string };
  dispute?: Dispute;
};

/** The dispute and recheck calls in a record's `calls`. */
export type DisputeCall = Omit<CallRecord, "role"> & {
  role: "dispute" | "recheck";
};

/** What a record that went through the third check also carries. */
export type DisputeCheck = {
  /** The instructions file and its SHA-256. */
  prompt: { file: string; sha256: string };
  /** sources.json id of the ULT text the third model read. */
  verses: string;
  /** The Titus record whose titles set the voice, and its SHA-256. */
  voice: { file: string; sha256: string };
  /**
   * The check the third model's titles went back through (#207): the
   * segment-title prompt file whose check part was sent (the one the
   * record's drafts were checked with, by SHA-256) and the BSB text.
   */
  recheck?: { prompt: { file: string; sha256: string }; bible: string };
};

export type DisputedRecord = Omit<DraftRecord, "calls" | "titles"> & {
  calls: (CallRecord | DisputeCall)[];
  disputeCheck?: DisputeCheck;
  titles: Record<string, Title>;
};

/**
 * The status a dispute leaves: no AI title rises above `ai-checked`, and a
 * taste title reaches it only when the checker agreed with it (#207).
 */
export const disputeStatus = (
  kind: Kind,
  gates: string[] | undefined,
  recheck: Check | undefined
): Dispute["status"] =>
  kind === "taste" && gates === undefined && recheck?.verdict === "agree"
    ? "ai-checked"
    : "unreviewed";

/** What is wrong with a recheck verdict as a record holds it. */
function recheckProblems(c: unknown): string[] {
  if (typeof c !== "object" || c === null || Array.isArray(c))
    return ["recheck is not an object"];
  const v = c as Record<string, unknown>;
  const p: string[] = [];
  if (typeof v.by !== "string" || !/^ai:[^/\s]+\/\S+$/.test(v.by))
    p.push("recheck by is not ai:<model>");
  if (v.verdict === "agree") {
    for (const k of Object.keys(v))
      if (k !== "by" && k !== "verdict") p.push(`recheck field ${k}`);
  } else if (v.verdict === "disagree") {
    for (const k of Object.keys(v))
      if (!["by", "verdict", "criteria", "why", "suggestion"].includes(k))
        p.push(`recheck field ${k}`);
    const criteria = v.criteria;
    if (
      !Array.isArray(criteria) ||
      criteria.length === 0 ||
      !criteria.every((x) => (CRITERIA as readonly unknown[]).includes(x))
    )
      p.push("recheck criteria");
    if (typeof v.why !== "string" || v.why.trim() === "") p.push("recheck why");
    if (typeof v.suggestion !== "string" || v.suggestion.trim() === "")
      p.push("recheck suggestion");
  } else p.push("recheck verdict");
  return p;
}

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

/** The AI wording a title stands on before any person's review. */
export const aiText = (t: Title): string => t.dispute?.text ?? t.text;

/**
 * What is wrong with a title's `dispute`, if anything: the rules the build
 * and the tests hold every committed record to.
 */
export function disputeProblems(t: Title): string[] {
  const d = t.dispute;
  if (d === undefined) return [];
  const p: string[] = [];
  const allowed = new Set([
    "by",
    "kind",
    "text",
    "why",
    "status",
    "gates",
    "recheck",
  ]);
  for (const k of Object.keys(d)) if (!allowed.has(k)) p.push(`field ${k}`);
  if (t.check?.verdict !== "disagree") p.push("no disagreement to settle");
  if (!/^ai:[^/\s]+\/\S+$/.test(d.by)) p.push("by is not ai:<model>");
  else {
    const fam = family(d.by.slice(3));
    if (fam === family(t.source.replace(/^ai:/, "")))
      p.push("by is of the drafting model's family");
    if (t.check && fam === family(t.check.by.replace(/^ai:/, "")))
      p.push("by is of the checking model's family");
    // The recheck is the checker's: of the checking model's family, so
    // never the third model's own nor the drafting model's.
    const r = d.recheck as { by?: unknown } | undefined;
    if (r !== undefined && typeof r.by === "string") {
      const rf = family(r.by.replace(/^ai:/, ""));
      if (rf === fam) p.push("recheck is by the third model's family");
      if (rf === family(t.source.replace(/^ai:/, "")))
        p.push("recheck is by the drafting model's family");
      if (t.check && rf !== family(t.check.by.replace(/^ai:/, "")))
        p.push("recheck is not by the checking model's family");
    }
  }
  if (d.recheck !== undefined) p.push(...recheckProblems(d.recheck));
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
    p.push(`gates are not ${JSON.stringify(gates ?? [])}`);
  const want = disputeStatus(d.kind, gates, d.recheck);
  if (d.status !== want) p.push(`status is not ${want}`);
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

/**
 * One disputed title as the third model is told it. Blind (#207): the
 * checker's `suggestion` is never part of it, nor any person's review.
 */
export type DisputeInput = SegmentInput & {
  draft: string;
  criteria: string[];
  why: string;
};

/**
 * The titles to settle, in reading order: every title the checker disagreed
 * with that has neither a dispute yet nor a person's review (a review
 * already decides it). `inputs` carry the ULT text of each segment. Each
 * item is built field by field, so nothing else the record holds reaches
 * the third model.
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
      key: s.key,
      verses: s.verses,
      pericope: s.pericope,
      text: s.text,
      draft: t.text,
      criteria: [...t.check.criteria],
      why: t.check.why,
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
    // Unreviewed until the recheck agrees (withRecheck).
    disputes[k] = {
      by,
      kind: kind as Kind,
      text,
      why: v.why.trim(),
      status: disputeStatus(kind as Kind, gates, undefined),
      ...(gates ? { gates } : {}),
    };
  }
  return { disputes, missing, invalid };
}

/** A dispute with the checker's verdict on its title, and the status it leaves. */
export const withRecheck = (
  d: Dispute,
  recheck: Check | undefined
): Dispute => ({
  by: d.by,
  kind: d.kind,
  text: d.text,
  why: d.why,
  status: disputeStatus(d.kind, d.gates, recheck),
  ...(d.gates ? { gates: d.gates } : {}),
  ...(recheck ? { recheck } : {}),
});

export type Complete = (request: {
  model: string;
  messages: Message[];
  maxTokens?: number;
}) => Promise<Completion>;

/**
 * `incomplete` names the titles with no readable answer from the third
 * model; they have no dispute and a later run settles them. A recheck that
 * fails for any title stops the run with no record.
 */
export type DisputeOutcome =
  "done" | "nothing to settle" | { stopped: string } | { incomplete: string[] };

/**
 * Sends a record's disputed titles to `model` in one call, then every title
 * it gives back through the record's checker in one more call (#207), and
 * returns the record with each answer added as `dispute` (with the
 * checker's verdict as its `recheck`), both calls appended to `calls` and
 * `disputeCheck` set. The model, and the model OpenRouter says answered,
 * must be of a family other than the drafting and the checking model's; the
 * recheck must be answered by neither the third model's family nor the
 * drafting model's. The recheck is sent the check part of the very prompt
 * the record's drafts were checked with (by SHA-256) and the BSB verses.
 * `write` gets the ledger after each call and before any throw, so money
 * spent is on record.
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
  recheck: {
    /** The segment-title prompt file the record's drafts were checked with. */
    prompt: { file: string; text: string };
    /** Every drafted segment, with its BSB text, as the checker read it. */
    inputs: SegmentInput[];
    /** The checking model; by default the record's. */
    model?: string;
  };
  complete: Complete;
  write: (ledger: unknown) => Promise<void>;
}): Promise<{ record: DisputedRecord | null; outcome: DisputeOutcome }> {
  const { record, model } = args;
  const book = record.book;
  const draftCall = record.calls.find((c) => c.role === "draft");
  const checkCall = record.calls.find((c) => c.role === "check");
  const drafted = draftCall?.model;
  const checked = checkCall?.model;
  if (drafted === undefined || checked === undefined)
    throw new Error(`${book}: the record has no draft and check call`);
  const third = (m: string) =>
    family(m) !== family(drafted) && family(m) !== family(checked);
  if (!third(model))
    throw new Error(
      `${model} must be of a family other than the drafting (${drafted}) and checking (${checked}) model's`
    );
  const recheckModel = args.recheck.model ?? checked;
  // The recheck is the record's checker (#207): of the checking model's
  // family, which the third model and the drafting model are not.
  const checker = (m: string, by: string) =>
    family(m) === family(checked) &&
    family(m) !== family(by) &&
    family(m) !== family(drafted);
  if (!checker(recheckModel, model))
    throw new Error(
      `the recheck model ${recheckModel} must be of the checking model's family (${checked}), not the third (${model}) or drafting (${drafted}) model's`
    );
  const recheckPrompt = {
    file: args.recheck.prompt.file,
    sha256: sha256(args.recheck.prompt.text),
  };
  if (recheckPrompt.sha256 !== record.prompt.sha256)
    throw new Error(
      `${book}: the recheck prompt is not the one the record's drafts were checked with`
    );
  const segments = disputeInputs(record, args.inputs);
  const disputed = Object.values(record.titles).filter(
    (t) => t.check?.verdict === "disagree" && !t.review && !t.dispute
  ).length;
  if (segments.length !== disputed)
    throw new Error(
      `${book}: ${disputed} titles to settle but ${segments.length} have verses`
    );
  if (segments.length === 0) return { record, outcome: "nothing to settle" };
  const keys = segments.map((s) => s.key);
  const bsb = args.recheck.inputs.filter((s) => keys.includes(s.key));
  if (bsb.length !== keys.length)
    throw new Error(`${book}: the recheck has no BSB verses for some titles`);
  const prompt = { file: args.prompt.file, sha256: sha256(args.prompt.text) };
  const disputeCheck: DisputeCheck = {
    prompt,
    verses: args.verses,
    voice: { file: args.voice.file, sha256: sha256(args.voice.text) },
    recheck: { prompt: recheckPrompt, bible: record.bible },
  };
  // A record has one disputeCheck, which every dispute in it answers to: a
  // later run on the same record must use the same prompt, ULT, voice and
  // recheck, or it would attest to answers it did not produce. Refused
  // before any spend.
  const prior = record.disputeCheck;
  if (prior && JSON.stringify(prior) !== JSON.stringify(disputeCheck))
    throw new Error(
      `${book}: the record's disputeCheck names another prompt, ULT pin, voice or recheck than this run's`
    );
  const calls: DisputeCall[] = [];
  let reply: Record<string, unknown> | null = null;
  let recheckReply: Record<string, unknown> | null = null;
  const ledger = (outcome: DisputeOutcome | "running") =>
    args.write({
      language: "en",
      book,
      model,
      recheckModel,
      prompt,
      recheckPrompt,
      verses: args.verses,
      disputed: keys,
      outcome,
      updatedAt: new Date().toISOString(),
      calls,
      reply,
      recheckReply,
      totals: {
        promptTokens: calls.reduce((s, c) => s + c.promptTokens, 0),
        completionTokens: calls.reduce((s, c) => s + c.completionTokens, 0),
        cost: calls.every((c) => c.cost !== null)
          ? calls.reduce((s, c) => s + (c.cost ?? 0), 0)
          : null,
        ms: calls.reduce((s, c) => s + c.ms, 0),
      },
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
    const unread = [...read.missing, ...read.invalid];
    const settled = keys.filter((k) => read.disputes[k] !== undefined);
    // A run that settled nothing leaves nothing to commit; its call is in
    // the ledger.
    if (settled.length === 0) {
      outcome = { incomplete: unread };
      return { record: null, outcome };
    }

    // The recheck (#207): each title the third model gave, judged by the
    // checker as a draft is, against the BSB verses, with nothing else the
    // third model said.
    const rechecks: Record<string, Check> = {};
    const unchecked: string[] = [];
    const r = await args.complete({
      model: recheckModel,
      messages: [
        {
          role: "system",
          content: promptPart(args.recheck.prompt.text, "check"),
        },
        {
          role: "user",
          content: checkMessage(
            book,
            bsb.filter((s) => read.disputes[s.key] !== undefined),
            Object.fromEntries(settled.map((k) => [k, read.disputes[k]!.text]))
          ),
        },
      ],
      maxTokens: CHECK_MAX_TOKENS,
    });
    calls.push({ ...callRecord("check", r), role: "recheck" });
    await ledger("running");
    let why: string | null = null;
    if (r.problem !== undefined) why = `no reply: ${r.problem}`;
    else if (!checker(r.model, answered))
      why = `answered by ${r.model}, not of the checking model's family`;
    else
      try {
        recheckReply = parseReply(r.text);
      } catch (e) {
        why = `unreadable reply: ${(e as Error).message}`;
      }
    if (recheckReply !== null) {
      const v = readCheck(recheckReply, settled, `ai:${r.model}`);
      Object.assign(rechecks, v.checks);
      unchecked.push(...v.missing, ...v.invalid);
    } else unchecked.push(...settled);

    // A dispute with no recheck is never returned: a later run skips a
    // title that has a dispute, so it would never be rechecked. The third
    // model's answers are in the ledger; the titles stay as drafted.
    if (why !== null) {
      outcome = { stopped: `recheck: ${why}` };
      return { record: null, outcome };
    }
    if (unchecked.length > 0) {
      outcome = {
        stopped: `recheck gave no verdict on ${unchecked.join(", ")}`,
      };
      return { record: null, outcome };
    }
    const titles: Record<string, Title> = {};
    for (const [k, t] of Object.entries(record.titles)) {
      const d = read.disputes[k];
      titles[k] = d ? { ...t, dispute: withRecheck(d, rechecks[k]) } : t;
    }
    if (unread.length > 0) outcome = { incomplete: unread };
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
  /** The checker's verdict on `text` (#207), or `none` if it gave none. */
  recheck: "agree" | "disagree" | "none";
  /** For a disagreeing recheck, its criteria and reason. */
  recheckWhy?: string;
};

/**
 * A record's disputes, in record order: those whose answer left the title
 * `unreviewed` (every factual one, and a taste one the checker did not
 * agree with or that failed a gate), or every dispute when `all`.
 */
export function listDisputes(record: DisputedRecord, all = false): Listed[] {
  const out: Listed[] = [];
  for (const [key, t] of Object.entries(record.titles)) {
    const d = t.dispute;
    if (!d || (!all && d.status !== "unreviewed")) continue;
    out.push({
      key,
      kind: d.kind,
      draft: t.text,
      text: d.text,
      status: builtTitle(t).status,
      why: d.why,
      by: d.by,
      recheck: d.recheck?.verdict ?? "none",
      ...(d.recheck?.verdict === "disagree"
        ? { recheckWhy: `${d.recheck.criteria.join(", ")}: ${d.recheck.why}` }
        : {}),
    });
  }
  return out;
}

/** Text for one cell of a Markdown table. */
export const cell = (s: string): string =>
  s.replace(/\s+/g, " ").replace(/\p{C}/gu, "").replace(/\|/g, "\\|").trim();

/**
 * The review sheet for a person (#207): for each dispute of a record, the
 * segment's verses in ULT, the draft, the checker's objection to it (never
 * its suggestion), the third model's kind, title and reason, the checker's
 * verdict on that title, and two empty columns for the person's yes or no.
 * `inputs` carry the ULT text the third model read.
 */
export function reviewSheet(
  record: DisputedRecord,
  inputs: SegmentInput[]
): string {
  const text = new Map(inputs.map((s) => [s.key, s]));
  const lines = [
    "| Key | Verses (ULT) | Draft | Checker on the draft | Kind | Third model’s title | Third model’s why | Checker on the title | Status | Keeps every main point? (yes/no) | Factual call correct? (yes/no) |",
    "| --- | ------------ | ----- | -------------------- | ---- | ------------------- | ----------------- | -------------------- | ------ | -------------------------------- | ------------------------------ |",
  ];
  for (const [key, t] of Object.entries(record.titles)) {
    const d = t.dispute;
    if (!d) continue;
    const s = text.get(key);
    if (!s) throw new Error(`${key}: no verses for the review sheet`);
    const objection =
      t.check?.verdict === "disagree"
        ? `${t.check.criteria.join(", ")}: ${t.check.why}`
        : "";
    const r = d.recheck;
    const recheck =
      r === undefined
        ? "none"
        : r.verdict === "agree"
          ? "agree"
          : `disagree (${r.criteria.join(", ")}): ${r.why}`;
    lines.push(
      `| ${key} | ${s.verses} ${cell(s.text)} | ${cell(t.text)} | ${cell(objection)} | ${d.kind} | ${cell(d.text)} | ${cell(d.why)} | ${cell(recheck)} | ${d.status} |  |  |`
    );
  }
  return lines.join("\n") + "\n";
}
