// A person's review of a title, from the review artifact (a claude.ai page
// with its own database, outside this repo) to data/drafts/<lang>/<BOOK>.json.
// The artifact cannot reach the repo, so a work session exports its answer
// documents to a bp.review-export file (docs/schema.md, "Review exports") and
// they are applied here. Everything is checked before anything is written: a
// record for an unknown title, one made against wording that has since
// changed, or one that is not a title review stops the whole batch.
// Ported from PR #49; scoping in docs/scoping/review-apply.md.
import { ALL_BOOKS } from "./books.ts";
import { leakProblems, titleProblems } from "./gates.ts";
import { gateProblems } from "./segment-titles.ts";

export const EXPORT_SCHEMA = "bp.review-export";
export const EXPORT_V = 2;
/**
 * A reviewer's public name in the repo: `reviewer:` and a handle the work
 * session assigns when it exports, never a display name or an account id
 * (AGENTS.md, "Privacy").
 */
export const REVIEWER = /^reviewer:[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/;
/** A BCP 47 tag of the shape this repo uses (`en`, `es-419`, `zh-Hans`). */
export const TAG = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
/** How far ahead of the applier's clock a record's time may be. */
export const MAX_SKEW_MS = 60 * 60 * 1000;
/** The longest reason kept with a review. */
export const MAX_WHY = 500;

export type Review = {
  by: string;
  at: string;
  status: string;
  text?: string;
  why?: string;
  /** When the applied record was saved (its `at`, in full). */
  saved?: string;
};
export type Draft = {
  text: string;
  source: string;
  status: string;
  review?: Review;
  [field: string]: unknown;
};
export type DraftFile = {
  language: string;
  book: string;
  titles: Record<string, Draft>;
};

/**
 * One answer document as the review artifact writes it, under
 * `reviews/<uid>/answers/<lang>~<key>`. Only `keep` and `change` are title
 * reviews; the artifact's blind-comparison tabs write other picks.
 */
export type Answer = {
  v: 1;
  /** When it was saved, an ISO 8601 UTC time from the reviewer's device. */
  at: string;
  /** True exactly when `pick` is `change`. */
  changed: boolean;
  key: string;
  lang: string;
  /** Milliseconds the reviewer spent on the title. */
  ms: number;
  /** The reason: required for a change, optional for a keep. */
  note: string;
  pick: "keep" | "change";
  /** Blind-comparison candidate ids; empty for a title review. */
  shown: string[];
  /** For a keep, the wording shown; for a change, the reviewer's wording. */
  text: string;
};

/** The title as it stands: a person's wording, else the draft's. */
export const current = (d: Draft): string => d.review?.text ?? d.text;

const ENVELOPE = new Set(["schema", "v", "reviewer", "records"]);
const FIELDS = new Set([
  "v",
  "at",
  "changed",
  "key",
  "lang",
  "ms",
  "note",
  "pick",
  "shown",
  "text",
]);
const BOOK_CODES = new Set(ALL_BOOKS.map(([code]) => code));
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
/** Bidirectional embeddings, overrides and isolates: they reorder a diff. */
const BIDI = /[‪-‮⁦-⁩]/u;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string";
/** The book a key belongs to: its first part (`TIT.1.1-3`, `TIT.P.1.1-4`). */
export const bookOf = (key: string): string => key.split(".")[0] ?? "";

/** The shape problems of an export file; none means it is one. */
export function exportProblems(e: unknown): string[] {
  if (!isObject(e)) return ["not an object"];
  const p: string[] = [];
  for (const f of Object.keys(e)) if (!ENVELOPE.has(f)) p.push(`field "${f}"`);
  if (e.schema !== EXPORT_SCHEMA) p.push(`schema is not "${EXPORT_SCHEMA}"`);
  if (e.v !== EXPORT_V) p.push(`v is not ${EXPORT_V}`);
  if (!str(e.reviewer) || !REVIEWER.test(e.reviewer))
    p.push("reviewer is not reviewer:<handle>");
  if (!Array.isArray(e.records)) p.push("records is not a list");
  return p;
}

/** A reason as kept in data/drafts/: one line, no control or bidi marks. */
const plainWhy = (why: string) =>
  why
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\p{Cc}‪-‮⁦-⁩]/gu, "")
    .trim();

/** The shape problems of one answer record; none means it is a review. */
export function recordProblems(r: unknown): string[] {
  if (!isObject(r)) return ["not an object"];
  // A blind-comparison answer is a different question: say so, not which
  // of its fields differ from a review's.
  if (r.pick !== "keep" && r.pick !== "change")
    return [
      `pick ${JSON.stringify(r.pick)} is not "keep" or "change": a blind-comparison answer, not a title review`,
    ];
  const p: string[] = [];
  for (const f of Object.keys(r)) if (!FIELDS.has(f)) p.push(`field "${f}"`);
  if (r.v !== 1) p.push("v is not 1");
  if (!str(r.at) || !ISO.test(r.at) || Number.isNaN(Date.parse(r.at)))
    p.push("at");
  if (typeof r.changed !== "boolean" || r.changed !== (r.pick === "change"))
    p.push("changed does not match pick");
  if (
    !str(r.key) ||
    !/^[A-Z0-9]{3}\.\S+$/.test(r.key) ||
    !BOOK_CODES.has(bookOf(r.key))
  )
    p.push("key");
  if (!str(r.lang) || !TAG.test(r.lang)) p.push("lang");
  if (typeof r.ms !== "number" || !Number.isInteger(r.ms) || r.ms < 0)
    p.push("ms");
  if (!str(r.note) || r.note.length > MAX_WHY) p.push("note");
  else if (r.pick === "change" && plainWhy(r.note) === "")
    p.push("a change needs a reason (note)");
  if (!Array.isArray(r.shown)) p.push("shown");
  else if (r.shown.length > 0) p.push("shown is not empty");
  if (!str(r.text) || r.text === "") p.push("text");
  return p;
}

/**
 * Problems with a reviewer's own wording for a title: the gates an AI title
 * passes. English: the drafting gates (`gateProblems`) and the leak gate.
 * Other languages: the translation gates against the English title.
 */
export function wordingProblems(
  lang: string,
  value: string,
  english: string | undefined
): string[] {
  const p = leakProblems(value);
  if (BIDI.test(value)) p.push("bidi control character");
  if (lang === "en") {
    for (const q of gateProblems(value)) if (!p.includes(q)) p.push(q);
  } else if (english === undefined) {
    p.push("no English title to check it against");
  } else {
    for (const q of titleProblems(lang, english, value))
      if (!p.includes(q)) p.push(q);
  }
  return p;
}

/** A valid answer, with the reviewer its export named. */
export type Entry = { by: string; record: Answer };
export type Applied = Entry & { before: string; after: string };
export type Batch = {
  changed: Map<string, DraftFile>;
  applied: Applied[];
  /** Records saved no later than the review an earlier batch applied. */
  skipped: Entry[];
  problems: string[];
};

const STATUS = ["unreviewed", "ai-checked", "human-reviewed", "approved"];

/**
 * The review a record leaves on a title. A keep never lowers a status (an
 * `approved` title stays approved); a change is new wording, so it is
 * `human-reviewed` whatever the title was.
 */
function reviewFor({ by, record: r }: Entry, draft: Draft, after: string) {
  const prior = draft.review?.status ?? draft.status;
  const status =
    r.pick === "keep" &&
    STATUS.indexOf(prior) > STATUS.indexOf("human-reviewed")
      ? prior
      : "human-reviewed";
  const why = plainWhy(r.note);
  const review: Review = {
    by,
    at: r.at.slice(0, 10),
    status,
    // The draft keeps its own wording in `text`; the review carries one
    // only when the person's title differs from it.
    ...(after !== draft.text ? { text: after } : {}),
    ...(why !== "" ? { why } : {}),
    saved: r.at,
  };
  return review;
}

/**
 * Applies exports to draft files, oldest record first, each against the
 * wording the ones before it left. Returns the files it changed, or every
 * problem and no files. `files` is keyed `<lang>/<BOOK>` and is not
 * modified.
 */
export function applyReviews(
  files: ReadonlyMap<string, DraftFile>,
  exports: readonly unknown[],
  now: number = Date.now()
): Batch {
  const none = (problems: string[]): Batch => ({
    changed: new Map(),
    applied: [],
    skipped: [],
    problems,
  });
  const problems: string[] = [];
  const valid: Entry[] = [];
  const seen = new Set<string>();
  exports.forEach((e, n) => {
    const ep = exportProblems(e);
    if (ep.length) {
      problems.push(`export ${n}: ${ep.join(", ")}`);
      return;
    }
    const { reviewer: by, records } = e as {
      reviewer: string;
      records: unknown[];
    };
    records.forEach((r, i) => {
      const p = recordProblems(r);
      const a = r as Answer;
      // `at` comes from the reviewer's device, and an applied review keeps
      // it as the time up to which later batches pass records over: one
      // from the future would close its title. Refused, not applied.
      if (p.length === 0 && Date.parse(a.at) > now + MAX_SKEW_MS)
        p.push("at is in the future");
      // The artifact keeps one answer per reviewer and title; two in one
      // export means the export was put together wrongly.
      const id = `${by} ${a?.lang}~${a?.key}`;
      if (p.length === 0 && seen.has(id))
        p.push("a second record for this title");
      seen.add(id);
      const where = isObject(r) ? ` (${String(r.lang)}~${String(r.key)})` : "";
      if (p.length) problems.push(`${by} record ${i}${where}: ${p.join(", ")}`);
      else valid.push({ by, record: a });
    });
  });
  if (problems.length) return none(problems);

  // Oldest first, by time and not by string (`10:00:00Z` is before
  // `10:00:00.100Z`); ties broken so the order never depends on the export.
  const ordered = [...valid].sort(
    (a, b) =>
      Date.parse(a.record.at) - Date.parse(b.record.at) ||
      a.by.localeCompare(b.by) ||
      a.record.lang.localeCompare(b.record.lang) ||
      a.record.key.localeCompare(b.record.key)
  );
  // An export holds every reviewer's latest answer for each title (the
  // artifact replaces a reviewer's answer when they answer again), so
  // history cannot be rebuilt from it. Instead each applied review keeps the
  // time its record was saved: a record saved no later than that was
  // applied before, or was overtaken by one that was. Measured against the
  // files as given.
  const appliedUpTo = (r: Answer): number => {
    const titles = files.get(`${r.lang}/${bookOf(r.key)}`)?.titles;
    const saved =
      titles && Object.hasOwn(titles, r.key)
        ? titles[r.key]?.review?.saved
        : undefined;
    return saved === undefined ? -Infinity : Date.parse(saved);
  };

  const changed = new Map<string, DraftFile>();
  const applied: Applied[] = [];
  const skipped: Entry[] = [];
  for (const entry of ordered) {
    const r = entry.record;
    const book = bookOf(r.key);
    const id = `${r.lang}/${book}`;
    const where = `${entry.by} ${id} ${r.key}`;
    const file = changed.get(id) ?? files.get(id);
    if (!file) {
      problems.push(`${where}: no data/drafts/${id}.json`);
      continue;
    }
    const draft = Object.hasOwn(file.titles, r.key)
      ? file.titles[r.key]
      : undefined;
    if (!draft) {
      problems.push(`${where}: unknown key`);
      continue;
    }
    if (Date.parse(r.at) <= appliedUpTo(r)) {
      skipped.push(entry);
      continue;
    }
    const before = current(draft);
    if (r.pick === "keep" && r.text !== before) {
      // A keep's `text` is the wording the reviewer was shown.
      problems.push(
        `${where}: stale, kept "${r.text}" but the title is now "${before}"`
      );
      continue;
    }
    if (r.pick === "change") {
      // The artifact does not record the wording a change replaced. It is
      // taken to be the draft's own; a title a person has already reworded
      // is refused rather than overwritten (docs/scoping/review-apply.md).
      if (before !== draft.text) {
        problems.push(
          `${where}: the title is a person's wording ("${before}"), and a change does not say which wording it replaced`
        );
        continue;
      }
      if (r.text === before) {
        problems.push(`${where}: a change that changes nothing`);
        continue;
      }
      const en = (changed.get(`en/${book}`) ?? files.get(`en/${book}`))?.titles[
        r.key
      ];
      const p = wordingProblems(r.lang, r.text, en && current(en));
      if (p.length) {
        problems.push(`${where}: ${p.join(", ")}`);
        continue;
      }
    }
    const after = r.text;
    changed.set(id, {
      ...file,
      titles: {
        ...file.titles,
        [r.key]: { ...draft, review: reviewFor(entry, draft, after) },
      },
    });
    applied.push({ ...entry, before, after });
  }
  if (problems.length) return none(problems);
  return { changed, applied, skipped, problems };
}

/** A Markdown summary of a batch, for the PR body. */
export function summary(applied: Applied[]): string {
  // Control and format characters (bidi overrides, escapes) are dropped:
  // the reason is free text pasted into a PR body.
  const cell = (s: string) =>
    s.replace(/\s+/g, " ").replace(/\p{C}/gu, "").replace(/\|/g, "\\|");
  const secs = applied.map((a) => a.record.ms / 1000).sort((a, b) => a - b);
  const median =
    secs.length === 0
      ? 0
      : secs.length % 2
        ? secs[(secs.length - 1) / 2]!
        : (secs[secs.length / 2 - 1]! + secs[secs.length / 2]!) / 2;
  const s = (n: number) => `${Math.round(n)} s`;
  return [
    `${applied.length} review${applied.length === 1 ? "" : "s"} applied.`,
    ...(applied.length
      ? [
          `Time on these reviews: ${s(secs.reduce((x, y) => x + y, 0))} in all, median ${s(median)} (the artifact's \`ms\`).`,
        ]
      : []),
    "",
    "| Lang | Key | Pick | By | Was | Now | Why |",
    "| ---- | --- | ---- | -- | --- | --- | --- |",
    ...applied.map(
      ({ by, record: r, before, after }) =>
        `| ${r.lang} | ${r.key} | ${r.pick} | ${by} | ${cell(before)} | ${cell(after)} | ${cell(plainWhy(r.note))} |`
    ),
  ].join("\n");
}
