import { describe, expect, it } from "vitest";
import { titleTable } from "../scripts/lib/title-table.ts";

// Titus has no unreviewed or missing segment title, so the filter is driven
// here with titles the real data lacks.
const pkg = { id: "bible-passages:TIT", version: "0.0.0" };
const keys = ["TIT.1.1-3", "TIT.1.4-4", "TIT.1.5-5", "TIT.1.6-7"];
const t = (text: string, status: string) => ({ text, status });

describe("titleTable", () => {
  it("ships ai-checked and above, in package order, and leaves out the rest", () => {
    const table = titleTable(
      pkg,
      "en",
      keys,
      {
        "TIT.P.1.1-4": t("Pericope", "human-reviewed"),
        "TIT.1.6-7": t("Approved", "approved"),
        "TIT.1.4-4": t("Unreviewed", "unreviewed"),
        "TIT.1.1-3": t("Checked", "ai-checked"),
        "TIT.1.5-5": t("Reviewed", "human-reviewed"),
      },
      "x"
    );
    expect(table).toEqual({
      packageId: "bible-passages:TIT",
      version: "0.0.0",
      language: "en",
      chapters: {},
      segments: {
        "TIT.1.1-3": "Checked",
        "TIT.1.5-5": "Reviewed",
        "TIT.1.6-7": "Approved",
      },
    });
    expect(Object.keys(table!.segments)).toEqual([
      "TIT.1.1-3",
      "TIT.1.5-5",
      "TIT.1.6-7",
    ]);
  });

  it("returns null when nothing is shippable", () => {
    expect(titleTable(pkg, "en", keys, {}, "x")).toBeNull();
    expect(
      titleTable(pkg, "en", keys, { "TIT.1.1-3": t("A", "unreviewed") }, "x")
    ).toBeNull();
  });

  it("refuses an unknown status and an empty or padded title", () => {
    expect(() =>
      titleTable(pkg, "en", keys, { "TIT.1.1-3": t("A", "draft") }, "f.json")
    ).toThrow('f.json: TIT.1.1-3 has unknown status "draft"');
    for (const text of ["", "  ", " A", "A\n"]) {
      expect(() =>
        titleTable(pkg, "en", keys, { "TIT.1.1-3": t(text, "ai-checked") }, "f")
      ).toThrow("f: TIT.1.1-3 is empty or whitespace-padded");
    }
  });
});
