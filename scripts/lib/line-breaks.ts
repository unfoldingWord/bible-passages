/**
 * The mandatory line breaks: the characters Unicode's line-breaking algorithm
 * (UAX #14) always breaks at, LF, VT, FF, CR, NEL and the line and paragraph
 * separators U+2028 and U+2029, not only `\r` and `\n`. One list for every
 * gate that keeps text on one line: the key-term and segment-title
 * `line-break` gates, the translation leak gate (gates.ts), and the review
 * applier's note cleaning (review.ts).
 *
 * Not here: U+001C..U+001E (file, group and record separators). ICU does
 * not break at them (#179, observed in ICU 78 through Chromium 156's line
 * breaker, not read from LineBreak.txt): over every code point, only these
 * seven and U+200B force a break before a closing bracket, and U+200B is a
 * break opportunity (LB8), not a mandatory break. U+001C..U+001E give no
 * break at all. They are controls, so the format gates (format.ts) refuse
 * them.
 *
 * `LINE_BREAKS` is the body of a character class, for a caller that builds a
 * wider class from it; `LINE_BREAK` matches any one of them.
 */
export const LINE_BREAKS = "\\n\\v\\f\\r\\u{85}\\u{2028}\\u{2029}";
export const LINE_BREAK = new RegExp(`[${LINE_BREAKS}]`, "u");
