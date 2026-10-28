// Writes generated JSON exactly as `prettier --check` expects it, using the
// project's .prettierrc, so a fresh build matches the committed files byte
// for byte.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";

export async function writeJson(file: URL, value: unknown): Promise<void> {
  const options = (await resolveConfig(fileURLToPath(file))) ?? {};
  mkdirSync(new URL(".", file), { recursive: true });
  writeFileSync(
    file,
    await format(JSON.stringify(value), { ...options, parser: "json" })
  );
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
