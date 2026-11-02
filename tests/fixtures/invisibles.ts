// Characters the format gates refuse in every language (FORMAT in
// scripts/lib/format.ts), named, for the gate tests. A sample of each part
// of FORMAT: controls (\p{Cc}) other than the line breaks, format characters
// (\p{Cf}, bidi controls included), and default-ignorable characters that are
// not Cf. None is a letter, so no script gate also fires on it.
export const REFUSED: readonly (readonly [string, string])[] = [
  ["TAB (Cc)", "\t"],
  ["NUL (Cc)", "\u{0}"],
  ["BEL (Cc)", "\u{7}"],
  ["ESC (Cc)", "\u{1B}"],
  ["INFORMATION SEPARATOR FOUR U+001C (Cc)", "\u{1C}"],
  ["DEL (Cc)", "\u{7F}"],
  ["PADDING CHARACTER U+0080 (Cc)", "\u{80}"],
  ["SOFT HYPHEN (Cf)", "\u{AD}"],
  ["ARABIC LETTER MARK (Cf, bidi)", "\u{61C}"],
  ["MONGOLIAN VOWEL SEPARATOR (Cf)", "\u{180E}"],
  ["ZERO WIDTH SPACE (Cf)", "\u{200B}"],
  ["LEFT-TO-RIGHT MARK (Cf, bidi)", "\u{200E}"],
  ["RIGHT-TO-LEFT MARK (Cf, bidi)", "\u{200F}"],
  ["RIGHT-TO-LEFT OVERRIDE (Cf, bidi)", "\u{202E}"],
  ["WORD JOINER (Cf)", "\u{2060}"],
  ["LEFT-TO-RIGHT ISOLATE (Cf, bidi)", "\u{2066}"],
  ["POP DIRECTIONAL ISOLATE (Cf, bidi)", "\u{2069}"],
  ["ZERO WIDTH NO-BREAK SPACE, BOM (Cf)", "\u{FEFF}"],
  ["TAG LATIN CAPITAL LETTER A (Cf)", "\u{E0041}"],
  ["COMBINING GRAPHEME JOINER (default-ignorable)", "\u{34F}"],
  ["VARIATION SELECTOR-16 (default-ignorable)", "\u{FE0F}"],
  ["VARIATION SELECTOR-17 (default-ignorable)", "\u{E0100}"],
];

/** The mandatory line breaks (LINE_BREAK in scripts/lib/line-breaks.ts). */
export const LINE_BREAKS: readonly (readonly [string, string])[] = [
  ["LF", "\n"],
  ["VT", "\v"],
  ["FF", "\f"],
  ["CR", "\r"],
  ["NEL", "\u{85}"],
  ["LINE SEPARATOR", "\u{2028}"],
  ["PARAGRAPH SEPARATOR", "\u{2029}"],
];

/** A code point as a gate message names it. */
export const hex = (c: string): string =>
  `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
