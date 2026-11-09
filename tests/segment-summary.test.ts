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
        "1 ai-checked, 1 disagreements, 1 gate failures"
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
