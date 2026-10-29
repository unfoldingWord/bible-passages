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
  // SHA-256 of LICENSE.md at that commit (1,743 bytes, fetched 2026-10-29),
  // which dedicates the text to the public domain ("officially dedicated to
  // the public domain as of April 30, 2023. All uses are freely
  // permitted.").
  licenceSha256:
    "1376c4cc2b40f8377172c87b5e5a4ebe8311f05ad288e95ecb4242f8d9838f44",
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

// The pins say "Public domain" only while LICENSE.md at the pinned commit is
// byte for byte the file that was read and found to say so. Any change to
// it, however small, stops the run until someone reads it again.
const terms = sha256(await get(raw(BSB, "LICENSE.md")));
if (terms !== BSB.licenceSha256) {
  throw new Error(
    `${BSB.repo}@${BSB.commit}: LICENSE.md sha256 ${terms} is not the one read and pinned (${BSB.licenceSha256})`
  );
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

// Keep every other input where it is. A structure pin is an id
// `bsb-<book>` or `ufw-chunks-<book>`, <book> a three-character book code;
// any other id, `ufw-vrs` or a later `bsb-` input among them, is not ours
// and is kept untouched. A structure pin already in the file keeps its
// place (and must be unchanged, see `pin`), a new one goes at the end, and
// one for a book no longer in ALL_BOOKS is dropped.
const ours = (id: string) => /^(?:bsb|ufw-chunks)-[a-z0-9]{3}$/.test(id);
const pins = new Map([...bsb, ...chunks].map((s) => [s.id, s]));
const kept = sources()
  .filter((s) => !ours(s.id) || pins.has(s.id))
  .map((s) => pins.get(s.id) ?? s);
const placed = new Set(kept.map((s) => s.id));
await writeJson(new URL("../../sources.json", import.meta.url), {
  sources: [...kept, ...[...pins.values()].filter((s) => !placed.has(s.id))],
});
console.log(`${pins.size} structure inputs pinned`);
