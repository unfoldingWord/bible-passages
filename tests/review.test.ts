import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applyReviews,
  current,
  exportProblems,
  MAX_SKEW_MS,
  recordProblems,
  summary,
  type Answer,
  type DraftFile,
} from "../scripts/lib/review.ts";

const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/review/export.json", import.meta.url),
    "utf8"
  )
) as { schema: string; v: number; reviewer: string; records: Answer[] };

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
          "TIT.1.1-3": draft(
            "Paul introduces himself as God’s servant and apostle"
          ),
          "TIT.1.4-4": draft("Paul greets Titus"),
          "TIT.1.5-9": draft("Titus must appoint qualified elders"),
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
const envelope = (records: unknown[], reviewer = "reviewer:reader-7") => ({
  schema: "bp.review-export",
  v: 2,
  reviewer,
  records,
});
const apply = (f: ReadonlyMap<string, DraftFile>, ...exports: unknown[]) =>
  applyReviews(f, exports, NOW);
/** An answer as the review artifact writes it: a keep, unless changed. */
const keep = (over: Partial<Answer> = {}): Answer => ({
  at: "2026-10-29T10:00:00.000Z",
  changed: false,
  key: "TIT.1.4-4",
  lang: "en",
  ms: 5000,
  note: "",
  pick: "keep",
  shown: [],
  text: "Paul greets Titus",
  v: 1,
  ...over,
});
const change = (text: string, over: Partial<Answer> = {}) =>
  keep({
    pick: "change",
    changed: true,
    text,
    note: "the passage says more",
    ...over,
  });

describe("the export envelope", () => {
  it("accepts a bp.review-export v2 with a reviewer handle", () => {
    expect(exportProblems(fixture)).toEqual([]);
    expect(exportProblems(envelope([]))).toEqual([]);
  });

  it("refuses another schema, version, a display name or extra fields", () => {
    expect(exportProblems({ ...envelope([]), v: 1 })).toContain("v is not 2");
    expect(exportProblems({ ...envelope([]), schema: "x" })).toContain(
      'schema is not "bp.review-export"'
    );
    expect(exportProblems(envelope([], "reviewer:Mark K"))).toContain(
      "reviewer is not reviewer:<handle>"
    );
    expect(exportProblems(envelope([], "reader-7"))).toContain(
      "reviewer is not reviewer:<handle>"
    );
    expect(exportProblems({ ...envelope([]), uid: "abc" })).toContain(
      'field "uid"'
    );
    expect(exportProblems({ ...envelope([]), records: {} })).toContain(
      "records is not a list"
    );
    expect(exportProblems(null)).toEqual(["not an object"]);
  });
});

describe("answer records", () => {
  it("accepts a keep and a change as the artifact writes them", () => {
    expect(recordProblems(keep())).toEqual([]);
    expect(recordProblems(change("Paul greets his son"))).toEqual([]);
    for (const r of fixture.records.filter((r) => r.lang === "en"))
      expect(recordProblems(r)).toEqual([]);
  });

  it("refuses a blind-comparison answer: it is not a title review", () => {
    const blind = fixture.records.find((r) => r.lang === "ar")!;
    expect(recordProblems(blind)).toEqual([
      'pick "c2" is not "keep" or "change": a blind-comparison answer, not a title review',
    ]);
    expect(recordProblems(keep({ pick: "both" as "keep" }))[0]).toMatch(
      /pick "both" is not/
    );
    expect(recordProblems(keep({ shown: ["c1"] }))).toContain(
      "shown is not empty"
    );
  });

  it("refuses unknown fields and a bad shape", () => {
    expect(recordProblems({ ...keep(), name: "Someone" })).toContain(
      'field "name"'
    );
    expect(recordProblems(keep({ v: 2 as 1 }))).toContain("v is not 1");
    expect(recordProblems(keep({ key: "XYZ.1.1-2" }))).toContain("key");
    expect(recordProblems(keep({ lang: "EN" }))).toContain("lang");
    expect(recordProblems(keep({ at: "29 Oct" }))).toContain("at");
    expect(recordProblems(keep({ ms: -1 }))).toContain("ms");
    expect(recordProblems(keep({ text: "" }))).toContain("text");
    expect(recordProblems(null)).toEqual(["not an object"]);
  });

  it("needs a reason for a change, and pick and changed to agree", () => {
    expect(
      recordProblems(change("Paul greets his son", { note: " " }))
    ).toContain("a change needs a reason (note)");
    expect(recordProblems(keep({ changed: true }))).toContain(
      "changed does not match pick"
    );
    expect(
      recordProblems(change("Paul greets his son", { changed: false }))
    ).toContain("changed does not match pick");
  });
});

describe("applyReviews", () => {
  it("refuses the fixture whole, naming the blind and the stale record", () => {
    const r = apply(files(), fixture);
    expect(r.changed.size).toBe(0);
    expect(r.applied).toEqual([]);
    expect(r.problems).toEqual([
      'reviewer:reader-7 record 2 (ar~TIT.1.4-4): pick "c2" is not "keep" or "change": a blind-comparison answer, not a title review',
    ]);
    // Without the blind record, the stale one still stops the batch.
    const titles = fixture.records.filter((r) => r.lang === "en");
    const s = apply(files(), { ...fixture, records: titles });
    expect(s.changed.size).toBe(0);
    expect(s.problems).toEqual([
      'reviewer:reader-7 en/TIT TIT.1.5-9: stale, kept "Titus must appoint elders in every town" but the title is now "Titus must appoint qualified elders"',
    ]);
  });

  it("applies the fixture's keep and change", () => {
    const records = fixture.records.slice(0, 2);
    const r = apply(files(), { ...fixture, records });
    expect(r.problems).toEqual([]);
    expect(r.applied.map((a) => [a.record.key, a.record.pick])).toEqual([
      ["TIT.1.1-3", "keep"],
      ["TIT.1.4-4", "change"],
    ]);
    const t = r.changed.get("en/TIT")!.titles;
    expect(t["TIT.1.1-3"]!.review).toEqual({
      by: "reviewer:reader-7",
      at: "2026-10-29",
      status: "human-reviewed",
      saved: "2026-10-29T23:53:12.331Z",
    });
    expect(t["TIT.1.4-4"]!.review).toEqual({
      by: "reviewer:reader-7",
      at: "2026-10-29",
      status: "human-reviewed",
      text: "Paul greets Titus, his true son in the faith",
      why: "The passage calls Titus his true son",
      saved: "2026-10-29T23:54:40.002Z",
    });
  });

  it("writes a keep as a person's review, keeping the wording", () => {
    const before = files();
    const { changed, applied, problems } = apply(before, envelope([keep()]));
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

  it("writes a change with its wording and reason", () => {
    const { changed } = apply(
      files(),
      envelope([change("Paul greets his son")])
    );
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

  it("keeps a note on a keep as its reason", () => {
    const { changed } = apply(files(), envelope([keep({ note: "clear" })]));
    expect(changed.get("en/TIT")!.titles["TIT.1.4-4"]!.review?.why).toBe(
      "clear"
    );
  });

  it("refuses an unknown key or language, and writes nothing", () => {
    const r = apply(
      files(),
      envelope([
        keep(),
        keep({ key: "TIT.9.1-2" }),
        keep({ lang: "fr" }),
        keep({ key: "GEN.1.1-5" }),
      ])
    );
    expect(r.changed.size).toBe(0);
    expect(r.applied).toEqual([]);
    expect(r.problems).toEqual([
      "reviewer:reader-7 en/GEN GEN.1.1-5: no data/drafts/en/GEN.json",
      "reviewer:reader-7 en/TIT TIT.9.1-2: unknown key",
      "reviewer:reader-7 fr/TIT TIT.1.4-4: no data/drafts/fr/TIT.json",
    ]);
  });

  it("refuses a keep of wording that has since changed", () => {
    const r = apply(files(), envelope([keep({ text: "Paul greets Tit" })]));
    expect(r.problems).toEqual([
      'reviewer:reader-7 en/TIT TIT.1.4-4: stale, kept "Paul greets Tit" but the title is now "Paul greets Titus"',
    ]);
    expect(r.changed.size).toBe(0);
  });

  it("refuses a change to a title a person has already reworded", () => {
    // The record has no `seen`: whether the reviewer changed the draft's
    // wording or the person's cannot be told, so it is refused.
    const f = files();
    f.get("en/TIT")!.titles["TIT.1.4-4"]!.review = {
      by: "reviewer:owner",
      at: "2026-10-28",
      status: "human-reviewed",
      text: "Paul greets his son",
      saved: "2026-10-28T09:00:00.000Z",
    };
    const r = apply(f, envelope([change("Paul greets his true son")]));
    expect(r.problems).toEqual([
      'reviewer:reader-7 en/TIT TIT.1.4-4: the title is a person\'s wording ("Paul greets his son"), and a change does not say which wording it replaced',
    ]);
    // A keep of that wording is fine.
    expect(
      apply(f, envelope([keep({ text: "Paul greets his son" })])).problems
    ).toEqual([]);
  });

  it("refuses two records for one title in one export", () => {
    const r = apply(files(), envelope([keep(), keep()]));
    expect(r.problems).toEqual([
      "reviewer:reader-7 record 1 (en~TIT.1.4-4): a second record for this title",
    ]);
  });

  it("applies in time order across reviewers, each against the wording before it", () => {
    const later = "2026-10-29T11:00:00.000Z";
    // A second reviewer keeps the first one's change: fine.
    const ok = apply(
      files(),
      envelope(
        [keep({ text: "Paul greets his son", at: later })],
        "reviewer:second"
      ),
      envelope([change("Paul greets his son")])
    );
    expect(ok.problems).toEqual([]);
    expect(ok.changed.get("en/TIT")!.titles["TIT.1.4-4"]!.review).toEqual({
      by: "reviewer:second",
      at: "2026-10-29",
      status: "human-reviewed",
      text: "Paul greets his son",
      saved: later,
    });
    // A third keeps the old wording after the change: stale.
    const stale = apply(
      files(),
      envelope([change("Paul greets his son")]),
      envelope([keep({ at: later })], "reviewer:third")
    );
    expect(stale.problems).toHaveLength(1);
    expect(stale.problems[0]).toMatch(/^reviewer:third .*stale/);
    // Two changes to one title in a batch: the second cannot say what it
    // replaced.
    const twice = apply(
      files(),
      envelope([change("Paul greets his son")]),
      envelope(
        [change("Paul greets Titus his son", { at: later })],
        "reviewer:fourth"
      )
    );
    expect(twice.problems[0]).toMatch(/^reviewer:fourth .*a person's wording/);
  });

  it("orders records by time, whatever their precision", () => {
    // 10:00:00Z is before 10:00:00.100Z, though it sorts after it as text.
    const r = apply(
      files(),
      envelope(
        [keep({ text: "Paul greets his son", at: "2026-10-29T10:00:00.100Z" })],
        "reviewer:second"
      ),
      envelope([change("Paul greets his son", { at: "2026-10-29T10:00:00Z" })])
    );
    expect(r.problems).toEqual([]);
    expect(r.applied.map((a) => a.by)).toEqual([
      "reviewer:reader-7",
      "reviewer:second",
    ]);
  });

  it("passes over a record an earlier batch applied, so a re-run is a no-op", () => {
    const records = fixture.records.slice(0, 2);
    const first = apply(files(), { ...fixture, records });
    expect(first.problems).toEqual([]);
    const merged = new Map([...files(), ...first.changed]);
    const again = apply(merged, { ...fixture, records });
    expect(again.problems).toEqual([]);
    expect(again.applied).toEqual([]);
    expect(again.changed.size).toBe(0);
    expect(again.skipped.map((s) => s.record)).toEqual(records);
  });

  it("on a re-run applies only what is new, building on the stored review", () => {
    const history = envelope([change("Paul greets his son")]);
    const first = apply(files(), history);
    const merged = new Map([...files(), ...first.changed]);
    const fresh = keep({
      text: "Paul greets his son",
      at: "2026-10-30T09:00:00.000Z",
    });
    const next = apply(merged, history, envelope([fresh], "reviewer:third"));
    expect(next.problems).toEqual([]);
    expect(next.skipped).toHaveLength(1);
    expect(next.applied.map((a) => a.record)).toEqual([fresh]);
    expect(next.changed.get("en/TIT")!.titles["TIT.1.4-4"]!.review).toEqual({
      by: "reviewer:third",
      at: "2026-10-30",
      status: "human-reviewed",
      text: "Paul greets his son",
      saved: "2026-10-30T09:00:00.000Z",
    });
  });

  it("refuses a record from the future, which would close its title", () => {
    const r = apply(
      files(),
      envelope([
        keep({
          key: "TIT.1.1-3",
          text: "Paul introduces himself as God’s servant and apostle",
        }),
        keep({ at: "2099-01-01T00:00:00.000Z" }),
      ])
    );
    expect(r.problems).toEqual([
      "reviewer:reader-7 record 1 (en~TIT.1.4-4): at is in the future",
    ]);
    expect(r.changed.size).toBe(0);
    const ahead = new Date(NOW + MAX_SKEW_MS - 1000).toISOString();
    expect(apply(files(), envelope([keep({ at: ahead })])).problems).toEqual(
      []
    );
  });

  it("keeps reasons on one line without control characters; refuses bidi controls in wording", () => {
    const note = " first line\nsecond \u202Eline\u0007 with \u200Djoiner ";
    const r = apply(
      files(),
      envelope([change("Paul greets his son", { note })])
    );
    expect(r.changed.get("en/TIT")!.titles["TIT.1.4-4"]!.review?.why).toBe(
      "first line second line with \u200Djoiner"
    );
    expect(
      apply(files(), envelope([change("Paul greets his \u202Eson")]))
        .problems[0]
    ).toMatch(/bidi control character/);
  });

  it("never lowers a status on a keep; a change is human-reviewed", () => {
    const f = files();
    f.get("en/TIT")!.titles["TIT.1.4-4"]!.status = "approved";
    expect(
      apply(f, envelope([keep()])).changed.get("en/TIT")!.titles["TIT.1.4-4"]!
        .review?.status
    ).toBe("approved");
    const g = files();
    g.get("en/TIT")!.titles["TIT.1.4-4"]!.review = {
      by: "reviewer:owner",
      at: "2026-10-28",
      status: "approved",
    };
    expect(
      apply(g, envelope([keep()])).changed.get("en/TIT")!.titles["TIT.1.4-4"]!
        .review?.status
    ).toBe("approved");
    expect(
      apply(g, envelope([change("Paul greets his son")])).changed.get("en/TIT")!
        .titles["TIT.1.4-4"]!.review?.status
    ).toBe("human-reviewed");
  });

  it("checks a reviewer's own wording like any title", () => {
    const bad = (text: string, lang = "en") =>
      apply(files(), envelope([change(text, { lang })])).problems;
    expect(bad("Paul greets Titus")[0]).toMatch(/changes nothing/);
    expect(bad("Paul greets Titus, his son.")[0]).toMatch(/full-stop/);
    expect(bad("x".repeat(61))[0]).toMatch(/length/);
    expect(bad("Paul greets “Titus”")[0]).toMatch(/quotes/);
    expect(bad("Paul's greeting")[0]).toMatch(/straight-apostrophe/);
    expect(bad("Paul <b>greets</b>")[0]).toMatch(/markup/);
    expect(bad("Paul greets his son ")[0]).toMatch(/surrounding whitespace/);
    // Arabic: the translation gates apply, so Latin text is refused.
    expect(bad("Paul greets Titus", "ar")[0]).toMatch(
      /outside Arabic|equals the English/
    );
    expect(bad("بولس يسلّم على تيطس ابنه", "ar")).toEqual([]);
  });

  it("gates a translated pericope against the built English table", () => {
    // Translated drafts are keyed by every titled key; English drafts hold
    // segments only, so a pericope's English title is in data/titles/en/.
    const f = files();
    f.get("ar/TIT")!.titles["TIT.P.1.1-4"] = draft("تحية بولس");
    const r = change("تحية بولس إلى تيطس", { lang: "ar", key: "TIT.P.1.1-4" });
    expect(apply(f, envelope([r])).problems).toEqual([
      "reviewer:reader-7 ar/TIT TIT.P.1.1-4: no English title to check it against",
    ]);
    const english = new Map([
      ["TIT", { "TIT.P.1.1-4": { text: "Paul’s Greeting to Titus" } }],
    ]);
    const ok = applyReviews(f, [envelope([r])], NOW, english);
    expect(ok.problems).toEqual([]);
    expect(ok.applied).toHaveLength(1);
    // The table's English is gated against like a draft's: a copy leaks.
    const leak = change("Paul’s Greeting to Titus", {
      lang: "ar",
      key: "TIT.P.1.1-4",
    });
    expect(
      applyReviews(f, [envelope([leak])], NOW, english).problems[0]
    ).toMatch(/equals the English|outside Arabic/);
    // An English draft, with this batch's change applied, wins over the table.
    const g = files();
    const both = applyReviews(
      g,
      [
        envelope([change("Paul greets his son")]),
        envelope(
          [
            change("Paul greets his son", {
              lang: "ar",
              at: "2026-10-29T11:00:00.000Z",
            }),
          ],
          "reviewer:second"
        ),
      ],
      NOW,
      new Map([["TIT", { "TIT.1.4-4": { text: "something else" } }]])
    );
    expect(both.problems[0]).toMatch(/^reviewer:second .*equals the English/);
  });

  it("drops bidi marks from a note and refuses them in wording", () => {
    const r = apply(
      files(),
      envelope([change("Paul greets his son", { note: "a\u200Fb\u061Cc" })])
    );
    expect(r.changed.get("en/TIT")!.titles["TIT.1.4-4"]!.review?.why).toBe(
      "abc"
    );
    expect(
      apply(files(), envelope([change("Paul greets his\u200E son")]))
        .problems[0]
    ).toMatch(/bidi control character/);
  });

  it("summarises a batch for the PR body, pipes escaped", () => {
    const { applied } = apply(
      files(),
      envelope([change("Paul greets his son", { note: "a | b", ms: 12000 })])
    );
    const s = summary(applied);
    expect(s).toContain(
      "| en | TIT.1.4-4 | change | reviewer:reader-7 | Paul greets Titus | Paul greets his son | a \\| b |"
    );
    expect(s).toContain("Time on these reviews: 12 s in all, median 12 s");
    const { applied: bidi } = apply(
      files(),
      envelope([change("Paul greets his son", { note: "a\u202Eb\u001B[31m" })])
    );
    expect(summary(bidi)).toMatch(/\| ab\[31m \|$/m);
  });
});

describe("refusal messages", () => {
  // Text from a refused record is shown quoted, with control, format and
  // separator characters escaped: a bidi override or a terminal escape in it
  // cannot reorder or recolour the line the maintainer reads (#139).
  const hidden = /[\p{C}\p{Zl}\p{Zp}]/u;
  const printable = (problems: string[]) => {
    expect(problems.length).toBeGreaterThan(0);
    for (const p of problems) expect(p).not.toMatch(hidden);
  };

  it("quotes a stale keep's wording and the title, escaped", () => {
    const r = apply(
      files(),
      envelope([keep({ text: "Paul \u{202E}greets\u{1B}[31m Titus" })])
    );
    expect(r.problems).toEqual([
      'reviewer:reader-7 en/TIT TIT.1.4-4: stale, kept "Paul \\u{202E}greets\\u{1B}[31m Titus" but the title is now "Paul greets Titus"',
    ]);
  });

  it("quotes a person's wording when a change to it is refused", () => {
    const f = files();
    f.get("en/TIT")!.titles["TIT.1.4-4"]!.review = {
      by: "reviewer:owner",
      at: "2026-10-28",
      status: "human-reviewed",
      text: 'Paul \u{2067}greets\u{2069} "his" son\u{2028}',
    };
    const r = apply(f, envelope([change("Paul greets Titus warmly")]));
    expect(r.problems).toEqual([
      'reviewer:reader-7 en/TIT TIT.1.4-4: the title is a person\'s wording ("Paul \\u{2067}greets\\u{2069} \\"his\\" son\\u{2028}"), and a change does not say which wording it replaced',
    ]);
  });

  it("escapes field names, picks, keys and gate output", () => {
    expect(recordProblems({ ...keep(), ["n\u{202E}x"]: 1 })).toContain(
      'field "n\\u{202E}x"'
    );
    expect(recordProblems(keep({ pick: "c\u{202E}2" as "keep" }))[0]).toMatch(
      /^pick "c\\u\{202E\}2" is not/
    );
    expect(exportProblems({ ...envelope([]), ["\u{1B}x"]: 1 })).toContain(
      'field "\\u{1B}x"'
    );
    const key = apply(files(), envelope([keep({ key: "TIT.1.4-4\u{202E}" })]));
    expect(key.problems).toEqual([
      'reviewer:reader-7 record 0 (en~"TIT.1.4-4\\u{202E}"): key',
    ]);
    // The translation gates name a stray run of the wording; it is escaped.
    printable(
      apply(files(), envelope([change("بولس \u{202E}abc", { lang: "ar" })]))
        .problems
    );
  });
});

describe("line and paragraph separators", () => {
  it("are spaces in a note, and refused in wording", () => {
    const note = "one\u{2028}two\u{2029}three\u{85}four";
    const r = apply(
      files(),
      envelope([change("Paul greets his son", { note })])
    );
    expect(r.changed.get("en/TIT")!.titles["TIT.1.4-4"]!.review?.why).toBe(
      "one two three four"
    );
    for (const text of [
      "Paul greets\u{2028}his son",
      "Paul greets\u{2029}his son",
      "Paul greets\u{7}his son",
    ])
      expect(apply(files(), envelope([change(text)])).problems[0]).toMatch(
        /control or separator character/
      );
  });
});

describe("apply.ts on the command line", () => {
  // The library tests above hand applyReviews the English table themselves;
  // only a run of the script shows that it loads data/titles/en/ and passes
  // it on. A temporary copy of the repo's layout, so nothing real is touched.
  const repo = new URL("../", import.meta.url);
  const english = (
    JSON.parse(
      readFileSync(new URL("data/titles/en/TIT.json", repo), "utf8")
    ) as { titles: Record<string, { text: string }> }
  ).titles["TIT.P.1.1-4"]!.text;
  const run = (records: Answer[]) => {
    const dir = mkdtempSync(join(tmpdir(), "bp-review-"));
    cpSync(new URL("scripts/", repo), join(dir, "scripts"), {
      recursive: true,
    });
    copyFileSync(new URL("package.json", repo), join(dir, "package.json"));
    symlinkSync(
      fileURLToPath(new URL("node_modules", repo)),
      join(dir, "node_modules"),
      "dir"
    );
    mkdirSync(join(dir, "data/titles/en"), { recursive: true });
    copyFileSync(
      new URL("data/titles/en/TIT.json", repo),
      join(dir, "data/titles/en/TIT.json")
    );
    mkdirSync(join(dir, "data/drafts/ar"), { recursive: true });
    const drafts = JSON.stringify({
      language: "ar",
      book: "TIT",
      titles: { "TIT.P.1.1-4": draft("تحية بولس") },
    });
    writeFileSync(join(dir, "data/drafts/ar/TIT.json"), drafts);
    const exported = join(dir, "export.json");
    writeFileSync(exported, JSON.stringify(envelope(records)));
    const r = spawnSync(
      process.execPath,
      [join(dir, "scripts/review/apply.ts"), exported, "--dry-run"],
      { encoding: "utf8" }
    );
    const after = readFileSync(join(dir, "data/drafts/ar/TIT.json"), "utf8");
    return { ...r, untouched: after === drafts };
  };
  const pericope = (text: string) =>
    change(text, { lang: "ar", key: "TIT.P.1.1-4" });

  it("gates a translated pericope against the built English table", () => {
    const ok = run([pericope("تحية بولس إلى تيطس")]);
    expect(ok.stderr).toBe("");
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain("Dry run; nothing written.");
    expect(ok.stdout).toContain(
      "| ar | TIT.P.1.1-4 | change | reviewer:reader-7 | تحية بولس | تحية بولس إلى تيطس |"
    );
    expect(ok.untouched).toBe(true);
    // A copy of the table's English is refused as a leak, not for want of
    // an English title: the table reached the gate.
    const leak = run([pericope(english)]);
    expect(leak.status).toBe(1);
    expect(leak.stderr).toMatch(/equals the English|outside Arabic/);
    expect(leak.stderr).not.toMatch(/no English title/);
    expect(leak.untouched).toBe(true);
  }, 30_000);
});
