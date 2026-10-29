import { readFileSync } from "node:fs";
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
