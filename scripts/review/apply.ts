// Writes reviews exported from the project site's Review page into
// data/drafts/<lang>/<BOOK>.json, then prints a summary for the PR body.
// All or nothing: any unknown title, stale wording or bad record and no file
// is written. Run `npm run build` after it; never commit to main.
//
//   node scripts/review/apply.ts <export.json> [--dry-run]
//
// The export is {"schema": "bp.review-export", "v": 1, "records": [...]},
// one record per item document, never a profile (docs/scoping/review-screen.md).
import {
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { applyReviews, summary, type DraftFile } from "../lib/review.ts";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error(
    "usage: node scripts/review/apply.ts <export.json> [--dry-run]"
  );
  process.exit(2);
}
const exported = JSON.parse(readFileSync(file, "utf8")) as {
  schema?: unknown;
  v?: unknown;
  records?: unknown;
};
if (exported.schema !== "bp.review-export" || exported.v !== 1) {
  console.error(`${file}: not a bp.review-export v1 file`);
  process.exit(1);
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

const { changed, applied, skipped, problems } = applyReviews(
  files,
  exported.records
);
if (problems.length) {
  console.error(`Refused; nothing written (${problems.length} problems):`);
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}
// Every file is written beside its target first and renamed only when all
// are written, so an interrupted run leaves no book half applied.
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
      })
    );
    staged.push([temp, target]);
  }
  for (const [temp, target] of staged) renameSync(temp, target);
}
console.log(
  (dry ? "Dry run; nothing written.\n\n" : "") +
    summary(applied) +
    (skipped.length
      ? `\n\n${skipped.length} already applied by an earlier batch, passed over.`
      : "")
);
