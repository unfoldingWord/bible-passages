import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, type Dirent } from "node:fs";
import { fileURLToPath } from "node:url";
import { assert, describe, expect, it } from "vitest";
import {
  linkedArticles,
  parseTwl,
  twId,
  twlId,
  type Credit,
  type TwlRow,
} from "../scripts/lib/glossaries.ts";
import {
  assertBuiltTerms,
  buildDraftGlossary,
  checkMessage,
  definition,
  draftKeyTerms,
  DRAFT_LANGUAGES,
  draftMessage,
  assertNamesText,
  gateProblems,
  namesId,
  namesProblem,
  parseFia,
  promptPart,
  readCheck,
  readDraft,
  reviewProblems,
  statusOf,
  type Complete,
  type DraftGlossary,
  type DraftRecord,
  type TermInput,
} from "../scripts/lib/key-terms.ts";
import { verseTexts } from "../scripts/lib/cuv.ts";
import { FORMAT_ALLOWED } from "../scripts/lib/format.ts";
import { SCRIPT_BY_TAG } from "../scripts/lib/gates.ts";
import type { Completion } from "../scripts/lib/openrouter.ts";
import { readSource, source, sources } from "../scripts/lib/sources.ts";
import { sha256 } from "../scripts/lib/translate.ts";

// AI-drafted key-term glossaries (zh-Hans): scripts/lib/key-terms.ts and
// docs/scoping/glossaries.md, "Chinese (zh-Hans)".

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const HAN = /\p{Script=Han}/u;
// zh-Hans as gateProblems sees it: Han, with no format character allowed.
const ZH = { script: HAN, formatAllowed: "" };
const KEY = "test-key-not-real-0000";

// The message `fn` throws, compared whole: toThrow(string) only matches a
// substring, so a message with something extra would pass it.
function thrown(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    // Anything other than an Error is rethrown as it was, not read as one.
    if (e instanceof Error) return e.message;
    throw e;
  }
  throw new Error("expected a throw");
}

// The English headword the build is given for article `a`, read from the
// book's English glossary as parsed JSON. It must be a non-empty string; if
// not, the error says why: no glossary, no term, or a headword that is
// missing, blank or of another runtime type.
function englishHeadword(en: unknown, a: string): string {
  const fail = (why: string) => {
    throw new Error(`en: no headword for ${a} (${why})`);
  };
  const isObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  // The runtime type, naming null and arrays, which typeof calls "object".
  const kind = (v: unknown) =>
    v === null ? "null" : Array.isArray(v) ? "array" : typeof v;
  // The same, with its article: "an array", "a number"; null has none.
  const aKind = (v: unknown) => {
    const k = kind(v);
    return k === "null" ? k : /^[aeiou]/.test(k) ? `an ${k}` : `a ${k}`;
  };
  if (!isObject(en)) return fail(`no glossary: ${kind(en)}`);
  const terms = en.terms;
  if (!isObject(terms)) return fail("glossary has no terms");
  const term = Object.hasOwn(terms, a) ? terms[a] : undefined;
  if (!isObject(term)) return fail("term not in the glossary");
  const word = term.headword;
  if (word === undefined) return fail("headword missing");
  if (typeof word !== "string") return fail(`headword is ${aKind(word)}`);
  if (word.trim() === "") return fail("headword blank");
  return word;
}

describe("englishHeadword (the English lookup the record test gives the build)", () => {
  const g = (term: unknown) => ({ terms: { "kt/apostle": term } });
  const cases: [string, unknown, string][] = [
    ["a null glossary", null, "no glossary: null"],
    ["a glossary that is not an object", "x", "no glossary: string"],
    ["a glossary that is an array", [], "no glossary: array"],
    ["a glossary with no terms", {}, "glossary has no terms"],
    ["a missing term", { terms: {} }, "term not in the glossary"],
    ["a null term", g(null), "term not in the glossary"],
    ["a missing headword", g({}), "headword missing"],
    ["a null headword", g({ headword: null }), "headword is null"],
    ["an empty headword", g({ headword: "" }), "headword blank"],
    ["a blank headword", g({ headword: "  " }), "headword blank"],
    ["a number", g({ headword: 0 }), "headword is a number"],
    ["an array", g({ headword: ["apostle"] }), "headword is an array"],
    ["an object", g({ headword: {} }), "headword is an object"],
  ];
  it.each(cases)("refuses %s, saying why", (_name, en, why) => {
    expect(thrown(() => englishHeadword(en, "kt/apostle"))).toBe(
      `en: no headword for kt/apostle (${why})`
    );
  });
  it("returns a headword that is non-empty text", () => {
    expect(englishHeadword(g({ headword: "apostle" }), "kt/apostle")).toBe(
      "apostle"
    );
  });
  it("does not read an inherited property as a term", () => {
    expect(thrown(() => englishHeadword({ terms: {} }, "toString"))).toBe(
      "en: no headword for toString (term not in the glossary)"
    );
  });
});

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
    const g = (headword: string) => gateProblems({ headword }, ZH, []);
    expect(g("使徒、使徒职分")).toEqual([]);
    expect(g("Titus")).toEqual(["script", "latin-letters"]);
    expect(g("革哩底 (Crete)")).toEqual(["script", "latin-letters"]);
    expect(g("提多T")).toEqual(["latin-letters"]);
    expect(g("使徒\n长老")).toEqual(["line-break"]);
  });

  it("flags format characters, which trim and NFC leave in place", () => {
    const g = (headword: string) => gateProblems({ headword }, ZH, []);
    // Zero-width space, joiner and non-joiner, soft hyphen, a bidi mark, an
    // override and an isolate: each invisible, each \p{Cf}.
    for (const headword of [
      "长者\u{200B}",
      "长\u{200D}者",
      "长\u{200C}者",
      "长\u{00AD}者",
      "长者\u{200E}",
      "\u{202E}长者",
      "\u{2067}长者\u{2069}",
    ]) {
      expect(headword.trim().normalize("NFC"), headword).toBe(headword);
      expect(g(headword), headword).toEqual(["format"]);
    }
  });

  // #165: invisible characters the #155 gate did not see. Each is inside the
  // headword, where trim does not reach, and survives NFC.
  it("flags every line break, U+2028 and U+2029 included", () => {
    const g = (headword: string) => gateProblems({ headword }, ZH, []);
    for (const headword of [
      "长\u{2028}者",
      "长\u{2029}者",
      "长\u{000B}者",
      "长\u{000C}者",
      "长\u{0085}者",
    ]) {
      expect(headword.trim().normalize("NFC"), headword).toBe(headword);
      expect(g(headword), headword).toEqual(["line-break"]);
    }
  });

  // #179: the file, group and record separators are controls, not
  // mandatory breaks (see scripts/lib/line-breaks.ts), so they are refused
  // as `format`.
  it("flags U+001C..U+001E as format, not line-break", () => {
    for (const headword of ["长\u{1C}者", "长\u{1D}者", "长\u{1E}者"])
      expect(gateProblems({ headword }, ZH, []), headword).toEqual(["format"]);
  });

  it("flags invisible characters that are not \\p{Cf}", () => {
    const g = (headword: string) => gateProblems({ headword }, ZH, []);
    // The combining grapheme joiner (Mn), a variation selector, an
    // ideographic variation selector, a Hangul filler: default-ignorable,
    // not Cf. NUL and a tab: controls (Cc).
    for (const headword of [
      "长\u{034F}者",
      "长\u{FE0F}者",
      "长\u{E0100}者",
      "长\u{3164}者",
      "长\u{0000}者",
      "长\u{0009}者",
    ]) {
      expect(headword.trim().normalize("NFC"), headword).toBe(headword);
      expect(g(headword), headword).toEqual(["format"]);
    }
  });

  it("keeps the combining marks a script writes with", () => {
    const as = (script: RegExp) => ({ script, formatAllowed: "" });
    const g = (headword: string, script: RegExp) =>
      gateProblems({ headword }, as(script), []);
    // An Arabic shadda, a Devanagari virama, a Greek acute (U+0301).
    expect(g("رَبّ", /\p{Script=Arabic}/u)).toEqual([]);
    expect(g("क्षमा", /\p{Script=Devanagari}/u)).toEqual([]);
    expect(g("α\u{0301}γιος", /\p{Script=Greek}/u)).toEqual([]);
  });

  it("allows only the format characters the language allows", () => {
    const arabic = /\p{Script=Arabic}/u;
    const fa = { script: arabic, formatAllowed: "\u{200C}\u{06DD}" };
    const none = { script: arabic, formatAllowed: "" };
    // Persian "I want", written with a ZWNJ; and an end-of-ayah sign.
    for (const headword of ["می\u{200C}خواهم", "آیه\u{06DD}"]) {
      expect(gateProblems({ headword }, fa, []), headword).toEqual([]);
      expect(gateProblems({ headword }, none, []), headword).toEqual([
        "format",
      ]);
    }
    // Allowing ZWNJ allows nothing else.
    for (const headword of ["می\u{200B}خواهم", "می\u{200D}خواهم"])
      expect(gateProblems({ headword }, fa, []), headword).toEqual(["format"]);
    // A supplementary-plane character is allowed by code point: allowing the
    // ideographic variation selector U+E0100 allows it, and not U+E0101.
    const ivs = { script: HAN, formatAllowed: "\u{E0100}" };
    expect(gateProblems({ headword: "葛\u{E0100}" }, ivs, [])).toEqual([]);
    expect(gateProblems({ headword: "葛\u{E0101}" }, ivs, [])).toEqual([
      "format",
    ]);
    // zh-Hans allows none.
    expect(gateProblems({ headword: "长\u{200C}者" }, ZH, [])).toEqual([
      "format",
    ]);
  });

  it("flags a headword that does not use the rendering of the reference it names", () => {
    const fia = [
      { en: "apostle", term: "使徒" },
      { en: "Lord", term: "主、耶和华" },
    ];
    const g = (headword: string, reference: string) =>
      gateProblems({ headword, reference }, ZH, fia);
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
    expect(gateProblems({ headword: "差徒" }, ZH, fia)).toEqual([]);
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

  it("is human-reviewed only when a person's review is recorded", () => {
    const review = { by: "reviewer:zh-hans-reader", at: "2026-10-30" };
    const disagree = {
      by: "ai:b",
      verdict: "disagree",
      why: "w",
      suggestion: "s",
    } as const;
    // A person's review outranks the checker and the gates.
    expect(statusOf({ check: disagree, gates: ["reference"], review })).toBe(
      "human-reviewed"
    );
    expect(statusOf({ review })).toBe("human-reviewed");
    expect(statusOf({ review: { ...review, text: "长老" } })).toBe(
      "human-reviewed"
    );
  });

  // reviewProblems' exact messages for these rows are pinned in its own
  // table below; here it is enough that it reports some problem.
  it("is not raised by a malformed review, for which reviewProblems reports problems (#129)", () => {
    const by = "reviewer:zh-hans-reader";
    const at = "2026-10-30";
    const agree = { by: "ai:b", verdict: "agree" } as const;
    const malformed: unknown[] = [
      { by, at: "2026-02-30" },
      { by: "reviewer:A Reader", at },
      { by, at, headword: "长老" },
      { by, at, text: " 长老" },
      null,
    ];
    for (const review of malformed) {
      const a = JSON.stringify(review);
      expect(reviewProblems(review), a).not.toEqual([]);
      expect(statusOf({ review }), a).toBe("unreviewed");
      expect(statusOf({ check: agree, review }), a).toBe("ai-checked");
      // A gated draft falls back to unreviewed, as it would with no review.
      expect(statusOf({ check: agree, gates: ["script"], review }), a).toBe(
        "unreviewed"
      );
    }
  });
});

describe("reviewProblems", () => {
  it("accepts a reviewer role or handle and a calendar date", () => {
    for (const by of ["reviewer:zh-hans-reader", "reviewer:Some-Handle1"])
      expect(reviewProblems({ by, at: "2026-10-30" }), by).toEqual([]);
    // A leap day (#129).
    const by = "reviewer:zh-hans-reader";
    expect(reviewProblems({ by, at: "2024-02-29" })).toEqual([]);
  });

  it("accepts the reviewer's changed headword as text", () => {
    const review = { by: "reviewer:zh-hans-reader", at: "2026-10-30" };
    expect(reviewProblems({ ...review, text: "长老" })).toEqual([]);
  });

  it("refuses a review without a reviewer:<role> or a real date, or with other fields", () => {
    const by = "reviewer:zh-hans-reader";
    const at = "2026-10-30";
    const BY = "review.by is not reviewer:<role or handle>";
    const AT = "review.at is not a date YYYY-MM-DD";
    const TEXT = "review.text is not a trimmed, non-empty NFC headword";
    const REASON = "review.reason is not a trimmed, non-empty NFC sentence";
    const ONLY_TEXT = "review.reason is only for a changed headword (text)";
    const cases: [unknown, string[]][] = [
      [{ at }, [BY]],
      [{ by }, [AT]],
      [{}, [BY, AT]],
      [{ by: "zh-hans-reader", at }, [BY]],
      [{ by: "reviewer:", at }, [BY]],
      // A name with a space is not a role or a handle.
      [{ by: "reviewer:A Reader", at }, [BY]],
      [{ by: "ai:anthropic/check", at }, [BY]],
      [{ by, at: "30 Oct 2026" }, [AT]],
      [{ by, at: "2026-02-30" }, [AT]],
      [{ by, at: "2026-10-30T12:00:00Z" }, [AT]],
      // Not a leap year (#129).
      [{ by, at: "1900-02-29" }, [AT]],
      [
        { by, at, headword: "长老" },
        ["review has fields other than by, at, text and reason (headword)"],
      ],
      // A changed headword is text, as a reworded title is in data/drafts/.
      [{ by, at, text: "" }, [TEXT]],
      [{ by, at, text: " 长老" }, [TEXT]],
      [{ by, at, text: "长老\n" }, [TEXT]],
      [{ by, at, text: 1 }, [TEXT]],
      [{ by, at, text: null }, [TEXT]],
      // Decomposed (NFD), not NFC: the drafted headword is held to NFC.
      [{ by, at, text: "e\u0301" }, [TEXT]],
      [{ at, text: "长老" }, [BY]],
      // A reason explains a changed headword that departs from CUV (2 Nov).
      [{ by, at, text: "长老", reason: "the content team's spelling" }, []],
      [{ by, at, reason: "kept" }, [ONLY_TEXT]],
      [{ by, at, text: "长老", reason: "" }, [REASON]],
      [{ by, at, text: "长老", reason: "   " }, [REASON]],
      [{ by, at, text: "长老", reason: " why" }, [REASON]],
      [{ by, at, text: "长老", reason: 1 }, [REASON]],
      [{ by, at, text: "长老", reason: "e\u0301" }, [REASON]],
      ["reviewer:zh-hans-reader", ["review is not an object"]],
      [null, ["review is not an object"]],
    ];
    for (const [review, problems] of cases)
      expect(reviewProblems(review), JSON.stringify(review)).toEqual(problems);
  });
});

describe("the cuv gate (namesProblem, gateProblems, assertNamesText)", () => {
  const verses: ReadonlyMap<string, string> = new Map([
    ["1:5", "我从前留你在克里特"],
    ["1:12", "有克里特人中的一个本地先知说"],
    ["2:1", "凯撒利亚·腓立比"],
  ]);
  const crete = { article: "names/crete", refs: ["1:5", "1:12"], verses };
  const flag = (headword: string, check = crete, reference?: string) =>
    gateProblems(
      reference === undefined ? { headword } : { headword, reference },
      ZH,
      [{ en: "Crete", term: "革哩底" }],
      check
    );

  it("flags a name CUV does not write at its verses, and passes one it does", () => {
    expect(flag("革哩底、革哩底人")).toEqual(["cuv"]);
    expect(flag("克里特")).toEqual([]);
    // One rendering found at each verse is enough.
    expect(flag("革哩底、克里特")).toEqual([]);
  });

  it("flags a name found at only one of its verses", () => {
    const two = { ...crete, refs: ["1:5", "2:1"] };
    expect(flag("克里特", two)).toEqual(["cuv"]);
  });

  it("reads U+2022 as U+00B7 on both sides", () => {
    const one = { article: "names/caesareaphilippi", refs: ["2:1"], verses };
    expect(flag("凯撒利亚•腓立比", one)).toEqual([]);
  });

  it("skips a term that names an FIA reference, because FIA is binding", () => {
    expect(flag("革哩底", crete, "Crete")).toEqual([]);
  });

  it("does not touch an article that is not a name", () => {
    expect(flag("长者", { ...crete, article: "other/elder" })).toEqual([]);
  });

  it("refuses a verse the names text does not have, and a name with no verses", () => {
    expect(
      thrown(() => flag("克里特", { ...crete, refs: ["1:5", "9:9"] }))
    ).toBe("names/crete: verse 9:9 is not in the names text");
    expect(thrown(() => flag("克里特", { ...crete, refs: [] }))).toBe(
      "names/crete: no verses to check the name against"
    );
    expect(thrown(() => assertNamesText([crete], new Map()))).toBe(
      "names/crete: verse 1:5 is not in the names text"
    );
    // Not a name: its verses are not the names text's business.
    expect(() =>
      assertNamesText([{ article: "kt/god", refs: ["9:9"] }], new Map())
    ).not.toThrow();
  });

  it("does not count a name that occurs only in a footnote or cross-reference", () => {
    const usfm = [
      "\\c 1",
      "\\v 5 我从前留你\\f + \\fr 1:5 \\ft 克里特\\f*在那里。",
      "\\v 12 有人说\\x - \\xo 1:12 \\xt 克里特\\x*。",
    ].join("\n");
    const notes = { ...crete, verses: verseTexts(usfm) };
    expect(flag("克里特", notes)).toEqual(["cuv"]);
  });

  it("flags Crete and passes the other four Titus names on the pinned inputs", async () => {
    const tit = verseTexts(await readSource("zh-cuv-tit"));
    const links = linkedArticles(parseTwl(await readSource(twlId("TIT"))));
    const record = JSON.parse(
      read("data/glossary-drafts/zh-Hans/TIT.json")
    ) as DraftRecord;
    const flagged = [...links]
      .filter(([a]) => {
        const t = record.terms[a];
        return (
          t && namesProblem(t, { article: a, refs: links.get(a)!, verses: tit })
        );
      })
      .map(([a]) => a);
    expect(flagged).toEqual(["names/crete"]);
    expect([...links.keys()].filter((a) => a.startsWith("names/"))).toEqual([
      "names/apollos",
      "names/crete",
      "names/paul",
      "names/titus",
      "names/tychicus",
    ]);
  });
});

// The names text the `cuv` gate reads in these tests: CUV's spellings.
const cuvVerses: ReadonlyMap<string, string> = new Map([
  ["1:1", "神的仆人，耶稣基督的使徒保罗"],
  ["1:4", "现在写信给提多"],
  ["1:5", "我从前留你在克里特"],
]);

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
    names: cuvVerses,
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
        // Not CUV's 提多 at 1:4 either.
        gates: ["script", "latin-letters", "cuv"],
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

  it("refuses a book with no names pin: zh-cuv-<book> must be in sources.json", () => {
    const zh = DRAFT_LANGUAGES["zh-Hans"]!;
    expect(namesId(zh, "TIT")).toBe("zh-cuv-tit");
    expect(thrown(() => source(namesId(zh, "PHM")))).toBe(
      "zh-cuv-phm is not pinned in sources.json"
    );
  });

  it("refuses a names text without a name's verse, before any call", async () => {
    const { complete, sent } = fakeModels([]);
    await expect(
      run(complete, [], { names: new Map([["1:1", "保罗"]]) })
    ).rejects.toThrow("names/titus: verse 1:4 is not in the names text");
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
      names: cuvVerses,
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

  it("builds a term a person reviewed, keeping its status and review", () => {
    const r = record();
    const review = { by: "reviewer:zh-hans-reader", at: "2026-10-30" };
    // The checker disagreed; the reader accepted the headword as drafted.
    Object.assign(r.terms["other/elder"]!, {
      status: "human-reviewed",
      review,
    });
    const g = build(r);
    expect(g.terms["other/elder"]).toMatchObject({
      headword: "长者",
      source: "ai:google/draft",
      status: "human-reviewed",
      review,
      refs: ["1:5"],
    });
    // The AI check stays on record beside the review.
    expect(g.terms["other/elder"]?.check?.verdict).toBe("disagree");
    expect(g.review).toEqual([]);
    expect(g.terms["kt/apostle"]?.status).toBe("ai-checked");
    expect(g.terms["kt/apostle"]?.review).toBeUndefined();
  });

  describe("a reader's spelling that CUV does not use (the maintainer, 2 Nov, #53)", () => {
    const by = "reviewer:zh-hans-reader";
    const at = "2026-11-02";
    const reason = "the content team's spelling for this book";
    const titus = (term: Partial<DraftRecord["terms"][string]>) => {
      const r = record();
      Object.assign(r.terms["names/titus"]!, term);
      return r;
    };
    const where = "zh-Hans TIT names/titus: ";

    it("is refused without a reason", () => {
      const r = titus({
        status: "human-reviewed",
        review: { by, at, text: "提突" },
      });
      expect(thrown(() => build(r))).toBe(
        where +
          "review.text fails gates (cuv); a spelling CUV does not use needs review.reason"
      );
    });

    it("is accepted with a reason, and the built glossary lists it under departures", () => {
      const review = { by, at, text: "提突", reason };
      const g = build(titus({ status: "human-reviewed", review }));
      expect(g.terms["names/titus"]).toMatchObject({
        headword: "提突",
        source: by,
        drafted: "提多",
        status: "human-reviewed",
        review,
      });
      // Accepted, so no gates on the built term: departures records it.
      expect(g.terms["names/titus"]?.gates).toBeUndefined();
      expect(g.departures).toEqual(["names/titus"]);
      expect(build(record()).departures).toEqual([]);
    });

    it("does not excuse any other gate", () => {
      const r = titus({
        status: "human-reviewed",
        review: { by, at, text: "Titus", reason },
      });
      expect(thrown(() => build(r))).toBe(
        where + "review.text fails gates (script, latin-letters, cuv)"
      );
    });

    it("is refused beside a spelling CUV uses, which needs no reason", () => {
      const r = titus({
        headword: "提突",
        gates: ["cuv"],
        status: "human-reviewed",
        review: { by, at, text: "提多", reason },
      });
      expect(thrown(() => build(r))).toBe(
        where + "review.reason is only for a spelling the cuv gate flags"
      );
    });

    it("may keep a flagged spelling as drafted, with no text and no reason", () => {
      const r = titus({
        headword: "提突",
        gates: ["cuv"],
        status: "human-reviewed",
        review: { by, at },
      });
      const g = build(r);
      expect(g.terms["names/titus"]?.headword).toBe("提突");
      // Kept as drafted: the model's cuv gate stays, and no departure.
      expect(g.terms["names/titus"]?.gates).toEqual(["cuv"]);
      expect(g.departures).toEqual([]);
    });

    it("refuses a record whose flagged name lacks its cuv gate", () => {
      const r = titus({ headword: "提突" });
      expect(thrown(() => build(r))).toBe(
        where + "gates do not match the headword"
      );
    });

    it("refuses a name whose verse the names text lacks", () => {
      const r = record();
      expect(() =>
        buildDraftGlossary({
          record: r,
          file: "data/glossary-drafts/zh-Hans/TIT.json",
          rows,
          english,
          credit,
          prompt: promptText,
          reference: fia,
          names: new Map([["1:1", "保罗"]]),
        })
      ).toThrow("zh-Hans TIT: names/titus: verse 1:4 is not in the names text");
    });
  });

  it("builds a reader's changed headword with the reviewer as source, the record keeping the model's", () => {
    const r = record();
    const by = "reviewer:zh-hans-reader";
    const review = { by, at: "2026-10-30", text: "长老" };
    // The checker disagreed with 长者; the reader changed it to 长老.
    Object.assign(r.terms["other/elder"]!, {
      status: "human-reviewed",
      review,
    });
    // A gated headword the reader changed to one that passes the gate.
    Object.assign(r.terms["kt/apostle"]!, {
      reference: "elder",
      gates: ["reference"],
      status: "human-reviewed",
      review: { ...review, text: "长老" },
    });
    const before = JSON.stringify(r);
    const g = build(r);
    expect(g.terms["other/elder"]).toEqual({
      en: "elder",
      headword: "长老",
      source: by,
      status: "human-reviewed",
      // The checker's verdict stays, with the headword it judged.
      check: r.terms["other/elder"]!.check,
      drafted: "长者",
      review,
      refs: ["1:5"],
    });
    // The gates were the model's headword's; the reader's passes them all.
    expect(g.terms["kt/apostle"]).toMatchObject({
      headword: "长老",
      source: by,
      reference: "elder",
      drafted: "使徒",
    });
    expect(g.terms["kt/apostle"]?.gates).toBeUndefined();
    expect(g.review).toEqual([]);
    // AI output is never relabelled: the record still has the model's
    // headword and source, and an unchanged term keeps them when built.
    expect(JSON.stringify(r)).toBe(before);
    expect(r.terms["other/elder"]).toMatchObject({
      headword: "长者",
      source: "ai:google/draft",
    });
    expect(g.terms["names/titus"]).toMatchObject({
      headword: "提多",
      source: "ai:google/draft",
    });
    expect(g.terms["names/titus"]?.drafted).toBeUndefined();
  });

  describe("refuses human-reviewed without a reviewer and a date, and any status above the evidence", () => {
    const by = "reviewer:zh-hans-reader";
    const at = "2026-10-30";
    const elder = "zh-Hans TIT other/elder: ";
    const apostle = "zh-Hans TIT kt/apostle: ";
    const reviewed =
      (review?: unknown, status = "human-reviewed") =>
      (r: DraftRecord) => {
        Object.assign(r.terms["other/elder"]!, {
          status,
          ...(review === undefined ? {} : { review }),
        });
      };
    const cases: [string, (r: DraftRecord) => void][] = [
      [elder + "human-reviewed with no review (by, at)", reviewed()],
      [elder + "review.by is not reviewer:<role or handle>", reviewed({ at })],
      [elder + "review.at is not a date YYYY-MM-DD", reviewed({ by })],
      [
        elder + "review.by is not reviewer:<role or handle>",
        reviewed({ by: "", at }),
      ],
      [
        elder + "review.at is not a date YYYY-MM-DD",
        reviewed({ by, at: "2026-13-01" }),
      ],
      [
        elder +
          "review has fields other than by, at, text and reason (headword)",
        reviewed({ by, at, headword: "长老" }),
      ],
      // A changed headword: text that is not a headword, no change at all,
      // one that fails a gate, or a change with no reviewed status.
      [
        elder + "review.text is not a trimmed, non-empty NFC headword",
        reviewed({ by, at, text: "" }),
      ],
      [
        elder + "review.text is not a trimmed, non-empty NFC headword",
        reviewed({ by, at, text: "长老 " }),
      ],
      [
        elder + "review.by is not reviewer:<role or handle>",
        reviewed({ at, text: "长老" }),
      ],
      [
        elder +
          "review.text is the drafted headword; leave text out to accept it",
        reviewed({ by, at, text: "长者" }),
      ],
      [
        elder + "review.text fails gates (script, latin-letters)",
        reviewed({ by, at, text: "Elder" }),
      ],
      [
        elder + "review.text fails gates (line-break)",
        reviewed({ by, at, text: "长\n老" }),
      ],
      // The drafted headword with only an invisible character added: no
      // other gate refuses it when the term names no reference, and it
      // would put the reviewer's name on a headword that looks unchanged.
      [
        elder + "review.text fails gates (format)",
        reviewed({ by, at, text: "长者\u{200B}" }),
      ],
      [
        elder + "review.text fails gates (format)",
        reviewed({ by, at, text: "\u{2067}长者\u{2069}" }),
      ],
      // #165: a line or paragraph separator, and a combining grapheme
      // joiner, which the \p{Cf} gate alone did not see.
      [
        elder + "review.text fails gates (line-break)",
        reviewed({ by, at, text: "长\u{2028}者" }),
      ],
      [
        elder + "review.text fails gates (format)",
        reviewed({ by, at, text: "长\u{034F}者" }),
      ],
      [
        apostle + "review.text fails gates (reference)",
        (r) => {
          Object.assign(r.terms["kt/apostle"]!, {
            reference: "elder",
            gates: ["reference"],
            status: "human-reviewed",
            review: { by, at, text: "使者" },
          });
        },
      ],
      [
        elder + "status ai-checked breaks the rules",
        reviewed({ by, at, text: "长老" }, "ai-checked"),
      ],
      // A review recorded without raising the status, or a status above it.
      [
        elder + "status unreviewed breaks the rules",
        reviewed({ by, at }, "unreviewed"),
      ],
      [
        elder + "status ai-checked breaks the rules",
        reviewed({ by, at }, "ai-checked"),
      ],
      [
        elder + "status approved breaks the rules",
        reviewed({ by, at }, "approved"),
      ],
      [
        elder + "status approved breaks the rules",
        reviewed(undefined, "approved"),
      ],
      [
        // The reviewer is named in the review, never as the AI term's source.
        apostle + "source reviewer:zh-hans-reader",
        (r) => {
          r.terms["kt/apostle"]!.source = by;
        },
      ],
      [
        apostle + "source reviewer:zh-hans-reader",
        (r) => {
          Object.assign(r.terms["kt/apostle"]!, {
            source: by,
            status: "human-reviewed",
            review: { by, at },
          });
        },
      ],
      [
        // A change leaves the record's source as the model; the build, not
        // the record, names the reviewer as the source of the new headword.
        // Apart from the source this is a valid change (使徒 to 使者), so
        // the source rule alone refuses it.
        apostle + "source reviewer:zh-hans-reader",
        (r) => {
          Object.assign(r.terms["kt/apostle"]!, {
            source: by,
            status: "human-reviewed",
            review: { by, at, text: "使者" },
          });
        },
      ],
    ];
    it.each(cases)("%#: %s", (message, change) => {
      const r = record();
      change(r);
      expect(thrown(() => build(r))).toBe(message);
    });
  });

  describe("refuses a record that no longer matches its inputs or breaks the rules", () => {
    const tit = "zh-Hans TIT: ";
    const elder = "zh-Hans TIT other/elder: ";
    const apostle = "zh-Hans TIT kt/apostle: ";
    const titus = "zh-Hans TIT names/titus: ";
    const prompt =
      tit + "made with a prompt other than the committed prompts/key-terms.md";
    const cases: [string, (r: DraftRecord) => void][] = [
      [
        tit +
          "the record does not match the TWL (not linked: none; no term: names/titus)",
        (r) => delete r.terms["names/titus"],
      ],
      [
        apostle + 'drafted from "apostles", English tW now says "apostle"',
        (r) => {
          r.terms["kt/apostle"]!.en = "apostles";
        },
      ],
      [
        elder + "status ai-checked breaks the rules",
        (r) => {
          r.terms["other/elder"]!.status = "ai-checked";
        },
      ],
      [
        titus + "gates do not match the headword",
        (r) => {
          r.terms["names/titus"]!.headword = "Titus";
        },
      ],
      [
        // A model's headword with an invisible character, no gate recorded.
        titus + "gates do not match the headword",
        (r) => {
          r.terms["names/titus"]!.headword = "提多\u{200B}";
        },
      ],
      [
        tit + "drafted and checked by the same model",
        (r) => {
          r.calls[1]!.model = "google/draft";
        },
      ],
      [
        tit + "the record needs one draft and one check call",
        (r) => r.calls.pop(),
      ],
      [
        prompt,
        (r) => {
          r.prompt.sha256 = sha256("an older prompt");
        },
      ],
      [
        // The committed prompt's text, filed under another name.
        prompt,
        (r) => {
          r.prompt.file = "prompts/translate-titles.md";
        },
      ],
      [
        tit +
          "the checking model (google/check) must be of a different family from the drafting model (google/draft)",
        (r) => {
          r.calls[1]!.model = "google/check";
          for (const t of Object.values(r.terms))
            if (t.check) t.check = { ...t.check, by: "ai:google/check" };
        },
      ],
      [
        elder + 'reference "presbyter" is not in fia-kt-zhs',
        (r) => {
          r.terms["other/elder"]!.reference = "presbyter";
        },
      ],
      [
        // Names a reference it does not use, with no gate recorded.
        apostle + "gates do not match the headword",
        (r) => {
          r.terms["kt/apostle"]!.reference = "elder";
        },
      ],
      [
        apostle + "checked by ai:other",
        (r) => {
          r.terms["kt/apostle"]!.check = { by: "ai:other", verdict: "agree" };
        },
      ],
    ];
    it.each(cases)("%#: %s", (message, change) => {
      const r = record();
      change(r);
      expect(thrown(() => build(r))).toBe(message);
    });

    it("refuses sources under more than one licence", () => {
      expect(
        thrown(() =>
          build(record(), (id) => ({
            licence: id === "fia-kt-zhs" ? "CC-BY-4.0" : "CC-BY-SA-4.0",
            attribution: id,
          }))
        )
      ).toBe(tit + "sources under 2 licences");
    });
  });
});

describe("assertBuiltTerms", () => {
  const linked = new Map([
    ["kt/apostle", ["1:1"]],
    ["other/elder", ["1:5", "1:6"]],
  ]);
  const record = { "kt/apostle": {}, "other/elder": {} };
  const built = () => ({
    "kt/apostle": { refs: ["1:1"] },
    "other/elder": { refs: ["1:5", "1:6"] },
  });

  it("accepts the record's terms with the TWL's verses", () => {
    expect(() => assertBuiltTerms("w", built(), record, linked)).not.toThrow();
  });

  describe("refuses built terms that drop, add or re-verse a term", () => {
    const cases: [
      string,
      Record<string, { refs: string[] } | undefined>,
      string,
      Record<string, unknown>?,
    ][] = [
      [
        "a term dropped",
        { "kt/apostle": { refs: ["1:1"] } },
        "record -other/elder, TWL -other/elder",
      ],
      [
        "a term added",
        { ...built(), "names/titus": { refs: ["1:4"] } },
        "record +names/titus, TWL +names/titus",
      ],
      [
        "a verse dropped",
        { ...built(), "other/elder": { refs: ["1:5"] } },
        "verses of other/elder",
      ],
      [
        "verses out of order",
        { ...built(), "other/elder": { refs: ["1:6", "1:5"] } },
        "verses of other/elder",
      ],
      [
        "a term with no value",
        { ...built(), "other/elder": undefined },
        "verses of other/elder",
      ],
      // The record must agree with the TWL too.
      [
        "the record short of a term",
        built(),
        "record +other/elder",
        { "kt/apostle": {} },
      ],
    ];
    it.each(cases)("%s", (_name, terms, detail, recordTerms = record) => {
      expect(
        thrown(() => assertBuiltTerms("w", terms, recordTerms, linked))
      ).toBe(`w: the built terms do not match the record and TWL (${detail})`);
    });
  });
});

// Every committed record, whatever its language or book: the build
// (buildDraftGlossary) enforces the invariants; these tests re-derive them
// from the committed files.
//
// Each entry is classed by its own type, not its target's: a symlink is
// classed `symlink` whatever it points to, and so is never a language
// directory or a record.
const kindOf = (e: Dirent) =>
  e.isFile()
    ? "file"
    : e.isDirectory()
      ? "directory"
      : e.isSymbolicLink()
        ? "symlink"
        : "other";
// Every entry of data/glossary-drafts/, listed whatever it is; only real
// directories are read below, and the next test fails by name on the rest.
const languages = readdirSync(new URL("data/glossary-drafts/", root), {
  withFileTypes: true,
}).map((e) => ({ name: e.name, kind: kindOf(e) }));
const files = languages
  .filter((l) => l.kind === "directory")
  .flatMap((l) =>
    readdirSync(new URL(`data/glossary-drafts/${l.name}/`, root), {
      withFileTypes: true,
    }).map((f) => ({ name: `${l.name}/${f.name}`, kind: kindOf(f) }))
  );
// Only regular .json files are parsed below, while the file loads; anything
// else, including a directory or a symlink named *.json, is left to the
// guard test, which fails with its name instead of a parse or read error.
const records = files
  .filter((f) => f.kind === "file" && f.name.endsWith(".json"))
  .map((f) => f.name);

// The draft language named `name`, read only as an own key: a name such as
// "toString" is not a draft language (#144).
const draftLanguage = (name: string) =>
  Object.hasOwn(DRAFT_LANGUAGES, name) ? DRAFT_LANGUAGES[name] : undefined;

it("has only draft-language directories in data/glossary-drafts/", () => {
  for (const { name, kind } of languages) {
    expect(kind, name).toBe("directory");
    expect(Object.hasOwn(DRAFT_LANGUAGES, name), name).toBe(true);
  }
});

it("has only JSON records for draft languages in data/glossary-drafts/", () => {
  for (const { name, kind } of files) {
    expect(name, name).toMatch(/\.json$/);
    expect(kind, name).toBe("file");
    expect(Object.hasOwn(DRAFT_LANGUAGES, name.split("/")[0]!), name).toBe(
      true
    );
  }
});

// #165: the scripts known to need a character the `format` gate refuses, with
// a letter of each and the characters a language in it must be allowed.
// Without them its headwords would be gated by mistake. ZWNJ and ZWJ shape
// the words of Persian and of the Brahmic scripts (Door43's Hindi tW
// headwords in data/glossaries/hi/ use ZWJ); the Arabic and Syriac signs are
// format characters that are visible; Mongolian needs its variation
// selectors. A new draft language must also state formatAllowed (a required
// field), so a script not listed here is still a decision, not a default.
const JOINERS = "\u{200C}\u{200D}";
const SCRIPT_NEEDS: [string, string, string][] = [
  [
    "Arabic",
    "ب",
    "\u{200C}\u{0600}\u{0601}\u{0602}\u{0603}\u{0604}\u{0605}\u{06DD}\u{0890}\u{0891}\u{08E2}",
  ],
  ["Syriac", "ܐ", "\u{070F}" + JOINERS],
  ["Devanagari", "क", JOINERS],
  ["Bengali", "ক", JOINERS],
  ["Gurmukhi", "ਕ", JOINERS],
  ["Gujarati", "ક", JOINERS],
  ["Oriya", "କ", JOINERS],
  ["Tamil", "க", JOINERS],
  ["Telugu", "క", JOINERS],
  ["Kannada", "ಕ", JOINERS],
  ["Malayalam", "ക", JOINERS],
  ["Sinhala", "ක", JOINERS],
  ["Mongolian", "ᠠ", "\u{180B}\u{180C}\u{180D}\u{180E}\u{180F}\u{200D}"],
];

// What a language whose script is in SCRIPT_NEEDS is not allowed but needs.
const unallowed = (lang: { script: RegExp; formatAllowed: string }) => {
  const re = new RegExp(
    lang.script.source,
    lang.script.flags.replace(/[gy]/g, "")
  );
  const allow = new Set(lang.formatAllowed);
  return SCRIPT_NEEDS.filter(([, letter]) => re.test(letter)).flatMap(
    ([script, , needs]) =>
      [...needs]
        .filter((c) => !allow.has(c))
        .map(
          (c) =>
            `${script} U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`
        )
  );
};

describe("formatAllowed", () => {
  it("lists only characters, each one the format gate refuses", () => {
    for (const row of SCRIPT_NEEDS)
      for (const c of row[2])
        expect(
          gateProblems(
            { headword: `${row[1]}${c}${row[1]}` },
            { script: /./u, formatAllowed: "" },
            []
          ),
          `${row[0]} U+${c.codePointAt(0)!.toString(16)}`
        ).toEqual(["format"]);
  });

  it("refuses a language whose script needs a character it does not allow", () => {
    // Persian with nothing allowed, as an entry copied from zh-Hans would be.
    expect(
      unallowed({ script: /\p{Script=Arabic}/u, formatAllowed: "" })
    ).toContain("Arabic U+200C");
    expect(
      unallowed({ script: /\p{Script=Devanagari}/u, formatAllowed: "\u{200C}" })
    ).toEqual(["Devanagari U+200D"]);
    expect(unallowed(ZH)).toEqual([]);
  });

  it("allows what each draft language's script needs", () => {
    for (const [tag, lang] of Object.entries(DRAFT_LANGUAGES))
      expect(unallowed(lang), tag).toEqual([]);
  });

  it("allows what each translation language's script needs (#181)", () => {
    // The translation gates read the same list (FORMAT_ALLOWED), by tag. A
    // tag with no entry fails here rather than passing as an empty allowance.
    for (const [tag, script] of Object.entries(SCRIPT_BY_TAG)) {
      const formatAllowed = FORMAT_ALLOWED[tag];
      assert(formatAllowed !== undefined, `${tag} has no FORMAT_ALLOWED entry`);
      expect(
        unallowed({
          script: new RegExp(`\\p{Script=${script}}`, "u"),
          formatAllowed,
        }),
        tag
      ).toEqual([]);
    }
  });

  it("allows only characters the format gate would refuse", () => {
    for (const [tag, lang] of Object.entries(DRAFT_LANGUAGES))
      for (const c of lang.formatAllowed)
        expect(
          gateProblems(
            { headword: c },
            { script: /./u, formatAllowed: "" },
            []
          ),
          tag
        ).toContain("format");
  });
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
    const lang = draftLanguage(record.language);
    if (!lang) throw new Error(`${path}: not a draft language`);
    const fia = parseFia(await readSource(record.reference));
    for (const [a, t] of Object.entries(record.terms)) {
      expect(t.headword, a).toBe(t.headword.normalize("NFC"));
      const verses = verseTexts(await readSource(namesId(lang, record.book)));
      expect(t.gates ?? [], a).toEqual(
        gateProblems(t, lang, fia, {
          article: a,
          refs: links.get(a) ?? [],
          verses,
        })
      );
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

  it("is built into data/glossaries/ with nothing above ai-checked unless a person's review is recorded, and a changed headword in its place", () => {
    expect(built.drafts).toBe(path);
    expect(built.models).toEqual({
      draft: `ai:${record.calls[0]?.model}`,
      check: `ai:${record.calls[1]?.model}`,
    });
    expect(Object.keys(built.terms)).toEqual(Object.keys(built.terms).sort());
    for (const [a, t] of Object.entries(built.terms)) {
      // AGENTS.md: an AI-written term is no higher than ai-checked until a
      // person reviews it; a reviewed one names who and when.
      const drafted = record.terms[a];
      const review = drafted?.review;
      if (review === undefined) {
        expect(["unreviewed", "ai-checked"], a).toContain(t.status);
        expect(t.review, a).toBeUndefined();
      } else {
        expect(t.status, a).toBe("human-reviewed");
        expect(t.review, a).toEqual(review);
        expect(reviewProblems(review), a).toEqual([]);
      }
      // As tests/drafts.test.ts holds a title: a review's text, when it gave
      // one, is the headword, with the reviewer as source; otherwise the
      // model's headword and source, never relabelled.
      expect(drafted?.source, a).toBe(`ai:${record.calls[0]?.model}`);
      expect({ headword: t.headword, source: t.source }, a).toEqual(
        review?.text !== undefined
          ? { headword: review.text, source: review.by }
          : { headword: drafted?.headword, source: drafted?.source }
      );
      // A changed term names the model's headword, the one its check judged,
      // and has no gates: they described the model's headword.
      expect(t.drafted, a).toBe(
        review?.text !== undefined ? drafted?.headword : undefined
      );
      if (review?.text !== undefined) expect(t.gates, a).toBeUndefined();
      expect(t.en).toBe(drafted?.en);
    }
    expect(built.review).toEqual(
      Object.entries(built.terms)
        .filter(([, t]) => t.status === "unreviewed")
        .map(([a]) => a)
    );
    for (const id of [twlId(record.book), record.reference])
      expect(built.attribution).toContain(pins.get(id)?.attribution);
  });

  it("is accepted by the build, which makes the committed file from it", async () => {
    const rows = parseTwl(await readSource(twlId(record.book)));
    // The English headwords the build passes come from its English glossary
    // for the book, committed as data/glossaries/en/<BOOK>.json.
    const en: unknown = JSON.parse(
      read(`data/glossaries/en/${record.book}.json`)
    );
    const lang = draftLanguage(record.language);
    if (!lang) throw new Error(`${path}: not a draft language`);
    const glossary = buildDraftGlossary({
      record,
      file: path,
      rows,
      english: (a) => englishHeadword(en, a),
      credit: (id) => {
        const pin = pins.get(id);
        if (!pin) throw new Error(`${id} is not pinned in sources.json`);
        return pin;
      },
      prompt: read("prompts/key-terms.md"),
      reference: parseFia(await readSource(lang.reference)),
      names: verseTexts(await readSource(namesId(lang, record.book))),
    });
    expect(glossary).toEqual(built);
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

  // One spawn per test: each starts a Node process, and under a loaded
  // host several in one test outran the test timeout (issue #111).
  const cases: [string[], Record<string, string>, string][] = [
    [base, {}, "OPENROUTER_API_KEY is not set"],
    [base, { OPENROUTER_API_KEY: "   " }, "OPENROUTER_API_KEY is not set"],
    [
      [...base.slice(0, 6), "--check-model", "google/a"],
      { OPENROUTER_API_KEY: KEY },
      "different family",
    ],
    [
      // NUM has no English glossary: refused before any input is read.
      ["--book", "NUM", ...base.slice(2, 6), "--check-model", "google/b"],
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
  it.each(cases)(
    "fails before any call without a key, for one family twice, an unknown book, or into data/: %j",
    (args, env, message) => {
      const r = run(args, env);
      expect(r.status, message).toBe(1);
      expect(r.stderr, message).toContain(message);
      expect(r.stderr + r.stdout).not.toContain(KEY);
    }
  );
});
