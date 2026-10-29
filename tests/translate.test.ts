import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { ENDPOINT, complete, type Fetch } from "../scripts/lib/openrouter.ts";
import {
  LANGUAGES,
  MODELS,
  parseReply,
  runBook,
  summarise,
  systemPrompt,
  termsFor,
  translateLanguage,
  userMessage,
  type Complete,
  type EnglishTitles,
  type Glossary,
} from "../scripts/lib/translate.ts";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const english = JSON.parse(read("data/titles/en/TIT.json")) as EnglishTitles;
const promptFile = read("prompts/translate-titles.md");
const glossary = (tag: string) =>
  JSON.parse(read(`data/glossaries/${tag}/TIT.json`)) as Glossary;

// A key that only tests use; never a real one.
const KEY = "test-key-not-real-0000";

/** A fetch that answers once with `body` and records what it was sent. */
function fakeFetch(body: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const f: Fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  };
  return { f, calls };
}

const okBody = (content: string, cost: number | null = 0.0012) => ({
  id: "gen-1",
  model: "google/gemini-3.8-flash",
  choices: [{ message: { content } }],
  usage: {
    prompt_tokens: 900,
    completion_tokens: 120,
    ...(cost === null ? {} : { cost }),
    completion_tokens_details: { reasoning_tokens: 20 },
  },
});

describe("OpenRouter client (fetch mocked; no network)", () => {
  it("sends the model and messages with the key only in the header", async () => {
    const { f, calls } = fakeFetch(okBody("{}"));
    let t = 1000;
    const c = await complete(
      {
        model: "google/gemini-3.8-flash",
        messages: [{ role: "user", content: "hi" }],
      },
      { apiKey: KEY, fetch: f, now: () => (t += 250) }
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(ENDPOINT);
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${KEY}`);
    const body = String(calls[0]?.init.body);
    expect(body).not.toContain(KEY);
    expect(JSON.parse(body)).toMatchObject({
      model: "google/gemini-3.8-flash",
      usage: { include: true },
    });
    expect(c).toEqual({
      id: "gen-1",
      model: "google/gemini-3.8-flash",
      text: "{}",
      usage: {
        promptTokens: 900,
        completionTokens: 120,
        reasoningTokens: 20,
        cost: 0.0012,
      },
      ms: 250,
    });
  });

  it("records a missing cost as null rather than zero", async () => {
    const { f } = fakeFetch(okBody("{}", null));
    const c = await complete(
      { model: "m", messages: [] },
      { apiKey: KEY, fetch: f }
    );
    expect(c.usage.cost).toBeNull();
  });

  it("treats a cost that is not a usable dollar amount as unknown", async () => {
    for (const cost of [Number.NaN, -1, "0.1"]) {
      const body = okBody("{}");
      const { f } = fakeFetch({ ...body, usage: { ...body.usage, cost } });
      const c = await complete(
        { model: "m", messages: [] },
        { apiKey: KEY, fetch: f }
      );
      expect(c.usage.cost, String(cost)).toBeNull();
    }
  });

  it("rejects a token count that is not a whole non-negative number", async () => {
    for (const prompt_tokens of [-1, 1.5, "3"]) {
      const body = okBody("{}");
      const { f } = fakeFetch({
        ...body,
        usage: { ...body.usage, prompt_tokens },
      });
      await expect(
        complete({ model: "m", messages: [] }, { apiKey: KEY, fetch: f }),
        String(prompt_tokens)
      ).rejects.toThrow("no usage block");
    }
  });

  it("throws when the completion token count is missing", async () => {
    const { f } = fakeFetch({
      choices: [{ message: { content: "{}" } }],
      usage: { prompt_tokens: 3 },
    });
    await expect(
      complete({ model: "m", messages: [] }, { apiKey: KEY, fetch: f })
    ).rejects.toThrow("no usage block");
  });

  it("returns a billed reply with no content as a problem, keeping its usage", async () => {
    const body = okBody("{}", 0.125);
    for (const raw of [
      { ...body, choices: [{ message: { content: null } }] },
      { ...body, error: { message: `filtered ${KEY}` } },
    ]) {
      const { f } = fakeFetch(raw);
      const c = await complete(
        { model: "m", messages: [] },
        { apiKey: KEY, fetch: f }
      );
      expect(c.text).toBe("");
      expect(c.usage.cost).toBe(0.125);
      expect(c.id).toBe("gen-1");
      expect(c.problem).toMatch(/no message content|OpenRouter error/);
      expect(c.problem).not.toContain(KEY);
    }
    // With no usage there is nothing billed to keep: it throws.
    const { f } = fakeFetch({ choices: [{ message: { content: null } }] });
    await expect(
      complete({ model: "m", messages: [] }, { apiKey: KEY, fetch: f })
    ).rejects.toThrow("no message content");
  });

  it("throws on an HTTP error, with the key removed from the message", async () => {
    const { f } = fakeFetch({ error: { message: `bad key ${KEY}` } }, 401);
    const err = await complete(
      { model: "m", messages: [] },
      { apiKey: KEY, fetch: f }
    ).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect(String(err)).toContain("OpenRouter 401");
    expect(String(err)).not.toContain(KEY);
    expect(String(err)).toContain("[redacted]");
  });

  it("throws on a response with no usage block", async () => {
    const { f } = fakeFetch({ choices: [{ message: { content: "{}" } }] });
    await expect(
      complete({ model: "m", messages: [] }, { apiKey: KEY, fetch: f })
    ).rejects.toThrow("no usage block");
  });
});

describe("translation runner", () => {
  it("names one Gemini and one Claude model (ADR 0002)", () => {
    expect(MODELS.gemini).toMatch(/^google\/gemini-/);
    expect(MODELS.claude).toMatch(/^anthropic\/claude-/);
  });

  it("fills the system prompt from prompts/translate-titles.md", () => {
    const p = systemPrompt(promptFile, "zh-Hans");
    expect(p).toContain("into Simplified Chinese (BCP-47 tag zh-Hans)");
    expect(p).not.toMatch(/\{\{|prompt:start|prompt:end/);
    expect(() => systemPrompt(promptFile, "de")).toThrow("not a v0.1");
    expect(() => systemPrompt("no markers", "ar")).toThrow("markers");
  });

  it("gives each title only the glossary terms its own verses link", () => {
    const g = glossary("es-419");
    const terms = termsFor("TIT.1.4-4", g);
    expect(terms.length).toBeGreaterThan(0);
    for (const t of terms) {
      const entry = Object.values(g.terms).find((e) => e.en === t.en);
      expect(entry?.refs).toContain("1:4");
    }
    expect(termsFor("TIT.1.4-4", null)).toEqual([]);
    const bad: Glossary = {
      language: "fr",
      terms: { "kt/x": { en: "x", headword: "x", refs: ["1:4-5"] } },
    };
    expect(() => termsFor("TIT.1.4-4", bad)).toThrow("not c:v: 1:4-5");
  });

  it("builds a user message with key, kind, verses and English", () => {
    const items = JSON.parse(
      userMessage(english, ["TIT.P.3.9-11", "TIT.1.4-4"], null)
    ) as Record<string, unknown>[];
    expect(items[0]).toMatchObject({
      key: "TIT.P.3.9-11",
      kind: "section heading",
      verses: "Titus 3:9-11",
      english: "Avoid Divisions",
      terms: [],
    });
    expect(items[1]).toMatchObject({
      kind: "segment title",
      verses: "Titus 1:4",
    });
    expect(() => userMessage(english, ["TIT.9.1-1"], null)).toThrow(
      "no English title"
    );
  });

  it("parses a JSON reply, with or without a code fence", () => {
    expect(parseReply('```json\n{"A": "x", "B": 3}\n```')).toEqual({
      A: "x",
      B: 3,
    });
    expect(() => parseReply("no json here")).toThrow("no JSON object");
    expect(() => parseReply("[1]")).toThrow();
  });

  it("labels every translation as unreviewed AI output and records gate failures and gaps", async () => {
    const reply = {
      "TIT.P.3.9-11": "تجنّب الانقسامات",
      "TIT.1.4-4": "بولس يحيي Titus",
    };
    const fake = vi.fn<Complete>(async (request) => ({
      id: "gen-2",
      model: request.model,
      text: JSON.stringify(reply),
      usage: {
        promptTokens: 500,
        completionTokens: 60,
        reasoningTokens: null,
        cost: 0.0004,
      },
      ms: 1200,
    }));
    const result = await translateLanguage({
      english,
      tag: "ar",
      glossary: glossary("ar"),
      promptFile,
      model: "anthropic/claude-sonnet-5.5",
      complete: fake,
      keys: ["TIT.P.3.9-11", "TIT.1.4-4", "TIT.3.15-15"],
    });
    expect(fake).toHaveBeenCalledTimes(1);
    expect(result.titles["TIT.P.3.9-11"]).toEqual({
      text: "تجنّب الانقسامات",
      source: "ai:anthropic/claude-sonnet-5.5",
      status: "unreviewed",
      from: "Avoid Divisions",
    });
    expect(result.titles["TIT.1.4-4"]?.gates).toEqual([
      'stray "Titus" outside Arabic',
    ]);
    expect(result.titles["TIT.1.4-4"]?.status).toBe("unreviewed");
    expect(result.missing).toEqual(["TIT.3.15-15"]);
    expect(result.call).toEqual({
      language: "ar",
      keys: ["TIT.P.3.9-11", "TIT.1.4-4", "TIT.3.15-15"],
      id: "gen-2",
      model: "anthropic/claude-sonnet-5.5",
      promptTokens: 500,
      completionTokens: 60,
      reasoningTokens: null,
      cost: 0.0004,
      ms: 1200,
    });
  });

  it("runs zh-Hans with no glossary and refuses a glossary for another language", async () => {
    const fake: Complete = async (request) => ({
      id: "g",
      model: request.model,
      text: '{"TIT.2.15-15": "提多要带着权柄说话"}',
      usage: {
        promptTokens: 1,
        completionTokens: 1,
        reasoningTokens: null,
        cost: 0,
      },
      ms: 1,
    });
    const args = {
      english,
      promptFile,
      model: "m",
      complete: fake,
      keys: ["TIT.2.15-15"],
    };
    const zh = await translateLanguage({
      ...args,
      tag: "zh-Hans",
      glossary: null,
    });
    expect(zh.titles["TIT.2.15-15"]?.gates).toBeUndefined();
    await expect(
      translateLanguage({ ...args, tag: "ru", glossary: glossary("ar") })
    ).rejects.toThrow("glossary is for ar, not ru");
  });

  it("sums cost per title and titles per hour, and keeps an unknown cost unknown", () => {
    const call = {
      language: "ar",
      keys: ["A", "B", "C"],
      id: "",
      model: "m",
      promptTokens: 100,
      completionTokens: 10,
      reasoningTokens: null,
      cost: 0.01 as number | null,
      ms: 1800,
    };
    const t = {
      text: "x",
      source: "ai:m",
      status: "unreviewed" as const,
      from: "y",
    };
    const result = {
      titles: { A: t, B: { ...t, gates: ["empty"] } },
      call,
      missing: ["C"],
      invalid: [],
    };
    expect(summarise([call, call], [result, result])).toEqual({
      calls: 2,
      requested: 6,
      titles: 4,
      missing: 2,
      invalid: 0,
      unreadable: 0,
      gateFailures: 2,
      promptTokens: 200,
      completionTokens: 20,
      reasoningTokens: null,
      cost: 0.02,
      costPerTitle: 0.005,
      modelSeconds: 3.6,
      titlesPerHour: 4000,
    });
    expect(summarise([{ ...call, cost: null }], [result]).cost).toBeNull();
    // Reasoning tokens: summed when every call reports them, else unknown.
    const r7 = { ...call, reasoningTokens: 7 };
    expect(summarise([r7, r7], [result, result]).reasoningTokens).toBe(14);
    expect(summarise([call, r7], [result, result]).reasoningTokens).toBeNull();
  });

  it("covers every v0.1 language", () => {
    expect(Object.keys(LANGUAGES).sort()).toEqual(
      ["ar", "es-419", "fr", "hi", "id", "pt-BR", "ru", "sw", "zh-Hans"].sort()
    );
  });
});

/** A fake model answering each call in turn from `answers`. */
function scripted(
  answers: ({ text: string; cost: number | null } | Error)[]
): Complete {
  let n = 0;
  return async (request) => {
    const a = answers[n++];
    if (a === undefined) throw new Error("unexpected extra call");
    if (a instanceof Error) throw a;
    return {
      id: `gen-${n}`,
      model: request.model,
      text: a.text,
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        reasoningTokens: null,
        cost: a.cost,
      },
      ms: 100,
    };
  };
}

describe("run ledger and spend fuse", () => {
  const keys = ["TIT.P.3.9-11"];
  const setup = (complete: Complete, maxCost = 1) => {
    const written = new Map<string, unknown>();
    const ledgers: unknown[] = [];
    return {
      written,
      ledgers,
      run: () =>
        runBook({
          english,
          tags: ["es-419", "fr", "id"],
          glossaries: { "es-419": null, fr: null, id: null },
          promptFile,
          model: "m",
          complete,
          keys,
          maxCost,
          meta: { book: "TIT" },
          write: async (path, value) => {
            written.set(path, structuredClone(value));
            if (path === "run.json") ledgers.push(structuredClone(value));
          },
        }),
    };
  };
  const ledger = (w: Map<string, unknown>) =>
    w.get("run.json") as {
      stop: unknown;
      calls: { language: string; cost: number | null }[];
      summary: { cost: number | null };
    };

  it("stops before the next call when a call's cost is unknown, and records it", async () => {
    const complete = vi.fn(
      scripted([
        { text: '{"TIT.P.3.9-11": "Evitar las divisiones"}', cost: null },
        { text: '{"TIT.P.3.9-11": "Éviter les divisions"}', cost: 0.001 },
      ])
    );
    const { written, run } = setup(complete);
    const { stop } = await run();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(stop).toEqual({ unknownCost: "es-419" });
    expect(ledger(written).stop).toEqual({ unknownCost: "es-419" });
    expect(ledger(written).calls).toHaveLength(1);
    expect(ledger(written).summary.cost).toBeNull();
  });

  it("stops before a call once the limit is spent", async () => {
    const complete = vi.fn(
      scripted([
        { text: '{"TIT.P.3.9-11": "Evitar las divisiones"}', cost: 0.3 },
        { text: '{"TIT.P.3.9-11": "Éviter les divisions"}', cost: 0.3 },
      ])
    );
    const { written, run } = setup(complete, 0.5);
    const { stop } = await run();
    expect(complete).toHaveBeenCalledTimes(2);
    expect(stop).toEqual({ maxCost: 0.5, spent: 0.6, before: "id" });
    expect(ledger(written).calls.map((c) => c.cost)).toEqual([0.3, 0.3]);
  });

  it("keeps the ledger of earlier calls when a later call throws", async () => {
    const { written, ledgers, run } = setup(
      scripted([
        { text: '{"TIT.P.3.9-11": "Evitar las divisiones"}', cost: 0.002 },
        new Error("OpenRouter 429: rate limited"),
      ])
    );
    await expect(run()).rejects.toThrow("429");
    expect(ledger(written).stop).toEqual({
      error: "OpenRouter 429: rate limited",
      language: "fr",
    });
    expect(ledger(written).calls).toEqual([
      expect.objectContaining({ language: "es-419", cost: 0.002 }),
    ]);
    expect(written.has("es-419/TIT.json")).toBe(true);
    // Written after the first call too, not only at the end.
    expect(ledgers.length).toBeGreaterThanOrEqual(2);
  });

  it("puts a billed call with no content on the ledger and goes on", async () => {
    const body = okBody("{}", 0.125);
    const replies = [
      { ...body, choices: [{ message: { content: null } }] },
      okBody('{"TIT.P.3.9-11": "Éviter les divisions"}', 0.001),
      okBody('{"TIT.P.3.9-11": "Hindari perpecahan"}', 0.001),
    ];
    let n = 0;
    const f: Fetch = async () =>
      new Response(JSON.stringify(replies[n++]), { status: 200 });
    const { written, run } = setup((request) =>
      complete(request, { apiKey: KEY, fetch: f })
    );
    const { stop, summary } = await run();
    expect(stop).toBe("done");
    const l = written.get("run.json") as {
      calls: { language: string; cost: number | null }[];
      results: Record<string, { error?: string }>;
    };
    expect(l.calls[0]).toMatchObject({ language: "es-419", cost: 0.125 });
    expect(l.results["es-419"]?.error).toBe(
      "no reply: OpenRouter response has no message content"
    );
    expect(summary.cost).toBeCloseTo(0.127, 10);
    expect(summary.unreadable).toBe(1);
  });

  it("records an unreadable reply and a non-text value with their call", async () => {
    const { written, run } = setup(
      scripted([
        { text: "Sorry, I cannot help with that.", cost: 0.001 },
        { text: '{"TIT.P.3.9-11": 42}', cost: 0.001 },
        { text: '{"TIT.P.3.9-11": "Hindari perpecahan"}', cost: 0.001 },
      ])
    );
    const { stop, summary } = await run();
    expect(stop).toBe("done");
    expect(summary).toMatchObject({
      calls: 3,
      titles: 1,
      unreadable: 1,
      invalid: 1,
    });
    const results = (written.get("run.json") as { results: unknown }).results;
    expect(results).toEqual({
      "es-419": {
        missing: [],
        invalid: [],
        error: "unreadable reply: reply has no JSON object",
      },
      fr: { missing: [], invalid: ["TIT.P.3.9-11"] },
      id: { missing: [], invalid: [] },
    });
  });
});

describe("runner command line", () => {
  const script = fileURLToPath(new URL("scripts/translate/titles.ts", root));
  const run = (env: Record<string, string>) =>
    spawnSync(process.execPath, [script, "--book", "TIT", "--model", "m"], {
      env: { PATH: process.env.PATH ?? "", ...env },
      encoding: "utf8",
    });

  it("fails clearly, before any call, when OPENROUTER_API_KEY is missing", () => {
    const r = run({});
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("OPENROUTER_API_KEY is not set");
  });

  it("fails before any call for zh-Hans without --allow-no-glossary", () => {
    const r = spawnSync(
      process.execPath,
      [script, "--book", "TIT", "--model", "m", "--lang", "zh-Hans"],
      {
        env: { PATH: process.env.PATH ?? "", OPENROUTER_API_KEY: KEY },
        encoding: "utf8",
      }
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("no glossary for zh-Hans TIT");
    expect(r.stderr + r.stdout).not.toContain(KEY);
  });

  const runWith = (args: string[]) =>
    spawnSync(
      process.execPath,
      [script, "--book", "TIT", "--model", "m", "--lang", "fr", ...args],
      {
        env: { PATH: process.env.PATH ?? "", OPENROUTER_API_KEY: KEY },
        encoding: "utf8",
      }
    );

  it("refuses an --out that already exists, before any call, keeping the earlier ledger", () => {
    const dir = mkdtempSync(join(tmpdir(), "translate-"));
    writeFileSync(join(dir, "run.json"), '{"calls":[{"cost":0.125}]}');
    const r = runWith(["--out", dir]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("--out already exists");
    expect(readdirSync(dir)).toEqual(["run.json"]);
    expect(readFileSync(join(dir, "run.json"), "utf8")).toBe(
      '{"calls":[{"cost":0.125}]}'
    );
  });

  it("refuses an --out inside data/ or dist/, before any call", () => {
    for (const out of ["data/titles", "dist", "./data/x/../drafts"]) {
      const r = runWith(["--out", out]);
      expect(r.status, out).toBe(1);
      expect(r.stderr, out).toContain("must not be inside data/ or dist/");
    }
  });
});
