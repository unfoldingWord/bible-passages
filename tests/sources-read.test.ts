import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ATTEMPT_TIMEOUT_MS,
  fetchMissing,
  readSource,
  removeStaleTmp,
  RETRY_WAITS,
  STALE_TMP_MS,
  type Fetch,
  type Source,
} from "../scripts/lib/sources.ts";

// node:fs as sources.ts sees it, unchanged unless a test sets a hook. A hook
// runs just before the real call, so a test can make a file vanish between
// removeStaleTmp's listing and its stat, or between its stat and its unlink,
// as another cleaner or a writer's rename would.
const fsHooks = vi.hoisted(
  () =>
    ({}) as { stat?: (path: unknown) => void; unlink?: (path: unknown) => void }
);
vi.mock("node:fs", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs")>();
  return {
    ...fs,
    statSync: ((path: Parameters<typeof fs.statSync>[0], ...rest: []) => {
      fsHooks.stat?.(path);
      return fs.statSync(path, ...rest);
    }) as typeof fs.statSync,
    unlinkSync: (path: Parameters<typeof fs.unlinkSync>[0]) => {
      fsHooks.unlink?.(path);
      return fs.unlinkSync(path);
    },
    rmSync: (...args: Parameters<typeof fs.rmSync>) => {
      fsHooks.unlink?.(args[0]);
      return fs.rmSync(...args);
    },
  };
});
afterEach(() => {
  delete fsHooks.stat;
  delete fsHooks.unlink;
});

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

// A cache file whose bytes do not match its pin (an older writer, a crash
// before the data reached disk, an outside edit) is deleted, reported and
// downloaded again in the same call; the pin's hash still decides what is
// returned (issue #125).
describe("readSource repairs a cache file that does not match (#125)", () => {
  const bad = Buffer.concat([bytes, Buffer.from("x")]);
  const badSha = createHash("sha256").update(bad).digest("hex");
  const reported = new RegExp(
    `^test-src: cached sha256 ${badSha} does not match the pin`
  );
  const corrupt = (cache: URL) => {
    const file = new URL(`test-src.${sha}`, cache);
    writeFileSync(file, bad);
    return file;
  };

  it("deletes it, downloads the pinned bytes again and caches them", async () => {
    const cache = cacheDir();
    const file = corrupt(cache);
    const { f, seen, wait } = scripted(200);
    const warned: string[] = [];
    expect(
      await readSource("test-src", {
        pin: pin(),
        cache,
        fetch: f,
        wait,
        warn: (m) => void warned.push(m),
      })
    ).toBe(bytes.toString());
    expect(seen.calls).toBe(1);
    expect(readdirSync(cache)).toEqual([`test-src.${sha}`]);
    expect(readFileSync(file)).toEqual(bytes);
    expect(warned).toHaveLength(1);
    expect(warned[0]).toMatch(reported);
  });

  it("never returns the bad bytes when the download fails, and reports them", async () => {
    const cache = cacheDir();
    const file = corrupt(cache);
    const { f, wait } = scripted(404);
    const warned: string[] = [];
    await expect(
      readSource("test-src", {
        pin: pin(),
        cache,
        fetch: f,
        wait,
        warn: (m) => void warned.push(m),
      })
    ).rejects.toThrow(/: 404$/);
    expect(existsSync(file)).toBe(false);
    expect(warned).toHaveLength(1);
    expect(warned[0]).toMatch(reported);
  });

  it("still fails, caching nothing, when the download does not match either", async () => {
    // A wrong pin: the cache file is named by the pin, and no bytes from the
    // source match it, so the repair cannot hide it.
    const wrong = "0".repeat(64);
    const cache = cacheDir();
    const file = new URL(`test-src.${wrong}`, cache);
    writeFileSync(file, bytes);
    const { f, seen, wait } = scripted(200);
    const warned: string[] = [];
    await expect(
      readSource("test-src", {
        pin: pin({ sha256: wrong }),
        cache,
        fetch: f,
        wait,
        warn: (m) => void warned.push(m),
      })
    ).rejects.toThrow(new RegExp(`test-src: sha256 ${sha} does not match`));
    expect(seen.calls).toBe(1);
    expect(existsSync(file)).toBe(false);
    expect(readdirSync(cache)).toEqual([]);
    expect(warned).toEqual([
      expect.stringMatching(`^test-src: cached sha256 ${sha} does not match`),
    ]);
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

  it("retries a 429 and a body that fails after a 200", async () => {
    let calls = 0;
    const waits: number[] = [];
    const f: Fetch = async () => {
      calls++;
      if (calls === 1) return new Response("slow down", { status: 429 });
      if (calls === 2)
        return new Response(
          new ReadableStream({
            start(c) {
              c.error(new Error("connection reset"));
            },
          }),
          { status: 200 }
        );
      return new Response(bytes, { status: 200 });
    };
    const text = await readSource("test-src", {
      pin: pin(),
      cache: cacheDir(),
      fetch: f,
      waits: [10, 20, 30],
      wait: async (ms) => void waits.push(ms),
    });
    expect(text).toBe(bytes.toString());
    expect({ calls, waits }).toEqual({ calls: 3, waits: [10, 20] });
  });

  it("cancels an error body before waiting to retry", async () => {
    let cancelled = 0;
    const f: Fetch = async (_url, init) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      if (cancelled > 0) return new Response(bytes, { status: 200 });
      return new Response(
        new ReadableStream({
          cancel() {
            cancelled++;
          },
        }),
        { status: 503 }
      );
    };
    await readSource("test-src", {
      pin: pin(),
      cache: cacheDir(),
      fetch: f,
      waits: [10],
      wait: async () => expect(cancelled).toBe(1),
    });
    expect(cancelled).toBe(1);
  });

  it("fails a 404 with no body on its first call, naming the status", async () => {
    let calls = 0;
    const f: Fetch = async () => {
      calls++;
      return new Response(null, { status: 404 });
    };
    await expect(
      readSource("test-src", {
        pin: pin(),
        cache: cacheDir(),
        fetch: f,
        waits: [10],
        wait: async () => {},
      })
    ).rejects.toThrow(/: 404$/);
    expect(calls).toBe(1);
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

// readSource writes a download to a unique .tmp file and renames it into
// place. A process killed between the two leaves the .tmp behind, and CI's
// cache would carry it into later runs (issue #134). fetchMissing removes
// one only when it is too old to belong to a writer still running.
describe("fetchMissing removes stale .tmp files (#134)", () => {
  const tmpName = (n: number) =>
    `test-src.${sha}.${1000 + n}.00000000-0000-4000-8000-00000000000${n}.tmp`;
  const plant = (cache: URL, name: string, ageMs: number) => {
    const file = new URL(name, cache);
    writeFileSync(file, "partial");
    const t = (Date.now() - ageMs) / 1000;
    utimesSync(file, t, t);
    return file;
  };

  it("removes one left by a killed writer and keeps a live writer's", async () => {
    const cache = cacheDir();
    const pinned = new URL(`test-src.${sha}`, cache);
    writeFileSync(pinned, bytes);
    utimesSync(pinned, 0, 0);
    const killed = plant(cache, tmpName(1), 3600_000);
    const live = plant(cache, tmpName(2), 0);
    const { f, seen } = scripted();
    expect(await fetchMissing([pin()], { cache, fetch: f })).toBe(0);
    expect(seen.calls).toBe(0);
    expect(existsSync(killed)).toBe(false);
    expect(existsSync(live)).toBe(true);
    // An old pinned file, as a CI cache restore leaves it, is not touched.
    expect(readFileSync(pinned)).toEqual(bytes);
  });

  // Re-derived here from the retry constants: the longest one download may
  // take is every attempt timing out, plus every wait between them.
  const wholeDownloadMs =
    (RETRY_WAITS.length + 1) * ATTEMPT_TIMEOUT_MS +
    RETRY_WAITS.reduce((a, b) => a + b, 0);

  it("waits a whole download, with every retry, plus a 30 s margin", () => {
    expect(wholeDownloadMs).toBe(133_000);
    expect(STALE_TMP_MS - wholeDownloadMs).toBe(30_000);
  });

  it("keeps one as old as a whole download may run", async () => {
    const cache = cacheDir();
    const slow = plant(cache, tmpName(3), wholeDownloadMs);
    const stale = plant(cache, tmpName(4), STALE_TMP_MS + 1000);
    const { f } = scripted();
    expect(await fetchMissing([], { cache, fetch: f })).toBe(0);
    expect(existsSync(slow)).toBe(true);
    expect(existsSync(stale)).toBe(false);
  });

  it("returns what it removed, and ignores a missing cache", () => {
    const cache = cacheDir();
    plant(cache, tmpName(5), STALE_TMP_MS + 1000);
    expect(removeStaleTmp(cache)).toEqual([tmpName(5)]);
    expect(readdirSync(cache)).toEqual([]);
    expect(removeStaleTmp(new URL("missing/", cache))).toEqual([]);
  });

  it("throws a listing error other than a missing cache", () => {
    const cache = cacheDir();
    writeFileSync(new URL("file", cache), "");
    expect(() => removeStaleTmp(new URL("file/", cache))).toThrow(
      expect.objectContaining({ code: "ENOTDIR" })
    );
  });

  it("skips a name that vanishes between the listing and its stat", () => {
    const cache = cacheDir();
    const gone = plant(cache, tmpName(6), STALE_TMP_MS + 1000);
    plant(cache, tmpName(7), STALE_TMP_MS + 1000);
    fsHooks.stat = (path) => {
      if (String(path) === String(gone)) unlinkSync(gone);
    };
    expect(removeStaleTmp(cache)).toEqual([tmpName(7)]);
    expect(readdirSync(cache)).toEqual([]);
  });

  it("does not report a file another cleaner unlinked first", () => {
    const cache = cacheDir();
    const raced = plant(cache, tmpName(8), STALE_TMP_MS + 1000);
    plant(cache, tmpName(9), STALE_TMP_MS + 1000);
    fsHooks.unlink = (path) => {
      if (String(path) !== String(raced)) return;
      delete fsHooks.unlink; // this test's own unlink goes through the mock too
      unlinkSync(raced);
    };
    expect(removeStaleTmp(cache)).toEqual([tmpName(9)]);
    expect(readdirSync(cache)).toEqual([]);
  });

  // Only a vanished name (ENOENT) is skipped. Any other error from the stat
  // or the unlink, such as a permission error, is thrown as it came, so a
  // bare catch put back on either call fails these (issue #163).
  const denied = (code: string, syscall: string, path: unknown) =>
    Object.assign(new Error(`${code}: ${syscall} '${String(path)}'`), {
      code,
      syscall,
    });
  const thrownBy = (f: () => unknown) => {
    try {
      f();
    } catch (e) {
      return e;
    }
    throw new Error("removeStaleTmp did not throw");
  };

  it("throws a stat error other than a vanished name", () => {
    const cache = cacheDir();
    const locked = plant(cache, tmpName(1), STALE_TMP_MS + 1000);
    let err: unknown;
    fsHooks.stat = (path) => {
      if (String(path) === String(locked))
        throw (err = denied("EACCES", "stat", path));
    };
    expect(thrownBy(() => removeStaleTmp(cache))).toBe(err);
    expect(err).toMatchObject({ code: "EACCES" });
    expect(existsSync(locked)).toBe(true);
  });

  it("throws an unlink error other than a vanished name", () => {
    const cache = cacheDir();
    const locked = plant(cache, tmpName(2), STALE_TMP_MS + 1000);
    let err: unknown;
    fsHooks.unlink = (path) => {
      if (String(path) === String(locked))
        throw (err = denied("EPERM", "unlink", path));
    };
    expect(thrownBy(() => removeStaleTmp(cache))).toBe(err);
    expect(err).toMatchObject({ code: "EPERM" });
    expect(existsSync(locked)).toBe(true);
  });
});
