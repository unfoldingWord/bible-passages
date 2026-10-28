import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkHistory,
  checkKeys,
  gitTags,
  lastTag,
  readRelease,
  releaseTags,
  spans,
  type Release,
} from "../scripts/lib/keys.ts";
import type { Ref, Structure } from "../scripts/lib/structure.ts";

// The key-stability check on fixtures. tests/structure.test.ts runs it on
// the real data against the last release tag. See docs/schema.md, "Keys".

/** A one-chapter book from [pericope, segment...] spans as "from-to". */
function book(...pericopes: [string, ...string[]][]): Structure {
  const ref = (s: string) => s.split("-").map(Number) as [number, number];
  const span = (s: string) => {
    const [from, to] = ref(s);
    return { start: [1, from] as Ref, end: [1, to] as Ref };
  };
  return {
    book: "TIT",
    versification: "ufw",
    pericopes: pericopes.map(([p]) => ({ key: `TIT.P.1.${p}`, ...span(p) })),
    segments: pericopes.flatMap(([p, ...segs]) =>
      segs.map((s) => ({
        key: `TIT.1.${s}`,
        pericope: `TIT.P.1.${p}`,
        ...span(s),
      }))
    ),
  };
}

const release = (s: Structure, retired: Release["retired"] = []): Release => ({
  spans: spans([s]),
  retired,
});

const v1 = book(["1-4", "1-4"], ["5-9", "5-6", "7-9"]);
// The boundary between the first two pericopes moved from 1:5 to 1:4.
const moved = book(["1-3", "1-3"], ["4-9", "4-6", "7-9"]);
const movedRecord = [
  { key: "TIT.P.1.1-4", successor: "TIT.P.1.1-3" },
  { key: "TIT.P.1.5-9", successor: "TIT.P.1.4-9" },
  { key: "TIT.1.1-4", successor: "TIT.1.1-3" },
  { key: "TIT.1.5-6", successor: "TIT.1.4-6" },
];

describe("checkKeys", () => {
  it("passes with no earlier release", () => {
    expect(checkKeys(null, release(v1))).toEqual([]);
  });

  it("passes when nothing changed", () => {
    expect(checkKeys(release(v1), release(v1))).toEqual([]);
  });

  it("passes when keys are only added", () => {
    const more = book(
      ["1-4", "1-4"],
      ["5-9", "5-6", "7-9"],
      ["10-16", "10-16"]
    );
    expect(checkKeys(release(v1), release(more))).toEqual([]);
  });

  it("fails on a moved boundary with no retirement record", () => {
    expect(checkKeys(release(v1), release(moved))).toEqual([
      "TIT.P.1.1-4 was released and is missing, with no record in data/retired-keys.json",
      "TIT.P.1.5-9 was released and is missing, with no record in data/retired-keys.json",
      "TIT.1.1-4 was released and is missing, with no record in data/retired-keys.json",
      "TIT.1.5-6 was released and is missing, with no record in data/retired-keys.json",
    ]);
  });

  it("passes on a moved boundary whose old keys are retired", () => {
    expect(checkKeys(release(v1), release(moved, movedRecord))).toEqual([]);
  });

  it("fails on a dropped key with no retirement record", () => {
    const dropped = book(["1-4", "1-4"], ["5-9", "5-9"]);
    expect(checkKeys(release(v1), release(dropped))).toEqual([
      "TIT.1.5-6 was released and is missing, with no record in data/retired-keys.json",
      "TIT.1.7-9 was released and is missing, with no record in data/retired-keys.json",
    ]);
  });

  it("fails on a released key whose span changed", () => {
    const changed = release(v1);
    changed.spans.set("TIT.1.7-9", { start: [1, 7], end: [1, 8] });
    expect(checkKeys(release(v1), changed)).toEqual([
      "TIT.1.7-9 moved from 1:7-1:9 to 1:7-1:8",
    ]);
  });

  it("passes on a retired span that is live again under its own key", () => {
    const previous = release(moved, movedRecord);
    const reused = book(
      ["1-3", "1-3"],
      ["4-9", "4-6", "7-9"],
      ["10-16", "10-16"]
    );
    reused.segments.push({
      key: "TIT.1.1-4",
      pericope: "TIT.P.1.1-3",
      start: [1, 1],
      end: [1, 4],
    });
    expect(checkKeys(previous, release(reused, movedRecord))).toEqual([]);
  });

  it("fails on a retired key used for a different span", () => {
    const previous = release(moved, movedRecord);
    const reused = book(
      ["1-3", "1-3"],
      ["4-9", "4-6", "7-9"],
      ["10-16", "10-16"]
    );
    reused.segments.push({
      key: "TIT.1.1-4",
      pericope: "TIT.P.1.1-3",
      start: [1, 1],
      end: [1, 5],
    });
    expect(checkKeys(previous, release(reused, movedRecord))).toEqual([
      "TIT.1.1-4 is retired and used again for 1:1-1:5, a different span",
    ]);
  });

  it("fails when a released retirement record is removed or changed", () => {
    const previous = release(moved, movedRecord);
    // The first record's successor changed; the second record is gone.
    const edited = [
      { key: "TIT.P.1.1-4", successor: "TIT.P.1.4-9" },
      ...movedRecord.slice(2),
    ];
    expect(checkKeys(previous, release(moved, edited))).toEqual([
      "TIT.P.1.1-4: its retirement record (successor TIT.P.1.1-3) was removed or changed",
      "TIT.P.1.5-9: its retirement record (successor TIT.P.1.4-9) was removed or changed",
    ]);
  });

  it("fails on a successor that is not a current key", () => {
    const record = [{ key: "TIT.1.9-9", successor: "TIT.1.9-10" }];
    expect(checkKeys(null, release(v1, record))).toEqual([
      "TIT.1.9-9: successor TIT.1.9-10 is not a current key",
    ]);
  });

  it("follows a chain of successors to a current key", () => {
    const record = [
      { key: "TIT.1.1-5", successor: "TIT.1.1-4" },
      { key: "TIT.1.1-4", successor: "TIT.1.1-3" },
    ];
    expect(checkKeys(null, release(moved, record))).toEqual([]);
  });

  it("fails on a successor chain that loops", () => {
    const record = [
      { key: "TIT.1.1-5", successor: "TIT.1.1-6" },
      { key: "TIT.1.1-6", successor: "TIT.1.1-5" },
    ];
    expect(checkKeys(null, release(v1, record))).toEqual([
      "TIT.1.1-5: its successors loop back to TIT.1.1-5",
      "TIT.1.1-6: its successors loop back to TIT.1.1-6",
    ]);
  });

  it("fails on a key retired twice", () => {
    const record = [
      { key: "TIT.1.1-4", successor: "TIT.1.1-3" },
      { key: "TIT.1.1-4", successor: "TIT.1.1-3" },
    ];
    expect(checkKeys(null, release(moved, record))).toEqual([
      "TIT.1.1-4 is retired twice",
    ]);
  });
});

describe("lastTag", () => {
  it("is null with no release tag", () => {
    expect(lastTag([])).toBeNull();
    expect(lastTag(["draft", "v1", "v1.0", "v1.0.0-rc.1", "1.0.0"])).toBeNull();
  });

  it("orders by version, not by text", () => {
    expect(lastTag(["v0.9.0", "v0.10.0", "v0.2.11"])).toBe("v0.10.0");
    expect(lastTag(["v1.0.0", "v0.99.99"])).toBe("v1.0.0");
  });

  it("leaves out the tag being released", () => {
    expect(lastTag(["v0.1.0", "v0.2.0"], "v0.2.0")).toBe("v0.1.0");
    expect(lastTag(["v0.1.0"], "v0.1.0")).toBeNull();
  });

  it("ignores tags with leading zeros", () => {
    expect(lastTag(["v0.1.0", "v01.0.0"])).toBe("v0.1.0");
  });
});

describe("reading a release from its tag", () => {
  const git = (cwd: string, ...args: string[]) =>
    execFileSync(
      "git",
      [
        "-c",
        "user.name=test",
        "-c",
        "user.email=test@example.invalid",
        ...args,
      ],
      { cwd, encoding: "utf8" }
    );
  const tit = JSON.parse(
    readFileSync(new URL("../data/structure/TIT.json", import.meta.url), "utf8")
  ) as Structure;

  function repo(): string {
    const dir = mkdtempSync(join(tmpdir(), "release-keys-"));
    git(dir, "init", "-q", "-b", "main");
    mkdirSync(join(dir, "data/structure"), { recursive: true });
    writeFileSync(join(dir, "data/structure/TIT.json"), JSON.stringify(tit));
    writeFileSync(join(dir, "package.json"), '{ "version": "0.1.0" }');
    git(dir, "add", ".");
    git(dir, "commit", "-q", "-m", "release");
    git(dir, "tag", "v0.1.0");
    return dir;
  }

  it("reads the tagged structure, with no retired keys when the file is absent", () => {
    const dir = repo();
    expect(gitTags(dir)).toEqual(["v0.1.0"]);
    const released = readRelease(dir, "v0.1.0");
    expect(released.retired).toEqual([]);
    expect(released.spans).toEqual(spans([tit]));
    expect(checkKeys(released, released)).toEqual([]);
  });

  it("reads the tagged retired-keys record", () => {
    const dir = repo();
    const record = { retired: [{ key: "TIT.1.1-5", successor: "TIT.1.1-4" }] };
    writeFileSync(join(dir, "data/retired-keys.json"), JSON.stringify(record));
    git(dir, "add", ".");
    git(dir, "commit", "-q", "-m", "retire");
    git(dir, "tag", "-a", "-m", "annotated", "v0.2.0");
    expect(readRelease(dir, "v0.2.0").retired).toEqual(record.retired);
  });

  it("fails on a planted moved key in the real Titus structure", () => {
    const released = readRelease(repo(), "v0.1.0");
    // Move the first segment's end back one verse and give the next one the
    // verse, keeping the keys but changing their spans.
    const planted = structuredClone(tit);
    const [a, b] = planted.segments;
    if (!a || !b) throw new Error("Titus has fewer than two segments");
    a.end = [a.end[0], a.end[1] - 1];
    b.start = [b.start[0], b.start[1] - 1];
    const problems = checkKeys(released, {
      spans: spans([planted]),
      retired: [],
    });
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(
      new RegExp(`^${a.key.replace(/\./g, "\\.")} moved from `)
    );
  });

  it("takes as baseline only a tag on main naming its package.json version", () => {
    const dir = repo();
    // On main, but package.json still says 0.1.0.
    git(dir, "commit", "-q", "--allow-empty", "-m", "unbumped");
    git(dir, "tag", "v0.3.0");
    // Off main, with the structure gone and the version not bumped.
    git(dir, "checkout", "-q", "-b", "side");
    git(dir, "rm", "-q", "data/structure/TIT.json");
    git(dir, "commit", "-q", "-m", "thinner");
    git(dir, "tag", "v9.9.9");
    git(dir, "checkout", "-q", "main");
    expect(lastTag(gitTags(dir))).toBe("v9.9.9");
    expect(releaseTags(dir)).toEqual(["v0.1.0"]);
    expect(releaseTags(dir, "side")).toEqual(["v0.1.0"]);
    // Dropping a v0.1.0 key still fails against the real baseline.
    const tag = lastTag(releaseTags(dir));
    expect(tag).toBe("v0.1.0");
    const dropped = structuredClone(tit);
    dropped.segments.pop();
    const problems = checkKeys(readRelease(dir, tag ?? ""), {
      spans: spans([dropped]),
      retired: [],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/was released and is missing/);
  });

  it("checks every release tag, so a failed tag left on main hides nothing", () => {
    const dir = repo();
    // v0.2.0 moves two segment boundaries with no retirement record: its own
    // check against v0.1.0 fails, but the tag stays on main.
    const moved = structuredClone(tit);
    const [a, b] = moved.segments;
    if (!a || !b) throw new Error("Titus has fewer than two segments");
    a.end = [a.end[0], a.end[1] - 1];
    b.start = [b.start[0], b.start[1] - 1];
    a.key = `TIT.${a.start[0]}.${a.start[1]}-${a.end[1]}`;
    b.key = `TIT.${b.start[0]}.${b.start[1]}-${b.end[1]}`;
    writeFileSync(join(dir, "data/structure/TIT.json"), JSON.stringify(moved));
    writeFileSync(join(dir, "package.json"), '{ "version": "0.2.0" }');
    git(dir, "commit", "-q", "-am", "moved, unrecorded");
    git(dir, "tag", "v0.2.0");
    const current = { spans: spans([moved]), retired: [] };
    expect(
      checkHistory(dir, current, "v0.2.0").filter((p) => /missing/.test(p))
    ).toHaveLength(2);
    // v0.3.0 tags the same structure. The last tag alone (v0.2.0) finds
    // nothing; every tag still finds the two keys v0.1.0 released.
    writeFileSync(join(dir, "package.json"), '{ "version": "0.3.0" }');
    git(dir, "commit", "-q", "-am", "same structure");
    git(dir, "tag", "v0.3.0");
    expect(lastTag(releaseTags(dir), "v0.3.0")).toBe("v0.2.0");
    expect(checkKeys(readRelease(dir, "v0.2.0"), current)).toEqual([]);
    const problems = checkHistory(dir, current, "v0.3.0");
    expect(problems).toHaveLength(2);
    for (const p of problems) {
      expect(p).toMatch(/^v0\.1\.0: TIT\.1\.\S+ was released and is missing/);
    }
  });

  it("checks only the retired-keys record with no release tag", () => {
    const dir = mkdtempSync(join(tmpdir(), "release-keys-none-"));
    git(dir, "init", "-q", "-b", "main");
    git(dir, "commit", "-q", "--allow-empty", "-m", "start");
    const current = {
      spans: spans([tit]),
      retired: [{ key: "TIT.1.1-5", successor: "TIT.1.99-99" }],
    };
    expect(checkHistory(dir, current)).toEqual([
      "TIT.1.1-5: successor TIT.1.99-99 is not a current key",
    ]);
  });

  it("refuses a shallow clone", () => {
    const source = repo();
    git(source, "commit", "-q", "--allow-empty", "-m", "second");
    const dir = mkdtempSync(join(tmpdir(), "release-keys-shallow-"));
    git(dir, "clone", "-q", "--depth", "1", `file://${source}`, "clone");
    expect(() => gitTags(join(dir, "clone"))).toThrow(/shallow clone/);
  });
});
