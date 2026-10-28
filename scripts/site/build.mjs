// Builds site/index.html from site/index.src.html by inlining the baseline
// snapshot and the per-book counts. The published page renders from these
// until a newer snapshot is read from the page's database.
//
//   node scripts/site/snapshot.mjs > site/snapshot.json
//   node scripts/site/build.mjs

import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../../site/", import.meta.url);
const read = (f) => readFileSync(new URL(f, root), "utf8");

const snapshot = JSON.parse(read("snapshot.json"));
const books = JSON.parse(read("books.json"));
if (snapshot.schema !== "bp.snapshot") throw new Error("not a bp.snapshot");
if (books.length !== 66) throw new Error(`books.json has ${books.length} books`);

const html = read("index.src.html")
  .replace("/*SNAPSHOT*/null", JSON.stringify(snapshot))
  .replace("/*BOOKS*/null", JSON.stringify(books));
if (html.includes("/*SNAPSHOT*/") || html.includes("/*BOOKS*/")) {
  throw new Error("placeholder not replaced");
}
writeFileSync(new URL("index.html", root), html);
