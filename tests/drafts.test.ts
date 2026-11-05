import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BOOKS } from "../scripts/lib/books.ts";
import {
  builtTitle,
  disputeProblems,
  type Title as Settled,
} from "../scripts/lib/dispute-titles.ts";
import {
  batches,
  BLANK_SEGMENTS,
  BLANK_TITLE,
  CHECK_BATCH,
  CRITERIA,
  DRAFT_BATCH,
  gateProblems,
} from "../scripts/lib/segment-titles.ts";
import { sha256 } from "../scripts/lib/translate.ts";

type Title = { text: string; status: string; source: string };
type Draft = Title & {
  gates?: string[];
  check?: {
    by: string;
    verdict: "agree" | "disagree";
    criteria?: string[];
    suggestion?: string;
  };
  review?: {
    by: string;
    at: string;
    status: string;
    text?: string;
    why?: string;
    saved?: string;
  };
  dispute?: {
    by: string;
    kind: string;
    text: string;
    why: string;
    status: string;
    gates?: string[];
  };
};
type Record = {
  language: string;
  book: string;
  bible?: string;
  prompt?: { file: string; sha256: string };
  disputeCheck?: {
    prompt: { file: string; sha256: string };
    verses: string;
    voice: { file: string; sha256: string };
  };
  calls?: {
    role: string;
    id: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    cost: number | null;
  }[];
  titles: { [key: string]: Draft };
};
const read = (path: string) =>
  JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const MAX = 60;

// A record keeps the SHA-256 of the prompt file it was made with. When
// prompts/segment-titles.md changes, the earlier version is kept byte for
// byte as prompts/history/segment-titles-<first 12 hex of its SHA-256>.md, so
// every record traces to the text that produced it (#197). The path of the
// file whose bytes hash to `hash`, or undefined if none is kept. A hash that
// is not 64 hex digits matches nothing, so it never becomes part of a path.
const fileText = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const HISTORY = "prompts/history";
const history = (): string[] =>
  readdirSync(new URL(`../${HISTORY}/`, import.meta.url)).sort();
const keptPrompt = (hash: string): string | undefined => {
  if (!/^[0-9a-f]{64}$/.test(hash)) return undefined;
  if (sha256(fileText("prompts/segment-titles.md")) === hash)
    return "prompts/segment-titles.md";
  const name = `segment-titles-${hash.slice(0, 12)}.md`;
  if (!history().includes(name)) return undefined;
  const path = `${HISTORY}/${name}`;
  return sha256(fileText(path)) === hash ? path : undefined;
};

describe("prompts/history/", () => {
  it("names every kept prompt by its prompt and the first 12 hex digits of its own SHA-256", () => {
    const files = history();
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const m = /^(segment-titles|dispute-titles)-([0-9a-f]{12})\.md$/.exec(f);
      expect(m, f).not.toBeNull();
      expect(sha256(fileText(`${HISTORY}/${f}`)).slice(0, 12), f).toBe(m![2]);
    }
  });

  it.each(["segment-titles", "dispute-titles"])(
    "keeps no copy of the current %s prompt",
    (name) => {
      const current = sha256(fileText(`prompts/${name}.md`));
      expect(history()).not.toContain(`${name}-${current.slice(0, 12)}.md`);
    }
  );

  it("matches nothing for an unkept or malformed hash", () => {
    expect(keptPrompt(sha256("a prompt nobody kept"))).toBeUndefined();
    expect(keptPrompt("../../package.json")).toBeUndefined();
    expect(keptPrompt("")).toBeUndefined();
  });

  // The branch a record made with the live prompt takes (2TI took it until
  // #220 changed the prompt); earlier records take the history branch (#204).
  it("finds the current prompt by its own digest", () => {
    const current = sha256(fileText("prompts/segment-titles.md"));
    expect(keptPrompt(current)).toBe("prompts/segment-titles.md");
  });
});

// Rule 6's examples in the draft prompt are Titus titles as built, each with
// its length in brackets, counted in code points like Python len() (#204).
describe("the Titus examples in prompts/segment-titles.md", () => {
  const prompt = fileText("prompts/segment-titles.md");
  const start = prompt.indexOf("<!-- draft:start -->");
  const end = prompt.indexOf("<!-- draft:end -->");
  const draft = prompt.slice(start, end);
  const intro = draft.indexOf("These titles from Titus");
  const examples = [...draft.slice(intro).matchAll(/^- (.+) \((\d+)\)$/gm)].map(
    (m) => ({ text: m[1]!, count: Number(m[2]) })
  );

  // indexOf gives -1 for a missing marker, and slice reads -1 as "one from
  // the end", so each slice names its marker here rather than failing only
  // through the count of eight (#218).
  it("finds the markers it slices at", () => {
    expect(start, "<!-- draft:start -->").toBeGreaterThanOrEqual(0);
    expect(end, "<!-- draft:end -->").toBeGreaterThan(start);
    expect(intro, "These titles from Titus").toBeGreaterThanOrEqual(0);
  });

  // The examples themselves, frozen: a change to them is a prompt change,
  // made on purpose with this list (#218; the 1:15–16 example gave way to
  // 2:6–8 in #220).
  it("lists these eight examples", () => {
    expect(examples.map((e) => e.text)).toEqual([
      "Paul left Titus in Crete to appoint elders",
      "Elders must be blameless in family and character",
      "Titus must firmly correct false teachers",
      "Older women are to teach the younger women",
      "Titus instructs younger men",
      "Believers should obey rulers and be gentle to everyone",
      "God saved us because of his mercy, not our deeds",
      "Paul asks Titus to come and to help Zenas and Apollos",
    ]);
  });
  const built = new Set(
    Object.values(
      (
        read("data/titles/en/TIT.json") as {
          titles: { [key: string]: Title };
        }
      ).titles
    ).map((t) => t.text)
  );

  it("lists eight examples", () => {
    expect(examples).toHaveLength(8);
  });

  it("gives each example's true length and keeps it within the limit", () => {
    for (const e of examples) {
      expect([...e.text].length, e.text).toBe(e.count);
      expect(e.count, e.text).toBeLessThanOrEqual(MAX);
    }
  });

  it("uses only titles that are built for Titus", () => {
    for (const e of examples) expect(built.has(e.text), e.text).toBe(true);
  });
});

// English segment drafts (data/drafts/en/): Titus, drafted by an agent before
// the script (PR #16), and the books drafted by
// scripts/translate/segment-titles.ts, whose records carry their calls.
describe.each([
  "TIT",
  "PHP",
  "COL",
  "1TH",
  "2TI",
  "GEN",
  "ROM",
  "1CO",
  "2CO",
  "GAL",
  "EPH",
  "2TH",
  "1TI",
  "PHM",
])("English %s segment drafts", (book) => {
  const structure = read(`data/structure/${book}.json`) as {
    pericopes: { key: string }[];
    segments: { key: string; pericope: string }[];
  };
  const record = read(`data/drafts/en/${book}.json`) as Record;
  const drafts = record.titles;
  const built = (
    read(`data/titles/en/${book}.json`) as {
      titles: { [key: string]: Title };
    }
  ).titles;
  const perPericope = new Map<string, number>();
  for (const s of structure.segments)
    perPericope.set(s.pericope, (perPericope.get(s.pericope) ?? 0) + 1);
  const only = (s: { pericope: string }) => perPericope.get(s.pericope) === 1;
  // A segment BSB leaves blank is never drafted; it takes BLANK_TITLE (#226).
  const blank = BLANK_SEGMENTS.filter((k) => k.startsWith(`${book}.`));

  it("is a book whose titles are built", () => {
    expect(BOOKS).toContain(book);
    expect([record.language, record.book]).toEqual(["en", book]);
  });

  it("has a draft for every segment that shares its pericope, and none for an unknown key", () => {
    const keys = new Set(structure.segments.map((s) => s.key));
    for (const k of Object.keys(drafts)) expect(keys.has(k), k).toBe(true);
    for (const s of structure.segments)
      if (!only(s) && !blank.includes(s.key))
        expect(drafts[s.key], s.key).toBeDefined();
  });

  it("drafts no title for a segment BSB leaves blank, which the build gives BLANK_TITLE (#226)", () => {
    for (const k of blank) {
      expect(drafts[k], k).toBeUndefined();
      expect(built[k], k).toEqual(BLANK_TITLE);
    }
  });

  it("labels every draft as AI output, checked by a different model", () => {
    for (const d of Object.values(drafts)) {
      expect(d.source).toMatch(/^ai:/);
      expect(d.check?.by).toMatch(/^ai:/);
      expect(d.check?.by).not.toBe(d.source);
    }
  });

  it("is ai-checked only where the checker agreed and every gate passed; the rest wait for a person", () => {
    for (const d of Object.values(drafts)) {
      // No AI title goes above ai-checked until a person reviews it (AGENTS.md).
      expect(d.status).toBe(
        d.check?.verdict === "agree" && d.gates === undefined
          ? "ai-checked"
          : "unreviewed"
      );
      if (d.check?.verdict === "disagree") {
        expect(d.check.suggestion?.length).toBeGreaterThan(0);
        expect((d.check.suggestion ?? "").length).toBeLessThanOrEqual(MAX);
      }
    }
  });

  it("records every title the gates fail, and keeps the rest plain and non-empty", () => {
    for (const d of Object.values(drafts)) {
      expect(d.text.length).toBeGreaterThan(0);
      expect(d.text).toBe(d.text.trim());
      const problems = gateProblems(d.text);
      expect(d.gates ?? []).toEqual(problems);
      if (problems.length === 0) {
        expect(d.text.length).toBeLessThanOrEqual(MAX);
        expect(d.text).not.toMatch(/[.“”"]$|^["“]/);
      }
    }
  });

  it("records a person's review with who, when and a reviewed status", () => {
    for (const d of Object.values(drafts)) {
      if (!d.review) continue;
      expect(d.review.by).toMatch(/^reviewer:[A-Za-z0-9-]+$/);
      expect(d.review.at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(["human-reviewed", "approved"]).toContain(d.review.status);
      if (d.review.text !== undefined) {
        expect(d.review.text.length).toBeGreaterThan(0);
        expect(d.review.text.length).toBeLessThanOrEqual(MAX);
        expect(d.review.text).toBe(d.review.text.trim());
      }
      // A reviewer's reason and save time (scripts/review/apply.ts).
      if (d.review.saved !== undefined)
        expect(d.review.saved).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
      if (d.review.why !== undefined) {
        expect(d.review.why.length).toBeGreaterThan(0);
        expect(d.review.why).toBe(d.review.why.trim());
      }
    }
  });

  it("is merged into the built title table, a review deciding, else a third model's dispute", () => {
    for (const [key, d] of Object.entries(drafts)) {
      const r = d.review;
      const ai = d.dispute
        ? {
            text: d.dispute.text,
            status: d.dispute.status,
            source: d.dispute.by,
          }
        : { text: d.text, status: d.status, source: d.source };
      expect(built[key]).toEqual(
        r
          ? {
              text: r.text ?? ai.text,
              status: r.status,
              source: r.text ? r.by : ai.source,
            }
          : ai
      );
      // Re-derived above by hand; the build's own function must agree.
      expect(builtTitle(d as Settled)).toEqual(built[key]);
    }
  });

  it("settles only disputed titles, by a third family, never above ai-checked (ADR 0005 item 6)", () => {
    for (const [key, d] of Object.entries(drafts)) {
      expect(disputeProblems(d as Settled), key).toEqual([]);
      if (d.dispute) {
        expect(record.disputeCheck, key).toBeDefined();
        expect(["unreviewed", "ai-checked"]).toContain(d.dispute.status);
      }
    }
  });

  it("gives a pericope's only segment the pericope title when it has no draft (decision 12)", () => {
    for (const s of structure.segments)
      if (only(s) && !drafts[s.key])
        expect(built[s.key], s.key).toEqual(built[s.pericope]);
  });
});

// The books drafted by scripts/translate/segment-titles.ts. A record has one
// draft call per batch of at most DRAFT_BATCH segments (#208), then one check
// call per batch of at most CHECK_BATCH titles (#201); `drafts` and `checks`
// are what each committed record holds (`drafts` is 1 unless given).
describe.each([
  {
    book: "PHP",
    reused: ["PHP.1.1-2", "PHP.4.21-23"],
    drafted: 37,
    // Made before the prompt changed for #197 (docs/scoping/sizing.md).
    prompt: "prompts/history/segment-titles-f132f2195f80.md",
    checks: 1,
    // Checked in one call before the batched check (#201): 37 titles, where
    // the batching rule would give 2 calls (#215).
    batched: false,
  },
  {
    book: "COL",
    reused: ["COL.1.1-2", "COL.3.18-21", "COL.3.22-25"],
    drafted: 33,
    // Made before the prompt changed for #209 (docs/scoping/sizing.md).
    prompt: "prompts/history/segment-titles-cc76a816652a.md",
    checks: 1,
    batched: true,
  },
  {
    book: "1TH",
    reused: ["1TH.2.17-20"],
    drafted: 31,
    // Drafted for #207 before the readers rule of #216 merged.
    prompt: "prompts/history/segment-titles-cc76a816652a.md",
    checks: 1,
    batched: true,
  },
  {
    book: "2TI",
    reused: ["2TI.1.1-2", "2TI.4.19-22"],
    drafted: 30,
    // Drafted for #207 after #216's readers rule, before #220's follow-ups.
    prompt: "prompts/history/segment-titles-838516080c8f.md",
    checks: 1,
    batched: true,
  },
  {
    book: "GEN",
    reused: [
      "GEN.2.1-3",
      "GEN.3.14-15",
      "GEN.4.25-26",
      "GEN.8.20-22",
      "GEN.26.34-35",
      "GEN.30.22-24",
      "GEN.33.18-20",
      "GEN.35.16-20",
    ],
    drafted: 642,
    // The first long book, drafted in 19 batches for #208 with #216's
    // prompt, before #228 revised it.
    prompt: "prompts/history/segment-titles-838516080c8f.md",
    drafts: 19,
    checks: 19,
    batched: true,
  },
  {
    book: "ROM",
    reused: ["ROM.13.8-10"],
    drafted: 199,
    // Drafted for #244 (ADR 0008) with the prompt on main.
    prompt: "prompts/segment-titles.md",
    drafts: 6,
    checks: 6,
    batched: true,
  },
  {
    book: "1CO",
    reused: ["1CO.1.1-3", "1CO.9.24-27", "1CO.16.10-12"],
    drafted: 176,
    // Drafted for #244 (ADR 0008) with the prompt on main.
    prompt: "prompts/segment-titles.md",
    drafts: 6,
    checks: 6,
    batched: true,
  },
  {
    book: "2CO",
    reused: ["2CO.1.1-2"],
    drafted: 110,
    // Drafted for #244 (ADR 0008) with the prompt on main.
    prompt: "prompts/segment-titles.md",
    drafts: 4,
    checks: 4,
    batched: true,
  },
  {
    book: "GAL",
    reused: [],
    drafted: 62,
    // Drafted for #244 (ADR 0008) with the prompt on main.
    prompt: "prompts/segment-titles.md",
    drafts: 2,
    checks: 2,
    batched: true,
  },
  {
    book: "EPH",
    reused: ["EPH.1.1-2", "EPH.2.19-22"],
    drafted: 60,
    // Drafted for #244 (ADR 0008) with the prompt on main.
    prompt: "prompts/segment-titles.md",
    drafts: 2,
    checks: 2,
    batched: true,
  },
  {
    book: "2TH",
    reused: ["2TH.3.16-18"],
    drafted: 18,
    // Drafted for #244 (ADR 0008) with the prompt on main.
    prompt: "prompts/segment-titles.md",
    drafts: 1,
    checks: 1,
    batched: true,
  },
  {
    book: "1TI",
    reused: [
      "1TI.1.1-2",
      "1TI.5.1-2",
      "1TI.6.1-2",
      "1TI.6.3-5",
      "1TI.6.17-19",
      "1TI.6.20-21",
    ],
    drafted: 40,
    // Drafted for #244 (ADR 0008) with the prompt on main.
    prompt: "prompts/segment-titles.md",
    drafts: 2,
    checks: 2,
    batched: true,
  },
  {
    book: "PHM",
    reused: ["PHM.1.1-3", "PHM.1.4-7", "PHM.1.23-25"],
    drafted: 5,
    // Drafted for #244 (ADR 0008) with the prompt on main.
    prompt: "prompts/segment-titles.md",
    drafts: 1,
    checks: 1,
    batched: true,
  },
])("a scripted segment-title record ($book)", (t) => {
  const record = read(`data/drafts/en/${t.book}.json`) as Record;
  const structure = read(`data/structure/${t.book}.json`) as {
    segments: { key: string; pericope: string }[];
  };

  it("drafts no title for a pericope's only segment (decision 12)", () => {
    const count = new Map<string, number>();
    for (const s of structure.segments)
      count.set(s.pericope, (count.get(s.pericope) ?? 0) + 1);
    const reused = structure.segments.filter(
      (s) => count.get(s.pericope) === 1
    );
    expect(reused.map((s) => s.key)).toEqual(t.reused);
    for (const s of reused) expect(record.titles[s.key]).toBeUndefined();
    expect(Object.keys(record.titles)).toHaveLength(t.drafted);
    // A segment BSB leaves blank is neither drafted nor reused (#226).
    const blank = BLANK_SEGMENTS.filter((k) => k.startsWith(`${t.book}.`));
    for (const k of blank) expect(record.titles[k]).toBeUndefined();
    expect(t.drafted + t.reused.length + blank.length).toBe(
      structure.segments.length
    );
  });

  it("was made with a committed prompt and the pinned BSB text", () => {
    expect(record.prompt?.file).toBe("prompts/segment-titles.md");
    expect(keptPrompt(record.prompt?.sha256 ?? "")).toBe(t.prompt);
    expect(record.bible).toBe(`bsb-${t.book.toLowerCase()}`);
  });

  it("records its draft calls, then its check calls, by models of different families", () => {
    const calls = record.calls ?? [];
    const drafts = t.drafts ?? 1;
    expect(calls.map((c) => c.role)).toEqual([
      ...Array<string>(drafts).fill("draft"),
      ...Array<string>(t.checks).fill("check"),
    ]);
    // A record made with batched drafting (#213) has exactly the draft calls
    // its batching makes; PHP, drafted whole before it, one.
    expect(drafts).toBe(
      t.batched ? batches(Object.keys(record.titles), DRAFT_BATCH).length : 1
    );
    // A record made with the batched check (#201) has exactly the check
    // calls the runner's batching makes (#215); PHP, made before it, one.
    expect(t.checks).toBe(
      t.batched ? batches(Object.keys(record.titles), CHECK_BATCH).length : 1
    );
    // PHP's exception holds only while the batching rule would give it more
    // calls than its one: if CHECK_BATCH changed so that it gave 1, PHP
    // would no longer be an exception and the row must be rewritten (#223).
    if (!t.batched)
      expect(batches(Object.keys(record.titles), CHECK_BATCH)).toHaveLength(2);
    for (const c of calls) {
      expect(c.id).toMatch(/^gen-/);
      expect(c.promptTokens).toBeGreaterThan(0);
      expect(c.cost).toBeGreaterThan(0);
    }
    const family = (m: string) => m.split("/")[0];
    const draftCalls = calls.slice(0, drafts);
    const checks = calls.slice(drafts);
    const draft = draftCalls[0];
    for (const c of draftCalls) expect(c.model).toBe(draft!.model);
    for (const c of checks) {
      expect(c.model).toBe(checks[0]!.model);
      expect(family(draft!.model)).not.toBe(family(c.model));
    }
    for (const d of Object.values(record.titles)) {
      expect(d.source).toBe(`ai:${draft!.model}`);
      expect(d.check?.by).toBe(`ai:${checks[0]!.model}`);
      for (const c of d.check?.criteria ?? [])
        expect(CRITERIA).toContain(c as (typeof CRITERIA)[number]);
    }
  });
});
