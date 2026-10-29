// Writes generated JSON exactly as `prettier --check` expects it, using the
// project's .prettierrc, so a fresh build matches the committed files byte
// for byte.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";

/**
 * Writes `value` as formatted JSON at `file`. The text goes to a temporary
 * file beside it, which is then renamed into place, so a crash mid-write
 * leaves the earlier file whole (a run's ledger is rewritten after every
 * call) rather than a truncated one.
 */
export async function writeJson(file: URL, value: unknown): Promise<void> {
  const path = fileURLToPath(file);
  const options = (await resolveConfig(path)) ?? {};
  const text = await format(JSON.stringify(value), {
    ...options,
    parser: "json",
  });
  mkdirSync(new URL(".", file), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, text);
    renameSync(tmp, path);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}

/**
 * Deletes the generated `.json` files directly in `dir` (a URL ending in `/`),
 * keeping anything else such as `.gitkeep`. A build clears its output
 * directories first, so a book dropped from the build leaves no stale file.
 */
export function clearJson(dir: URL): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name.endsWith(".json")) rmSync(new URL(name, dir));
  }
}
