// Reads an input pinned in sources.json. The file is downloaded once into
// .cache/sources/ and its SHA-256 is checked on every read, so a build only
// ever sees the exact bytes that were pinned. See AGENTS.md, "Data".
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

export type Source = {
  id: string;
  url: string;
  revision: string;
  sha256: string;
  licence: string;
  attribution: string;
};

const root = new URL("../../", import.meta.url);
const defaultCache = new URL(".cache/sources/", root);

/** Ids name a cache file, so they are plain slugs. */
export const ID = /^[a-z0-9][a-z0-9-]*$/;
/** Inputs come from Door43 only; add a host here with the reason. */
export const HOSTS = ["git.door43.org"];

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

/**
 * The pinned bytes of a source. The cache file is named by id and hash, so
 * a new pin is a cache miss; bytes that do not match the pin are deleted
 * and refused, never returned.
 */
export async function readSource(
  id: string,
  { pin = source(id), cache = defaultCache } = {}
): Promise<string> {
  if (!ID.test(pin.id) || pin.id !== id)
    throw new Error(`bad source id "${id}"`);
  const url = new URL(pin.url);
  if (url.protocol !== "https:" || !HOSTS.includes(url.hostname)) {
    throw new Error(`${id}: ${pin.url} is not on an allowed host`);
  }
  const file = new URL(`${id}.${pin.sha256}`, cache);
  let bytes: Buffer;
  try {
    bytes = readFileSync(file);
  } catch {
    const res = await fetch(url, { redirect: "error" });
    if (!res.ok) throw new Error(`GET ${pin.url}: ${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
    mkdirSync(cache, { recursive: true });
    writeFileSync(file, bytes);
  }
  const actual = sha256(bytes);
  if (actual !== pin.sha256) {
    rmSync(file, { force: true });
    throw new Error(`${id}: sha256 ${actual} does not match the pin`);
  }
  return bytes.toString("utf8");
}
