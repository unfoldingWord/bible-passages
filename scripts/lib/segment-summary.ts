import type { DraftRecord } from "./segment-titles.ts";

/**
 * The one-line summary `scripts/translate/segment-titles.ts` prints at the
 * end of a run. Pure, so the wording is pinned by a test (#242): the
 * clause on blank segments says only the build writes *those* titles
 * ("that title" for one), and cannot be read as covering the segments that
 * reuse their pericope title. Each counted noun agrees in number with its
 * count (#265).
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
  const checked = titles.filter((t) => t.status === "ai-checked").length;
  const disagree = titles.filter((t) => t.check?.verdict === "disagree").length;
  const failed = titles.filter((t) => t.gates).length;
  return (
    `en ${args.book}: ${titles.length} of ${args.inputs} ` +
    `${plural(args.inputs, "segment", "segments")} drafted, ` +
    `${args.reused} ` +
    `${plural(args.reused, "reuses its", "reuse their")} pericope title, ` +
    `${args.blank} blank in BSB skipped (build writes ` +
    `${plural(args.blank, "that title", "those titles")}), ` +
    `${checked} ai-checked, ` +
    `${disagree} ${plural(disagree, "disagreement", "disagreements")}, ` +
    `${failed} ${plural(failed, "gate failure", "gate failures")}`
  );
}

/** The singular form for a count of exactly 1; the plural otherwise, 0 included (#265). */
function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}
