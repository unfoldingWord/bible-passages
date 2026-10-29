// Translates one book's English titles into one language per model call,
// with that language's key-term glossary, and gates every result. Pure apart
// from the injected `complete`, so tests run it with a fake model.
//
// Everything it returns is AI output: `source: "ai:<model>"` and status
// `unreviewed` (AGENTS.md, "Label AI output"). A cross-model check, which
// could raise a title to `ai-checked`, is a separate step.
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
 * model and the Claude model that drafted the English titles. Proposed for the
 * Titus run; confirmed on #10 before it.
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
    const [c, v] = ref.split(":").map(Number);
    return c === chapter && v !== undefined && v >= from && v <= to;
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

/** The model's JSON object of key to translation; tolerant of code fences. */
export function parseReply(text: string): Record<string, string> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("reply has no JSON object");
  const value: unknown = JSON.parse(text.slice(start, end + 1));
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("reply is not a JSON object");
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export const sha256 = (text: string): string =>
  createHash("sha256").update(text).digest("hex");

/**
 * Translates `keys` (default: every English title) into `tag` with one call.
 * A key the reply leaves out is recorded as a problem, not retried.
 */
export async function translateLanguage(args: {
  english: EnglishTitles;
  tag: string;
  glossary: Glossary | null;
  promptFile: string;
  model: string;
  complete: Complete;
  keys?: string[];
}): Promise<{
  titles: Record<string, Translation>;
  call: Call;
  missing: string[];
}> {
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
  const reply = parseReply(completion.text);
  const titles: Record<string, Translation> = {};
  const missing: string[] = [];
  for (const key of keys) {
    const value = reply[key];
    const en = english.titles[key]?.text ?? "";
    if (value === undefined) {
      missing.push(key);
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
  return {
    titles,
    missing,
    call: {
      language: tag,
      keys,
      id: completion.id,
      model: completion.model,
      promptTokens: completion.usage.promptTokens,
      completionTokens: completion.usage.completionTokens,
      reasoningTokens: completion.usage.reasoningTokens,
      cost: completion.usage.cost,
      ms: completion.ms,
    },
  };
}

/** Totals for a run: what wave 3 compares between the two models. */
export function summarise(calls: Call[], titles: number, gateFailures: number) {
  const cost = calls.every((c) => c.cost !== null)
    ? calls.reduce((s, c) => s + (c.cost ?? 0), 0)
    : null;
  const ms = calls.reduce((s, c) => s + c.ms, 0);
  return {
    calls: calls.length,
    titles,
    gateFailures,
    promptTokens: calls.reduce((s, c) => s + c.promptTokens, 0),
    completionTokens: calls.reduce((s, c) => s + c.completionTokens, 0),
    cost,
    costPerTitle: cost === null || titles === 0 ? null : cost / titles,
    modelSeconds: ms / 1000,
    titlesPerHour: ms === 0 ? null : (titles / ms) * 3_600_000,
  };
}
