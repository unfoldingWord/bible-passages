// Writes generated JSON exactly as prettier would format it, so a fresh build
// matches the committed files byte for byte.
import { mkdirSync, writeFileSync } from "node:fs";
import { format } from "prettier";

export async function writeJson(file: URL, value: unknown): Promise<void> {
  mkdirSync(new URL(".", file), { recursive: true });
  writeFileSync(file, await format(JSON.stringify(value), { parser: "json" }));
}
