import type { DraftRecord } from "./segment-titles.ts";

/**
 * The one-line summary `scripts/translate/segment-titles.ts` prints at the
 * end of a run. Pure, so the wording is pinned by a test (#242): the
 * clause on blank segments says only the build writes *those* titles, and
 * cannot be read as covering the segments that reuse their pericope title.
 */
export function runSummary(args: {
  book: string;
  /** Segments sent to the draft model. */
  inputs: number;
  /** Segments that reuse their pericope title (not drafted). */
  reused: number;
  /** Segments whose every verse BSB leaves blank (not drafted). */
  blank: number;
  titles: DraftRecord["titles"];
}): string {
  const titles = Object.values(args.titles);
  return (
    `en ${args.book}: ${titles.length} of ${args.inputs} segments drafted, ` +
    `${args.reused} reuse their pericope title, ` +
    `${args.blank} blank in BSB skipped (build writes those titles), ` +
    `${titles.filter((t) => t.status === "ai-checked").length} ai-checked, ` +
    `${titles.filter((t) => t.check?.verdict === "disagree").length} disagreements, ` +
    `${titles.filter((t) => t.gates).length} gate failures`
  );
}
