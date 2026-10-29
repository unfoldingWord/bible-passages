import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALL_BOOKS } from "../scripts/lib/books.ts";
import {
  ARTICLE,
  buildGlossary,
  GLOSSARY_BOOKS,
  headword,
  inScript,
  isGlossaryInput,
  linkedArticles,
  parseTwl,
  refOf,
  TW,
  TWL,
  TWL_BOOKS,
  TWL_UNRELEASED,
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

  it("reads a psalm superscription as the chapter's front, before verse 1", () => {
    const tsv = [
      HEAD,
      row("3:1", "names/david"),
      row("3:front", "names/david"),
      row("2:12", "names/david"),
    ];
    const rows = parseTwl(tsv.join("\n"));
    expect(rows[1]).toEqual({ chapter: 3, verse: 0, article: "names/david" });
    expect(rows.map(refOf)).toEqual(["3:1", "3:front", "2:12"]);
    expect(linkedArticles(rows).get("names/david")).toEqual([
      "2:12",
      "3:front",
      "3:1",
    ]);
  });

  it("refuses a row it cannot read", () => {
    expect(() =>
      parseTwl([HEAD, row("front:intro", "kt/god")].join("\n"))
    ).toThrow(/line 2/);
    expect(() => parseTwl([HEAD, row("1:1", "kt/../god")].join("\n"))).toThrow(
      /line 2/
    );
    expect(() => parseTwl([HEAD, row("1:0", "kt/god")].join("\n"))).toThrow(
      /line 2/
    );
    expect(() => parseTwl([HEAD, row("front:1", "kt/god")].join("\n"))).toThrow(
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
    // Xenizo/fr_tw other/perseverance repeats the marker.
    ["# # persévérer, persévérance\n", "persévérer, persévérance"],
    ["## # word # #\n", "word"],
  ])("reads %j", (md, word) => {
    expect(headword(md)).toBe(word);
  });

  it("refuses an article that does not open with a heading", () => {
    expect(() => headword("God\n")).toThrow(/heading/);
    expect(() => headword("#\n")).toThrow(/heading/);
  });
});

describe("inScript", () => {
  const arabic = /\p{Script=Arabic}/u;
  it.each([
    ["إيمان", true],
    ["الله، إله", true],
    // A short English gloss beside the native word: still mostly Arabic.
    ["إيمان، تصديق (faith)", true],
    // Five letters each side: a tie, so not in the script.
    ["إيمان (faith)", false],
    ["faith", false],
    // One letter of the script used to be enough; it no longer is.
    ["faith إ", false],
    // Exactly half is not a majority.
    ["ab بت", false],
    ["", false],
    ["1:1 —", false],
  ])("%j → %s", (word, expected) => {
    expect(inScript(word, arabic)).toBe(expected);
  });

  it("counts letters, not vowel signs or other marks", () => {
    // नि is a letter and a vowel sign; दो likewise: 3 letters, all Devanagari.
    expect(inScript("निर्दोष", /\p{Script=Devanagari}/u)).toBe(true);
    // Two Latin letters against two Devanagari letters with their signs.
    expect(inScript("ab नि दो", /\p{Script=Devanagari}/u)).toBe(false);
  });
});

describe("twId", () => {
  it("writes a plain slug, an underscore as a double hyphen", () => {
    expect(twId("pt-BR", "kt/god")).toBe("tw-pt-br-kt-god");
    expect(twId("fr", "other/bear-witness_testify")).toBe(
      "tw-fr-other-bear-witness--testify"
    );
    // Distinct from a name with a hyphen there, if one is ever added.
    expect(twId("fr", "other/bear-witness-testify")).not.toBe(
      twId("fr", "other/bear-witness_testify")
    );
  });

  it("reads TWL links with an underscore in the article name", () => {
    expect(
      parseTwl([HEAD, row("1:1", "other/house-descendants_nation")].join("\n"))
    ).toEqual([
      { chapter: 1, verse: 1, article: "other/house-descendants_nation" },
    ]);
  });
});

describe("isGlossaryInput", () => {
  it.each([
    "twl-en-tit",
    "twl-en-1co",
    "tw-en-kt-god",
    "tw-ar-names-titus",
    "tw-es-419-other-age-timeperiod",
    "tw-pt-br-kt-bornagain",
    "tw-fr-other-bear-witness--testify",
  ])("claims %s", (id) => {
    expect(isGlossaryInput(id)).toBe(true);
  });

  it.each([
    "bsb-tit",
    "ufw-vrs",
    "ufw-chunks-tit",
    "twl-fr-tit",
    "twl-en-titus",
    "twl-en-tit-v2",
    "tw-en",
    "tw-en-god",
    "tw-notes-tit",
    "tw-en-misc-god",
    "tw-en-kt-",
    "twx-en-kt-god",
    "tw-en-other-bear---witness",
    "tw-en-other-bear-witness_testify",
  ])("leaves %s alone", (id) => {
    expect(isGlossaryInput(id)).toBe(false);
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
  const credit = (id: string) => ({
    licence: "CC-BY-SA-4.0",
    attribution: id.startsWith("twl-") ? "TWL" : `tW ${id.split("-")[1]}`,
  });
  const repo = (over: Partial<TwRepo> = {}): TwRepo => ({
    language: "ar",
    door43: "ar",
    repo: "o/ar_tw",
    release: "v1",
    commit: "c",
    absent: [],
    ...over,
  });

  it("maps each linked article to its headword, verses in order", async () => {
    const g = await buildGlossary(
      repo({ absent: ["kt/faith"] }),
      "TIT",
      rows,
      english,
      async (a) =>
        ({ "kt/god": "# الله، إله\n", "names/titus": "# تيطس\n" })[a],
      credit
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
    expect(g.licence).toBe("CC-BY-SA-4.0");
    // The TWL file, then this language's tW, then English tW for `en`.
    expect(g.attribution).toEqual(["TWL", "tW ar", "tW en"]);
  });

  it("refuses sources under more than one licence", async () => {
    await expect(
      buildGlossary(
        repo({ absent: ["kt/faith"] }),
        "TIT",
        rows,
        english,
        async (a) => (a === "kt/faith" ? undefined : "# كلمة\n"),
        (id) => ({
          licence: id.startsWith("twl-") ? "CC-BY-SA-4.0" : "CC-BY-4.0",
          attribution: id,
        })
      )
    ).rejects.toThrow(/2 licences/);
  });

  it("records an English headword in a non-Latin language as a gap", async () => {
    const g = await buildGlossary(
      repo({ script: /\p{Script=Arabic}/u }),
      "TIT",
      rows,
      english,
      async (a) =>
        a === "kt/faith"
          ? "# faith\n"
          : a === "kt/god"
            ? "# god إ\n"
            : "# كلمة\n",
      credit
    );
    // `kt/god` has one Arabic letter of five: English, so a gap.
    expect(g.gaps).toEqual({
      "kt/faith": "english-headword",
      "kt/god": "english-headword",
    });
    expect(Object.keys(g.terms)).toEqual(["names/titus"]);
  });

  it("credits only the TWL file when every article is a gap", async () => {
    const g = await buildGlossary(
      repo({ script: /\p{Script=Arabic}/u }),
      "TIT",
      rows,
      english,
      async () => "# faith\n",
      credit
    );
    expect(g.attribution).toEqual(["TWL"]);
  });

  it("refuses an article neither pinned nor listed absent", async () => {
    await expect(
      buildGlossary(
        repo(),
        "TIT",
        rows,
        english,
        async (a) => (a === "kt/faith" ? undefined : "# x\n"),
        credit
      )
    ).rejects.toThrow(/neither/);
  });

  it("refuses an article both pinned and listed absent", async () => {
    await expect(
      buildGlossary(
        repo({ absent: ["kt/god"] }),
        "TIT",
        rows,
        english,
        async () => "# x\n",
        credit
      )
    ).rejects.toThrow(/both/);
  });

  it("ignores an absent entry this book does not link", async () => {
    // The absent list is per release, measured over every book: an article
    // another book links is no gap here.
    const g = await buildGlossary(
      repo({ absent: ["kt/love"] }),
      "TIT",
      rows,
      english,
      async () => "# كلمة\n",
      credit
    );
    expect(g.gaps).toEqual({});
    expect(Object.keys(g.terms)).toHaveLength(3);
  });
});

const pins = new Map(sources().map((s) => [s.id, s]));

describe("book lists", () => {
  it("splits ALL_BOOKS into TWL_BOOKS and TWL_UNRELEASED, in order", () => {
    const all = ALL_BOOKS.map(([b]) => b);
    expect(TWL_UNRELEASED.every((b) => all.includes(b))).toBe(true);
    expect(TWL_BOOKS).toEqual(all.filter((b) => !TWL_UNRELEASED.includes(b)));
    // As measured in en_twl v91's git tree (docs/scoping/glossaries.md).
    expect(TWL_BOOKS).toHaveLength(59);
  });

  it("builds glossaries only for books the TWL release has", () => {
    for (const b of GLOSSARY_BOOKS) expect(TWL_BOOKS).toContain(b);
    expect(new Set(GLOSSARY_BOOKS).size).toBe(GLOSSARY_BOOKS.length);
  });
});

describe("absent lists", () => {
  it.each(TW.map((r) => [r.language, r] as const))(
    "%s: sorted, unique tW article paths",
    (_, repo) => {
      for (const a of repo.absent) expect(a).toMatch(ARTICLE);
      expect([...repo.absent]).toEqual([...new Set(repo.absent)].sort());
    }
  );

  it("pins no article a language lists as absent", () => {
    for (const repo of TW) {
      for (const a of repo.absent) {
        expect(pins.has(twId(repo.language, a))).toBe(false);
      }
    }
  });
});

const dir = new URL("../data/glossaries/", import.meta.url);
const read = (lang: string, book: string): Glossary =>
  JSON.parse(readFileSync(new URL(`${lang}/${book}.json`, dir), "utf8"));

describe("data/glossaries", () => {
  it("has one directory per configured language and nothing else", () => {
    const langs = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    expect(langs).toEqual(TW.map((r) => r.language).sort());
    for (const lang of langs) {
      expect(readdirSync(new URL(`${lang}/`, dir)).sort()).toEqual(
        GLOSSARY_BOOKS.map((b) => `${b}.json`).sort()
      );
    }
  });

  describe.each(GLOSSARY_BOOKS)("%s", (book) => {
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
          "licence",
          "attribution",
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

        // Licence and attribution are those of the pins the content comes
        // from: the TWL file, this language's tW and English tW.
        const drawn = [
          twlId(book),
          ...Object.keys(g.terms).flatMap((a) => [
            twId(lang, a),
            twId("en", a),
          ]),
        ].map((id) => pins.get(id));
        expect(g.licence).toBe("CC-BY-SA-4.0");
        for (const p of drawn) expect(p?.licence).toBe(g.licence);
        expect(g.attribution).toEqual([
          ...new Set(drawn.map((p) => p?.attribution)),
        ]);

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
          if (repo.script) {
            expect(inScript(term.headword, repo.script)).toBe(true);
          }
        }
        for (const [article, gap] of Object.entries(g.gaps)) {
          const absent = repo.absent.includes(article);
          expect(gap).toBe(absent ? "no-article" : "english-headword");
          if (gap === "english-headword") {
            expect(repo.script).toBeDefined();
            if (repo.script) {
              const md = await readSource(twId(lang, article));
              expect(inScript(headword(md), repo.script)).toBe(false);
            }
          }
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
    for (const book of GLOSSARY_BOOKS) {
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
    const glossaryPins = [...pins.keys()].filter(isGlossaryInput);
    expect(glossaryPins.sort()).toEqual([...used].sort());
  });

  it("keeps Persian-only letters out of the Arabic glossary", () => {
    // ar_gt/ar_tw, tagged ar on Door43, is written with Persian letters
    // (docs/scoping/glossaries.md); this guards against it creeping back in.
    for (const book of GLOSSARY_BOOKS) {
      for (const t of Object.values(read("ar", book).terms)) {
        expect(t.headword).not.toMatch(/[پچژکگی]/);
      }
    }
  });
});
