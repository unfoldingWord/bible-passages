import { LINE_BREAK } from "./line-breaks.ts";

/**
 * A character the `format` gates refuse unless the language allows it: a
 * format character (\p{Cf}: a zero-width space, a joiner, a bidi control, a
 * soft hyphen), a default-ignorable one (\p{Default_Ignorable_Code_Point}:
 * the same, and the combining grapheme joiner, variation selectors and Hangul
 * fillers, which are not Cf), or a control other than a line break (\p{Cc}:
 * NUL, tab). Neither `trim` nor NFC removes them, and most cannot be seen, so
 * two texts could differ only invisibly. Combining marks a script writes with
 * (U+0301, an Arabic vowel sign, a Devanagari virama) are none of these.
 *
 * One definition for every gate that refuses them: the key-term headword gate
 * (key-terms.ts), the English segment-title gate (segment-titles.ts) and the
 * translation gates (gates.ts). The mandatory line breaks are also Cc or
 * separators; each gate refuses those as a line break (line-breaks.ts), so
 * they are left out here.
 */
export const FORMAT = /[\p{Cf}\p{Default_Ignorable_Code_Point}\p{Cc}]/u;

/**
 * The characters of `text` the `format` gates refuse for `allowed`, each once,
 * in order. Membership is by code point, as the scan walks: a substring test
 * would also match one half of a supplementary-plane character in `allowed`.
 */
export const formatChars = (text: string, allowed: string): string[] => {
  const allow = new Set(allowed);
  return [
    ...new Set(
      [...text].filter(
        (c) => FORMAT.test(c) && !LINE_BREAK.test(c) && !allow.has(c)
      )
    ),
  ];
};

/** Whether `text` has a character the `format` gates refuse for `allowed`. */
export const hasFormat = (text: string, allowed: string): boolean =>
  formatChars(text, allowed).length > 0;

/** A code point as U+XXXX, for a message. */
export const codePoint = (c: string): string =>
  `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;

/**
 * The characters of FORMAT each language's words legitimately use, by
 * language tag: a joiner its script needs (ZWNJ, ZWJ) or a format character
 * that is visible (the Arabic number sign). Every other such character in a
 * title or a headword is refused. One list for English (the segment titles),
 * the v0.1 translation languages (gates.ts, `SCRIPT_BY_TAG`) and the key-term
 * draft languages (key-terms.ts, `DRAFT_LANGUAGES`); tests/format.test.ts
 * fails if one of those languages has no entry, and tests/key-terms.test.ts
 * if a language's script is known to need a character its entry leaves out.
 *
 * Measured in the pinned Door43 Translation Words of each language
 * (`.cache/sources/tw-<lang>-*`, counting every FORMAT character other than
 * line breaks and tab) and in the committed glossary headwords
 * (`data/glossaries/<lang>/*.json`), at aae7226:
 *
 * - hi: U+200D (ZWJ) 266 times across the headwords and 50 times in the
 *   articles; U+FEFF 56 times and U+200B 9 times, in the articles only.
 * - fr, pt-br, ru: U+200B only (3, 26 and 1 times), in the articles only.
 * - ar, en, es, id, sw: none. zh-Hans has no Door43 tW; its 93 committed
 *   headwords have none.
 *
 * The U+200B and U+FEFF in the articles are stray: a byte-order mark at the
 * start of a file (23) or inside one (33), and zero-width spaces doubled
 * before a word or alone on a line. Inference from those contexts: no
 * language here needs them, so they are refused everywhere.
 */
export const FORMAT_ALLOWED: Readonly<Record<string, string>> = {
  // Latin, with no joiner or visible format character in its words.
  en: "",
  // Arabic script. ZWNJ stops a letter joining the next, and U+0600..U+0605,
  // U+06DD, U+0890, U+0891 and U+08E2 are visible signs written before
  // digits (number sign, year sign, end of ayah). INFERENCE from the Unicode
  // Core Specification's Arabic chapter, as in tests/key-terms.test.ts
  // (SCRIPT_NEEDS); none of them occurs in Door43 Arabic tW (measured above).
  // The bidi marks (ALM U+061C, LRM, RLM) are not allowed.
  ar: "\u{200C}\u{0600}\u{0601}\u{0602}\u{0603}\u{0604}\u{0605}\u{06DD}\u{0890}\u{0891}\u{08E2}",
  "es-419": "",
  fr: "",
  // Devanagari. ZWJ is MEASURED in Door43 Hindi tW (above); ZWNJ is
  // INFERENCE from the Unicode Core Specification's Devanagari section (it
  // asks for the explicit virama form), not observed in Door43 Hindi.
  hi: "\u{200C}\u{200D}",
  id: "",
  "pt-BR": "",
  // Cyrillic, with no joiner or visible format character in its words.
  ru: "",
  sw: "",
  // Han needs no joiner and has no visible format character.
  "zh-Hans": "",
};
