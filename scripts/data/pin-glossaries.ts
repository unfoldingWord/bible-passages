// Pins the Translation Word Links and Translation Words files the glossary
// build reads, writing their entries into sources.json. Run by hand when a
// book or a Translation Words release is added; the build never runs it.
//
//   node scripts/data/pin-glossaries.ts
//
// For each book in BOOKS it fetches the TWL file at the pinned commit, then,
// for each language, lists that release's files and pins every linked
// article it has. An article the release lacks must already be listed in
// the language's `absent` (scripts/lib/glossaries.ts), so a gap is always a
// recorded measurement. Each repo's manifest must say CC BY-SA 4.0.
import { createHash } from "node:crypto";
import { BOOKS } from "../lib/books.ts";
import {
  isGlossaryInput,
  linkedArticles,
  parseTwl,
  TW,
  TWL,
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

const pins: Source[] = [];
const pin = async (
  id: string,
  url: string,
  commit: string,
  attribution: string
) => {
  pins.push({
    id,
    url,
    revision: commit,
    sha256: sha256(await get(url)),
    licence: "CC-BY-SA-4.0",
    attribution,
  });
};

await checkLicence(TWL.repo, TWL.commit);
for (const repo of TW) await checkLicence(repo.repo, repo.commit);

for (const book of BOOKS) {
  const url = twlUrl(book);
  const tsv = await get(url);
  await pin(
    twlId(book),
    url,
    TWL.commit,
    `unfoldingWord Translation Word Links, ${TWL.repo} ${TWL.release}, CC BY-SA 4.0. Original work available at https://git.door43.org/${TWL.repo}`
  );
  const linked = [...linkedArticles(parseTwl(tsv.toString("utf8"))).keys()];
  for (const repo of TW) {
    const have = await files(repo.repo, repo.commit);
    const absent = repo.absent[book] ?? [];
    for (const article of linked) {
      const inRepo = have.has(`bible/${article}.md`);
      if (inRepo === absent.includes(article)) {
        throw new Error(
          `${repo.language} ${book}: ${article} is ${inRepo ? "in the repo but listed absent" : "missing but not listed absent"}`
        );
      }
      if (!inRepo) continue;
      const id = twId(repo.language, article);
      if (pins.some((p) => p.id === id)) continue;
      await pin(
        id,
        twUrl(repo, article),
        repo.commit,
        `Translation Words (${repo.door43}), ${repo.repo} ${repo.release}, CC BY-SA 4.0. Original work available at https://git.door43.org/${repo.repo}`
      );
    }
    console.log(`${book} ${repo.language}: pinned`);
  }
}

// Keep every other input; replace the glossary inputs wholesale.
const rest = sources().filter((s) => !isGlossaryInput(s.id));
await writeJson(new URL("../../sources.json", import.meta.url), {
  sources: [...rest, ...pins],
});
console.log(`${pins.length} glossary inputs pinned`);
