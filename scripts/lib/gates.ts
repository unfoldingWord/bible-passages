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
// - (a) English leak compares after trimming and case folding: a title is
//   prose, and "Paul greets Titus" returned as "paul greets titus" is still
//   English.
// - (b) Script: the exemptions are scripture references and a per-language,
//   reasoned allowlist of Latin words, in place of the app's brand words and
//   placeholders; a stray is reported as the run of letters outside the
//   script, since a Chinese title has no spaces to split words at.
// - (c) Length: the ratio is re-tuned for titles (LENGTH_RATIO_MAX below).
// - (d) Leak: titles have no placeholders, so any brace is a leak; markup,
//   line breaks and surrounding whitespace are leaks too.

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

/**
 * Exempt by rule, not by listing: a scripture reference written with its USFM
 * book code ("TIT 1:5", "1CO 13:4-7"). Chapter and verse numbers carry no
 * letters, so only the code needs exempting.
 */
const REFERENCE = /\b[1-4A-Z][A-Z0-9]{2} \d+(?::\d+(?:[-–]\d+)?)?\b/g;

const exempt = (text: string): string => text.replace(REFERENCE, " ");

const letters = (text: string): string[] => text.match(/\p{L}+/gu) ?? [];

const fold = (text: string): string => text.trim().toLocaleLowerCase("en");

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
  ];
}
