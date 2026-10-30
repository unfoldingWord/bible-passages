// Reads an input pinned in sources.json. The file is downloaded once into
// .cache/sources/ and its SHA-256 is checked on every read, so a build only
// ever sees the exact bytes that were pinned. See AGENTS.md, "Data".
import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";

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

export type Fetch = (url: URL, init: RequestInit) => Promise<Response>;

/**
 * Waits before each retry of a failed download, in milliseconds. Door43
 * answered bursts of concurrent requests with 500s that succeeded when
 * tried again (issue #111), so a server error, a 429 or a failed connection
 * is tried again; any other status fails at once.
 */
export const RETRY_WAITS = [1000, 3000, 9000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function download(
  url: URL,
  fetchImpl: Fetch,
  waits: readonly number[],
  wait: (ms: number) => Promise<unknown>
): Promise<Buffer> {
  for (let attempt = 0; ; attempt++) {
    let res: Response | undefined;
    let failure: string;
    try {
      res = await fetchImpl(url, { redirect: "error" });
      // The body is read here too, so a connection dropped mid-body is
      // retried like one dropped before the status.
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      failure = `${res.status}`;
    } catch (e) {
      res = undefined;
      failure = e instanceof Error ? e.message : String(e);
    }
    const retryable =
      res === undefined || res.status >= 500 || res.status === 429;
    const ms = waits[attempt];
    if (!retryable || ms === undefined) {
      const tries = attempt === 0 ? "" : ` (after ${attempt + 1} attempts)`;
      throw new Error(`GET ${url.href}: ${failure}${tries}`);
    }
    await wait(ms);
  }
}

/**
 * The pinned bytes of a source. The cache file is named by id and hash, so
 * a new pin is a cache miss; bytes that do not match the pin are deleted
 * and refused, never returned. A download is checked before it is cached
 * and lands by rename, so a run reading the cache at the same time never
 * sees a partial file.
 */
export async function readSource(
  id: string,
  {
    pin = source(id),
    cache = defaultCache,
    fetch: fetchImpl = fetch as Fetch,
    waits = RETRY_WAITS,
    wait = sleep,
  }: {
    pin?: Source;
    cache?: URL;
    fetch?: Fetch;
    waits?: readonly number[];
    wait?: (ms: number) => Promise<unknown>;
  } = {}
): Promise<string> {
  if (!ID.test(pin.id) || pin.id !== id)
    throw new Error(`bad source id "${id}"`);
  const url = new URL(pin.url);
  if (url.protocol !== "https:" || !HOSTS.includes(url.hostname)) {
    throw new Error(`${id}: ${pin.url} is not on an allowed host`);
  }
  const file = new URL(`${id}.${pin.sha256}`, cache);
  let cached: Buffer | undefined;
  try {
    cached = readFileSync(file);
  } catch {
    cached = undefined;
  }
  if (cached !== undefined) {
    const actual = sha256(cached);
    if (actual !== pin.sha256) {
      rmSync(file, { force: true });
      throw new Error(`${id}: sha256 ${actual} does not match the pin`);
    }
    return cached.toString("utf8");
  }
  const bytes = await download(url, fetchImpl, waits, wait);
  const actual = sha256(bytes);
  if (actual !== pin.sha256) {
    throw new Error(`${id}: sha256 ${actual} does not match the pin`);
  }
  mkdirSync(cache, { recursive: true });
  const tmp = `${fileURLToPath(file)}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(tmp, bytes);
    renameSync(tmp, file);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
  return bytes.toString("utf8");
}

/**
 * Downloads every pin not yet in the cache, `concurrency` at a time, and
 * returns how many it fetched. The tests call it once before any test runs
 * (tests/global-setup.ts), so no test waits on the network under its own
 * timeout.
 */
export async function fetchMissing(
  pins: Source[],
  {
    cache = defaultCache,
    concurrency = 8,
    fetch: fetchImpl = fetch as Fetch,
  }: { cache?: URL; concurrency?: number; fetch?: Fetch } = {}
): Promise<number> {
  let present: Set<string>;
  try {
    present = new Set(readdirSync(cache));
  } catch {
    present = new Set();
  }
  const missing = pins.filter((p) => !present.has(`${p.id}.${p.sha256}`));
  const queue = [...missing];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      for (let p = queue.pop(); p !== undefined; p = queue.pop()) {
        await readSource(p.id, { pin: p, cache, fetch: fetchImpl });
      }
    })
  );
  return missing.length;
}
