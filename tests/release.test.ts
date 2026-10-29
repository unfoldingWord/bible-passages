import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkAssets } from "../scripts/lib/release.ts";

// A dist/tc-mobile/ with one package per [file, revision].
function dist(packages: [string, unknown][]): string {
  const dir = mkdtempSync(join(tmpdir(), "release-assets-"));
  for (const [name, revision] of packages) {
    writeFileSync(
      join(dir, name),
      JSON.stringify({ id: name, source: { url: "x", revision } })
    );
  }
  return dir;
}

describe("release assets", () => {
  it("lists every top-level package when each carries the tag", () => {
    const dir = dist([
      ["TIT.json", "v0.1.0"],
      ["GEN.json", "v0.1.0"],
    ]);
    expect(checkAssets(dir, "v0.1.0")).toEqual({
      files: [join(dir, "GEN.json"), join(dir, "TIT.json")],
      problems: [],
    });
  });

  it("fails when a file has the wrong revision", () => {
    const dir = dist([
      ["GEN.json", "v0.1.0"],
      ["TIT.json", "unreleased"],
      ["RUT.json", "v0.0.9"],
    ]);
    expect(checkAssets(dir, "v0.1.0").problems).toEqual([
      'RUT.json: source.revision is "v0.0.9", not "v0.1.0"',
      'TIT.json: source.revision is "unreleased", not "v0.1.0"',
    ]);
  });

  it("fails when a file has no revision or is not JSON", () => {
    const dir = dist([["GEN.json", undefined]]);
    writeFileSync(join(dir, "TIT.json"), "{");
    const { problems } = checkAssets(dir, "v0.1.0");
    expect(problems).toHaveLength(2);
    expect(problems[0]).toBe(
      'GEN.json: source.revision is undefined, not "v0.1.0"'
    );
    expect(problems[1]).toMatch(/^TIT\.json: not JSON/);
  });

  it("fails on a nested file and on no packages", () => {
    const dir = dist([]);
    mkdirSync(join(dir, "titles/en"), { recursive: true });
    writeFileSync(join(dir, "titles/en/TIT.json"), "{}");
    expect(checkAssets(dir, "v0.1.0").problems).toEqual([
      "titles/en/TIT.json: nested file has no release asset name yet",
      `${dir} has no packages`,
    ]);
  });

  // The command the release script runs: a wrong revision stops it with a
  // non-zero exit and prints no file to attach.
  it("the CLI exits non-zero on a wrong revision", () => {
    const dir = dist([["TIT.json", "unreleased"]]);
    const run = () =>
      execFileSync("node", ["scripts/release/assets.ts", "v0.1.0", dir], {
        encoding: "utf8",
        stdio: "pipe",
      });
    expect(run).toThrow(/source\.revision is "unreleased", not "v0\.1\.0"/);
  });
});
