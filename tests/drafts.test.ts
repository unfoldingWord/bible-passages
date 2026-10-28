import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Title = { text: string; status: string; source: string };
const read = (path: string) =>
  JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));

const structure = read("data/structure/TIT.json") as {
  segments: { key: string }[];
};
const drafts = (
  read("data/drafts/en/TIT.json") as {
    titles: Record<string, Title>;
  }
).titles;
const built = (
  read("data/titles/en/TIT.json") as {
    titles: Record<string, Title>;
  }
).titles;
const MAX = 60;

describe("English Titus segment drafts", () => {
  it("has a draft for every segment and none for an unknown key", () => {
    const keys = structure.segments.map((s) => s.key);
    expect(Object.keys(drafts).sort()).toEqual([...keys].sort());
  });

  it("labels every draft as AI output, unreviewed", () => {
    for (const d of Object.values(drafts)) {
      expect(d.source).toMatch(/^ai:/);
      expect(d.status).toBe("unreviewed");
    }
  });

  it(`keeps each title within ${MAX} characters, plain and non-empty`, () => {
    for (const d of Object.values(drafts)) {
      expect(d.text.length).toBeGreaterThan(0);
      expect(d.text.length).toBeLessThanOrEqual(MAX);
      expect(d.text).toBe(d.text.trim());
      expect(d.text).not.toMatch(/[.“”"]$|^["“]/);
    }
  });

  it("is merged into the built title table", () => {
    for (const [key, d] of Object.entries(drafts))
      expect(built[key]).toEqual(d);
  });
});
