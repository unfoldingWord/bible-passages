import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Completion } from "../scripts/lib/openrouter.ts";
import {
  batches,
  CHECK_BATCH,
  CHECK_MAX_TOKENS,
  DRAFT_BATCH,
  checkMessage,
  draftMessage,
  draftSegmentTitles,
  gateProblems,
  promptPart,
  readCheck,
  readDraft,
  BLANK_SEGMENTS,
  BLANK_TITLE,
  blankProblems,
  blankSegments,
  segmentInputs,
  verseTexts,
  type Complete,
  type SegmentInput,
} from "../scripts/lib/segment-titles.ts";
import type { Structure } from "../scripts/lib/structure.ts";
import { REFUSED } from "./fixtures/invisibles.ts";

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

  // BSB opens some paragraphs inside a verse's run with \pmo (Genesis 1:2,
  // before 1:3 under "The First Day"); it carries no words (#208).
  it("drops \\pmo, the embedded opening paragraph marker", () => {
    const usfm =
      "\\c 1\n\\v 1 \\w Waters|x=1\\w*.\n\\s2 Day\n\\b\n\\pmo\n\\v 2 \\w Light|x=1\\w*.";
    expect([...verseTexts(usfm)]).toEqual([
      ["1:1", "Waters."],
      ["1:2", "Light."],
    ]);
  });

  // #226: what kept 24 of the 66 pinned BSB books from being read, and the
  // Psalms whose verse 1 has no marker.
  it("keeps the words of \\qr and \\it, and drops \\qa acrostic letters", () => {
    const usfm = [
      "\\c 1",
      "\\q1 \\v 1 \\w Many|x=1\\w* \\w say|x=1\\w*.",
      "\\qr Selah",
      "\\b",
      "\\qa BETH",
      "\\q1 \\v 2 \\w Heights|x=1\\w*!",
      "\\pc",
      "\\it For the choirmaster.",
      "\\it* ",
    ].join("\n");
    expect([...verseTexts(usfm)]).toEqual([
      ["1:1", "Many say. Selah"],
      ["1:2", "Heights! For the choirmaster."],
    ]);
  });

  it("drops a footnote whose text comes after its closing marker (Joshua 12:23)", () => {
    const usfm =
      "\\c 12\n\\v 23 \\w Gilgal|x=1\\w*,\\f + \\f*\\fr 12:23 \\ft Hebrew\\f*\n\\w one|x=1\\w*;";
    expect([...verseTexts(usfm)]).toEqual([["12:23", "Gilgal, one;"]]);
  });

  it("keeps a verse the text numbers but leaves blank as an empty string", () => {
    const usfm =
      "\\c 17\n\\v 20 \\w Faith|x=1\\w*.\\f + \\fr 17:20 \\ft BYZ and TR include 21\\f*\n\\s1 Heading\n\\m\n\\v 21 \n\\v 22 \\w Next|x=1\\w*.";
    expect([...verseTexts(usfm)]).toEqual([
      ["17:20", "Faith."],
      ["17:21", ""],
      ["17:22", "Next."],
    ]);
  });

  it("reads the words before a chapter's \\v 2 as verse 1, and nothing else", () => {
    const usfm =
      "\\c 1\n\\s1 Two Paths\n\\q1 \\w Blessed|x=1\\w*\n\\q1\n\\v 2 \\w Delight|x=1\\w*.";
    expect([...verseTexts(usfm)]).toEqual([
      ["1:1", "Blessed"],
      ["1:2", "Delight."],
    ]);
    expect(() =>
      verseTexts("\\c 1\n\\q1 Words\n\\v 3 \\w More|x=1\\w*.")
    ).toThrow("cannot read chapter 1: words before its first verse");
  });

  it("reads all 1,533 verses of Genesis from the pinned BSB text", async () => {
    const { readSource } = await import("../scripts/lib/sources.ts");
    const v = verseTexts(await readSource("bsb-gen"));
    expect(v.size).toBe(1533);
    expect(v.get("1:2")).toBe(
      "Now the earth was formless and void, and darkness was over the surface of the deep. And the Spirit of God was hovering over the surface of the waters."
    );
  });

  // Every verse of every pinned BSB book, checked against the ufw
  // versification the spans use: no verse missing, none extra, and the only
  // blank ones are the 18 BSB leaves without words (#226).
  it("reads every verse of all 66 pinned BSB books", async () => {
    const { readSource, sources } = await import("../scripts/lib/sources.ts");
    const vrs = JSON.parse(read("data/versification/ufw.json")) as Record<
      string,
      number[]
    >;
    const books = sources()
      .filter((s) => s.id.startsWith("bsb-"))
      .map((s) => s.id.slice(4).toUpperCase());
    expect(books).toHaveLength(66);
    const missing: string[] = [];
    const extra: string[] = [];
    const blank: string[] = [];
    let total = 0;
    for (const book of books) {
      const v = verseTexts(await readSource(`bsb-${book.toLowerCase()}`));
      const want = new Set(
        vrs[book]!.flatMap((n, i) =>
          Array.from({ length: n }, (_, k) => `${i + 1}:${k + 1}`)
        )
      );
      total += v.size;
      for (const k of want) if (!v.has(k)) missing.push(`${book} ${k}`);
      for (const [k, t] of v) {
        if (!want.has(k)) extra.push(`${book} ${k}`);
        if (t === "") blank.push(`${book} ${k}`);
      }
    }
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    expect(total).toBe(31104);
    expect(blank).toEqual([
      "MAT 17:21",
      "MAT 18:11",
      "MAT 23:14",
      "MRK 7:16",
      "MRK 9:44",
      "MRK 9:46",
      "MRK 11:26",
      "MRK 15:28",
      "LUK 17:36",
      "LUK 23:17",
      "JHN 5:4",
      "ACT 8:37",
      "ACT 15:34",
      "ACT 24:7",
      "ACT 28:29",
      "ROM 16:24",
      "3JN 1:15",
      "REV 12:18",
    ]);
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
      blank: [],
    });
  });

  it("leaves a blank verse out of the text, and skips a segment whose every verse is blank", () => {
    const blank = new Map(verses).set("1:3", "");
    expect(segmentInputs(structure, headings, blank).inputs[0]).toEqual({
      key: "XYZ.1.2-3",
      verses: "1:2–3",
      pericope: "Thanks",
      text: "Two.",
    });
    blank.set("1:4", "");
    expect(segmentInputs(structure, headings, blank)).toEqual({
      inputs: [
        {
          key: "XYZ.1.2-3",
          verses: "1:2–3",
          pericope: "Thanks",
          text: "Two.",
        },
      ],
      reused: ["XYZ.1.1-1"],
      blank: ["XYZ.1.4-4"],
    });
    expect(blankSegments(structure, blank)).toEqual(["XYZ.1.4-4"]);
  });

  it("counts a blank segment that is its pericope's only one as blank, not reused", () => {
    const blank = new Map(verses).set("1:1", "");
    expect(segmentInputs(structure, headings, blank)).toMatchObject({
      reused: [],
      blank: ["XYZ.1.1-1"],
    });
    expect(blankSegments(structure, blank)).toEqual(["XYZ.1.1-1"]);
  });

  it("fails on a verse with no text", () => {
    const short = new Map(verses);
    short.delete("1:3");
    expect(() => segmentInputs(structure, headings, short)).toThrow(
      "XYZ.1.2-3: no text for 1:3"
    );
    expect(() => blankSegments(structure, short)).toThrow(
      "XYZ.1.2-3: no text for 1:3"
    );
    // A segment with no verse in the text at all is not blank: it fails.
    const none = new Map(verses).set("1:3", "");
    none.delete("1:4");
    expect(() => segmentInputs(structure, headings, none)).toThrow(
      "XYZ.1.4-4: no text for 1:4"
    );
  });
});

// The maintainer's decision on #226 (4 Nov): the segments BSB leaves blank
// take one fixed, human-written English title, and are not drafted.
describe("segments BSB leaves blank (#226)", () => {
  const books = ["MAT", "MRK", "ROM"] as const;
  const label = {
    text: "Not in the oldest manuscripts",
    status: "approved",
    source: "reviewer:maintainer",
  };

  it("are exactly MAT.17.21-21, MRK.11.26-26 and ROM.16.24-24 in all 66 pinned books", async () => {
    const { readSource } = await import("../scripts/lib/sources.ts");
    const { STRUCTURE_BOOKS } = await import("../scripts/lib/books.ts");
    expect(STRUCTURE_BOOKS).toHaveLength(66);
    const found: string[] = [];
    for (const book of STRUCTURE_BOOKS) {
      const s = JSON.parse(read(`data/structure/${book}.json`)) as Structure;
      const v = verseTexts(await readSource(`bsb-${book.toLowerCase()}`));
      found.push(...blankSegments(s, v));
    }
    expect(found).toEqual(["MAT.17.21-21", "MRK.11.26-26", "ROM.16.24-24"]);
    expect(BLANK_SEGMENTS).toEqual(found);
    expect(BLANK_TITLE).toEqual(label);
  });

  it.each(books)(
    "%s: the drafting input skips the blank segment and builds the rest",
    async (book) => {
      const { readSource } = await import("../scripts/lib/sources.ts");
      const { parseHeadings } = await import("../scripts/lib/structure.ts");
      const s = JSON.parse(read(`data/structure/${book}.json`)) as Structure;
      const usfm = await readSource(`bsb-${book.toLowerCase()}`);
      const { inputs, reused, blank } = segmentInputs(
        s,
        parseHeadings(usfm),
        verseTexts(usfm)
      );
      const key = BLANK_SEGMENTS.find((k) => k.startsWith(`${book}.`))!;
      expect(blank).toEqual([key]);
      expect(inputs.map((i) => i.key)).not.toContain(key);
      expect(inputs.length + reused.length + blank.length).toBe(
        s.segments.length
      );
      for (const i of inputs) expect(i.text.trim()).not.toBe("");
    }
  );

  it.each(books)(
    "%s: the built English title and the tc-mobile table carry the label",
    (book) => {
      const key = BLANK_SEGMENTS.find((k) => k.startsWith(`${book}.`))!;
      const titles = JSON.parse(read(`data/titles/en/${book}.json`)) as {
        titles: Record<string, unknown>;
      };
      expect(titles.titles[key]).toEqual(label);
      const table = JSON.parse(
        read(`dist/tc-mobile/titles/en/${book}.json`)
      ) as { segments: Record<string, string> };
      expect(table.segments[key]).toBe(label.text);
    }
  );

  // The build throws on any of these (scripts/data/build.ts).
  it("stops on a blank segment not decided, a decided one not blank, or a draft for one", () => {
    expect(blankProblems("MAT", ["MAT.17.21-21"], ["MAT.1.1-1"])).toEqual([]);
    expect(blankProblems("GEN", [], [])).toEqual([]);
    expect(blankProblems("MAT", ["MAT.17.21-21", "MAT.18.11-11"], [])).toEqual([
      "segments blank in BSB are [MAT.17.21-21, MAT.18.11-11], not the decided [MAT.17.21-21] (BLANK_SEGMENTS)",
    ]);
    expect(blankProblems("MRK", [], [])).toEqual([
      "segments blank in BSB are [], not the decided [MRK.11.26-26] (BLANK_SEGMENTS)",
    ]);
    expect(blankProblems("ROM", ["ROM.16.24-24"], ["ROM.16.24-24"])).toEqual([
      "draft for ROM.16.24-24, which has a fixed title",
    ]);
  });

  it("passes the gates every English title passes", () => {
    expect(gateProblems(BLANK_TITLE.text)).toEqual([]);
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

  // Rule 5's pronoun sentence and the closing pronoun pass (#216, #220): the
  // drafting model is sent only the draft part, so an accidental revert of
  // either must fail here. "your" is named because the pronoun count in
  // docs/scoping/sizing.md counts it.
  it("tells the drafting model that no pronoun is clear in a title, and to replace each", () => {
    const draft = promptPart(file, "draft");
    expect(draft).toContain(
      'Each title is read alone, so "them", "they", "their", "you" and "your" are never clear in it: name the people instead, even when the verses say "you".'
    );
    expect(draft).toContain(
      'Then replace any "them", "they", "their", "you" or "your" with the people it means.'
    );
    expect(draft).not.toContain('"Christians"');
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

  // #180: every UAX #14 mandatory break, as the key-term gate refuses, not
  // only CR and LF. Each is inside the title, where trim does not reach, and
  // survives NFC.
  it.each([
    ["VT", "\u{000B}"],
    ["FF", "\u{000C}"],
    ["NEL", "\u{0085}"],
    ["LINE SEPARATOR", "\u{2028}"],
    ["PARAGRAPH SEPARATOR", "\u{2029}"],
  ])("flags %s as a line break", (_name, c) => {
    const title = `Paul${c}prays`;
    expect(title.trim().normalize("NFC")).toBe(title);
    expect(gateProblems(title)).toEqual(["line-break"]);
  });

  // #181: no other control or invisible format character either; English
  // allows none (FORMAT_ALLOWED.en in scripts/lib/format.ts).
  it.each([
    ...REFUSED,
    ["ZWNJ", "\u{200C}"] as const,
    ["ZWJ", "\u{200D}"] as const,
  ])("flags %s as format", (_name, c) => {
    const title = `Paul${c}prays`;
    expect(title.trim().normalize("NFC")).toBe(title);
    expect(gateProblems(title)).toEqual(["format"]);
  });
});

/** A model that answers each call in turn with a JSON reply and a cost. */
function fakeModels(
  replies: { reply: unknown; cost: number | null; answeredBy?: string }[]
) {
  const sent: {
    model: string;
    system: string;
    user: string;
    maxTokens?: number;
  }[] = [];
  const complete: Complete = async (request) => {
    const next = replies[sent.length];
    sent.push({
      maxTokens: request.maxTokens,
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
      expect(outcome).toEqual({
        stopped:
          cost === null
            ? "check batch 1 of 1: cost unknown, not run"
            : "check batch 1 of 1: spent 1 of 1, not run",
      });
      expect(sent).toHaveLength(1);
      expect(ledgers.at(-1)).toMatchObject({
        outcome,
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
      stopped: "check batch 1 of 1: answered by the drafting model x/same",
    });
    expect(ledgers.at(-1)).toMatchObject({
      outcome,
      draftTitles: draftReply,
      checks: null,
      checkUnread: null,
    });
  });

  it("refuses a check answered by a model of the drafting model's family", async () => {
    const { complete } = fakeModels([
      { reply: draftReply, cost: 0.01, answeredBy: "a/draft" },
      {
        reply: {
          "XYZ.1.2-3": { verdict: "agree" },
          "XYZ.1.4-4": { verdict: "agree" },
        },
        cost: 0.01,
        answeredBy: "a/other",
      },
    ]);
    const ledgers: unknown[] = [];
    const { record, outcome } = await run(complete, ledgers);
    expect(record).toBeNull();
    expect(outcome).toEqual({
      stopped:
        "check batch 1 of 1: answered by a/other, of the drafting model's family",
    });
    expect(ledgers.at(-1)).toMatchObject({ outcome });
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

  // #201: a whole book in one check call was cut off at the token limit.
  it("checks in batches, each against its own verses, and records every call", async () => {
    const agree = { verdict: "agree" };
    const { complete, sent } = fakeModels([
      { reply: draftReply, cost: 0.01 },
      { reply: { "XYZ.1.2-3": agree }, cost: 0.02 },
      {
        reply: {
          "XYZ.1.4-4": {
            verdict: "disagree",
            criteria: ["style"],
            why: "Over 60 characters.",
            suggestion: "Paul will come to see the believers soon",
          },
        },
        cost: 0.03,
        answeredBy: "g/check-2",
      },
    ]);
    const ledgers: unknown[] = [];
    const { record, outcome } = await run(complete, ledgers, {
      checkBatch: 1,
    });
    expect(outcome).toBe("done");
    expect(sent.map((s) => s.model)).toEqual(["a/draft", "g/check", "g/check"]);
    expect(sent[1]?.system).toBe(promptPart(promptText, "check"));
    // Only the check calls get the larger limit.
    expect(sent.map((s) => s.maxTokens)).toEqual([
      undefined,
      CHECK_MAX_TOKENS,
      CHECK_MAX_TOKENS,
    ]);
    expect(sent[1]?.user).toBe(
      checkMessage("XYZ", inputs.slice(0, 1), draftReply)
    );
    expect(sent[2]?.user).toBe(
      checkMessage("XYZ", inputs.slice(1, 2), draftReply)
    );
    // Each verdict is labelled with the model that answered its batch.
    expect(record?.titles["XYZ.1.2-3"]?.check).toEqual({
      by: "ai:g/check",
      verdict: "agree",
    });
    expect(record?.titles["XYZ.1.4-4"]?.check?.by).toBe("ai:g/check-2");
    expect(record?.calls.map((c) => [c.role, c.id, c.cost])).toEqual([
      ["draft", "gen-1", 0.01],
      ["check", "gen-2", 0.02],
      ["check", "gen-3", 0.03],
    ]);
    expect(ledgers.at(-1)).toMatchObject({
      outcome: "done",
      checkBatch: 1,
      checkMaxTokens: CHECK_MAX_TOKENS,
      totals: { cost: 0.06 },
    });
  });

  it("stops before a later batch once the spend cap is reached", async () => {
    const { complete, sent } = fakeModels([
      { reply: draftReply, cost: 0.5 },
      { reply: { "XYZ.1.2-3": { verdict: "agree" } }, cost: 0.5 },
    ]);
    const ledgers: unknown[] = [];
    const { record, outcome } = await run(complete, ledgers, {
      checkBatch: 1,
    });
    expect(record).toBeNull();
    expect(outcome).toEqual({
      stopped: "check batch 2 of 2: spent 1 of 1, not run",
    });
    expect(sent).toHaveLength(2);
    // Batch 1's paid-for verdict stays on record (#211), and the run is
    // still stopped, so a partial book is never taken as finished.
    expect(ledgers.at(-1)).toMatchObject({
      outcome,
      calls: [{ role: "draft" }, { role: "check" }],
      draftTitles: draftReply,
      checks: { "XYZ.1.2-3": { by: "ai:g/check", verdict: "agree" } },
      checkUnread: [],
    });
  });

  it("stops when one batch's reply cannot be read, keeping the calls on record", async () => {
    const { complete, sent } = fakeModels([
      { reply: draftReply, cost: 0.01 },
      { reply: { "XYZ.1.2-3": { verdict: "agree" } }, cost: 0.01 },
      { reply: "cut off", cost: 0.01 },
    ]);
    const ledgers: unknown[] = [];
    const { record, outcome } = await run(complete, ledgers, {
      checkBatch: 1,
    });
    expect(record).toBeNull();
    expect(outcome).toMatchObject({
      stopped: expect.stringMatching(/^check batch 2 of 2: unreadable reply/),
    });
    expect(sent).toHaveLength(3);
    expect(ledgers.at(-1)).toMatchObject({
      outcome,
      calls: [{ role: "draft" }, { role: "check" }, { role: "check" }],
      checks: { "XYZ.1.2-3": { by: "ai:g/check", verdict: "agree" } },
    });
  });

  it("refuses a later batch answered by the drafting model's family", async () => {
    const { complete } = fakeModels([
      { reply: draftReply, cost: 0.01 },
      { reply: { "XYZ.1.2-3": { verdict: "agree" } }, cost: 0.01 },
      {
        reply: { "XYZ.1.4-4": { verdict: "agree" } },
        cost: 0.01,
        answeredBy: "a/other",
      },
    ]);
    const ledgers: unknown[] = [];
    const { record, outcome } = await run(complete, ledgers, {
      checkBatch: 1,
    });
    expect(record).toBeNull();
    expect(outcome).toEqual({
      stopped:
        "check batch 2 of 2: answered by a/other, of the drafting model's family",
    });
    // Batch 1's verdict, and the key batch 1 left out, stay on record.
    expect(ledgers.at(-1)).toMatchObject({
      outcome,
      checks: { "XYZ.1.2-3": { by: "ai:g/check", verdict: "agree" } },
    });
  });

  it("keeps a batch's missing and unreadable keys in the ledger", async () => {
    const { complete } = fakeModels([
      { reply: draftReply, cost: 0.01 },
      { reply: { "XYZ.1.2-3": { verdict: "maybe" } }, cost: 0.01 },
      { reply: {}, cost: 0.01, answeredBy: "a/other" },
    ]);
    const ledgers: unknown[] = [];
    const { outcome } = await run(complete, ledgers, { checkBatch: 1 });
    expect(outcome).toMatchObject({
      stopped: expect.stringMatching(/^check batch 2 of 2:/),
    });
    expect(ledgers.at(-1)).toMatchObject({
      outcome,
      checks: {},
      checkUnread: ["XYZ.1.2-3"],
    });
  });

  // #211: with no draft read there is no check call, but the fuse still
  // decides how the run ends.
  it("stops, not incomplete, when no draft was read and the cap is reached or cost is unknown", async () => {
    for (const cost of [1, null]) {
      const { complete, sent } = fakeModels([{ reply: {}, cost }]);
      const ledgers: unknown[] = [];
      const { record, outcome } = await run(complete, ledgers);
      expect(record).toBeNull();
      expect(outcome).toEqual({
        stopped:
          cost === null
            ? "check: cost unknown, not run"
            : "check: spent 1 of 1, not run",
      });
      expect(sent).toHaveLength(1);
      expect(ledgers.at(-1)).toMatchObject({
        outcome,
        checks: null,
        checkUnread: null,
        // What the draft call left unread is still on record: no title.
        draftTitles: {},
      });
    }
  });

  it("ends incomplete, with no check call, when no draft was read and the fuse allows", async () => {
    const { complete, sent } = fakeModels([{ reply: {}, cost: 0.01 }]);
    const ledgers: unknown[] = [];
    const { record, outcome } = await run(complete, ledgers);
    expect(sent).toHaveLength(1);
    expect(record?.titles).toEqual({});
    expect(outcome).toEqual({
      incomplete: { draft: ["XYZ.1.2-3", "XYZ.1.4-4"], check: [] },
    });
    expect(ledgers.at(-1)).toMatchObject({ outcome });
  });

  // #208: a whole long book does not fit in one draft reply.
  it("drafts in batches, each from its own verses, and labels each title with the model that drafted it", async () => {
    const agree = { verdict: "agree" };
    const { complete, sent } = fakeModels([
      { reply: { "XYZ.1.2-3": draftReply["XYZ.1.2-3"] }, cost: 0.01 },
      {
        reply: { "XYZ.1.4-4": draftReply["XYZ.1.4-4"] },
        cost: 0.02,
        answeredBy: "a/draft-2",
      },
      { reply: { "XYZ.1.2-3": agree, "XYZ.1.4-4": agree }, cost: 0.03 },
    ]);
    const ledgers: unknown[] = [];
    const { record, outcome } = await run(complete, ledgers, {
      draftBatch: 1,
    });
    expect(outcome).toBe("done");
    expect(sent.map((s) => s.model)).toEqual(["a/draft", "a/draft", "g/check"]);
    expect(sent[0]?.system).toBe(promptPart(promptText, "draft"));
    expect(sent[1]?.system).toBe(promptPart(promptText, "draft"));
    expect(sent[0]?.user).toBe(draftMessage("XYZ", inputs.slice(0, 1)));
    expect(sent[1]?.user).toBe(draftMessage("XYZ", inputs.slice(1, 2)));
    // The check is batched on its own size: one call for both drafts.
    expect(sent[2]?.user).toBe(checkMessage("XYZ", inputs, draftReply));
    expect(sent.map((s) => s.maxTokens)).toEqual([
      undefined,
      undefined,
      CHECK_MAX_TOKENS,
    ]);
    expect(record?.titles["XYZ.1.2-3"]?.source).toBe("ai:a/draft");
    expect(record?.titles["XYZ.1.4-4"]?.source).toBe("ai:a/draft-2");
    expect(record?.calls.map((c) => [c.role, c.id, c.cost])).toEqual([
      ["draft", "gen-1", 0.01],
      ["draft", "gen-2", 0.02],
      ["check", "gen-3", 0.03],
    ]);
    expect(ledgers.at(-1)).toMatchObject({
      outcome: "done",
      draftBatch: 1,
      draftTitles: draftReply,
      totals: { cost: 0.06 },
    });
  });

  it("drafts a book of DRAFT_BATCH segments or fewer in one call", async () => {
    const { complete, sent } = fakeModels([
      { reply: draftReply, cost: 0.01 },
      { reply: {}, cost: 0.01 },
    ]);
    const ledgers: unknown[] = [];
    await run(complete, ledgers);
    expect(sent[0]?.user).toBe(draftMessage("XYZ", inputs));
    expect(ledgers.at(-1)).toMatchObject({ draftBatch: DRAFT_BATCH });
  });

  it("stops before a later draft batch once the spend cap is reached, or when cost is unknown", async () => {
    for (const cost of [1, null]) {
      const first = { "XYZ.1.2-3": draftReply["XYZ.1.2-3"] };
      const { complete, sent } = fakeModels([{ reply: first, cost }]);
      const ledgers: unknown[] = [];
      const { record, outcome } = await run(complete, ledgers, {
        draftBatch: 1,
      });
      expect(record).toBeNull();
      expect(outcome).toEqual({
        stopped:
          cost === null
            ? "draft batch 2 of 2: cost unknown, not run"
            : "draft batch 2 of 2: spent 1 of 1, not run",
      });
      expect(sent).toHaveLength(1);
      // The first batch's paid-for drafts stay on record.
      expect(ledgers.at(-1)).toMatchObject({
        outcome,
        calls: [{ role: "draft" }],
        draftTitles: first,
      });
    }
  });

  it("stops when a draft batch's reply cannot be read, keeping earlier drafts on record", async () => {
    const first = { "XYZ.1.2-3": draftReply["XYZ.1.2-3"] };
    const { complete, sent } = fakeModels([
      { reply: first, cost: 0.01 },
      { reply: "cut off", cost: 0.01 },
    ]);
    const ledgers: unknown[] = [];
    const { record, outcome } = await run(complete, ledgers, {
      draftBatch: 1,
    });
    expect(record).toBeNull();
    expect(outcome).toMatchObject({
      stopped: expect.stringMatching(/^draft batch 2 of 2: unreadable reply/),
    });
    expect(sent).toHaveLength(2);
    expect(ledgers.at(-1)).toMatchObject({
      calls: [{ role: "draft" }, { role: "draft" }],
      draftTitles: first,
    });
  });

  it("refuses a check of drafts a later draft batch's model, or its family, answered", async () => {
    for (const [answeredBy, stopped] of [
      ["g/check", "check batch 1 of 1: answered by the drafting model g/check"],
      [
        "g/other",
        "check batch 1 of 1: answered by g/check, of the drafting model's family",
      ],
    ]) {
      const { complete } = fakeModels([
        { reply: { "XYZ.1.2-3": draftReply["XYZ.1.2-3"] }, cost: 0.01 },
        {
          reply: { "XYZ.1.4-4": draftReply["XYZ.1.4-4"] },
          cost: 0.01,
          answeredBy,
        },
        {
          reply: {
            "XYZ.1.2-3": { verdict: "agree" },
            "XYZ.1.4-4": { verdict: "agree" },
          },
          cost: 0.01,
        },
      ]);
      const ledgers: unknown[] = [];
      const { record, outcome } = await run(complete, ledgers, {
        draftBatch: 1,
      });
      expect(record).toBeNull();
      expect(outcome).toEqual({ stopped });
      expect(ledgers.at(-1)).toMatchObject({ outcome });
    }
  });

  it("refuses the same model, or one of its family, for drafting and checking", async () => {
    for (const checkModel of ["a/draft", "a/other"]) {
      const { complete, sent } = fakeModels([]);
      await expect(run(complete, [], { checkModel })).rejects.toThrow(
        "different family"
      );
      expect(sent).toHaveLength(0);
    }
  });
});

describe("batches", () => {
  it("splits in order into the fewest, most even batches", () => {
    const n = (k: number) => Array.from({ length: k }, (_, i) => i);
    const sizes = (k: number, size: number) =>
      batches(n(k), size).map((b) => b.length);
    // Colossians: 33 drafts.
    expect(sizes(33, CHECK_BATCH)).toEqual([33]);
    expect(sizes(37, CHECK_BATCH)).toEqual([19, 18]);
    expect(sizes(33, 12)).toEqual([11, 11, 11]);
    expect(sizes(37, 12)).toEqual([10, 9, 9, 9]);
    expect(sizes(12, 12)).toEqual([12]);
    expect(sizes(13, 12)).toEqual([7, 6]);
    expect(sizes(0, 12)).toEqual([]);
    expect(batches(n(1134), CHECK_BATCH).flat()).toEqual(n(1134));
    expect(
      Math.max(...batches(n(1134), CHECK_BATCH).map((b) => b.length))
    ).toBeLessThanOrEqual(CHECK_BATCH);
    // The longest books' drafts (#208): Genesis 642, Psalms 1,134.
    expect(sizes(642, DRAFT_BATCH)).toEqual([
      ...Array<number>(15).fill(34),
      ...Array<number>(4).fill(33),
    ]);
    expect(batches(n(1134), DRAFT_BATCH)).toHaveLength(33);
  });

  it("refuses a size that is not a positive integer", () => {
    for (const size of [0, -1, 1.5, Number.NaN])
      expect(() => batches([1], size)).toThrow("positive integer");
  });
});
