import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The metadata sizing scripts (docs/scoping/metadata/, #44) count BSB marker
// lines with one shared rule, written twice: line_markers in measure_a.py and
// lineMarkers in measure_b.mjs. The 66 pinned BSB files hold none of the edge
// cases the rule is written for, so the corpus run cannot catch a change to
// either helper. This runs both on a synthetic file of those edge cases and
// checks each against a count made by hand from the file. No network: each
// script stops after printing the counts for the one file it is given.
const repo = new URL("../", import.meta.url);
const path = (p: string): string => fileURLToPath(new URL(p, repo));
const fixture = path("tests/fixtures/metadata/line-markers.usfm");

// Hand count, line by line, in the fixture's own order:
//   \s1  "Heading one" (CRLF), "Heading two" (lone CR), "Heading three",
//        "Heading four", "\s1<TAB>Heading five", "\s1" at end of line: 6.
//        "\s1x" is not one.
//   \r   Ref 1 to Ref 7: 7. "\r-" and "\r<NO-BREAK SPACE>" are not.
//   \r after \s1   Ref 1 (CRLF), Ref 2 (after a lone CR), Ref 3 (after a
//        space-and-tab line and "\b x", both skipped), Ref 7 (after a bare
//        "\s1"): 4. Ref 4 follows a no-break-space line, which is not blank;
//        Ref 5 follows "\s1x"; Ref 6 follows "\r-".
//   \d   "\d A title" (CRLF), "\d" at end of line before CRLF: 2.
//        "\d<NO-BREAK SPACE>" and "\dx" are not.
const HAND = { dMarkers: 2, rAfterS1: 4, rMarkers: 7, s1Markers: 6 };

describe("metadata sizing: shared marker-line rule", () => {
  it("the fixture holds every edge case the rule is written for", () => {
    // Guards against the file being normalised (git eol, an editor) into a
    // file that no longer tests the rule.
    const t = readFileSync(fixture, "utf8");
    expect(t).toContain("\r\n");
    expect(/\r(?!\n)/.test(t)).toBe(true); // a lone CR
    expect(t).toContain("\n \t\n"); // a line of a space and a tab
    expect(t).toContain("\n\\b x\n"); // \b with text after it
    expect(t).toContain("\n\u00a0\n"); // a line of one no-break space
    expect(t).toContain("\n\\s1x ");
    expect(t).toContain("\n\\r-");
    expect(t).toContain("\n\\s1\t");
    expect(t).toContain("\n\\r\u00a0");
    expect(t).toContain("\n\\d\u00a0");
  });

  it("measure_a.py line_markers gives the hand count", () => {
    const out = execFileSync(
      "python3",
      [
        "-I",
        path("docs/scoping/metadata/measure_a.py"),
        "--line-markers",
        fixture,
      ],
      { encoding: "utf8" }
    );
    expect(JSON.parse(out)).toEqual(HAND);
  });

  it("measure_b.mjs lineMarkers gives the hand count", () => {
    const out = execFileSync(
      process.execPath,
      [path("docs/scoping/metadata/measure_b.mjs"), "--line-markers", fixture],
      { encoding: "utf8" }
    );
    expect(JSON.parse(out)).toEqual(HAND);
  });
});
