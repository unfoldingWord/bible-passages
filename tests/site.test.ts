import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// scripts/site/build.mjs embeds GitHub data (issue titles and the like) in a
// <script> element. Text written by anyone with an issue must stay data.
const repo = new URL("../", import.meta.url);
const hostile = "</script><script>window.PWNED=1</script> $' $& $` end";

function build(): string {
  const dir = mkdtempSync(join(tmpdir(), "bp-site-"));
  mkdirSync(join(dir, "scripts/site"), { recursive: true });
  mkdirSync(join(dir, "site"));
  copyFileSync(
    new URL("scripts/site/build.mjs", repo),
    join(dir, "scripts/site/build.mjs")
  );
  for (const f of ["index.src.html", "books.json"]) {
    copyFileSync(new URL(`site/${f}`, repo), join(dir, "site", f));
  }
  const snapshot = JSON.parse(
    readFileSync(new URL("site/snapshot.json", repo), "utf8")
  );
  snapshot.issues = [{ ...snapshot.issues[0], title: hostile }];
  writeFileSync(join(dir, "site/snapshot.json"), JSON.stringify(snapshot));
  execFileSync(process.execPath, [join(dir, "scripts/site/build.mjs")]);
  return readFileSync(join(dir, "site/index.html"), "utf8");
}

describe("site build", () => {
  const html = build();

  it("cannot be broken out of its <script> by a title", () => {
    expect(html).not.toContain("<script>window.PWNED");
    expect(html.match(/<\/script>/gi)?.length).toBe(
      html.match(/<script\b/gi)?.length
    );
  });

  it("keeps the title text exactly, $ patterns included", () => {
    const base = /const BASE = (.*);$/m.exec(html)?.[1] ?? "null";
    expect(JSON.parse(base).issues[0].title).toBe(hostile);
  });
});
