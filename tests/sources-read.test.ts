import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { readSource, type Source } from "../scripts/lib/sources.ts";

// scripts/lib/sources.ts, without the network: each case is decided by the
// cache or before any request.
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
