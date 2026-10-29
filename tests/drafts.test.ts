import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BOOKS } from "../scripts/lib/books.ts";
import { CRITERIA, gateProblems } from "../scripts/lib/segment-titles.ts";
import { sha256 } from "../scripts/lib/translate.ts";

type Title = { text: string; status: string; source: string };
type Draft = Title & {
  gates?: string[];
  check?: {
    by: string;
    verdict: "agree" | "disagree";
    criteria?: string[];
    suggestion?: string;
  };
  review?: { by: string; at: string; status: string; text?: string };
};
type Record = {
  language: string;
  book: string;
  bible?: string;
  prompt?: { file: string; sha256: string };
  calls?: {
    role: string;
    id: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    cost: number | null;
  }[];
  titles: { [key: string]: Draft };
};
const read = (path: string) =>
  JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const MAX = 60;

// English segment drafts (data/drafts/en/): Titus, drafted by an agent before
// the script (PR #16), and the books drafted by
// scripts/translate/segment-titles.ts, whose records carry their calls.
describe.each(["TIT", "PHP"])("English %s segment drafts", (book) => {
  const structure = read(`data/structure/${book}.json`) as {
    pericopes: { key: string }[];
    segments: { key: string; pericope: string }[];
  };
  const record = read(`data/drafts/en/${book}.json`) as Record;
  const drafts = record.titles;
  const built = (
    read(`data/titles/en/${book}.json`) as {
      titles: { [key: string]: Title };
    }
  ).titles;
  const perPericope = new Map<string, number>();
  for (const s of structure.segments)
    perPericope.set(s.pericope, (perPericope.get(s.pericope) ?? 0) + 1);
  const only = (s: { pericope: string }) => perPericope.get(s.pericope) === 1;

  it("is a book whose titles are built", () => {
    expect(BOOKS).toContain(book);
    expect([record.language, record.book]).toEqual(["en", book]);
  });

  it("has a draft for every segment that shares its pericope, and none for an unknown key", () => {
    const keys = new Set(structure.segments.map((s) => s.key));
    for (const k of Object.keys(drafts)) expect(keys.has(k), k).toBe(true);
    for (const s of structure.segments)
      if (!only(s)) expect(drafts[s.key], s.key).toBeDefined();
  });

  it("labels every draft as AI output, checked by a different model", () => {
    for (const d of Object.values(drafts)) {
      expect(d.source).toMatch(/^ai:/);
      expect(d.check?.by).toMatch(/^ai:/);
      expect(d.check?.by).not.toBe(d.source);
    }
  });

  it("is ai-checked only where the checker agreed and every gate passed; the rest wait for a person", () => {
    for (const d of Object.values(drafts)) {
      // No AI title goes above ai-checked until a person reviews it (AGENTS.md).
      expect(d.status).toBe(
        d.check?.verdict === "agree" && d.gates === undefined
          ? "ai-checked"
          : "unreviewed"
      );
      if (d.check?.verdict === "disagree") {
        expect(d.check.suggestion?.length).toBeGreaterThan(0);
        expect((d.check.suggestion ?? "").length).toBeLessThanOrEqual(MAX);
      }
    }
  });

  it("records every title the gates fail, and keeps the rest plain and non-empty", () => {
    for (const d of Object.values(drafts)) {
      expect(d.text.length).toBeGreaterThan(0);
      expect(d.text).toBe(d.text.trim());
      const problems = gateProblems(d.text);
      expect(d.gates ?? []).toEqual(problems);
      if (problems.length === 0) {
        expect(d.text.length).toBeLessThanOrEqual(MAX);
        expect(d.text).not.toMatch(/[.“”"]$|^["“]/);
      }
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

  it("gives a pericope's only segment the pericope title when it has no draft (decision 12)", () => {
    for (const s of structure.segments)
      if (only(s) && !drafts[s.key])
        expect(built[s.key], s.key).toEqual(built[s.pericope]);
  });
});

describe("a scripted segment-title record (PHP)", () => {
  const record = read("data/drafts/en/PHP.json") as Record;
  const structure = read("data/structure/PHP.json") as {
    segments: { key: string; pericope: string }[];
  };

  it("drafts no title for a pericope's only segment (decision 12)", () => {
    const count = new Map<string, number>();
    for (const s of structure.segments)
      count.set(s.pericope, (count.get(s.pericope) ?? 0) + 1);
    const reused = structure.segments.filter(
      (s) => count.get(s.pericope) === 1
    );
    expect(reused.map((s) => s.key)).toEqual(["PHP.1.1-2", "PHP.4.21-23"]);
    for (const s of reused) expect(record.titles[s.key]).toBeUndefined();
    expect(Object.keys(record.titles)).toHaveLength(37);
  });

  it("was made with the committed prompt and the pinned BSB text", () => {
    expect(record.prompt?.file).toBe("prompts/segment-titles.md");
    expect(record.prompt?.sha256).toBe(
      sha256(
        readFileSync(
          new URL("../prompts/segment-titles.md", import.meta.url),
          "utf8"
        )
      )
    );
    expect(record.bible).toBe("bsb-php");
  });

  it("records both calls: a draft and a check by models of different families", () => {
    const calls = record.calls ?? [];
    expect(calls.map((c) => c.role)).toEqual(["draft", "check"]);
    for (const c of calls) {
      expect(c.id).toMatch(/^gen-/);
      expect(c.promptTokens).toBeGreaterThan(0);
      expect(c.cost).toBeGreaterThan(0);
    }
    const family = (m: string) => m.split("/")[0];
    expect(family(calls[0]!.model)).not.toBe(family(calls[1]!.model));
    for (const d of Object.values(record.titles)) {
      expect(d.source).toBe(`ai:${calls[0]!.model}`);
      expect(d.check?.by).toBe(`ai:${calls[1]!.model}`);
      for (const c of d.check?.criteria ?? [])
        expect(CRITERIA).toContain(c as (typeof CRITERIA)[number]);
    }
  });
});
