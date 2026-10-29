import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Title = { text: string; status: string; source: string };
type Draft = Title & {
  check?: { by: string; verdict: "agree" | "disagree"; suggestion?: string };
  review?: {
    by: string;
    at: string;
    status: string;
    text?: string;
    why?: string;
  };
};
const read = (path: string) =>
  JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));

const structure = read("data/structure/TIT.json") as {
  segments: { key: string }[];
};
const drafts = (
  read("data/drafts/en/TIT.json") as {
    titles: Record<string, Draft>;
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

  it("labels every draft as AI output, checked by a different model", () => {
    for (const d of Object.values(drafts)) {
      expect(d.source).toMatch(/^ai:/);
      expect(d.check?.by).toMatch(/^ai:/);
      expect(d.check?.by).not.toBe(d.source);
    }
  });

  it("is ai-checked only where the checker agreed; the rest wait for a person", () => {
    for (const d of Object.values(drafts)) {
      // No AI title goes above ai-checked until a person reviews it (AGENTS.md).
      expect(d.status).toBe(
        d.check?.verdict === "agree" ? "ai-checked" : "unreviewed"
      );
      if (d.check?.verdict === "disagree") {
        expect(d.check.suggestion?.length).toBeGreaterThan(0);
        expect((d.check.suggestion ?? "").length).toBeLessThanOrEqual(MAX);
      }
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

  it("records a person's review with who, when and a reviewed status", () => {
    for (const d of Object.values(drafts)) {
      if (!d.review) continue;
      expect(d.review.by).toMatch(/^reviewer:[A-Za-z0-9-]+$/);
      expect(d.review.at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(["human-reviewed", "approved"]).toContain(d.review.status);
      if (d.review.text !== undefined) {
        expect(d.review.text.length).toBeGreaterThan(0);
        expect(d.review.text.length).toBeLessThanOrEqual(MAX);
        expect(d.review.text).toBe(d.review.text.trim());
      }
      // A reviewer's reason, kept with the review (scripts/review/apply.ts).
      if (d.review.why !== undefined) {
        expect(d.review.why.length).toBeGreaterThan(0);
        expect(d.review.why).toBe(d.review.why.trim());
      }
    }
  });

  it("is merged into the built title table, a review deciding", () => {
    for (const [key, d] of Object.entries(drafts)) {
      const r = d.review;
      expect(built[key]).toEqual(
        r
          ? {
              text: r.text ?? d.text,
              status: r.status,
              source: r.text ? r.by : d.source,
            }
          : { text: d.text, status: d.status, source: d.source }
      );
    }
  });
});
