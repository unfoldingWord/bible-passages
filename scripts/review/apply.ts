// Writes reviews exported from the project site's Review page into
// data/drafts/<lang>/<BOOK>.json, then prints a summary for the PR body.
// All or nothing: any unknown title, stale wording or bad record and no file
// is written. Run `npm run build` after it; never commit to main.
//
//   node scripts/review/apply.ts <export.json> [--dry-run]
//
// The export is {"schema": "bp.review-export", "v": 1, "records": [...]},
// one record per review document (docs/scoping/review-screen.md).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { applyReviews, summary, type DraftFile } from "../lib/review.ts";
import { writeJson } from "../lib/write.ts";

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
if (!dry)
  for (const [id, value] of changed)
    await writeJson(new URL(`${id}.json`, drafts), value);
console.log(
  (dry ? "Dry run; nothing written.\n\n" : "") +
    summary(applied) +
    (skipped.length
      ? `\n\n${skipped.length} already applied by an earlier batch, passed over.`
      : "")
);
