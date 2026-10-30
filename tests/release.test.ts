import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkAssets, isAssetName } from "../scripts/lib/release.ts";

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

// A dist/tc-mobile/ with packages TIT and PHP at version 0.1.0, built for
// v0.1.0, and title tables added by table().
function release(): string {
  const dir = mkdtempSync(join(tmpdir(), "release-assets-"));
  for (const book of ["TIT", "PHP"])
    writeFileSync(
      join(dir, `${book}.json`),
      JSON.stringify({
        id: `bible-passages:${book}`,
        version: "0.1.0",
        source: { url: "x", revision: "v0.1.0" },
      })
    );
  return dir;
}

function table(
  dir: string,
  language: string,
  book: string,
  fields: Record<string, unknown> = {}
): void {
  mkdirSync(join(dir, "titles", language), { recursive: true });
  writeFileSync(
    join(dir, "titles", language, `${book}.json`),
    JSON.stringify({
      packageId: `bible-passages:${book}`,
      version: "0.1.0",
      language,
      chapters: {},
      segments: {},
      ...fields,
    })
  );
}

describe("release assets", () => {
  it("lists every top-level package when each carries the tag", () => {
    const dir = dist([
      ["TIT.json", "v0.1.0"],
      ["GEN.json", "v0.1.0"],
    ]);
    expect(checkAssets(dir, "v0.1.0")).toEqual({
      assets: [
        { file: join(dir, "GEN.json"), name: "GEN.json" },
        { file: join(dir, "TIT.json"), name: "TIT.json" },
      ],
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
      '"README.txt": top-level file is not a package <BOOK>.json',
    ]);
  });

  // Neither is a regular file, so neither would be checked or attached.
  it("fails on a top-level symlink or directory named .json", () => {
    const dir = dist([["TIT.json", "v0.1.0"]]);
    symlinkSync(join(dir, "TIT.json"), join(dir, "link.json"));
    mkdirSync(join(dir, "x.json"));
    symlinkSync(join(dir, "TIT.json"), join(dir, "link"));
    expect(checkAssets(dir, "v0.1.0")).toEqual({
      assets: [{ file: join(dir, "TIT.json"), name: "TIT.json" }],
      problems: [
        "link: top-level symlink is not a regular file",
        "link.json: top-level symlink is not a regular file",
        "x.json: top-level directory is not a regular file",
      ],
    });
  });

  // Not attached and not revision-checked, so it must not pass silently.
  it("fails on a nested symlink", () => {
    const dir = dist([["TIT.json", "v0.1.0"]]);
    mkdirSync(join(dir, "titles/en"), { recursive: true });
    symlinkSync(join(dir, "TIT.json"), join(dir, "titles/en/TIT.json"));
    expect(checkAssets(dir, "v0.1.0").problems).toEqual([
      "titles/en/TIT.json: nested symlink is not a regular file",
    ]);
  });

  it("fails on no packages", () => {
    const dir = dist([]);
    expect(checkAssets(dir, "v0.1.0").problems).toEqual([
      `${dir} has no packages`,
    ]);
  });

  it("attaches each title table as titles.<lang>.<BOOK>.json (#61)", () => {
    const dir = release();
    table(dir, "en", "TIT");
    table(dir, "es-419", "TIT");
    table(dir, "en", "PHP");
    expect(checkAssets(dir, "v0.1.0")).toEqual({
      assets: [
        { file: join(dir, "PHP.json"), name: "PHP.json" },
        { file: join(dir, "TIT.json"), name: "TIT.json" },
        { file: join(dir, "titles/en/PHP.json"), name: "titles.en.PHP.json" },
        { file: join(dir, "titles/en/TIT.json"), name: "titles.en.TIT.json" },
        {
          file: join(dir, "titles/es-419/TIT.json"),
          name: "titles.es-419.TIT.json",
        },
      ],
      problems: [],
    });
  });

  // A table carries no source.revision; it is tied to the release through
  // the package it names, whose revision is checked.
  it("fails on a title table that does not match its package", () => {
    const dir = release();
    table(dir, "en", "TIT", { packageId: "bible-passages:PHP" });
    table(dir, "fr", "TIT", { version: "0.0.9" });
    table(dir, "es-419", "TIT", { language: "es" });
    table(dir, "en", "PHP", { version: undefined });
    table(dir, "en", "GEN");
    mkdirSync(join(dir, "titles/hi"), { recursive: true });
    writeFileSync(join(dir, "titles/hi/TIT.json"), "[1]");
    // In asset-name order: titles.en.GEN, .en.PHP, .en.TIT, .es-419.TIT, ...
    expect(checkAssets(dir, "v0.1.0").problems).toEqual([
      "titles/en/GEN.json: no package GEN.json in this release",
      'titles/en/PHP.json: version is undefined, not "0.1.0" (PHP.json\'s version)',
      'titles/en/TIT.json: packageId is "bible-passages:PHP", not "bible-passages:TIT" (TIT.json\'s id)',
      'titles/es-419/TIT.json: language is "es", not "es-419"',
      'titles/fr/TIT.json: version is "0.0.9", not "0.1.0" (TIT.json\'s version)',
      "titles/hi/TIT.json: not a JSON object",
    ]);
  });

  it("fails on any other nested file", () => {
    const dir = release();
    const bad = [
      "titles/TIT.json",
      "titles/en/x/TIT.json",
      "titles/en/tit.json",
      "titles/en/TITUS.json",
      "titles/en/README.txt",
      "titles/EN/TIT.json",
      "other/en/TIT.json",
      "en/TIT.json",
      // Private-use tags are not supported yet (#92, docs/schema.md).
      "titles/el-x-koine/TIT.json",
    ];
    for (const f of bad) {
      mkdirSync(join(dir, f, ".."), { recursive: true });
      writeFileSync(join(dir, f), "{}");
    }
    const { assets, problems } = checkAssets(dir, "v0.1.0");
    expect(problems).toEqual(
      bad.map((f) => `${f}: nested file has no release asset name`).sort()
    );
    expect(assets.map((a) => a.name)).toEqual(["PHP.json", "TIT.json"]);
  });

  // Asset names are an allowlist (#108): a package is <BOOK>.json with a
  // known book code, a table titles.<lang>.<BOOK>.json. Anything else at the
  // top level stops the release; it is neither read nor attached. That
  // covers run.sh's TAB-split lines and gh's "file#label" (#92), and a
  // top-level file named like a table's asset.
  it("fails on a top-level .json file not named <BOOK>.json (#108)", () => {
    const names = [
      "ab.json",
      "a#b.json",
      "a\tb.json",
      "a\nb.json",
      "a\rb.json",
      "XYZ.json",
      "tit.json",
      "TITUS.json",
      "TIT.JSON",
      "titles.en.TIT.json",
    ];
    const dir = release();
    table(dir, "en", "TIT");
    for (const n of names)
      writeFileSync(
        join(dir, n),
        JSON.stringify({ source: { revision: "v0.1.0" } })
      );
    const { assets, problems } = checkAssets(dir, "v0.1.0");
    expect(problems).toEqual(
      [...names]
        .sort()
        .map(
          (n) =>
            `${JSON.stringify(n)}: top-level file is not a package <BOOK>.json`
        )
    );
    expect(assets.map((a) => a.name)).toEqual([
      "PHP.json",
      "TIT.json",
      "titles.en.TIT.json",
    ]);
  });

  it("allows only <BOOK>.json and titles.<lang>.<BOOK>.json (#108)", () => {
    for (const n of [
      "TIT.json",
      "1CO.json",
      "titles.en.TIT.json",
      "titles.es-419.PHP.json",
    ])
      expect(isAssetName(n), n).toBe(true);
    for (const n of [
      "ab.json",
      "a#b.json",
      "a\tb.json",
      "a\rb.json",
      "a\nb.json",
      "XYZ.json",
      "TIT.json\n",
      "TIT#x.json",
      "titles.en.XYZ.json",
      "titles.EN.TIT.json",
      "titles.en.TIT#x.json",
      "titles.e\tn.TIT.json",
      "titles.el-x-koine.TIT.json",
      "titles..TIT.json",
      "titles.en.TIT",
      "titles/en/TIT.json",
    ])
      expect(isAssetName(n), JSON.stringify(n)).toBe(false);
  });

  it("fails on a title table for an unknown book code (#108)", () => {
    const dir = release();
    table(dir, "en", "XYZ");
    expect(checkAssets(dir, "v0.1.0").problems).toEqual([
      "titles/en/XYZ.json: nested file has no release asset name",
    ]);
  });

  // The package's own problem is reported; the table must not claim the
  // package is missing when it is present but unreadable.
  it("says a table's package failed validation, not that it is missing (#92)", () => {
    const dir = release();
    writeFileSync(join(dir, "TIT.json"), "{");
    writeFileSync(join(dir, "PHP.json"), "[1]");
    table(dir, "en", "TIT");
    table(dir, "en", "PHP");
    const { problems } = checkAssets(dir, "v0.1.0");
    expect(problems).toHaveLength(4);
    expect(problems[0]).toBe("PHP.json: not a JSON object");
    expect(problems[1]).toMatch(/^TIT\.json: not JSON/);
    expect(problems.slice(2)).toEqual([
      "titles/en/PHP.json: package PHP.json failed validation",
      "titles/en/TIT.json: package TIT.json failed validation",
    ]);
  });

  // The table body tc-mobile reads (scripts/lib/title-table.ts, TitleTable).
  // Each failing limb is its own problem (#108).
  it("names each way a title table's body is not chapters and segments (#108)", () => {
    const dir = release();
    table(dir, "en", "TIT", { chapters: [] });
    table(dir, "es", "TIT", { segments: null });
    table(dir, "fr", "TIT", { chapters: undefined });
    table(dir, "hi", "TIT", { source: { revision: "v0.1.0" } });
    table(dir, "en", "PHP", { segments: "x" });
    table(dir, "id", "TIT", {
      chapters: undefined,
      segments: 1,
      source: null,
    });
    table(dir, "ru", "TIT");
    expect(checkAssets(dir, "v0.1.0").problems).toEqual([
      'titles/en/PHP.json: segments is "x", not an object',
      "titles/en/TIT.json: chapters is [], not an object",
      "titles/es/TIT.json: segments is null, not an object",
      "titles/fr/TIT.json: chapters is undefined, not an object",
      "titles/hi/TIT.json: has a source block; a title table has none",
      "titles/id/TIT.json: chapters is undefined, not an object",
      "titles/id/TIT.json: segments is 1, not an object",
      "titles/id/TIT.json: has a source block; a title table has none",
    ]);
  });

  // One pass lists every reason: the body is checked even when the table's
  // package is missing or unreadable (#108).
  it("checks a table's body when its package is missing or unreadable (#108)", () => {
    const dir = release();
    writeFileSync(join(dir, "PHP.json"), "{");
    table(dir, "en", "PHP", { chapters: [] });
    table(dir, "en", "GEN", { source: {} });
    const { problems } = checkAssets(dir, "v0.1.0");
    expect(problems[0]).toMatch(/^PHP\.json: not JSON/);
    expect(problems.slice(1)).toEqual([
      "titles/en/GEN.json: has a source block; a title table has none",
      "titles/en/GEN.json: no package GEN.json in this release",
      "titles/en/PHP.json: chapters is [], not an object",
      "titles/en/PHP.json: package PHP.json failed validation",
    ]);
  });

  // run.sh reads "<asset name><TAB><file>" and attaches a copy under the name.
  it("the CLI prints each asset name and its file", () => {
    const dir = release();
    table(dir, "en", "TIT");
    const run = spawnSync(
      "node",
      ["scripts/release/assets.ts", "v0.1.0", dir],
      { encoding: "utf8" }
    );
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
    expect(run.stdout).toBe(
      [
        `PHP.json\t${join(dir, "PHP.json")}`,
        `TIT.json\t${join(dir, "TIT.json")}`,
        `titles.en.TIT.json\t${join(dir, "titles/en/TIT.json")}`,
        "",
      ].join("\n")
    );
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
