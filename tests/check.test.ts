import { spawnSync } from "node:child_process";
import {
  mkdirSync,
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
  CRITERIA,
  checkBook,
  checkLanguage,
  checkMessage,
  family,
  readVerdict,
  type TranslatedFile,
} from "../scripts/lib/check.ts";
import {
  MODELS,
  sha256,
  systemPrompt,
  type Complete,
  type EnglishTitles,
  type Glossary,
  type Translation,
} from "../scripts/lib/translate.ts";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const englishText = read("data/titles/en/TIT.json");
const english = JSON.parse(englishText) as EnglishTitles;
const promptFile = read("prompts/check-translations.md");
const glossary = (tag: string) =>
  JSON.parse(read(`data/glossaries/${tag}/TIT.json`)) as Glossary;

// A key that only tests use; never a real one.
const KEY = "test-key-not-real-0000";

const A = "TIT.P.3.9-11";
const B = "TIT.3.15-15";
const en = (key: string) => english.titles[key]!.text;
const translation = (
  key: string,
  text: string,
  extra: Partial<Translation> = {}
): Translation => ({
  text,
  source: `ai:${MODELS.gemini}`,
  status: "unreviewed",
  from: en(key),
  ...extra,
});
const fileOf = (
  language: string,
  titles: Record<string, Translation>
): TranslatedFile => ({ language, book: "TIT", titles });

/** A fake model answering each call in turn; `model` is who answers. */
function scripted(
  answers: ({ text: string; cost: number | null; model?: string } | Error)[]
): Complete {
  let n = 0;
  return async (request) => {
    const a = answers[n++];
    if (a === undefined) throw new Error("unexpected extra call");
    if (a instanceof Error) throw a;
    return {
      id: `gen-${n}`,
      model: a.model ?? request.model,
      text: a.text,
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        reasoningTokens: 2,
        cost: a.cost,
      },
      ms: 100,
    };
  };
}

const disagree = {
  verdict: "disagree",
  criteria: ["terms"],
  why: "Uses a word other than the glossary headword.",
  suggestion: "Evitar las divisiones",
};

describe("cross-model check: pieces", () => {
  it("tells the model family from an OpenRouter id or a source", () => {
    expect(family(MODELS.gemini)).toBe("google");
    expect(family(`ai:${MODELS.claude}`)).toBe("anthropic");
    expect(() => family("ai:claude-opus-5-5")).toThrow("model family");
  });

  it("reads a hand-edited source as its family, and refuses a family ADR 0002 does not name", () => {
    for (const source of [
      "ai:ai:google/gemini-3.8-flash",
      " ai: Google/gemini-3.8-flash ",
      "AI:GOOGLE/gemini-3.8-flash",
    ])
      expect(family(source), source).toBe("google");
    expect(() => family("openai/gpt-5")).toThrow("ADR 0002 does not name");
    expect(() => family(42 as unknown as string)).toThrow("model family");
  });

  it("fills the system prompt from prompts/check-translations.md and names every criterion", () => {
    const p = systemPrompt(promptFile, "fr");
    expect(p).toContain("from English into French (BCP-47 tag fr)");
    expect(p).not.toContain("{{");
    for (const c of CRITERIA) expect(p).toContain(`"${c}"`);
  });

  it("sends each translation with its English, verses and key terms", () => {
    const items = JSON.parse(
      checkMessage(
        english,
        { [B]: translation(B, "Salutations finales") },
        glossary("fr")
      )
    ) as Record<string, unknown>[];
    expect(items).toEqual([
      expect.objectContaining({
        key: B,
        kind: "segment title",
        verses: "Titus 3:15",
        english: en(B),
        translation: "Salutations finales",
      }),
    ]);
    expect(Array.isArray(items[0]?.terms)).toBe(true);
  });

  it("reads a well-formed verdict and rejects a malformed one", () => {
    expect(readVerdict({ verdict: "agree", why: "fine" }, "ai:x/y")).toEqual({
      by: "ai:x/y",
      verdict: "agree",
    });
    expect(readVerdict(disagree, "ai:x/y")).toEqual({
      by: "ai:x/y",
      ...disagree,
    });
    const bad = [
      null,
      "agree",
      { verdict: "maybe" },
      { ...disagree, criteria: [] },
      { ...disagree, criteria: ["covers"] },
      { ...disagree, criteria: ["terms", "terms"] },
      { ...disagree, criteria: "terms" },
      { ...disagree, why: "" },
      { ...disagree, suggestion: " Evitar" },
      { verdict: "disagree", criteria: ["terms"], why: "x" },
      // An agreement that names criteria or a suggestion contradicts itself.
      { verdict: "agree", criteria: ["accurate"] },
      { verdict: "agree", suggestion: "Evitar las divisiones" },
    ];
    for (const v of bad)
      expect(readVerdict(v, "ai:x/y"), JSON.stringify(v)).toBeNull();
  });
});

describe("cross-model check: one language", () => {
  const base = {
    english,
    glossary: glossary("es-419"),
    promptFile,
    model: MODELS.claude,
  };

  it("marks agreement ai-checked, and a disagreement or a gate failure unreviewed", async () => {
    const C = "TIT.1.4-4";
    const file = fileOf("es-419", {
      [A]: translation(A, "Evitad las divisiones"),
      [B]: translation(B, "Saludos finales"),
      [C]: translation(C, "Pablo saluda a Tito", { gates: ["markup"] }),
    });
    const r = await checkLanguage({
      ...base,
      file,
      complete: scripted([
        {
          text: JSON.stringify({
            [A]: disagree,
            [B]: { verdict: "agree" },
            [C]: { verdict: "agree" },
          }),
          cost: 0.002,
        },
      ]),
    });
    const by = `ai:${MODELS.claude}`;
    expect(r.titles[A]).toEqual({
      ...file.titles[A],
      status: "unreviewed",
      check: { by, ...disagree },
    });
    expect(r.titles[B]).toEqual({
      ...file.titles[B],
      status: "ai-checked",
      check: { by, verdict: "agree" },
    });
    // Agreed, but a gate failed: a person sees it first.
    expect(r.titles[C]?.status).toBe("unreviewed");
    expect(r.call).toMatchObject({
      language: "es-419",
      cost: 0.002,
      reasoningTokens: 2,
    });
    expect(r.missing).toEqual([]);
    expect(r.invalid).toEqual([]);
  });

  it("records missing and malformed verdicts, which stay unreviewed with no check", async () => {
    const file = fileOf("es-419", {
      [A]: translation(A, "Evitar las divisiones"),
      [B]: translation(B, "Saludos finales"),
    });
    const r = await checkLanguage({
      ...base,
      file,
      complete: scripted([
        { text: JSON.stringify({ [B]: { verdict: "perhaps" } }), cost: 0.001 },
      ]),
    });
    expect(r.missing).toEqual([A]);
    expect(r.invalid).toEqual([B]);
    for (const k of [A, B]) {
      expect(r.titles[k]?.status).toBe("unreviewed");
      expect(r.titles[k]?.check).toBeUndefined();
    }
  });

  it("keeps an unreadable reply's call and leaves every title unreviewed", async () => {
    const file = fileOf("es-419", {
      [A]: translation(A, "Evitar las divisiones"),
    });
    const r = await checkLanguage({
      ...base,
      file,
      complete: scripted([{ text: "I cannot do that.", cost: 0.001 }]),
    });
    expect(r.error).toBe("unreadable reply: reply has no JSON object");
    expect(r.call?.cost).toBe(0.001);
    expect(r.titles[A]?.status).toBe("unreviewed");
  });

  it("does not record a verdict from a model of the translator's family", async () => {
    const file = fileOf("es-419", {
      [A]: translation(A, "Evitar las divisiones"),
    });
    const r = await checkLanguage({
      ...base,
      file,
      complete: scripted([
        {
          text: JSON.stringify({ [A]: { verdict: "agree" } }),
          cost: 0.001,
          model: "google/gemini-3.8-flash",
        },
      ]),
    });
    expect(r.error).toContain("not the anthropic/claude-sonnet-5.5 family");
    expect(r.titles[A]?.check).toBeUndefined();
  });

  it("refuses, before any call, a check by the same family or against changed English", async () => {
    const complete = vi.fn(scripted([]));
    const same = fileOf("es-419", {
      [A]: translation(A, "Evitar las divisiones", {
        source: `ai:${MODELS.claude}`,
      }),
    });
    await expect(
      checkLanguage({ ...base, file: same, complete })
    ).rejects.toThrow("checked by its own family");
    const stale = fileOf("es-419", {
      [A]: translation(A, "Evitar las divisiones", { from: "Avoid Division" }),
    });
    await expect(
      checkLanguage({ ...base, file: stale, complete })
    ).rejects.toThrow("the English is now");
    await expect(
      checkLanguage({
        ...base,
        glossary: glossary("fr"),
        file: stale,
        complete,
      })
    ).rejects.toThrow("glossary is for fr");
    expect(complete).not.toHaveBeenCalled();
  });

  it("refuses a doubled ai: prefix checked by its own family, with no call", async () => {
    const complete = vi.fn(scripted([]));
    const file = fileOf("es-419", {
      [A]: translation(A, "Evitar las divisiones", {
        source: "ai:ai:google/gemini-3.8-flash",
      }),
    });
    await expect(
      checkLanguage({ ...base, model: MODELS.gemini, file, complete })
    ).rejects.toThrow("checked by its own family");
    expect(complete).not.toHaveBeenCalled();
  });

  it("refuses a title that is not well formed, naming its key, with no call", async () => {
    const complete = vi.fn(scripted([]));
    for (const [title, message] of [
      [
        { ...translation(A, "x"), source: 7 },
        `es-419 ${A}: source is not a string`,
      ],
      [null, `es-419 ${A}: not a title object`],
      [
        { ...translation(A, "x"), gates: "length" },
        `es-419 ${A}: gates is not a list`,
      ],
    ] as const) {
      const file = fileOf("es-419", {
        [A]: title as unknown as Translation,
      });
      await expect(
        checkLanguage({ ...base, file, complete }),
        message
      ).rejects.toThrow(message);
    }
    expect(complete).not.toHaveBeenCalled();
  });

  it("records, not throws, a billed reply from a model whose family cannot be told", async () => {
    const file = fileOf("es-419", {
      [A]: translation(A, "Evitar las divisiones"),
    });
    const r = await checkLanguage({
      ...base,
      file,
      complete: scripted([
        {
          text: JSON.stringify({ [A]: { verdict: "agree" } }),
          cost: 0.25,
          model: "claude-sonnet-5.5",
        },
      ]),
    });
    expect(r.error).toContain("cannot tell the model family");
    expect(r.call?.cost).toBe(0.25);
    expect(r.titles[A]?.status).toBe("unreviewed");
    expect(r.titles[A]?.check).toBeUndefined();
  });

  it("drops a check already on the input, so a re-check never keeps a stale verdict", async () => {
    const stale = {
      ...translation(A, "Evitar las divisiones"),
      status: "ai-checked",
      check: { by: "ai:x/y", verdict: "agree" },
    } as unknown as Translation;
    const r = await checkLanguage({
      ...base,
      file: fileOf("es-419", { [A]: stale }),
      complete: scripted([{ text: "{}", cost: 0.001 }]),
    });
    expect(r.missing).toEqual([A]);
    expect(r.titles[A]).toEqual({
      ...translation(A, "Evitar las divisiones"),
      status: "unreviewed",
    });
  });

  it("refuses a language that is not a v0.1 tag, so it can never name a path", async () => {
    const complete = vi.fn(scripted([]));
    for (const language of ["../../data/drafts/en", "toString", "en"])
      await expect(
        checkLanguage({
          ...base,
          glossary: null,
          file: fileOf(language, {}),
          complete,
        }),
        language
      ).rejects.toThrow("not a v0.1 language");
    expect(complete).not.toHaveBeenCalled();
  });

  it("makes no call for a language with nothing to check", async () => {
    const complete = vi.fn(scripted([]));
    const r = await checkLanguage({
      ...base,
      file: fileOf("es-419", {}),
      complete,
    });
    expect(complete).not.toHaveBeenCalled();
    expect(r.call).toBeUndefined();
  });
});

describe("cross-model check: a book, ledger and spend fuse", () => {
  const files = [
    fileOf("es-419", { [A]: translation(A, "Evitar las divisiones") }),
    fileOf("fr", {}),
    fileOf("id", { [A]: translation(A, "Hindari perpecahan") }),
  ];
  const setup = (complete: Complete, maxCost = 1) => {
    const written = new Map<string, unknown>();
    return {
      written,
      run: () =>
        checkBook({
          english,
          files,
          glossaries: { "es-419": null, fr: null, id: null },
          promptFile,
          model: MODELS.claude,
          complete,
          maxCost,
          meta: { book: "TIT" },
          write: async (path, value) => {
            written.set(path, structuredClone(value));
          },
        }),
    };
  };

  it("checks each language, skips an empty one, and totals the verdicts", async () => {
    const { written, run } = setup(
      scripted([
        { text: JSON.stringify({ [A]: disagree }), cost: 0.003 },
        { text: JSON.stringify({ [A]: { verdict: "agree" } }), cost: 0.001 },
      ])
    );
    const { stop, summary } = await run();
    expect(stop).toBe("done");
    expect(summary).toMatchObject({
      calls: 2,
      titles: 2,
      checked: 2,
      agree: 1,
      disagree: 1,
      aiChecked: 1,
      byCriterion: { accurate: 0, terms: 1, names: 0, plain: 0, style: 0 },
      reasoningTokens: 4,
      cost: 0.004,
      costPerCheck: 0.002,
    });
    const ledger = written.get("run.json") as {
      results: Record<string, unknown>;
      calls: unknown[];
    };
    expect(ledger.calls).toHaveLength(2);
    expect(ledger.results.fr).toEqual({
      missing: [],
      invalid: [],
      skipped: "nothing to check",
    });
    expect(written.get("id/TIT.json")).toMatchObject({
      language: "id",
      book: "TIT",
      titles: { [A]: { status: "ai-checked" } },
    });
  });

  it("stops before the next call when a call's cost is unknown", async () => {
    const complete = vi.fn(
      scripted([
        { text: JSON.stringify({ [A]: { verdict: "agree" } }), cost: null },
        { text: "{}", cost: 0.001 },
      ])
    );
    const { written, run } = setup(complete);
    const { stop } = await run();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(stop).toEqual({ unknownCost: "es-419" });
    expect((written.get("run.json") as { stop: unknown }).stop).toEqual({
      unknownCost: "es-419",
    });
  });

  it("refuses every file before the first call, so no language is billed before a later one is refused", async () => {
    const complete = vi.fn(scripted([]));
    const written = new Map<string, unknown>();
    await expect(
      checkBook({
        english,
        files: [
          fileOf("es-419", { [A]: translation(A, "Evitar las divisiones") }),
          fileOf("id", {
            [A]: translation(A, "Hindari perpecahan", {
              source: `ai:${MODELS.claude}`,
            }),
          }),
        ],
        glossaries: { "es-419": null, id: null },
        promptFile,
        model: MODELS.claude,
        complete,
        maxCost: 1,
        meta: { book: "TIT" },
        write: async (path, value) => {
          written.set(path, value);
        },
      })
    ).rejects.toThrow("id TIT.P.3.9-11");
    expect(complete).not.toHaveBeenCalled();
    expect(written.size).toBe(0);
  });

  it("stops before a call once the limit is spent", async () => {
    const complete = vi.fn(
      scripted([{ text: JSON.stringify({ [A]: disagree }), cost: 0.6 }])
    );
    const { run } = setup(complete, 0.5);
    const { stop } = await run();
    expect(complete).toHaveBeenCalledTimes(1);
    // fr has nothing to check, so the fuse fires at fr, before any call.
    expect(stop).toEqual({ maxCost: 0.5, spent: 0.6, before: "fr" });
  });
});

describe("checker command line", () => {
  const script = fileURLToPath(new URL("scripts/translate/check.ts", root));
  const env = { PATH: process.env.PATH ?? "", OPENROUTER_API_KEY: KEY };
  /** A translation run directory with a ledger and one language file. */
  const fakeRun = (ledger: Record<string, unknown> = {}) => {
    const dir = mkdtempSync(join(tmpdir(), "check-run-"));
    writeFileSync(
      join(dir, "run.json"),
      JSON.stringify({
        book: "TIT",
        model: MODELS.gemini,
        languages: ["fr"],
        english: {
          file: "data/titles/en/TIT.json",
          sha256: sha256(englishText),
        },
        glossaries: { fr: sha256(read("data/glossaries/fr/TIT.json")) },
        ...ledger,
      })
    );
    mkdirSync(join(dir, "fr"));
    writeFileSync(
      join(dir, "fr", "TIT.json"),
      JSON.stringify(
        fileOf("fr", { [A]: translation(A, "Éviter les divisions") })
      )
    );
    return dir;
  };
  const run = (args: string[], e: Record<string, string> = env) =>
    spawnSync(process.execPath, [script, ...args], {
      env: e,
      encoding: "utf8",
    });

  it("fails clearly, before any call, when OPENROUTER_API_KEY is missing", () => {
    const r = run(["--run", fakeRun(), "--model", MODELS.claude], {
      PATH: env.PATH,
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("OPENROUTER_API_KEY is not set");
  });

  it("refuses a checker of the translator's family", () => {
    const r = run(["--run", fakeRun(), "--model", "google/gemini-other"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("must be checked by another family");
    expect(r.stderr + r.stdout).not.toContain(KEY);
  });

  it("refuses a --model with no provider prefix with a clear message, not a stack", () => {
    const r = run(["--run", fakeRun(), "--model", "claude-sonnet-5.5"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(
      "check: cannot tell the model family of claude-sonnet-5.5"
    );
    expect(r.stderr).not.toMatch(/^\s+at /m);
  });

  it("refuses a run whose English or glossary has changed since", () => {
    let r = run([
      "--run",
      fakeRun({ english: { file: "x", sha256: "0" } }),
      "--model",
      MODELS.claude,
    ]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("has changed since the translation run");
    r = run([
      "--run",
      fakeRun({ glossaries: { fr: "0" } }),
      "--model",
      MODELS.claude,
    ]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("fr glossary has changed");
  });

  it("refuses a run file whose language or book is not its directory's, writing nothing", () => {
    const dir = fakeRun();
    writeFileSync(
      join(dir, "fr", "TIT.json"),
      JSON.stringify(
        fileOf("../../data/drafts/en", {
          [A]: translation(A, "Éviter les divisions"),
        })
      )
    );
    const before = read("data/drafts/en/TIT.json");
    const out = join(mkdtempSync(join(tmpdir(), "check-out-")), "new");
    const r = run(["--run", dir, "--model", MODELS.claude, "--out", out]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("fr/TIT.json is for ../../data/drafts/en TIT");
    expect(read("data/drafts/en/TIT.json")).toBe(before);
  });

  it("refuses a ledger with an unknown book or language, or missing fields, with a clear message", () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ book: "../TIT" }, "not a USFM book code"],
      [{ languages: ["fr", "../x"] }, "not v0.1 language tags"],
      [{ languages: ["fr", "toString"] }, "not v0.1 language tags"],
      [{ glossaries: undefined }, "no glossary hashes"],
      [{ english: undefined }, "no English hash"],
      [{ model: "gemini" }, "cannot tell the model family"],
      [{ glossaries: [] }, "no glossary hashes"],
      [{ glossaries: {} }, "no glossary hash for fr"],
      [{ glossaries: { fr: 7 } }, "no glossary hash for fr"],
      [{ languages: ["fr", "fr"] }, "lists a language twice"],
    ];
    for (const [ledger, message] of cases) {
      const r = run(["--run", fakeRun(ledger), "--model", MODELS.claude]);
      expect(r.status, message).toBe(1);
      expect(r.stderr, message).toContain(`check: `);
      expect(r.stderr, message).toContain(message);
    }
  });

  it("refuses a run file that is not JSON or has no titles object", () => {
    for (const [body, message] of [
      ["{not json", "fr/TIT.json is not JSON"],
      [
        '{"language":"fr","book":"TIT","titles":[]}',
        "fr/TIT.json has no titles object",
      ],
    ]) {
      const dir = fakeRun();
      writeFileSync(join(dir, "fr", "TIT.json"), body!);
      const r = run(["--run", dir, "--model", MODELS.claude]);
      expect(r.status, message).toBe(1);
      expect(r.stderr, message).toContain(`check: ${message}`);
    }
  });

  it("exits 2 when a language in the run has no translations file", () => {
    // ar is in the run but has no file, and fr has nothing to check, so no
    // call is made; the run still does not count as complete.
    const dir = fakeRun({
      languages: ["fr", "ar"],
      glossaries: {
        fr: sha256(read("data/glossaries/fr/TIT.json")),
        ar: sha256(read("data/glossaries/ar/TIT.json")),
      },
    });
    writeFileSync(
      join(dir, "fr", "TIT.json"),
      JSON.stringify(fileOf("fr", {}))
    );
    const out = join(mkdtempSync(join(tmpdir(), "check-out-")), "new");
    const r = run(["--run", dir, "--model", MODELS.claude, "--out", out]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("no translations to check for ar");
    const ledger = JSON.parse(readFileSync(join(out, "run.json"), "utf8"));
    expect(ledger.notInRun).toEqual(["ar"]);
    expect(ledger.calls).toEqual([]);
  });

  it("refuses an --out that exists or is inside data/ or dist/, before any call", () => {
    const existing = mkdtempSync(join(tmpdir(), "check-out-"));
    for (const out of [existing, "data/drafts", "dist"]) {
      const r = run([
        "--run",
        fakeRun(),
        "--model",
        MODELS.claude,
        "--out",
        out,
      ]);
      expect(r.status, out).toBe(1);
      expect(r.stderr, out).toMatch(/already exists|must not be inside data/);
    }
    expect(readdirSync(existing)).toEqual([]);
  });
});
