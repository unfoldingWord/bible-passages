import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { clearJson, writeJson } from "../scripts/lib/write.ts";

// The build clears its output directories first, so a book dropped from the
// build leaves no stale file for CI's fresh-build check to miss.
describe("clearJson", () => {
  it("deletes .json files and keeps the rest", () => {
    const dir = mkdtempSync(join(tmpdir(), "clear-json-"));
    for (const name of ["TIT.json", "ROM.json", ".gitkeep", "notes.md"]) {
      writeFileSync(join(dir, name), "{}");
    }
    clearJson(pathToFileURL(`${dir}/`));
    expect(readdirSync(dir).sort()).toEqual([".gitkeep", "notes.md"]);
  });

  it("does nothing when the directory does not exist", () => {
    const dir = join(tmpdir(), `clear-json-missing-${process.pid}`);
    expect(() => clearJson(pathToFileURL(`${dir}/`))).not.toThrow();
  });
});

describe("writeJson", () => {
  it("replaces a file whole and leaves no temporary file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "write-json-"));
    const file = pathToFileURL(join(dir, "run.json"));
    writeFileSync(file, '{"calls":[]}');
    await writeJson(file, { calls: [1] });
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ calls: [1] });
    expect(readdirSync(dir)).toEqual(["run.json"]);
  });

  it("keeps the earlier file and removes the temporary one when the replace fails", async () => {
    const dir = mkdtempSync(join(tmpdir(), "write-json-"));
    // A non-empty directory where the file should go: the rename fails.
    mkdirSync(join(dir, "run.json"));
    writeFileSync(join(dir, "run.json", "keep"), "x");
    await expect(
      writeJson(pathToFileURL(join(dir, "run.json")), { calls: [] })
    ).rejects.toThrow();
    expect(readdirSync(dir)).toEqual(["run.json"]);
    expect(readdirSync(join(dir, "run.json"))).toEqual(["keep"]);
  });
});
