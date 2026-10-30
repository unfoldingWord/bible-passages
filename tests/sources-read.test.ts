import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  fetchMissing,
  readSource,
  type Fetch,
  type Source,
} from "../scripts/lib/sources.ts";

// scripts/lib/sources.ts, without the network: each case is decided by the
// cache, before any request, or by a scripted fetch.
const bytes = Buffer.from("\\c 1\n\\v 1 text\n");
const sha = createHash("sha256").update(bytes).digest("hex");
const pin = (over: Partial<Source> = {}): Source => ({
  id: "test-src",
  url: "https://git.door43.org/org/repo/raw/commit/abc/file.usfm",
  revision: "abc",
  sha256: sha,
  licence: "CC-BY-SA-4.0",
  attribution: "test",
  ...over,
});
const cacheDir = () =>
  pathToFileURL(mkdtempSync(join(tmpdir(), "bp-cache-")) + "/");

describe("readSource", () => {
  it("returns cached bytes that match the pin", async () => {
    const cache = cacheDir();
    writeFileSync(new URL(`test-src.${sha}`, cache), bytes);
    expect(await readSource("test-src", { pin: pin(), cache })).toBe(
      bytes.toString()
    );
  });

  it("refuses and deletes cached bytes that do not match", async () => {
    const cache = cacheDir();
    const file = new URL(`test-src.${sha}`, cache);
    writeFileSync(file, Buffer.concat([bytes, Buffer.from("x")]));
    await expect(readSource("test-src", { pin: pin(), cache })).rejects.toThrow(
      /does not match the pin/
    );
    expect(existsSync(file)).toBe(false);
  });

  it("refuses an id that is not a plain slug", async () => {
    await expect(
      readSource("../x", { pin: pin({ id: "../x" }), cache: cacheDir() })
    ).rejects.toThrow(/bad source id/);
  });

  it("refuses a host that is not allowed", async () => {
    await expect(
      readSource("test-src", {
        pin: pin({ url: "https://example.org/file.usfm" }),
        cache: cacheDir(),
      })
    ).rejects.toThrow(/not on an allowed host/);
  });
});

/** A fetch that gives each answer in turn and counts its calls. */
function scripted(...answers: (number | Error)[]) {
  const seen = { calls: 0, waits: [] as number[] };
  const f: Fetch = async () => {
    const a = answers[seen.calls++];
    if (a === undefined) throw new Error("no more answers");
    if (a instanceof Error) throw a;
    return new Response(a === 200 ? bytes : "error", { status: a });
  };
  const wait = async (ms: number) => void seen.waits.push(ms);
  return { f, seen, wait };
}

describe("readSource downloads (#111)", () => {
  it("retries a server error or a failed connection, then caches by rename", async () => {
    const cache = cacheDir();
    const { f, seen, wait } = scripted(500, new TypeError("fetch failed"), 200);
    const text = await readSource("test-src", {
      pin: pin(),
      cache,
      fetch: f,
      waits: [10, 20, 30],
      wait,
    });
    expect(text).toBe(bytes.toString());
    expect(seen).toEqual({ calls: 3, waits: [10, 20] });
    expect(readdirSync(cache)).toEqual([`test-src.${sha}`]);
    expect(readFileSync(new URL(`test-src.${sha}`, cache))).toEqual(bytes);
  });

  it("does not retry a client error such as a 404", async () => {
    const { f, seen, wait } = scripted(404, 200);
    await expect(
      readSource("test-src", {
        pin: pin(),
        cache: cacheDir(),
        fetch: f,
        waits: [10],
        wait,
      })
    ).rejects.toThrow(/: 404$/);
    expect(seen.calls).toBe(1);
  });

  it("gives up after its retries, naming the last failure", async () => {
    const cache = cacheDir();
    const { f, seen, wait } = scripted(500, 503, 502);
    await expect(
      readSource("test-src", {
        pin: pin(),
        cache,
        fetch: f,
        waits: [10, 20],
        wait,
      })
    ).rejects.toThrow(/: 502 \(after 3 attempts\)$/);
    expect(seen.calls).toBe(3);
    expect(existsSync(cache)).toBe(true);
    expect(readdirSync(cache)).toEqual([]);
  });

  it("caches nothing when the download does not match the pin", async () => {
    const cache = cacheDir();
    const { f, wait } = scripted(200);
    await expect(
      readSource("test-src", {
        pin: pin({ sha256: "0".repeat(64) }),
        cache,
        fetch: f,
        wait,
      })
    ).rejects.toThrow(/does not match the pin/);
    expect(readdirSync(cache)).toEqual([]);
  });
});

describe("fetchMissing", () => {
  it("fetches only the pins not already in the cache", async () => {
    const cache = cacheDir();
    writeFileSync(new URL(`test-src.${sha}`, cache), bytes);
    const other = pin({ id: "other-src" });
    const { f, seen } = scripted(200);
    expect(await fetchMissing([pin(), other], { cache, fetch: f })).toBe(1);
    expect(seen.calls).toBe(1);
    expect(readdirSync(cache).sort()).toEqual([
      `other-src.${sha}`,
      `test-src.${sha}`,
    ]);
  });
});
