import { describe, expect, it } from "vitest";
import { FORMAT_ALLOWED, formatChars } from "../scripts/lib/format.ts";
import { SCRIPT_BY_TAG } from "../scripts/lib/gates.ts";
import { DRAFT_LANGUAGES } from "../scripts/lib/key-terms.ts";
import { LINE_BREAK } from "../scripts/lib/line-breaks.ts";
import { hex, LINE_BREAKS, REFUSED } from "./fixtures/invisibles.ts";

describe("FORMAT_ALLOWED", () => {
  it("has an entry for English and every translation and draft language, and no other", () => {
    const tags = new Set([
      "en",
      ...Object.keys(SCRIPT_BY_TAG),
      ...Object.keys(DRAFT_LANGUAGES),
    ]);
    expect(Object.keys(FORMAT_ALLOWED).sort()).toEqual([...tags].sort());
  });

  it("is the list the key-term gate uses", () => {
    for (const [tag, lang] of Object.entries(DRAFT_LANGUAGES))
      expect(lang.formatAllowed, tag).toBe(FORMAT_ALLOWED[tag]);
  });

  it("allows only characters the gates would otherwise refuse, each once", () => {
    for (const [tag, allowed] of Object.entries(FORMAT_ALLOWED)) {
      expect(new Set(allowed).size, tag).toBe([...allowed].length);
      for (const c of allowed)
        expect(formatChars(c, ""), `${tag} ${hex(c)}`).toEqual([c]);
    }
  });

  it("never allows a control or a bidi control", () => {
    // The review applier refuses these in a person's wording through the
    // same gates (review.ts, wordingProblems), so no language may allow one.
    for (const [tag, allowed] of Object.entries(FORMAT_ALLOWED))
      for (const c of allowed)
        expect(/[\p{Cc}\p{Bidi_Control}]/u.test(c), `${tag} ${hex(c)}`).toBe(
          false
        );
  });
});

describe("formatChars", () => {
  it("refuses every sample, and leaves the line breaks to the line-break gates", () => {
    for (const [name, c] of REFUSED)
      expect(formatChars(`a${c}b`, ""), name).toEqual([c]);
    for (const [name, c] of LINE_BREAKS) {
      expect(LINE_BREAK.test(c), name).toBe(true);
      expect(formatChars(`a${c}b`, ""), name).toEqual([]);
    }
  });

  it("keeps combining marks a script writes with", () => {
    // A shadda, a Devanagari virama, U+0301 and a nukta are Mn, not FORMAT.
    for (const c of ["\u{651}", "\u{94D}", "\u{301}", "\u{93C}"])
      expect(formatChars(`a${c}`, ""), hex(c)).toEqual([]);
  });

  it("matches an allowed character by code point, not by code unit", () => {
    expect(formatChars("\u{E0100}\u{E0101}", "\u{E0100}")).toEqual([
      "\u{E0101}",
    ]);
  });
});
