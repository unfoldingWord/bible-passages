// Pins the BSB USFM files and UFW chunk files the structure build reads,
// writing their entries into sources.json. Run by hand when a book is added
// or a pinned commit changes; the build never runs it.
//
//   node scripts/data/pin-structure.ts
//
// For each book in ALL_BOOKS it fetches `<NN>-<BOOK>.usfm` from en_bsb and
// `chunks/<book>.json` from the versification repo at the pinned commits,
// and pins each file's SHA-256 with the same licence and attribution the
// Titus pins carry. A file whose pin already exists must have the same URL,
// hash, licence and attribution, so re-running cannot silently move an input.
import { createHash } from "node:crypto";
import { ALL_BOOKS } from "../lib/books.ts";
import { sources, type Source } from "../lib/sources.ts";
import { writeJson } from "../lib/write.ts";

const BSB = {
  repo: "Worldview/en_bsb",
  commit: "7abbfafaa2225e9add01f00bb01e4124a698f018",
};
const VERSIFICATION = {
  repo: "Door43-Catalog/versification",
  commit: "af14923581a0a16efe0c319bfd2f283f26476fac",
};

async function get(url: string): Promise<Buffer> {
  const res = await fetch(url, { redirect: "error" });
  if (!res.ok) throw new Error(`GET ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const sha256 = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

const raw = (repo: { repo: string; commit: string }, path: string) =>
  `https://git.door43.org/${repo.repo}/raw/commit/${repo.commit}/${path}`;

// BSB's LICENSE.md dedicates the text to the public domain; the pin says so
// only while the file at the pinned commit still does.
const terms = (await get(raw(BSB, "LICENSE.md"))).toString("utf8");
if (!/dedicated to the public domain/.test(terms)) {
  throw new Error(`${BSB.repo}@${BSB.commit}: LICENSE.md is not public domain`);
}

const existing = new Map(sources().map((s) => [s.id, s]));
const pin = async (s: Omit<Source, "sha256">): Promise<Source> => {
  const { id, url, revision, licence, attribution } = s;
  const pinned = {
    id,
    url,
    revision,
    sha256: sha256(await get(url)),
    licence,
    attribution,
  };
  const old = existing.get(id);
  if (old && JSON.stringify(old) !== JSON.stringify(pinned)) {
    throw new Error(`${id}: already pinned differently`);
  }
  return pinned;
};

const bsb: Source[] = [];
const chunks: Source[] = [];
for (const [book, file] of ALL_BOOKS) {
  const id = book.toLowerCase();
  bsb.push(
    await pin({
      id: `bsb-${id}`,
      url: raw(BSB, `${file}-${book}.usfm`),
      revision: BSB.commit,
      licence: "Public domain",
      attribution:
        "Berean Standard Bible (BSB), section headings, public domain",
    })
  );
  chunks.push(
    await pin({
      id: `ufw-chunks-${id}`,
      url: raw(VERSIFICATION, `bible/ufw/chunks/${id}.json`),
      revision: VERSIFICATION.commit,
      licence: "CC-BY-SA-4.0",
      attribution:
        "unfoldingWord chunk divisions, CC BY-SA 4.0. Original work available at https://door43.org/",
    })
  );
  console.log(`${book}: pinned`);
}

// Keep every other input where it is. A structure pin already in the file
// keeps its place, new ones go at the end, and one for a book no longer in
// ALL_BOOKS is dropped, so a re-run only ever appends.
const ours = (id: string) =>
  id.startsWith("bsb-") || id.startsWith("ufw-chunks-");
const pins = new Map([...bsb, ...chunks].map((s) => [s.id, s]));
const kept = sources()
  .filter((s) => !ours(s.id) || pins.has(s.id))
  .map((s) => pins.get(s.id) ?? s);
const placed = new Set(kept.map((s) => s.id));
await writeJson(new URL("../../sources.json", import.meta.url), {
  sources: [...kept, ...[...pins.values()].filter((s) => !placed.has(s.id))],
});
console.log(`${pins.size} structure inputs pinned`);
