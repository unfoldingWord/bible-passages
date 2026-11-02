import { describe, expect, it } from "vitest";
import { codePoint } from "../scripts/lib/format.ts";
import { LINE_BREAK, LINE_BREAKS } from "../scripts/lib/line-breaks.ts";

describe("LINE_BREAK", () => {
  // The one list every line-break gate shares (#183): pinned here, so a
  // change to it is seen by its own test, not only through one gate.
  it("matches exactly the seven mandatory breaks", () => {
    const members: string[] = [];
    for (let cp = 0; cp <= 0x10ffff; cp++) {
      const c = String.fromCodePoint(cp);
      if (LINE_BREAK.test(c)) members.push(codePoint(c));
    }
    expect(members).toEqual([
      "U+000A",
      "U+000B",
      "U+000C",
      "U+000D",
      "U+0085",
      "U+2028",
      "U+2029",
    ]);
  });

  // Tab separates words and is not a line break. ICU does not break at
  // U+001C..U+001E (#179); the key-term gate refuses them as `format`.
  it("does not match tab or U+001C..U+001E", () => {
    for (const c of ["\t", "\u{1C}", "\u{1D}", "\u{1E}"])
      expect(LINE_BREAK.test(c), codePoint(c)).toBe(false);
  });

  it("builds a wider class from its body", () => {
    const withTab = new RegExp(`[${LINE_BREAKS}\\t]`, "u");
    expect(withTab.test("\t")).toBe(true);
    expect(withTab.test("\r")).toBe(true);
  });
});
