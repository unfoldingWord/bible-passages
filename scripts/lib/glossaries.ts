// Per-language glossaries of the key terms a book uses. Translation Word
// Links (TWL) say which Translation Words (tW) article each verse uses; each
// language's tW gives that article's headword in the language. Why these
// repos and not others: docs/scoping/glossaries.md.
import { ALL_BOOKS } from "./books.ts";
import { ABSENT } from "./glossary-absent.ts";

/** One language's Translation Words, at a released commit on Door43. */
export type TwRepo = {
  /** The tag this dataset uses for the language (BCP-47). */
  language: string;
  /** The tag Door43's catalog publishes it under. */
  door43: string;
  /** `owner/repo` on git.door43.org. */
  repo: string;
  /** The catalog release (git tag) the commit belongs to. */
  release: string;
  commit: string;
  /**
   * For languages not written in Latin script: a headword whose letters are
   * not mostly in this script (see `inScript`) is English left untranslated,
   * and is recorded as a gap.
   */
  script?: RegExp;
  /**
   * tW articles the TWL links (from any book in TWL_BOOKS) that this
   * release does not have, as measured when they were pinned
   * (`glossary-absent.ts`). The build checks the pins against this list, so
   * a pin that goes missing is an error, not a silent gap.
   */
  absent: readonly string[];
};

/** The TWL every language uses: its links are keyed to the Greek and Hebrew. */
export const TWL = {
  repo: "unfoldingWord/en_twl",
  release: "v91",
  commit: "7cbb3419f79780ce84b92ad7d42bd476cc5d8a64",
};

/**
 * Books the pinned TWL release has no file for: `en_twl` v91 publishes 59
 * books (its git tree, measured 2026-10-29). Each is a book-level gap: no
 * glossary until a release that has it is pinned.
 */
export const TWL_UNRELEASED: readonly string[] = [
  "NUM",
  "1CH",
  "2CH",
  "ECC",
  "ISA",
  "JER",
  "EZK",
];

/** The books the pinned TWL release has a file for, in canonical order. */
export const TWL_BOOKS: readonly string[] = ALL_BOOKS.map(([b]) => b).filter(
  (b) => !TWL_UNRELEASED.includes(b)
);

/**
 * Books whose glossaries (`data/glossaries/<lang>/<BOOK>.json`) are built:
 * each must be in TWL_BOOKS. Apart from BOOKS (scripts/lib/books.ts)
 * because a glossary needs only the book's Translation Word Links, not its
 * titles, which go one book at a time. Every book the TWL release has
 * (#30); the seven in TWL_UNRELEASED wait for a release (#57).
 */
export const GLOSSARY_BOOKS: readonly string[] = TWL_BOOKS;

export const TW: TwRepo[] = [
  {
    language: "en",
    door43: "en",
    repo: "unfoldingWord/en_tw",
    release: "v91",
    commit: "ff5b3852c27c3a0d01b109e482eb26047dcd20e2",
    absent: ABSENT.en,
  },
  {
    language: "ar",
    door43: "ar",
    repo: "BSOJ/ar_tw",
    release: "v5",
    commit: "7c233628947dee9ad1da0b1d6deddac663e66574",
    script: /\p{Script=Arabic}/u,
    absent: ABSENT.ar,
  },
  {
    // Provisional: the tag for Spanish is an open decision
    // (docs/scoping/glossaries.md, "Spanish tag").
    language: "es-419",
    door43: "es-419",
    repo: "es-419_gl/es-419_tw",
    release: "v37",
    commit: "7586f4ff1f0483ea40a4a68e5e1f33158e08c208",
    absent: ABSENT["es-419"],
  },
  {
    language: "fr",
    door43: "fr",
    repo: "Xenizo/fr_tw",
    release: "v2.0",
    commit: "06db7f855a0deb302a47a0e4d1b22312833b2ca1",
    absent: ABSENT.fr,
  },
  {
    language: "hi",
    door43: "hi",
    repo: "translationCore-Create-BCS/hi_tw",
    release: "v8",
    commit: "5fa7b590a2e5f99ac6a84de96ee081e751e70b95",
    script: /\p{Script=Devanagari}/u,
    absent: ABSENT.hi,
  },
  {
    language: "id",
    door43: "id",
    repo: "bahtraku/id_tw",
    release: "v26",
    commit: "31c260398c056748118a5d9184aa1d5327b7dbdd",
    absent: ABSENT.id,
  },
  {
    language: "pt-BR",
    door43: "pt-br",
    repo: "Door43-Catalog/pt-br_tw",
    release: "v6.4",
    commit: "879ce3844fa3eadc94f714e45ec50f794d6fb27d",
    absent: ABSENT["pt-BR"],
  },
  {
    language: "ru",
    door43: "ru",
    repo: "ru_gl/ru_tw",
    release: "v14.2",
    commit: "861807f86dc5d532be57248a9225b5f124fc9563",
    script: /\p{Script=Cyrillic}/u,
    absent: ABSENT.ru,
  },
  {
    language: "sw",
    door43: "sw",
    repo: "Door43-Catalog/sw_tw",
    release: "v7.3",
    commit: "82e94cd4a7aad817365190fa5d48960c90a01fc9",
    absent: ABSENT.sw,
  },
];

const HOST = "https://git.door43.org";

export const twlId = (book: string) => `twl-en-${book.toLowerCase()}`;
export const twlUrl = (book: string) =>
  `${HOST}/${TWL.repo}/raw/commit/${TWL.commit}/twl_${book}.tsv`;

/**
 * `kt/god` in fr → `tw-fr-kt-god`: a plain slug, as sources.ts requires.
 * Two en_tw articles have an underscore (`other/bear-witness_testify`,
 * `other/house-descendants_nation`); it becomes `--`, which no article
 * name has, so no two articles share an id.
 */
export const twId = (language: string, article: string) =>
  `tw-${language.toLowerCase()}-${article.replace("/", "-").replaceAll("_", "--")}`;
export const twUrl = (repo: TwRepo, article: string) =>
  `${HOST}/${repo.repo}/raw/commit/${repo.commit}/bible/${article}.md`;

/**
 * Whether a sources.json id is a glossary input: `twl-en-<book>` (a
 * three-character book code) or `tw-<lang>-<article>` (a language tag, then
 * a tW category and article slug, as `twId` writes them). The pattern is
 * the shape of the id, not the configured languages, so a pin left behind
 * by a language that was dropped is still recognised as a glossary input
 * (and the test that every glossary pin is used catches it).
 */
export const isGlossaryInput = (id: string) =>
  /^twl-en-[a-z0-9]{3}$/.test(id) ||
  /^tw-[a-z]{2,3}(?:-[a-z0-9]{2,8})*-(?:kt|names|other)-[a-z0-9]+(?:--?[a-z0-9]+)*$/.test(
    id
  );

/**
 * Whether a headword is written in a script: more than half of its letters
 * (Unicode `L`, so vowel signs and other marks are not counted) are in it.
 * A strict majority is the plainest line that says what most of the word is
 * written in: a native headword with a short English gloss beside it stays
 * a term, while English with a stray letter of the script, or half English
 * and half not, is a gap. A headword with no letters is not in any script.
 */
export function inScript(word: string, script: RegExp): boolean {
  const letters = [...word].filter((c) => /\p{L}/u.test(c));
  const inside = letters.filter((c) => script.test(c)).length;
  return inside * 2 > letters.length;
}

/**
 * A tW article path, as TWL links name it: category and file name. Words
 * are joined by `-`, and in two en_tw names by `_` (see `twId`).
 */
export const ARTICLE = /^(kt|names|other)\/[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
const LINK = /^rc:\/\/\*\/tw\/dict\/bible\/(.+)$/;
/**
 * `c:v`, or `c:front` for a psalm's superscription (the text before verse 1,
 * as the TWL for Psalms writes it).
 */
const REF = /^(\d+):(\d+|front)$/;

/** A TWL row. `verse` 0 is the chapter's front (a psalm superscription). */
export type TwlRow = { chapter: number; verse: number; article: string };

/** A row's reference as a glossary writes it: `c:v`, or `c:front`. */
export const refOf = (r: { chapter: number; verse: number }) =>
  `${r.chapter}:${r.verse === 0 ? "front" : r.verse}`;

/** The rows of a TWL book file: which tW article each verse links to. */
export function parseTwl(tsv: string): TwlRow[] {
  const lines = tsv.replace(/\r\n/g, "\n").split("\n");
  const head = (lines.shift() ?? "").split("\t");
  const refCol = head.indexOf("Reference");
  const linkCol = head.indexOf("TWLink");
  if (refCol < 0 || linkCol < 0) {
    throw new Error("TWL: no Reference or TWLink column");
  }
  const rows: TwlRow[] = [];
  for (const [i, line] of lines.entries()) {
    if (line.trim() === "") continue;
    const cells = line.split("\t");
    const ref = REF.exec(cells[refCol]?.trim() ?? "");
    const article = LINK.exec(cells[linkCol]?.trim() ?? "")?.[1];
    if (!ref || !article || !ARTICLE.test(article)) {
      throw new Error(`TWL line ${i + 2}: cannot read "${line}"`);
    }
    const verse = ref[2] === "front" ? 0 : Number(ref[2]);
    if (verse === 0 && ref[2] !== "front") {
      throw new Error(`TWL line ${i + 2}: verse 0 in "${line}"`);
    }
    rows.push({ chapter: Number(ref[1]), verse, article });
  }
  return rows;
}

/**
 * The headword of a tW article: its first heading line, without the `#`
 * marks, byte-order marks or extra spaces. Sources differ in how they write
 * that line (`# God`, `#menegur`, `## baik`, `# पौलुस, शाऊल #`), and some
 * repeat the marker (`# # persévérer`), so every leading and trailing run
 * of `#` is removed, not just the first.
 */
export function headword(markdown: string): string {
  const text = headingOf(markdown);
  if (text === undefined) {
    throw new Error("tW article: first line is not a heading");
  }
  return text;
}

/**
 * The article's first heading as `headword` reads it, or undefined when
 * its first line is not a heading. Some releases have articles whose title
 * line lost its `#` or has text before it (`mendukung# pilih kasih`); which
 * part is the headword is not ours to guess, so such an article is a gap.
 */
export function headingOf(markdown: string): string | undefined {
  const first = markdown
    .split(/\r?\n/)
    .map((l) => l.replace(/﻿/g, "").trim())
    .find((l) => l !== "");
  const text = first?.startsWith("#")
    ? first
        .replace(/^[#\s]+/, "")
        .replace(/[#\s]+$/, "")
        .replace(/\s+/g, " ")
        .trim()
        .normalize("NFC")
    : "";
  return text === "" ? undefined : text;
}

export type Term = {
  /** The English headword, so a reader of any language sees the concept. */
  en: string;
  /** The headword in this glossary's language. */
  headword: string;
  /** The sources.json id the headword was read from. */
  source: string;
  /**
   * Verses that link the term, `c:v`, in reading order; `c:front` (a psalm
   * superscription) comes before the chapter's verse 1.
   */
  refs: string[];
};

/**
 * Why a linked article has no headword in a language: the release has no
 * such article, its first line is not a heading, or its headword is still
 * in English.
 */
export type Gap = "no-article" | "no-heading" | "english-headword";

export type Glossary = {
  language: string;
  book: string;
  /** sources.json id of the TWL file the terms come from. */
  links: string;
  /** The Door43 repo and release the headwords come from. */
  words: { repo: string; release: string; commit: string };
  /** The licence every source of this file is under, from sources.json. */
  licence: string;
  /**
   * The sources.json attribution of each source this file's content comes
   * from, each once: the TWL file, this language's tW, and English tW for
   * the `en` headwords.
   */
  attribution: string[];
  terms: Record<string, Term>;
  gaps: Record<string, Gap>;
};

/** The articles a book links to, each with its verses in reading order. */
export function linkedArticles(rows: TwlRow[]): Map<string, string[]> {
  const sorted = [...rows].sort(
    (a, b) => a.chapter - b.chapter || a.verse - b.verse
  );
  const byArticle = new Map<string, string[]>();
  for (const r of sorted) {
    const refs = byArticle.get(r.article) ?? [];
    const ref = refOf(r);
    if (!refs.includes(ref)) refs.push(ref);
    byArticle.set(r.article, refs);
  }
  return new Map(
    [...byArticle].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );
}

/** The licence and attribution of a pinned source, as sources.json has them. */
export type Credit = { licence: string; attribution: string };

/**
 * One language's glossary for one book. `read` returns an article's pinned
 * markdown in that language, or undefined if it is not pinned; `english`
 * returns the English article; `credit` returns a pinned source's licence
 * and attribution. Every linked article must be either pinned or listed as
 * absent, never both. The sources a glossary draws on must share one
 * licence; a mix would need a decision, so it is refused.
 */
export async function buildGlossary(
  repo: TwRepo,
  book: string,
  rows: TwlRow[],
  english: (article: string) => Promise<string>,
  read: (article: string) => Promise<string | undefined>,
  credit: (id: string) => Credit
): Promise<Glossary> {
  const absent = repo.absent;
  const linked = linkedArticles(rows);
  const terms: Record<string, Term> = {};
  const gaps: Record<string, Gap> = {};
  for (const [article, refs] of linked) {
    const markdown = await read(article);
    const listed = absent.includes(article);
    if (markdown === undefined && listed) {
      gaps[article] = "no-article";
      continue;
    }
    if (markdown === undefined || listed) {
      throw new Error(
        `${repo.language} ${book}: ${article} must be pinned or listed as absent, not ${listed ? "both" : "neither"}`
      );
    }
    const word = headingOf(markdown);
    if (word === undefined) {
      gaps[article] = "no-heading";
      continue;
    }
    if (repo.script && !inScript(word, repo.script)) {
      gaps[article] = "english-headword";
      continue;
    }
    terms[article] = {
      en: headword(await english(article)),
      headword: word,
      source: twId(repo.language, article),
      refs,
    };
  }
  const used = [
    twlId(book),
    ...Object.entries(terms).flatMap(([a, t]) => [t.source, twId("en", a)]),
  ];
  const credits = used.map(credit);
  const licences = [...new Set(credits.map((c) => c.licence))];
  const [licence] = licences;
  if (licence === undefined || licences.length !== 1) {
    throw new Error(
      `${repo.language} ${book}: sources under ${licences.length} licences (${licences.join(", ")}), not one`
    );
  }
  return {
    language: repo.language,
    book,
    links: twlId(book),
    words: { repo: repo.repo, release: repo.release, commit: repo.commit },
    licence,
    attribution: [...new Set(credits.map((c) => c.attribution))],
    terms,
    gaps,
  };
}
