import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Every input the build reads is pinned here. See docs/schema.md, "sources.json".
type Source = {
  id: string;
  url: string;
  revision: string;
  sha256: string;
  licence: string;
  attribution: string;
};

const { sources } = JSON.parse(
  readFileSync(new URL("../sources.json", import.meta.url), "utf8")
) as { sources: Source[] };

describe("sources.json", () => {
  it("is a list", () => {
    expect(Array.isArray(sources)).toBe(true);
  });

  it("has unique ids", () => {
    const ids = sources.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(sources.map((s) => [s.id, s] as const))("%s is pinned", (_id, s) => {
    expect(s.id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
    expect(new URL(s.url).protocol).toMatch(/^https:$/);
    expect(s.revision.trim()).not.toBe("");
    expect(s.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(s.licence.trim()).not.toBe("");
    expect(s.attribution.trim()).not.toBe("");
  });
});
