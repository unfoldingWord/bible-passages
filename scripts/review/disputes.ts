// Lists the English titles a third model sorted as factual disputes (ADR
// 0005 item 6), for the content team and the release notes: one Markdown
// table over every record in data/drafts/en/, and the count by kind.
//
//   node scripts/review/disputes.ts [--all]
//
// --all lists the taste disputes too. Offline; reads committed files only.
import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { BOOKS } from "../lib/books.ts";
import {
  listDisputes,
  type DisputedRecord,
  type Listed,
} from "../lib/dispute-titles.ts";

const { values } = parseArgs({
  options: { all: { type: "boolean", default: false } },
});

const root = new URL("../../", import.meta.url);
const cell = (s: string) =>
  s.replace(/\s+/g, " ").replace(/\p{C}/gu, "").replace(/\|/g, "\\|");

const rows: Listed[] = [];
const counts = { factual: 0, taste: 0 };
for (const book of BOOKS) {
  const file = new URL(`data/drafts/en/${book}.json`, root);
  if (!existsSync(file)) continue;
  const record = JSON.parse(readFileSync(file, "utf8")) as DisputedRecord;
  for (const d of listDisputes(record, true)) counts[d.kind]++;
  rows.push(...listDisputes(record, values.all));
}

console.log(
  `${counts.factual + counts.taste} disputed English titles settled by a third model: ` +
    `${counts.factual} factual, ${counts.taste} taste.`
);
console.log("");
console.log("| Key | Kind | Status | Draft | Third model’s title | Why | By |");
console.log("| --- | ---- | ------ | ----- | ------------------- | --- | -- |");
for (const r of rows)
  console.log(
    `| ${r.key} | ${r.kind} | ${r.status} | ${cell(r.draft)} | ${cell(r.text)} | ${cell(r.why)} | ${r.by} |`
  );
