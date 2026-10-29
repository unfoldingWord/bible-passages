import { describe, expect, it } from "vitest";
import {
  buildStructure,
  parseHeadings,
  parseVrs,
} from "../scripts/lib/structure.ts";

// The rules in docs/scoping/pipeline.md, each on the smallest input that
// shows it.
describe("parseHeadings", () => {
  it("starts a pericope at the next verse marker", () => {
    const usfm =
      "\\c 1\n\\s1 One\n\\p\n\\v 1 a\n\\v 2 b\n\\s1 Two\n\\p\n\\v 3 c";
    expect(parseHeadings(usfm)).toEqual([
      { chapter: 1, verse: 1, text: "One" },
      { chapter: 1, verse: 3, text: "Two" },
    ]);
  });

  it("finds a verse marker that is not at the start of a line", () => {
    const usfm = "\\c 1\n\\s1 One\n\\q1  \\v 1 a";
    expect(parseHeadings(usfm)[0]?.verse).toBe(1);
  });

  it("starts at verse 1 when the chapter has a superscription and no \\v 1", () => {
    const usfm = "\\c 3\n\\s1 A Psalm\n\\d Of David.\n\\q1 \\v 2 Lord";
    expect(parseHeadings(usfm)).toEqual([
      { chapter: 3, verse: 1, text: "A Psalm" },
    ]);
  });

  it("refuses a heading with no verse after it", () => {
    expect(() =>
      parseHeadings("\\c 1\n\\v 1 a\n\\s1 Lost\n\\c 2\n\\v 1 b")
    ).toThrow(/no verse/);
  });
});

describe("parseVrs", () => {
  it("reads the last verse of each chapter and skips mappings", () => {
    expect(parseVrs("# c\nTIT 1:16 2:15 3:15\nPSA 51:0 = PSA 51:1\n")).toEqual({
      TIT: [16, 15, 15],
    });
  });
});

describe("buildStructure", () => {
  const headings = [
    { chapter: 1, verse: 1, text: "A" },
    { chapter: 1, verse: 5, text: "B" },
  ];

  it("splits a chunk where a pericope starts inside it", () => {
    const s = buildStructure("TIT", [6], headings, [[1, 4]]);
    expect(s.segments.map((x) => [x.key, x.pericope])).toEqual([
      ["TIT.1.1-3", "TIT.P.1.1-4"],
      ["TIT.1.4-4", "TIT.P.1.1-4"],
      ["TIT.1.5-6", "TIT.P.1.5-6"],
    ]);
  });

  it("refuses a chapter with no heading at verse 1", () => {
    expect(() => buildStructure("TIT", [6, 4], headings, [[1], [1]])).toThrow(
      /cross the chapter/
    );
  });

  it("refuses a start past the end of the chapter", () => {
    expect(() => buildStructure("TIT", [6], headings, [[1, 9]])).toThrow(
      /past the last verse/
    );
  });
});
