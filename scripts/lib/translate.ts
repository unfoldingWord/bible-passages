// Translates one book's English titles into one language per model call,
// with that language's key-term glossary, and gates every result. Pure apart
// from the injected `complete`, so tests run it with a fake model.
//
// Everything it returns is AI output: `source: "ai:<model>"` and status
// `unreviewed` (AGENTS.md, "Label AI output"). The cross-model check, which
// can raise a title to `ai-checked`, is a separate step (./check.ts).
import { createHash } from "node:crypto";
import { titleProblems, SCRIPT_BY_TAG } from "./gates.ts";
import type { Completion, Message } from "./openrouter.ts";

/** The v0.1 languages (docs/decisions/0003), with their English names. */
export const LANGUAGES: Readonly<Record<string, string>> = {
  ar: "Arabic",
  "es-419": "Latin American Spanish",
  fr: "French",
  hi: "Hindi",
  id: "Indonesian",
  "pt-BR": "Brazilian Portuguese",
  ru: "Russian",
  sw: "Swahili",
  "zh-Hans": "Simplified Chinese",
};

/**
 * The two models ADR 0002 measures, as OpenRouter names them (checked against
 * https://openrouter.ai/api/v1/models on 2026-10-29): the newest fast Gemini
 * model and the Claude model that drafted the English titles. Confirmed by
 * the DRI on 2026-10-29 for the Titus run (docs/decisions/0002).
 */
export const MODELS = {
  gemini: "google/gemini-3.8-flash",
  claude: "anthropic/claude-sonnet-5.5",
} as const;

export type EnglishTitles = {
  book: string;
  name: { text: string };
  titles: Record<string, { text: string }>;
};

export type Glossary = {
  language: string;
  terms: Record<string, { en: string; headword: string; refs: string[] }>;
};

export type Translation = {
  text: string;
  source: string;
  status: "unreviewed";
  /** The English title this translates, so a later English change shows. */
  from: string;
  /** Gate problems; absent when every gate passed. */
  gates?: string[];
};

export type Call = {
  language: string;
  keys: string[];
  id: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number | null;
  cost: number | null;
  ms: number;
};

export type Complete = (request: {
  model: string;
  messages: Message[];
}) => Promise<Completion>;

const PROMPT_START = "<!-- prompt:start -->";
const PROMPT_END = "<!-- prompt:end -->";

/** The system prompt between the markers in prompts/translate-titles.md. */
export function systemPrompt(file: string, tag: string): string {
  const start = file.indexOf(PROMPT_START);
  const end = file.indexOf(PROMPT_END);
  if (start < 0 || end < start)
    throw new Error("prompt file has no prompt:start/prompt:end markers");
  const language = LANGUAGES[tag];
  if (language === undefined) throw new Error(`not a v0.1 language: ${tag}`);
  return file
    .slice(start + PROMPT_START.length, end)
    .trim()
    .replaceAll("{{language}}", language)
    .replaceAll("{{tag}}", tag);
}

/** Chapter and verse range a key names (`TIT.1.5-9`, `TIT.P.1.5-9`). */
export function span(key: string): {
  chapter: number;
  from: number;
  to: number;
} {
  const m = /\.(\d+)\.(\d+)-(\d+)$/.exec(key);
  if (!m) throw new Error(`not a span key: ${key}`);
  return { chapter: Number(m[1]), from: Number(m[2]), to: Number(m[3]) };
}

/** Glossary terms linked from any verse in the key's span. */
export function termsFor(
  key: string,
  glossary: Glossary | null
): { en: string; headword: string }[] {
  if (!glossary) return [];
  const { chapter, from, to } = span(key);
  const inSpan = (ref: string) => {
    const m = /^(\d+):(\d+)$/.exec(ref);
    if (!m)
      throw new Error(`${glossary.language}: glossary ref is not c:v: ${ref}`);
    const c = Number(m[1]);
    const v = Number(m[2]);
    return c === chapter && v >= from && v <= to;
  };
  return Object.values(glossary.terms)
    .filter((t) => t.refs.some(inSpan))
    .map(({ en, headword }) => ({ en, headword }));
}

/** The user message: the titles to translate, as JSON the model echoes back. */
export function userMessage(
  english: EnglishTitles,
  keys: string[],
  glossary: Glossary | null
): string {
  const items = keys.map((key) => {
    const title = english.titles[key];
    if (!title) throw new Error(`${english.book}: no English title for ${key}`);
    const { chapter, from, to } = span(key);
    return {
      key,
      kind: key.includes(".P.") ? "section heading" : "segment title",
      verses: `${english.name.text} ${chapter}:${from}${to === from ? "" : `-${to}`}`,
      english: title.text,
      terms: termsFor(key, glossary),
    };
  });
  return JSON.stringify(items, null, 2);
}

/** The model's JSON object of key to value; tolerant of code fences. */
export function parseReply(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("reply has no JSON object");
  const value: unknown = JSON.parse(text.slice(start, end + 1));
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("reply is not a JSON object");
  return value as Record<string, unknown>;
}

export const sha256 = (text: string): string =>
  createHash("sha256").update(text).digest("hex");

export type LanguageResult = {
  titles: Record<string, Translation>;
  call: Call;
  /** Requested keys the reply left out. */
  missing: string[];
  /** Requested keys the reply gave something other than text for. */
  invalid: string[];
  /** Why the reply could not be read at all; the call is still recorded. */
  error?: string;
};

/**
 * Translates `keys` (default: every English title) into `tag` with one call.
 * A key the reply leaves out, or answers with something other than text, is
 * recorded, not retried. A reply that cannot be parsed is recorded as an
 * error with its call, so the spend is never lost.
 */
export async function translateLanguage(args: {
  english: EnglishTitles;
  tag: string;
  glossary: Glossary | null;
  promptFile: string;
  model: string;
  complete: Complete;
  keys?: string[];
}): Promise<LanguageResult> {
  const { english, tag, glossary, model } = args;
  if (SCRIPT_BY_TAG[tag] === undefined)
    throw new Error(`no script gate for ${tag}`);
  if (glossary && glossary.language !== tag)
    throw new Error(`glossary is for ${glossary.language}, not ${tag}`);
  const keys = args.keys ?? Object.keys(english.titles);
  const completion = await args.complete({
    model,
    messages: [
      { role: "system", content: systemPrompt(args.promptFile, tag) },
      { role: "user", content: userMessage(english, keys, glossary) },
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
  if (completion.problem !== undefined)
    return {
      titles: {},
      call,
      missing: [],
      invalid: [],
      error: `no reply: ${completion.problem}`,
    };
  let reply: Record<string, unknown>;
  try {
    reply = parseReply(completion.text);
  } catch (e) {
    return {
      titles: {},
      call,
      missing: [],
      invalid: [],
      error: `unreadable reply: ${(e as Error).message}`,
    };
  }
  const titles: Record<string, Translation> = {};
  const missing: string[] = [];
  const invalid: string[] = [];
  for (const key of keys) {
    const value = reply[key];
    const en = english.titles[key]?.text ?? "";
    if (value === undefined) {
      missing.push(key);
      continue;
    }
    if (typeof value !== "string") {
      invalid.push(key);
      continue;
    }
    const problems = titleProblems(tag, en, value);
    titles[key] = {
      text: value,
      source: `ai:${completion.model}`,
      status: "unreviewed",
      from: en,
      ...(problems.length > 0 ? { gates: problems } : {}),
    };
  }
  return { titles, call, missing, invalid };
}

/**
 * Reasoning tokens over calls (already inside the completion tokens), or null
 * when no call reported them: unknown, not zero.
 */
export function reasoningTotal(calls: Call[]): number | null {
  const known = calls.filter((c) => c.reasoningTokens !== null);
  return known.length === 0
    ? null
    : known.reduce((s, c) => s + (c.reasoningTokens ?? 0), 0);
}

/** Totals for a run: what the Titus run compares between the two models. */
export function summarise(calls: Call[], results: LanguageResult[]) {
  const titles = results.reduce((n, r) => n + Object.keys(r.titles).length, 0);
  const cost = calls.every((c) => c.cost !== null)
    ? calls.reduce((s, c) => s + (c.cost ?? 0), 0)
    : null;
  const ms = calls.reduce((s, c) => s + c.ms, 0);
  return {
    calls: calls.length,
    requested: calls.reduce((n, c) => n + c.keys.length, 0),
    titles,
    missing: results.reduce((n, r) => n + r.missing.length, 0),
    invalid: results.reduce((n, r) => n + r.invalid.length, 0),
    unreadable: results.filter((r) => r.error !== undefined).length,
    gateFailures: results.reduce(
      (n, r) => n + Object.values(r.titles).filter((t) => t.gates).length,
      0
    ),
    promptTokens: calls.reduce((s, c) => s + c.promptTokens, 0),
    completionTokens: calls.reduce((s, c) => s + c.completionTokens, 0),
    reasoningTokens: reasoningTotal(calls),
    cost,
    /** Per title delivered: what a usable title cost. */
    costPerTitle: cost === null || titles === 0 ? null : cost / titles,
    modelSeconds: ms / 1000,
    titlesPerHour: ms === 0 ? null : (titles / ms) * 3_600_000,
  };
}

export type StopReason =
  | "done"
  | { maxCost: number; spent: number; before: string }
  | { unknownCost: string }
  | { error: string; language: string };

/**
 * One model call per language, in order, under a spend fuse, with the ledger
 * written after every call and before any throw, so money spent is always on
 * record. The fuse fails closed: a call whose cost is unknown stops the run
 * before the next call, and the run stops before a call once `maxCost` is
 * spent (the call in flight can still go over it). A result with no `call`
 * (nothing to send for that language) costs nothing. Shared by the
 * translation runner and the cross-model check.
 */
export async function runLanguages<R extends { call?: Call }>(args: {
  tags: string[];
  maxCost: number;
  /** Makes the language's one call; must not throw after it is billed. */
  run: (tag: string) => Promise<R>;
  /** Writes the language's output and logs it; may throw. */
  record: (result: R) => Promise<void>;
  /** Writes the ledger from the results so far. */
  ledger: (stop: StopReason | "running", results: R[]) => Promise<void>;
}): Promise<{ stop: StopReason; results: R[] }> {
  const results: R[] = [];
  let spent = 0;
  let stop: StopReason = "done";
  let current = "";
  try {
    for (const tag of args.tags) {
      current = tag;
      if (spent >= args.maxCost) {
        stop = { maxCost: args.maxCost, spent, before: tag };
        break;
      }
      const result = await args.run(tag);
      results.push(result);
      await args.record(result);
      const cost = result.call ? result.call.cost : 0;
      if (cost === null) {
        stop = { unknownCost: tag };
        break;
      }
      spent += cost;
      await args.ledger("running", results);
    }
  } catch (e) {
    stop = { error: (e as Error).message, language: current };
    throw e;
  } finally {
    await args.ledger(stop, results);
  }
  return { stop, results };
}

/**
 * Runs `tags` in order, one call each (see `runLanguages` for the ledger and
 * the spend fuse), writing `<tag>/<BOOK>.json` after each call.
 */
export async function runBook(args: {
  english: EnglishTitles;
  tags: string[];
  glossaries: Record<string, Glossary | null>;
  promptFile: string;
  model: string;
  complete: Complete;
  keys?: string[];
  maxCost: number;
  /** Writes a JSON value at a path relative to the run's output directory. */
  write: (path: string, value: unknown) => Promise<void>;
  /** Fixed facts for run.json: inputs, hashes, start time. */
  meta: Record<string, unknown>;
  log?: (line: string) => void;
}): Promise<{ stop: StopReason; summary: ReturnType<typeof summarise> }> {
  const log = args.log ?? (() => {});
  const { stop, results } = await runLanguages<LanguageResult>({
    tags: args.tags,
    maxCost: args.maxCost,
    run: (tag) =>
      translateLanguage({
        english: args.english,
        tag,
        glossary: args.glossaries[tag] ?? null,
        promptFile: args.promptFile,
        model: args.model,
        complete: args.complete,
        keys: args.keys,
      }),
    record: async (result) => {
      const tag = result.call.language;
      await args.write(`${tag}/${args.english.book}.json`, {
        language: tag,
        book: args.english.book,
        titles: result.titles,
      });
      const { call } = result;
      log(
        `${tag}: ${Object.keys(result.titles).length} titles, ` +
          `${Object.values(result.titles).filter((t) => t.gates).length} gate failures, ` +
          `${result.missing.length} missing, ${result.invalid.length} invalid` +
          `${result.error ? `, ${result.error}` : ""}, ` +
          `${call.promptTokens}+${call.completionTokens} tokens, ` +
          `$${call.cost?.toFixed(6) ?? "unknown"}, ${call.ms} ms`
      );
    },
    ledger: (stop, results) =>
      args.write("run.json", {
        ...args.meta,
        model: args.model,
        languages: args.tags,
        maxCost: args.maxCost,
        stop,
        updatedAt: new Date().toISOString(),
        results: Object.fromEntries(
          results.map((r) => [
            r.call.language,
            {
              missing: r.missing,
              invalid: r.invalid,
              ...(r.error ? { error: r.error } : {}),
            },
          ])
        ),
        calls: results.map((r) => r.call),
        summary: summarise(
          results.map((r) => r.call),
          results
        ),
      }),
  });
  return {
    stop,
    summary: summarise(
      results.map((r) => r.call),
      results
    ),
  };
}
