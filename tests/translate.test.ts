import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  ENDPOINT,
  MAX_TOKENS,
  complete,
  type Fetch,
} from "../scripts/lib/openrouter.ts";
import {
  LANGUAGES,
  MODELS,
  parseReply,
  runBook,
  runLanguages,
  span,
  summarise,
  systemPrompt,
  termsFor,
  translateLanguage,
  usableTerm,
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

type Span = { key: string; start: [number, number] };
const psalms = JSON.parse(read("data/structure/PSA.json")) as {
  pericopes: Span[];
  segments: Span[];
};
const inChapter = (c: number) => (s: Span) => s.start[0] === c;
const psalmGlossary = (tag: string) =>
  JSON.parse(read(`data/glossaries/${tag}/PSA.json`)) as Glossary;
// Every language with a Psalms glossary (zh-Hans has none yet).
const psalmTags = [...Object.keys(LANGUAGES), "en"].filter((t) =>
  existsSync(new URL(`data/glossaries/${t}/PSA.json`, root))
);

type Term = { en: string; headword: string };
const byTerm = (a: Term, b: Term) =>
  a.en < b.en
    ? -1
    : a.en > b.en
      ? 1
      : a.headword < b.headword
        ? -1
        : a.headword > b.headword
          ? 1
          : 0;
/** Terms in a fixed order, so lists compare as multisets. */
const multiset = (ts: Term[]): Term[] =>
  ts.map(({ en, headword }) => ({ en, headword })).sort(byTerm);

/** The value, or a failure naming what is missing. */
function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`missing: ${what}`);
  return value;
}

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
      // Bounds the credit reserved for, and the cost of, one call.
      max_tokens: MAX_TOKENS,
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
    expect(() => termsFor("TIT.1.4-4", bad)).toThrow(
      "not c:v or c:front: 1:4-5"
    );
  });

  it("gives a psalm superscription's terms (c:front) to the span that starts at verse 1 (#54)", () => {
    // PSA 3's superscription links psalm, David and Absalom (TWL, 3:front).
    const segments = ["PSA.3.1-2", "PSA.3.3-4", "PSA.3.5-6", "PSA.3.7-8"];
    expect(psalms.segments.filter(inChapter(3)).map((s) => s.key)).toEqual(
      segments
    );
    // The heading key comes from the structure: the pericope at 3:1.
    const heading = psalms.pericopes.filter(
      (p) => p.start[0] === 3 && p.start[1] === 1
    );
    expect(heading.map((p) => p.key)).toEqual(["PSA.P.3.1-8"]);
    const headingKey = defined(heading[0], "heading at 3:1").key;
    expect(psalmTags.length).toBeGreaterThanOrEqual(9);
    for (const tag of psalmTags) {
      const g = psalmGlossary(tag);
      const front = Object.values(g.terms)
        .filter((t) => usableTerm(t) && t.refs.includes("3:front"))
        .map(({ en, headword }) => ({ en, headword }));
      // ar's Translation Words have none of the three (glossary gaps).
      if (tag !== "ar") expect(front.length, tag).toBeGreaterThan(0);
      const first = termsFor("PSA.3.1-2", g);
      for (const t of front) expect(first, `${tag} ${t.en}`).toContainEqual(t);
      // The heading for the whole psalm starts at verse 1 too.
      for (const t of front)
        expect(termsFor(headingKey, g), `${tag} ${t.en}`).toContainEqual(t);
      // A term linked only from the superscription (Absalom's shape) is in
      // no later segment of the psalm.
      const frontOnly = Object.values(g.terms).filter(
        (t) =>
          usableTerm(t) &&
          t.refs.length > 0 &&
          t.refs.every((r) => r === "3:front")
      );
      if (tag !== "ar") expect(frontOnly.length, tag).toBeGreaterThan(0);
      for (const t of frontOnly)
        for (const key of segments.slice(1))
          expect(
            termsFor(key, g).filter(
              (x) => x.en === t.en && x.headword === t.headword
            ),
            `${tag} ${key} ${t.en}`
          ).toEqual([]);
    }
    // Absalom is linked only from the superscription.
    const en = psalmGlossary("en");
    const absalom = { en: "Absalom", headword: "Absalom" };
    expect(en.terms["names/absalom"]?.refs).toEqual(["3:front"]);
    expect(termsFor("PSA.3.1-2", en)).toContainEqual(absalom);
    for (const key of segments.slice(1))
      expect(termsFor(key, en), key).not.toContainEqual(absalom);
    // Another chapter's front does not leak into chapter 3.
    expect(termsFor("PSA.4.1-1", en)).not.toContainEqual(absalom);
  });

  it("gives a term linked from both c:front and c:1 exactly once (#91)", () => {
    const g: Glossary = {
      language: "fr",
      terms: {
        "kt/both": {
          en: "both",
          headword: "les deux",
          refs: ["3:front", "3:1"],
        },
        "kt/front": { en: "front", headword: "titre", refs: ["3:front"] },
      },
    };
    // Compared as multisets: termsFor promises which terms, and each once,
    // not their order (its callers only list them for the model).
    const both = [
      { en: "both", headword: "les deux" },
      { en: "front", headword: "titre" },
    ];
    expect(multiset(termsFor("PSA.3.1-2", g))).toEqual(multiset(both));
    expect(multiset(termsFor("PSA.P.3.1-8", g))).toEqual(multiset(both));
    expect(termsFor("PSA.3.3-4", g)).toEqual([]);
    // In the data: pray (102:front and 102:1) and Yahweh (18:front and
    // 18:1) reach the first segment once each.
    const en = psalmGlossary("en");
    for (const [id, c] of [
      ["kt/pray", 102],
      ["kt/yahweh", 18],
      ["kt/yahweh", 102],
    ] as const) {
      const term = defined(en.terms[id], id);
      expect(term.refs, id).toContain(`${c}:front`);
      expect(term.refs, id).toContain(`${c}:1`);
      const first = defined(
        psalms.segments.find((s) => s.start[0] === c && s.start[1] === 1),
        `${c}:1 segment`
      );
      expect(
        termsFor(first.key, en).filter(
          (t) => t.en === term.en && t.headword === term.headword
        ),
        `${id} ${first.key}`
      ).toEqual([{ en: term.en, headword: term.headword }]);
    }
  });

  it("has a verse-1 segment for every c:front ref in each Psalms glossary (#91)", () => {
    // termsFor drops a c:front ref silently when no span in chapter c starts
    // at verse 1, so the structure must have one for every such chapter.
    const verse1 = psalms.segments.filter((s) => s.start[1] === 1);
    // One verse-1 segment per chapter, in every book, is held by
    // tests/structure.test.ts (#118), so this map drops nothing.
    const firsts = new Map(verse1.map((s) => [s.start[0], s.key]));
    expect(psalmTags.length).toBeGreaterThanOrEqual(9);
    for (const tag of psalmTags) {
      const g = psalmGlossary(tag);
      const chapters = new Set<number>();
      for (const t of Object.values(g.terms))
        for (const r of t.refs) {
          const m = /^(\d+):front$/.exec(r);
          if (m) chapters.add(Number(m[1]));
        }
      expect(chapters.size, tag).toBeGreaterThan(0);
      for (const c of chapters) {
        const key = defined(
          firsts.get(c),
          `${tag} ${c}:front: no verse-1 segment`
        );
        // And the superscription's terms reach that segment.
        const got = termsFor(key, g);
        for (const t of Object.values(g.terms))
          if (usableTerm(t) && t.refs.includes(`${c}:front`))
            expect(got, `${tag} ${key} ${t.en}`).toContainEqual({
              en: t.en,
              headword: t.headword,
            });
      }
    }
  });

  it("leaves out AI-drafted terms no person has reviewed", () => {
    const term = (status?: string) => ({
      en: "grace",
      headword: "恩典",
      refs: ["1:4"],
      ...(status ? { status } : {}),
    });
    const g = (status?: string): Glossary => ({
      language: "zh-Hans",
      terms: { "kt/grace": term(status) },
    });
    expect(termsFor("TIT.1.4-4", g("unreviewed"))).toEqual([]);
    expect(termsFor("TIT.1.4-4", g("ai-checked"))).toEqual([]);
    for (const status of [undefined, "human-reviewed", "approved"])
      expect(termsFor("TIT.1.4-4", g(status)), status).toEqual([
        { en: "grace", headword: "恩典" },
      ]);
    // Today's zh-Hans glossary has no reviewed term, so titles get none.
    const zh = glossary("zh-Hans");
    expect(Object.values(zh.terms).some(usableTerm)).toBe(false);
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

// Every glossary file, as [tag, book], and those whose book has a structure.
type Range = { key: string; start: [number, number]; end: [number, number] };
const glossaryFiles = readdirSync(new URL("data/glossaries/", root))
  .sort()
  .flatMap((tag) =>
    readdirSync(new URL(`data/glossaries/${tag}/`, root))
      .sort()
      .map((file) => [tag, file.replace(/\.json$/, "")] as const)
  );
const hasStructure = ([, book]: readonly [string, string]) =>
  existsSync(new URL(`data/structure/${book}.json`, root));
const structured = glossaryFiles.filter(hasStructure);

describe("termsFor contract, over every glossary with a structure (#106)", () => {
  it("runs over every glossary: Psalms and the other books", () => {
    // Nothing is skipped: a glossary with no structure fails here instead
    // of dropping out of the loop below (#118).
    expect(
      glossaryFiles.filter((f) => !hasStructure(f)),
      "glossary with no structure file"
    ).toEqual([]);
    expect(structured.length).toBeGreaterThan(psalmTags.length);
    for (const tag of psalmTags)
      expect(structured).toContainEqual([tag, "PSA"]);
  });

  it.each(structured)(
    "%s %s: each key gets exactly the usable terms with a ref in its span",
    (tag, book) => {
      const g = JSON.parse(
        read(`data/glossaries/${tag}/${book}.json`)
      ) as Glossary;
      const s = JSON.parse(read(`data/structure/${book}.json`)) as {
        pericopes: Range[];
        segments: Range[];
      };
      // The oracle never parses a ref: it builds the ref strings a span
      // covers ("c:v" for each verse, and "c:front" only when the span
      // starts at verse 1) from the structure's own start and end, and looks
      // each term's refs up by exact string.
      const terms = Object.values(g.terms);
      const byRef = new Map<string, number[]>();
      terms.forEach((t, i) => {
        for (const r of t.refs) byRef.set(r, [...(byRef.get(r) ?? []), i]);
      });
      for (const k of [...s.pericopes, ...s.segments]) {
        const [c, from] = k.start;
        const [endC, to] = k.end;
        expect(endC, `${k.key} crosses a chapter`).toBe(c);
        const covered = [];
        for (let v = from; v <= to; v++) covered.push(`${c}:${v}`);
        if (from === 1) covered.push(`${c}:front`);
        const hits = new Set(covered.flatMap((r) => byRef.get(r) ?? []));
        const want = terms.filter((t, i) => hits.has(i) && usableTerm(t));
        expect(multiset(termsFor(k.key, g)), `${tag} ${k.key}`).toEqual(
          multiset(want)
        );
      }
    }
  );
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
    // A failed reply gets no language file, only its error in the ledger.
    expect(written.has("es-419/TIT.json")).toBe(false);
    expect(written.has("fr/TIT.json")).toBe(true);
  });

  it("treats a cost that is not a finite number >= 0 as unknown, whatever the client", async () => {
    for (const cost of [Number.NaN, -0.01, Number.POSITIVE_INFINITY]) {
      const run = vi.fn(async (tag: string) => ({
        call: {
          language: tag,
          keys: [],
          id: "g",
          model: "m",
          promptTokens: 1,
          completionTokens: 1,
          reasoningTokens: null,
          cost,
          ms: 1,
        },
      }));
      const { stop } = await runLanguages({
        tags: ["fr", "id"],
        maxCost: 1,
        run,
        record: async () => {},
        ledger: async () => {},
      });
      expect(stop, String(cost)).toEqual({ unknownCost: "fr" });
      expect(run, String(cost)).toHaveBeenCalledTimes(1);
    }
  });

  it("refuses, before any call, a book that is not a USFM book code", async () => {
    const complete = vi.fn(scripted([]));
    await expect(
      runBook({
        english: { ...english, book: "../../data/x" },
        tags: ["fr"],
        glossaries: { fr: null },
        promptFile,
        model: "m",
        complete,
        maxCost: 1,
        meta: {},
        write: async () => {},
      })
    ).rejects.toThrow("not a USFM book code");
    expect(complete).not.toHaveBeenCalled();
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

  it("fails before any call for zh-Hans, whose AI terms wait for a reader, without --allow-no-glossary", () => {
    const r = spawnSync(
      process.execPath,
      [script, "--book", "TIT", "--model", "m", "--lang", "zh-Hans"],
      {
        env: { PATH: process.env.PATH ?? "", OPENROUTER_API_KEY: KEY },
        encoding: "utf8",
      }
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(
      "no glossary with reviewed terms for zh-Hans TIT"
    );
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

  it("refuses a --book that is not a USFM book code, before reading any path", () => {
    for (const book of ["../../package", "tit", "XYZ"]) {
      const r = spawnSync(
        process.execPath,
        [script, "--book", book, "--model", "m", "--lang", "fr"],
        {
          env: { PATH: process.env.PATH ?? "", OPENROUTER_API_KEY: KEY },
          encoding: "utf8",
        }
      );
      expect(r.status, book).toBe(1);
      expect(r.stderr, book).toContain(`not a USFM book code: ${book}`);
    }
  });

  it("refuses an --out inside data/ or dist/, before any call", () => {
    for (const out of ["data/titles", "dist", "./data/x/../drafts"]) {
      const r = runWith(["--out", out]);
      expect(r.status, out).toBe(1);
      expect(r.stderr, out).toContain("must not be inside data/ or dist/");
    }
  });
});
