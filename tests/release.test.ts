import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

  it("fails on a top-level file that is not a package, but keeps .gitkeep", () => {
    const dir = dist([["TIT.json", "v0.1.0"]]);
    writeFileSync(join(dir, ".gitkeep"), "");
    writeFileSync(join(dir, "README.txt"), "x");
    expect(checkAssets(dir, "v0.1.0").problems).toEqual([
      "README.txt: top-level file is not a .json package",
    ]);
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
    const run = spawnSync(
      "node",
      ["scripts/release/assets.ts", "v0.1.0", dir],
      { encoding: "utf8" }
    );
    expect(run.status).toBe(1);
    expect(run.stdout).toBe("");
    expect(run.stderr).toMatch(
      /source\.revision is "unreleased", not "v0\.1\.0"/
    );
  });

  // The build overwrites data/, so a dry run must stop before it rather than
  // replace an uncommitted title edit and report success.
  it("a dry run refuses to start over an uncommitted data/ edit", () => {
    const repo = mkdtempSync(join(tmpdir(), "release-dirty-"));
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: repo, stdio: "pipe" });
    writeFileSync(join(repo, "package.json"), '{"version":"0.0.0"}');
    mkdirSync(join(repo, "data"));
    writeFileSync(join(repo, "data/t.json"), '"committed"');
    git("init", "-q");
    git("add", ".");
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "t");
    writeFileSync(join(repo, "data/t.json"), '"local edit"');
    const script = join(process.cwd(), "scripts/release/run.sh");
    let out = "";
    expect(() => {
      try {
        execFileSync("bash", [script, "--dry-run"], {
          cwd: repo,
          stdio: "pipe",
        });
      } catch (e) {
        out = String((e as { stdout: Buffer }).stdout);
        throw e;
      }
    }).toThrow();
    expect(out).toMatch(/data\/ or dist\/ has uncommitted changes/);
    expect(readFileSync(join(repo, "data/t.json"), "utf8")).toBe(
      '"local edit"'
    );
  });
});
