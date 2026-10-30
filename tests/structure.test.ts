import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkHistory, spans, type Retired } from "../scripts/lib/keys.ts";
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
/** `<lang>/<BOOK>.json` for every title file in data/titles/. */
const titleFiles = readdirSync(new URL("data/titles/", root), {
  withFileTypes: true,
})
  .filter((d) => d.isDirectory())
  .flatMap((d) => list(`data/titles/${d.name}/`).map((f) => `${d.name}/${f}`))
  .sort();
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

    // termsFor gives a chapter's `c:front` terms (a Psalm's superscription)
    // to every span that starts at verse 1, so a second verse-1 span in a
    // chapter would get them too (#118). Each level has exactly one.
    it("starts exactly one segment and one pericope at verse 1 of each chapter", () => {
      const chapters = Array.from(
        { length: vrs[book]?.length ?? 0 },
        (_, i) => i + 1
      );
      for (const level of ["segments", "pericopes"] as const) {
        const firsts = s[level]
          .filter((x) => x.start[1] === 1)
          .map((x) => x.start[0]);
        expect(firsts, `${book} ${level} starting at verse 1`).toEqual(
          chapters
        );
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

    // BSB's \h, except the two names the maintainer decided on #39, which
    // come from ULT's \toc2.
    it("takes its English book name from BSB, or ULT where decided", () => {
      const { name } = read(`data/titles/en/${book}.json`) as {
        name: { text: string; status: string; source: string };
      };
      const decided: Record<string, string> = {
        PSA: "Psalms",
        SNG: "Song of Songs",
      };
      const id = book.toLowerCase();
      if (decided[book] !== undefined)
        expect(name).toEqual({
          text: decided[book],
          status: "approved",
          source: `ult-${id}`,
        });
      else {
        expect(name.source).toBe(`bsb-${id}`);
        expect(name.status).toBe("unreviewed");
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

    it("has the same segments in dist/tc-mobile as in data", () => {
      const pkg = read(`dist/tc-mobile/${book}.json`) as {
        chapters: { segments: { key: string; reference: unknown }[] }[];
      };
      const dist = pkg.chapters.flatMap((c) => c.segments);
      expect(dist).toEqual(
        s.segments.map((x) => ({
          key: x.key,
          reference: {
            book,
            startChapter: x.start[0],
            startVerse: x.start[1],
            endChapter: x.end[0],
            endVerse: x.end[1],
          },
          thumbnail: null,
        }))
      );
    });
  });

  // Against every release tag (vX.Y.Z on main, naming its package.json
  // version); the release workflow sets RELEASE_TAG so a release is not
  // checked against itself. With no release yet only data/retired-keys.json
  // is checked. Fixtures for each failure are in tests/keys.test.ts.
  it("no released key is missing, moved or reused", () => {
    const { retired } = read("data/retired-keys.json") as { retired: Retired };
    const current = { spans: spans(structures.map(([, s]) => s)), retired };
    expect(
      checkHistory(fileURLToPath(root), current, process.env.RELEASE_TAG)
    ).toEqual([]);
  });

  // The rule the build applies to package segment keys
  // (scripts/lib/title-table.ts), held on the data itself for every entry,
  // pericope keys included, so `npm run verify` keeps it without the build.
  describe.each(titleFiles)("data/titles/%s", (file) => {
    it("has a known status and a non-empty, unpadded text for every key", () => {
      const t = read(`data/titles/${file}`) as {
        titles: Record<string, { text: unknown; status: unknown }>;
      };
      for (const [k, title] of Object.entries(t.titles)) {
        expect(
          ["unreviewed", "ai-checked", "human-reviewed", "approved"],
          `${k}: status`
        ).toContain(title.status);
        expect(typeof title.text, `${k}: text`).toBe("string");
        const text = title.text as string;
        expect(text.trim(), `${k}: empty`).not.toBe("");
        expect(text.trim(), `${k}: whitespace-padded`).toBe(text);
      }
    });
  });

  it.todo("every key has a title in every language marked complete");
  it.todo("titles fit the length and script rules for their language");
});
