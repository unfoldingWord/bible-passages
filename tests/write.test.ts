import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { clearJson } from "../scripts/lib/write.ts";

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
