import { describe, expect, it } from "vitest";
import { runSummary } from "../scripts/lib/segment-summary.ts";
import type { DraftTitle } from "../scripts/lib/segment-titles.ts";

const title = (t: Partial<DraftTitle>): DraftTitle => ({
  text: "A title",
  source: "ai:test/model",
  status: "unreviewed",
  ...t,
});

describe("runSummary (#242)", () => {
  const titles = {
    "MAT-001-a": title({
      status: "ai-checked",
      check: { by: "other/model", verdict: "agree" },
    }),
    "MAT-001-b": title({
      check: {
        by: "other/model",
        verdict: "disagree",
        criteria: ["plain"],
        why: "why",
        suggestion: "Another title",
      },
    }),
    "MAT-001-c": title({ gates: ["too long"] }),
  };
  const line = runSummary({
    book: "MAT",
    inputs: 4,
    reused: 5,
    blank: 2,
    titles,
  });

  it("prints the whole line", () => {
    expect(line).toBe(
      "en MAT: 3 of 4 segments drafted, 5 reuse their pericope title, " +
        "2 blank in BSB skipped (build writes those titles), " +
        "1 ai-checked, 1 disagreement, 1 gate failure"
    );
  });

  it("keeps the build's titles to the blank clause", () => {
    expect(line).toContain(
      "2 blank in BSB skipped (build writes those titles)"
    );
    // The wording #242 replaced: "their" could cover the reused segments.
    expect(line).not.toContain("the build writes their title");
    expect(line.match(/build writes/g)).toHaveLength(1);
  });

  it("states the reuse clause on its own, with no claim about the build", () => {
    const reuse = line.split(", ").find((c) => c.includes("reuse"));
    expect(reuse).toBe("5 reuse their pericope title");
  });
});

describe("runSummary agrees in number with each count (#265)", () => {
  const agree = title({
    status: "ai-checked",
    check: { by: "other/model", verdict: "agree" },
  });
  const disagree = title({
    check: {
      by: "other/model",
      verdict: "disagree",
      criteria: ["plain"],
      why: "why",
      suggestion: "Another title",
    },
  });
  const failed = title({ gates: ["too long"] });

  /** `n` titles of each kind: ai-checked, disagreed, failed a gate. */
  const titlesOf = (n: number) =>
    Object.fromEntries(
      [agree, disagree, failed].flatMap((t, kind) =>
        Array.from({ length: n }, (_, i) => [`MAT-00${kind + 1}-${i}`, t])
      )
    );

  it.each([
    [
      0,
      "en MAT: 0 of 0 segments drafted, 0 reuse their pericope title, " +
        "0 blank in BSB skipped (build writes those titles), " +
        "0 ai-checked, 0 disagreements, 0 gate failures",
    ],
    [
      1,
      "en MAT: 3 of 3 segments drafted, 1 reuses its pericope title, " +
        "1 blank in BSB skipped (build writes that title), " +
        "1 ai-checked, 1 disagreement, 1 gate failure",
    ],
    [
      2,
      "en MAT: 6 of 6 segments drafted, 2 reuse their pericope title, " +
        "2 blank in BSB skipped (build writes those titles), " +
        "2 ai-checked, 2 disagreements, 2 gate failures",
    ],
  ])("prints the whole line when every count is %i", (n, expected) => {
    expect(
      runSummary({
        book: "MAT",
        inputs: 3 * n,
        reused: n,
        blank: n,
        titles: titlesOf(n),
      })
    ).toBe(expected);
  });

  it.each([
    [
      0,
      "en MAT: 0 of 0 segments drafted, 0 reuse their pericope title, " +
        "0 blank in BSB skipped (build writes those titles), " +
        "0 ai-checked, 0 disagreements, 0 gate failures",
    ],
    [
      1,
      "en MAT: 1 of 1 segment drafted, 0 reuse their pericope title, " +
        "0 blank in BSB skipped (build writes those titles), " +
        "1 ai-checked, 0 disagreements, 0 gate failures",
    ],
    [
      2,
      "en MAT: 2 of 2 segments drafted, 0 reuse their pericope title, " +
        "0 blank in BSB skipped (build writes those titles), " +
        "2 ai-checked, 0 disagreements, 0 gate failures",
    ],
  ])("prints the whole line when the input count is %i", (n, expected) => {
    const titles = Object.fromEntries(
      Array.from({ length: n }, (_, i) => [`MAT-001-${i}`, agree])
    );
    expect(
      runSummary({ book: "MAT", inputs: n, reused: 0, blank: 0, titles })
    ).toBe(expected);
  });
});
