import { describe, expect, it } from "vitest";
import { compareForm, verseTexts } from "../scripts/lib/cuv.ts";
import { readSource } from "../scripts/lib/sources.ts";

// The plain verse body the zh-Hans `cuv` gate compares names against
// (docs/scoping/zh-names-check.md, "Build", items 3 and 8).
describe("verseTexts", () => {
  it("reads every verse of the pinned Titus, by chapter, to the end of the file", async () => {
    const tit = verseTexts(await readSource("zh-cuv-tit"));
    // Titus has 16, 15 and 15 verses (ufw.vrs).
    expect(tit.size).toBe(46);
    expect(tit.get("1:5")).toContain("克里特");
    expect(tit.get("1:12")).toContain("克里特人");
    // The book's last verse ends at the end of the file, and 3:15 is not
    // the 15th verse of an earlier chapter.
    expect(tit.get("3:15")).toBe(
      "同我在一处的人都问你安。请代问那些因有信心爱我们的人安。愿恩惠常与你们众人同在！"
    );
    expect(tit.get("1:15")).toMatch(/^在洁净的人/);
    expect(tit.get("2:15")).toMatch(/^这些事你要讲明/);
    // Footnotes (2:13, 3:3, …) and the heading 问候 are not verse text.
    for (const text of tit.values()) {
      expect(text).not.toContain("或译");
      expect(text).not.toContain("问候");
    }
    expect(tit.get("2:13")).toBe(
      "等候所盼望的福，并等候至大的神和我们救主耶稣基督的荣耀显现。"
    );
  });

  it("keeps character styles' text, drops attributes, notes and headings", () => {
    const usfm = [
      "\\id XYZ test",
      "\\h 书",
      "\\c 1",
      "\\s1 标题里的克里特",
      "\\p",
      '\\v 1 \\w 保罗|lemma="x" strong="G3972"\\w*与\\nd 主\\nd*，\\+add 在\\+add*',
      "\\x - \\xo 1:1 \\xt 提多\\x*\\fe + \\fr 1:1 \\ft 亚波罗\\fe*",
      '\\fig 克里特|src="x.jpg"\\fig*\\va 2\\va*',
      "\\v 2-3 　凯撒利亚•腓立比",
      "\\v 4 甲|乙\\pn 丙\\pn*",
      "\\c 2",
      "\\v 1 第二章",
    ].join("\n");
    const v = verseTexts(usfm);
    expect([...v]).toEqual([
      ["1:1", "保罗与主，在"],
      ["1:2", "凯撒利亚·腓立比"],
      ["1:3", "凯撒利亚·腓立比"],
      // A | in the text is not an attribute.
      ["1:4", "甲|乙丙"],
      ["2:1", "第二章"],
    ]);
  });

  it("refuses a verse before any chapter, and a verse twice", () => {
    expect(() => verseTexts("\\v 1 x")).toThrow("\\v 1 comes before any \\c");
    expect(() => verseTexts("\\c 1\n\\v 1 x\n\\v 1 y")).toThrow(
      "verse 1:1 appears twice"
    );
  });
});

describe("compareForm", () => {
  it("removes whitespace, the ideographic space included, and reads • as ·", () => {
    expect(compareForm(" 神　的 \n仆人 ")).toBe("神的仆人");
    expect(compareForm("凯撒利亚•腓立比")).toBe("凯撒利亚·腓立比");
  });
});
