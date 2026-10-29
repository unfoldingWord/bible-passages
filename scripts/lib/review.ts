// A person's review of a title, from the project site's Review page to
// data/drafts/<lang>/<BOOK>.json. The page cannot reach the repo, so its
// records are exported to a JSON file (docs/scoping/review-screen.md) and
// applied here. Everything is checked before anything is written: a record
// for an unknown title, or one made against wording that has since changed,
// stops the whole batch.
import { ALL_BOOKS } from "./books.ts";
import { leakProblems, titleProblems } from "./gates.ts";

/**
 * A reviewer's public name in the repo: a handle the reviewer chose or the
 * maintainer assigned, never a display name (AGENTS.md, "Privacy").
 */
export const HANDLE = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/;
/** A BCP 47 tag of the shape this repo uses (`en`, `es-419`, `zh-Hans`). */
export const TAG = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
/** The longest English title (tests/drafts.test.ts). */
export const MAX_EN = 60;
/** How far ahead of the applier's clock a record's time may be. */
export const MAX_SKEW_MS = 60 * 60 * 1000;
/** The longest reason kept with a review. */
export const MAX_WHY = 500;

/** Primary language subtags written right to left. */
const RTL = new Set(["ar", "fa", "he", "ps", "ur", "dv", "yi", "ckb", "ug"]);
export const direction = (tag: string): "rtl" | "ltr" =>
  RTL.has((tag.split("-")[0] ?? "").toLowerCase()) ? "rtl" : "ltr";

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

/** One record as the Review page writes it, one per reviewed title. */
export type ReviewRecord = {
  v: 1;
  handle: string;
  lang: string;
  book: string;
  key: string;
  action: "approve" | "edit";
  /** The wording the reviewer was shown. */
  seen: string;
  /** The reviewer's wording, for an edit. */
  text?: string;
  why?: string;
  /** When it was saved, an ISO 8601 UTC time. */
  at: string;
};

/** The title as it stands: a person's wording, else the draft's. */
export const current = (d: Draft): string => d.review?.text ?? d.text;

const FIELDS = new Set([
  "v",
  "handle",
  "lang",
  "book",
  "key",
  "action",
  "seen",
  "text",
  "why",
  "at",
]);
const PROFILE = new Set(["v", "handle", "at"]);
const BOOK_CODES = new Set(ALL_BOOKS.map(([code]) => code));
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

/** The shape problems of one exported record; none means it is a record. */
export function recordProblems(r: unknown): string[] {
  if (typeof r !== "object" || r === null || Array.isArray(r))
    return ["not an object"];
  const o = r as Record<string, unknown>;
  // The reviewer's profile document (review/<id>) sits beside their items;
  // an export that copied it in gets told so, not a list of missing fields.
  if (!("key" in o) && Object.keys(o).every((f) => PROFILE.has(f)))
    return ["a profile document; records are item documents only"];
  const p: string[] = [];
  for (const f of Object.keys(o)) if (!FIELDS.has(f)) p.push(`field "${f}"`);
  const str = (v: unknown): v is string => typeof v === "string";
  if (o.v !== 1) p.push("v is not 1");
  if (!str(o.handle) || !HANDLE.test(o.handle)) p.push("handle");
  if (!str(o.lang) || !TAG.test(o.lang)) p.push("lang");
  if (!str(o.book) || !BOOK_CODES.has(o.book)) p.push("book");
  if (!str(o.key) || o.key === "") p.push("key");
  if (o.action !== "approve" && o.action !== "edit") p.push("action");
  if (!str(o.seen) || o.seen === "") p.push("seen");
  if (!str(o.at) || !ISO.test(o.at) || Number.isNaN(Date.parse(o.at)))
    p.push("at");
  if (o.why !== undefined) {
    const w = o.why;
    if (!str(w) || w !== w.trim() || w === "" || w.length > MAX_WHY)
      p.push("why");
  }
  if (o.action === "edit") {
    if (!str(o.text)) p.push("text");
    if (o.why === undefined) p.push("an edit needs a reason (why)");
  } else if (o.text !== undefined) p.push("text on an approval");
  return p;
}

/** Problems with a reviewer's own wording for a title. */
export function wordingProblems(
  lang: string,
  value: string,
  english: string | undefined
): string[] {
  const p = leakProblems(value);
  if (value.length === 0) p.push("empty");
  if (lang === "en") {
    if (value.length > MAX_EN) p.push(`over ${MAX_EN} characters`);
    if (/[.“”"]$|^["“]/.test(value)) p.push("ends in a full stop or a quote");
  } else if (english === undefined) {
    p.push("no English title to check it against");
  } else {
    // The translation gates: script, length against English, an English
    // leak. leakProblems is already in.
    for (const q of titleProblems(lang, english, value))
      if (!p.includes(q)) p.push(q);
  }
  return p;
}

export type Applied = {
  record: ReviewRecord;
  before: string;
  after: string;
};

export type Batch = {
  changed: Map<string, DraftFile>;
  applied: Applied[];
  /** Records saved no later than the review an earlier batch applied. */
  skipped: ReviewRecord[];
  problems: string[];
};

const STATUS = ["unreviewed", "ai-checked", "human-reviewed", "approved"];

/**
 * The review a record leaves on a title. An approval never lowers a status
 * (an `approved` title stays approved); an edit is new wording, so it is
 * `human-reviewed` whatever the title was.
 */
function reviewFor(r: ReviewRecord, draft: Draft) {
  const after = r.action === "edit" ? (r.text ?? "") : r.seen;
  // The title's status now: a person's review decides it, else the draft's.
  const prior = draft.review?.status ?? draft.status;
  const kept =
    r.action === "approve" &&
    STATUS.indexOf(prior) > STATUS.indexOf("human-reviewed")
      ? prior
      : "human-reviewed";
  const review: Review = {
    by: `reviewer:${r.handle}`,
    at: r.at.slice(0, 10),
    status: kept,
    // The draft keeps its own wording in `text`; the review carries one
    // only when the person's title differs from it.
    ...(after !== draft.text ? { text: after } : {}),
    ...(r.why !== undefined ? { why: r.why } : {}),
    saved: r.at,
  };
  return { after, review };
}

/**
 * Applies records to draft files, oldest first, each against the wording
 * the ones before it left. Returns the files it changed, or every problem
 * and no files. `files` is keyed `<lang>/<BOOK>` and is not modified.
 */
export function applyReviews(
  files: ReadonlyMap<string, DraftFile>,
  records: unknown,
  now: number = Date.now()
): Batch {
  const none = (problems: string[]): Batch => ({
    changed: new Map(),
    applied: [],
    skipped: [],
    problems,
  });
  if (!Array.isArray(records)) return none(["records is not a list"]);
  const problems: string[] = [];
  const valid: ReviewRecord[] = [];
  records.forEach((r, i) => {
    const p = recordProblems(r);
    // `at` comes from the reviewer's device, and an applied review keeps it
    // as the time up to which later batches pass records over: one from the
    // future would close its title. Refused, not applied.
    if (
      p.length === 0 &&
      Date.parse((r as ReviewRecord).at) > now + MAX_SKEW_MS
    )
      p.push("at is in the future");
    if (p.length) problems.push(`record ${i}: ${p.join(", ")}`);
    else valid.push(r as ReviewRecord);
  });
  if (problems.length) return none(problems);

  // Oldest first, by time and not by string (`10:00:00Z` is before
  // `10:00:00.100Z`); ties broken so the order never depends on the export.
  const ordered = [...valid].sort(
    (a, b) =>
      Date.parse(a.at) - Date.parse(b.at) ||
      a.handle.localeCompare(b.handle) ||
      a.lang.localeCompare(b.lang) ||
      a.book.localeCompare(b.book) ||
      a.key.localeCompare(b.key)
  );
  // An export holds every review ever saved, and the page replaces a
  // reviewer's document when they review a title again, so history cannot
  // be rebuilt from it. Instead each applied review keeps the time its
  // record was saved: a record saved no later than that was applied before,
  // or was overtaken by one that was. Measured against the files as given.
  const appliedUpTo = (r: ReviewRecord): number => {
    const titles = files.get(`${r.lang}/${r.book}`)?.titles;
    const saved =
      titles && Object.hasOwn(titles, r.key)
        ? titles[r.key]?.review?.saved
        : undefined;
    return saved === undefined ? -Infinity : Date.parse(saved);
  };

  const changed = new Map<string, DraftFile>();
  const applied: Applied[] = [];
  const skipped: ReviewRecord[] = [];
  for (const r of ordered) {
    const id = `${r.lang}/${r.book}`;
    const where = `${r.handle} ${id} ${r.key}`;
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
      skipped.push(r);
      continue;
    }
    const before = current(draft);
    const { after, review } = reviewFor(r, draft);
    if (r.seen !== before) {
      problems.push(
        `${where}: stale, reviewed "${r.seen}" but the title is now "${before}"`
      );
      continue;
    }
    if (r.action === "edit") {
      if (after === before) {
        problems.push(`${where}: an edit that changes nothing`);
        continue;
      }
      const en = (changed.get(`en/${r.book}`) ?? files.get(`en/${r.book}`))
        ?.titles[r.key];
      const p = wordingProblems(r.lang, after, en && current(en));
      if (p.length) {
        problems.push(`${where}: ${p.join(", ")}`);
        continue;
      }
    }
    changed.set(id, {
      ...file,
      titles: { ...file.titles, [r.key]: { ...draft, review } },
    });
    applied.push({ record: r, before, after });
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
  return [
    `${applied.length} review${applied.length === 1 ? "" : "s"} applied.`,
    "",
    "| Lang | Key | Action | By | Was | Now | Why |",
    "| ---- | --- | ------ | -- | --- | --- | --- |",
    ...applied.map(
      ({ record: r, before, after }) =>
        `| ${r.lang} | ${r.key} | ${r.action} | reviewer:${r.handle} | ${cell(before)} | ${cell(after)} | ${cell(r.why ?? "")} |`
    ),
  ].join("\n");
}

/** Paragraph and poetry markers: they carry no text of their own. */
const PARAGRAPH = /\\(?:p|m|b|nb|pi\d?|q\d?|qr|qc|qa|li\d?|pc|mi)(?=\s|$)/g;
/** Lines that hold no verse text: book headers, headings, references. */
const NOT_TEXT =
  /^\\(?:id|usfm|h|toc\d?|mt\d?|s\d?|r|d|ms\d?|mr|sp|cl)(?=\s|$)/;

/**
 * Plain verse text from aligned USFM, keyed `<chapter>:<verse>`: word
 * attributes, alignment milestones and footnotes removed. Fails on any
 * marker it does not know rather than show it to a reviewer.
 */
export function verseText(usfm: string): Map<string, string> {
  const clean = usfm
    .replace(/\\f\s[\s\S]*?\\f\*/g, "")
    .replace(/\\x\s[\s\S]*?\\x\*/g, "")
    .replace(/\\zaln-s\s[^\\]*\\\*/g, "")
    .replace(/\\zaln-e\\\*/g, "")
    .replace(/\\\+?w\s+([^|\\]*)(?:\|[^\\]*)?\\\+?w\*/g, "$1");
  const out = new Map<string, string>();
  let chapter = 0;
  let key: string | null = null;
  let buf = "";
  const flush = () => {
    if (key !== null) {
      const text = buf.replace(PARAGRAPH, "").replace(/\s+/g, " ").trim();
      if (text === "" || text.includes("\\"))
        throw new Error(`${key}: cannot read verse text "${text}"`);
      out.set(key, text);
    }
    key = null;
    buf = "";
  };
  for (const line of clean.split("\n")) {
    if (NOT_TEXT.test(line)) continue;
    const c = /^\\c\s+(\d+)/.exec(line);
    if (c) {
      flush();
      chapter = Number(c[1]);
      continue;
    }
    // A line may hold paragraph markers and one or more verses.
    for (const part of line.split(/(?=\\v\s+\d+)/)) {
      const v = /^\\v\s+(\d+)\s*/.exec(part);
      if (v) {
        flush();
        key = `${chapter}:${v[1]}`;
        buf = part.slice(v[0].length);
      } else if (key !== null) buf += " " + part;
    }
    buf += " ";
  }
  flush();
  return out;
}
