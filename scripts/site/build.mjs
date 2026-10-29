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

// JSON inside a <script> element: "<" is escaped so text such as an issue
// title cannot close the element, and U+2028/U+2029 so older parsers accept
// it. A function replacer keeps "$&" or "$'" in the data from being read as
// replacement patterns.
const inline = (value) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

const html = read("index.src.html")
  .replace("/*SNAPSHOT*/null", () => inline(snapshot))
  .replace("/*BOOKS*/null", () => inline(books));
if (html.includes("/*SNAPSHOT*/") || html.includes("/*BOOKS*/")) {
  throw new Error("placeholder not replaced");
}
writeFileSync(new URL("index.html", root), html);
