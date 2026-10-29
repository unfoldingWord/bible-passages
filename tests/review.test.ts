import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyReviews,
  current,
  direction,
  recordProblems,
  summary,
  verseText,
  type DraftFile,
  type ReviewRecord,
} from "../scripts/lib/review.ts";

const read = (path: string) =>
  JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));

const draft = (text: string) => ({
  text,
  source: "ai:model-a",
  status: "ai-checked",
});
const files = (): Map<string, DraftFile> =>
  new Map<string, DraftFile>([
    [
      "en/TIT",
      {
        language: "en",
        book: "TIT",
        titles: {
          "TIT.1.1-3": draft("Paul introduces himself"),
          "TIT.1.4-4": draft("Paul greets Titus"),
        },
      },
    ],
    [
      "ar/TIT",
      {
        language: "ar",
        book: "TIT",
        titles: { "TIT.1.4-4": draft("بولس يحيّي تيطس") },
      },
    ],
  ]);
const rec = (over: Partial<ReviewRecord> = {}): ReviewRecord => ({
  v: 1,
  handle: "reader-7",
  lang: "en",
  book: "TIT",
  key: "TIT.1.4-4",
  action: "approve",
  seen: "Paul greets Titus",
  at: "2026-10-29T10:00:00.000Z",
  ...over,
});
const edit = (text: string, over: Partial<ReviewRecord> = {}) =>
  rec({ action: "edit", text, why: "the passage says more", ...over });

describe("review records", () => {
  it("accepts the record the Review page writes", () => {
    expect(recordProblems(rec())).toEqual([]);
    expect(recordProblems(edit("Paul greets Titus, his son"))).toEqual([]);
  });

  it("refuses a display name, unknown fields and a bad shape", () => {
    expect(recordProblems(rec({ handle: "Mark K" }))).toContain("handle");
    expect(recordProblems(rec({ handle: "-x" }))).toContain("handle");
    expect(recordProblems({ ...rec(), name: "Someone" })).toContain(
      'field "name"'
    );
    expect(recordProblems(rec({ book: "XYZ" }))).toContain("book");
    expect(recordProblems(rec({ at: "29 Oct" }))).toContain("at");
    expect(recordProblems(rec({ action: "flag" as "edit" }))).toContain(
      "action"
    );
    expect(recordProblems(null)).toEqual(["not an object"]);
  });

  it("needs a reason for an edit, and no text on an approval", () => {
    expect(
      recordProblems(rec({ action: "edit", text: "Paul greets his son" }))
    ).toContain("an edit needs a reason (why)");
    expect(recordProblems(rec({ text: "x" }))).toContain("text on an approval");
    expect(recordProblems(rec({ why: " padded " }))).toContain("why");
  });
});

describe("applyReviews", () => {
  it("writes an approval as a person's review, keeping the wording", () => {
    const before = files();
    const { changed, applied, problems } = applyReviews(before, [rec()]);
    expect(problems).toEqual([]);
    expect(applied).toHaveLength(1);
    expect(changed.get("en/TIT")?.titles["TIT.1.4-4"]).toEqual({
      ...draft("Paul greets Titus"),
      review: {
        by: "reviewer:reader-7",
        at: "2026-10-29",
        status: "human-reviewed",
      },
    });
    // The input is not modified.
    expect(before.get("en/TIT")?.titles["TIT.1.4-4"]?.review).toBeUndefined();
  });

  it("writes an edit with its wording and reason", () => {
    const { changed } = applyReviews(files(), [edit("Paul greets his son")]);
    const t = changed.get("en/TIT")!.titles["TIT.1.4-4"]!;
    expect(t.text).toBe("Paul greets Titus");
    expect(t.review).toEqual({
      by: "reviewer:reader-7",
      at: "2026-10-29",
      status: "human-reviewed",
      text: "Paul greets his son",
      why: "the passage says more",
    });
    expect(current(t)).toBe("Paul greets his son");
  });

  it("refuses an unknown key, language or book file, and writes nothing", () => {
    const r = applyReviews(files(), [
      rec(),
      rec({ key: "TIT.9.1-2" }),
      rec({ lang: "fr" }),
      rec({ book: "GEN" }),
    ]);
    expect(r.changed.size).toBe(0);
    expect(r.applied).toEqual([]);
    expect(r.problems).toEqual([
      "reader-7 en/GEN TIT.1.4-4: no data/drafts/en/GEN.json",
      "reader-7 en/TIT TIT.9.1-2: unknown key",
      "reader-7 fr/TIT TIT.1.4-4: no data/drafts/fr/TIT.json",
    ]);
  });

  it("refuses a review of wording that has since changed", () => {
    const r = applyReviews(files(), [rec({ seen: "Paul greets Tit" })]);
    expect(r.problems).toEqual([
      'reader-7 en/TIT TIT.1.4-4: stale, reviewed "Paul greets Tit" but the title is now "Paul greets Titus"',
    ]);
    expect(r.changed.size).toBe(0);
  });

  it("applies in time order, each against the wording before it", () => {
    const later = "2026-10-29T11:00:00.000Z";
    // A second reviewer approves the first one's edit: fine. A third
    // approves the old wording after the edit: stale.
    const ok = applyReviews(files(), [
      rec({ handle: "second", seen: "Paul greets his son", at: later }),
      edit("Paul greets his son"),
    ]);
    expect(ok.problems).toEqual([]);
    expect(ok.changed.get("en/TIT")!.titles["TIT.1.4-4"]!.review).toEqual({
      by: "reviewer:second",
      at: "2026-10-29",
      status: "human-reviewed",
      text: "Paul greets his son",
    });
    const stale = applyReviews(files(), [
      edit("Paul greets his son"),
      rec({ handle: "third", at: later }),
    ]);
    expect(stale.problems).toHaveLength(1);
    expect(stale.problems[0]).toMatch(/^third .*stale/);
  });

  it("passes over a record an earlier batch applied", () => {
    const records = [
      rec({ key: "TIT.1.1-3", seen: "Paul introduces himself" }),
      edit("Paul greets his son"),
    ];
    const first = applyReviews(files(), records);
    const merged = new Map([...files(), ...first.changed]);
    const again = applyReviews(merged, records);
    expect(again.problems).toEqual([]);
    expect(again.applied).toEqual([]);
    expect(again.skipped).toHaveLength(2);
  });

  it("checks a person's own wording like any title", () => {
    const bad = (text: string, lang = "en", seen = "Paul greets Titus") =>
      applyReviews(files(), [edit(text, { lang, seen })]).problems;
    expect(bad("Paul greets Titus")[0]).toMatch(/changes nothing/);
    expect(bad("Paul greets Titus, his son.")[0]).toMatch(/full stop/);
    expect(bad("x".repeat(61))[0]).toMatch(/over 60 characters/);
    expect(bad("Paul <b>greets</b>")[0]).toMatch(/markup/);
    // Arabic: the translation gates apply, so Latin text is refused.
    expect(bad("Paul greets Titus", "ar", "بولس يحيّي تيطس")[0]).toMatch(
      /outside Arabic|equals the English/
    );
    expect(bad("بولس يسلّم على تيطس ابنه", "ar", "بولس يحيّي تيطس")).toEqual(
      []
    );
  });

  it("summarises a batch for the PR body, pipes escaped", () => {
    const { applied } = applyReviews(files(), [
      edit("Paul greets his son", { why: "a | b" }),
    ]);
    expect(summary(applied)).toContain(
      "| en | TIT.1.4-4 | edit | reviewer:reader-7 | Paul greets Titus | Paul greets his son | a \\| b |"
    );
  });
});

describe("direction", () => {
  it("is right to left for Arabic and its regional tags only", () => {
    expect(direction("ar")).toBe("rtl");
    expect(direction("ar-EG")).toBe("rtl");
    expect(direction("en")).toBe("ltr");
    expect(direction("zh-Hans")).toBe("ltr");
  });
});

describe("verseText", () => {
  it("reads aligned USFM to plain verses", () => {
    const usfm = [
      "\\id TIT",
      "\\c 1",
      "\\s1 A Heading",
      "\\r (Acts 1:1)",
      "\\m",
      '\\v 1 \\zaln-s |x-strong="G1" x-content="Π"\\*\\w Paul|x-occurrence="1"\\w*\\zaln-e\\*,',
      '\\w God|x-occurrence="1"\\w*’\\w s|x-occurrence="1"\\w* word.\\f + \\fr 1:1 \\ft a note\\f* ',
      "\\q1 \\v 2 second \\v 3 third",
      "\\c 2",
      "\\p",
      "\\v 1 next chapter",
    ].join("\n");
    expect([...verseText(usfm)]).toEqual([
      ["1:1", "Paul, God’s word."],
      ["1:2", "second"],
      ["1:3", "third"],
      ["2:1", "next chapter"],
    ]);
  });

  it("fails on a marker it does not know rather than show it", () => {
    expect(() => verseText("\\c 1\n\\v 1 text \\zz odd")).toThrow(/1:1/);
  });
});

describe("site/review.json", () => {
  type Item = {
    key: string;
    text: string;
    status: string;
    verses: [string, string][];
  };
  const queue = read("site/review.json") as {
    schema: string;
    sets: { lang: string; dir: string; book: string; items: Item[] }[];
  };

  it("matches the drafts: every title, as it stands now", () => {
    expect(queue.schema).toBe("bp.review-queue");
    for (const s of queue.sets) {
      const drafts = read(`data/drafts/${s.lang}/${s.book}.json`) as DraftFile;
      expect(s.dir).toBe(direction(s.lang));
      expect(s.items.map((i) => i.key).sort()).toEqual(
        Object.keys(drafts.titles).sort()
      );
      for (const i of s.items) {
        const d = drafts.titles[i.key]!;
        expect(i.text).toBe(current(d));
        expect(i.status).toBe(d.review?.status ?? d.status);
      }
    }
  });

  it("shows each title's whole passage, verse by verse", () => {
    for (const s of queue.sets) {
      const structure = read(`data/structure/${s.book}.json`) as {
        segments: { key: string; start: number[]; end: number[] }[];
      };
      for (const i of s.items) {
        const seg = structure.segments.find((g) => g.key === i.key)!;
        const want: string[] = [];
        for (let v = seg.start[1]!; v <= seg.end[1]!; v++)
          want.push(`${seg.start[0]}:${v}`);
        expect(i.verses.map(([r]) => r)).toEqual(want);
        for (const [, t] of i.verses) expect(t).not.toMatch(/\\|^$/);
      }
    }
  });
});
