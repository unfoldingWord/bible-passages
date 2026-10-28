import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BOOKS } from "../scripts/lib/books.ts";
import {
  ARTICLE,
  buildGlossary,
  headword,
  linkedArticles,
  parseTwl,
  TW,
  TWL,
  twId,
  twlId,
  twlUrl,
  twUrl,
  type Glossary,
  type TwRepo,
} from "../scripts/lib/glossaries.ts";
import { readSource, sources } from "../scripts/lib/sources.ts";

// data/glossaries/<lang>/<BOOK>.json, built by scripts/data/glossaries.ts.
// See docs/scoping/glossaries.md.

const HEAD = "Reference\tID\tTags\tOrigWords\tOccurrence\tTWLink";
const row = (ref: string, article: string) =>
  `${ref}\tx\t\tλόγος\t1\trc://*/tw/dict/bible/${article}`;

describe("parseTwl", () => {
  it("reads the reference and the linked article of each row", () => {
    const tsv = [HEAD, row("1:2", "kt/god"), row("3:15", "names/paul"), ""];
    expect(parseTwl(tsv.join("\n"))).toEqual([
      { chapter: 1, verse: 2, article: "kt/god" },
      { chapter: 3, verse: 15, article: "names/paul" },
    ]);
  });

  it("refuses a row it cannot read", () => {
    expect(() =>
      parseTwl([HEAD, row("front:intro", "kt/god")].join("\n"))
    ).toThrow(/line 2/);
    expect(() => parseTwl([HEAD, row("1:1", "kt/../god")].join("\n"))).toThrow(
      /line 2/
    );
  });

  it("refuses a file without the columns it needs", () => {
    expect(() => parseTwl("Reference\tID\n1:1\tx")).toThrow(/column/);
  });
});

describe("headword", () => {
  it.each([
    ["# God\n\n## Definition:", "God"],
    ["﻿﻿# निर्दोष \n", "निर्दोष"],
    ["#menegur, memperingatkan\n", "menegur, memperingatkan"],
    ["## baik, benar\n", "baik, benar"],
    ["# पौलुस, शाऊल #\n", "पौलुस, शाऊल"],
    ["\r\n#  Paul,   Saul \r\n", "Paul, Saul"],
  ])("reads %j", (md, word) => {
    expect(headword(md)).toBe(word);
  });

  it("refuses an article that does not open with a heading", () => {
    expect(() => headword("God\n")).toThrow(/heading/);
    expect(() => headword("#\n")).toThrow(/heading/);
  });
});

describe("buildGlossary", () => {
  const rows = parseTwl(
    [
      HEAD,
      row("1:4", "names/titus"),
      row("1:1", "kt/god"),
      row("1:1", "kt/god"),
      row("2:1", "kt/faith"),
    ].join("\n")
  );
  const english = async (a: string) => `# ${a.split("/")[1]}\n`;
  const repo = (over: Partial<TwRepo> = {}): TwRepo => ({
    language: "ar",
    door43: "ar",
    repo: "o/ar_tw",
    release: "v1",
    commit: "c",
    absent: { TIT: [] },
    ...over,
  });

  it("maps each linked article to its headword, verses in order", async () => {
    const g = await buildGlossary(
      repo({ absent: { TIT: ["kt/faith"] } }),
      "TIT",
      rows,
      english,
      async (a) => ({ "kt/god": "# الله، إله\n", "names/titus": "# تيطس\n" })[a]
    );
    expect(g.terms).toEqual({
      "kt/god": {
        en: "god",
        headword: "الله، إله",
        source: "tw-ar-kt-god",
        refs: ["1:1"],
      },
      "names/titus": {
        en: "titus",
        headword: "تيطس",
        source: "tw-ar-names-titus",
        refs: ["1:4"],
      },
    });
    expect(g.gaps).toEqual({ "kt/faith": "no-article" });
  });

  it("records an English headword in a non-Latin language as a gap", async () => {
    const g = await buildGlossary(
      repo({ script: /\p{Script=Arabic}/u }),
      "TIT",
      rows,
      english,
      async (a) => (a === "kt/faith" ? "# faith\n" : "# كلمة\n")
    );
    expect(g.gaps).toEqual({ "kt/faith": "english-headword" });
    expect(Object.keys(g.terms)).toEqual(["kt/god", "names/titus"]);
  });

  it("refuses an article neither pinned nor listed absent", async () => {
    await expect(
      buildGlossary(repo(), "TIT", rows, english, async (a) =>
        a === "kt/faith" ? undefined : "# x\n"
      )
    ).rejects.toThrow(/neither/);
  });

  it("refuses an article both pinned and listed absent", async () => {
    await expect(
      buildGlossary(
        repo({ absent: { TIT: ["kt/god"] } }),
        "TIT",
        rows,
        english,
        async () => "# x\n"
      )
    ).rejects.toThrow(/both/);
  });

  it("refuses an absent entry the book does not link", async () => {
    await expect(
      buildGlossary(
        repo({ absent: { TIT: ["kt/love"] } }),
        "TIT",
        rows,
        english,
        async () => "# x\n"
      )
    ).rejects.toThrow(/unlinked/);
  });
});

const dir = new URL("../data/glossaries/", import.meta.url);
const read = (lang: string, book: string): Glossary =>
  JSON.parse(readFileSync(new URL(`${lang}/${book}.json`, dir), "utf8"));
const pins = new Map(sources().map((s) => [s.id, s]));

describe("data/glossaries", () => {
  it("has one directory per configured language and nothing else", () => {
    const langs = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    expect(langs).toEqual(TW.map((r) => r.language).sort());
    for (const lang of langs) {
      expect(readdirSync(new URL(`${lang}/`, dir)).sort()).toEqual(
        BOOKS.map((b) => `${b}.json`).sort()
      );
    }
  });

  describe.each(BOOKS)("%s", (book) => {
    // The one network read in the tests: the pinned TWL file, checked
    // against its SHA-256 by readSource, so each glossary is traced to it.
    const linked = readSource(twlId(book)).then((tsv) =>
      linkedArticles(parseTwl(tsv))
    );

    it.each(TW.map((r) => [r.language, r] as const))(
      "%s traces every term to a TWL row and a pinned article",
      async (lang, repo) => {
        const g = read(lang, book);
        const links = await linked;
        expect(Object.keys(g)).toEqual([
          "language",
          "book",
          "links",
          "words",
          "terms",
          "gaps",
        ]);
        expect(g.language).toBe(lang);
        expect(g.book).toBe(book);
        expect(g.links).toBe(twlId(book));
        expect(g.words).toEqual({
          repo: repo.repo,
          release: repo.release,
          commit: repo.commit,
        });

        // Every linked article is a term or a gap, never both, never neither.
        const keys = [...Object.keys(g.terms), ...Object.keys(g.gaps)].sort();
        expect(keys).toEqual([...links.keys()].sort());

        for (const [article, term] of Object.entries(g.terms)) {
          expect(article).toMatch(ARTICLE);
          expect(term.refs).toEqual(links.get(article));
          expect(term.headword.trim()).not.toBe("");
          expect(term.headword).toBe(term.headword.normalize("NFC"));
          expect(term.en.trim()).not.toBe("");
          expect(term.source).toBe(twId(lang, article));
          const pin = pins.get(term.source);
          expect(pin?.url).toBe(twUrl(repo, article));
          expect(pin?.revision).toBe(repo.commit);
          expect(pin?.licence).toBe("CC-BY-SA-4.0");
          if (repo.script) expect(term.headword).toMatch(repo.script);
        }
        for (const [article, gap] of Object.entries(g.gaps)) {
          const absent = repo.absent[book]?.includes(article);
          expect(gap).toBe(absent ? "no-article" : "english-headword");
          if (gap === "english-headword") expect(repo.script).toBeDefined();
        }
      }
    );

    it("pins the TWL file at the configured commit", () => {
      const pin = pins.get(twlId(book));
      expect(pin?.url).toBe(twlUrl(book));
      expect(pin?.revision).toBe(TWL.commit);
    });
  });

  it("pins no glossary input the build does not use", () => {
    const used = new Set<string>();
    for (const book of BOOKS) {
      used.add(twlId(book));
      for (const repo of TW) {
        for (const t of Object.values(read(repo.language, book).terms)) {
          used.add(t.source);
        }
        // An English headword is still read, so its pin is used.
        for (const [a, gap] of Object.entries(read(repo.language, book).gaps)) {
          if (gap === "english-headword") used.add(twId(repo.language, a));
        }
      }
    }
    const glossaryPins = [...pins.keys()].filter(
      (id) => id.startsWith("tw-") || id.startsWith("twl-")
    );
    expect(glossaryPins.sort()).toEqual([...used].sort());
  });

  it("keeps Persian-only letters out of the Arabic glossary", () => {
    // ar_gt/ar_tw, tagged ar on Door43, is written with Persian letters
    // (docs/scoping/glossaries.md); this guards against it creeping back in.
    for (const book of BOOKS) {
      for (const t of Object.values(read("ar", book).terms)) {
        expect(t.headword).not.toMatch(/[پچژکگی]/);
      }
    }
  });
});
