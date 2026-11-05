# Model calls through the local CLIs (#251)

Status: **measured, not decided** (5 Nov 2026). Every model call in this
repo goes through OpenRouter (`scripts/lib/openrouter.ts`). This file asks
whether the Claude calls could go through the local `claude` CLI and the
OpenAI calls through the local `codex` CLI, on the organization's
subscriptions, without changing the results. Nothing here changes a runner
or `data/`: the trials wrote only to `.cache/`, with throwaway scripts that
call the repo's own `draftSegmentTitles` and `settleDisputes` and swap only
the transport for one role. The English run for v0.1.0 stays on OpenRouter
(ADR 0008). Whether translation runs use the CLIs is the maintainer's
decision; implementation, if chosen, is a separate PR.

In one line: the `claude` CLI sends our prompt and input unchanged, adds a
fixed 1,314 tokens of its own, and gave drafts whose numbers fall inside
OpenRouter's own run-to-run spread. The `codex` CLI cannot reach the third
model we use (`gpt-6.1-sol`), and adds 8,478 tokens of its own that cannot
be removed.

## What a call sends today

From `scripts/lib/openrouter.ts`, `scripts/lib/segment-titles.ts` and
`scripts/lib/dispute-titles.ts` at `c479756`:

- one `POST` to OpenRouter's chat completions with `model`, two messages
  (`system`: the prompt part between the file's markers; `user`: the JSON
  input), `temperature: 0`, `max_tokens` (16,384 for a draft, 32,768 for a
  check or recheck) and `usage: {include: true}`;
- the reply is parsed as one JSON object (`parseReply`);
- the record's `calls` keeps, per call: `role`, `id` (OpenRouter's
  generation id), `model` (as OpenRouter says answered), `promptTokens`,
  `completionTokens`, `reasoningTokens`, `cost` (US dollars as billed) and
  `ms` (docs/schema.md, `calls`);
- the spend fuse refuses the next call once `maxCost` is spent **or while any
  cost so far is unknown** (`cost: null`): it fails closed.

## 6B

### Model-call transport

| Step   | Verdict  | Evidence / justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Borrow | applied  | OpenRouter as it is: `scripts/lib/openrouter.ts` at `c479756`, one key, every model behind one API, a generation id and a billed cost per call. Every measured number in [sizing.md](sizing.md) and [dispute-check.md](dispute-check.md) was made on it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Bend   | applied  | The installed `claude` (2.1.318) and `codex` (codex-cli 0.157.1) CLIs, run headless as one-shot completion endpoints: our system prompt in place of (Claude) or beside (Codex) the CLI's own, our input as the one user message, no tools (Codex keeps one: Break 6). Trials A and B below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Break  | observed | (1) `codex exec -m gpt-6.1-sol` on the ChatGPT account: `400 … The 'gpt-6.1-sol' model is not supported when using Codex with a ChatGPT account`; the nearest listed model is `gpt-6-sol`. (2) Neither CLI can drop its own instructions: `claude -p --system-prompt` keeps 1,314 tokens; `codex exec -c base_instructions=…` is refused (`base_instructions is ignored`), 8,478 tokens stay. (3) Neither CLI takes `temperature` or `max_tokens`. (4) Neither CLI reports a billed cost, so today's fuse would refuse the call after the first (`cost unknown, not run`). (5) `claude --bare`, the mode that skips the extra context, reads only `ANTHROPIC_API_KEY`, never the subscription login (`claude --help`). (6) Codex keeps a JavaScript `exec` tool that no flag removes; in 1 of 6 third-check calls the model used it 4 times to count title lengths. |
| Beget  | skipped  | No uW or partner team carries a model gateway we could use instead; the open questions below (subscription terms, the AGENTS.md wording) go to a person, not to a team.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Bide   | waiting  | Direct provider API accounts (Anthropic, OpenAI): not measured. They would remove the CLI harness and keep per-call billing and ids, but they are another vendor account and another key, and nothing observed breaks on OpenRouter that they would fix. Tripwire: OpenRouter refuses or mislabels a model we use, or its billed cost is shown to differ from the provider's list price by enough to matter on the translation run; then measure one book on the direct API as in Trial A.                                                                                                                                                                                                                                                                                                                                                                          |
| Build  | not-yet  | If the maintainer chooses the Claude CLI for translation: a second transport beside `complete()` that runs `claude -p` (flags below), a `via` field and a subscription cost rule in `calls`, and a fuse that accepts a subscription call. Traced to Breaks 2 to 5. Nothing for Codex unless the third model is changed by decision (Break 1).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

Reversibility: forward = low; backward = low. A second transport sits
beside OpenRouter's; every record names the path its calls took, so a run
can go back to OpenRouter by flag.

## Trial A: drafting 1 Thessalonians with `claude -p`

### Set-up

- Book: 1 Thessalonians, 31 titles to draft, committed record
  `data/drafts/en/1TH.json` (`5492170`, one OpenRouter run on 3 Nov).
- Prompt: the one that record was made with,
  `prompts/history/segment-titles-cc76a816652a.md` (SHA-256 `cc76a816…`, as
  in the record's `prompt`).
- Input: built by the repo's `segmentInputs` and `draftMessage`. The user
  message is byte-identical at `5492170` and at `c479756` (SHA-256
  `8c4a19ca…`, 13,131 characters, by the same script run on both trees).
- Drafter: `claude-sonnet-5-5`, the CLI's id for Sonnet 5.5 (its `modelUsage`
  names `claude-sonnet-5-5`, `canonicalModel` the same). Checker: the same
  `google/gemini-3.8-flash`, through the repo's `complete()` on OpenRouter.
- Command per draft call, run from an empty directory outside any
  repository, with the user message on stdin:

  ```
  CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1 claude -p --safe-mode --tools "" \
    --strict-mcp-config --model claude-sonnet-5-5 \
    --system-prompt "<draft part of the prompt>" --output-format json
  ```

  `--safe-mode` turns off CLAUDE.md files, skills, plugins, hooks and MCP
  servers; `--tools ""` removes every tool; the environment variable removes
  a server-side "advisor" tool that otherwise lets the model consult another
  model (without it the debug log says "Server-side tool enabled with
  claude-opus-5-5 as the advisor model"; with it, nothing).

- What reached the model, read from the CLI's own session file: the system
  prompt is our draft part byte for byte (SHA-256 of the sent text equals
  `promptPart(…, "draft")`), and the last user block is our input byte for
  byte (`8c4a19ca…`).

### Results

Counts made by `compare.py` (Python) and again by a separate `jq` program
over the same records; both gave every number below. "Pronoun titles"
counts titles with a standalone he, him, his, she, her, they, them, their,
we, us, our, you or your (the checker's most common complaint).

| Run                                 | Drafted by          | Disagree | Criteria            | Gate failures | `ai-checked` | Mean length | Max length | Same text as committed | Pronoun titles |
| ----------------------------------- | ------------------- | -------- | ------------------- | ------------- | ------------ | ----------- | ---------- | ---------------------- | -------------- |
| committed (3 Nov)                   | OpenRouter          | 1        | accurate 1, style 1 | 0             | 30           | 48.9        | 57         | 31                     | 12             |
| c1: the committed drafts, rechecked | (replayed, no call) | 11       | plain 10, style 1   | 0             | 20           | 48.9        | 57         | 31                     | 12             |
| o1                                  | OpenRouter          | 6        | plain 6             | 0             | 25           | 50.0        | 57         | 9                      | 11             |
| a1                                  | `claude -p`         | 9        | plain 9             | 0             | 22           | 48.5        | 56         | 5                      | 12             |
| a2                                  | `claude -p`         | 3        | plain 3             | 0             | 28           | 51.6        | 58         | 5                      | 7              |
| a3                                  | `claude -p`         | 4        | plain 4             | 0             | 27           | 49.4        | 56         | 7                      | 9              |

Titles with the same text, each pair of runs (Python and `jq`, which
agreed): OpenRouter with OpenRouter 9 (committed, o1); CLI with CLI 3, 5
and 6; OpenRouter with CLI 5, 5, 7, 5, 7 and 6.

What this shows, and what it does not:

- **The checker is the larger source of variation.** The same 31 committed
  drafts, sent again to the same checker with the same prompt and input
  (4,744 prompt tokens, as in the committed call), drew 11 disagreements
  instead of 1. Ten were `plain`, a pronoun with no antecedent; the committed
  check flagged none of the 12 pronoun titles. So the committed record's
  "1 disagreement" is one draw, not a baseline.
- **Every CLI number falls inside the OpenRouter spread.** Disagreements: CLI
  3 to 9, OpenRouter 1 to 11 (counting c1). Mean length: CLI 48.5 to 51.6,
  OpenRouter 48.9 to 50.0. Max length 56 to 58, all under the 60 limit; no
  gate failure in any run. Pronoun titles: CLI 7 to 12, OpenRouter 11 to 12.
- **Not shown:** that the CLI changes nothing. Three CLI runs and two
  OpenRouter drafts are too few to see a small shift: the one
  OpenRouter-to-OpenRouter pair shares 9 titles, above every pair that
  involves the CLI (at most 7). This is inference from one pair, not a
  measured difference.

### Calls

| Run       | Path       | Prompt tokens | Completion (reasoning) | Time   | Cost                                             | Id                                    |
| --------- | ---------- | ------------- | ---------------------- | ------ | ------------------------------------------------ | ------------------------------------- |
| committed | OpenRouter | 5,515         | 5,021 (4,148)          | 30.7 s | $0.061240 billed                                 | `gen-1793733641-n9cAAE8u5ljPELnx64nI` |
| o1        | OpenRouter | 5,515         | 3,999 (3,118)          | 26.2 s | $0.051020 billed                                 | `gen-1793911592-YxkNocLhIwX3H9Wkf9lM` |
| a1        | `claude`   | 6,829         | 3,965 (3,003)          | 27.6 s | none billed; CLI reports $0.063908 at list price | session `4f1c5a3a-…`                  |
| a2        | `claude`   | 6,829         | 5,891 (4,914)          | 36.4 s | none billed; CLI reports $0.059597 at list price | session `8fd64fb2-…`                  |
| a3        | `claude`   | 6,829         | 5,610 (4,740)          | 34.4 s | none billed; CLI reports $0.056787 at list price | session `7f66aa38-…`                  |

The CLI's prompt tokens are the sum of its `input_tokens`,
`cache_creation_input_tokens` and `cache_read_input_tokens` (2, 6,044 and 783
for a1; a2 and a3 read 6,827 from the CLI's own one-hour prompt cache).
6,829 − 5,515 = **1,314 tokens the CLI adds** to every call.

## Trial B: the third check with `codex exec`

### Set-up

- The 9 blind disputes on [dispute-review.md](dispute-review.md):
  Colossians 4, 1 Thessalonians 1, 2 Timothy 4, from the committed records.
- Same inputs as `scripts/translate/dispute-titles.ts` sends: the repo's
  `settleDisputes`, `prompts/dispute-titles.md` (`4ef5bbc9…`), the pinned ULT
  (`ult-col`, `ult-1th`, `ult-2ti`), and the Titus voice as each blind run
  read it (`data/drafts/en/TIT.json` at `0c91097`, `091e772f…`, for
  Colossians and 1 Thessalonians; at `c479756`, `c7d207ae…`, for 2 Timothy;
  [dispute-check.md](dispute-check.md#revised-step-measured-3-nov-2026)).
  The recheck is unchanged: the record's checker on OpenRouter.
- Model: **`gpt-6-sol`, not `gpt-6.1-sol`.** The OpenRouter runs used
  `openai/gpt-6.1-sol`; Codex on the ChatGPT account refuses it (Break 1).
  `gpt-6-sol` is the nearest model in the CLI's list (`gpt-6-astra`,
  `gpt-6-sol`, `gpt-reserve`, `gpt-6-luna`, `gpt-5.6-*`). So Trial B
  measures a different model as well as a different transport.
- Command, from an empty directory, with the user message on stdin:

  ```
  codex exec --skip-git-repo-check --ignore-user-config --ignore-rules \
    -s read-only -m gpt-6-sol --json \
    --disable multi_agent --disable shell_tool --disable apps \
    --disable plugins --disable image_generation --disable browser_use \
    --disable computer_use --disable in_app_browser --disable goals \
    --disable view_image --disable sleep_tool --disable tool_suggest \
    --disable skill_search --disable hooks \
    -c include_permissions_instructions=false \
    -c include_environment_context=false \
    -c include_apps_instructions=false \
    -c include_collaboration_mode_instructions=false \
    -c 'web_search="disabled"' -c project_doc_max_bytes=0 \
    -c 'developer_instructions="<dispute prompt>"' -
  ```

- What reached the model, read from Codex's session file: our prompt is the
  first developer block byte for byte (SHA-256 equals `disputePrompt(…)`),
  after Codex's own base instructions, and our input is the user message.

### Results

| Key         | OpenRouter (`gpt-6.1-sol`, 3 Nov) | Codex run 1 (`gpt-6-sol`) | Codex run 2 (`gpt-6-sol`) | Recheck: OpenRouter / run 1 / run 2 |
| ----------- | --------------------------------- | ------------------------- | ------------------------- | ----------------------------------- |
| COL.1.7-8   | taste                             | taste                     | taste                     | agree / agree / agree               |
| COL.1.11-12 | factual                           | factual                   | factual                   | agree / disagree / disagree         |
| COL.1.21-23 | factual                           | factual                   | factual                   | disagree / agree / agree            |
| COL.2.4-5   | taste                             | taste                     | taste                     | agree / agree / agree               |
| 1TH.4.13-15 | factual                           | factual                   | factual                   | disagree / disagree / disagree      |
| 2TI.2.3-5   | factual                           | factual                   | factual                   | agree / agree / agree               |
| 2TI.2.6-7   | factual                           | factual                   | factual                   | agree / disagree / agree            |
| 2TI.2.11-13 | factual                           | factual                   | factual                   | disagree / disagree / disagree      |
| 2TI.2.14-15 | factual                           | factual                   | factual                   | agree / disagree / agree            |

The titles:

| Key         | OpenRouter (`gpt-6.1-sol`)                                   | Codex run 1                                                 | Codex run 2                                                  |
| ----------- | ------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------ |
| COL.1.7-8   | Epaphras taught the Colossians and reported their love       | Epaphras taught and told Paul of the Colossians’ love       | Epaphras taught the Colossians and told Paul of their love   |
| COL.1.11-12 | Believers should endure and thank God for their inheritance  | God helps Colossians endure; they thank him for inheritance | Paul prays for joyful endurance and thanks for a share       |
| COL.1.21-23 | Christ reconciles enemies to be holy if they keep the faith  | Christ’s death makes former enemies holy if they keep faith | Christ’s death makes enemies holy if they hold gospel hope   |
| COL.2.4-5   | Paul warns believers of deceit and rejoices in their faith   | Paul warns of deceit and rejoices in the Colossians’ faith  | Paul warns of deceit and praises Colossians’ firm faith      |
| 1TH.4.13-15 | Believers hope: the dead join Jesus no later than the living | Believers grieve in hope; dead join Jesus, living not first | Believers grieve with hope; the dead come with Jesus first   |
| 2TI.2.3-5   | Timothy must suffer, avoid distractions and obey the rules   | Timothy must suffer, focus on Christ, and compete by rules  | Timothy must suffer, focus on Christ, and compete by rules   |
| 2TI.2.6-7   | Timothy must think about farmers’ reward; the Lord explains  | Timothy, think: farmers eat first; the Lord gives insight   | Timothy must note the farmer’s share; God gives insight      |
| 2TI.2.11-13 | Christ gives life and rule, denies deniers, stays faithful   | We die, live, endure, reign; he denies deniers, stays true  | We die, live, endure, reign, deny; Christ denies, stays true |
| 2TI.2.14-15 | Timothy must stop word fights and teach truth to please God  | Timothy must stop harmful word fights and teach truth well  | Timothy must warn against word fights and teach truth well   |

Counted by `disputes.py` (Python, reading the sheet's table and the run
records) and again by `jq`, `awk` and `comm` over the same files; both
gave every number below.

- **Kind: the same in all 9, in both Codex runs** (2 taste, 7
  factual, as on OpenRouter).
- **Titles: none of the 18 Codex titles is the OpenRouter title.** The two
  Codex runs share 1 of 9 (2TI.2.3-5). No OpenRouter rerun of the third
  check was made, so how much its titles vary between runs is not measured.
- **Recheck agreed:** OpenRouter 6 of 9, Codex run 1 4, run 2 6.
  `ai-checked` (taste, gates passed, recheck agreed): 2 in every run, the
  same two keys (COL.1.7-8, COL.2.4-5). No gate failure; longest title 59
  and 60 characters.
- **A tool stayed on.** In run 2 on 2 Timothy the model called a JavaScript
  `exec` tool 4 times, to count the characters of candidate titles, in 5
  model requests instead of 1 (65,732 input tokens). The OpenRouter model
  had no tool. None of the flags above removes it; disabling the
  `code_mode_host` feature makes it fail when called instead (the CLI's
  warning: "Code mode will fail closed"). The other 5 calls made one request and no
  tool call (from each call's Codex session file).

### Calls

| Book            | OpenRouter: prompt + completion (reasoning), time | Codex run 1                    | Codex run 2                                              | Added by Codex |
| --------------- | ------------------------------------------------- | ------------------------------ | -------------------------------------------------------- | -------------- |
| Colossians      | 2,246 + 1,712 (1,437), 43.5 s                     | 10,724 + 2,666 (2,392), 52.4 s | 10,724 + 2,859 (2,588), 54.7 s                           | 8,478          |
| 1 Thessalonians | 1,850 + 834 (759), 21.5 s                         | 10,328 + 2,401 (2,326), 48.0 s | 10,328 + 980 (907), 23.9 s                               | 8,478          |
| 2 Timothy       | 2,250 + 2,218 (1,941), 51.7 s                     | 10,728 + 4,549 (4,285), 86.4 s | 65,732 + 4,670 (4,039), 94.1 s, 5 requests, 4 tool calls | 8,478          |

## What each CLI adds, reports and costs

|                          | `claude -p` (2.1.318)                                                                                                                                                                                                                                                                                                             | `codex exec` (0.157.1)                                                                                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Added to our prompt      | a first system line, "You are a Claude agent, built on Anthropic's Claude Agent SDK."; a system-reminder with the signed-in account's email address; a block with the working directory, platform, shell, OS, the model's name and today's date. 1,314 tokens in all, measured.                                                   | Codex's base instructions (18,748 characters: "You are Codex, an agent based on GPT-6…", personality and writing style), a list of installed skills, a multi-agent role block. 8,478 tokens in all, measured. |
| Can it be removed?       | Mostly not. `--system-prompt` replaces the default prompt; `--safe-mode`, `--tools ""` and `CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` remove the rest that can go. `--bare` would remove more but needs an API key, not the subscription. `CLAUDE_CODE_DISABLE_ATTACHMENTS=1` changed nothing (1,335 tokens on a test call either way). | No. `base_instructions` is refused; `developer_instructions` adds ours beside it. The flags above cut a test call from 14,507 to 8,503 input tokens.                                                          |
| Generation settings      | adaptive thinking, effort `medium`, `max_tokens` 128,000 (the CLI's request, from its session file); no temperature. OpenRouter sends `temperature: 0`, `max_tokens` 16,384. What OpenRouter passes on for Sonnet's reasoning is not recorded (inference: reasoning was on, 4,148 tokens).                                        | default effort (`medium`, from the CLI's model list); no temperature, no `max_tokens`. What effort OpenRouter used for `gpt-6.1-sol` is not recorded.                                                         |
| Reported per call        | session id; model (`modelUsage` key, e.g. `claude-sonnet-5-5`); input, cache-write, cache-read, output and thinking tokens; `total_cost_usd` at list price (not billed); wall time and API time.                                                                                                                                  | thread id; input, cached input, output and reasoning tokens; no cost; the requested model (the served model is not echoed in `--json`); the session file adds a response id and the plan's rate-limit window. |
| Time per call (measured) | 27.6, 36.4 and 34.4 s for a 31-title draft; OpenRouter 26.2 and 30.7 s.                                                                                                                                                                                                                                                           | 48.0, 52.4 and 86.4 s (run 1), 23.9, 54.7 and 94.1 s (run 2); OpenRouter 21.5, 43.5 and 51.7 s for the same books.                                                                                            |
| Rate limits seen         | none in 3 draft calls and about 10 short test calls (one of which the model's safeguards refused: a request to echo its own context); the JSON result carries no rate-limit field.                                                                                                                                                | none hit; Codex reports a weekly window (10,080 minutes) with 10 % used before the first call and 11 % after the last, on a `pro` plan.                                                                       |

### How a record's `calls` entry would change

A sketch for the separate PR, if one is chosen; not built here.

- `via`: `openrouter`, `claude-cli` or `codex-cli`.
- `id`: OpenRouter's generation id, the Claude session id or the Codex
  thread id.
- `model`: as the path reports it. The two name the same model differently
  (`anthropic/claude-sonnet-5.5` against `claude-sonnet-5-5`), and `family()`
  reads the part before `/`, so the CLI's name needs the provider prefix.
- `promptTokens`: for the Claude CLI the sum of the three input counts, which
  includes the 1,314 added tokens; a `harnessTokens` field, or a note in the
  schema, keeps it comparable with OpenRouter calls.
- `cost`: `null` is "unknown" today and stops the fuse. A subscription call
  needs its own value (for example `cost: 0` with `billing: "subscription"`
  and the CLI's `listCost` kept beside it), and the fuse a rule for it.
- `ms`: wall time of the CLI process, as measured here.

## Spend

OpenRouter, this lane, all measured (billed `cost` per call, summed by a
Python script and again by `jq` over the run records): **$0.315362** in 12
calls, under the lane's $0.50 cap. o1's draft $0.051020; checks a1
$0.038093, a2 $0.019523, a3 $0.022478, o1 $0.067457, c1 $0.034743; rechecks
(1 Thessalonians, Colossians, 2 Timothy) run 1 $0.002367, $0.033392,
$0.018464 and run 2 $0.005085, $0.009577, $0.013166. The key's total usage
is shared with the English run going on at the same time, so it was not used
to measure this lane.

Claude subscription: 3 draft calls, about 10 short test calls; the CLI's
list-price figure for the three drafts is $0.180291 (not billed). Codex
subscription: 6 third-check calls and 5 short test calls; no cost
reported.

## Recommendation

1. **Claude CLI for translation: possible, after a person settles the terms
   (question 1) and with one more measured book.** The prompt and input
   arrive unchanged, and the drafts' numbers sit inside OpenRouter's own
   spread. But the CLI adds 1,314 tokens of its own that include the
   account's email address and the date, runs at a different effort and
   temperature, and reports no billed cost. Before a whole translation run,
   translate one book both ways (OpenRouter and the CLI, same prompt) and
   check both with the same checker; that, not this drafting trial, is the
   measure for translation.
2. **Codex for the third check: no, for now.** It cannot run the model the
   third check was measured with, so a switch is a change of third model, a
   decision in its own right after #207's person check. The third check's
   whole spend is small: $0.016 to $0.058 a book on 3 Nov
   ([dispute-check.md](dispute-check.md#revised-step-measured-3-nov-2026)).
3. **Keep OpenRouter as the default** and every record's calls on one path
   per run, so a book's numbers come from one measured set-up (ADR 0008's
   reason, applied to each later run).

## Open questions for a person

1. **Terms.** Do the organization's Claude and ChatGPT subscriptions allow
   batch data generation through the CLIs: tens of thousands of titles, in
   scripted runs, for an openly licensed dataset? Not settled by
   measurement.
2. **The AGENTS.md rule.** It says "Nobody runs codex or grok locally". The
   rule is about review. If codex is ever used to generate, the rule needs
   wording that keeps review on the bench and cannot be read as allowing
   local review, for example: "Nobody runs codex or grok locally to review
   code; review is the bench's. A runner may call a model CLI to generate
   data when a decision records it."
3. **The account email.** The Claude CLI sends the signed-in account's
   email address to the model on every call. Is that acceptable for batch
   runs, or should runs use a service account?
4. **Rate limits for a whole-Bible job.** Not reached here. Measuring needs a
   longer run (one large book) on the subscription, which spends the
   subscription's allowance.

## Where the runs are

Throwaway, under `.cache/l251/` in the lane's worktree, not committed:
`trial-a.ts` and `trial-b.ts` (the transports), `compare.py`, `pairs.py`
and `disputes.py` (the counts); one directory per run (`a1`–`a3`, `o1`,
`c1`, `b1-<BOOK>`, `b2-<BOOK>`) with its `run.json` ledger, record, and the
CLI's raw output.
