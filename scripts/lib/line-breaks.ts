/**
 * The mandatory line breaks: the characters Unicode's line-breaking algorithm
 * (UAX #14) always breaks at, LF, VT, FF, CR, NEL and the line and paragraph
 * separators U+2028 and U+2029, not only `\r` and `\n`. One list for every
 * gate that keeps text on one line: the key-term and segment-title
 * `line-break` gates, and the review applier's own list (review.ts).
 *
 * `LINE_BREAKS` is the body of a character class, for a caller that builds a
 * wider class from it; `LINE_BREAK` matches any one of them.
 */
export const LINE_BREAKS = "\\n\\v\\f\\r\\u{85}\\u{2028}\\u{2029}";
export const LINE_BREAK = new RegExp(`[${LINE_BREAKS}]`, "u");
