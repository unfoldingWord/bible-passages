import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseTemplatePackage,
  parseTemplateTitleTable,
  TemplateValidationError,
} from "../vendor/tc-mobile/validate";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root));
const json = (path: string): unknown => JSON.parse(read(path).toString("utf8"));

describe("vendored tc-mobile checker", () => {
  // The hashes in VENDOR.md are the record of what was copied. A file that
  // no longer matches was edited here, which VENDOR.md forbids.
  it("matches the hashes pinned in VENDOR.md", () => {
    const vendor = read("vendor/tc-mobile/VENDOR.md").toString("utf8");
    const rows = [
      ...vendor.matchAll(/^\| `([^`]+)` \| `[^`]+` \| `([0-9a-f]{64})` \|$/gm),
    ];
    expect(rows.map((r) => r[1])).toEqual(["template.ts", "validate.ts"]);
    for (const [, file, sha] of rows) {
      const actual = createHash("sha256")
        .update(read(`vendor/tc-mobile/${file}`))
        .digest("hex");
      expect(actual, file).toBe(sha);
    }
  });

  it.each([
    "bible-book-min.json",
    "collection-min.json",
    "hymnal-min.json",
    "pair-v0.1.0.json",
    "pair-v0.2.0.json",
  ])("accepts tc-mobile's fixture %s", (file) => {
    expect(() =>
      parseTemplatePackage(json(`tests/fixtures/tc-mobile/${file}`))
    ).not.toThrow();
  });

  it("accepts a title table only against its own package version", () => {
    const v1 = parseTemplatePackage(
      json("tests/fixtures/tc-mobile/pair-v0.1.0.json")
    );
    const v2 = parseTemplatePackage(
      json("tests/fixtures/tc-mobile/pair-v0.2.0.json")
    );
    const table = json("tests/fixtures/tc-mobile/titles-pair-v0.1.0.en.json");
    expect(() => parseTemplateTitleTable(table, v1)).not.toThrow();
    expect(() => parseTemplateTitleTable(table, v2)).toThrow(
      TemplateValidationError
    );
  });
});
