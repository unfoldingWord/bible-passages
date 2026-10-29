import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Completion } from "../scripts/lib/openrouter.ts";
import {
  checkMessage,
  draftMessage,
  draftSegmentTitles,
  gateProblems,
  promptPart,
  readCheck,
  readDraft,
  segmentInputs,
  verseTexts,
  type Complete,
  type SegmentInput,
} from "../scripts/lib/segment-titles.ts";
import type { Structure } from "../scripts/lib/structure.ts";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("verseTexts", () => {
  it("keeps the words and drops alignment, footnotes, headings and paragraph markers", () => {
    const usfm = [
      "\\id XYZ test",
      "\\h Xyz",
      "\\c 1",
      "\\s1 A Heading",
      "\\r (Somewhere 1:1)",
      "\\m",
      '\\v 1 \\zaln-s |x-strong="G1"\\*\\w Paul|x-occurrence="1"\\w*\\zaln-e\\*,',
      '\\w a|x-occurrence="1"\\w* \\w servant|x-occurrence="1"\\w* \\f + \\fr 1:1 \\ft Or slave\\f*.',
      "\\q1 \\v 2 \\w Grace|x=1\\w* \\w to|x=1\\w*",
      "\\q2 \\w you|x=1\\w*!",
      "\\c 2",
      "\\v 1 \\w Again|x=1\\w*.",
    ].join("\n");
    expect([...verseTexts(usfm)]).toEqual([
      ["1:1", "Paul, a servant."],
      ["1:2", "Grace to you!"],
      ["2:1", "Again."],
    ]);
  });

  it("fails on markup it cannot read rather than sending it to a model", () => {
    expect(() => verseTexts("\\c 1\n\\v 1 \\add word\\add*")).toThrow(
      "cannot read verse 1:1"
    );
  });

  it("reads all 104 verses of Philippians from the pinned BSB text", async () => {
    const { readSource } = await import("../scripts/lib/sources.ts");
    const v = verseTexts(await readSource("bsb-php"));
    expect(v.size).toBe(104);
    expect(v.get("4:13")).toBe(
      "I can do all things through Christ who gives me strength."
    );
  });
});

const structure: Structure = {
  book: "XYZ",
  versification: "ufw",
  pericopes: [
    { key: "XYZ.P.1.1-1", start: [1, 1], end: [1, 1] },
    { key: "XYZ.P.1.2-4", start: [1, 2], end: [1, 4] },
  ],
  segments: [
    { key: "XYZ.1.1-1", pericope: "XYZ.P.1.1-1", start: [1, 1], end: [1, 1] },
    { key: "XYZ.1.2-3", pericope: "XYZ.P.1.2-4", start: [1, 2], end: [1, 3] },
    { key: "XYZ.1.4-4", pericope: "XYZ.P.1.2-4", start: [1, 4], end: [1, 4] },
  ],
} as Structure;
const headings = [
  { chapter: 1, verse: 1, text: "Greeting" },
  { chapter: 1, verse: 2, text: "Thanks" },
];
const verses = new Map([
  ["1:1", "One."],
  ["1:2", "Two."],
  ["1:3", "Three."],
  ["1:4", "Four."],
]);

describe("segmentInputs", () => {
  it("leaves out a pericope's only segment (decision 12) and joins each segment's verses", () => {
    expect(segmentInputs(structure, headings, verses)).toEqual({
      inputs: [
        {
          key: "XYZ.1.2-3",
          verses: "1:2–3",
          pericope: "Thanks",
          text: "Two. Three.",
        },
        { key: "XYZ.1.4-4", verses: "1:4", pericope: "Thanks", text: "Four." },
      ],
      reused: ["XYZ.1.1-1"],
    });
  });

  it("fails on a verse with no text", () => {
    const short = new Map(verses);
    short.delete("1:3");
    expect(() => segmentInputs(structure, headings, short)).toThrow(
      "XYZ.1.2-3: no text for 1:3"
    );
  });
});

describe("prompts/segment-titles.md", () => {
  const file = read("prompts/segment-titles.md");
  it("has a draft and a check prompt", () => {
    for (const part of ["draft", "check"] as const) {
      const p = promptPart(file, part);
      expect(p.length).toBeGreaterThan(200);
      expect(p).not.toContain("<!--");
    }
    expect(() => promptPart("none", "check")).toThrow("markers");
  });
});

describe("readDraft and readCheck", () => {
  it("reads titles and reports missing and unusable ones", () => {
    expect(readDraft({ a: " Paul prays ", b: 3 }, ["a", "b", "c"])).toEqual({
      titles: { a: "Paul prays" },
      missing: ["c"],
      invalid: ["b"],
    });
  });

  it("reads verdicts; a disagreement needs known criteria, a reason and a suggestion", () => {
    const reply = {
      a: { verdict: "agree" },
      b: {
        verdict: "disagree",
        criteria: ["style", "plain"],
        why: "Too long.",
        suggestion: "Paul prays",
      },
      c: { verdict: "disagree", criteria: ["tone"], why: "x", suggestion: "y" },
      d: { verdict: "disagree", criteria: [], why: "x", suggestion: "y" },
      e: { verdict: "disagree", criteria: ["plain"], why: "x" },
    };
    expect(readCheck(reply, ["a", "b", "c", "d", "e", "f"], "ai:g")).toEqual({
      checks: {
        a: { by: "ai:g", verdict: "agree" },
        b: {
          by: "ai:g",
          verdict: "disagree",
          criteria: ["plain", "style"],
          why: "Too long.",
          suggestion: "Paul prays",
        },
      },
      missing: ["f"],
      invalid: ["c", "d", "e"],
    });
  });
});

describe("gateProblems", () => {
  it("passes a plain title of up to 60 characters", () => {
    expect(gateProblems("Paul thanks God for the Philippians’ gifts")).toEqual(
      []
    );
    expect(gateProblems("x".repeat(60))).toEqual([]);
  });

  it("names each broken rule", () => {
    expect(gateProblems("x".repeat(61))).toEqual(["length"]);
    expect(gateProblems("Paul prays.")).toEqual(["full-stop"]);
    expect(gateProblems("Paul says “rejoice”")).toEqual(["quotes"]);
    expect(gateProblems("Paul's prayer")).toEqual(["straight-apostrophe"]);
    expect(gateProblems("Paul\nprays")).toEqual(["line-break"]);
    expect(gateProblems("Paul *prays*")).toEqual(["markup"]);
  });
});

/** A model that answers each call in turn with a JSON reply and a cost. */
function fakeModels(
  replies: { reply: unknown; cost: number | null; answeredBy?: string }[]
) {
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
      model: next.answeredBy ?? request.model,
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

const inputs: SegmentInput[] = segmentInputs(
  structure,
  headings,
  verses
).inputs;
const promptText = read("prompts/segment-titles.md");
const run = (
  complete: Complete,
  ledgers: unknown[],
  over: Partial<Parameters<typeof draftSegmentTitles>[0]> = {}
) =>
  draftSegmentTitles({
    book: "XYZ",
    bible: "bsb-xyz",
    inputs,
    prompt: { file: "prompts/segment-titles.md", text: promptText },
    draftModel: "a/draft",
    checkModel: "g/check",
    maxCost: 1,
    complete,
    write: async (l) => {
      ledgers.push(structuredClone(l));
    },
    ...over,
  });

describe("draftSegmentTitles", () => {
  const draftReply = {
    "XYZ.1.2-3": "Paul gives thanks for the believers",
    "XYZ.1.4-4":
      "Paul tells the believers that he will come to see them again soon",
  };

  it("drafts with one model, checks with the other, and sets status by the rules", async () => {
    const { complete, sent } = fakeModels([
      { reply: draftReply, cost: 0.01 },
      {
        reply: {
          "XYZ.1.2-3": { verdict: "agree" },
          "XYZ.1.4-4": {
            verdict: "disagree",
            criteria: ["style"],
            why: "Over 60 characters.",
            suggestion: "Paul will come to see the believers soon",
          },
        },
        cost: 0.02,
      },
    ]);
    const ledgers: unknown[] = [];
    const { record, outcome } = await run(complete, ledgers);
    expect(outcome).toBe("done");
    expect(sent.map((s) => s.model)).toEqual(["a/draft", "g/check"]);
    expect(sent[0]?.system).toBe(promptPart(promptText, "draft"));
    expect(sent[1]?.system).toBe(promptPart(promptText, "check"));
    expect(sent[0]?.user).toBe(draftMessage("XYZ", inputs));
    expect(sent[1]?.user).toBe(checkMessage("XYZ", inputs, draftReply));
    expect(record?.titles).toEqual({
      "XYZ.1.2-3": {
        text: "Paul gives thanks for the believers",
        source: "ai:a/draft",
        status: "ai-checked",
        check: { by: "ai:g/check", verdict: "agree" },
      },
      "XYZ.1.4-4": {
        text: draftReply["XYZ.1.4-4"],
        source: "ai:a/draft",
        status: "unreviewed",
        gates: ["length"],
        check: {
          by: "ai:g/check",
          verdict: "disagree",
          criteria: ["style"],
          why: "Over 60 characters.",
          suggestion: "Paul will come to see the believers soon",
        },
      },
    });
    expect(record?.calls.map((c) => [c.role, c.id, c.cost])).toEqual([
      ["draft", "gen-1", 0.01],
      ["check", "gen-2", 0.02],
    ]);
    expect(record?.prompt.file).toBe("prompts/segment-titles.md");
    expect(ledgers.at(-1)).toMatchObject({
      outcome: "done",
      totals: { promptTokens: 200, completionTokens: 20, cost: 0.03, ms: 10 },
    });
  });

  it("keeps a gated title unreviewed even when the checker agreed", async () => {
    const { complete } = fakeModels([
      { reply: { ...draftReply, "XYZ.1.2-3": "Paul gives thanks." }, cost: 0 },
      {
        reply: {
          "XYZ.1.2-3": { verdict: "agree" },
          "XYZ.1.4-4": { verdict: "agree" },
        },
        cost: 0,
      },
    ]);
    const { record } = await run(complete, []);
    expect(record?.titles["XYZ.1.2-3"]).toMatchObject({
      status: "unreviewed",
      gates: ["full-stop"],
    });
  });

  it("does not run the check once the spend cap is reached, or when cost is unknown", async () => {
    for (const cost of [1, null]) {
      const { complete, sent } = fakeModels([{ reply: draftReply, cost }]);
      const ledgers: unknown[] = [];
      const { record, outcome } = await run(complete, ledgers);
      expect(record).toBeNull();
      expect(outcome).toHaveProperty("stopped");
      expect(sent).toHaveLength(1);
      expect(ledgers.at(-1)).toMatchObject({
        calls: [{ role: "draft" }],
        // The paid-for draft stays on record for a resumed run.
        draftTitles: draftReply,
      });
    }
  });

  it("refuses a check answered by the model that drafted, whatever ids were requested", async () => {
    const { complete, sent } = fakeModels([
      { reply: draftReply, cost: 0.01, answeredBy: "x/same" },
      {
        reply: {
          "XYZ.1.2-3": { verdict: "agree" },
          "XYZ.1.4-4": { verdict: "agree" },
        },
        cost: 0.01,
        answeredBy: "x/same",
      },
    ]);
    const ledgers: unknown[] = [];
    const { record, outcome } = await run(complete, ledgers);
    expect(sent.map((s) => s.model)).toEqual(["a/draft", "g/check"]);
    expect(record).toBeNull();
    expect(outcome).toEqual({
      stopped: "check answered by the drafting model x/same",
    });
    expect(ledgers.at(-1)).toMatchObject({ draftTitles: draftReply });
  });

  it("reports titles the models left out", async () => {
    const { complete } = fakeModels([
      { reply: { "XYZ.1.2-3": draftReply["XYZ.1.2-3"] }, cost: 0 },
      { reply: {}, cost: 0 },
    ]);
    const { outcome } = await run(complete, []);
    expect(outcome).toEqual({
      incomplete: { draft: ["XYZ.1.4-4"], check: ["XYZ.1.2-3"] },
    });
  });

  it("refuses the same model for drafting and checking", async () => {
    const { complete } = fakeModels([]);
    await expect(run(complete, [], { checkModel: "a/draft" })).rejects.toThrow(
      "must differ"
    );
  });
});
