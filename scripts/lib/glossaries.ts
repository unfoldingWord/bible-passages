// Per-language glossaries of the key terms a book uses. Translation Word
// Links (TWL) say which Translation Words (tW) article each verse uses; each
// language's tW gives that article's headword in the language. Why these
// repos and not others: docs/scoping/glossaries.md.

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
   * For languages not written in Latin script: a headword with no letter of
   * this script is English left untranslated, and is recorded as a gap.
   */
  script?: RegExp;
  /**
   * tW articles a book links to that this release does not have, by book,
   * as measured when they were pinned. The build checks the pins against
   * this list, so a pin that goes missing is an error, not a silent gap.
   */
  absent: Record<string, string[]>;
};

/** The TWL every language uses: its links are keyed to the Greek and Hebrew. */
export const TWL = {
  repo: "unfoldingWord/en_twl",
  release: "v91",
  commit: "7cbb3419f79780ce84b92ad7d42bd476cc5d8a64",
};

export const TW: TwRepo[] = [
  {
    language: "en",
    door43: "en",
    repo: "unfoldingWord/en_tw",
    release: "v91",
    commit: "ff5b3852c27c3a0d01b109e482eb26047dcd20e2",
    absent: { TIT: [] },
  },
  {
    language: "ar",
    door43: "ar",
    repo: "BSOJ/ar_tw",
    release: "v5",
    commit: "7c233628947dee9ad1da0b1d6deddac663e66574",
    script: /\p{Script=Arabic}/u,
    absent: { TIT: [] },
  },
  {
    // Provisional: the tag for Spanish is an open decision
    // (docs/scoping/glossaries.md, "Spanish tag").
    language: "es-419",
    door43: "es-419",
    repo: "es-419_gl/es-419_tw",
    release: "v37",
    commit: "7586f4ff1f0483ea40a4a68e5e1f33158e08c208",
    absent: { TIT: ["other/age-timeperiod"] },
  },
  {
    language: "fr",
    door43: "fr",
    repo: "Xenizo/fr_tw",
    release: "v2.0",
    commit: "06db7f855a0deb302a47a0e4d1b22312833b2ca1",
    absent: { TIT: ["other/age-timeperiod"] },
  },
  {
    language: "hi",
    door43: "hi",
    repo: "translationCore-Create-BCS/hi_tw",
    release: "v8",
    commit: "5fa7b590a2e5f99ac6a84de96ee081e751e70b95",
    script: /\p{Script=Devanagari}/u,
    absent: { TIT: ["other/age-timeperiod"] },
  },
  {
    language: "id",
    door43: "id",
    repo: "bahtraku/id_tw",
    release: "v26",
    commit: "31c260398c056748118a5d9184aa1d5327b7dbdd",
    absent: { TIT: [] },
  },
  {
    language: "pt-BR",
    door43: "pt-br",
    repo: "Door43-Catalog/pt-br_tw",
    release: "v6.4",
    commit: "879ce3844fa3eadc94f714e45ec50f794d6fb27d",
    absent: {
      TIT: ["other/age-timeperiod", "other/strife", "other/subject"],
    },
  },
  {
    language: "ru",
    door43: "ru",
    repo: "ru_gl/ru_tw",
    release: "v14.2",
    commit: "861807f86dc5d532be57248a9225b5f124fc9563",
    script: /\p{Script=Cyrillic}/u,
    absent: { TIT: ["other/age-timeperiod"] },
  },
  {
    language: "sw",
    door43: "sw",
    repo: "Door43-Catalog/sw_tw",
    release: "v7.3",
    commit: "82e94cd4a7aad817365190fa5d48960c90a01fc9",
    absent: { TIT: ["other/age-timeperiod"] },
  },
];

const HOST = "https://git.door43.org";

export const twlId = (book: string) => `twl-en-${book.toLowerCase()}`;
export const twlUrl = (book: string) =>
  `${HOST}/${TWL.repo}/raw/commit/${TWL.commit}/twl_${book}.tsv`;

/** `kt/god` in fr → `tw-fr-kt-god`: a plain slug, as sources.ts requires. */
export const twId = (language: string, article: string) =>
  `tw-${language.toLowerCase()}-${article.replace("/", "-")}`;
export const twUrl = (repo: TwRepo, article: string) =>
  `${HOST}/${repo.repo}/raw/commit/${repo.commit}/bible/${article}.md`;

/** A tW article path, as TWL links name it: category and file name. */
export const ARTICLE = /^(kt|names|other)\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LINK = /^rc:\/\/\*\/tw\/dict\/bible\/(.+)$/;
const REF = /^(\d+):(\d+)$/;

export type TwlRow = { chapter: number; verse: number; article: string };

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
    rows.push({ chapter: Number(ref[1]), verse: Number(ref[2]), article });
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
  if (text === "") throw new Error("tW article: first line is not a heading");
  return text;
}

export type Term = {
  /** The English headword, so a reader of any language sees the concept. */
  en: string;
  /** The headword in this glossary's language. */
  headword: string;
  /** The sources.json id the headword was read from. */
  source: string;
  /** Verses that link the term, `c:v`, in reading order. */
  refs: string[];
};

/**
 * Why a linked article has no headword in a language: the release has no
 * such article, or its headword is still in English.
 */
export type Gap = "no-article" | "english-headword";

export type Glossary = {
  language: string;
  book: string;
  /** sources.json id of the TWL file the terms come from. */
  links: string;
  /** The Door43 repo and release the headwords come from. */
  words: { repo: string; release: string; commit: string };
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
    const ref = `${r.chapter}:${r.verse}`;
    if (!refs.includes(ref)) refs.push(ref);
    byArticle.set(r.article, refs);
  }
  return new Map(
    [...byArticle].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );
}

/**
 * One language's glossary for one book. `read` returns an article's pinned
 * markdown in that language, or undefined if it is not pinned; `english`
 * returns the English article. Every linked article must be either pinned
 * or listed as absent, never both.
 */
export async function buildGlossary(
  repo: TwRepo,
  book: string,
  rows: TwlRow[],
  english: (article: string) => Promise<string>,
  read: (article: string) => Promise<string | undefined>
): Promise<Glossary> {
  const absent = repo.absent[book];
  if (!absent) throw new Error(`${repo.language}: no absent list for ${book}`);
  const linked = linkedArticles(rows);
  for (const a of absent) {
    if (!linked.has(a)) {
      throw new Error(`${repo.language} ${book}: ${a} is absent but unlinked`);
    }
  }
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
    const word = headword(markdown);
    if (repo.script && !repo.script.test(word)) {
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
  return {
    language: repo.language,
    book,
    links: twlId(book),
    words: { repo: repo.repo, release: repo.release, commit: repo.commit },
    terms,
    gaps,
  };
}
