// One language's tc-mobile title table for one package (docs/schema.md,
// "dist/tc-mobile/"). Pure, so tests can drive it with titles Titus lacks.

/**
 * The statuses a table ships. v0 tables hold plain strings, so a title's
 * status cannot travel with it (tc-mobile#1450, open question O4);
 * `unreviewed` is held back so nothing below `ai-checked` reaches a phone.
 */
export const SHIPPED_STATUSES: readonly string[] = [
  "ai-checked",
  "human-reviewed",
  "approved",
];
const STATUSES = new Set(["unreviewed", ...SHIPPED_STATUSES]);

export type TitleEntries = Record<string, { text: string; status: string }>;

export type TitleTable = {
  packageId: string;
  version: string;
  language: string;
  chapters: Record<string, string>;
  segments: Record<string, string>;
};

/**
 * The table for `segmentKeys` (the package's, in package order), or `null`
 * when no segment has a title to ship.
 *
 * - Only package segment keys: pericope keys (`<BOOK>.P.*`) are not in the
 *   package, and tc-mobile refuses a key its package lacks.
 * - A segment with no title, or only an `unreviewed` one, is left out; the
 *   contract allows that, and the app shows no label.
 * - `chapters` is empty: the dataset has no chapter titles.
 * - For a package segment key, an unknown status or an empty or
 *   whitespace-padded title throws, naming `where` and the key, rather than
 *   shipping or dropping it silently. Entries for other keys are not read
 *   here; tests/structure.test.ts holds every entry in data/titles/ to the
 *   same rule.
 */
export function titleTable(
  pkg: { id: string; version: string },
  language: string,
  segmentKeys: readonly string[],
  entries: TitleEntries,
  where: string
): TitleTable | null {
  const segments: Record<string, string> = {};
  for (const key of segmentKeys) {
    if (!Object.hasOwn(entries, key)) continue;
    const { text, status } = entries[key]!;
    if (!STATUSES.has(status)) {
      throw new Error(`${where}: ${key} has unknown status "${status}"`);
    }
    if (
      typeof text !== "string" ||
      text.trim() === "" ||
      text.trim() !== text
    ) {
      throw new Error(`${where}: ${key} is empty or whitespace-padded`);
    }
    if (SHIPPED_STATUSES.includes(status)) segments[key] = text;
  }
  if (Object.keys(segments).length === 0) return null;
  return {
    packageId: pkg.id,
    version: pkg.version,
    language,
    chapters: {},
    segments,
  };
}
