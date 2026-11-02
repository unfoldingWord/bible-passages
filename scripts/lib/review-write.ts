// Writes a review batch into data/drafts/ (#56). Every file is staged beside
// its target as `<file>.review-tmp`, and the staged files are renamed into
// place only once all are written. The renames run one file at a time, so a
// run stopped between two of them leaves part of the batch applied; it also
// leaves at least one staged file, and apply.ts refuses to start while any
// is present. A re-run of the same batch then completes it: `review.saved`
// passes over the records already applied.
import { readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";

/** The suffix of a staged file (ignored by git: see .gitignore). */
export const STAGED = ".review-tmp";

/** The file operations a batch uses; replaced in tests to inject failures. */
export type BatchFs = {
  /** Creates `path`; refuses one that exists, a link included. */
  write(path: URL, text: string): void;
  rename(from: URL, to: URL): void;
  remove(path: URL): void;
};

export const nodeFs: BatchFs = {
  write: (path, text) => writeFileSync(path, text, { flag: "wx" }),
  rename: (from, to) => renameSync(from, to),
  remove: (path) => rmSync(path, { force: true }),
};

/**
 * The staged files under `drafts` (a URL ending in `/`), as paths relative to
 * it: directly in it or in a language directory. Links are listed, not
 * followed.
 */
export function leftovers(drafts: URL): string[] {
  const found: string[] = [];
  const scan = (dir: URL, prefix: string, depth: number) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
      throw e;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (depth > 0) {
          scan(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`, 0);
        }
      } else if (entry.name.endsWith(STAGED)) {
        found.push(`${prefix}${entry.name}`);
      }
    }
  };
  scan(drafts, "", 1);
  return found.sort();
}

/** How to recover from an interrupted batch, naming its staged files. */
export function recovery(staged: readonly string[]): string {
  return [
    "A review apply was interrupted and left these staged files:",
    ...staged.map((name) => `- data/drafts/${name}`),
    "Part of that batch may be in data/drafts/ and part not. To recover,",
    "delete the files above, then either:",
    "- run the same batch again: records already applied are passed over and",
    "  the rest applied (its summary lists only the rest); or",
    "- undo the batch by discarding its changes to data/drafts/.",
    "Check `git diff data/drafts` before committing.",
  ].join("\n");
}

/**
 * Writes `changed` (`<lang>/<BOOK>` to its new draft file) into `drafts`.
 * A failure while staging removes what this call staged and leaves every
 * target as it was. A failure while renaming leaves the files not yet
 * renamed staged, for the next run to find, and says so.
 */
export async function writeBatch(
  drafts: URL,
  changed: ReadonlyMap<string, unknown>,
  fs: BatchFs = nodeFs
): Promise<void> {
  // Formatted first, so nothing is staged until every file's text is ready.
  const files: { id: string; target: URL; staged: URL; text: string }[] = [];
  for (const [id, value] of changed) {
    const target = new URL(`${id}.json`, drafts);
    // Indented before prettier, which keeps an object expanded when its
    // source is: the diff shows the reviews, not a reflowed file.
    const options = (await resolveConfig(fileURLToPath(target))) ?? {};
    const text = await format(JSON.stringify(value, null, 2), {
      ...options,
      parser: "json",
    });
    files.push({
      id,
      target,
      staged: new URL(`${id}.json${STAGED}`, drafts),
      text,
    });
  }

  const written: URL[] = [];
  try {
    for (const f of files) {
      try {
        fs.write(f.staged, f.text);
      } catch (e) {
        // A staged file that was already there (an interrupted run, or a
        // link) is not this run's to remove. Anything else this run opened.
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") fs.remove(f.staged);
        throw e;
      }
      written.push(f.staged);
    }
  } catch (e) {
    for (const staged of written) fs.remove(staged);
    throw e;
  }

  let done = 0;
  try {
    for (const f of files) {
      fs.rename(f.staged, f.target);
      done++;
    }
  } catch (e) {
    const left = files.slice(done).map((f) => `${f.id}.json${STAGED}`);
    throw new Error(
      `interrupted after ${done} of ${files.length} files: ${(e as Error).message}\n` +
        recovery(left),
      { cause: e }
    );
  }
}
