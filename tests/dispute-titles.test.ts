import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  builtTitle,
  disputeCheckProblems,
  disputeInputs,
  disputeMessage,
  disputeProblems,
  disputePrompt,
  listDisputes,
  readDisputes,
  reviewSheet,
  settleDisputes,
  ultSource,
  ultVerseTexts,
  voiceOf,
  type Complete,
  type DisputeCheck,
  type DisputedRecord,
  type Title,
} from "../scripts/lib/dispute-titles.ts";
import type { Completion } from "../scripts/lib/openrouter.ts";
import {
  CHECK_MAX_TOKENS,
  checkMessage,
  promptPart,
  type SegmentInput,
} from "../scripts/lib/segment-titles.ts";
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

const SEGMENT_PROMPT = readFileSync(
  new URL("../prompts/segment-titles.md", import.meta.url),
  "utf8"
);

const record = (): DisputedRecord => ({
  language: "en",
  book: "XYZ",
  bible: "bsb-xyz",
  prompt: { file: "prompts/segment-titles.md", sha256: sha256(SEGMENT_PROMPT) },
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
const bsbInputs: SegmentInput[] = inputs.map((s) => ({
  ...s,
  text: s.text.replace("ULT", "BSB"),
}));

/** The checker agreeing with every title it is sent. */
const agreeAll = (user: string) =>
  Object.fromEntries(
    (JSON.parse(user) as { segments: { key: string }[] }).segments.map((s) => [
      s.key,
      { verdict: "agree" },
    ])
  );

/**
 * A fake OpenRouter: the first call gets `reply`, the second (the recheck)
 * `recheck`, by default an agreement with every title sent.
 */
function fakeModel(
  reply: unknown,
  answeredBy?: string,
  recheck: unknown | ((user: string) => unknown) = agreeAll,
  recheckBy?: string
) {
  const sent: {
    model: string;
    system: string;
    user: string;
    maxTokens?: number;
  }[] = [];
  const complete: Complete = async (request) => {
    const user = request.messages[1]?.content ?? "";
    sent.push({
      model: request.model,
      system: request.messages[0]?.content ?? "",
      user,
      ...(request.maxTokens ? { maxTokens: request.maxTokens } : {}),
    });
    const first = sent.length === 1;
    const answer = first
      ? reply
      : typeof recheck === "function"
        ? (recheck as (u: string) => unknown)(user)
        : recheck;
    const c: Completion = {
      id: first ? "gen-3" : "gen-4",
      model: (first ? answeredBy : recheckBy) ?? request.model,
      text: JSON.stringify(answer),
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
      recheck: {
        prompt: { file: "prompts/segment-titles.md", text: SEGMENT_PROMPT },
        inputs: bsbInputs,
      },
      complete,
      write: async (l) => {
        ledgers.push(l);
      },
      ...overrides,
    }),
  };
};

describe("the third check (ADR 0005 item 6)", () => {
  it("sends only the disputed titles, with their ULT verses, the checker's objection and the Titus voice, never its suggestion", async () => {
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
    expect(sent).toHaveLength(2);
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
    expect(user.segments[0]).toEqual({
      key: "XYZ.1.3-4",
      verses: "1:3-4",
      pericope: "Greeting",
      text: "ULT text of 1.3-4",
      draft: "Paul thanks God for them",
      criteria: ["plain"],
      why: "Unclear them.",
    });
    // Blind (#207): neither suggestion is anywhere in what the third model
    // is sent.
    for (const m of [sent[0]!.system, sent[0]!.user]) {
      expect(m).not.toContain("Paul thanks God for the believers");
      expect(m).not.toContain("Paul hopes they are freed");
      expect(m).not.toContain("suggestion");
    }
  });

  it("never sends a person's review or its wording to the third model", async () => {
    const r = record();
    r.titles["XYZ.1.1-2"] = {
      ...disputed("Paul greets them", "Paul greets the church"),
      review: {
        by: "reviewer:a",
        status: "human-reviewed",
        text: "A reviewer’s own words",
      },
    };
    const { complete, sent } = fakeModel({});
    await settle(complete, { record: r }).run;
    expect(sent[0]!.user).not.toContain("A reviewer’s own words");
    expect(sent[0]!.user).not.toContain("human-reviewed");
    expect(sent[0]!.user).not.toContain("Paul greets");
  });

  it("sends every title the third model gives back to the record's checker, as a draft is checked", async () => {
    const { complete, sent } = fakeModel({
      "XYZ.1.3-4": {
        kind: "taste",
        title: "Paul thanks God for the believers",
        why: "Keeps the thanks.",
      },
      "XYZ.1.5-6": {
        kind: "factual",
        title: "Paul expects deliverance",
        why: "Freed picks one reading.",
      },
    });
    await settle(complete).run;
    expect(sent[1]!.model).toBe(CHECKER);
    expect(sent[1]!.maxTokens).toBe(CHECK_MAX_TOKENS);
    expect(sent[1]!.system).toBe(promptPart(SEGMENT_PROMPT, "check"));
    expect(sent[1]!.user).toBe(
      checkMessage("XYZ", bsbInputs.slice(1), {
        "XYZ.1.3-4": "Paul thanks God for the believers",
        "XYZ.1.5-6": "Paul expects deliverance",
      })
    );
    // Nothing else the third model said: not its kind, nor its reason.
    expect(sent[1]!.user).not.toContain("Keeps the thanks");
    expect(sent[1]!.user).not.toContain("factual");
  });

  it("leaves a taste title the checker does not agree with unreviewed, and lists it", async () => {
    const { complete } = fakeModel(
      {
        "XYZ.1.3-4": {
          kind: "taste",
          title: "Paul thanks God",
          why: "Shorter.",
        },
        "XYZ.1.5-6": {
          kind: "taste",
          title: "Paul hopes for deliverance",
          why: "Plain.",
        },
      },
      undefined,
      {
        "XYZ.1.3-4": {
          verdict: "disagree",
          criteria: ["covers"],
          why: "Drops the prayer.",
          suggestion: "Paul thanks God and prays for them",
        },
        "XYZ.1.5-6": { verdict: "agree" },
      }
    );
    const { record: r, outcome } = await settle(complete).run;
    expect(outcome).toBe("done");
    const a = r!.titles["XYZ.1.3-4"]!.dispute!;
    expect(a.status).toBe("unreviewed");
    expect(a.recheck).toMatchObject({
      by: `ai:${CHECKER}`,
      verdict: "disagree",
    });
    expect(r!.titles["XYZ.1.5-6"]!.dispute!.status).toBe("ai-checked");
    for (const t of Object.values(r!.titles))
      expect(disputeProblems(t)).toEqual([]);
    expect(
      listDisputes(r!).map((d) => [d.key, d.recheck, d.recheckWhy])
    ).toEqual([["XYZ.1.3-4", "disagree", "covers: Drops the prayer."]]);
    expect(r!.calls.map((c) => c.role)).toEqual([
      "draft",
      "check",
      "dispute",
      "recheck",
    ]);
  });

  it("returns no record when the recheck gives no reply, so a retry rechecks every title", async () => {
    const { complete } = fakeModel(
      {
        "XYZ.1.3-4": { kind: "taste", title: "Paul thanks God", why: "x" },
        "XYZ.1.5-6": { kind: "taste", title: "Paul hopes", why: "x" },
      },
      undefined,
      "not json"
    );
    const { run, ledgers } = settle(complete);
    const { record: r, outcome } = await run;
    expect(outcome).toMatchObject({
      stopped: expect.stringContaining("recheck"),
    });
    // Nothing to commit: a record with unrechecked disputes would make a
    // later run report "nothing to settle".
    expect(r).toBeNull();
    const last = ledgers.at(-1) as {
      calls: { role: string }[];
      reply: unknown;
    };
    expect(last.calls.map((c) => c.role)).toEqual(["dispute", "recheck"]);
    expect(last.reply).not.toBeNull();
  });

  it("returns no record when the recheck leaves any title without a verdict", async () => {
    const { complete } = fakeModel(
      {
        "XYZ.1.3-4": { kind: "taste", title: "Paul thanks God", why: "x" },
        "XYZ.1.5-6": { kind: "taste", title: "Paul hopes", why: "x" },
      },
      undefined,
      { "XYZ.1.3-4": { verdict: "agree" } }
    );
    const { record: r, outcome } = await settle(complete).run;
    expect(r).toBeNull();
    expect(outcome).toEqual({
      stopped: "recheck gave no verdict on XYZ.1.5-6",
    });
  });

  it("refuses a recheck answered by the third model's family", async () => {
    const { complete } = fakeModel(
      { "XYZ.1.3-4": { kind: "taste", title: "Paul thanks God", why: "x" } },
      undefined,
      agreeAll,
      "openai/gpt-6.1-mini"
    );
    const { record: r, outcome } = await settle(complete).run;
    expect(outcome).toMatchObject({
      stopped: expect.stringContaining("not of the checking model's family"),
    });
    expect(r).toBeNull();
  });

  it.each([
    ["the third model's family", { model: "openai/gpt-6.1-mini" }],
    ["the drafting model's family", { model: DRAFTER }],
    ["a fourth family, not the checker's", { model: "x-ai/grok-4.7" }],
  ])(
    "refuses a recheck model of %s before any spend",
    async (_name, change) => {
      const { complete, sent } = fakeModel({});
      await expect(
        settle(complete, {
          recheck: {
            prompt: { file: "prompts/segment-titles.md", text: SEGMENT_PROMPT },
            inputs: bsbInputs,
            ...change,
          },
        }).run
      ).rejects.toThrow("recheck model");
      expect(sent).toHaveLength(0);
    }
  );

  it("refuses a recheck prompt other than the one the drafts were checked with", async () => {
    const { complete, sent } = fakeModel({});
    await expect(
      settle(complete, {
        recheck: {
          prompt: { file: "prompts/segment-titles.md", text: "another" },
          inputs: bsbInputs,
        },
      }).run
    ).rejects.toThrow("recheck prompt");
    expect(sent).toHaveLength(0);
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
      recheck: { by: `ai:${CHECKER}`, verdict: "agree" },
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
    expect(r!.calls.map((c) => c.role)).toEqual([
      "draft",
      "check",
      "dispute",
      "recheck",
    ]);
    expect(r!.calls[2]).toMatchObject({ model: THIRD, cost: 0.02 });
    expect(r!.calls[3]).toMatchObject({ id: "gen-4", model: CHECKER });
    expect(r!.disputeCheck).toEqual({
      prompt: { file: "prompts/dispute-titles.md", sha256: sha256(PROMPT) },
      verses: "ult-xyz",
      voice: { file: "data/drafts/en/TIT.json", sha256: sha256("{}") },
      recheck: {
        prompt: {
          file: "prompts/segment-titles.md",
          sha256: sha256(SEGMENT_PROMPT),
        },
        bible: "bsb-xyz",
      },
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

  it("keeps one disputeCheck per record: a later run must use the same prompt, ULT, voice and recheck", async () => {
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
      recheck: { by: `ai:${CHECKER}`, verdict: "agree" },
    };
    const same = {
      prompt: { file: "prompts/dispute-titles.md", sha256: sha256(PROMPT) },
      verses: "ult-xyz",
      voice: { file: "data/drafts/en/TIT.json", sha256: sha256("{}") },
      recheck: {
        prompt: {
          file: "prompts/segment-titles.md",
          sha256: sha256(SEGMENT_PROMPT),
        },
        bible: "bsb-xyz",
      },
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

  // #208: a book drafted in batches has several draft calls, and a later
  // one can be answered by another model than the first.
  it("refuses a third model of the family that answered any draft or check call", async () => {
    const r = record();
    r.calls = [
      call("draft", DRAFTER),
      call("draft", THIRD),
      call("check", CHECKER),
    ];
    const { complete, sent } = fakeModel({});
    await expect(settle(complete, { record: r }).run).rejects.toThrow(
      `drafting (${DRAFTER}, ${THIRD})`
    );
    expect(sent).toHaveLength(0);
  });

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
      recheck: { by: `ai:${CHECKER}`, verdict: "agree" },
    },
  };

  it("accepts a well-formed dispute", () => {
    expect(disputeProblems(ok)).toEqual([]);
  });

  it("accepts a taste title left unreviewed by a recheck that disagreed", () => {
    const t = {
      ...ok,
      dispute: {
        ...ok.dispute!,
        status: "unreviewed",
        recheck: {
          by: `ai:${CHECKER}`,
          verdict: "disagree",
          criteria: ["covers"],
          why: "Drops a verse.",
          suggestion: "x",
        },
      },
    } as Title;
    expect(disputeProblems(t)).toEqual([]);
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
    [
      "a taste title ai-checked with no recheck",
      { recheck: undefined },
      "status is not unreviewed",
    ],
    [
      "a taste title ai-checked though the recheck disagreed",
      {
        recheck: {
          by: `ai:${CHECKER}`,
          verdict: "disagree",
          criteria: ["covers"],
          why: "x",
          suggestion: "x",
        },
      },
      "status is not unreviewed",
    ],
    [
      "a recheck by the third model's family",
      { recheck: { by: "ai:openai/gpt-6.1-mini", verdict: "agree" } },
      "third model's family",
    ],
    [
      "a recheck by the drafting model's family",
      { recheck: { by: `ai:${DRAFTER}`, verdict: "agree" } },
      "drafting model's family",
    ],
    [
      "a recheck by a family other than the checker's",
      { recheck: { by: "ai:x-ai/grok-4.7", verdict: "agree" } },
      "not by the checking model's family",
    ],
    [
      "a recheck with an unknown criterion",
      {
        recheck: {
          by: `ai:${CHECKER}`,
          verdict: "disagree",
          criteria: ["taste"],
          why: "x",
          suggestion: "x",
        },
      },
      "recheck criteria",
    ],
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

// The Philippians trial run of 3 Nov (docs/scoping/dispute-check.md), kept
// as a fixture: a real third-check record, not written to data/ (#207).
describe("a recorded third check (fixture: the Philippians trial run)", () => {
  const r = JSON.parse(
    read("tests/fixtures/disputes/PHP-run1.json")
  ) as DisputedRecord;

  it("is refused by the revised rules: no taste title reaches ai-checked without a recheck (#207)", () => {
    const refused: string[] = [];
    for (const [k, t] of Object.entries(r.titles)) {
      const p = disputeProblems(t);
      if (t.dispute?.kind === "taste")
        expect(p, k).toEqual(["status is not unreviewed"]);
      else expect(p, k).toEqual([]);
      if (p.length > 0) refused.push(k);
    }
    expect(refused).toHaveLength(12);
  });

  it("was made with the first dispute prompt, kept in prompts/history/", () => {
    const h = r.disputeCheck!.prompt.sha256;
    const kept = read(`prompts/history/dispute-titles-${h.slice(0, 12)}.md`);
    expect(sha256(kept)).toBe(h);
    expect(sha256(PROMPT)).not.toBe(h);
  });

  it("settles every disputed title, and only those, by a third family", () => {
    const family = (m: string) => m.split("/")[0];
    expect(r.calls.map((c) => c.role)).toEqual(["draft", "check", "dispute"]);
    expect(new Set(r.calls.map((c) => family(c.model))).size).toBe(3);
    for (const [k, t] of Object.entries(r.titles)) {
      expect(t.dispute !== undefined, k).toBe(t.check?.verdict === "disagree");
      if (t.dispute) expect(t.dispute.by).toBe(`ai:${r.calls[2]!.model}`);
    }
    expect(r.disputeCheck).toMatchObject({
      prompt: { file: "prompts/dispute-titles.md" },
      verses: "ult-php",
      voice: { file: "data/drafts/en/TIT.json" },
    });
  });

  it("was built, under the first rules, with taste titles ai-checked and factual ones unreviewed", () => {
    const kinds = { taste: 0, factual: 0 };
    for (const t of Object.values(r.titles)) {
      if (!t.dispute) continue;
      kinds[t.dispute.kind]++;
      expect(builtTitle(t)).toEqual({
        text: t.dispute.text,
        status: t.dispute.kind === "taste" ? "ai-checked" : "unreviewed",
        source: t.dispute.by,
      });
    }
    expect(kinds).toEqual({ taste: 12, factual: 2 });
    expect(listDisputes(r).map((d) => d.key)).toEqual([
      "PHP.1.18-19",
      "PHP.2.17-18",
    ]);
  });
});

// Follow-ups from the #203 review bench (#206).
describe("the third check's guards and records (#206)", () => {
  const settled = (): DisputedRecord => {
    const r = record();
    for (const k of ["XYZ.1.3-4", "XYZ.1.5-6"])
      r.titles[k]!.dispute = {
        by: `ai:${THIRD}`,
        kind: "factual",
        text: "Paul thanks God",
        why: "x",
        status: "unreviewed",
      };
    return r;
  };
  const same = {
    prompt: { file: "prompts/dispute-titles.md", sha256: sha256(PROMPT) },
    verses: "ult-xyz",
    voice: { file: "data/drafts/en/TIT.json", sha256: sha256("{}") },
    recheck: {
      prompt: {
        file: "prompts/segment-titles.md",
        sha256: sha256(SEGMENT_PROMPT),
      },
      bible: "bsb-xyz",
    },
  };

  it("refuses another run's disputeCheck even when nothing is left to settle", async () => {
    const { complete, sent } = fakeModel({});
    await expect(
      settle(complete, {
        record: { ...settled(), disputeCheck: { ...same, verses: "ult-abc" } },
      }).run
    ).rejects.toThrow("disputeCheck");
    expect(sent).toHaveLength(0);
    const ok = await settle(complete, {
      record: { ...settled(), disputeCheck: same },
    }).run;
    expect(ok.outcome).toBe("nothing to settle");
    expect(sent).toHaveLength(0);
  });

  // The runner counts this run's disputes against the record it passed in,
  // so settling must not write onto that record.
  it("leaves the record it was given unchanged when it settles a title", async () => {
    const r = record();
    r.titles["XYZ.1.3-4"]!.dispute = {
      by: `ai:${THIRD}`,
      kind: "factual",
      text: "Paul thanks God",
      why: "x",
      status: "unreviewed",
    };
    const before = structuredClone(r);
    const { complete } = fakeModel({
      "XYZ.1.5-6": { kind: "factual", title: "Paul expects it", why: "x" },
    });
    const { record: out, outcome } = await settle(complete, { record: r }).run;
    expect(outcome).toBe("done");
    expect(out!.titles["XYZ.1.5-6"]!.dispute?.text).toBe("Paul expects it");
    expect(r).toEqual(before);
  });

  it("keeps the raw text of a reply it cannot read in the ledger", async () => {
    const { complete } = fakeModel("cut off");
    const { run, ledgers } = settle(complete);
    const { record: r, outcome } = await run;
    expect(r).toBeNull();
    expect(outcome).toMatchObject({
      stopped: expect.stringMatching(/^unreadable reply/),
    });
    expect(ledgers.at(-1)).toMatchObject({
      outcome,
      reply: null,
      replyText: JSON.stringify("cut off"),
    });
  });

  it("leaves the raw text out of the ledger when the reply was read", async () => {
    const { complete } = fakeModel({
      "XYZ.1.3-4": { kind: "taste", title: "Paul thanks God", why: "x" },
      "XYZ.1.5-6": { kind: "factual", title: "Paul expects it", why: "x" },
    });
    const { run, ledgers } = settle(complete);
    expect((await run).outcome).toBe("done");
    expect(ledgers.at(-1)).not.toHaveProperty("replyText");
  });

  it("says gates must be absent when a title passes every gate", () => {
    const t: Title = {
      ...disputed("Paul thanks God for them", "s"),
      dispute: {
        by: `ai:${THIRD}`,
        kind: "factual",
        text: "Paul thanks God",
        why: "x",
        status: "unreviewed",
        gates: [],
      },
    };
    expect(disputeProblems(t)).toEqual(["gates must be absent"]);
    expect(
      disputeProblems({
        ...t,
        dispute: { ...t.dispute!, text: "Paul thanks God.", gates: undefined },
      })
    ).toEqual(['gates are not ["full-stop"]']);
  });

  it("keeps the raw text of a recheck reply it cannot read in the ledger", async () => {
    const { complete } = fakeModel(
      {
        "XYZ.1.3-4": { kind: "taste", title: "Paul thanks God", why: "x" },
        "XYZ.1.5-6": { kind: "factual", title: "Paul expects it", why: "x" },
      },
      undefined,
      "cut off"
    );
    const { run, ledgers } = settle(complete);
    const { record: r, outcome } = await run;
    expect(r).toBeNull();
    expect(outcome).toEqual({
      stopped: "recheck: unreadable reply: reply has no JSON object",
    });
    expect(ledgers.at(-1)).toMatchObject({
      outcome,
      recheckReply: null,
      recheckReplyText: JSON.stringify("cut off"),
    });
    expect(ledgers.at(-1)).not.toHaveProperty("replyText");
  });

  it("holds disputeCheck.verses to the book's own ULT", () => {
    const at = (disputeCheck?: DisputeCheck) => ({
      titles: {},
      ...(disputeCheck ? { disputeCheck } : {}),
    });
    expect(ultSource("PHP")).toBe("ult-php");
    expect(disputeCheckProblems("XYZ", at(same))).toEqual([]);
    expect(disputeCheckProblems("XYZ", at())).toEqual([]);
    expect(
      disputeCheckProblems("XYZ", at({ ...same, verses: "ult-php" }))
    ).toEqual(["verses is ult-php, not ult-xyz"]);
    expect(
      disputeCheckProblems("XYZ", at({ ...same, verses: "bsb-xyz" }))
    ).toEqual(["verses is bsb-xyz, not ult-xyz"]);
  });

  // From the bench on #222: the book is the file's, not the record's own
  // field, so a record filed under another book cannot vouch for itself.
  it("holds verses to the book the record is filed as", () => {
    const col = {
      book: "COL",
      titles: {},
      disputeCheck: { ...same, verses: "ult-col" },
    };
    expect(disputeCheckProblems("PHP", col)).toEqual([
      "verses is ult-col, not ult-php",
    ]);
    expect(disputeCheckProblems("COL", col)).toEqual([]);
  });

  // #223: the runner never writes a dispute without its recheck, so a record
  // that names one and holds a dispute without it was not made by the runner.
  it("requires a recheck on every dispute of a record that names disputeCheck.recheck", () => {
    const r = settled();
    expect(disputeCheckProblems("XYZ", { ...r, disputeCheck: same })).toEqual([
      "XYZ.1.3-4: a dispute with no recheck",
      "XYZ.1.5-6: a dispute with no recheck",
    ]);
    r.titles["XYZ.1.3-4"]!.dispute!.recheck = {
      by: `ai:${CHECKER}`,
      verdict: "agree",
    };
    expect(disputeCheckProblems("XYZ", { ...r, disputeCheck: same })).toEqual([
      "XYZ.1.5-6: a dispute with no recheck",
    ]);
    // A record from before the recheck (the PHP trial run) names none.
    const { recheck: _, ...before } = same;
    expect(disputeCheckProblems("XYZ", { ...r, disputeCheck: before })).toEqual(
      []
    );
  });
});

describe("dispute-titles command line (#206)", () => {
  const script = fileURLToPath(
    new URL("../scripts/translate/dispute-titles.ts", import.meta.url)
  );
  const KEY = "sk-or-test-not-a-key";
  const run = (args: string[]) =>
    spawnSync(process.execPath, [script, ...args], {
      env: { PATH: process.env.PATH ?? "", OPENROUTER_API_KEY: KEY },
      encoding: "utf8",
    });

  it("does not point to a ledger when it refuses before any call", () => {
    const dir = mkdtempSync(join(tmpdir(), "dispute-cli-"));
    try {
      const r = run([
        "--book",
        "PHP",
        "--model",
        "anthropic/claude-opus-5",
        "--out",
        join(dir, "out"),
      ]);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("family");
      expect(r.stderr).toContain("refused before any call; no ledger");
      expect(r.stderr).not.toContain("the ledger is in");
      expect(existsSync(join(dir, "out", "run.json"))).toBe(false);
      expect(r.stderr + r.stdout).not.toContain(KEY);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // The Philippians trial record, with its disputeCheck set to this tree's
  // prompt and voice, has nothing left to settle: no call is made, and the
  // runner must not report its 14 disputes as settled by this run.
  it("reports only what this run settled", () => {
    const dir = mkdtempSync(join(tmpdir(), "dispute-cli-"));
    try {
      const r1 = JSON.parse(
        read("tests/fixtures/disputes/PHP-run1.json")
      ) as DisputedRecord;
      r1.disputeCheck = {
        prompt: { file: "prompts/dispute-titles.md", sha256: sha256(PROMPT) },
        verses: "ult-php",
        voice: {
          file: "data/drafts/en/TIT.json",
          sha256: sha256(read("data/drafts/en/TIT.json")),
        },
        // The kept prompt the record's drafts were checked with, as the
        // runner finds it by SHA-256.
        recheck: {
          prompt: {
            file: `prompts/history/segment-titles-${r1.prompt.sha256.slice(0, 12)}.md`,
            sha256: r1.prompt.sha256,
          },
          bible: r1.bible,
        },
      };
      const file = join(dir, "PHP.json");
      writeFileSync(file, JSON.stringify(r1));
      const r = run([
        "--book",
        "PHP",
        "--model",
        THIRD,
        "--record",
        file,
        "--out",
        join(dir, "out"),
      ]);
      expect(r.stderr).toBe("");
      expect(r.status).toBe(0);
      expect(r.stdout).toContain(
        "en PHP: 0 disputes settled in this run: 0 taste, 0 factual"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// Blind (#207): the message built for every disputed title of every scripted
// record holds neither the checker's suggestion nor any verdict from
// ADR 0005's hand sort, and the instructions none of that sort's titles.
describe("the third check is blind", () => {
  const adr = read("docs/decisions/0005-go-no-go-1-ai-checked-english.md");
  // The Proposed title column of the ADR's Philippians table.
  const adrTitles = [
    ...adr.matchAll(/^\| PHP\.[^|]+\|[^|]+\|[^|]+\| ([^|]+?) +\|/gm),
  ].map((m) => m[1]!);

  it("reads the ADR 0005 table", () => {
    expect(adrTitles).toHaveLength(14);
  });

  it("has instructions with none of the ADR 0005 sort in them", () => {
    const system = disputePrompt(PROMPT);
    for (const t of adrTitles) expect(system).not.toContain(t);
    expect(system).not.toContain("vindication");
    expect(system).not.toContain("suggestion");
  });

  const records = [
    ...["COL", "1TH", "2TI"].map(
      (b) => [b, `data/drafts/en/${b}.json`] as const
    ),
    ["PHP", "tests/fixtures/disputes/PHP-run1.json"] as const,
  ];
  it.each(records)(
    "builds a message for %s without the checker's suggestions",
    async (book, file) => {
      const { readSource } = await import("../scripts/lib/sources.ts");
      const { segmentInputs } =
        await import("../scripts/lib/segment-titles.ts");
      const { parseHeadings } = await import("../scripts/lib/structure.ts");
      const full = JSON.parse(read(file)) as DisputedRecord;
      // As before any third check: the drafted and checked record alone.
      const r: DisputedRecord = {
        ...full,
        titles: Object.fromEntries(
          Object.entries(full.titles).map(([k, t]) => {
            const { dispute: _d, ...rest } = t;
            return [k, rest];
          })
        ),
      };
      const id = book.toLowerCase();
      const { inputs: ult } = segmentInputs(
        JSON.parse(read(`data/structure/${book}.json`)),
        parseHeadings(await readSource(`bsb-${id}`)),
        ultVerseTexts(await readSource(`ult-${id}`))
      );
      const segments = disputeInputs(r, ult);
      const suggestions = Object.values(r.titles).flatMap((t) =>
        t.check?.verdict === "disagree" ? [t.check.suggestion] : []
      );
      expect(segments.length).toBe(suggestions.length);
      expect(suggestions.length).toBeGreaterThan(0);
      const message = disputeMessage(
        book,
        voiceOf(JSON.parse(read("data/drafts/en/TIT.json"))),
        segments
      );
      // Counted, not matched one by one, so a failure never prints a
      // suggestion into a test log before the blind run.
      expect(suggestions.filter((sg) => message.includes(sg)).length).toBe(0);
      for (const t of adrTitles) expect(message).not.toContain(t);
      for (const seg of segments)
        expect(Object.keys(seg).sort()).toEqual([
          "criteria",
          "draft",
          "key",
          "pericope",
          "text",
          "verses",
          "why",
        ]);
      const voice = JSON.parse(message).voice as { key: string }[];
      for (const v of voice) expect(v.key).toMatch(/^TIT\./);
    }
  );
});

describe("reviewSheet", () => {
  it("gives a person each dispute with its verses, the rewrite, the checker's verdict and two empty answer columns", () => {
    const r = record();
    r.titles["XYZ.1.3-4"]!.dispute = {
      by: `ai:${THIRD}`,
      kind: "taste",
      text: "Paul thanks God for the believers",
      why: "Keeps the thanks.",
      status: "ai-checked",
      recheck: { by: `ai:${CHECKER}`, verdict: "agree" },
    };
    const sheet = reviewSheet(r, inputs);
    const rows = sheet.trim().split("\n");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain("Keeps every main point?");
    expect(rows[2]).toBe(
      "| XYZ.1.3-4 | 1:3-4 ULT text of 1.3-4 | Paul thanks God for them | plain: Unclear them. | taste | Paul thanks God for the believers | Keeps the thanks. | agree | ai-checked |  |  |"
    );
    // Never the checker's suggestion.
    expect(sheet).not.toContain("Paul hopes they are freed");
  });
});
