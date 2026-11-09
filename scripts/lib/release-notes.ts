// The counts and known issues a release's notes carry (docs/schema.md,
// "Releases"), from the built data: data/structure/, data/titles/<lang>/
// and, to say why a title is held back, data/drafts/<lang>/. Pure; the CLI
// scripts/release/notes.ts reads the files and checks the counts against
// dist/tc-mobile/.
import { builtTitle, type DisputedRecord } from "./dispute-titles.ts";
import { BLANK_SEGMENTS, BLANK_TITLE } from "./segment-titles.ts";
import type { Structure } from "./structure.ts";
import {
  SHIPPED_STATUSES,
  TITLE_STATUSES,
  type TitleEntries,
} from "./title-table.ts";

/**
 * Why a segment's title is `unreviewed`, so held back from the title table:
 *
 * - `dispute`: a third model's answer on a disputed title left it
 *   `unreviewed` (ADR 0005 item 6; `npm run disputes` lists them);
 * - `check`: the checker disagreed with the draft, or it failed a gate,
 *   and no third model has answered;
 * - `review`: a person's review set it `unreviewed`;
 * - `reused`: the segment is its pericope's only one and reuses the
 *   pericope's title, BSB's heading, which is `unreviewed` (decision 12).
 */
export const HELD_REASONS = ["dispute", "check", "review", "reused"] as const;
export type HeldReason = (typeof HELD_REASONS)[number];

export type Counts = {
  segments: number;
  /** Segment titles by status: every status the schema allows, at 0 too. */
  status: Record<string, number>;
  /**
   * English only: segments BSB leaves blank, each with the fixed English
   * title BLANK_TITLE (also counted in `status`). 0 in other languages,
   * where the build writes no title for them.
   */
  blank: number;
  /** `unreviewed` segment titles, by why they are held back. */
  held: Record<HeldReason, number>;
  /** Segments with no title: none was drafted or built for them. */
  notDrafted: number;
  pericopes: number;
  pericopeStatus: Record<string, number>;
  untitledPericopes: number;
};

const byStatus = (): Record<string, number> =>
  Object.fromEntries(TITLE_STATUSES.map((s) => [s, 0]));

export const emptyCounts = (): Counts => ({
  segments: 0,
  status: byStatus(),
  blank: 0,
  held: { dispute: 0, check: 0, review: 0, reused: 0 },
  notDrafted: 0,
  pericopes: 0,
  pericopeStatus: byStatus(),
  untitledPericopes: 0,
});

/** `into` plus `c`, field by field. */
export function addCounts(into: Counts, c: Counts): Counts {
  const add = (a: Record<string, number>, b: Record<string, number>) => {
    for (const k of Object.keys(b)) a[k] = (a[k] ?? 0) + b[k]!;
  };
  into.segments += c.segments;
  add(into.status, c.status);
  into.blank += c.blank;
  add(into.held, c.held);
  into.notDrafted += c.notDrafted;
  into.pericopes += c.pericopes;
  add(into.pericopeStatus, c.pericopeStatus);
  into.untitledPericopes += c.untitledPericopes;
  return into;
}

/** The lowest status a title table ships (SHIPPED_STATUSES is lowest first). */
export const SHIPPED_FLOOR = SHIPPED_STATUSES[0]!;

/** Titles shipped in the title tables: those at SHIPPED_FLOOR or above. */
export const shipped = (c: Counts): number =>
  SHIPPED_STATUSES.reduce((n, s) => n + (c.status[s] ?? 0), 0);

const same = (
  a: { text: string; status: string; source?: string },
  b: { text: string; status: string; source?: string }
) => a.text === b.text && a.status === b.status && a.source === b.source;

/**
 * One book's counts in `language`. `titles` is the built
 * data/titles/<lang>/<BOOK>.json `titles`, `drafts` the book's
 * data/drafts/<lang>/<BOOK>.json, if any. Throws, naming the key, on
 * anything it cannot account for: an unknown status, an English blank
 * segment without the fixed title (BLANK_TITLE is English; the build
 * writes it in English only), or an `unreviewed` segment title that is
 * neither a draft's nor its pericope's, so the notes never carry a count
 * that does not add up.
 */
export function countBook(
  language: string,
  structure: Structure,
  titles: TitleEntries,
  drafts?: DisputedRecord
): Counts {
  const c = emptyCounts();
  const status = (key: string, s: string) => {
    if (!TITLE_STATUSES.includes(s))
      throw new Error(`${key}: unknown status "${s}"`);
    return s;
  };
  for (const p of structure.pericopes) {
    c.pericopes++;
    const t = titles[p.key];
    if (t === undefined) c.untitledPericopes++;
    else c.pericopeStatus[status(p.key, t.status)]!++;
  }
  const perPericope = new Map<string, number>();
  for (const s of structure.segments)
    perPericope.set(s.pericope, (perPericope.get(s.pericope) ?? 0) + 1);
  for (const s of structure.segments) {
    c.segments++;
    const t = titles[s.key];
    if (language === "en" && BLANK_SEGMENTS.includes(s.key)) {
      if (t === undefined || !same(t, BLANK_TITLE))
        throw new Error(`${s.key}: blank in BSB but not the fixed title`);
      c.blank++;
    }
    if (t === undefined) {
      c.notDrafted++;
      continue;
    }
    c.status[status(s.key, t.status)]!++;
    if (t.status !== "unreviewed") continue;
    const draft = drafts?.titles[s.key];
    const pericope = titles[s.pericope];
    if (draft !== undefined) {
      if (!same(t, builtTitle(draft)))
        throw new Error(`${s.key}: title is not its draft's as built`);
      c.held[draft.review ? "review" : draft.dispute ? "dispute" : "check"]++;
    } else if (
      perPericope.get(s.pericope) === 1 &&
      pericope !== undefined &&
      same(t, pericope)
    )
      c.held.reused++;
    else
      throw new Error(
        `${s.key}: unreviewed title that is neither a draft's nor its pericope's`
      );
  }
  return c;
}

/**
 * The segment titles a book's title table must hold, key to text: every
 * segment of `structure` whose title in `titles` is at SHIPPED_FLOOR or
 * above, with its text as stored. It re-derives the table rather than
 * calling titleTable (title-table.ts), which writes the same rule: ship a
 * title whose status is in SHIPPED_STATUSES, text unchanged (it throws on
 * an empty or padded text rather than trimming it).
 */
export function shippedSegments(
  structure: Structure,
  titles: TitleEntries
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of structure.segments) {
    const t = titles[s.key];
    if (t !== undefined && SHIPPED_STATUSES.includes(t.status))
      out[s.key] = t.text;
  }
  return out;
}

/** A title table's `segments` shape: an object of string values. */
export const isSegmentMap = (v: unknown): v is Record<string, string> =>
  typeof v === "object" &&
  v !== null &&
  !Array.isArray(v) &&
  Object.values(v).every((t) => typeof t === "string");

/**
 * How a title table's `segments` (`table`, at `where`) differs from what
 * data/ ships (`expected`, from shippedSegments): each key on one side
 * only, and each key whose text differs, so equal counts with different
 * keys still fail. A `table` that is not an object of strings is one
 * problem.
 */
export function tableProblems(
  where: string,
  expected: Record<string, string>,
  table: unknown
): string[] {
  if (!isSegmentMap(table))
    return [`${where}: segments is not an object of strings`];
  const problems: string[] = [];
  for (const key of Object.keys(expected))
    if (!Object.hasOwn(table, key))
      problems.push(
        `${where}: ${key} is at ${SHIPPED_FLOOR} or above in data/ but not in the table`
      );
    else if (table[key] !== expected[key])
      problems.push(`${where}: ${key} differs from its title in data/`);
  for (const key of Object.keys(table))
    if (!Object.hasOwn(expected, key))
      problems.push(
        `${where}: ${key} is in the table but not at ${SHIPPED_FLOOR} or above in data/`
      );
  return problems;
}

/** One entry of known-issues.json. */
export type KnownIssue = {
  /** The GitHub issue that tracks it, in this repository. */
  issue: number;
  /** One line, plain: what is wrong and what it means for a user. */
  text: string;
  /** The title it is about, if one: a key and the language it is in. */
  key?: string;
  language?: string;
};

/**
 * What is wrong with known-issues.json's content, given a lookup of the
 * built title for (language, key). Every field is checked, so one run
 * lists every problem.
 */
export function knownIssueProblems(
  value: unknown,
  title: (language: string, key: string) => { text: string } | undefined
): string[] {
  const problems: string[] = [];
  const issues = (value as { issues?: unknown } | null)?.issues;
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).join() !== "issues" ||
    !Array.isArray(issues)
  )
    return ['known-issues.json: not { "issues": [...] }'];
  issues.forEach((raw: unknown, i) => {
    const at = `known-issues.json issues[${i}]`;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      problems.push(`${at}: not an object`);
      return;
    }
    const e = raw as Record<string, unknown>;
    for (const k of Object.keys(e))
      if (!["issue", "text", "key", "language"].includes(k))
        problems.push(`${at}: unknown field ${JSON.stringify(k)}`);
    if (!Number.isSafeInteger(e.issue) || (e.issue as number) < 1)
      problems.push(`${at}: issue is not a positive whole number`);
    if (
      typeof e.text !== "string" ||
      e.text.trim() === "" ||
      e.text.trim() !== e.text ||
      /[\p{Cc}]/u.test(e.text)
    )
      problems.push(`${at}: text is not one trimmed, non-empty line`);
    if ((e.key === undefined) !== (e.language === undefined))
      problems.push(`${at}: key and language go together`);
    else if (e.key !== undefined) {
      if (typeof e.key !== "string" || typeof e.language !== "string")
        problems.push(`${at}: key and language are not strings`);
      else if (title(e.language, e.key) === undefined)
        problems.push(`${at}: ${e.language} has no title for ${e.key}`);
    }
  });
  return problems;
}

/** A Markdown table cell or line from free text: one line, no `|`. */
const inline = (s: string) =>
  s.replace(/\s+/g, " ").replace(/\|/g, "\\|").trim();

/**
 * The release notes, in Markdown. `languages` maps each language to its
 * counts, in order; `issues` have passed knownIssueProblems, and `title`
 * gives each one's built title and status.
 */
export function renderNotes(args: {
  tag: string;
  languages: [language: string, counts: Counts][];
  shippedBooks: [language: string, books: [book: string, n: number][]][];
  issues: KnownIssue[];
  title: (
    language: string,
    key: string
  ) => { text: string; status: string } | undefined;
}): string {
  const { tag, languages, shippedBooks, issues, title } = args;
  const total = languages.reduce((t, [, c]) => addCounts(t, c), emptyCounts());
  const cols = [...languages.map(([l]) => l), "Total"];
  const all = [...languages.map(([, c]) => c), total];
  type Row = readonly [label: string, value: (c: Counts) => number];
  const table = (rows: readonly Row[]) => [
    `| | ${cols.join(" | ")} |`,
    `| --- | ${cols.map(() => "---:").join(" | ")} |`,
    ...rows.map(([label, f]) => `| ${label} | ${all.map(f).join(" | ")} |`),
  ];
  const statuses = [...TITLE_STATUSES].reverse();
  const lines = [
    `tc-mobile template packages v0 and their title tables (titles.<lang>.<BOOK>.json) for ${tag}, built from the pinned sources in sources.json at this tag. See docs/schema.md, "Releases".`,
    "",
    "## Titles",
    "",
    `Counted from the built data/ at this tag (scripts/release/notes.ts). "Total" adds the languages together. A title table ships a segment title at \`${SHIPPED_FLOOR}\` or above; an \`unreviewed\` one is held back, and the app shows no label. The tables hold plain strings, so the app cannot tell the statuses apart (unfoldingWord/tc-mobile#1450).`,
    "",
    "### Segment titles",
    "",
    ...table([
      ["Segments", (c) => c.segments],
      ["Titled", (c) => c.segments - c.notDrafted],
      ...statuses.map(
        (s) => [`… \`${s}\``, (c: Counts) => c.status[s] ?? 0] as const
      ),
      [`Shipped (\`${SHIPPED_FLOOR}\` or above)`, shipped],
      ["Not shipped", (c) => c.segments - shipped(c)],
      [
        "… held: a third model's answer left it `unreviewed`",
        (c) => c.held.dispute,
      ],
      ["… held: the checker disagreed or a gate failed", (c) => c.held.check],
      ["… held: a person's review set it `unreviewed`", (c) => c.held.review],
      [
        "… held: reuses its pericope's `unreviewed` BSB heading",
        (c) => c.held.reused,
      ],
      ["… not drafted (no title)", (c) => c.notDrafted],
    ]),
    "",
    `Segments BSB numbers but leaves blank (${BLANK_SEGMENTS.join(", ")}), titled in English: ${total.blank}. They are never drafted: in English each has one fixed title a person chose, "${BLANK_TITLE.text}", counted above as \`${BLANK_TITLE.status}\`.`,
    "",
    ...shippedBooks.map(
      ([language, books]) =>
        `Books with segment titles shipped, ${language}: ${
          books.length === 0
            ? "none"
            : books.map(([b, n]) => `${b} (${n})`).join(", ")
        }.`
    ),
    "",
    "### Pericope titles",
    "",
    "English pericope titles are BSB’s section headings. Pericope titles are not in the title tables: tC Mobile reads segment keys only.",
    "",
    ...table([
      ["Pericopes", (c) => c.pericopes],
      ["Titled", (c) => c.pericopes - c.untitledPericopes],
      ...statuses.map(
        (s) => [`… \`${s}\``, (c: Counts) => c.pericopeStatus[s] ?? 0] as const
      ),
      ["No title", (c) => c.untitledPericopes],
    ]),
    "",
    "## Known issues",
    "",
    ...(issues.length === 0
      ? ["None listed."]
      : issues.map((i) => {
          const t =
            i.key !== undefined && i.language !== undefined
              ? title(i.language, i.key)
              : undefined;
          const about =
            t === undefined
              ? ""
              : `${i.key} (${i.language}, \`${t.status}\`): “${inline(t.text)}”. `;
          return `- ${about}${inline(i.text)} (#${i.issue})`;
        })),
    "",
    "Listed from known-issues.json at this tag.",
  ];
  return lines.join("\n") + "\n";
}
