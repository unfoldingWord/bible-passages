import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyReviews,
  MAX_SKEW_MS,
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
// The applier's clock, fixed after every record the fixtures make.
const NOW = Date.parse("2026-11-01T00:00:00.000Z");
const apply = (f: ReadonlyMap<string, DraftFile>, r: unknown) =>
  applyReviews(f, r, NOW);
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
    const { changed, applied, problems } = apply(before, [rec()]);
    expect(problems).toEqual([]);
    expect(applied).toHaveLength(1);
    expect(changed.get("en/TIT")?.titles["TIT.1.4-4"]).toEqual({
      ...draft("Paul greets Titus"),
      review: {
        by: "reviewer:reader-7",
        at: "2026-10-29",
        status: "human-reviewed",
        saved: "2026-10-29T10:00:00.000Z",
      },
    });
    // The input is not modified.
    expect(before.get("en/TIT")?.titles["TIT.1.4-4"]?.review).toBeUndefined();
  });

  it("writes an edit with its wording and reason", () => {
    const { changed } = apply(files(), [edit("Paul greets his son")]);
    const t = changed.get("en/TIT")!.titles["TIT.1.4-4"]!;
    expect(t.text).toBe("Paul greets Titus");
    expect(t.review).toEqual({
      by: "reviewer:reader-7",
      at: "2026-10-29",
      status: "human-reviewed",
      text: "Paul greets his son",
      why: "the passage says more",
      saved: "2026-10-29T10:00:00.000Z",
    });
    expect(current(t)).toBe("Paul greets his son");
  });

  it("refuses an unknown key, language or book file, and writes nothing", () => {
    const r = apply(files(), [
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
    const r = apply(files(), [rec({ seen: "Paul greets Tit" })]);
    expect(r.problems).toEqual([
      'reader-7 en/TIT TIT.1.4-4: stale, reviewed "Paul greets Tit" but the title is now "Paul greets Titus"',
    ]);
    expect(r.changed.size).toBe(0);
  });

  it("applies in time order, each against the wording before it", () => {
    const later = "2026-10-29T11:00:00.000Z";
    // A second reviewer approves the first one's edit: fine. A third
    // approves the old wording after the edit: stale.
    const ok = apply(files(), [
      rec({ handle: "second", seen: "Paul greets his son", at: later }),
      edit("Paul greets his son"),
    ]);
    expect(ok.problems).toEqual([]);
    expect(ok.changed.get("en/TIT")!.titles["TIT.1.4-4"]!.review).toEqual({
      by: "reviewer:second",
      at: "2026-10-29",
      status: "human-reviewed",
      text: "Paul greets his son",
      saved: later,
    });
    const stale = apply(files(), [
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
    const first = apply(files(), records);
    const merged = new Map([...files(), ...first.changed]);
    const again = apply(merged, records);
    expect(again.problems).toEqual([]);
    expect(again.applied).toEqual([]);
    expect(again.skipped).toHaveLength(2);
  });

  it("passes over a title's whole history on a re-run, and applies what is new", () => {
    const later = "2026-10-29T11:00:00.000Z";
    const latest = "2026-10-30T09:00:00.000Z";
    // One reviewer edits, a second approves that edit: both applied.
    const history = [
      edit("Paul greets his son"),
      rec({ handle: "second", seen: "Paul greets his son", at: later }),
    ];
    const first = apply(files(), history);
    expect(first.problems).toEqual([]);
    const merged = new Map([...files(), ...first.changed]);
    // The next export holds both again, and a new review on another title.
    const fresh = rec({
      key: "TIT.1.1-3",
      seen: "Paul introduces himself",
      at: latest,
    });
    const again = apply(merged, [...history, fresh]);
    expect(again.problems).toEqual([]);
    expect(again.skipped).toEqual(history);
    expect(again.applied.map((a) => a.record)).toEqual([fresh]);
    // And a newer review of the same title builds on the stored one.
    const third = rec({
      handle: "third",
      seen: "Paul greets his son",
      at: latest,
    });
    const next = apply(merged, [...history, third]);
    expect(next.problems).toEqual([]);
    expect(next.skipped).toEqual(history);
    expect(next.changed.get("en/TIT")!.titles["TIT.1.4-4"]!.review?.by).toBe(
      "reviewer:third"
    );
  });

  it("passes over records whose documents were replaced since they were applied", () => {
    // A edits X to Y, B edits Y to Z: both applied. B then approves Z,
    // which replaces B's earlier document, so the next export holds A's
    // edit and B's approval, and not the edit that links them.
    const a = edit("Paul greets his son");
    const bEdit = edit("Paul greets his son Titus", {
      handle: "second",
      seen: "Paul greets his son",
      at: "2026-10-29T11:00:00.000Z",
    });
    const first = apply(files(), [a, bEdit]);
    expect(first.problems).toEqual([]);
    const merged = new Map([...files(), ...first.changed]);
    const bApprove = rec({
      handle: "second",
      seen: "Paul greets his son Titus",
      at: "2026-10-30T08:00:00.000Z",
    });
    const next = apply(merged, [a, bApprove]);
    expect(next.problems).toEqual([]);
    expect(next.skipped).toEqual([a]);
    expect(next.applied.map((x) => x.record)).toEqual([bApprove]);
    // A record never applied and saved after the stored review is still
    // checked: one made against the old wording is stale.
    const late = rec({ handle: "late", at: "2026-10-31T08:00:00.000Z" });
    expect(apply(merged, [a, late]).problems[0]).toMatch(/^late .*stale/);
  });

  it("orders records by time, whatever their precision", () => {
    // 10:00:00Z is before 10:00:00.100Z, though it sorts after it as text.
    const r = apply(files(), [
      rec({
        handle: "second",
        seen: "Paul greets his son",
        at: "2026-10-29T10:00:00.100Z",
      }),
      edit("Paul greets his son", { at: "2026-10-29T10:00:00Z" }),
    ]);
    expect(r.problems).toEqual([]);
    expect(r.applied.map((a) => a.record.handle)).toEqual([
      "reader-7",
      "second",
    ]);
  });

  it("refuses a record from the future, which would close its title", () => {
    const future = rec({ at: "2099-01-01T00:00:00.000Z" });
    const r = apply(files(), [
      rec({ key: "TIT.1.1-3", seen: "Paul introduces himself" }),
      future,
    ]);
    expect(r.problems).toEqual(["record 1: at is in the future"]);
    expect(r.changed.size).toBe(0);
    // Within the allowed skew it applies, and a later review builds on it.
    const ahead = new Date(NOW + MAX_SKEW_MS - 1000).toISOString();
    const soon = apply(files(), [rec({ at: ahead })]);
    expect(soon.problems).toEqual([]);
    const merged = new Map([...files(), ...soon.changed]);
    const next = applyReviews(
      merged,
      [
        edit("Paul greets his son", {
          handle: "next",
          at: new Date(NOW + MAX_SKEW_MS).toISOString(),
        }),
      ],
      NOW + MAX_SKEW_MS
    );
    expect(next.problems).toEqual([]);
    expect(next.applied).toHaveLength(1);
  });

  it("keeps reasons on one line without bidi controls; refuses them in wording", () => {
    const why = "first line\nsecond \u202Eline\u0007 with \u200Djoiner";
    const r = apply(files(), [edit("Paul greets his son", { why })]);
    expect(r.changed.get("en/TIT")!.titles["TIT.1.4-4"]!.review?.why).toBe(
      "first line second line with \u200Djoiner"
    );
    expect(
      apply(files(), [edit("Paul greets his \u202Eson")]).problems[0]
    ).toMatch(/bidi control character/);
  });

  it("refuses wording with surrounding whitespace", () => {
    expect(apply(files(), [edit("Paul greets his son. ")]).problems[0]).toMatch(
      /surrounding whitespace/
    );
  });

  it("names a profile document copied into the records", () => {
    const r = apply(files(), [
      { v: 1, handle: "reader-7", at: "2026-10-29T10:00:00.000Z" },
    ]);
    expect(r.problems).toEqual([
      "record 0: a profile document; records are item documents only",
    ]);
  });

  it("keeps a draft's own approved status on approval", () => {
    const f = files();
    f.get("en/TIT")!.titles["TIT.1.4-4"]!.status = "approved";
    expect(
      apply(f, [rec()]).changed.get("en/TIT")!.titles["TIT.1.4-4"]!.review
        ?.status
    ).toBe("approved");
  });

  it("keeps an approved title approved on approval; an edit is human-reviewed", () => {
    const f = files();
    f.get("en/TIT")!.titles["TIT.1.4-4"]!.review = {
      by: "reviewer:owner",
      at: "2026-10-28",
      status: "approved",
    };
    const approve = apply(f, [rec()]);
    expect(
      approve.changed.get("en/TIT")!.titles["TIT.1.4-4"]!.review?.status
    ).toBe("approved");
    const changed = apply(f, [edit("Paul greets his son")]);
    expect(
      changed.changed.get("en/TIT")!.titles["TIT.1.4-4"]!.review?.status
    ).toBe("human-reviewed");
  });

  it("checks a person's own wording like any title", () => {
    const bad = (text: string, lang = "en", seen = "Paul greets Titus") =>
      apply(files(), [edit(text, { lang, seen })]).problems;
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
    const { applied } = apply(files(), [
      edit("Paul greets his son", { why: "a | b" }),
    ]);
    expect(summary(applied)).toContain(
      "| en | TIT.1.4-4 | edit | reviewer:reader-7 | Paul greets Titus | Paul greets his son | a \\| b |"
    );
    const { applied: bidi } = apply(files(), [
      edit("Paul greets his son", { why: "a\u202Eb\u001B[31m" }),
    ]);
    expect(summary(bidi)).toMatch(/\| ab\[31m \|$/);
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
    const vrs = read("data/versification/ufw.json") as Record<string, number[]>;
    for (const s of queue.sets) {
      const structure = read(`data/structure/${s.book}.json`) as {
        segments: { key: string; start: number[]; end: number[] }[];
      };
      for (const i of s.items) {
        const seg = structure.segments.find((g) => g.key === i.key)!;
        const last = vrs[s.book]!;
        const want: string[] = [];
        for (let c = seg.start[0]!; c <= seg.end[0]!; c++) {
          const from = c === seg.start[0] ? seg.start[1]! : 1;
          const to = c === seg.end[0] ? seg.end[1]! : last[c - 1]!;
          for (let v = from; v <= to; v++) want.push(`${c}:${v}`);
        }
        expect(i.verses.map(([r]) => r)).toEqual(want);
        for (const [, t] of i.verses) expect(t).not.toMatch(/\\|^$/);
      }
    }
  });
});
