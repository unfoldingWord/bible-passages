// Writes title reviews exported from the review artifact into
// data/drafts/<lang>/<BOOK>.json, then prints a summary for the PR body.
// All or nothing: any unknown title, stale wording, blind-comparison answer
// or bad record and no file is written. Run `npm run build` after it; never
// commit to main.
//
//   node scripts/review/apply.ts <export.json>... [--dry-run]
//
// Each file is {"schema": "bp.review-export", "v": 2,
// "reviewer": "reviewer:<handle>", "records": [...]}, one reviewer's answer
// documents unchanged (docs/schema.md, "Review exports").
import {
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";
import { applyReviews, summary, type DraftFile } from "../lib/review.ts";

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const unknown = args.filter((a) => a.startsWith("--") && a !== "--dry-run");
const paths = args.filter((a) => !a.startsWith("--"));
if (paths.length === 0 || unknown.length) {
  console.error(
    "usage: node scripts/review/apply.ts <export.json>... [--dry-run]"
  );
  process.exit(2);
}
const exports: unknown[] = [];
for (const path of paths) {
  try {
    exports.push(JSON.parse(readFileSync(path, "utf8")));
  } catch (err) {
    console.error(`${path}: ${(err as Error).message}`);
    process.exit(1);
  }
}

const drafts = new URL("../../data/drafts/", import.meta.url);
const files = new Map<string, DraftFile>();
for (const lang of existsSync(drafts) ? readdirSync(drafts) : []) {
  if (!statSync(new URL(lang, drafts)).isDirectory()) continue;
  for (const name of readdirSync(new URL(`${lang}/`, drafts))) {
    if (!name.endsWith(".json")) continue;
    const id = `${lang}/${name.slice(0, -5)}`;
    files.set(
      id,
      JSON.parse(readFileSync(new URL(`${id}.json`, drafts), "utf8"))
    );
  }
}

// The built English titles, for a translation whose key has no English
// draft (pericopes, and segments that take their pericope's title).
const titlesEn = new URL("../../data/titles/en/", import.meta.url);
const english = new Map<string, Record<string, { text: string }>>();
for (const name of existsSync(titlesEn) ? readdirSync(titlesEn) : []) {
  if (!name.endsWith(".json")) continue;
  const table = JSON.parse(readFileSync(new URL(name, titlesEn), "utf8")) as {
    titles: Record<string, { text: string }>;
  };
  english.set(name.slice(0, -5), table.titles);
}

const { changed, applied, skipped, problems } = applyReviews(
  files,
  exports,
  Date.now(),
  english
);
if (problems.length) {
  console.error(`Refused; nothing written (${problems.length} problems):`);
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}
// Every file is written beside its target first and renamed only when all
// are written. The renames still run one file at a time (#56).
if (!dry) {
  const staged: [URL, URL][] = [];
  for (const [id, value] of changed) {
    const target = new URL(`${id}.json`, drafts);
    const temp = new URL(`${id}.json.review-tmp`, drafts);
    // Indented before prettier, which keeps an object expanded when its
    // source is: the diff shows the reviews, not a reflowed file.
    const options = (await resolveConfig(fileURLToPath(target))) ?? {};
    writeFileSync(
      temp,
      await format(JSON.stringify(value, null, 2), {
        ...options,
        parser: "json",
      }),
      // A leftover temp file (an interrupted run, or a link) is refused,
      // not followed or overwritten.
      { flag: "wx" }
    );
    staged.push([temp, target]);
  }
  for (const [temp, target] of staged) renameSync(temp, target);
}
console.log(
  (dry ? "Dry run; nothing written.\n\n" : "") +
    summary(applied) +
    (skipped.length
      ? `\n\n${skipped.length} saved no later than a review already applied (applied or overtaken by an earlier batch), passed over:\n` +
        skipped
          .map(({ by, record: r }) => `- ${r.lang}~${r.key} ${by} ${r.at}`)
          .join("\n")
      : "")
);
