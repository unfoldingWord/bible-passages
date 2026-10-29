import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  linkedArticles,
  parseTwl,
  twId,
  twlId,
  type Credit,
  type TwlRow,
} from "../scripts/lib/glossaries.ts";
import {
  buildDraftGlossary,
  checkMessage,
  definition,
  draftKeyTerms,
  DRAFT_LANGUAGES,
  draftMessage,
  gateProblems,
  parseFia,
  promptPart,
  readCheck,
  readDraft,
  statusOf,
  type Complete,
  type DraftGlossary,
  type DraftRecord,
  type TermInput,
} from "../scripts/lib/key-terms.ts";
import type { Completion } from "../scripts/lib/openrouter.ts";
import { readSource, sources } from "../scripts/lib/sources.ts";
import { sha256 } from "../scripts/lib/translate.ts";

// AI-drafted key-term glossaries (zh-Hans): scripts/lib/key-terms.ts and
// docs/scoping/glossaries.md, "Chinese (zh-Hans)".

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const HAN = /\p{Script=Han}/u;
const KEY = "test-key-not-real-0000";

describe("parseFia", () => {
  it("reads name and localizedName, each pair once, sorted", () => {
    const json = JSON.stringify({
      "2": { name: "elder", localizedName: "长老" },
      "1": { name: "apostle", localizedName: " 使徒 " },
      "3": { name: "elder", localizedName: "长老" },
      "4": { name: "Lord", localizedName: "主、耶和华" },
      "5": { name: "Lord", localizedName: "主" },
    });
    expect(parseFia(json)).toEqual([
      { en: "Lord", term: "主" },
      { en: "Lord", term: "主、耶和华" },
      { en: "apostle", term: "使徒" },
      { en: "elder", term: "长老" },
    ]);
  });

  it("refuses a resource without names, or with a blank one", () => {
    expect(() => parseFia('{"1":{"name":"x"}}')).toThrow("localizedName");
    expect(() => parseFia('{"1":{"name":"x","localizedName":" "}}')).toThrow(
      "blank"
    );
    expect(() => parseFia('{"1":{"name":"","localizedName":"使徒"}}')).toThrow(
      "blank"
    );
  });
});

describe("definition", () => {
  it("returns the first paragraph of the Definition section as text", () => {
    const md = [
      "# grace, gracious",
      "",
      "## Definition:",
      "",
      "Grace is help or blessing given to someone",
      "who has not [earned](../kt/x.md) it.",
      "",
      "* A list item",
      "## Translation Suggestions:",
    ].join("\n");
    expect(definition(md)).toBe(
      "Grace is help or blessing given to someone who has not earned it."
    );
    expect(definition("# x\n\nNo sections.")).toBe("");
  });
});

describe("prompts/key-terms.md", () => {
  const file = read("prompts/key-terms.md");

  it("has a draft and a check prompt, filled for zh-Hans", () => {
    for (const part of ["draft", "check"] as const) {
      const p = promptPart(file, part, "zh-Hans");
      expect(p).toContain("Simplified Chinese (BCP-47 tag zh-Hans)");
      expect(p).not.toMatch(/\{\{|:start|:end/);
    }
    expect(() => promptPart(file, "draft", "fr")).toThrow("not a draft");
    expect(() => promptPart("none", "check", "zh-Hans")).toThrow("markers");
  });
});

const reference = [
  { en: "apostle", term: "使徒" },
  { en: "elder", term: "长老" },
];

describe("readDraft", () => {
  const articles = ["kt/apostle", "other/elder", "names/titus", "kt/god"];

  it("keeps usable drafts and reports missing and invalid ones", () => {
    const r = readDraft(
      {
        "kt/apostle": { headword: "使徒", reference: "apostle" },
        "other/elder": { headword: "长老", reference: "presbyter" },
        "names/titus": { headword: " 提多 ", note: " CUV spelling. " },
        extra: { headword: "x" },
      },
      articles,
      reference
    );
    expect(r.terms).toEqual({
      "kt/apostle": { headword: "使徒", reference: "apostle" },
      "names/titus": { headword: "提多", note: "CUV spelling." },
    });
    expect(r.invalid).toEqual(["other/elder"]);
    expect(r.missing).toEqual(["kt/god"]);
  });

  it("refuses a headword that is not text", () => {
    const r = readDraft(
      { "kt/apostle": "使徒", "other/elder": { headword: "" } },
      ["kt/apostle", "other/elder"],
      reference
    );
    expect(r.invalid).toEqual(["kt/apostle", "other/elder"]);
  });
});

describe("readCheck", () => {
  it("reads agree and disagree, and refuses a disagreement without reasons", () => {
    const r = readCheck(
      {
        a: { verdict: "agree" },
        b: { verdict: "disagree", why: "Not CUV.", suggestion: "革哩底" },
        c: { verdict: "disagree", why: "No suggestion." },
        d: { verdict: "maybe" },
      },
      ["a", "b", "c", "d", "e"],
      "ai:m2"
    );
    expect(r.checks).toEqual({
      a: { by: "ai:m2", verdict: "agree" },
      b: {
        by: "ai:m2",
        verdict: "disagree",
        why: "Not CUV.",
        suggestion: "革哩底",
      },
    });
    expect(r.invalid).toEqual(["c", "d"]);
    expect(r.missing).toEqual(["e"]);
  });
});

describe("gateProblems and statusOf", () => {
  it("flags non-Han headwords, Latin letters and line breaks", () => {
    const g = (headword: string) => gateProblems({ headword }, HAN, []);
    expect(g("使徒、使徒职分")).toEqual([]);
    expect(g("Titus")).toEqual(["script", "latin-letters"]);
    expect(g("革哩底 (Crete)")).toEqual(["script", "latin-letters"]);
    expect(g("提多T")).toEqual(["latin-letters"]);
    expect(g("使徒\n长老")).toEqual(["line-break"]);
  });

  it("flags a headword that does not use the rendering of the reference it names", () => {
    const fia = [
      { en: "apostle", term: "使徒" },
      { en: "Lord", term: "主、耶和华" },
    ];
    const g = (headword: string, reference: string) =>
      gateProblems({ headword, reference }, HAN, fia);
    expect(g("使徒、使徒职分", "apostle")).toEqual([]);
    expect(g("耶和华", "Lord")).toEqual([]);
    expect(g("差徒", "apostle")).toEqual(["reference"]);
    // Only 、 separates renderings.
    for (const headword of [
      "差徒/使徒",
      "差徒;使徒",
      "差徒，使徒",
      "差徒,使徒",
    ])
      expect(g(headword, "apostle"), headword).toEqual(["reference"]);
    // A name the list does not have is not a rendering mismatch: readDraft
    // and the build refuse it.
    expect(g("差徒", "presbyter")).toEqual([]);
    // A headword with no reference is not compared.
    expect(gateProblems({ headword: "差徒" }, HAN, fia)).toEqual([]);
  });

  it("is ai-checked only for an agreed draft that passed every gate", () => {
    const agree = { by: "ai:b", verdict: "agree" } as const;
    const disagree = {
      by: "ai:b",
      verdict: "disagree",
      why: "w",
      suggestion: "s",
    } as const;
    expect(statusOf({ check: agree })).toBe("ai-checked");
    expect(statusOf({ check: disagree })).toBe("unreviewed");
    expect(statusOf({ check: agree, gates: ["script"] })).toBe("unreviewed");
    expect(statusOf({})).toBe("unreviewed");
  });
});

const inputs: TermInput[] = [
  { article: "kt/apostle", en: "apostle", definition: "d", refs: ["1:1"] },
  { article: "names/titus", en: "Titus", definition: "d", refs: ["1:4"] },
  { article: "other/elder", en: "elder", definition: "d", refs: ["1:5"] },
];

/** A model that answers each call in turn with a JSON reply and a cost. */
function fakeModels(replies: { reply: unknown; cost: number | null }[]) {
  const sent: { model: string; system: string; user: string }[] = [];
  const complete: Complete = async (request) => {
    const next = replies[sent.length];
    sent.push({
      model: request.model,
      system: request.messages[0]?.content ?? "",
      user: request.messages[1]?.content ?? "",
    });
    if (!next) throw new Error("no more replies");
    const c: Completion = {
      id: `gen-${sent.length}`,
      model: request.model,
      text: JSON.stringify(next.reply),
      usage: {
        promptTokens: 100,
        completionTokens: 10,
        reasoningTokens: null,
        cost: next.cost,
      },
      ms: 5,
    };
    return c;
  };
  return { complete, sent };
}

const promptText = read("prompts/key-terms.md");
const run = (
  complete: Complete,
  ledgers: unknown[],
  over: Partial<Parameters<typeof draftKeyTerms>[0]> = {}
) =>
  draftKeyTerms({
    tag: "zh-Hans",
    book: "TIT",
    inputs,
    reference: { id: "fia-kt-zhs", terms: reference },
    prompt: { file: "prompts/key-terms.md", text: promptText },
    draftModel: "google/draft",
    checkModel: "anthropic/check",
    maxCost: 1,
    complete,
    write: async (l) => {
      ledgers.push(structuredClone(l));
    },
    ...over,
  });

describe("draftKeyTerms", () => {
  const draftReply = {
    "kt/apostle": { headword: "使徒", reference: "apostle" },
    "names/titus": { headword: "Titus" },
    "other/elder": { headword: "长者" },
  };

  it("drafts with one model, checks with the other, and sets status by the rules", async () => {
    const { complete, sent } = fakeModels([
      { reply: draftReply, cost: 0.01 },
      {
        reply: {
          "kt/apostle": { verdict: "agree" },
          "names/titus": { verdict: "agree" },
          "other/elder": {
            verdict: "disagree",
            why: "The church office is 长老.",
            suggestion: "长老",
          },
        },
        cost: 0.02,
      },
    ]);
    const ledgers: unknown[] = [];
    const { record, outcome } = await run(complete, ledgers);
    expect(outcome).toBe("done");
    expect(sent.map((s) => s.model)).toEqual([
      "google/draft",
      "anthropic/check",
    ]);
    expect(sent[0]?.system).toBe(promptPart(promptText, "draft", "zh-Hans"));
    expect(sent[0]?.user).toBe(draftMessage("TIT", inputs, reference));
    expect(sent[1]?.user).toBe(
      checkMessage("TIT", inputs, reference, {
        "kt/apostle": { headword: "使徒", reference: "apostle" },
        "names/titus": { headword: "Titus" },
        "other/elder": { headword: "长者" },
      })
    );
    expect(record?.terms).toEqual({
      "kt/apostle": {
        en: "apostle",
        headword: "使徒",
        source: "ai:google/draft",
        status: "ai-checked",
        reference: "apostle",
        check: { by: "ai:anthropic/check", verdict: "agree" },
      },
      "names/titus": {
        en: "Titus",
        headword: "Titus",
        source: "ai:google/draft",
        status: "unreviewed",
        gates: ["script", "latin-letters"],
        check: { by: "ai:anthropic/check", verdict: "agree" },
      },
      "other/elder": {
        en: "elder",
        headword: "长者",
        source: "ai:google/draft",
        status: "unreviewed",
        check: {
          by: "ai:anthropic/check",
          verdict: "disagree",
          why: "The church office is 长老.",
          suggestion: "长老",
        },
      },
    });
    expect(record?.calls.map((c) => [c.role, c.id, c.cost])).toEqual([
      ["draft", "gen-1", 0.01],
      ["check", "gen-2", 0.02],
    ]);
    expect(record?.prompt.sha256).toBe(sha256(promptText));
    const last = ledgers.at(-1) as { outcome: unknown; totals: unknown };
    expect(last.outcome).toBe("done");
    expect(last.totals).toEqual({
      promptTokens: 200,
      completionTokens: 20,
      cost: 0.03,
    });
  });

  it("does not run the check when the draft's cost is unknown or the limit is spent", async () => {
    for (const [cost, maxCost] of [
      [null, 1],
      [Number.NaN, 1],
      [-0.01, 1],
      [0.5, 0.5],
    ] as const) {
      const { complete, sent } = fakeModels([{ reply: draftReply, cost }]);
      const ledgers: unknown[] = [];
      const r = await run(complete, ledgers, { maxCost });
      expect(r.record).toBeNull();
      expect(r.outcome).toHaveProperty("stopped");
      expect(sent).toHaveLength(1);
      expect((ledgers.at(-1) as { calls: unknown[] }).calls).toHaveLength(1);
    }
  });

  it("reports terms the models left out", async () => {
    const { complete } = fakeModels([
      { reply: { "kt/apostle": { headword: "使徒" } }, cost: 0.01 },
      { reply: {}, cost: 0.01 },
    ]);
    const r = await run(complete, []);
    expect(r.outcome).toEqual({
      incomplete: {
        draft: ["names/titus", "other/elder"],
        check: ["kt/apostle"],
      },
    });
    expect(r.record?.terms["kt/apostle"]?.status).toBe("unreviewed");
  });

  it("refuses one model, or two of one family, for both roles, before any call", async () => {
    const { complete, sent } = fakeModels([]);
    for (const [draftModel, checkModel] of [
      ["google/draft", "google/draft"],
      ["google/a", "google/b"],
    ])
      await expect(
        run(complete, [], { draftModel, checkModel })
      ).rejects.toThrow("different family");
    expect(sent).toHaveLength(0);
  });

  it("refuses a book that is not a book code, before any call", async () => {
    const { complete, sent } = fakeModels([]);
    await expect(run(complete, [], { book: "../x" })).rejects.toThrow(
      "not a book"
    );
    expect(sent).toHaveLength(0);
  });
});

describe("buildDraftGlossary", () => {
  const HEAD = "Reference\tID\tTags\tOrigWords\tOccurrence\tTWLink";
  const rows: TwlRow[] = parseTwl(
    [
      HEAD,
      "1:1\tx\t\tw\t1\trc://*/tw/dict/bible/kt/apostle",
      "1:5\tx\t\tw\t1\trc://*/tw/dict/bible/other/elder",
      "1:4\tx\t\tw\t1\trc://*/tw/dict/bible/names/titus",
    ].join("\n")
  );
  const english = (a: string) =>
    ({
      "kt/apostle": "apostle",
      "names/titus": "Titus",
      "other/elder": "elder",
    })[a] ?? "";
  const credit = (id: string): Credit => ({
    licence: "CC-BY-SA-4.0",
    attribution: id.startsWith("tw-") ? "tW en" : id,
  });
  const agree = { by: "ai:anthropic/check", verdict: "agree" as const };
  const record = (): DraftRecord => ({
    language: "zh-Hans",
    book: "TIT",
    links: "twl-en-tit",
    reference: "fia-kt-zhs",
    prompt: { file: "prompts/key-terms.md", sha256: sha256(promptText) },
    calls: [
      {
        role: "draft",
        id: "1",
        model: "google/draft",
        promptTokens: 1,
        completionTokens: 1,
        reasoningTokens: null,
        cost: 0,
        ms: 1,
      },
      {
        role: "check",
        id: "2",
        model: "anthropic/check",
        promptTokens: 1,
        completionTokens: 1,
        reasoningTokens: null,
        cost: 0,
        ms: 1,
      },
    ],
    terms: {
      "kt/apostle": {
        en: "apostle",
        headword: "使徒",
        source: "ai:google/draft",
        status: "ai-checked",
        check: agree,
      },
      "names/titus": {
        en: "Titus",
        headword: "提多",
        source: "ai:google/draft",
        status: "ai-checked",
        check: agree,
      },
      "other/elder": {
        en: "elder",
        headword: "长者",
        source: "ai:google/draft",
        status: "unreviewed",
        check: { ...agree, verdict: "disagree", why: "w", suggestion: "长老" },
      },
    },
  });
  const fia = [
    { en: "apostle", term: "使徒" },
    { en: "elder", term: "长老" },
  ];
  const build = (r: DraftRecord, c = credit) =>
    buildDraftGlossary({
      record: r,
      file: "data/glossary-drafts/zh-Hans/TIT.json",
      rows,
      english,
      credit: c,
      prompt: promptText,
      reference: fia,
    });

  it("keeps a headword that does not use its reference's rendering when the gate records it", () => {
    const r = record();
    Object.assign(r.terms["kt/apostle"]!, {
      reference: "elder",
      gates: ["reference"],
      status: "unreviewed",
    });
    expect(build(r).review).toEqual(["kt/apostle", "other/elder"]);
  });

  it("adds the TWL verses, credits and the review list", () => {
    const g = build(record());
    expect(g.models).toEqual({
      draft: "ai:google/draft",
      check: "ai:anthropic/check",
    });
    expect(g.terms["other/elder"]?.refs).toEqual(["1:5"]);
    expect(Object.keys(g.terms)).toEqual([
      "kt/apostle",
      "names/titus",
      "other/elder",
    ]);
    expect(g.review).toEqual(["other/elder"]);
    expect(g.attribution).toEqual(["twl-en-tit", "tW en", "fia-kt-zhs"]);
    expect(g.gaps).toEqual({});
  });

  it("refuses a record that no longer matches its inputs or breaks the rules", () => {
    const cases: [string, (r: DraftRecord) => void][] = [
      ["does not match the TWL", (r) => delete r.terms["names/titus"]],
      [
        "English tW now says",
        (r) => {
          r.terms["kt/apostle"]!.en = "apostles";
        },
      ],
      [
        "breaks the rules",
        (r) => {
          r.terms["other/elder"]!.status = "ai-checked";
        },
      ],
      [
        "gates do not match",
        (r) => {
          r.terms["names/titus"]!.headword = "Titus";
        },
      ],
      [
        "same model",
        (r) => {
          r.calls[1]!.model = "google/draft";
        },
      ],
      ["one draft and one check", (r) => r.calls.pop()],
      [
        "a prompt other than the committed",
        (r) => {
          r.prompt.sha256 = sha256("an older prompt");
        },
      ],
      [
        "different family",
        (r) => {
          r.calls[1]!.model = "google/check";
          for (const t of Object.values(r.terms))
            if (t.check) t.check = { ...t.check, by: "ai:google/check" };
        },
      ],
      [
        'reference "presbyter" is not in fia-kt-zhs',
        (r) => {
          r.terms["other/elder"]!.reference = "presbyter";
        },
      ],
      [
        // Names a reference it does not use, with no gate recorded.
        "gates do not match",
        (r) => {
          r.terms["kt/apostle"]!.reference = "elder";
        },
      ],
      [
        "checked by",
        (r) => {
          r.terms["kt/apostle"]!.check = { by: "ai:other", verdict: "agree" };
        },
      ],
    ];
    for (const [message, change] of cases) {
      const r = record();
      change(r);
      expect(() => build(r), message).toThrow(message);
    }
    expect(() =>
      build(record(), (id) => ({
        licence: id === "fia-kt-zhs" ? "CC-BY-4.0" : "CC-BY-SA-4.0",
        attribution: id,
      }))
    ).toThrow("licences");
  });
});

// Every committed record, whatever its language or book: the build
// (buildDraftGlossary) enforces the invariants; these tests re-derive them
// from the committed files.
const records = readdirSync(new URL("data/glossary-drafts/", root), {
  withFileTypes: true,
})
  .filter((e) => e.isDirectory())
  .flatMap((e) =>
    readdirSync(new URL(`data/glossary-drafts/${e.name}/`, root)).map(
      (f) => `${e.name}/${f}`
    )
  );

it("has only JSON records for draft languages in data/glossary-drafts/", () => {
  for (const name of records) {
    expect(name, name).toMatch(/\.json$/);
    expect(DRAFT_LANGUAGES[name.split("/")[0]!], name).toBeDefined();
  }
});

it("has at least one committed key-term record", () => {
  expect(records).toContain("zh-Hans/TIT.json");
});

describe.each(records)("data/glossary-drafts/%s", (name) => {
  const path = `data/glossary-drafts/${name}`;
  const record = JSON.parse(read(path)) as DraftRecord;
  const built = JSON.parse(read(`data/glossaries/${name}`)) as DraftGlossary;
  const pins = new Map(sources().map((s) => [s.id, s]));

  it("was made with the committed prompt, by two model families", () => {
    expect(record.prompt).toEqual({
      file: "prompts/key-terms.md",
      sha256: sha256(read("prompts/key-terms.md")),
    });
    const [draft, check] = record.calls;
    expect([draft?.role, check?.role]).toEqual(["draft", "check"]);
    const family = (m = "") => m.split("/")[0];
    expect(family(draft?.model)).not.toBe(family(check?.model));
    for (const c of record.calls) {
      expect(c.id).toMatch(/^gen-/);
      expect(c.cost).toBeGreaterThan(0);
    }
  });

  it("covers every article the TWL links, with gates and status by the rules", async () => {
    const links = linkedArticles(
      parseTwl(await readSource(twlId(record.book)))
    );
    expect(Object.keys(record.terms).sort()).toEqual([...links.keys()].sort());
    const lang = DRAFT_LANGUAGES[record.language];
    if (!lang) throw new Error(`${path}: not a draft language`);
    const script = lang.script;
    const fia = parseFia(await readSource(record.reference));
    for (const [a, t] of Object.entries(record.terms)) {
      expect(t.headword, a).toBe(t.headword.normalize("NFC"));
      expect(t.gates ?? [], a).toEqual(gateProblems(t, script, fia));
      expect(t.status, a).toBe(statusOf(t));
      expect(t.source).toBe(`ai:${record.calls[0]?.model}`);
      if (t.check) expect(t.check.by).toBe(`ai:${record.calls[1]?.model}`);
    }
  });

  it("names only reference terms the pinned FIA list has", async () => {
    const pin = pins.get(record.reference);
    expect(pin?.licence).toBe("CC-BY-SA-4.0");
    const names = new Set(
      parseFia(await readSource(record.reference)).map((r) => r.en)
    );
    for (const t of Object.values(record.terms))
      if (t.reference) expect(names.has(t.reference), t.reference).toBe(true);
  });

  it("is built into data/glossaries/ with nothing above ai-checked", () => {
    expect(built.drafts).toBe(path);
    expect(built.models).toEqual({
      draft: `ai:${record.calls[0]?.model}`,
      check: `ai:${record.calls[1]?.model}`,
    });
    expect(Object.keys(built.terms)).toEqual(Object.keys(built.terms).sort());
    for (const [a, t] of Object.entries(built.terms)) {
      expect(["unreviewed", "ai-checked"]).toContain(t.status);
      expect(t.en).toBe(record.terms[a]?.en);
      expect(t.headword).toBe(record.terms[a]?.headword);
    }
    expect(built.review).toEqual(
      Object.entries(built.terms)
        .filter(([, t]) => t.status === "unreviewed")
        .map(([a]) => a)
    );
    for (const id of [twlId(record.book), record.reference])
      expect(built.attribution).toContain(pins.get(id)?.attribution);
  });

  it("is built with the record's terms and the TWL's verses", async () => {
    const links = linkedArticles(
      parseTwl(await readSource(twlId(record.book)))
    );
    expect(Object.keys(built.terms).sort()).toEqual(
      Object.keys(record.terms).sort()
    );
    for (const [a, refs] of links)
      expect(built.terms[a]?.refs, a).toEqual(refs);
  });
});

describe("key-terms command line", () => {
  const script = fileURLToPath(new URL("scripts/translate/key-terms.ts", root));
  const run = (args: string[], env: Record<string, string>) =>
    spawnSync(process.execPath, [script, ...args], {
      env: { PATH: process.env.PATH ?? "", ...env },
      encoding: "utf8",
    });
  const base = [
    "--book",
    "TIT",
    "--lang",
    "zh-Hans",
    "--draft-model",
    "google/a",
    "--check-model",
    "anthropic/b",
  ];

  it("fails before any call without a key, for one family twice, an unknown book, or into data/", () => {
    const cases: [string[], Record<string, string>, string][] = [
      [base, {}, "OPENROUTER_API_KEY is not set"],
      [base, { OPENROUTER_API_KEY: "   " }, "OPENROUTER_API_KEY is not set"],
      [
        [...base.slice(0, 6), "--check-model", "google/a"],
        { OPENROUTER_API_KEY: KEY },
        "different family",
      ],
      [
        [...base.slice(0, 6), "--check-model", "google/b"],
        { OPENROUTER_API_KEY: KEY },
        "different family",
      ],
      [
        ["--book", "../../package", ...base.slice(2)],
        { OPENROUTER_API_KEY: KEY },
        "not a book code: ../../package",
      ],
      [
        [...base, "--out", "data/glossary-drafts"],
        { OPENROUTER_API_KEY: KEY },
        "must not be inside data/",
      ],
      [
        [...base.slice(0, 2), "--lang", "fr", ...base.slice(4)],
        { OPENROUTER_API_KEY: KEY },
        "not a draft language",
      ],
    ];
    for (const [args, env, message] of cases) {
      const r = run(args, env);
      expect(r.status, message).toBe(1);
      expect(r.stderr, message).toContain(message);
      expect(r.stderr + r.stdout).not.toContain(KEY);
    }
  });
});
