import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALL_BOOKS, BOOKS, STRUCTURE_BOOKS } from "../scripts/lib/books.ts";

// Every input the build reads is pinned here. See docs/schema.md, "sources.json".
type Source = {
  id: string;
  url: string;
  revision: string;
  sha256: string;
  licence: string;
  attribution: string;
};

const { sources } = JSON.parse(
  readFileSync(new URL("../sources.json", import.meta.url), "utf8")
) as { sources: Source[] };

describe("sources.json", () => {
  it("is a list", () => {
    expect(Array.isArray(sources)).toBe(true);
  });

  it("has unique ids", () => {
    const ids = sources.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(sources.map((s) => [s.id, s] as const))("%s is pinned", (_id, s) => {
    expect(s.id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
    expect(new URL(s.url).protocol).toMatch(/^https:$/);
    expect(s.revision.trim()).not.toBe("");
    expect(s.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(s.licence.trim()).not.toBe("");
    expect(s.attribution.trim()).not.toBe("");
    // The revision is the commit the URL reads from, not only a label.
    expect(s.url).toContain(`/commit/${s.revision}/`);
  });
});

// The structure inputs scripts/data/pin-structure.ts writes: one BSB file and
// one chunk file per book, at the same commits as Titus's and with the same
// licence and attribution.
describe("structure inputs", () => {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const vrs = JSON.parse(
    readFileSync(
      new URL("../data/versification/ufw.json", import.meta.url),
      "utf8"
    )
  ) as Record<string, number[]>;

  it("lists the 66 books of ufw.vrs in its order", () => {
    expect(ALL_BOOKS.map(([b]) => b)).toEqual(Object.keys(vrs).slice(0, 66));
    expect(Object.keys(vrs)[65]).toBe("REV");
  });

  // Titles are built only for books with a structure, and a structure only
  // for books the dataset knows.
  it("BOOKS ⊆ STRUCTURE_BOOKS ⊆ ALL_BOOKS", () => {
    const all = new Set(ALL_BOOKS.map(([b]) => b));
    const structure = new Set(STRUCTURE_BOOKS);
    expect(BOOKS.filter((b) => !structure.has(b))).toEqual([]);
    expect(STRUCTURE_BOOKS.filter((b) => !all.has(b))).toEqual([]);
    expect(BOOKS.length).toBeGreaterThan(0);
  });

  // Psalms and Song of Songs take their book name from ULT (#39), at one
  // released commit (v91).
  it("pins ULT for exactly the two book names decided on #39", () => {
    const ult = sources.filter((s) => s.id.startsWith("ult-"));
    expect(ult.map((s) => s.id)).toEqual(["ult-psa", "ult-sng"]);
    for (const [s, file] of [
      [ult[0], "19-PSA"],
      [ult[1], "22-SNG"],
    ] as const) {
      expect(s?.url).toBe(
        `https://git.door43.org/unfoldingWord/en_ult/raw/commit/35d215957f3203fd2e2fac5702ce14902d417f9d/${file}.usfm`
      );
      expect(s?.licence).toBe("CC-BY-SA-4.0");
    }
  });

  it("pins nothing for a book not in ALL_BOOKS", () => {
    const ids = new Set(
      ALL_BOOKS.flatMap(([b]) => [
        `bsb-${b.toLowerCase()}`,
        `ufw-chunks-${b.toLowerCase()}`,
      ])
    );
    const structure = sources.filter(
      (s) => s.id.startsWith("bsb-") || s.id.startsWith("ufw-chunks-")
    );
    expect(structure.map((s) => s.id).sort()).toEqual([...ids].sort());
  });

  it.each(ALL_BOOKS.map(([b, n]) => [b, n] as const))(
    "%s: BSB and chunk files pinned like Titus's",
    (book, file) => {
      const id = book.toLowerCase();
      const tit = {
        bsb: byId.get("bsb-tit"),
        chunks: byId.get("ufw-chunks-tit"),
      };
      const bsb = byId.get(`bsb-${id}`);
      const chunks = byId.get(`ufw-chunks-${id}`);
      expect(bsb?.url).toBe(
        `https://git.door43.org/Worldview/en_bsb/raw/commit/${tit.bsb?.revision}/${file}-${book}.usfm`
      );
      expect([bsb?.revision, bsb?.licence, bsb?.attribution]).toEqual([
        tit.bsb?.revision,
        tit.bsb?.licence,
        tit.bsb?.attribution,
      ]);
      expect(chunks?.url).toBe(
        `https://git.door43.org/Door43-Catalog/versification/raw/commit/${tit.chunks?.revision}/bible/ufw/chunks/${id}.json`
      );
      expect([chunks?.revision, chunks?.licence, chunks?.attribution]).toEqual([
        tit.chunks?.revision,
        tit.chunks?.licence,
        tit.chunks?.attribution,
      ]);
    }
  );
});

// The Chinese Union Version, read by the zh-Hans names check under
// docs/decisions/0004-cuv-names-check.md: one book file of Door43-Catalog/zh_cuv
// (release 1989) per book whose zh-Hans key terms are drafted, no more.
describe("CUV inputs", () => {
  const cuv = sources.filter((s) => s.id.startsWith("zh-cuv-"));
  const tit = cuv.find((s) => s.id === "zh-cuv-tit");

  it("pins Titus at the 1989 release, public domain by ADR 0004", () => {
    expect(tit?.revision).toBe("b993881167d730846cf2efcc1e0a1f58a3cd8b65");
    expect(tit?.licence).toBe("Public domain");
    expect(tit?.attribution).toContain("0004-cuv-names-check.md");
  });

  it("pins one book file per drafted zh-Hans book", () => {
    const drafted = readdirSync(
      new URL("../data/glossary-drafts/zh-Hans/", import.meta.url)
    )
      .filter((f) => f.endsWith(".json"))
      .map((f) => `zh-cuv-${f.slice(0, -5).toLowerCase()}`);
    expect(cuv.map((s) => s.id).sort()).toEqual(drafted.sort());
  });

  it.each(cuv.map((s) => [s.id, s] as const))(
    "%s: the book's file, pinned like Titus's",
    (id, s) => {
      const book = id.slice("zh-cuv-".length).toUpperCase();
      const file = ALL_BOOKS.find(([b]) => b === book)?.[1];
      expect(file).toBeDefined();
      expect(s.url).toBe(
        `https://git.door43.org/Door43-Catalog/zh_cuv/raw/commit/${tit?.revision}/${file}-${book}.usfm`
      );
      expect([s.revision, s.licence, s.attribution]).toEqual([
        tit?.revision,
        tit?.licence,
        tit?.attribution,
      ]);
    }
  );
});
