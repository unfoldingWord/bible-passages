import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Structure } from "../scripts/lib/structure.ts";

// Checks on data/structure/ and data/titles/. See docs/schema.md, "Checks".
const root = new URL("../", import.meta.url);
const read = (path: string) =>
  JSON.parse(readFileSync(new URL(path, root), "utf8")) as unknown;
const list = (dir: string) => {
  try {
    return readdirSync(new URL(dir, root)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
};

const vrs = read("data/versification/ufw.json") as Record<string, number[]>;
const books = list("data/structure/").map((f) => f.replace(/\.json$/, ""));
const structures = books.map(
  (b) => [b, read(`data/structure/${b}.json`) as Structure] as const
);

/** Every verse of the book, as "c:v", in order. */
function verses(book: string): string[] {
  return (vrs[book] ?? []).flatMap((last, i) =>
    Array.from({ length: last }, (_, v) => `${i + 1}:${v + 1}`)
  );
}

function covered(
  spans: Structure["segments"] | Structure["pericopes"]
): string[] {
  return spans.flatMap(({ start, end }) => {
    expect(start[0], "spans stay in one chapter").toBe(end[0]);
    return Array.from(
      { length: end[1] - start[1] + 1 },
      (_, i) => `${start[0]}:${start[1] + i}`
    );
  });
}

describe("data/structure", () => {
  it("holds at least one book", () => {
    expect(books.length).toBeGreaterThan(0);
  });

  describe.each(structures)("%s", (book, s) => {
    it("names its book and versification", () => {
      expect(s.book).toBe(book);
      expect(s.versification).toBe("ufw");
      expect(vrs[book], `${book} is not in ufw.vrs`).toBeDefined();
    });

    it("has every verse in exactly one pericope, in reading order", () => {
      expect(covered(s.pericopes)).toEqual(verses(book));
    });

    it("has every verse in exactly one segment, in reading order", () => {
      expect(covered(s.segments)).toEqual(verses(book));
    });

    it("keys are unique, match the key format and name their own span", () => {
      const keys = [...s.pericopes, ...s.segments].map((x) => x.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const k of keys)
        expect(k).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/);
      for (const p of s.pericopes) {
        expect(p.key).toBe(`${book}.P.${p.start[0]}.${p.start[1]}-${p.end[1]}`);
      }
      for (const x of s.segments) {
        expect(x.key).toBe(`${book}.${x.start[0]}.${x.start[1]}-${x.end[1]}`);
      }
    });

    it("puts every segment inside the pericope it names", () => {
      for (const x of s.segments) {
        const p = s.pericopes.find((p) => p.key === x.pericope);
        expect(p, `${x.key}: no pericope ${x.pericope}`).toBeDefined();
        expect(x.start[0]).toBe(p?.start[0]);
        expect(x.start[1]).toBeGreaterThanOrEqual(p?.start[1] ?? Infinity);
        expect(x.end[1]).toBeLessThanOrEqual(p?.end[1] ?? -Infinity);
      }
    });

    it("has English titles only for keys in the structure", () => {
      const t = read(`data/titles/en/${book}.json`) as {
        language: string;
        book: string;
        titles: Record<
          string,
          { text: string; status: string; source: string }
        >;
      };
      expect(t.language).toBe("en");
      expect(t.book).toBe(book);
      const keys = new Set([...s.pericopes, ...s.segments].map((x) => x.key));
      for (const [k, title] of Object.entries(t.titles)) {
        expect(keys.has(k), `title for unknown key ${k}`).toBe(true);
        expect(title.text.trim()).not.toBe("");
        expect([
          "unreviewed",
          "ai-checked",
          "human-reviewed",
          "approved",
        ]).toContain(title.status);
      }
    });

    it("has the same segment keys in dist/tc-mobile as in data", () => {
      const pkg = read(`dist/tc-mobile/${book}.json`) as {
        chapters: { segments: { key: string }[] }[];
      };
      const dist = pkg.chapters.flatMap((c) => c.segments.map((x) => x.key));
      expect(dist).toEqual(s.segments.map((x) => x.key));
    });
  });

  it.todo("no key released in an earlier tag is missing, moved or reused");
  it.todo("every key has a title in every language marked complete");
  it.todo("titles fit the length and script rules for their language");
});
