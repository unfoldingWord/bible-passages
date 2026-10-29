import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ALLOW_PUNCTUATION,
  BOOK_CODES,
  FULL_STOPS,
  QUOTATION_MARKS,
  finalStopProblems,
  quoteProblems,
  LENGTH_FLOOR_CHARS,
  LENGTH_RATIO_MAX,
  SCRIPT_BY_TAG,
  englishLeak,
  leakProblems,
  lengthProblems,
  scriptProblems,
  titleProblems,
} from "../scripts/lib/gates.ts";
import { LANGUAGES } from "../scripts/lib/translate.ts";

const fixture = <T>(name: string): T =>
  JSON.parse(
    readFileSync(new URL(`fixtures/gates/${name}`, import.meta.url), "utf8")
  ) as T;

type Pair = { tag: string; en: string; value: string };
const correct = fixture<{ pairs: Pair[] }>("correct.json").pairs;
const defects = fixture<{
  cases: (Pair & { why: string; problem: string })[];
}>("defects.json").cases;

describe("title translation gates (ported from tc-mobile)", () => {
  it("knows the script of every v0.1 language", () => {
    expect(Object.keys(SCRIPT_BY_TAG).sort()).toEqual(
      Object.keys(LANGUAGES).sort()
    );
  });

  it("passes a correct title in every v0.1 language", () => {
    expect(correct.map((p) => p.tag).sort()).toEqual(
      Object.keys(LANGUAGES).sort()
    );
    for (const p of correct)
      expect(titleProblems(p.tag, p.en, p.value), p.tag).toEqual([]);
  });

  it("catches every defect fixture with its own problem", () => {
    for (const d of defects)
      expect(titleProblems(d.tag, d.en, d.value), d.why).toContain(d.problem);
  });

  it("(a) lets a title through that differs from English", () => {
    expect(englishLeak("Avoid Divisions", "Evitar las divisiones")).toEqual([]);
    // A title with no letters, such as a bare reference, is not a leak.
    expect(englishLeak("TIT 1:4", "TIT 1:4")).toEqual([]);
  });

  it("(b) exempts a scripture reference by its USFM book code", () => {
    expect(scriptProblems("ar", "تحيات بولس TIT 1:4")).toEqual([]);
    expect(scriptProblems("ru", "Приветствие (1CO 13:4–7)")).toEqual([]);
    expect(new Set(BOOK_CODES).size).toBe(66);
    for (const code of BOOK_CODES)
      expect(scriptProblems("ar", `تحيات ${code} 1:4`), code).toEqual([]);
    // Any other capitalised word with a number is still checked.
    expect(scriptProblems("ar", "تحيات GOD 1")).toEqual([
      'stray "GOD" outside Arabic',
    ]);
    expect(scriptProblems("ru", "Приветствие ALL 12")).toEqual([
      'stray "ALL" outside Cyrillic',
    ]);
    // A code inside a longer token is not a reference.
    expect(scriptProblems("ar", "تحيات XTIT 1:4")).toEqual([
      'stray "XTIT" outside Arabic',
    ]);
    // A lower-case or longer word is not a book code.
    expect(scriptProblems("ar", "تحيات Tit 1:4")).toEqual([
      'stray "Tit" outside Arabic',
    ]);
  });

  it("(b) allows a Latin word only through a reasoned per-language entry", () => {
    const allow = { Titus: "a test entry" };
    expect(scriptProblems("ar", "بولس يحيي Titus", allow)).toEqual([]);
    // The entry silences that word only.
    expect(scriptProblems("ar", "Paul يحيي Titus", allow)).toEqual([
      'stray "Paul" outside Arabic',
    ]);
    // A title of allowlisted words alone still has none of its own script.
    expect(scriptProblems("ar", "Titus", allow)).toEqual(["no Arabic letters"]);
    expect(scriptProblems("ar", "TIT 1:4")).toEqual([]);
  });

  it("(b) accepts marks inside words (Devanagari vowel signs, Arabic harakat)", () => {
    expect(scriptProblems("hi", "तीतुस")).toEqual([]);
    expect(scriptProblems("ar", "يُحَيِّي")).toEqual([]);
  });

  it("(b) refuses a language with no known script", () => {
    expect(scriptProblems("de", "Grüße")).toEqual(["no script known for de"]);
  });

  it(`(c) holds the estimated ratio exactly: ${LENGTH_RATIO_MAX} times English passes, a character more fails`, () => {
    const en = "a".repeat(20);
    const budget = Math.floor(20 * LENGTH_RATIO_MAX);
    expect(lengthProblems(en, "a".repeat(budget))).toEqual([]);
    expect(lengthProblems(en, "a".repeat(budget + 1))).toEqual([
      `${budget + 1} characters over a budget of ${budget}`,
    ]);
  });

  it(`(c) gives a short English title at least ${LENGTH_FLOOR_CHARS} characters`, () => {
    expect(lengthProblems("Go", "a".repeat(LENGTH_FLOOR_CHARS))).toEqual([]);
    expect(lengthProblems("Go", "a".repeat(LENGTH_FLOOR_CHARS + 1))).toEqual([
      `${LENGTH_FLOOR_CHARS + 1} characters over a budget of ${LENGTH_FLOOR_CHARS}`,
    ]);
  });

  it("(d) passes plain text, typographic apostrophes and punctuation", () => {
    expect(leakProblems("L’héritage de la grâce, selon Paul")).toEqual([]);
    expect(leakProblems("保罗问候提多，他在信仰上的真儿子")).toEqual([]);
  });

  it("(e)(f) start with an empty exception list", () => {
    expect(ALLOW_PUNCTUATION).toEqual({});
  });

  it("(e)(f) list single characters, each with a reason", () => {
    for (const set of [FULL_STOPS, QUOTATION_MARKS])
      for (const [mark, why] of Object.entries(set)) {
        expect([...mark], mark).toHaveLength(1);
        expect(why.length, mark).toBeGreaterThan(0);
      }
  });

  it("(e) catches every listed full stop at the end, and only at the end", () => {
    for (const stop of Object.keys(FULL_STOPS)) {
      expect(finalStopProblems("fr", `Tite ${stop}`), stop).toEqual([
        `final full stop ${JSON.stringify(stop)}`,
      ]);
      expect(finalStopProblems("fr", `Tite${stop} salue`), stop).toEqual([]);
    }
    // Abbreviation dots and verse references inside a title are not checked.
    expect(finalStopProblems("fr", "Paul salue Tite (TIT 1:1-4)")).toEqual([]);
    // Whitespace, format characters and closers after the stop do not hide it.
    for (const v of [
      "Tite (enfant. )",
      "Tite. \u202f»",
      "Tite.\u00a0)",
      "تيطس.\u200f",
      "Tite.\u200b",
      "Tite. ) »",
    ])
      expect(finalStopProblems("fr", v), JSON.stringify(v)).toEqual([
        'final full stop "."',
      ]);
    // A trailing vowel sign is part of the last letter, not noise.
    expect(finalStopProblems("hi", "तीतुस को")).toEqual([]);
    // A question is not a full stop.
    expect(finalStopProblems("fr", "Qui est sage ?")).toEqual([]);
    expect(finalStopProblems("fr", "")).toEqual([]);
  });

  it("(f) catches every listed quotation mark", () => {
    for (const mark of Object.keys(QUOTATION_MARKS))
      expect(quoteProblems("fr", `Tite ${mark}salue${mark}`), mark).toEqual([
        `quotation mark ${JSON.stringify(mark)}`,
      ]);
    // Each mark once, in the order it first appears.
    expect(quoteProblems("ru", "«Тит» и «Павел»")).toEqual([
      'quotation mark "«"',
      'quotation mark "»"',
    ]);
  });

  it("(f) passes an apostrophe inside a word", () => {
    expect(quoteProblems("fr", "L’héritage d’Israël aujourd'hui")).toEqual([]);
    expect(quoteProblems("sw", "Ng'ombe wa Abrahamu")).toEqual([]);
    // After a combining mark, still inside the word.
    expect(quoteProblems("hi", "अनुग्रहे’स")).toEqual([]);
    // At a word's edge it is a quotation mark.
    expect(quoteProblems("fr", "l’ Église")).toEqual(['quotation mark "’"']);
  });

  it("(e)(f) let a mark through only by a per-language entry", () => {
    const allow = { "।": "a test entry", "«": "a test entry" };
    expect(finalStopProblems("hi", "तीतुस।", allow)).toEqual([]);
    expect(finalStopProblems("hi", "तीतुस.", allow)).toEqual([
      'final full stop "."',
    ]);
    expect(quoteProblems("fr", "«Tite»", allow)).toEqual([
      'quotation mark "»"',
    ]);
    // The default is the language's own entry in ALLOW_PUNCTUATION: none.
    expect(finalStopProblems("hi", "तीतुस।")).toEqual(['final full stop "।"']);
  });
});
