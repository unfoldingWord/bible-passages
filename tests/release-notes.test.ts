import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STRUCTURE_BOOKS } from "../scripts/lib/books.ts";
import type { DisputedRecord } from "../scripts/lib/dispute-titles.ts";
import {
  addCounts,
  countBook,
  distProblems,
  emptyCounts,
  knownIssueProblems,
  renderNotes,
  scopeLines,
  shipped,
  shippedSegments,
  SHIPPED_FLOOR,
  tableProblems,
} from "../scripts/lib/release-notes.ts";
import { BLANK_TITLE } from "../scripts/lib/segment-titles.ts";
import type { Structure } from "../scripts/lib/structure.ts";
import { SHIPPED_STATUSES } from "../scripts/lib/title-table.ts";

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
    books: 1,
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

  it("says what the release holds and what follows", () => {
    expect(notes).toContain(
      "\n## In this release\n\n- Structure: pericopes and segments for all 1 books.\n- Titles: English (en), French (fr).\n"
    );
    expect(lines).toContain(
      "- Titles in Arabic (ar), Latin American Spanish (es-419), Hindi (hi), Indonesian (id), Brazilian Portuguese (pt-BR), Russian (ru), Swahili (sw), Simplified Chinese (zh-Hans) follow in v0.1.x, as each passes its checks (docs/decisions/0006)."
    );
    expect(lines).toContain(
      "- Metadata (key terms, figures of speech) is not in this release. It follows in v0.1.x (docs/decisions/0009)."
    );
  });

  it("lists the known issues with the title as built", () => {
    expect(notes).toContain(
      "- s1 (en, `ai-checked`): “One”. Wrong \\| scope. (#232)\n- Not about a title. (#9)\n"
    );
    const empty = renderNotes({
      tag: "v0.0.1",
      books: 0,
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

describe("scopeLines", () => {
  const metadata =
    "- Metadata (key terms, figures of speech) is not in this release. It follows in v0.1.x (docs/decisions/0009).";
  const nine = [
    "Arabic (ar)",
    "Latin American Spanish (es-419)",
    "French (fr)",
    "Hindi (hi)",
    "Indonesian (id)",
    "Brazilian Portuguese (pt-BR)",
    "Russian (ru)",
    "Swahili (sw)",
    "Simplified Chinese (zh-Hans)",
  ];
  const follow = (names: string[]) =>
    `- Titles in ${names.join(", ")} follow in v0.1.x, as each passes its checks (docs/decisions/0006).`;

  it("says English only when only English ships, even with other titles in data/", () => {
    expect(
      scopeLines(66, [
        ["en", [["TIT", 9]]],
        ["fr", []],
      ])
    ).toEqual([
      "- Structure: pericopes and segments for all 66 books.",
      "- Titles: English (en) only.",
      follow(nine),
      metadata,
    ]);
  });

  it("names every language that ships and drops it from those that follow", () => {
    expect(
      scopeLines(66, [
        ["en", [["TIT", 9]]],
        ["fr", [["TIT", 2]]],
        ["xx", [["TIT", 1]]],
      ])
    ).toEqual([
      "- Structure: pericopes and segments for all 66 books.",
      "- Titles: English (en), French (fr), xx.",
      follow(nine.filter((n) => n !== "French (fr)")),
      metadata,
    ]);
  });

  it("drops the follow line once every v0.1 language ships, and says none with no titles", () => {
    const all = [
      "en",
      "ar",
      "es-419",
      "fr",
      "hi",
      "id",
      "pt-BR",
      "ru",
      "sw",
      "zh-Hans",
    ];
    expect(
      scopeLines(
        66,
        all.map((l) => [l, [["TIT", 1]]])
      )
    ).toEqual([
      "- Structure: pericopes and segments for all 66 books.",
      `- Titles: English (en), ${nine.join(", ")}.`,
      metadata,
    ]);
    expect(scopeLines(0, [["en", []]])).toEqual([
      "- Structure: pericopes and segments for all 0 books.",
      "- Titles: none.",
      follow(nine),
      metadata,
    ]);
  });
});

describe("distProblems", () => {
  const file = (path: string) => ({ path, kind: "file" as const });
  const dir = (path: string) => ({ path, kind: "directory" as const });
  const say = (path: string) =>
    `dist/${path}: the notes say dist/ holds only tc-mobile/ packages and title tables; update scopeLines in scripts/lib/release-notes.ts`;
  const layout = [
    dir("tc-mobile"),
    file("tc-mobile/.gitkeep"),
    file("tc-mobile/GEN.json"),
    file("tc-mobile/TIT.json"),
    dir("tc-mobile/titles"),
    dir("tc-mobile/titles/en"),
    file("tc-mobile/titles/en/TIT.json"),
    dir("tc-mobile/titles/pt-BR"),
    file("tc-mobile/titles/pt-BR/GEN.json"),
  ];

  it("passes the tc-mobile/ packages and title tables, and an empty dist/", () => {
    expect(distProblems(layout)).toEqual([]);
    expect(distProblems([])).toEqual([]);
  });

  it("names a top-level entry other than tc-mobile/ once, not its contents", () => {
    expect(
      distProblems([
        ...layout,
        dir("metadata"),
        file("metadata/TIT.json"),
        dir("metadata/en"),
        file("metadata/en/TIT.json"),
        file("README.md"),
        file("tc-mobile"),
      ])
    ).toEqual([say("README.md"), say("metadata/"), say("tc-mobile")]);
  });

  it("names metadata nested under tc-mobile/, at any depth", () => {
    expect(
      distProblems([
        ...layout,
        dir("tc-mobile/metadata"),
        file("tc-mobile/metadata/TIT.json"),
        file("tc-mobile/key-terms.TIT.json"),
        file("tc-mobile/titles/en/TIT.metadata.json"),
        dir("tc-mobile/titles/en/metadata"),
        file("tc-mobile/titles/en/metadata/TIT.json"),
        file("tc-mobile/titles/key-terms.json"),
        dir("tc-mobile/titles/en/GEN.json"),
        file("tc-mobile/titles/EN/TIT.json"),
      ])
    ).toEqual([
      say("tc-mobile/key-terms.TIT.json"),
      say("tc-mobile/metadata/"),
      say("tc-mobile/titles/EN/TIT.json"),
      say("tc-mobile/titles/en/GEN.json/"),
      say("tc-mobile/titles/en/TIT.metadata.json"),
      say("tc-mobile/titles/en/metadata/"),
      say("tc-mobile/titles/key-terms.json"),
    ]);
  });

  it("names a book code that is not one, a symlink and a stray dotfile", () => {
    expect(
      distProblems([
        ...layout,
        file("tc-mobile/XYZ.json"),
        { path: "tc-mobile/MAT.json", kind: "other" },
        file(".DS_Store"),
        file("tc-mobile/titles/.DS_Store"),
        file("tc-mobile/titles/en/.gitkeep"),
      ])
    ).toEqual([
      say(".DS_Store"),
      say("tc-mobile/MAT.json"),
      say("tc-mobile/XYZ.json"),
      say("tc-mobile/titles/.DS_Store"),
      say("tc-mobile/titles/en/.gitkeep"),
    ]);
  });
});

// The committed data: the notes generate, add up, agree with the title
// tables (the CLI stops if not) and list known-issues.json.
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

  // v0.1.0 is English only (ADR 0006) and has no metadata (ADR 0009). The
  // languages are re-derived here from the title tables in dist/, not from
  // the notes; when a second language ships, this test changes with it.
  it("says English only and that metadata follows in v0.1.x", () => {
    // Sorted, so the expected list does not depend on directory order; only
    // *.json files are read, and one that does not parse or has no
    // segments object counts as no titles (the CLI reports such a file:
    // see "prints the notes").
    const hasTitles = (file: string): boolean => {
      try {
        const segments = (
          JSON.parse(readFileSync(file, "utf8")) as { segments?: unknown }
        )?.segments;
        return (
          typeof segments === "object" &&
          segments !== null &&
          Object.keys(segments).length > 0
        );
      } catch {
        return false;
      }
    };
    const shipping = readdirSync("dist/tc-mobile/titles", {
      withFileTypes: true,
    })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((l) =>
        readdirSync(`dist/tc-mobile/titles/${l}`, { withFileTypes: true })
          .filter((f) => f.isFile() && f.name.endsWith(".json"))
          .some((f) => hasTitles(`dist/tc-mobile/titles/${l}/${f.name}`))
      )
      .sort();
    expect(shipping).toEqual(["en"]);
    expect(readdirSync("dist")).toEqual(["tc-mobile"]);
    const lines = run.stdout.split("\n");
    expect(lines).toContain(
      `- Structure: pericopes and segments for all ${STRUCTURE_BOOKS.length} books.`
    );
    expect(lines).toContain("- Titles: English (en) only.");
    expect(lines).toContain(
      "- Metadata (key terms, figures of speech) is not in this release. It follows in v0.1.x (docs/decisions/0009)."
    );
  });

  // How a known issue is rendered is tested above with fixtures; here, the
  // committed known-issues.json reaches the notes whole, or "None listed."
  it("lists every entry of known-issues.json, or says none", () => {
    const issues = (
      JSON.parse(readFileSync("known-issues.json", "utf8")) as {
        issues: { issue: number; text: string }[];
      }
    ).issues;
    const section = run.stdout.slice(run.stdout.indexOf("\n## Known issues\n"));
    if (issues.length === 0) expect(section).toContain("\n\nNone listed.\n");
    for (const i of issues)
      expect(section).toContain(` ${i.text} (#${i.issue})\n`);
  });
});
