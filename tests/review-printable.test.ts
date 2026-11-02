// printable() on the gate-output path of applyReviews, made load-bearing.
// Real gates name only letters, full stops and quotation marks, none of which
// printable() changes (#154), so no real input can show the escape at work.
// Here the translation gates are stubbed to name a run holding an escape and
// a bidi override, as a future gate might, and the refusal must show both
// escaped. A file of its own, so the stub reaches no other test.
import { describe, expect, it, vi } from "vitest";
import { applyReviews, type DraftFile } from "../scripts/lib/review.ts";

vi.mock("../scripts/lib/gates.ts", async (actual) => ({
  ...(await actual<typeof import("../scripts/lib/gates.ts")>()),
  titleProblems: () => ['stray "a\u{1B}[31mb\u{202E}c" outside Arabic'],
}));

describe("a gate's output in a refusal", () => {
  it("is escaped, so it cannot recolour or reorder the line", () => {
    const files = new Map<string, DraftFile>([
      [
        "ar/TIT",
        {
          language: "ar",
          book: "TIT",
          titles: {
            "TIT.1.4-4": {
              text: "\u{628}\u{648}\u{644}\u{633}",
              source: "ai:model-a",
              status: "ai-checked",
            },
          },
        },
      ],
    ]);
    const english = new Map([
      ["TIT", { "TIT.1.4-4": { text: "Paul greets Titus" } }],
    ]);
    const exported = {
      schema: "bp.review-export",
      v: 2,
      reviewer: "reviewer:reader-7",
      records: [
        {
          v: 1,
          at: "2026-10-29T10:00:00.000Z",
          changed: true,
          key: "TIT.1.4-4",
          lang: "ar",
          ms: 5000,
          note: "the passage says more",
          pick: "change",
          shown: [],
          text: "\u{628}\u{648}\u{644}\u{633} \u{62A}\u{64A}\u{637}\u{633}",
        },
      ],
    };
    const r = applyReviews(
      files,
      [exported],
      Date.parse("2026-11-01T00:00:00.000Z"),
      english
    );
    // apply.ts prints each problem as is, after "- ".
    expect(r.problems).toEqual([
      'reviewer:reader-7 ar/TIT TIT.1.4-4: stray "a\\u{1B}[31mb\\u{202E}c" outside Arabic',
    ]);
    expect(r.changed.size).toBe(0);
  });
});
