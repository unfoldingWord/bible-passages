# Sizing

Every number is labelled **measured** (source, commit, method) or
**estimated** (method, and what would measure it). See AGENTS.md, "Measure
before you estimate or object".

## Base counts

| Count                                                 | Value  | Label               | Source and method                                                                                                                                                                                                   |
| ----------------------------------------------------- | ------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BSB section headings (`\s1`)                          | 3,016  | measured 2026-10-28 | `git.door43.org/Worldview/en_bsb` at `7abbfafa`; lines starting `\s1` across 66 book files                                                                                                                          |
| BSB subheadings (`\s2`)                               | 80     | measured 2026-10-28 | same files, lines starting `\s2`; not pericope starts in the current plan                                                                                                                                           |
| UFW chunks                                            | 13,608 | measured 2026-10-28 | `git.door43.org/Door43-Catalog/versification` at `af14923`; sum of `first_verses` over `bible/ufw/chunks/*.json` (66 books)                                                                                         |
| Chunks a BSB pericope starts inside                   | 162    | measured 2026-10-28 | BSB `\s1` starts strictly after a chunk's first verse and before the next chunk's. In the 34 Psalms chapters with no `\v 1`, a heading before the first verse starts at verse 1; without that rule the count is 194 |
| Pilot chunks (JON, TIT, 3JN)                          | 51     | measured 2026-10-28 | same chunk files: 22 + 24 + 5                                                                                                                                                                                       |
| Places where ULT `\ts\*` and the chunk files disagree | 1,184  | measured 2026-10-28 | `unfoldingWord/en_ult` at `04e15203`, tC 4.0's section rule; list in [ts-vs-ufw.tsv](ts-vs-ufw.tsv)                                                                                                                 |
| Splits if ULT `\ts\*` is the chunk source             | 165    | measured 2026-10-28 | same BSB starts against tC 4.0's sections on `en_ult` at `04e15203`                                                                                                                                                 |
| Pericopes that are exactly one segment                | 263    | measured 2026-10-28 | pericopes whose span holds one segment (UFW chunks plus splits)                                                                                                                                                     |

Headings, chunks and pilot segments match the requirements owner's build plan
(3,016; 13,608; 52 = 51 chunks + 1 split). Splits do not: the plan has 194,
which is what a parse gives without the Psalms verse-1 rule.

Every count above was re-derived independently (a second model, its own
code, the same pinned sources) on 2026-10-28 and matched.

## Derived counts

ULT has 13,575 `\ts\*` markers across the 66 books (`en_ult` at `04e15203`,
counted with `grep -o`; recounted 2026-10-28, two files checked byte for byte
against the pinned commit). By tC 4.0's rule they give 13,548 sections.

These use the UFW chunk files. With ULT's `\ts\*` markers as the source
(schema.md, decision 8) they become 13,713 segments (13,548 sections plus 165 splits) and 16,729 English
titles.

263 pericopes are exactly one segment, so their pericope title and segment
title describe the same verses. Drafting both is a choice to make (deduped:
16,523 English titles); the counts below draft both.

| Count                                                                                      | Value                | Label                 | Method                               |
| ------------------------------------------------------------------------------------------ | -------------------- | --------------------- | ------------------------------------ |
| Segments                                                                                   | 13,770               | derived from measured | 13,608 chunks + 162 splits           |
| English titles                                                                             | 16,786               | derived from measured | 3,016 pericopes + 13,770 segments    |
| Title strings, 10 Resource Level 4 languages (incl. English)                               | 167,860              | derived from measured | 16,786 × 10                          |
| Translated strings for v0.1                                                                | 151,074              | derived from measured | 16,786 × 9 languages besides English |
| Title strings, 26 languages (RL 3 and 4; the 26 listed in the build plan's language table) | 436,436              | derived from measured | 16,786 × 26                          |
| Evocative alternates, if translated                                                        | +13,770 per language | derived from measured | one per segment                      |

## Measured: English segment titles, Philippians (#32)

One run of `scripts/translate/segment-titles.ts` on 2026-10-29: Claude
Sonnet (`anthropic/claude-sonnet-5.5`) drafted, Gemini Flash
(`google/gemini-3.8-flash`) checked, one call each, through OpenRouter.
Ledger: `calls` in `data/drafts/en/PHP.json`. Derived twice, from the
record with `jq` and from the run's own `run.json` with Python; both gave
the numbers below.

| Quantity                     | Value                                     | Label               | Source and method                                                                                                     |
| ---------------------------- | ----------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Segments drafted             | 37 of 39                                  | measured 2026-10-29 | the 2 others are their pericope's only segment and reuse its title (decision 12)                                      |
| Cost                         | $0.0771 ($0.0241 draft, $0.0531 check)    | measured 2026-10-29 | OpenRouter's billed `cost` per call                                                                                   |
| Cost per drafted title       | $0.0021                                   | measured 2026-10-29 | $0.0771 / 37                                                                                                          |
| Tokens                       | 25,978 (11,769 prompt, 14,209 completion) | measured 2026-10-29 | 11,297 of the completion tokens are the checker's reasoning                                                           |
| Model time                   | 65.7 s (8.1 s draft, 57.5 s check)        | measured 2026-10-29 | `ms` per call, summed; the calls run one after the other                                                              |
| Titles per hour (model time) | about 2,000                               | measured 2026-10-29 | 37 / 65.7 s; excludes the person's review                                                                             |
| Checker agreed               | 23 of 37 (`ai-checked`)                   | measured 2026-10-29 | 14 disagreements: 11 `style`, all over 60 characters, and 3 `plain`, an unclear "them" or "this view"                 |
| Drafts over 60 characters    | 11 of 37 (longest 78)                     | measured 2026-10-29 | the `length` gate; every one also disputed by the checker                                                             |
| Drafting cost, all 66 books  | about $28                                 | estimated           | 13,507 drafted titles (13,770 segments − 263 single-segment pericopes) × $0.0021; replaced by the #208 estimate below |

Review minutes per title: not yet measured; a person reviews every
Philippians title next (#32).

## Measured: English segment-title length, Colossians, revised prompt (#197)

The drafting part of `prompts/segment-titles.md` was changed so drafts stay
within 60 characters. It now says how to stay short, gives eight Titus titles
with their lengths as examples, and asks for a count before the reply. The
check part was not changed. The Philippians version is kept as
`prompts/history/segment-titles-f132f2195f80.md`.

Colossians was the test book. It had not been drafted, and of the books not
yet drafted it is closest to Philippians: a short letter of Paul to a church,
with 33 titles to draft against Philippians' 37, and a long name for its
readers ("the Colossians") that pushes against the limit. The command was run
twice on 2026-11-03 with the same models as Philippians, with prompt SHA-256
`cc76a816…`:

```
node scripts/translate/segment-titles.ts --book COL \
  --draft-model anthropic/claude-sonnet-5.5 \
  --check-model google/gemini-3.8-flash --max-cost 0.20
```

Both runs stopped at the check. The checker's reply was cut off at the
16,384-token limit in `scripts/lib/openrouter.ts`, so it could not be read
(#201). The drafts were kept in each run's `run.json` (`draftTitles`). The
numbers below come from those ledgers and were counted twice: with Python
`len()` and with `jq` `length`, which gave the same results.

| Quantity                  | Run 1                                     | Run 2                                     | Label               | Source and method                                                     |
| ------------------------- | ----------------------------------------- | ----------------------------------------- | ------------------- | --------------------------------------------------------------------- |
| Drafts over 60 characters | 0 of 33 (longest 58, mean 51.7)           | 0 of 33 (longest 58, mean 52.7)           | measured 2026-11-03 | `draftTitles`; Philippians was 11 of 37, longest 78, mean 58.7        |
| Checker agreed            | not measured                              | not measured                              | —                   | the check reply was cut off at the token limit (#201)                 |
| Cost                      | $0.1351 ($0.0699 draft, $0.0652 check)    | $0.1465 ($0.0813 draft, $0.0652 check)    | measured 2026-11-03 | OpenRouter's billed `cost` per call                                   |
| Tokens                    | 33,054 (10,853 prompt, 22,201 completion) | 34,189 (10,852 prompt, 23,337 completion) | measured 2026-11-03 | reasoning in the completion: draft 4,900 and 6,034, check 15,729 each |
| Model time                | 161.5 s (39.0 s draft, 122.6 s check)     | 120.1 s (45.4 s draft, 74.6 s check)      | measured 2026-11-03 | `ms` per call, summed                                                 |

Result against #197's target (at most 5% over 60): met in both runs on this
one book, 0 of 33 each.

Drafting cost went up. The Philippians draft call reported no reasoning
tokens and cost $0.0241 (8.1 s). With the revised prompt, the Colossians draft
calls reasoned (4,900 and 6,034 tokens) and cost $0.0699 and $0.0813 (39 to
45 s), about $0.0021 to $0.0025 per title for the draft alone. Inference, not
tested: the request to count characters before replying is what led the model
to reason. A whole-run cost per title needs a check that completes (#201).
The two runs together cost $0.2815.

## Measured: the segment-title check for a whole book (#201)

The two Colossians runs above stopped because the check reply was cut off.
Five more Colossians checks were run on 2026-11-03 to find out why and to
choose a fix, with the same models and prompt (SHA-256 `cc76a816…`). Every
number comes from OpenRouter's `usage` block (tokens, billed `cost`) as the
ledger or the experiment's output file recorded it.

How each was run. A and D used the CLI below, from this branch's working
tree before its first commit (A with batches of at most 12 and the old limit, D with
an 8,192-token reasoning budget, a lever later dropped). B and C were
one-off scripts, not committed: one whole-book check call through
`complete()` in `scripts/lib/openrouter.ts`, with the `check` part of the
prompt and `checkMessage()` on run A's 33 drafts. E ran
`draftSegmentTitles()` as committed, with D's paid-for draft replayed from
D's ledger (no second draft call) and a real check call.

```
node scripts/translate/segment-titles.ts --book COL \
  --draft-model anthropic/claude-sonnet-5.5 \
  --check-model google/gemini-3.8-flash --max-cost 0.20
```

| Check                                        | Titles per call | Completion limit | Reasoning            | Reply tokens  | Readable | Cost                                |
| -------------------------------------------- | --------------- | ---------------- | -------------------- | ------------- | -------- | ----------------------------------- |
| earlier runs 1 and 2 (above)                 | 33              | 16,384           | 15,729 each          | 651 each      | no       | $0.0652 each                        |
| A, three batches                             | 11, 11, 11      | 16,384           | 15,727; 2,625; 8,365 | 539; 339; 393 | yes      | $0.1095 ($0.0625, $0.0126, $0.0343) |
| B, whole book, reasoning budget 8,192 asked  | 33              | 16,384           | 10,336               | 1,240         | yes      | $0.0472                             |
| C, whole book, no budget                     | 33              | 32,768           | 17,252               | 1,261         | yes      | $0.0718                             |
| D, first batch, reasoning budget 8,192 asked | 17              | 16,384           | 16,394               | 0             | no       | $0.0636                             |
| E, whole book (one batch of 35 or fewer)     | 33              | 32,768           | 24,806               | 1,378         | yes      | $0.1019                             |

All labelled measured 2026-11-03. Reply tokens are completion minus
reasoning. Generation ids are in each ledger (`.cache/`, not committed);
E's check is `gen-1793728977-y7Is5ripR9yJlSULzI0p`.

What this shows:

- **The cut-off was the limit, not a broken reply.** Given 32,768 tokens,
  the same whole-book check finished: 17,252 and 24,806 reasoning tokens
  (C, E), both above the 16,384 limit. Under 16,384 Gemini Flash stopped
  reasoning at 15,727 to 15,729 tokens in three calls, about 96% of the
  limit, which left about 650 tokens for 33 verdicts (inference from the
  counts: the reasoning stopped at the same point whatever the titles).
- **A reasoning budget does not hold for this model.** 8,192 asked gave
  10,336 once (B) and 16,394, the whole limit with no reply, once (D).
  OpenRouter's reasoning documentation says Gemini 3 maps a budget to a
  thinking level and does not guarantee it. So it was not used.
- **Smaller batches do not reason less.** One batch of 11 titles reasoned
  to the limit (A), as the whole book had. Batches are for the reply, which
  grows with the titles (38 to 42 tokens per title in B, C and E); the
  longest book, Psalms, has 1,134 titles to draft (measured with `jq`
  over `data/structure/`, segments less single-segment pericopes; the 66
  books sum to 13,507, as above).
- **Run-to-run spread is wide.** Two whole-book checks of 33 titles
  reasoned 17,252 and 24,806 tokens (C and E, on different drafts). E used 80% of the 32,768
  limit, as Philippians used 80% of 16,384 before Colossians went over.
  Watch item: if a check is cut off again, the next step is the model's own
  limit (65,536, from OpenRouter's model list on 2026-11-03).

The fix: each check call gets 32,768 tokens (`CHECK_MAX_TOKENS`) and judges
at most 35 titles (`CHECK_BATCH`), in reading order, split as evenly as
possible. The check prompt and criteria did not change. Drafting still has
16,384.

| Quantity                             | Value                                                    | Label               | Source and method                                                                                                                                           |
| ------------------------------------ | -------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| COL check readable with the fix      | yes, 33 of 33 verdicts read                              | measured 2026-11-03 | E: outcome `done`, no title without a check                                                                                                                 |
| COL check tokens and cost (E)        | 31,180 (4,996 prompt, 26,184 completion), $0.1019, 188 s | measured 2026-11-03 | E's ledger                                                                                                                                                  |
| COL run cost with the fix            | $0.1768 ($0.0748 draft, $0.1019 check)                   | measured 2026-11-03 | D's draft call plus E's check call                                                                                                                          |
| Checker agreed (E)                   | 22 of 33 (`ai-checked`)                                  | measured 2026-11-03 | 11 disagreements, all `plain`; counted with Python from the record and listed with `jq`                                                                     |
| Checker agreed (A, other drafts)     | 26 of 33                                                 | measured 2026-11-03 | 7 disagreements: 6 `plain`, 1 `accurate`; the same two ways                                                                                                 |
| Checker agreed (B and C, A's drafts) | 26 of 33 each, the same 33 verdicts                      | measured 2026-11-03 | 6 `plain`, 1 `style` each; 31 of 33 verdicts match A's batched check (joined by key with `join`)                                                            |
| Gate failures (A and E)              | 0 of 33 each (longest 58 characters)                     | measured 2026-11-03 | the records' `gates`                                                                                                                                        |
| Check cost per title, one book       | $0.0014 to $0.0031                                       | measured 2026-11-03 | B, C, E: $0.0472 to $0.1019 over 33 titles                                                                                                                  |
| Check cost, all 66 books             | about $19 to $42                                         | estimated           | 13,507 drafted titles × the per-title range; assumes a batch of 35 costs what a 33-title check did. A long book run in full batches would measure it.       |
| Spend on these runs                  | $0.5367                                                  | measured 2026-11-03 | A $0.1774 (draft $0.0679, checks $0.1095), B $0.0472, C $0.0718, D $0.1384 (draft $0.0748, check $0.0636), E $0.1019; the earlier runs 1 and 2 not included |

Why Colossians reasoned more than Philippians is not measured. Of the
Colossians disagreements, all were `plain` in E, and all but one in A
(`accurate`), B and C (`style` each): a "them", "they" or "you" with no one
named (for example "Epaphras taught them and told
Paul of their love"). None was `covers`. Inference, not tested: the revised
drafting prompt's push to stay short (rule 6) meets rule 5 and the check's
`plain` criterion, and the checker spends its reasoning on whether each
pronoun is clear. Philippians, drafted with the earlier prompt, had 3 `plain`
disputes in 37.

The draft call was left as one call per book under 16,384 tokens here; it
is batched in #208, below.

## Measured: drafting a book in batches (#208)

One draft call per book will not fit the longest books: a whole Colossians
draft used 5,622 to 6,311 completion tokens for 33 titles (above), and
Genesis has 642 titles to draft, Psalms 1,134. Estimated, not measured: at
about 27 reply tokens per title, Genesis's reply alone would be about
17,000 tokens, past the 16,384 limit before any reasoning.

The fix: each draft call titles at most 35 segments (`DRAFT_BATCH`), in
reading order, split as evenly as possible (`batches()`, as the check is),
still under `MAX_TOKENS` (16,384). The prompt did not change (SHA-256
`cc76a816…`). Each batch's user message is the same JSON as before, for
its own segments only: each segment's verses and its pericope heading. The
spend fuse runs before every draft and check call, an unreadable draft
reply stops the run, and a check is refused when its answering model, or
its family, answered the draft call of any title in its batch. Each title's
`source` names the model that answered its own draft call.

Why 35: it is the size of the whole-book drafts measured so far, which used
at most 6,311 of 16,384 completion tokens (39%) for 33 titles (Colossians)
and fitted 37 (Philippians). Over the 66 books it gives 420 draft calls,
mean 32.2 titles; 49 books need more than one (measured with Python over
`data/structure/` on 2026-11-03: titles to draft are segments less
single-segment pericopes, 13,507 in all, the same total as `jq` gave above).

### The live run

To exercise several batches live for little money, Colossians was drafted
with batches forced to 11 (`--draft-batch 11`, three batches of 11), not a
long book. A long book (Genesis, 19 batches) would cost about $0.90 to $1.60
to draft (estimated from the per-title range below) and was over this
work's budget. Run on 2026-11-03 from this branch:

```
node scripts/translate/segment-titles.ts --book COL \
  --draft-model anthropic/claude-sonnet-5.5 \
  --check-model google/gemini-3.8-flash --max-cost 0.35 --draft-batch 11
```

Outcome `done`: 33 of 33 drafted and checked, 29 `ai-checked`, 4
disagreements (all `plain`, one also `style`), 0 gate failures, longest
draft 58 characters (mean 52.7). Each call, from the run's ledger (read
with `jq` and again with Python; both gave these numbers):

| Call    | Generation id                         | Titles | Prompt | Completion | Reasoning | Reply | Cost    | Time   |
| ------- | ------------------------------------- | ------ | ------ | ---------- | --------- | ----- | ------- | ------ |
| draft 1 | `gen-1793731799-OgGmgzaRmdQgtzP5eRIb` | 11     | 2,460  | 2,329      | 2,017     | 312   | $0.0282 | 16.4 s |
| draft 2 | `gen-1793731815-IGH2pLfZItz1P4ZRtj69` | 11     | 2,538  | 2,008      | 1,712     | 296   | $0.0252 | 15.1 s |
| draft 3 | `gen-1793731830-nV4BySfGX3me1MhjnABn` | 11     | 2,487  | 2,024      | 1,693     | 331   | $0.0252 | 14.4 s |
| check   | `gen-1793731845-Wmt5DB469Ox02CTz0xPy` | 33     | 4,998  | 10,268     | 9,204     | 1,064 | $0.0423 | 52.8 s |
| total   |                                       |        | 12,483 | 16,629     | 14,626    |       | $0.1208 | 98.7 s |

All labelled measured 2026-11-03. Reply tokens are completion minus
reasoning. The drafting part: $0.0786, 45.9 s, 939 reply tokens (28.5 per
title). The run's spend, $0.1208, is all the OpenRouter spend of #208.

For comparison, a whole-book Colossians draft from the same prompt and
models on the same day (the #209 run, one call,
`gen-1793731365-pEHzq2yksb32aGBNTBy9`): 5,853 prompt and 3,578 completion
tokens (2,668 reasoning, 910 reply, 27.6 per title), $0.0475, 26.5 s.
Batches of 11 cost more than that one call, as each call repeats the
system prompt (about 800 tokens, inferred from the prompt tokens: 22 more
titles added 3,358) and each reasoned 1,693 to 2,017 tokens. They stayed
within the four other whole-book drafts above ($0.0679 to $0.0813).

### Does a batch boundary need neighbouring context?

Not on this evidence, so none was added and the prompt is unchanged. The
two boundaries fell after 1:28–29 (between pericopes) and after 3:5–8
(inside the pericope 3:1–17). Read side by side with the whole-book draft:

- no title repeats or contradicts the one across a boundary (3:5–8 "put
  away evil desires, anger and slander", 3:9–11 "must not lie; Christ is in
  all"; 1:28–29 "Paul teaches everyone", 2:1–3 "Paul struggles for the
  Colossians");
- none of the 4 disagreements is on a title next to a boundary (1:7–8,
  2:4–5, 4:12–14, 4:18), against 4 in the whole-book run (1:7–8, 1:11–12,
  1:21–23, 2:4–5);
- who is named stays the same across batches ("believers", "the
  Colossians", "Paul" in every batch); the batched drafts use "us" or
  "you" in no title, where the whole-book one did twice (1:13–14, 1:21–23).

Watch item, untested beyond one short book and one run: a long narrative
book, where a batch boundary can fall inside a story, may need the last
title of the batch before. The first long book drafted is where to look.

### Whole-Bible drafting, re-derived

| Quantity                        | Value                                      | Label     | Method                                                                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Draft cost per title            | $0.0014 to $0.0025                         | measured  | Colossians, prompt `cc76a816…`, six drafts on 2026-11-03: $0.0475 (#209), $0.0679 (A), $0.0699 and $0.0813 (#197 runs 1 and 2), $0.0748 (D), $0.0786 (three batches of 11), each over 33 titles                                    |
| Drafting cost, all 66 books     | about $19 to $33                           | estimated | 13,507 titles × the per-title range. Production batches average 32.2 titles, the size measured; batches of 11 fell inside the range, so smaller batches are not assumed to cost more. One long book in full batches would test it. |
| Drafting model time, all books  | about 3 to 5 hours, one call after another | estimated | 13,507 titles × 0.80 to 1.39 s per title (26.5 to 45.9 s over 33 in the runs above)                                                                                                                                                |
| Draft completion, largest batch | 6,311 of 16,384 tokens (39%) for 33 titles | measured  | #197 run 2 (above); the batches of 11 used at most 2,329 (14%)                                                                                                                                                                     |

This replaces the Philippians estimate of about $28 (above), which used a
draft that did not reason. With the check estimate (#201, about $19 to
$42), drafting and checking the English titles is about $38 to $75
(estimated, the two ranges added).

## Not measured yet

| Quantity                                         | Why it matters                       | How it gets measured                                       |
| ------------------------------------------------ | ------------------------------------ | ---------------------------------------------------------- |
| Translation cost and time per title per language | 151,074 strings for v0.1             | the same book, translated into each v0.1 language          |
| Review minutes per title                         | the human-hours on the critical path | timed review of the first book's titles by a real reviewer |

Measured re-runs replace these rows; the estimate they replace stays in git
history.
