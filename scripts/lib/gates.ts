// Machine gates for AI-translated titles: a translation that left English
// behind, used the wrong script, overflowed, or leaked markup is caught
// before a person reads it. Meaning is out of scope; only a reader can judge
// it.
//
// Ported from tc-mobile's AI-draft gates (`tests/i18n-draft-quality.test.ts`,
// unfoldingWord/tc-mobile `develop` at 292611b639883790310783cbfa5703cecd466b44,
// last changed in 93e0d79350f2bb15631229a5db140d326d65d5c4), MIT, copyright
// 2026 unfoldingWord. There they are functions inside a test file over UI
// strings; here they are exports over titles. What changed and why:
//
// - (a) English leak compares letters and digits only, case folded: a title
//   is prose, and "Paul greets Titus" returned as "paul greets Titus." is
//   still English.
// - (b) Script: the exemptions are scripture references and a per-language,
//   reasoned allowlist of Latin words, in place of the app's brand words and
//   placeholders; a stray is reported as the run of letters outside the
//   script, since a Chinese title has no spaces to split words at.
// - (c) Length: the ratio is re-tuned for titles (LENGTH_RATIO_MAX below).
// - (d) Leak: titles have no placeholders, so any brace is a leak; markup,
//   line breaks and surrounding whitespace are leaks too.
//
// Added here, not in tc-mobile (decided by the maintainer, #41):
//
// - (e) No final full stop, in any script's form of it.
// - (f) No quotation marks, in any language's form of them.
//
// A heading convention that needs one of those marks is let through by a
// reasoned per-language entry in ALLOW_PUNCTUATION, never by editing the sets.

/** The script each v0.1 language's letters must come from. */
export const SCRIPT_BY_TAG: Readonly<Record<string, string>> = {
  ar: "Arabic",
  "es-419": "Latin",
  fr: "Latin",
  hi: "Devanagari",
  id: "Latin",
  "pt-BR": "Latin",
  ru: "Cyrillic",
  sw: "Latin",
  "zh-Hans": "Han",
};

/**
 * A translation may be at most this many times its English title's length
 * (with the floor below). ESTIMATED, not measured on titles: no title has been
 * translated by the runner at scale yet.
 *
 * Method: tc-mobile's AI-drafted UI tables (`src/lib/i18n/*.ts` at the commit
 * above) are the nearest measured text in eight of the nine languages (the
 * Arabic table has no entries). Over the single-line string entries whose
 * English is 20 to 80 characters, the range of a Titus title (14 to 57,
 * measured on data/titles/en/TIT.json), n = 124 per language, the largest
 * ratio of draft to English length is 1.96 (id), then 1.91 (pt), 1.83 (fr),
 * 1.74 (sw), 1.70 (ru), 1.65 (es), 1.62 (hi), 0.74 (zh-Hans); the medians are
 * 1.06 to 1.27 (0.33 for zh-Hans). A second, independent script re-derived the
 * same counts and maxima. 2.2 is the largest of those with about 10% room.
 * tc-mobile's own 2.7 was set by two 5- and 6-character captions, which titles
 * are not.
 *
 * Replace with the ratio measured on the Titus translations (both models, nine
 * languages) once they exist; a title that measures above it raises it here
 * with its own measurement and reason.
 */
export const LENGTH_RATIO_MAX = 2.2;

/** Short English titles get at least this many characters of room. */
export const LENGTH_FLOOR_CHARS = 12;

/**
 * Latin words a non-Latin translation may carry, by language tag and then
 * word, each with its reason, so one entry silences one language only. Empty
 * until a translation needs one: a name a language's own Bible keeps in Latin
 * letters would go here, never a name the model simply left untranslated.
 */
export type Reasons = Readonly<Record<string, string>>;
export const ALLOW_LATIN: Readonly<Record<string, Reasons>> = {};

/** The 66 USFM book codes of the Protestant canon. */
export const BOOK_CODES = [
  "GEN",
  "EXO",
  "LEV",
  "NUM",
  "DEU",
  "JOS",
  "JDG",
  "RUT",
  "1SA",
  "2SA",
  "1KI",
  "2KI",
  "1CH",
  "2CH",
  "EZR",
  "NEH",
  "EST",
  "JOB",
  "PSA",
  "PRO",
  "ECC",
  "SNG",
  "ISA",
  "JER",
  "LAM",
  "EZK",
  "DAN",
  "HOS",
  "JOL",
  "AMO",
  "OBA",
  "JON",
  "MIC",
  "NAM",
  "HAB",
  "ZEP",
  "HAG",
  "ZEC",
  "MAL",
  "MAT",
  "MRK",
  "LUK",
  "JHN",
  "ACT",
  "ROM",
  "1CO",
  "2CO",
  "GAL",
  "EPH",
  "PHP",
  "COL",
  "1TH",
  "2TH",
  "1TI",
  "2TI",
  "TIT",
  "PHM",
  "HEB",
  "JAS",
  "1PE",
  "2PE",
  "1JN",
  "2JN",
  "3JN",
  "JUD",
  "REV",
];

/**
 * Exempt by rule, not by listing: a scripture reference written with one of
 * those codes ("TIT 1:5", "1CO 13:4-7"). Chapter and verse numbers carry no
 * letters, so only the code needs exempting; any other capitalised word
 * ("GOD 1") is still checked.
 */
const REFERENCE = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${BOOK_CODES.join("|")}) \\d+(?::\\d+(?:[-–]\\d+)?)?(?!\\p{N})`,
  "gu"
);

const exempt = (text: string): string => text.replace(REFERENCE, " ");

const letters = (text: string): string[] => text.match(/\p{L}+/gu) ?? [];

// Letters and digits only: "Paul greets Titus." is still the English title.
const fold = (text: string): string =>
  text
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLocaleLowerCase("en");

/** (a) A translation equal to its English title is an untranslated one. */
export function englishLeak(en: string, value: string): string[] {
  if (fold(value) !== fold(en)) return [];
  if (letters(exempt(en)).length === 0) return [];
  return ["equals the English title"];
}

/**
 * (b) Every letter is of the language's script, or an allowlisted Latin word.
 * Marks (Devanagari vowel signs, Arabic harakat) are not letters, so a word
 * split at one is still checked piece by piece.
 */
export function scriptProblems(
  tag: string,
  value: string,
  allow: Reasons = ALLOW_LATIN[tag] ?? {}
): string[] {
  const script = SCRIPT_BY_TAG[tag];
  if (script === undefined) return [`no script known for ${tag}`];
  const words = letters(exempt(value));
  if (words.length === 0) return [];
  const own = new RegExp(`\\p{Script=${script}}`, "u");
  const other = new RegExp(`[^\\p{Script=${script}}]+`, "gu");
  const problems: string[] = [];
  let hasOwn = false;
  for (const word of words) {
    if (Object.hasOwn(allow, word)) continue;
    if (own.test(word)) hasOwn = true;
    // Chinese has no spaces, so a "word" can be a whole title: report only
    // the run of letters outside the script, not the word around it.
    for (const run of word.match(other) ?? [])
      problems.push(`stray "${run}" outside ${script}`);
  }
  if (!hasOwn && problems.length === 0) problems.push(`no ${script} letters`);
  return problems;
}

/** (c) Length within the budget against English. */
export function lengthProblems(en: string, value: string): string[] {
  const budget = Math.max(
    Math.floor(en.length * LENGTH_RATIO_MAX),
    LENGTH_FLOOR_CHARS
  );
  if (value.length === 0) return ["empty"];
  if (letters(exempt(value)).length === 0 && letters(exempt(en)).length > 0)
    return ["no letters outside references"];
  return value.length > budget
    ? [`${value.length} characters over a budget of ${budget}`]
    : [];
}

/** (d) No braces, markup, line breaks, null-ish text or outer whitespace. */
export function leakProblems(value: string): string[] {
  const problems: string[] = [];
  if (/[{}]/.test(value)) problems.push("stray brace");
  if (/<\/?[A-Za-z][^>]*>|\\[a-z]+\d*\*?/.test(value)) problems.push("markup");
  if (/[\r\n\t]/.test(value)) problems.push("line break or tab");
  if (value !== value.trim()) problems.push("surrounding whitespace");
  if (/\b(undefined|null|NaN)\b|\[object /i.test(value))
    problems.push("leaked null-ish text");
  return problems;
}

/**
 * (e) Marks that may not end a title, each with the script or convention it
 * stands for. A title is a heading, not a sentence: no v0.1 language ends a
 * heading with a full stop, and the English titles carry none.
 *
 * Question and exclamation marks are not here: a title may be a question.
 * The comma-like marks (، ， 、) are not here either: they cannot end a
 * heading, and a title that ends in one is cut short, which a reader sees.
 */
export const FULL_STOPS: Reasons = {
  ".": "full stop of the Latin and Cyrillic languages (es-419, fr, id, pt-BR, ru, sw), also used in modern Arabic",
  "…": "ellipsis as one character; its three-dot form ends in '.' and is caught by that entry",
  "।": "danda, the Devanagari full stop (hi)",
  "॥": "double danda, the Devanagari end of verse or paragraph (hi)",
  "۔": "Arabic full stop (U+06D4), which a model writing Arabic script may use for '.'",
  "。": "ideographic full stop, the Chinese full stop (zh-Hans)",
  "．": "fullwidth full stop, an alternative in Chinese text (zh-Hans)",
  "｡": "halfwidth ideographic full stop (zh-Hans)",
};

/**
 * (f) Quotation marks, each with the languages that use it. A title names
 * what a passage is about; it does not quote it, and a quotation mark in a
 * title is a model echoing its input or quoting the verse text.
 *
 * The ASCII apostrophe and the right single quotation mark (' and ’) are
 * also apostrophes (French l’, d’; Swahili ng'ombe), so they count only when
 * they are not between two letters: ‘Amen’ is quoted, l’Église is not.
 */
export const QUOTATION_MARKS: Reasons = {
  '"': "ASCII double quote, used for any language by a model",
  "“": "left double quotation mark (es-419, pt-BR, id, sw, hi, ar, zh-Hans; closing in ru)",
  "”": "right double quotation mark (same languages)",
  "„": "low double quotation mark (opening in ru)",
  "‟": "reversed double quotation mark",
  "«": "left guillemet (fr, ru, es-419, pt-BR, ar)",
  "»": "right guillemet (same languages)",
  "‹": "single left guillemet (fr)",
  "›": "single right guillemet (fr)",
  "‘": "left single quotation mark (inner quotes; es-419, pt-BR, id, sw, hi, zh-Hans)",
  "’": "right single quotation mark, when not an apostrophe (see above)",
  "'": "ASCII apostrophe used as a quote, when not between letters",
  "‚": "low single quotation mark (inner quotes in ru)",
  "‛": "reversed single quotation mark",
  "「": "left corner bracket, a CJK quotation mark (zh-Hans)",
  "」": "right corner bracket (zh-Hans)",
  "『": "left white corner bracket, CJK inner quotation mark (zh-Hans)",
  "』": "right white corner bracket (zh-Hans)",
  "〝": "reversed double prime quotation mark, CJK (zh-Hans)",
  "〞": "double prime quotation mark, CJK (zh-Hans)",
  "〟": "low double prime quotation mark, CJK (zh-Hans)",
  "＂": "fullwidth quotation mark (zh-Hans)",
  "＇": "fullwidth apostrophe used as a quote (zh-Hans)",
};

/**
 * Marks from FULL_STOPS or QUOTATION_MARKS a language may carry anyway, by
 * language tag and then mark, each with its reason (the heading convention
 * that needs it), so one entry lets one mark through in one language only.
 * Empty: no v0.1 language's heading convention has needed one yet.
 */
export const ALLOW_PUNCTUATION: Readonly<Record<string, Reasons>> = {};

// Closing brackets and quotes after a full stop ("… fin.)") do not hide it.
const TRAILING_CLOSERS = /[\p{Pe}\p{Pf}"'＂＇」』〞〟]+$/u;

/** (e) The title does not end with a full stop, in any script. */
export function finalStopProblems(
  tag: string,
  value: string,
  allow: Reasons = ALLOW_PUNCTUATION[tag] ?? {}
): string[] {
  const last = [...value.trimEnd().replace(TRAILING_CLOSERS, "")].at(-1);
  if (last === undefined || !Object.hasOwn(FULL_STOPS, last)) return [];
  if (Object.hasOwn(allow, last)) return [];
  return [`final full stop ${JSON.stringify(last)}`];
}

// ' or ’ with a letter (or a mark on one) before it and a letter after it is
// an apostrophe inside a word, not a quotation mark.
const APOSTROPHE = /(?<=[\p{L}\p{M}])['’](?=\p{L})/gu;

/** (f) The title carries no quotation marks; each mark is reported once. */
export function quoteProblems(
  tag: string,
  value: string,
  allow: Reasons = ALLOW_PUNCTUATION[tag] ?? {}
): string[] {
  const seen = new Set<string>();
  for (const ch of value.replace(APOSTROPHE, ""))
    if (Object.hasOwn(QUOTATION_MARKS, ch) && !Object.hasOwn(allow, ch))
      seen.add(ch);
  return [...seen].map((m) => `quotation mark ${JSON.stringify(m)}`);
}

/** Every gate over one English title and its translation. */
export function titleProblems(
  tag: string,
  en: string,
  value: string
): string[] {
  return [
    ...englishLeak(en, value),
    ...scriptProblems(tag, value),
    ...lengthProblems(en, value),
    ...leakProblems(value),
    ...finalStopProblems(tag, value),
    ...quoteProblems(tag, value),
  ];
}
