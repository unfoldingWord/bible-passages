import { describe, expect, it } from "vitest";
import {
  buildStructure,
  parseHeadings,
  parseVrs,
  pericopeTitles,
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

  it("starts at the next verse when the heading ends the previous verse", () => {
    // A tree parser such as usfm-js files this heading under verse 2; the
    // pericope still starts at verse 3. A cross-reference line (\\r) and a
    // minor heading (\\s2) between them change nothing.
    const usfm =
      "\\c 1\n\\s1 One\n\\p\n\\v 1 a\n\\v 2 b,\n\\s1 Two\n\\r (Mark 1:1)\n\\s2 Minor\n\\p\n\\v 3 c";
    expect(parseHeadings(usfm)).toEqual([
      { chapter: 1, verse: 1, text: "One" },
      { chapter: 1, verse: 3, text: "Two" },
    ]);
  });

  it("applies the verse-1 rule per chapter, not only to the first", () => {
    const usfm =
      "\\c 1\n\\s1 A\n\\v 1 a\n\\c 2\n\\s1 B\n\\d Of David.\n\\q1 \\v 2 b\n\\s1 C\n\\v 3 c";
    expect(parseHeadings(usfm)).toEqual([
      { chapter: 1, verse: 1, text: "A" },
      { chapter: 2, verse: 1, text: "B" },
      { chapter: 2, verse: 3, text: "C" },
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

describe("pericopeTitles", () => {
  const pericopes = [
    { key: "TIT.P.1.1-4", start: [1, 1], end: [1, 4] },
    { key: "TIT.P.1.5-9", start: [1, 5], end: [1, 9] },
  ] satisfies Parameters<typeof pericopeTitles>[2];

  it("titles each pericope with the heading at its first verse", () => {
    const titles = pericopeTitles(
      "TIT",
      [
        { chapter: 1, verse: 1, text: "One" },
        { chapter: 1, verse: 5, text: "Two" },
      ],
      pericopes,
      "bsb-tit"
    );
    expect(titles).toEqual({
      "TIT.P.1.1-4": { text: "One", status: "unreviewed", source: "bsb-tit" },
      "TIT.P.1.5-9": { text: "Two", status: "unreviewed", source: "bsb-tit" },
    });
  });

  // buildStructure refuses two headings at one verse first, so the build
  // cannot reach this from today's sources; the message still names where
  // the first heading was (#218).
  it("names the first heading's verse when a pericope has two", () => {
    expect(() =>
      pericopeTitles(
        "TIT",
        [
          { chapter: 1, verse: 1, text: "One" },
          { chapter: 1, verse: 1, text: "Again" },
          { chapter: 1, verse: 5, text: "Two" },
        ],
        pericopes,
        "bsb-tit"
      )
    ).toThrow("TIT 1:1: two headings for TIT.P.1.1-4, the first at 1:1");
  });
});
