// Pins the Translation Word Links and Translation Words files the glossary
// build reads, writing their entries into sources.json. Run by hand when a
// book or a Translation Words release is added; the build never runs it.
//
//   node scripts/data/pin-glossaries.ts
//
// It checks first that the TWL release has a file for exactly the books in
// TWL_BOOKS, and that each language's `absent` list
// (scripts/lib/glossary-absent.ts) is exactly the articles the TWL links,
// from any of those books, that the release lacks: so a gap is always a
// recorded measurement, re-derived here. Then, for each book in
// GLOSSARY_BOOKS, it pins the TWL file and, for each language, every linked
// article the release has. Each repo's manifest must say CC BY-SA 4.0.
import { createHash } from "node:crypto";
import {
  GLOSSARY_BOOKS,
  isGlossaryInput,
  linkedArticles,
  parseTwl,
  TW,
  TWL,
  TWL_BOOKS,
  twId,
  twlId,
  twlUrl,
  twUrl,
} from "../lib/glossaries.ts";
import { sources, type Source } from "../lib/sources.ts";
import { writeJson } from "../lib/write.ts";

const API = "https://git.door43.org/api/v1/repos";

async function get(url: string): Promise<Buffer> {
  const res = await fetch(url, { redirect: "error" });
  if (!res.ok) throw new Error(`GET ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const sha256 = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

async function checkLicence(repo: string, commit: string): Promise<void> {
  const manifest = (
    await get(
      `https://git.door43.org/${repo}/raw/commit/${commit}/manifest.yaml`
    )
  ).toString("utf8");
  const rights = /^\s*rights:\s*['"]?([^'"\n]+?)['"]?\s*$/m.exec(manifest)?.[1];
  if (rights !== "CC BY-SA 4.0") {
    throw new Error(`${repo}@${commit}: rights "${rights}", not CC BY-SA 4.0`);
  }
}

async function files(repo: string, commit: string): Promise<Set<string>> {
  const tree = JSON.parse(
    (
      await get(`${API}/${repo}/git/trees/${commit}?recursive=1&per_page=99999`)
    ).toString("utf8")
  ) as { truncated: boolean; tree: { path: string }[] };
  if (tree.truncated) throw new Error(`${repo}@${commit}: tree truncated`);
  return new Set(tree.tree.map((t) => t.path));
}

type Job = { id: string; url: string; commit: string; attribution: string };
const jobs: Job[] = [];
const queued = new Set<string>();
const queue = (job: Job) => {
  if (queued.has(job.id)) return;
  queued.add(job.id);
  jobs.push(job);
};

await checkLicence(TWL.repo, TWL.commit);
for (const repo of TW) await checkLicence(repo.repo, repo.commit);

for (const book of GLOSSARY_BOOKS) {
  if (!TWL_BOOKS.includes(book)) {
    throw new Error(`${book}: in GLOSSARY_BOOKS but not in TWL_BOOKS`);
  }
}

// The release's books are exactly TWL_BOOKS.
const twlFiles = [...(await files(TWL.repo, TWL.commit))]
  .map((f) => /^twl_([1-3A-Z]{3})\.tsv$/.exec(f)?.[1])
  .filter((b) => b !== undefined);
const released = TWL_BOOKS.filter((b) => twlFiles.includes(b));
if (
  released.length !== TWL_BOOKS.length ||
  twlFiles.length !== released.length
) {
  throw new Error(
    `${TWL.repo}@${TWL.commit} has ${twlFiles.sort().join(" ")}; TWL_BOOKS is ${TWL_BOOKS.join(" ")}`
  );
}

// Every book's links, and every article any of them links.
const linkedBy = new Map<string, string[]>();
for (const book of TWL_BOOKS) {
  const tsv = (await get(twlUrl(book))).toString("utf8");
  linkedBy.set(book, [...linkedArticles(parseTwl(tsv)).keys()]);
}
const allLinked = [...new Set([...linkedBy.values()].flat())].sort();
console.log(
  `${TWL_BOOKS.length} TWL books link ${allLinked.length} distinct articles`
);

for (const repo of TW) {
  const have = await files(repo.repo, repo.commit);
  const measured = allLinked.filter((a) => !have.has(`bible/${a}.md`));
  const listed = [...repo.absent].sort();
  const extra = listed.filter((a) => !measured.includes(a));
  const unlisted = measured.filter((a) => !listed.includes(a));
  if (extra.length > 0 || unlisted.length > 0) {
    throw new Error(
      `${repo.language}: absent list disagrees with ${repo.repo}@${repo.commit}: ` +
        `listed but present or unlinked: ${extra.join(" ") || "none"}; ` +
        `missing but not listed: ${unlisted.join(" ") || "none"}`
    );
  }
  console.log(`${repo.language}: ${measured.length} linked articles absent`);
  for (const book of GLOSSARY_BOOKS) {
    const linked = linkedBy.get(book);
    if (linked === undefined) throw new Error(`${book}: TWL not read`);
    for (const article of linked) {
      if (repo.absent.includes(article)) continue;
      queue({
        id: twId(repo.language, article),
        url: twUrl(repo, article),
        commit: repo.commit,
        attribution: `Translation Words (${repo.door43}), ${repo.repo} ${repo.release}, CC BY-SA 4.0. Original work available at https://git.door43.org/${repo.repo}`,
      });
    }
  }
}
// TWL files first, then each language's articles, as before.
const twlJobs: Job[] = GLOSSARY_BOOKS.map((book) => ({
  id: twlId(book),
  url: twlUrl(book),
  commit: TWL.commit,
  attribution: `unfoldingWord Translation Word Links, ${TWL.repo} ${TWL.release}, CC BY-SA 4.0. Original work available at https://git.door43.org/${TWL.repo}`,
}));
const all = [...twlJobs, ...jobs];

// Fetch a few at a time; the pins keep the order above.
const pins: Source[] = new Array(all.length);
let next = 0;
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (let i = next++; i < all.length; i = next++) {
      const job = all[i];
      if (job === undefined) throw new Error(`no pin job at ${i}`);
      pins[i] = {
        id: job.id,
        url: job.url,
        revision: job.commit,
        sha256: sha256(await get(job.url)),
        licence: "CC-BY-SA-4.0",
        attribution: job.attribution,
      };
    }
  })
);

// Every slot filled: a hole would be written to sources.json as null.
for (let i = 0; i < all.length; i++) {
  if (pins[i] === undefined) throw new Error(`pin ${all[i]?.id} not fetched`);
}

// Keep every other input; replace the glossary inputs wholesale, where the
// first of them stood (or at the end), so a re-run moves nothing else.
const before = sources();
const first = before.findIndex((s) => isGlossaryInput(s.id));
const at = first < 0 ? before.length : first;
const rest = (list: Source[]) => list.filter((s) => !isGlossaryInput(s.id));
// Say which glossary pins this run drops, so a run from a tree with fewer
// books or languages is visible, not silent.
const kept = new Set(pins.map((p) => p.id));
const dropped = before.filter((s) => isGlossaryInput(s.id) && !kept.has(s.id));
for (const s of dropped) console.log(`removed ${s.id}`);
console.log(`${dropped.length} glossary inputs removed`);
await writeJson(new URL("../../sources.json", import.meta.url), {
  sources: [...rest(before.slice(0, at)), ...pins, ...rest(before.slice(at))],
});
console.log(`${pins.length} glossary inputs pinned`);
