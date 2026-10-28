// Reads an input pinned in sources.json. The file is downloaded once into
// .cache/sources/ and its SHA-256 is checked on every read, so a build only
// ever sees the exact bytes that were pinned. See AGENTS.md, "Data".
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

export type Source = {
  id: string;
  url: string;
  revision: string;
  sha256: string;
  licence: string;
  attribution: string;
};

const root = new URL("../../", import.meta.url);
const cache = new URL(".cache/sources/", root);

export function sources(): Source[] {
  const json = readFileSync(new URL("sources.json", root), "utf8");
  return (JSON.parse(json) as { sources: Source[] }).sources;
}

export function source(id: string): Source {
  const found = sources().find((s) => s.id === id);
  if (!found) throw new Error(`${id} is not pinned in sources.json`);
  return found;
}

const sha256 = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

export async function readSource(id: string): Promise<string> {
  const pin = source(id);
  const file = new URL(id, cache);
  let bytes: Buffer;
  try {
    bytes = readFileSync(file);
  } catch {
    const res = await fetch(pin.url);
    if (!res.ok) throw new Error(`GET ${pin.url}: ${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
    mkdirSync(cache, { recursive: true });
    writeFileSync(file, bytes);
  }
  const actual = sha256(bytes);
  if (actual !== pin.sha256) {
    throw new Error(`${id}: sha256 ${actual} does not match the pin`);
  }
  return bytes.toString("utf8");
}
