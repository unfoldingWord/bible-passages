// The writer behind scripts/review/apply.ts (#56): a batch's files are
// staged as `*.review-tmp` beside their targets, then renamed. A run stopped
// between two renames leaves a staged file, and the next run refuses to
// start until it is cleared.
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { applyReviews, type DraftFile } from "../scripts/lib/review.ts";
import {
  leftovers,
  nodeFs,
  writeBatch,
  type BatchFs,
} from "../scripts/lib/review-write.ts";

const repo = new URL("../", import.meta.url);
const NOW = Date.parse("2026-10-30T00:00:00.000Z");

const draft = (text: string) => ({
  text,
  source: "ai:model-a",
  status: "ai-checked",
});
const book = (b: string, key: string, text: string): DraftFile => ({
  language: "en",
  book: b,
  titles: { [key]: draft(text) },
});
const keep = (key: string, text: string, at = "2026-10-29T10:00:00.000Z") => ({
  at,
  changed: false,
  key,
  lang: "en",
  ms: 5000,
  note: "",
  pick: "keep",
  shown: [],
  text,
  v: 1,
});
const exported = (records: unknown[]) => ({
  schema: "bp.review-export",
  v: 2,
  reviewer: "reviewer:reader-7",
  records,
});

// Two books, so a batch spans two files: today's maximum (en/PHP and
// en/TIT are the only drafts).
const BOOKS: [string, string, string][] = [
  ["PHP", "PHP.1.1-2", "Paul greets the believers in Philippi"],
  ["TIT", "TIT.1.4-4", "Paul greets Titus"],
];
const batch = exported(BOOKS.map(([, key, text]) => keep(key, text)));

/** A temporary copy of the repo's layout holding the two drafts. */
function layout() {
  const dir = mkdtempSync(join(tmpdir(), "bp-review-write-"));
  cpSync(new URL("scripts/", repo), join(dir, "scripts"), { recursive: true });
  cpSync(new URL("package.json", repo), join(dir, "package.json"));
  cpSync(new URL(".prettierrc", repo), join(dir, ".prettierrc"));
  symlinkSync(
    fileURLToPath(new URL("node_modules", repo)),
    join(dir, "node_modules"),
    "dir"
  );
  mkdirSync(join(dir, "data/drafts/en"), { recursive: true });
  for (const [b, key, text] of BOOKS) {
    writeFileSync(
      join(dir, `data/drafts/en/${b}.json`),
      JSON.stringify(book(b, key, text))
    );
  }
  const exportPath = join(dir, "export.json");
  writeFileSync(exportPath, JSON.stringify(batch));
  const drafts = pathToFileURL(join(dir, "data/drafts/"));
  const read = (b: string) =>
    readFileSync(join(dir, `data/drafts/en/${b}.json`), "utf8");
  const files = () =>
    new Map<string, DraftFile>(
      BOOKS.map(([b]) => [`en/${b}`, JSON.parse(read(b)) as DraftFile])
    );
  const cli = (...args: string[]) =>
    spawnSync(
      process.execPath,
      [join(dir, "scripts/review/apply.ts"), exportPath, ...args],
      { encoding: "utf8" }
    );
  return { dir, drafts, read, files, cli };
}

/** Every title in the file carries this batch's review. */
const reviewed = (text: string) =>
  Object.values((JSON.parse(text) as DraftFile).titles).every(
    (t) => t.review?.saved === "2026-10-29T10:00:00.000Z"
  );

/** Node's file system, with the nth call of one operation made to throw. */
function failing(op: keyof BatchFs, nth: number): BatchFs {
  let calls = 0;
  const wrap =
    <A extends unknown[]>(name: keyof BatchFs, f: (...a: A) => void) =>
    (...a: A) => {
      if (name === op && ++calls === nth) {
        throw new Error(`injected ${op} failure`);
      }
      f(...a);
    };
  return {
    write: wrap("write", nodeFs.write),
    rename: wrap("rename", nodeFs.rename),
    remove: nodeFs.remove,
  };
}

const changes = (files: ReadonlyMap<string, DraftFile>) => {
  const r = applyReviews(files, [batch], NOW);
  expect(r.problems).toEqual([]);
  expect([...r.changed.keys()].sort()).toEqual(["en/PHP", "en/TIT"]);
  return r.changed;
};

describe("writeBatch", () => {
  it("writes every file of a batch and leaves no staged file", async () => {
    const t = layout();
    await writeBatch(t.drafts, changes(t.files()));
    expect(reviewed(t.read("PHP"))).toBe(true);
    expect(reviewed(t.read("TIT"))).toBe(true);
    expect(leftovers(t.drafts)).toEqual([]);
    // Formatted as prettier --check expects: the file ends in a newline
    // and is indented.
    expect(t.read("TIT")).toMatch(/^\{\n {2}"language": "en",[\s\S]*\}\n$/);
    rmSync(t.dir, { recursive: true });
  });

  it("leaves every target and no staged file when a write fails", async () => {
    const t = layout();
    const before = BOOKS.map(([b]) => t.read(b));
    await expect(
      writeBatch(t.drafts, changes(t.files()), failing("write", 2))
    ).rejects.toThrow(/injected write failure/);
    expect(BOOKS.map(([b]) => t.read(b))).toEqual(before);
    expect(leftovers(t.drafts)).toEqual([]);
    rmSync(t.dir, { recursive: true });
  });

  it("refuses a staged file already present, and keeps it", async () => {
    const t = layout();
    const before = BOOKS.map(([b]) => t.read(b));
    const stray = join(t.dir, "data/drafts/en/TIT.json.review-tmp");
    writeFileSync(stray, "not ours");
    await expect(writeBatch(t.drafts, changes(t.files()))).rejects.toThrow(
      /EEXIST/
    );
    expect(BOOKS.map(([b]) => t.read(b))).toEqual(before);
    // The other book's staged file is removed; the one found is not ours.
    expect(readFileSync(stray, "utf8")).toBe("not ours");
    expect(leftovers(t.drafts)).toEqual(["en/TIT.json.review-tmp"]);
    rmSync(t.dir, { recursive: true });
  });

  it("leaves a staged file to detect when the first rename fails", async () => {
    const t = layout();
    const before = BOOKS.map(([b]) => t.read(b));
    await expect(
      writeBatch(t.drafts, changes(t.files()), failing("rename", 1))
    ).rejects.toThrow(/interrupted after 0 of 2 files/);
    // Targets unchanged; both staged files kept as the marker.
    expect(BOOKS.map(([b]) => t.read(b))).toEqual(before);
    expect(leftovers(t.drafts)).toEqual([
      "en/PHP.json.review-tmp",
      "en/TIT.json.review-tmp",
    ]);
    rmSync(t.dir, { recursive: true });
  });
});

describe("a batch interrupted between two renames", () => {
  it("is refused on the next run, and completed by re-running it", async () => {
    const t = layout();
    const tit = t.read("TIT");
    let err: Error | undefined;
    try {
      await writeBatch(t.drafts, changes(t.files()), failing("rename", 2));
    } catch (e) {
      err = e as Error;
    }
    expect(err?.message).toMatch(/interrupted after 1 of 2 files/);
    expect(err?.message).toContain("data/drafts/en/TIT.json.review-tmp");
    // Half applied: PHP renamed, TIT not, and its staged file left behind.
    expect(reviewed(t.read("PHP"))).toBe(true);
    expect(t.read("TIT")).toBe(tit);
    expect(leftovers(t.drafts)).toEqual(["en/TIT.json.review-tmp"]);

    // The next run, even a dry run, refuses before reading the batch, names
    // the staged file and says how to recover. Nothing changes.
    for (const args of [[], ["--dry-run"]]) {
      const r = t.cli(...args);
      expect(r.status).toBe(1);
      expect(r.stdout).toBe("");
      expect(r.stderr).toContain("interrupted");
      expect(r.stderr).toContain("- data/drafts/en/TIT.json.review-tmp");
      expect(r.stderr).toContain("run the same batch again");
      expect(r.stderr).toContain("git diff data/drafts");
      expect(t.read("TIT")).toBe(tit);
      expect(leftovers(t.drafts)).toEqual(["en/TIT.json.review-tmp"]);
    }

    // Recovery as printed: delete the staged file, run the batch again. The
    // applied book's record is passed over; the other is applied.
    rmSync(join(t.dir, "data/drafts/en/TIT.json.review-tmp"));
    const php = t.read("PHP");
    const again = t.cli();
    expect(again.stderr).toBe("");
    expect(again.status).toBe(0);
    expect(again.stdout).toContain("| en | TIT.1.4-4 | keep |");
    expect(again.stdout).toMatch(/1 saved no later than a review already/);
    expect(t.read("PHP")).toBe(php);
    expect(reviewed(t.read("TIT"))).toBe(true);
    expect(leftovers(t.drafts)).toEqual([]);
    rmSync(t.dir, { recursive: true });
  }, 60_000);

  it("is the same whole batch as a run that was not interrupted", async () => {
    const whole = layout();
    expect(whole.cli().status).toBe(0);
    const split = layout();
    await expect(
      writeBatch(split.drafts, changes(split.files()), failing("rename", 2))
    ).rejects.toThrow();
    for (const name of leftovers(split.drafts)) {
      rmSync(new URL(name, split.drafts));
    }
    expect(split.cli().status).toBe(0);
    for (const [b] of BOOKS) expect(split.read(b)).toBe(whole.read(b));
    rmSync(whole.dir, { recursive: true });
    rmSync(split.dir, { recursive: true });
  }, 60_000);
});

describe("leftovers", () => {
  it("finds staged files in any language directory, and nothing else", () => {
    const dir = mkdtempSync(join(tmpdir(), "bp-review-left-"));
    const drafts = pathToFileURL(join(dir, "drafts/"));
    expect(leftovers(drafts)).toEqual([]);
    mkdirSync(join(dir, "drafts/en"), { recursive: true });
    mkdirSync(join(dir, "drafts/ar"), { recursive: true });
    writeFileSync(join(dir, "drafts/en/TIT.json"), "{}");
    writeFileSync(join(dir, "drafts/notes.review-tmp.txt"), "");
    expect(leftovers(drafts)).toEqual([]);
    writeFileSync(join(dir, "drafts/ar/TIT.json.review-tmp"), "");
    writeFileSync(join(dir, "drafts/stray.review-tmp"), "");
    expect(leftovers(drafts)).toEqual([
      "ar/TIT.json.review-tmp",
      "stray.review-tmp",
    ]);
    // A staged file that is a link is still found, not followed.
    renameSync(
      join(dir, "drafts/ar/TIT.json.review-tmp"),
      join(dir, "drafts/ar/x")
    );
    symlinkSync(
      join(dir, "nowhere"),
      join(dir, "drafts/en/PHP.json.review-tmp")
    );
    expect(leftovers(drafts)).toEqual([
      "en/PHP.json.review-tmp",
      "stray.review-tmp",
    ]);
    expect(existsSync(join(dir, "drafts/en/PHP.json.review-tmp"))).toBe(false);
    rmSync(dir, { recursive: true });
  });
});
