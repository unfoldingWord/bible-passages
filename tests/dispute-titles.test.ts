import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  builtTitle,
  disputeInputs,
  disputeProblems,
  disputePrompt,
  listDisputes,
  readDisputes,
  settleDisputes,
  ultVerseTexts,
  voiceOf,
  type Complete,
  type DisputedRecord,
  type Title,
} from "../scripts/lib/dispute-titles.ts";
import type { Completion } from "../scripts/lib/openrouter.ts";
import type { SegmentInput } from "../scripts/lib/segment-titles.ts";
import { sha256 } from "../scripts/lib/translate.ts";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const DRAFTER = "anthropic/claude-sonnet-5.5";
const CHECKER = "google/gemini-3.8-flash";
const THIRD = "openai/gpt-6.1-sol";

const disputed = (text: string, suggestion: string): Title => ({
  text,
  source: `ai:${DRAFTER}`,
  status: "unreviewed",
  check: {
    by: `ai:${CHECKER}`,
    verdict: "disagree",
    criteria: ["plain"],
    why: "Unclear them.",
    suggestion,
  },
});

const agreed = (text: string): Title => ({
  text,
  source: `ai:${DRAFTER}`,
  status: "ai-checked",
  check: { by: `ai:${CHECKER}`, verdict: "agree" },
});

const call = (role: "draft" | "check", model: string) => ({
  role,
  id: `gen-${role}`,
  model,
  promptTokens: 1,
  completionTokens: 1,
  reasoningTokens: null,
  cost: 0.01,
  ms: 1,
});

const record = (): DisputedRecord => ({
  language: "en",
  book: "XYZ",
  bible: "bsb-xyz",
  prompt: { file: "prompts/segment-titles.md", sha256: "0" },
  calls: [call("draft", DRAFTER), call("check", CHECKER)],
  titles: {
    "XYZ.1.1-2": agreed("Paul greets the believers"),
    "XYZ.1.3-4": disputed(
      "Paul thanks God for them",
      "Paul thanks God for the believers"
    ),
    "XYZ.1.5-6": disputed(
      "Paul says they will be freed",
      "Paul hopes they are freed"
    ),
  },
});

const inputs: SegmentInput[] = ["1.1-2", "1.3-4", "1.5-6"].map((s) => ({
  key: `XYZ.${s}`,
  verses: s.replace(".", ":"),
  pericope: "Greeting",
  text: `ULT text of ${s}`,
}));

function fakeModel(reply: unknown, answeredBy?: string) {
  const sent: { model: string; system: string; user: string }[] = [];
  const complete: Complete = async (request) => {
    sent.push({
      model: request.model,
      system: request.messages[0]?.content ?? "",
      user: request.messages[1]?.content ?? "",
    });
    const c: Completion = {
      id: "gen-3",
      model: answeredBy ?? request.model,
      text: JSON.stringify(reply),
      usage: {
        promptTokens: 100,
        completionTokens: 10,
        reasoningTokens: 2,
        cost: 0.02,
      },
      ms: 5,
    };
    return c;
  };
  return { complete, sent };
}

const PROMPT = read("prompts/dispute-titles.md");
const settle = (
  complete: Complete,
  overrides: Partial<Parameters<typeof settleDisputes>[0]> = {}
) => {
  const ledgers: unknown[] = [];
  return {
    ledgers,
    run: settleDisputes({
      record: record(),
      inputs,
      verses: "ult-xyz",
      voice: {
        file: "data/drafts/en/TIT.json",
        text: "{}",
        titles: [{ key: "TIT.1.5-5", title: "Paul left Titus in Crete" }],
      },
      prompt: { file: "prompts/dispute-titles.md", text: PROMPT },
      model: THIRD,
      complete,
      write: async (l) => {
        ledgers.push(l);
      },
      ...overrides,
    }),
  };
};

describe("the third check (ADR 0005 item 6)", () => {
  it("sends only the disputed titles, with their ULT verses, the checker's objection and the Titus voice", async () => {
    const { complete, sent } = fakeModel({
      "XYZ.1.3-4": {
        kind: "taste",
        title: "Paul thanks God for the believers",
        why: "Names them.",
      },
      "XYZ.1.5-6": {
        kind: "factual",
        title: "Paul expects deliverance",
        why: "Freed picks one reading.",
      },
    });
    const { run } = settle(complete);
    await run;
    expect(sent).toHaveLength(1);
    expect(sent[0]!.model).toBe(THIRD);
    expect(sent[0]!.system).toBe(disputePrompt(PROMPT));
    const user = JSON.parse(sent[0]!.user);
    expect(user.voice).toEqual([
      { key: "TIT.1.5-5", title: "Paul left Titus in Crete" },
    ]);
    expect(user.segments.map((s: { key: string }) => s.key)).toEqual([
      "XYZ.1.3-4",
      "XYZ.1.5-6",
    ]);
    expect(user.segments[0]).toMatchObject({
      text: "ULT text of 1.3-4",
      draft: "Paul thanks God for them",
      criteria: ["plain"],
      suggestion: "Paul thanks God for the believers",
    });
  });

  it("replaces a taste title as ai-checked, keeps a factual one unreviewed, and changes nothing the models recorded before", async () => {
    const { complete } = fakeModel({
      "XYZ.1.3-4": {
        kind: "taste",
        title: "Paul thanks God for the believers",
        why: "Names them.",
      },
      "XYZ.1.5-6": {
        kind: "factual",
        title: "Paul expects deliverance",
        why: "Freed picks one reading.",
      },
    });
    const { run } = settle(complete);
    const { record: r, outcome } = await run;
    expect(outcome).toBe("done");
    const before = record();
    for (const [k, t] of Object.entries(r!.titles)) {
      const { dispute, ...rest } = t;
      expect(rest, k).toEqual(before.titles[k]);
      if (dispute) expect(disputeProblems(t), k).toEqual([]);
    }
    expect(r!.titles["XYZ.1.1-2"]!.dispute).toBeUndefined();
    expect(r!.titles["XYZ.1.3-4"]!.dispute).toEqual({
      by: `ai:${THIRD}`,
      kind: "taste",
      text: "Paul thanks God for the believers",
      why: "Names them.",
      status: "ai-checked",
    });
    expect(builtTitle(r!.titles["XYZ.1.3-4"]!)).toEqual({
      text: "Paul thanks God for the believers",
      status: "ai-checked",
      source: `ai:${THIRD}`,
    });
    expect(builtTitle(r!.titles["XYZ.1.5-6"]!)).toEqual({
      text: "Paul expects deliverance",
      status: "unreviewed",
      source: `ai:${THIRD}`,
    });
    expect(r!.calls.map((c) => c.role)).toEqual(["draft", "check", "dispute"]);
    expect(r!.calls[2]).toMatchObject({ model: THIRD, cost: 0.02 });
    expect(r!.disputeCheck).toEqual({
      prompt: { file: "prompts/dispute-titles.md", sha256: sha256(PROMPT) },
      verses: "ult-xyz",
      voice: { file: "data/drafts/en/TIT.json", sha256: sha256("{}") },
    });
    expect(listDisputes(r!).map((d) => d.key)).toEqual(["XYZ.1.5-6"]);
    expect(listDisputes(r!, true).map((d) => d.kind)).toEqual([
      "taste",
      "factual",
    ]);
  });

  it("leaves a taste title that fails a gate unreviewed, with its gates", () => {
    const long =
      "Paul thanks God for the believers in a very long title indeed";
    const { disputes } = readDisputes(
      { "XYZ.1.3-4": { kind: "taste", title: long, why: "x" } },
      ["XYZ.1.3-4"],
      `ai:${THIRD}`
    );
    expect(disputes["XYZ.1.3-4"]).toMatchObject({
      status: "unreviewed",
      gates: ["length"],
    });
  });

  it("reports missing and unreadable answers and settles nothing for them", async () => {
    const { complete } = fakeModel({
      "XYZ.1.3-4": { kind: "opinion", title: "Paul thanks God", why: "x" },
    });
    const { run, ledgers } = settle(complete);
    const { record: r, outcome } = await run;
    expect(outcome).toEqual({ incomplete: ["XYZ.1.5-6", "XYZ.1.3-4"] });
    // Nothing settled, nothing to commit; the call is in the ledger.
    expect(r).toBeNull();
    expect((ledgers.at(-1) as { calls: unknown[] }).calls).toHaveLength(1);
  });

  it("settles what it can read when some answers are missing", async () => {
    const { complete } = fakeModel({
      "XYZ.1.3-4": { kind: "taste", title: "Paul thanks God", why: "x" },
    });
    const { record: r, outcome } = await settle(complete).run;
    expect(outcome).toEqual({ incomplete: ["XYZ.1.5-6"] });
    expect(r!.titles["XYZ.1.3-4"]!.dispute?.kind).toBe("taste");
    expect(r!.titles["XYZ.1.5-6"]!.dispute).toBeUndefined();
  });

  it("keeps one disputeCheck per record: a later run must use the same prompt, ULT and voice", async () => {
    const answer = {
      "XYZ.1.5-6": {
        kind: "factual",
        title: "Paul expects deliverance",
        why: "x",
      },
    };
    const first = record();
    first.titles["XYZ.1.3-4"]!.dispute = {
      by: `ai:${THIRD}`,
      kind: "taste",
      text: "Paul thanks God",
      why: "x",
      status: "ai-checked",
    };
    const same = {
      prompt: { file: "prompts/dispute-titles.md", sha256: sha256(PROMPT) },
      verses: "ult-xyz",
      voice: { file: "data/drafts/en/TIT.json", sha256: sha256("{}") },
    };
    const { complete, sent } = fakeModel(answer);
    const ok = await settle(complete, {
      record: { ...first, disputeCheck: same },
    }).run;
    expect(ok.record!.disputeCheck).toEqual(same);
    expect(
      JSON.parse(sent[0]!.user).segments.map((s: { key: string }) => s.key)
    ).toEqual(["XYZ.1.5-6"]);
    const other = fakeModel(answer);
    await expect(
      settle(other.complete, {
        record: { ...first, disputeCheck: { ...same, verses: "ult-abc" } },
      }).run
    ).rejects.toThrow("disputeCheck");
    expect(other.sent).toHaveLength(0);
  });

  it.each([DRAFTER.replace("sonnet", "opus"), "google/gemini-3.8-pro"])(
    "refuses a third model of the drafting or checking family (%s)",
    async (model) => {
      const { complete, sent } = fakeModel({});
      await expect(settle(complete, { model }).run).rejects.toThrow("family");
      expect(sent).toHaveLength(0);
    }
  );

  it("stops when OpenRouter says another family answered, and keeps the call in the ledger", async () => {
    const { complete } = fakeModel({}, "google/gemini-3.8-pro");
    const { run, ledgers } = settle(complete);
    const { record: r, outcome } = await run;
    expect(r).toBeNull();
    expect(outcome).toMatchObject({
      stopped: expect.stringContaining("answered by"),
    });
    const last = ledgers.at(-1) as { calls: unknown[] };
    expect(last.calls).toHaveLength(1);
  });

  it("skips titles a person reviewed or a third model already settled", () => {
    const r = record();
    r.titles["XYZ.1.3-4"]!.review = {
      by: "reviewer:x",
      status: "human-reviewed",
    };
    expect(disputeInputs(r, inputs).map((s) => s.key)).toEqual(["XYZ.1.5-6"]);
    r.titles["XYZ.1.5-6"]!.dispute = {
      by: `ai:${THIRD}`,
      kind: "factual",
      text: "Paul expects deliverance",
      why: "x",
      status: "unreviewed",
    };
    expect(disputeInputs(r, inputs)).toEqual([]);
  });

  it("lets a person's review decide over a dispute, keeping the AI source when the wording is kept", () => {
    const t: Title = {
      ...disputed(
        "Paul thanks God for them",
        "Paul thanks God for the believers"
      ),
      dispute: {
        by: `ai:${THIRD}`,
        kind: "factual",
        text: "Paul thanks God for the believers",
        why: "x",
        status: "unreviewed",
      },
    };
    expect(
      builtTitle({
        ...t,
        review: { by: "reviewer:a", status: "human-reviewed" },
      })
    ).toEqual({
      text: "Paul thanks God for the believers",
      status: "human-reviewed",
      source: `ai:${THIRD}`,
    });
    expect(
      builtTitle({
        ...t,
        review: { by: "reviewer:a", status: "human-reviewed", text: "Mine" },
      })
    ).toEqual({ text: "Mine", status: "human-reviewed", source: "reviewer:a" });
  });
});

describe("disputeProblems", () => {
  const ok: Title = {
    ...disputed("Paul thanks God for them", "s"),
    dispute: {
      by: `ai:${THIRD}`,
      kind: "taste",
      text: "Paul thanks God",
      why: "x",
      status: "ai-checked",
    },
  };

  it("accepts a well-formed dispute", () => {
    expect(disputeProblems(ok)).toEqual([]);
  });

  it.each([
    ["a status above ai-checked", { status: "human-reviewed" }, "status"],
    ["a factual title marked ai-checked", { kind: "factual" }, "status"],
    [
      "a model of the drafting family",
      { by: "ai:anthropic/claude-opus-5" },
      "drafting",
    ],
    [
      "a model of the checking family",
      { by: "ai:google/gemini-3.8-pro" },
      "checking",
    ],
    ["a reviewer as source", { by: "reviewer:a" }, "ai:<model>"],
    ["an untrimmed title", { text: " Paul thanks God" }, "trimmed"],
    [
      "missing gates",
      { text: "Paul thanks God.", status: "unreviewed" },
      "gates",
    ],
    ["an extra field", { status2: "x" }, "field"],
  ])("refuses %s", (_name, change, problem) => {
    const t = { ...ok, dispute: { ...ok.dispute!, ...change } } as Title;
    expect(disputeProblems(t).join("; ")).toContain(problem);
  });

  it("refuses a dispute on a title the checker agreed with", () => {
    expect(disputeProblems({ ...agreed("x"), dispute: ok.dispute })).toContain(
      "no disagreement to settle"
    );
  });
});

describe("ultVerseTexts", () => {
  it("drops ULT's \\ts\\* section markers, which carry no words", () => {
    const usfm =
      "\\c 1\n\\v 1 \\w Paul|x=1\\w*,\n\\ts\\*\n\\v 2 \\w Grace|x=1\\w*.";
    expect([...ultVerseTexts(usfm)]).toEqual([
      ["1:1", "Paul,"],
      ["1:2", "Grace."],
    ]);
  });

  it("reads all 104 verses of Philippians from the pinned ULT", async () => {
    const { readSource } = await import("../scripts/lib/sources.ts");
    const usfm = await readSource("ult-php");
    expect(usfm.match(/\\ts\\\*/g)).toHaveLength(37);
    const v = ultVerseTexts(usfm);
    expect(v.size).toBe(104);
    expect(v.get("2:12")).toContain("work out your own salvation");
  });
});

describe("voiceOf", () => {
  it("takes the Titus titles as the build does, a person's wording first", () => {
    const voice = voiceOf(JSON.parse(read("data/drafts/en/TIT.json")));
    const built = JSON.parse(read("data/titles/en/TIT.json")).titles;
    expect(voice).toHaveLength(25);
    for (const v of voice) expect(v.title, v.key).toBe(built[v.key].text);
    expect(voice.find((v) => v.key === "TIT.2.6-8")?.title).toBe(
      "Titus instructs younger men"
    );
  });
});
