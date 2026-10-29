// The cross-model check of translated titles (docs/decisions/0002): a model
// of a different family judges each translation against its English title
// and the language's glossary, and records a verdict the way the English
// check does in data/drafts/en/TIT.json (`by`, `verdict`, and for a
// disagreement `criteria`, `why` and a `suggestion`). Pure apart from the
// injected `complete`, so tests run it with a fake model.
//
// A translation becomes `ai-checked` only when the checker agreed and every
// gate passed; anything else stays `unreviewed` and goes to a person first.
// Nothing here goes above `ai-checked` (AGENTS.md, "Label AI output").
import {
  LANGUAGES,
  parseReply,
  runLanguages,
  span,
  summarise as summariseCalls,
  systemPrompt,
  termsFor,
  type Call,
  type Complete,
  type EnglishTitles,
  type Glossary,
  type StopReason,
  type Translation,
} from "./translate.ts";

/** What a disagreement can name; the rules of prompts/translate-titles.md. */
export const CRITERIA = [
  "accurate",
  "terms",
  "names",
  "plain",
  "style",
] as const;
export type Criterion = (typeof CRITERIA)[number];

export type Check =
  | { by: string; verdict: "agree" }
  | {
      by: string;
      verdict: "disagree";
      criteria: Criterion[];
      why: string;
      suggestion: string;
    };

/** A translation with its check: the shape of data/drafts/<lang>/<BOOK>.json. */
export type CheckedTitle = Omit<Translation, "status"> & {
  status: "unreviewed" | "ai-checked";
  check?: Check;
};

/** One language's output of the translation runner. */
export type TranslatedFile = {
  language: string;
  book: string;
  titles: Record<string, Translation>;
};

/**
 * The model family: the provider part of an OpenRouter id
 * (`google/gemini-3.8-flash`), with or without the `ai:` source prefix.
 */
export function family(model: string): string {
  const id = model.replace(/^ai:/, "");
  const slash = id.indexOf("/");
  if (slash <= 0) throw new Error(`cannot tell the model family of ${model}`);
  return id.slice(0, slash);
}

/** The user message: each translation with its English and key terms. */
export function checkMessage(
  english: EnglishTitles,
  titles: Record<string, Translation>,
  glossary: Glossary | null
): string {
  const items = Object.entries(titles).map(([key, t]) => {
    const { chapter, from, to } = span(key);
    return {
      key,
      kind: key.includes(".P.") ? "section heading" : "segment title",
      verses: `${english.name.text} ${chapter}:${from}${to === from ? "" : `-${to}`}`,
      english: t.from,
      translation: t.text,
      terms: termsFor(key, glossary),
    };
  });
  return JSON.stringify(items, null, 2);
}

/**
 * The translation's own fields only, so a `check` or `review` already on the
 * input (a re-check of checker output) never survives beside a new status.
 */
function translationOf(t: Translation): Translation {
  return {
    text: t.text,
    source: t.source,
    status: t.status,
    from: t.from,
    ...(t.gates ? { gates: t.gates } : {}),
  };
}

const text = (v: unknown): v is string =>
  typeof v === "string" && v.trim() !== "" && v === v.trim();

/** One verdict from the reply, or null if it is not a well-formed one. */
export function readVerdict(value: unknown, by: string): Check | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  // An agreement that also names criteria or a suggestion contradicts
  // itself; it is not read as an agreement.
  if (v.verdict === "agree")
    return v.criteria === undefined && v.suggestion === undefined
      ? { by, verdict: "agree" }
      : null;
  if (v.verdict !== "disagree") return null;
  const { criteria, why, suggestion } = v;
  if (
    !Array.isArray(criteria) ||
    criteria.length === 0 ||
    new Set(criteria).size !== criteria.length ||
    !criteria.every((c) => (CRITERIA as readonly unknown[]).includes(c)) ||
    !text(why) ||
    !text(suggestion)
  )
    return null;
  return {
    by,
    verdict: "disagree",
    criteria: criteria as Criterion[],
    why,
    suggestion,
  };
}

export type CheckResult = {
  language: string;
  titles: Record<string, CheckedTitle>;
  /** Absent when the language had nothing to check. */
  call?: Call;
  /** Translated keys the reply left out. */
  missing: string[];
  /** Translated keys whose verdict was not well formed. */
  invalid: string[];
  /** Why the reply could not be read at all; the call is still recorded. */
  error?: string;
};

/**
 * Checks one language's translations with one call. Refuses, before the
 * call, a translation by the checker's own family, one whose English has
 * changed since it was translated, or a glossary for another language. A
 * key left out or answered badly is recorded and stays `unreviewed`.
 */
export async function checkLanguage(args: {
  english: EnglishTitles;
  file: TranslatedFile;
  glossary: Glossary | null;
  promptFile: string;
  model: string;
  complete: Complete;
}): Promise<CheckResult> {
  const { english, file, glossary, model } = args;
  const tag = file.language;
  // The tag and book name output paths: only known values get that far.
  if (typeof tag !== "string" || !Object.hasOwn(LANGUAGES, tag))
    throw new Error(`not a v0.1 language: ${String(tag)}`);
  if (file.book !== english.book)
    throw new Error(
      `${tag}: translations are for ${file.book}, not ${english.book}`
    );
  if (glossary && glossary.language !== tag)
    throw new Error(`glossary is for ${glossary.language}, not ${tag}`);
  for (const [key, t] of Object.entries(file.titles)) {
    if (family(t.source) === family(model))
      throw new Error(
        `${tag} ${key}: ${t.source} would be checked by its own family (${model})`
      );
    const en = english.titles[key]?.text;
    if (en === undefined)
      throw new Error(`${tag}: no English title for ${key}`);
    if (t.from !== en)
      throw new Error(
        `${tag} ${key}: translated from "${t.from}", but the English is now "${en}"`
      );
  }
  const keys = Object.keys(file.titles);
  const unchecked = (): Record<string, CheckedTitle> =>
    Object.fromEntries(
      keys.map((k) => [
        k,
        { ...translationOf(file.titles[k]!), status: "unreviewed" },
      ])
    );
  if (keys.length === 0)
    return { language: tag, titles: {}, missing: [], invalid: [] };

  const completion = await args.complete({
    model,
    messages: [
      { role: "system", content: systemPrompt(args.promptFile, tag) },
      { role: "user", content: checkMessage(english, file.titles, glossary) },
    ],
  });
  const call: Call = {
    language: tag,
    keys,
    id: completion.id,
    model: completion.model,
    promptTokens: completion.usage.promptTokens,
    completionTokens: completion.usage.completionTokens,
    reasoningTokens: completion.usage.reasoningTokens,
    cost: completion.usage.cost,
    ms: completion.ms,
  };
  const fail = (error: string): CheckResult => ({
    language: tag,
    titles: unchecked(),
    call,
    missing: [],
    invalid: [],
    error,
  });
  if (completion.problem !== undefined)
    return fail(`no reply: ${completion.problem}`);
  // The model that answered must still be of another family. The call is
  // billed by now, so an answering model whose family cannot be told is a
  // recorded failure too, never a throw that would lose the call.
  let answered: string;
  try {
    answered = family(completion.model);
  } catch (e) {
    return fail((e as Error).message);
  }
  if (answered !== family(model))
    return fail(`answered by ${completion.model}, not the ${model} family`);
  let reply: Record<string, unknown>;
  try {
    reply = parseReply(completion.text);
  } catch (e) {
    return fail(`unreadable reply: ${(e as Error).message}`);
  }
  const by = `ai:${completion.model}`;
  const titles: Record<string, CheckedTitle> = {};
  const missing: string[] = [];
  const invalid: string[] = [];
  for (const key of keys) {
    const t = file.titles[key]!;
    const value = reply[key];
    const check = value === undefined ? null : readVerdict(value, by);
    if (value === undefined) missing.push(key);
    else if (check === null) invalid.push(key);
    titles[key] = {
      ...translationOf(t),
      status:
        check?.verdict === "agree" && t.gates === undefined
          ? "ai-checked"
          : "unreviewed",
      ...(check ? { check } : {}),
    };
  }
  return { language: tag, titles, call, missing, invalid };
}

/** Totals for a check run: the disagreements the comparison reads. */
export function summariseChecks(results: CheckResult[]) {
  const calls = results.flatMap((r) => (r.call ? [r.call] : []));
  const base = summariseCalls(calls, []);
  const titles = results.flatMap((r) => Object.values(r.titles));
  const checks = titles.flatMap((t) => (t.check ? [t.check] : []));
  const byCriterion = Object.fromEntries(
    CRITERIA.map((c) => [
      c,
      checks.filter((k) => k.verdict === "disagree" && k.criteria.includes(c))
        .length,
    ])
  );
  return {
    calls: base.calls,
    titles: titles.length,
    checked: checks.length,
    agree: checks.filter((c) => c.verdict === "agree").length,
    disagree: checks.filter((c) => c.verdict === "disagree").length,
    byCriterion,
    aiChecked: titles.filter((t) => t.status === "ai-checked").length,
    missing: results.reduce((n, r) => n + r.missing.length, 0),
    invalid: results.reduce((n, r) => n + r.invalid.length, 0),
    unreadable: results.filter((r) => r.error !== undefined).length,
    promptTokens: base.promptTokens,
    completionTokens: base.completionTokens,
    reasoningTokens: base.reasoningTokens,
    cost: base.cost,
    /** Per verdict received. */
    costPerCheck:
      base.cost === null || checks.length === 0
        ? null
        : base.cost / checks.length,
    modelSeconds: base.modelSeconds,
    checksPerHour:
      base.modelSeconds === 0
        ? null
        : (checks.length / base.modelSeconds) * 3600,
  };
}

/**
 * Checks every language in `files`, one call each, under the same ledger and
 * spend fuse as the translation runner, writing `<tag>/<BOOK>.json` (the
 * checked titles) after each call and `run.json` throughout.
 */
export async function checkBook(args: {
  english: EnglishTitles;
  files: TranslatedFile[];
  glossaries: Record<string, Glossary | null>;
  promptFile: string;
  model: string;
  complete: Complete;
  maxCost: number;
  write: (path: string, value: unknown) => Promise<void>;
  meta: Record<string, unknown>;
  log?: (line: string) => void;
}): Promise<{ stop: StopReason; summary: ReturnType<typeof summariseChecks> }> {
  const log = args.log ?? (() => {});
  const byTag = new Map(args.files.map((f) => [f.language, f]));
  const tags = args.files.map((f) => f.language);
  const { stop, results } = await runLanguages<CheckResult>({
    tags,
    maxCost: args.maxCost,
    run: (tag) =>
      checkLanguage({
        english: args.english,
        file: byTag.get(tag)!,
        glossary: args.glossaries[tag] ?? null,
        promptFile: args.promptFile,
        model: args.model,
        complete: args.complete,
      }),
    record: async (r) => {
      await args.write(`${r.language}/${args.english.book}.json`, {
        language: r.language,
        book: args.english.book,
        titles: r.titles,
      });
      const s = summariseChecks([r]);
      log(
        `${r.language}: ${s.agree} agree, ${s.disagree} disagree, ` +
          `${r.missing.length} missing, ${r.invalid.length} invalid` +
          `${r.error ? `, ${r.error}` : ""}` +
          (r.call
            ? `, ${r.call.promptTokens}+${r.call.completionTokens} tokens, ` +
              `$${r.call.cost?.toFixed(6) ?? "unknown"}, ${r.call.ms} ms`
            : ", nothing to check")
      );
    },
    ledger: (stop, results) =>
      args.write("run.json", {
        ...args.meta,
        model: args.model,
        languages: tags,
        maxCost: args.maxCost,
        stop,
        updatedAt: new Date().toISOString(),
        results: Object.fromEntries(
          results.map((r) => [
            r.language,
            {
              missing: r.missing,
              invalid: r.invalid,
              ...(r.error ? { error: r.error } : {}),
              ...(r.call ? {} : { skipped: "nothing to check" }),
            },
          ])
        ),
        calls: results.flatMap((r) => (r.call ? [r.call] : [])),
        summary: summariseChecks(results),
      }),
  });
  return { stop, summary: summariseChecks(results) };
}
