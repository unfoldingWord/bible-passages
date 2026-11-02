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
  statSync,
  unlinkSync,
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

/** How long one attempt may take before it is abandoned and retried. */
export const ATTEMPT_TIMEOUT_MS = 30_000;

/**
 * The longest one download with the default retries may take: every attempt
 * times out and every wait runs, 4 × 30 s + (1 + 3 + 9) s = 133 s.
 */
const WHOLE_DOWNLOAD_MS =
  (RETRY_WAITS.length + 1) * ATTEMPT_TIMEOUT_MS +
  RETRY_WAITS.reduce((a, b) => a + b, 0);

/**
 * How old a `.tmp` file in the cache must be before it is taken as left by a
 * killed process and removed (issue #134): a whole download plus a 30 s
 * margin, 133 s + 30 s = 163 s.
 *
 * readSource creates its `.tmp` only once a download is complete, writes it
 * in one synchronous call and renames it at once, so a live writer's file is
 * milliseconds old. The threshold does not rely on that. Even a writer that
 * made its `.tmp` when a download started, and did not write to it again
 * across every retry, holds it no longer than one whole download. One
 * attempt alone (30 s) is not enough: two timed-out attempts and the wait
 * between them already take 30 + 9 + 30 s (issue #153). The margin is for a
 * starved host (load average near 60 in #111) and coarse mtimes. A caller
 * passing longer `waits` to readSource is not covered.
 */
export const STALE_TMP_MS = WHOLE_DOWNLOAD_MS + 30_000;

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
      // A stalled connection is abandoned and retried like a failed one.
      res = await fetchImpl(url, {
        redirect: "error",
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });
      // The body is read here too, so a connection dropped mid-body is
      // retried like one dropped before the status.
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      failure = `${res.status}`;
      // An error body is not wanted; release its connection before waiting.
      await res.body?.cancel().catch(() => {});
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
 * a new pin is a cache miss. A cache file whose bytes do not match the pin
 * is never returned: it is deleted, reported through `warn`, and downloaded
 * again, and the download must match the pin too, so a wrong pin still
 * fails (issue #125). A download is checked before it is cached and lands
 * by rename, so a run reading the cache at the same time never sees a
 * partial file.
 */
export async function readSource(
  id: string,
  {
    pin = source(id),
    cache = defaultCache,
    fetch: fetchImpl = fetch as Fetch,
    waits = RETRY_WAITS,
    wait = sleep,
    warn = console.warn,
  }: {
    pin?: Source;
    cache?: URL;
    fetch?: Fetch;
    waits?: readonly number[];
    wait?: (ms: number) => Promise<unknown>;
    warn?: (message: string) => void;
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
    if (actual === pin.sha256) return cached.toString("utf8");
    rmSync(file, { force: true });
    warn(
      `${id}: cached sha256 ${actual} does not match the pin; deleted it and downloading again`
    );
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

/** True for the error a file system call throws when its path is gone. */
const isMissing = (e: unknown) =>
  e instanceof Error && (e as NodeJS.ErrnoException).code === "ENOENT";

/**
 * Removes every `*.tmp` file in the cache whose mtime is more than
 * `STALE_TMP_MS` old, and returns the names this call unlinked. A newer one
 * may belong to a run still writing in the same cache, so it is kept. A
 * missing cache has nothing to remove; any other error listing it is thrown.
 * A name that is gone before its stat or its unlink (another cleaner, or a
 * writer's rename) is skipped and not reported.
 */
export function removeStaleTmp(cache: URL): string[] {
  const now = Date.now();
  let names: string[];
  try {
    names = readdirSync(cache);
  } catch (e) {
    if (isMissing(e)) return [];
    throw e;
  }
  const removed: string[] = [];
  for (const name of names) {
    if (!name.endsWith(".tmp")) continue;
    const file = new URL(name, cache);
    let stat;
    try {
      stat = statSync(file);
    } catch (e) {
      if (isMissing(e)) continue;
      throw e;
    }
    if (!stat.isFile() || now - stat.mtimeMs <= STALE_TMP_MS) continue;
    try {
      unlinkSync(file);
    } catch (e) {
      if (isMissing(e)) continue;
      throw e;
    }
    removed.push(name);
  }
  return removed;
}

/**
 * Removes stale `.tmp` files (removeStaleTmp), then downloads every pin not
 * yet in the cache, `concurrency` at a time, and returns how many it
 * fetched. The tests call it once before any test runs
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
  removeStaleTmp(cache);
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
