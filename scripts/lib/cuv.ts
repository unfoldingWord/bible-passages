// The verse text of a USFM book, for the zh-Hans names check against the
// Chinese Union Version (docs/decisions/0004-cuv-names-check.md; definition
// of done in docs/scoping/zh-names-check.md, "Build"). Only the plain verse
// body is kept, keyed `<chapter>:<verse>` as TWL references are (refOf in
// glossaries.ts), so a name is matched against the words a reader sees and
// never against a note, a heading or another chapter's verse of the same
// number.

/**
 * Note-like and embedded-content markers, discarded whole with their text:
 * footnotes, endnotes, extended notes, cross-references, figures, and the
 * alternate and published verse and chapter numbers.
 */
const DISCARDED = /\\(f|fe|ef|x|ex|fig|va|vp|ca)\s[\s\S]*?\\\1\*/g;

/**
 * Lines that are not verse text: identification, headers, titles, section
 * headings (`\s1`, `\s5` and the like), references under headings, remarks,
 * chapter labels and introductions. Each is dropped to the end of its line.
 */
const NON_VERSE_LINE =
  /^[ \t]*\\(?:id|ide|usfm|h|toca?\d*|mte?\d*|ms\d*|mr|sr?\d*|r|d|sp|rem|sts|cl|cd|cp|imte?\d*|is\d*|ip[iqr]?|im[iq]?|iq\d*|ib|ili\d*|iot|io\d*|ior|iex|ie)(?![a-z])[^\n]*$/gm;

/** A chapter or verse number, with an optional verse bridge (`\v 3-4`). */
const NUMBER = /\\(c|v)[ \t]+(\d+)(?:-(\d+))?/g;

/**
 * A character style, kept as its text: an opening or closing marker such as
 * `\pn`, `\pn*`, `\add`, `\+w` (the names are examples of the class, not a
 * list). A paragraph marker such as `\p` or `\q1` matches too and leaves
 * nothing.
 */
const MARKER = /\\\+?[a-z][a-z0-9]*\*?/g;

/**
 * A word's attributes, `\w 克里特|lemma="x"\w*`: the part after `|`, only
 * where a closing character marker follows, so a `|` in the text itself is
 * kept.
 */
const ATTRIBUTES = /\|[^\\|]*(?=\\\+?[a-z][a-z0-9]*\*)/g;

/**
 * How a name is compared on both sides: whitespace removed (U+3000, the
 * ideographic space CUV writes before 神, included) and the bullet U+2022
 * read as the middle dot U+00B7, which name lists use interchangeably.
 */
export const compareForm = (text: string): string =>
  text.replace(/\s/gu, "").replaceAll("•", "·");

/**
 * The plain body of every verse in a USFM book, as `<chapter>:<verse>` to
 * text in compareForm. A verse runs from `\v N` to the next `\v`, the next
 * `\c` or the end of the file, within the chapter its `\c` opened, so 3:15
 * is not 1:15. A bridge gives each verse in it the same text. A verse before
 * any chapter, or one that appears twice, is an error.
 */
export function verseTexts(usfm: string): Map<string, string> {
  const text = usfm
    .replace(/\r\n?/g, "\n")
    .replace(DISCARDED, "")
    .replace(NON_VERSE_LINE, "");
  const verses = new Map<string, string>();
  let chapter: number | undefined;
  let open: string[] = [];
  let start = 0;
  const close = (end: number) => {
    if (open.length === 0) return;
    const body = compareForm(
      text.slice(start, end).replace(ATTRIBUTES, "").replace(MARKER, "")
    );
    for (const key of open) verses.set(key, body);
    open = [];
  };
  for (const m of text.matchAll(NUMBER)) {
    close(m.index);
    const [, kind, first, last] = m;
    if (kind === "c") {
      chapter = Number(first);
      continue;
    }
    if (chapter === undefined)
      throw new Error(`\\v ${first} comes before any \\c`);
    const from = Number(first);
    const to = last === undefined ? from : Number(last);
    for (let v = from; v <= to; v++) {
      const key = `${chapter}:${v}`;
      if (verses.has(key) || open.includes(key))
        throw new Error(`verse ${key} appears twice`);
      open.push(key);
    }
    start = m.index + m[0].length;
  }
  close(text.length);
  return verses;
}
