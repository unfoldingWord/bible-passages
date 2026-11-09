import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STRUCTURE_BOOKS } from "../scripts/lib/books.ts";
import type { DisputedRecord } from "../scripts/lib/dispute-titles.ts";
import {
  addCounts,
  countBook,
  emptyCounts,
  knownIssueProblems,
  renderNotes,
  shipped,
  shippedSegments,
  SHIPPED_FLOOR,
  tableProblems,
} from "../scripts/lib/release-notes.ts";
import { BLANK_TITLE } from "../scripts/lib/segment-titles.ts";
import type { Structure } from "../scripts/lib/structure.ts";
import {
  SHIPPED_STATUSES,
  type TitleEntries,
} from "../scripts/lib/title-table.ts";

// A Matthew-shaped structure, so MAT.17.21-21 is one of BLANK_SEGMENTS:
// pericope A has segments 1-6, pericope B only segment 7 (decision 12's
// reuse), and C the blank segment.
const span = (key: string, pericope?: string) => ({
  key,
  start: [17, 1] as [number, number],
  end: [17, 1] as [number, number],
  ...(pericope ? { pericope } : {}),
});
const structure = {
  book: "MAT",
  versification: "ufw",
  pericopes: [span("A"), span("B"), span("C"), span("D")],
  segments: [
    span("s1", "A"),
    span("s2", "A"),
    span("s3", "A"),
    span("s4", "A"),
    span("s5", "A"),
    span("s6", "A"),
    span("s7", "B"),
    span("MAT.17.21-21", "C"),
  ],
} as Structure;

const t = (text: string, status: string, source = "ai:x/y") => ({
  text,
  status,
  source,
});
const heading = t("Heading", "unreviewed", "bsb-mat");
// As the build writes them: s1 and s2 drafted and checked, s3 held by the
// checker, s4 by a third model, s5 by a person, s6 not drafted, s7 reusing
// B's heading; D has no title.
const titles = {
  A: heading,
  B: heading,
  C: heading,
  s1: t("One", "ai-checked"),
  s2: t("Two", "human-reviewed", "reviewer:r"),
  s3: t("Three", "unreviewed"),
  s4: t("Four, settled", "unreviewed", "ai:third/model"),
  s5: t("Five", "unreviewed"),
  s7: heading,
  "MAT.17.21-21": { ...BLANK_TITLE },
};
const drafts = {
  titles: {
    s1: t("One", "ai-checked"),
    s2: {
      ...t("Two draft", "ai-checked"),
      review: { by: "reviewer:r", status: "human-reviewed", text: "Two" },
    },
    s3: t("Three", "unreviewed"),
    s4: {
      ...t("Four", "unreviewed"),
      dispute: {
        by: "ai:third/model",
        kind: "factual",
        text: "Four, settled",
        status: "unreviewed",
      },
    },
    s5: {
      ...t("Five", "ai-checked"),
      review: { by: "reviewer:r", status: "unreviewed" },
    },
  },
} as unknown as DisputedRecord;

describe("countBook", () => {
  it("counts segment and pericope titles by status, and why each is held or missing", () => {
    const c = countBook("en", structure, titles, drafts);
    expect(c).toEqual({
      segments: 8,
      status: {
        unreviewed: 4,
        "ai-checked": 1,
        "human-reviewed": 1,
        approved: 1,
      },
      blank: 1,
      held: { dispute: 1, check: 1, review: 1, reused: 1 },
      notDrafted: 1,
      pericopes: 4,
      pericopeStatus: {
        unreviewed: 3,
        "ai-checked": 0,
        "human-reviewed": 0,
        approved: 0,
      },
      untitledPericopes: 1,
    });
    expect(shipped(c)).toBe(3);
    // Every segment is accounted for once: shipped, held or untitled.
    const held = Object.values(c.held).reduce((a, b) => a + b, 0);
    expect(shipped(c) + held + c.notDrafted).toBe(c.segments);
  });

  it("refuses an unknown status, naming the key", () => {
    expect(() =>
      countBook("en", structure, { ...titles, s1: t("One", "draft") }, drafts)
    ).toThrow('s1: unknown status "draft"');
    expect(() =>
      countBook("en", structure, { ...titles, A: t("A", "checked") }, drafts)
    ).toThrow('A: unknown status "checked"');
  });

  it("refuses a blank segment without the fixed title", () => {
    const { "MAT.17.21-21": _, ...without } = titles;
    expect(() => countBook("en", structure, without, drafts)).toThrow(
      "MAT.17.21-21: blank in BSB but not the fixed title"
    );
    expect(() =>
      countBook(
        "en",
        structure,
        { ...titles, "MAT.17.21-21": { ...BLANK_TITLE, status: "ai-checked" } },
        drafts
      )
    ).toThrow("MAT.17.21-21: blank in BSB but not the fixed title");
  });

  it("refuses an unreviewed title it cannot account for", () => {
    // s6 has no draft and is not its pericope's only segment.
    expect(() =>
      countBook(
        "en",
        structure,
        { ...titles, s6: t("Six", "unreviewed") },
        drafts
      )
    ).toThrow(
      "s6: unreviewed title that is neither a draft's nor its pericope's"
    );
    // s7 reuses B's heading, but differs from it.
    expect(() =>
      countBook(
        "en",
        structure,
        { ...titles, s7: { ...heading, text: "Other" } },
        drafts
      )
    ).toThrow("s7: unreviewed title that is neither");
    // s3's built title is not its draft's.
    expect(() =>
      countBook(
        "en",
        structure,
        { ...titles, s3: t("Changed", "unreviewed") },
        drafts
      )
    ).toThrow("s3: title is not its draft's as built");
  });

  it("counts the blank segments' fixed title in English only", () => {
    // A second language with a title on the blank segment does not add to
    // `blank`, which the notes report as titled in English.
    const fr = countBook("fr", structure, {
      "MAT.17.21-21": t("Pas dans les plus anciens", "ai-checked"),
    });
    expect(fr.blank).toBe(0);
    expect(fr.status["ai-checked"]).toBe(1);
    expect(countBook("fr", structure, {}).blank).toBe(0);
  });

  it("counts a book with no titles as not drafted", () => {
    const c = countBook(
      "en",
      { ...structure, segments: structure.segments.slice(0, 7) },
      {}
    );
    expect(c.notDrafted).toBe(7);
    expect(c.untitledPericopes).toBe(4);
    expect(shipped(c)).toBe(0);
  });
});

describe("addCounts", () => {
  it("adds field by field", () => {
    const c = countBook("en", structure, titles, drafts);
    const sum = addCounts(addCounts(emptyCounts(), c), c);
    expect(sum.segments).toBe(16);
    expect(sum.status["ai-checked"]).toBe(2);
    expect(sum.held).toEqual({ dispute: 2, check: 2, review: 2, reused: 2 });
    expect(sum.pericopeStatus.unreviewed).toBe(6);
    expect(sum.blank).toBe(2);
  });
});

describe("SHIPPED_FLOOR", () => {
  it("is the lowest shipped status", () => {
    expect(SHIPPED_FLOOR).toBe(SHIPPED_STATUSES[0]);
    expect(SHIPPED_FLOOR).toBe("ai-checked");
  });
});

describe("shippedSegments and tableProblems", () => {
  const expected = shippedSegments(structure, titles);

  it("lists the segment titles at the floor or above, key to text", () => {
    expect(expected).toEqual({
      s1: "One",
      s2: "Two",
      "MAT.17.21-21": BLANK_TITLE.text,
    });
    expect(Object.keys(expected)).toHaveLength(
      shipped(countBook("en", structure, titles, drafts))
    );
  });

  it("accepts a table that ships exactly those", () => {
    expect(tableProblems("t.json", expected, { ...expected })).toEqual([]);
  });

  it("refuses a swapped pair though the counts agree", () => {
    // s2 shipped in place of s3: same count, different keys.
    const { s2: _, ...rest } = expected;
    expect(tableProblems("t.json", expected, { ...rest, s3: "Two" })).toEqual([
      `t.json: s2 is at ${SHIPPED_FLOOR} or above in data/ but not in the table`,
      `t.json: s3 is in the table but not at ${SHIPPED_FLOOR} or above in data/`,
    ]);
  });

  it("refuses segments that are not an object of strings", () => {
    for (const v of [undefined, null, [], "x", { s1: 1 }])
      expect(tableProblems("t.json", expected, v)).toEqual([
        "t.json: segments is not an object of strings",
      ]);
  });

  it("refuses a text that differs from data/", () => {
    expect(
      tableProblems("t.json", expected, { ...expected, s1: "Two", s2: "One" })
    ).toEqual([
      "t.json: s1 differs from its title in data/",
      "t.json: s2 differs from its title in data/",
    ]);
  });
});

describe("knownIssueProblems", () => {
  const title = (language: string, key: string) =>
    language === "en" && key === "GEN.9.11-13" ? { text: "x" } : undefined;
  const ok = { issue: 232, key: "GEN.9.11-13", language: "en", text: "Why." };

  it("accepts entries with and without a title", () => {
    expect(
      knownIssueProblems({ issues: [ok, { issue: 1, text: "A." }] }, title)
    ).toEqual([]);
    expect(knownIssueProblems({ issues: [] }, title)).toEqual([]);
  });

  it("refuses a file not shaped { issues: [...] }", () => {
    for (const v of [null, [], {}, { issues: {} }, { issues: [], x: 1 }])
      expect(knownIssueProblems(v, title)).toEqual([
        'known-issues.json: not { "issues": [...] }',
      ]);
  });

  it("names every problem of every entry", () => {
    expect(
      knownIssueProblems(
        {
          issues: [
            "x",
            { ...ok, issue: 0, extra: true },
            { ...ok, issue: 1.5, text: " padded" },
            { issue: 2, text: "two\nlines", key: "GEN.9.11-13" },
            { ...ok, key: "GEN.1.1-1" },
            { ...ok, language: "fr" },
            { ...ok, key: 3 },
            { issue: "232", text: "" },
          ],
        },
        title
      )
    ).toEqual([
      "known-issues.json issues[0]: not an object",
      'known-issues.json issues[1]: unknown field "extra"',
      "known-issues.json issues[1]: issue is not a positive whole number",
      "known-issues.json issues[2]: issue is not a positive whole number",
      "known-issues.json issues[2]: text is not one trimmed, non-empty line",
      "known-issues.json issues[3]: text is not one trimmed, non-empty line",
      "known-issues.json issues[3]: key and language go together",
      "known-issues.json issues[4]: en has no title for GEN.1.1-1",
      "known-issues.json issues[5]: fr has no title for GEN.9.11-13",
      "known-issues.json issues[6]: key and language are not strings",
      "known-issues.json issues[7]: issue is not a positive whole number",
      "known-issues.json issues[7]: text is not one trimmed, non-empty line",
    ]);
  });
});

describe("renderNotes", () => {
  const c = countBook("en", structure, titles, drafts);
  const notes = renderNotes({
    tag: "v1.2.3",
    languages: [
      ["en", c],
      // fr titles the blank segment: not counted as titled in English.
      [
        "fr",
        countBook("fr", structure, {
          "MAT.17.21-21": t("Pas dans les plus anciens", "ai-checked"),
        }),
      ],
    ],
    shippedBooks: [
      ["en", [["MAT", 3]]],
      ["fr", [["MAT", 1]]],
    ],
    issues: [
      { issue: 232, key: "s1", language: "en", text: "Wrong | scope." },
      { issue: 9, text: "Not about a title." },
    ],
    title: (language, key) =>
      language === "en" && key === "s1" ? titles.s1 : undefined,
  });
  const lines = notes.split("\n");

  it("counts per language and in total", () => {
    expect(lines).toContain("| | en | fr | Total |");
    expect(lines).toContain("| Segments | 8 | 8 | 16 |");
    expect(lines).toContain("| Titled | 7 | 1 | 8 |");
    expect(lines).toContain("| … `approved` | 1 | 0 | 1 |");
    expect(lines).toContain("| … `ai-checked` | 1 | 1 | 2 |");
    expect(lines).toContain("| … `unreviewed` | 4 | 0 | 4 |");
    expect(lines).toContain("| Shipped (`ai-checked` or above) | 3 | 1 | 4 |");
    expect(lines).toContain("| Not shipped | 5 | 7 | 12 |");
    expect(lines).toContain(
      "| … held: a third model's answer left it `unreviewed` | 1 | 0 | 1 |"
    );
    expect(lines).toContain("| … not drafted (no title) | 1 | 7 | 8 |");
    expect(lines).toContain("| Pericopes | 4 | 4 | 8 |");
    expect(lines).toContain("| No title | 1 | 4 | 5 |");
    expect(lines).toContain(
      'Segments BSB numbers but leaves blank (MAT.17.21-21, MRK.11.26-26, ROM.16.24-24), titled in English: 1. They are never drafted: in English each has one fixed title a person chose, "Not in the oldest manuscripts", counted above as `approved`.'
    );
    expect(lines).toContain("Books with segment titles shipped, en: MAT (3).");
    expect(lines).toContain("Books with segment titles shipped, fr: MAT (1).");
    expect(notes).toMatch(/^tc-mobile template packages v0 .* for v1\.2\.3,/);
  });

  it("lists the known issues with the title as built", () => {
    expect(notes).toContain(
      "- s1 (en, `ai-checked`): “One”. Wrong \\| scope. (#232)\n- Not about a title. (#9)\n"
    );
    const empty = renderNotes({
      tag: "v0.0.1",
      languages: [],
      shippedBooks: [["en", []]],
      issues: [],
      title: () => undefined,
    });
    expect(empty).toContain("## Known issues\n\nNone listed.\n");
    expect(empty.split("\n")).toContain(
      "Books with segment titles shipped, en: none."
    );
  });
});

// The committed data: the notes generate, add up, agree with the title
// tables (the CLI stops if not) and list #232 until a person fixes it.
describe("scripts/release/notes.ts on the committed data", () => {
  const run = spawnSync(
    process.execPath,
    ["scripts/release/notes.ts", "v0.0.0"],
    { encoding: "utf8" }
  );

  it("prints the notes", () => {
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
  });

  it("counts every segment and pericope in data/structure/", () => {
    let segments = 0;
    let pericopes = 0;
    for (const book of STRUCTURE_BOOKS) {
      const s = JSON.parse(
        readFileSync(`data/structure/${book}.json`, "utf8")
      ) as Structure;
      segments += s.segments.length;
      pericopes += s.pericopes.length;
    }
    // Every language counts every segment; "Total" adds them.
    const languages = readdirSync("data/titles", { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    const row = (label: string, n: number) =>
      `\n| ${label} | ${[...languages.map(() => n), n * languages.length].join(" | ")} |\n`;
    expect(run.stdout).toContain(row("Segments", segments));
    expect(run.stdout).toContain(row("Pericopes", pericopes));
  });

  it("lists GEN.9.11-13 as a known issue (#232) with its built title and status", () => {
    const built = (
      JSON.parse(readFileSync("data/titles/en/GEN.json", "utf8")) as {
        titles: TitleEntries;
      }
    ).titles["GEN.9.11-13"]!;
    const issue = (
      JSON.parse(readFileSync("known-issues.json", "utf8")) as {
        issues: { issue: number; text: string }[];
      }
    ).issues.find((i) => i.issue === 232)!;
    expect(run.stdout).toContain(
      `\n- GEN.9.11-13 (en, \`${built.status}\`): “${built.text}”. ${issue.text} (#232)\n`
    );
  });
});
