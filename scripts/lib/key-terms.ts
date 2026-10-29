// AI-drafted key-term glossaries, for a language with no Translation Words on
// Door43 (zh-Hans: docs/decisions/0003, decision 14). One model drafts a
// headword for every Translation Words article a book's TWL links, a model
// of a different family checks each one, and a person reviews them.
//
// Two halves:
//
// - The run (`draftKeyTerms`, called by scripts/translate/key-terms.ts) calls
//   the models and writes a record of what they said. The record is committed
//   to data/glossary-drafts/<lang>/<BOOK>.json as a recorded AI output: the
//   build never calls a model, so it is never regenerated from the network.
// - The build (`buildDraftGlossary`, called by scripts/data/glossaries.ts)
//   turns that record into data/glossaries/<lang>/<BOOK>.json offline, with
//   the verses and English headwords taken from the pinned TWL and tW, and
//   refuses a record that no longer matches them.
//
// Status follows docs/schema.md: a term is `ai-checked` only when the
// checker agreed and every gate passed; anything else stays `unreviewed` and
// is listed under `review` for the reader. Nothing here sets a higher status.
import {
  inScript,
  linkedArticles,
  twId,
  twlId,
  type Credit,
  type TwlRow,
} from "./glossaries.ts";
import type { Completion, Message } from "./openrouter.ts";
import { parseReply, sha256 } from "./translate.ts";

/** Languages whose glossary is AI-drafted, with the script its terms use. */
export const DRAFT_LANGUAGES: Readonly<
  Record<string, { name: string; script: RegExp; reference: string }>
> = {
  "zh-Hans": {
    name: "Simplified Chinese",
    script: /\p{Script=Han}/u,
    // FIA Key Terms in Simplified Chinese: a professionally reviewed,
    // CC BY-SA 4.0 term list the models are given as a reference
    // (docs/scoping/glossaries.md, "Chinese (zh-Hans)").
    reference: "fia-kt-zhs",
  },
};

/** One reference term: its English name and its rendering in the language. */
export type ReferenceTerm = { en: string; term: string };

/**
 * The terms of an FIA Key Terms file from BibleAquifer (an object of
 * resources, each with `name` and `localizedName`), sorted, each pair once.
 */
export function parseFia(json: string): ReferenceTerm[] {
  const raw = JSON.parse(json) as Record<
    string,
    { name?: unknown; localizedName?: unknown }
  >;
  const seen = new Set<string>();
  const terms: ReferenceTerm[] = [];
  for (const r of Object.values(raw)) {
    if (typeof r.name !== "string" || typeof r.localizedName !== "string")
      throw new Error("FIA: a resource has no name or localizedName");
    const t = { en: r.name.trim(), term: r.localizedName.trim() };
    const id = `${t.en}\t${t.term}`;
    if (t.en === "" || t.term === "" || seen.has(id)) continue;
    seen.add(id);
    terms.push(t);
  }
  const order = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return terms.sort((a, b) => order(a.en, b.en) || order(a.term, b.term));
}

/**
 * The first paragraph of a tW article's "Definition" section, as plain text
 * (links reduced to their text), so a model knows which sense the article
 * means. Empty if the article has no such section.
 */
export function definition(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((l) => /^#+\s*Definition/i.test(l.trim()));
  if (start < 0) return "";
  const para: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const l = line.trim();
    if (l.startsWith("#")) break;
    if (l === "") {
      if (para.length > 0) break;
      continue;
    }
    para.push(l);
  }
  return para
    .join(" ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** What both models are told about one linked article. */
export type TermInput = {
  article: string;
  en: string;
  definition: string;
  refs: string[];
};

/** The system prompt between `<!-- <part>:start -->` and `<!-- <part>:end -->`. */
export function promptPart(
  file: string,
  part: "draft" | "check",
  tag: string
): string {
  const open = `<!-- ${part}:start -->`;
  const close = `<!-- ${part}:end -->`;
  const start = file.indexOf(open);
  const end = file.indexOf(close);
  if (start < 0 || end < start)
    throw new Error(`prompt file has no ${part}:start/${part}:end markers`);
  const language = DRAFT_LANGUAGES[tag]?.name;
  if (language === undefined) throw new Error(`not a draft language: ${tag}`);
  return file
    .slice(start + open.length, end)
    .trim()
    .replaceAll("{{language}}", language)
    .replaceAll("{{tag}}", tag);
}

/** The drafting model's user message. */
export function draftMessage(
  book: string,
  inputs: TermInput[],
  reference: ReferenceTerm[]
): string {
  return JSON.stringify({ book, reference, terms: inputs }, null, 2);
}

/** The checking model's user message: the same, with each draft. */
export function checkMessage(
  book: string,
  inputs: TermInput[],
  reference: ReferenceTerm[],
  draft: Record<string, DraftTerm>
): string {
  const terms = inputs
    .filter((t) => draft[t.article])
    .map((t) => ({ ...t, draft: draft[t.article] }));
  return JSON.stringify({ book, reference, terms }, null, 2);
}

/** What the drafting model returns for one article. */
export type DraftTerm = { headword: string; reference?: string; note?: string };

/** The checker's verdict on one draft, as data/drafts/ records checks. */
export type Check =
  | { by: string; verdict: "agree" }
  | { by: string; verdict: "disagree"; why: string; suggestion: string };

/** One term of the record: the draft, its gates, its check and its status. */
export type DraftRecordTerm = {
  /** The English tW headword the draft was made from. */
  en: string;
  headword: string;
  source: string;
  status: "unreviewed" | "ai-checked";
  /** The reference term (its English name) the draft says it follows. */
  reference?: string;
  /** The drafting model's note for the reader, if it gave one. */
  note?: string;
  /** Gate problems; absent when every gate passed. */
  gates?: string[];
  /** Absent only when the checker gave no usable verdict for the term. */
  check?: Check;
};

export type CallRecord = {
  role: "draft" | "check";
  /** OpenRouter's generation id, to look the call up later. */
  id: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number | null;
  /** US dollars as OpenRouter billed it; null if not reported. */
  cost: number | null;
  ms: number;
};

/** data/glossary-drafts/<lang>/<BOOK>.json: a recorded AI output. */
export type DraftRecord = {
  language: string;
  book: string;
  links: string;
  /** sources.json id of the reference term list the models were given. */
  reference: string;
  prompt: { file: string; sha256: string };
  /** The two calls, with tokens and cost as OpenRouter billed them. */
  calls: CallRecord[];
  terms: Record<string, DraftRecordTerm>;
};

const isText = (v: unknown): v is string =>
  typeof v === "string" && v.trim() !== "";

const asObject = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;

/**
 * Reads the drafting model's reply: `{ "<article>": { "headword",
 * "reference"?, "note"? } }`. An article left out, or answered with something
 * unusable (including a `reference` that is not an English name in the
 * reference list), is reported, not guessed.
 */
export function readDraft(
  reply: Record<string, unknown>,
  articles: string[],
  reference: ReferenceTerm[]
): { terms: Record<string, DraftTerm>; missing: string[]; invalid: string[] } {
  const names = new Set(reference.map((r) => r.en));
  const terms: Record<string, DraftTerm> = {};
  const missing: string[] = [];
  const invalid: string[] = [];
  for (const a of articles) {
    if (reply[a] === undefined) {
      missing.push(a);
      continue;
    }
    const v = asObject(reply[a]);
    if (!v || !isText(v.headword)) {
      invalid.push(a);
      continue;
    }
    const t: DraftTerm = { headword: v.headword.trim().normalize("NFC") };
    if (v.reference !== undefined && v.reference !== null) {
      if (!isText(v.reference) || !names.has(v.reference)) {
        invalid.push(a);
        continue;
      }
      t.reference = v.reference;
    }
    if (isText(v.note)) t.note = v.note.trim();
    terms[a] = t;
  }
  return { terms, missing, invalid };
}

/**
 * Reads the checker's reply: `{ "<article>": { "verdict": "agree" } }` or
 * `{ "verdict": "disagree", "why", "suggestion" }`.
 */
export function readCheck(
  reply: Record<string, unknown>,
  articles: string[],
  by: string
): { checks: Record<string, Check>; missing: string[]; invalid: string[] } {
  const checks: Record<string, Check> = {};
  const missing: string[] = [];
  const invalid: string[] = [];
  for (const a of articles) {
    if (reply[a] === undefined) {
      missing.push(a);
      continue;
    }
    const v = asObject(reply[a]);
    if (v?.verdict === "agree") {
      checks[a] = { by, verdict: "agree" };
    } else if (
      v?.verdict === "disagree" &&
      isText(v.why) &&
      isText(v.suggestion)
    ) {
      checks[a] = {
        by,
        verdict: "disagree",
        why: v.why.trim(),
        suggestion: v.suggestion.trim().normalize("NFC"),
      };
    } else {
      invalid.push(a);
    }
  }
  return { checks, missing, invalid };
}

/**
 * Mechanical checks on a drafted headword: written mostly in the language's
 * script (`inScript`), with no Latin letters (a name left in English), on
 * one line.
 */
export function gateProblems(headword: string, script: RegExp): string[] {
  const problems: string[] = [];
  if (!inScript(headword, script)) problems.push("script");
  if (/\p{Script=Latin}/u.test(headword)) problems.push("latin-letters");
  if (/[\r\n]/.test(headword)) problems.push("line-break");
  return problems;
}

/** The status the rules give a term: see the comment at the top. */
export const statusOf = (t: {
  gates?: string[];
  check?: Check;
}): DraftRecordTerm["status"] =>
  t.check?.verdict === "agree" && t.gates === undefined
    ? "ai-checked"
    : "unreviewed";

const callRecord = (role: CallRecord["role"], c: Completion): CallRecord => ({
  role,
  id: c.id,
  model: c.model,
  promptTokens: c.usage.promptTokens,
  completionTokens: c.usage.completionTokens,
  reasoningTokens: c.usage.reasoningTokens,
  cost: c.usage.cost,
  ms: c.ms,
});

export type Complete = (request: {
  model: string;
  messages: Message[];
}) => Promise<Completion>;

export type DraftOutcome =
  | "done"
  | { stopped: string }
  | { incomplete: { draft: string[]; check: string[] } };

/**
 * Drafts and checks one book's key terms in one language: one call to
 * `draftModel`, then one to `checkModel`, which must differ. `write` gets the
 * ledger after each call and before any throw, so money spent is on record.
 * The check call is not made once `maxCost` is spent, or when the draft's
 * cost is unknown (the fuse fails closed).
 */
export async function draftKeyTerms(args: {
  tag: string;
  book: string;
  inputs: TermInput[];
  reference: { id: string; terms: ReferenceTerm[] };
  prompt: { file: string; text: string };
  draftModel: string;
  checkModel: string;
  maxCost: number;
  complete: Complete;
  write: (ledger: unknown) => Promise<void>;
}): Promise<{ record: DraftRecord | null; outcome: DraftOutcome }> {
  const { tag, book, inputs, draftModel, checkModel } = args;
  const lang = DRAFT_LANGUAGES[tag];
  if (!lang) throw new Error(`not a draft language: ${tag}`);
  if (draftModel === checkModel)
    throw new Error("the checking model must differ from the drafting model");
  const articles = inputs.map((t) => t.article);
  const prompt = { file: args.prompt.file, sha256: sha256(args.prompt.text) };
  const calls: CallRecord[] = [];
  const ledger = (outcome: DraftOutcome | "running") =>
    args.write({
      language: tag,
      book,
      draftModel,
      checkModel,
      maxCost: args.maxCost,
      prompt,
      outcome,
      updatedAt: new Date().toISOString(),
      calls,
      totals: {
        promptTokens: calls.reduce((s, c) => s + c.promptTokens, 0),
        completionTokens: calls.reduce((s, c) => s + c.completionTokens, 0),
        cost: calls.every((c) => c.cost !== null)
          ? calls.reduce((s, c) => s + (c.cost ?? 0), 0)
          : null,
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
        { role: "system", content: promptPart(args.prompt.text, role, tag) },
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
      draftMessage(book, inputs, args.reference.terms)
    );
    if (typeof draftReply === "string") {
      outcome = { stopped: `draft: ${draftReply}` };
      return { record: null, outcome };
    }
    const draft = readDraft(draftReply, articles, args.reference.terms);
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
      checkMessage(book, inputs, args.reference.terms, draft.terms)
    );
    if (typeof checkReply === "string") {
      outcome = { stopped: `check: ${checkReply}` };
      return { record: null, outcome };
    }
    const drafted = articles.filter((a) => draft.terms[a]);
    // Labelled with the model OpenRouter says answered, as translate.ts does.
    const check = readCheck(
      checkReply,
      drafted,
      `ai:${calls[1]?.model ?? checkModel}`
    );
    const source = `ai:${calls[0]?.model ?? draftModel}`;
    const terms: Record<string, DraftRecordTerm> = {};
    for (const input of inputs) {
      const d = draft.terms[input.article];
      if (!d) continue;
      const problems = gateProblems(d.headword, lang.script);
      const gates = problems.length > 0 ? problems : undefined;
      const c = check.checks[input.article];
      terms[input.article] = {
        en: input.en,
        headword: d.headword,
        source,
        status: statusOf({ gates, check: c }),
        ...(d.reference ? { reference: d.reference } : {}),
        ...(d.note ? { note: d.note } : {}),
        ...(gates ? { gates } : {}),
        ...(c ? { check: c } : {}),
      };
    }
    const unreadDraft = [...draft.missing, ...draft.invalid];
    const unreadCheck = [...check.missing, ...check.invalid];
    if (unreadDraft.length + unreadCheck.length > 0)
      outcome = { incomplete: { draft: unreadDraft, check: unreadCheck } };
    const record: DraftRecord = {
      language: tag,
      book,
      links: twlId(book),
      reference: args.reference.id,
      prompt,
      calls,
      terms,
    };
    return { record, outcome };
  } catch (e) {
    outcome = { stopped: `error: ${(e as Error).message}` };
    throw e;
  } finally {
    await ledger(outcome);
  }
}

/** One term of a built AI glossary: the record's term with its verses. */
export type DraftGlossaryTerm = DraftRecordTerm & { refs: string[] };

/** data/glossaries/<lang>/<BOOK>.json for an AI-drafted language. */
export type DraftGlossary = {
  language: string;
  book: string;
  links: string;
  /** The committed record the terms come from. */
  drafts: string;
  /** The drafting and checking models, as `ai:<model>`. */
  models: { draft: string; check: string };
  licence: string;
  attribution: string[];
  terms: Record<string, DraftGlossaryTerm>;
  gaps: Record<string, never>;
  /** Articles whose term is `unreviewed`: the reader looks at these first. */
  review: string[];
};

/**
 * Builds a language's glossary from its committed AI record, offline. The
 * record must name every article the book's TWL links, once, with the
 * English headword the pinned English tW has now (so an English change makes
 * the record stale, not silently wrong), and keep the status rules. Verses
 * come from the TWL, not the record. Credits: the TWL file, the English
 * articles and the reference list, which must share one licence.
 */
export function buildDraftGlossary(args: {
  record: DraftRecord;
  file: string;
  rows: TwlRow[];
  english: (article: string) => string;
  credit: (id: string) => Credit;
}): DraftGlossary {
  const { record } = args;
  const where = `${record.language} ${record.book}`;
  const lang = DRAFT_LANGUAGES[record.language];
  if (!lang) throw new Error(`${where}: not a draft language`);
  if (record.links !== twlId(record.book))
    throw new Error(
      `${where}: links ${record.links}, not ${twlId(record.book)}`
    );
  if (record.reference !== lang.reference)
    throw new Error(`${where}: reference ${record.reference}`);
  const roles = record.calls.map((c) => c.role).join(",");
  const [draftCall, checkCall] = record.calls;
  if (roles !== "draft,check" || !draftCall || !checkCall)
    throw new Error(`${where}: the record needs one draft and one check call`);
  const models = {
    draft: `ai:${draftCall.model}`,
    check: `ai:${checkCall.model}`,
  };
  if (models.draft === models.check)
    throw new Error(`${where}: drafted and checked by the same model`);

  const linked = linkedArticles(args.rows);
  const extra = Object.keys(record.terms).filter((a) => !linked.has(a));
  const absent = [...linked.keys()].filter((a) => !record.terms[a]);
  if (extra.length > 0 || absent.length > 0)
    throw new Error(
      `${where}: the record does not match the TWL (not linked: ${extra.join(", ") || "none"}; no term: ${absent.join(", ") || "none"})`
    );

  const terms: Record<string, DraftGlossaryTerm> = {};
  for (const [article, refs] of linked) {
    const t = record.terms[article];
    if (!t) continue;
    const en = args.english(article);
    if (t.en !== en)
      throw new Error(
        `${where} ${article}: drafted from "${t.en}", English tW now says "${en}"`
      );
    if (t.source !== models.draft)
      throw new Error(`${where} ${article}: source ${t.source}`);
    if (t.check && t.check.by !== models.check)
      throw new Error(`${where} ${article}: checked by ${t.check.by}`);
    const gates = gateProblems(t.headword, lang.script);
    if (JSON.stringify(gates) !== JSON.stringify(t.gates ?? []))
      throw new Error(`${where} ${article}: gates do not match the headword`);
    if (t.status !== statusOf(t))
      throw new Error(
        `${where} ${article}: status ${t.status} breaks the rules`
      );
    terms[article] = { ...t, refs };
  }
  const ids = [
    twlId(record.book),
    ...Object.keys(terms).map((a) => twId("en", a)),
    record.reference,
  ];
  const credits = ids.map(args.credit);
  const licences = [...new Set(credits.map((c) => c.licence))];
  const [licence] = licences;
  if (licence === undefined || licences.length !== 1)
    throw new Error(`${where}: sources under ${licences.length} licences`);
  return {
    language: record.language,
    book: record.book,
    links: record.links,
    drafts: args.file,
    models,
    licence,
    attribution: [...new Set(credits.map((c) => c.attribution))],
    terms,
    gaps: {},
    review: Object.entries(terms)
      .filter(([, t]) => t.status === "unreviewed")
      .map(([a]) => a),
  };
}
