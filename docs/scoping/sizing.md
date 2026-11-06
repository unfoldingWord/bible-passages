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
still under `MAX_TOKENS` (16,384). #208 does not change the prompt; it was
measured with the prompt of the time (SHA-256 `cc76a816…`), which #209 has
since changed (below). Each batch's user message is the same JSON as before, for
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

For comparison, the committed whole-book Colossians draft from the same
prompt and models on the same day (#212, below, one call,
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

| Quantity                        | Value                                      | Label     | Method                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Draft cost per title            | $0.0014 to $0.0025                         | measured  | Colossians, six drafts with prompt `cc76a816…` on 2026-11-03: $0.0475 (#212), $0.0679 (A), $0.0699 and $0.0813 (#197 runs 1 and 2), $0.0748 (D), $0.0786 (three batches of 11); two with prompt `838516080c8f…`: $0.0627 and $0.0764 (#209, below); and two with prompt `e3e08e032d32…`: $0.0558 and $0.0661 (#220, below); each over 33 titles |
| Drafting cost, all 66 books     | about $19 to $33                           | estimated | 13,507 titles × the per-title range. Production batches average 32.2 titles, the size measured; batches of 11 fell inside the range, so smaller batches are not assumed to cost more. One long book in full batches would test it.                                                                                                              |
| Drafting model time, all books  | about 3 to 5 hours, one call after another | estimated | 13,507 titles × 0.80 to 1.39 s per title (26.5 to 45.9 s over 33 in the runs above)                                                                                                                                                                                                                                                             |
| Draft completion, largest batch | 6,311 of 16,384 tokens (39%) for 33 titles | measured  | #197 run 2 (above); the batches of 11 used at most 2,329 (14%)                                                                                                                                                                                                                                                                                  |

This replaces the Philippians estimate of about $28 (above), which used a
draft that did not reason. With the check estimate (#201, about $19 to
$42), drafting and checking the English titles is about $38 to $75
(estimated, the two ranges added).

## Measured: English segment titles, Colossians, committed run (#209)

One plain run of the CLI on 2026-11-03 (18:42:44 to 18:44:11 UTC), with the
code at `e31447a` (the batched check of #201, the prompt of #197, SHA-256
`cc76a816…`) and the same models as Philippians. The record was copied
unchanged to `data/drafts/en/COL.json` (`cmp` with the run's `en/COL.json`
reported no difference). Its ledger is `calls` in that file.

```
node scripts/translate/segment-titles.ts --book COL \
  --draft-model anthropic/claude-sonnet-5.5 \
  --check-model google/gemini-3.8-flash --max-cost 0.30
```

The runner exited 0: 33 of 33 segments drafted, 3 reusing their pericope
title, 29 `ai-checked`, 4 disagreements, 0 gate failures. The numbers below
were counted twice from the record, with `jq` and with Python, which gave the
same results.

| Quantity                     | Value                                     | Label               | Source and method                                                                                  |
| ---------------------------- | ----------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------- |
| Segments drafted             | 33 of 36                                  | measured 2026-11-03 | the 3 others (`COL.1.1-2`, `COL.3.18-21`, `COL.3.22-25`) are their pericope's only segment         |
| Calls                        | 1 draft, 1 check (one batch of 33)        | measured 2026-11-03 | `calls`; draft `gen-1793731365-pEHzq2yksb32aGBNTBy9`, check `gen-1793731391-2eNrQPnyWQrup8RmglCe`  |
| Cost                         | $0.0761 ($0.0475 draft, $0.0286 check)    | measured 2026-11-03 | OpenRouter's billed `cost` per call                                                                |
| Cost per drafted title       | $0.0023                                   | measured 2026-11-03 | $0.0761 / 33                                                                                       |
| Tokens                       | 21,052 (10,847 prompt, 10,205 completion) | measured 2026-11-03 | draft 5,853 + 3,578 (2,668 reasoning); check 4,994 + 6,627 (5,592 reasoning)                       |
| Model time                   | 86.1 s (26.5 s draft, 59.7 s check)       | measured 2026-11-03 | `ms` per call, summed                                                                              |
| Checker agreed               | 29 of 33 (`ai-checked`)                   | measured 2026-11-03 | 4 disagreements, all `plain`; none `accurate`, `covers` or `style`                                 |
| Drafts over 60 characters    | 0 of 33 (longest 59, mean 51.2)           | measured 2026-11-03 | the `length` gate and `text` lengths                                                               |
| Titles in the tC Mobile file | 29 of 36 segments                         | measured 2026-11-03 | `npm run build`: the 4 disputed drafts and the 3 reused pericope titles are `unreviewed`, left out |

The 4 disagreements stay `unreviewed`, as the checker left them. The third
check (ADR 0005 item 6, #203) was not run on Colossians: #207 holds third-check
data until rewrites keep their meaning and agreement is measured blind, and
Colossians is the planned blind test book.

This check reasoned far less than the #201 runs on Colossians (5,592 tokens
against 15,727 to 24,806) and agreed more (29 of 33 against 22 to 26 of 33),
on different drafts. Why is not measured; with the run-to-run spread seen in
#201, one run does not show a trend.

## Measured: naming the readers in the draft prompt, Colossians (#209)

On 3 Nov the maintainer chose to change the drafting prompt so titles name
who a passage addresses, rather than leave unclear pronouns to the third
check. Rule 5 of the draft part of `prompts/segment-titles.md` now says
"them", "they", "their" and "you" are never clear in a title read alone,
and gives short names that fit within 60 ("believers", "the church", "the
Colossians", "wives", "slaves", "masters" and others); rule 6 says to drop a
detail, never the name; the closing step adds a pronoun pass. The check part
did not change. The version the committed Colossians record was made with
is kept as `prompts/history/segment-titles-cc76a816652a.md`.

Colossians was re-drafted twice on 2026-11-03 (19:16:47 to 19:19:13 UTC)
with the new prompt (SHA-256 `838516080c8f…`), the code at `361fb5a` and
the same models as the committed run. Neither record was committed:
`data/drafts/en/COL.json` stays as #212 committed it.

```
node scripts/translate/segment-titles.ts --book COL \
  --draft-model anthropic/claude-sonnet-5.5 \
  --check-model google/gemini-3.8-flash --max-cost 0.30 \
  --out .cache/segment-titles/l209b-run<1|2>
```

Both runs exited 0. The numbers were counted twice from each record, with
`jq` and with Python, which gave the same results. "Pronoun drafts" counts
titles matching `\b(them|they|their|you|your)\b`, ignoring case, whatever
the checker said.

| Quantity                     | Committed run (#212, `cc76a816…`)      | New prompt, run 1                         | New prompt, run 2                         | Label               |
| ---------------------------- | -------------------------------------- | ----------------------------------------- | ----------------------------------------- | ------------------- |
| Checker agreed               | 29 of 33                               | 33 of 33                                  | 32 of 33                                  | measured 2026-11-03 |
| `plain` disagreements        | 4                                      | 0                                         | 1                                         | measured 2026-11-03 |
| Disputes over a pronoun      | 4 ("them" 2, "you" 1, "their" 1)       | 0                                         | 0                                         | measured 2026-11-03 |
| Pronoun drafts               | 7 of 33                                | 0 of 33                                   | 0 of 33                                   | measured 2026-11-03 |
| Drafts over 60 characters    | 0 of 33 (longest 59, mean 51.2)        | 0 of 33 (longest 59, mean 51.3)           | 0 of 33 (longest 59, mean 50.8)           | measured 2026-11-03 |
| Titles naming "believers"    | 15                                     | 20                                        | 16                                        | measured 2026-11-03 |
| Titles naming the Colossians | 4                                      | 7                                         | 10                                        | measured 2026-11-03 |
| Cost                         | $0.0761 ($0.0475 draft, $0.0286 check) | $0.0852 ($0.0627 draft, $0.0225 check)    | $0.1039 ($0.0764 draft, $0.0276 check)    | measured 2026-11-03 |
| Cost per drafted title       | $0.0023                                | $0.0026                                   | $0.0031                                   | measured 2026-11-03 |
| Tokens                       | 21,052                                 | 21,084 (11,018 prompt, 10,066 completion) | 23,801 (11,019 prompt, 12,782 completion) | measured 2026-11-03 |
| Reasoning tokens             | draft 2,668, check 5,592               | draft 4,156, check 4,160                  | draft 5,507, check 5,462                  | measured 2026-11-03 |
| Model time                   | 86.1 s                                 | 59.7 s (34.2 s draft, 25.5 s check)       | 79.0 s (38.8 s draft, 40.2 s check)       | measured 2026-11-03 |

Generation ids: run 1 draft `gen-1793733408-vxKmt3euTPRDqKYrESHx`, check
`gen-1793733442-dAuM9rHN5gK2Vgbo06Zl`; run 2 draft
`gen-1793733474-Npg9t9EIWrbHVYHuXPsj`, check
`gen-1793733513-60JJ38Z0SycLjZ6CtCFN`. The two runs cost $0.1892 together.

Run 2's one disagreement is not about a pronoun: "Epaphras prays for
believers; Luke and Demas send greetings" (`COL.4.12-14`) was flagged
`plain` because, in the checker's words, "greet" needs an object; the title
it judged reads "send greetings", so the checker may have misread it
(inference, not tested). Each of the 4 titles disputed in the committed run
now names its people in both runs (for example `COL.1.7-8`, "Epaphras taught
the Colossians the gospel").

What this shows, on one book and two runs: the new rule removed every
unclear pronoun from the drafts (7 of 33 to 0 of 33, twice) and every
pronoun dispute, with no title over 60, so rule 5 and rule 6 did not
collide here. Drafting cost more ($0.0627 and $0.0764 against $0.0475; the
draft reasoned 4,156 and 5,507 tokens against 2,668), and the prompt grew
by 177 tokens per call; with the spread seen in #201 (draft calls of
$0.0679 to $0.0813 on the earlier prompt), whether the new rule raises the
draft cost is not shown. Watch item, not measured: "believers" now names
16 to 20 of 33 titles, so a list may read as repetitive; a person's review
of a book drafted this way would show whether that matters.

## Measured: the draft prompt after #216's review, Colossians (#220)

The review of #216 found three things in the draft part of
`prompts/segment-titles.md`, taken in #220: a Titus example ("Some say they
know God but their actions deny him") used the "they" and "their" that rule
5 now forbids; rule 5 and the closing pass did not name "your", which the
pronoun count above counts; and the short name "Christians" is not a word of
the Colossians verses (rule 2). Measured 2026-11-04: in the pinned
`bsb-col` (`989162f6…`) "Christian" occurs once, in the section heading
`\s1 Christian Households`, not in verse text. The example became "Titus
instructs younger men" (2:6–8), "your" joined rule 5 and the pass, and
"Christians" left the list. The check part did not change. The prompt #216
measured, which 2 Timothy was drafted with, is kept as
`prompts/history/segment-titles-838516080c8f.md`.

Colossians again, so the numbers sit beside #216's on the same verses and
models; it is short (33 drafted titles) and its letter is full of "you".
Re-drafted twice on 2026-11-04 (runs finished 15:30:55 and 15:32:46 UTC)
with the revised prompt (SHA-256 `e3e08e032d32…`), the code at `47741d7`
and the same models. Neither record was committed.

```
node scripts/translate/segment-titles.ts --book COL \
  --draft-model anthropic/claude-sonnet-5.5 \
  --check-model google/gemini-3.8-flash --max-cost 0.20 \
  --out .cache/segment-titles/l220-run<1|2>
```

Both runs exited 0. Counted twice from each record, with `jq` and with
Python, which gave the same results; "pronoun drafts" is the same regex as
above, and lengths are counted in code points.

| Quantity                     | #216 prompt, run 1 (`838516080c8f…`)      | #216 prompt, run 2                        | Revised, run 1                            | Revised, run 2                            | Label    |
| ---------------------------- | ----------------------------------------- | ----------------------------------------- | ----------------------------------------- | ----------------------------------------- | -------- |
| Checker agreed               | 33 of 33                                  | 32 of 33                                  | 30 of 33                                  | 31 of 33                                  | measured |
| Disagreements, by criterion  | none                                      | `plain` 1                                 | `covers` 1, `accurate` 1, `plain` 1       | `plain` 2                                 | measured |
| Disputes over a pronoun      | 0                                         | 0                                         | 0                                         | 0                                         | measured |
| Pronoun drafts               | 0 of 33                                   | 0 of 33                                   | 0 of 33                                   | 0 of 33                                   | measured |
| Drafts over 60 characters    | 0 of 33 (longest 59, mean 51.3)           | 0 of 33 (longest 59, mean 50.8)           | 0 of 33 (longest 57, mean 47.3)           | 0 of 33 (longest 58, mean 48.3)           | measured |
| Titles naming "believers"    | 20                                        | 16                                        | 9                                         | 13                                        | measured |
| Titles naming the Colossians | 7                                         | 10                                        | 16                                        | 12                                        | measured |
| Titles naming "Christians"   | 0                                         | 0                                         | 0                                         | 0                                         | measured |
| Cost                         | $0.0852 ($0.0627 draft, $0.0225 check)    | $0.1039 ($0.0764 draft, $0.0276 check)    | $0.0854 ($0.0558 draft, $0.0296 check)    | $0.1065 ($0.0661 draft, $0.0405 check)    | measured |
| Cost per drafted title       | $0.0026                                   | $0.0031                                   | $0.0026                                   | $0.0032                                   | measured |
| Tokens                       | 21,084 (11,018 prompt, 10,066 completion) | 23,801 (11,019 prompt, 12,782 completion) | 22,277 (10,999 prompt, 11,278 completion) | 26,204 (11,003 prompt, 15,201 completion) | measured |
| Reasoning tokens             | draft 4,156, check 4,160                  | draft 5,507, check 5,462                  | draft 3,483, check 5,901                  | draft 4,502, check 8,845                  | measured |
| Model time                   | 59.7 s (34.2 s draft, 25.5 s check)       | 79.0 s (38.8 s draft, 40.2 s check)       | 80.9 s (29.5 s draft, 51.4 s check)       | 110.2 s (36.0 s draft, 74.2 s check)      | measured |

The #216 columns are copied from the section above (measured 2026-11-03);
the revised columns were measured 2026-11-04. Each cost is rounded to four
places from the unrounded call costs, so a total can differ from the sum
of its rounded parts by $0.0001 (revised run 2: $0.066064 + $0.040482 =
$0.106546).

Generation ids: run 1 draft `gen-1793806174-KQHl9Anpc4GLHZZIaave`, check
`gen-1793806204-xwOwnYSBFr8pg57fceX9`; run 2 draft
`gen-1793806256-HgDxaLUt4nwkEqncFO75`, check
`gen-1793806292-ZM8COFQCTy0qVN7dRFqC`. The two runs cost $0.1919 together.

None of the 5 disagreements is about a pronoun. Two are the `COL.4.12-14`
objection #216's run 2 also drew, that "greet" needs an object; this time
the title it judged does end "Luke and Demas greet". Run 2's other `plain`
is the same kind, "urges Archippus to finish" with no object. Run 1's
`covers` says "Paul rejoices in suffering for the church" leaves out
verses 25–27, and its `accurate` says "false humility and angels" should be
the worship of angels. Each of the 4 titles disputed in the committed run
(#212) names its people in both runs, all 4 with "the Colossians".

What this shows, on one book and two runs: the revised prompt keeps what
#216 gained (0 of 33 pronoun drafts, no pronoun disputes, none over 60)
with no "Christians". The checker agreed a little less often (30 and 31
against 33 and 32), and none of the new disagreements is about a pronoun.
Inference, not tested: two runs a side cannot separate an effect of the
change from run-to-run spread (#201 saw 6 to 11 disagreements across runs
of one earlier prompt). The titles are shorter (means 47.3 and 48.3 against
51.3 and 50.8), which may come from the shorter example; and "believers" names fewer
titles (9 and 13 against 20 and 16) while "the Colossians" names more (16
and 12 against 7 and 10), which eases the "believers" watch item above. Draft cost
($0.0558, $0.0661) is within the earlier spread.

## Measured: English segment titles, 1 Thessalonians, committed run (#207)

One plain run of the CLI on 2026-11-03 (19:20:40 to 19:22:22 UTC), with the
code at `9711b49` (drafting and check code as at `361fb5a`, the prompt of
#197, SHA-256 `cc76a816…`, before #216's readers rule; that prompt is kept
as `prompts/history/segment-titles-cc76a816652a.md`) and the same models as Philippians and
Colossians. It was drafted to give #207 a second blind book: 1 Thessalonians
was chosen over 2 Thessalonians (18 drafted segments) and 2 Timothy (30) as
the one with the most segments to draft (31), and, unlike 2 Timothy, not a
pastoral letter like Titus, whose reviewed titles are the third check's
voice. The record was copied unchanged to `data/drafts/en/1TH.json` (`cmp`
with the run's `en/1TH.json` reported no difference).

```
node scripts/translate/segment-titles.ts --book 1TH \
  --draft-model anthropic/claude-sonnet-5.5 \
  --check-model google/gemini-3.8-flash --max-cost 0.30
```

The runner exited 0: 31 of 31 segments drafted, 1 reusing its pericope
title, 30 `ai-checked`, 1 disagreement, 0 gate failures. The numbers below
were counted twice from the record, with `jq` and with Python, which gave the
same results.

| Quantity                     | Value                                     | Label               | Source and method                                                                                 |
| ---------------------------- | ----------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------- |
| Segments drafted             | 31 of 32                                  | measured 2026-11-03 | the other (`1TH.2.17-20`) is its pericope's only segment                                          |
| Calls                        | 1 draft, 1 check (one batch of 31)        | measured 2026-11-03 | `calls`; draft `gen-1793733641-n9cAAE8u5ljPELnx64nI`, check `gen-1793733671-3H9BLy0tZYH3C7pB3EZL` |
| Cost                         | $0.1270 ($0.0612 draft, $0.0657 check)    | measured 2026-11-03 | OpenRouter's billed `cost` per call                                                               |
| Cost per drafted title       | $0.0041                                   | measured 2026-11-03 | $0.1270 / 31                                                                                      |
| Tokens                       | 31,864 (10,259 prompt, 21,605 completion) | measured 2026-11-03 | draft 5,515 + 5,021 (4,148 reasoning); check 4,744 + 16,584 (15,709 reasoning)                    |
| Model time                   | 100.7 s (30.7 s draft, 70.0 s check)      | measured 2026-11-03 | `ms` per call, summed                                                                             |
| Checker agreed               | 30 of 31 (`ai-checked`)                   | measured 2026-11-03 | 1 disagreement (`accurate`, `style`)                                                              |
| Drafts over 60 characters    | 0 of 31 (longest 57, mean 48.9)           | measured 2026-11-03 | the `length` gate and `text` lengths                                                              |
| Titles in the tC Mobile file | 30 of 32 segments                         | measured 2026-11-03 | `npm run build`: the disputed draft and the reused pericope title are `unreviewed`, left out      |

The check reasoned 15,709 tokens here against 5,592 on the committed
Colossians run, and cost more than the draft; why is not measured.

## Measured: English segment titles, 2 Timothy, committed run (#207)

One plain run of the CLI on 2026-11-03 (21:35:12 to 21:36:15 UTC), with the
code at `e383b1d` (batched drafting of #213, the batched check of #201) and
the prompt then current, SHA-256 `838516080c8f…` (#216's readers rule;
the first committed record made with it; kept since #220 as
`prompts/history/segment-titles-838516080c8f.md`), and the
same models as Philippians, Colossians and 1 Thessalonians. It was drafted
to enlarge #207's blind sample, which had 5 disputes (Colossians 4,
1 Thessalonians 1). 2 Timothy was chosen as the unseen short book with the
most segments that still drafts and checks in one batch each (30 to
draft; 2 Peter has 23, 2 Thessalonians 18, Philemon 5; 1 Timothy's 40 need
two batches of at most 35), counted from `data/structure/`. It is
a pastoral letter like Titus, whose reviewed titles are the third check's
voice, so the voice examples come from a sibling letter; that may make the
third model's titles read closer to Titus than they did on Colossians or
1 Thessalonians (inference, not measured). The record was copied unchanged
to `data/drafts/en/2TI.json` (`cmp` with the run's `en/2TI.json` reported
no difference).

```
node scripts/translate/segment-titles.ts --book 2TI \
  --draft-model anthropic/claude-sonnet-5.5 \
  --check-model google/gemini-3.8-flash --max-cost 0.30 \
  --out .cache/segment-titles/l2ti-2TI
```

The runner exited 0: 30 of 30 segments drafted, 2 reusing their pericope
title, 26 `ai-checked`, 4 disagreements, 0 gate failures. The numbers below
were counted twice from the record, with `jq` and with Python, which gave
the same results. The checker's suggestions and reasons were not read
before the third check ran (#207); only counts and criteria were.

| Quantity                     | Value                                    | Label               | Source and method                                                                                  |
| ---------------------------- | ---------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------- |
| Segments drafted             | 30 of 32                                 | measured 2026-11-03 | the 2 others (`2TI.1.1-2`, `2TI.4.19-22`) are their pericope's only segment                        |
| Calls                        | 1 draft, 1 check (one batch of 30)       | measured 2026-11-03 | `calls`; draft `gen-1793741713-mvgAcGc7H2fGO5YJ0SlD`, check `gen-1793741747-8MJ151FmeLGzL5r771dB`  |
| Cost                         | $0.0780 ($0.0638 draft, $0.0143 check)   | measured 2026-11-03 | OpenRouter's billed `cost` per call ($0.063760 + $0.014274 = $0.078034)                            |
| Cost per drafted title       | $0.0026                                  | measured 2026-11-03 | $0.0780 / 30                                                                                       |
| Tokens                       | 18,244 (10,077 prompt, 8,167 completion) | measured 2026-11-03 | draft 5,545 + 5,267 (4,370 reasoning); check 4,532 + 2,900 (1,899 reasoning)                       |
| Model time                   | 62.2 s (34.2 s draft, 28.0 s check)      | measured 2026-11-03 | `ms` per call, summed                                                                              |
| Checker agreed               | 26 of 30 (`ai-checked`)                  | measured 2026-11-03 | 4 disagreements; criteria `accurate` 2, `covers` 1, `plain` 1, `style` 1 (a title can name more)   |
| Drafts over 60 characters    | 0 of 30 (longest 57, mean 50.3)          | measured 2026-11-03 | the `length` gate and `text` lengths                                                               |
| Titles in the tC Mobile file | 26 of 32 segments                        | measured 2026-11-03 | `npm run build`: the 4 disputed drafts and the 2 reused pericope titles are `unreviewed`, left out |

The third check then ran blind on the 4 disputes: one dispute call and one
recheck call, $0.046908, 85.2 s of model time, all 4 sorted factual
([dispute-check.md](dispute-check.md#revised-step-measured-3-nov-2026)).
The book cost $0.124942 from drafting to recheck, $0.0042 per drafted
title (measured: OpenRouter's billed `cost` of the four calls, summed).

## Measured: English segment titles, Genesis, the first long book (#208)

#208's done-when: one long book drafts with a readable reply. Genesis was
drafted on 2026-11-04 in full batches, the first book over 35 titles to
run through batched drafting (#213) and the batched check (#201).

The first plain run (15:26:12 UTC, code at `47741d7`) stopped before any
model call: `verseTexts` could not read Genesis 1:2, where BSB opens a
paragraph with `\pmo` after the heading "The First Day". `0107e82` drops
`\pmo` like the other paragraph markers, and Genesis now reads all 1,533
verses (a test checks it). It cost nothing. Over the 66 pinned BSB files,
31 books failed to read before this fix and 24 after (measured with a
throwaway script calling `verseTexts` on each cached file); the rest are
#226. Since #226, `verseTexts` reads all 66 books, 31,104 verses, the same
verses as the ufw versification (a test checks it); 18 of them BSB numbers
but leaves blank, and three segments are only such a verse (`MAT.17.21-21`,
`MRK.11.26-26`, `ROM.16.24-24`), which drafting skips; the build gives
them `BLANK_TITLE`.

The second run, one plain run of the CLI (15:29:34 to 15:53:04 UTC, code at
`0107e82`, prompt `prompts/segment-titles.md` as it then stood, SHA-256
`838516080c8f…`: #216's readers rule, the same prompt as 2 Timothy's,
before #228 revised it; now kept as
`prompts/history/segment-titles-838516080c8f.md`, where the record's hash
resolves. Genesis was not re-drafted with the revised prompt. The same
models as every committed book):

```
node scripts/translate/segment-titles.ts --book GEN \
  --draft-model anthropic/claude-sonnet-5.5 \
  --check-model google/gemini-3.8-flash --max-cost 2.80 \
  --out .cache/segment-titles/l208-GEN-2
```

The runner exited 0 with outcome `done`: 642 of 642 segments drafted, 8
reusing their pericope title, 602 `ai-checked`, 40 disagreements, 3 gate
failures. Every draft and check reply was readable; no call was cut off
or re-run. The record was copied unchanged to `data/drafts/en/GEN.json`
(`cmp` with the run's `en/GEN.json` reported no difference). The numbers
below were counted twice from the record, with `jq` and with Python, which
gave the same results.

| Quantity                     | Value                                                     | Label               | Source and method                                                                                            |
| ---------------------------- | --------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| Segments drafted             | 642 of 650                                                | measured 2026-11-04 | the 8 others are their pericope's only segment                                                               |
| Calls                        | 19 draft, 19 check (batches of 33 or 34)                  | measured 2026-11-04 | `calls`; first draft `gen-1793806175-VzrY9mgoPE0y2K42mJkh`, last check `gen-1793807543-joX48S59TRCTpjyAUHCf` |
| Cost                         | $1.7259 ($1.1139 draft, $0.6120 check)                    | measured 2026-11-04 | OpenRouter's billed `cost` per call, summed ($1.725863)                                                      |
| Cost per drafted title       | $0.0027 ($0.0017 draft, $0.0010 check)                    | measured 2026-11-04 | the costs above / 642                                                                                        |
| Cost per call                | draft $0.0236 to $0.0799; check $0.0156 to $0.0492        | measured 2026-11-04 | `cost` per call                                                                                              |
| Tokens                       | 450,569 (219,982 prompt, 230,587 completion)              | measured 2026-11-04 | draft 119,875 + 87,413 (67,868 reasoning); check 100,107 + 143,174 (124,063 reasoning)                       |
| Largest completion           | draft 6,784 of 16,384 (41%); check 11,997 of 32,768 (37%) | measured 2026-11-04 | `completionTokens` per call against `MAX_TOKENS` and `CHECK_MAX_TOKENS`                                      |
| Model time                   | 1,407.7 s (549.7 s draft, 858.1 s check)                  | measured 2026-11-04 | `ms` per call, summed; one call after another, 23.5 minutes from start to end                                |
| Checker agreed               | 602 of 642 (`ai-checked`)                                 | measured 2026-11-04 | 40 disagreements; criteria `style` 27, `covers` 7, `accurate` 5, `plain` 2 (a title can name more)           |
| Drafts over 60 characters    | 3 of 642 (longest 64, mean 47.1)                          | measured 2026-11-04 | the `length` gate: `GEN.41.22-24` (64), `GEN.41.30-32` (61), `GEN.41.55-57` (61); all 3 also disputed        |
| Pronoun drafts               | 7 of 642, none disputed                                   | measured 2026-11-04 | titles matching `\b(them\|they\|their\|you\|your)\b`, ignoring case (as in #209)                             |
| Titles in the tC Mobile file | 602 of 650 segments                                       | measured 2026-11-04 | `npm run build`: the 40 disputed drafts and the 8 reused pericope titles are `unreviewed`, left out          |

The review bench found one `ai-checked` title that drops the scope of its
verses: `GEN.9.11-13`, "God promises no more floods; the rainbow is the
sign" (Genesis 9:11 limits the promise to a flood that destroys the earth).
The record is AI output, kept unchanged; the fix is a person's review
(#232).

The third check (#203) was not run on Genesis and no dispute results are
written: #207 holds third-check data until its sample check is done. This
section reports counts only, not the checker's reasons or suggestions.

Observations from one run (not trends):

- **One draft call did not reason.** Draft batch 16
  (`gen-1793806630-zt7lcSeru5HnTDulmRCi`, `GEN.41.22-24` onward) used 0
  reasoning tokens and 1,054 completion tokens in 7.1 s, against 2,694 to
  5,710 reasoning tokens for the other 18. All 3 titles over 60 are in that
  batch. Inference, not tested: the prompt's closing count ("count the characters of every title")
  happens in the model's reasoning, so a call that skips reasoning skips it.
  The gate caught all 3; none reaches the tC Mobile file.
- **Disputes cluster.** Batch 14 (from `GEN.36.4-5`) holds 10 of the 40;
  two batches hold none. Why is not measured.
- **Batch boundaries (the #208 watch item).** 5 of the 40 disputes are on
  one of the 36 titles next to a batch boundary (`GEN.10.6-7`,
  `GEN.19.34-35`, `GEN.27.1-2`, `GEN.36.1-3`, `GEN.41.22-24`), against
  about 2 if disputes fell evenly (40 × 36 / 642). Small numbers; whether
  a boundary inside a story needs the title before it is still untested.
  A person reading the titles across each boundary would settle it.

Whole-Bible numbers from this book (estimated, these per-title rates over
13,507 titles): drafting about $23, checking about $13, model time about
8.2 hours one call after another. The drafting rate ($0.0017 per title)
falls inside the Colossians range above ($0.0014 to $0.0025), so full
batches (cap 35, `DRAFT_BATCH`; this run filled 33 or 34) did not cost more
per title on a long book. The checking rate ($0.0010
per title) gives less than the #201 estimate ($19 to $42 for all books); with the run-to-run spread of the
check, one book does not move that range.

Total OpenRouter spend of this work: $1.725863 (the second run; the first
made no call).

## Measured: English segment titles, the Gospels and Acts (#244)

ADR [0008](../decisions/0008-english-run-before-dispute-verdict.md): the
remaining 60 books are drafted and checked before the #207 verdict, with
disputed titles held as for Genesis. Matthew, Mark, Luke, John and Acts
were drafted on 2026-11-05 the way Genesis was: one plain run of the CLI
per book, the same models, code at `3b4cc37` (the runner and its library
are unchanged at `c479756`, the base of this change), and the prompt on
main, `prompts/segment-titles.md` SHA-256 `e3e08e032d32…` (unchanged by
this work). Several books ran at the same time, each in its own
`--out` directory.

```
node scripts/translate/segment-titles.ts --book MAT \
  --draft-model anthropic/claude-sonnet-5.5 \
  --check-model google/gemini-3.8-flash --max-cost 1.66 \
  --out .cache/segment-titles/len-MAT
```

`--max-cost` was 1.5 times the book's estimate (drafted segments × $0.0027,
Genesis's rate): MAT 1.66, MRK 1.06, LUK 1.88, JHN 1.48, ACT 1.65.

Every run exited 0 with outcome `done` except Mark's first, which stopped
on its last check call (the 15th call) when OpenRouter answered with a body
of whitespace only (`OpenRouter returned non-JSON`); its 15 recorded calls
cost $0.691304 and wrote no record. Mark was run once more, plainly, and
that run is the record. Each record was copied unchanged to
`data/drafts/en/<BOOK>.json` (`cmp`: no difference). The counts below were
made twice from the records, with `jq` and with Python, which gave the same
results.

| Book  | Drafted    | Agreed | Disagreed: criteria                                 | Gate failures          | Over 60 (longest) | Calls   | Cost      | Model time |
| ----- | ---------- | ------ | --------------------------------------------------- | ---------------------- | ----------------- | ------- | --------- | ---------- |
| MAT   | 410 of 439 | 382    | 28: `style` 14, `covers` 8, `plain` 6, `accurate` 5 | 7 (`length` 7)         | 7 (64)            | 12 + 12 | $1.278408 | 1,422.5 s  |
| MRK   | 260 of 276 | 252    | 8: `covers` 5, `accurate` 3                         | 0                      | 0 (59)            | 8 + 8   | $0.789557 | 833.0 s    |
| LUK   | 463 of 493 | 438    | 25: `accurate` 10, `style` 9, `plain` 5, `covers` 4 | 1 (`length` 1)         | 1 (65)            | 14 + 14 | $1.401559 | 1,334.9 s  |
| JHN   | 365 of 371 | 349    | 16: `accurate` 7, `plain` 6, `style` 4, `covers` 3  | 2 (`length`, `quotes`) | 1 (61)            | 11 + 11 | $1.099597 | 1,118.0 s  |
| ACT   | 406 of 410 | 396    | 10: `plain` 5, `accurate` 4, `style` 2, `covers` 1  | 2 (`length` 2)         | 2 (63)            | 12 + 12 | $1.115909 | 996.6 s    |
| Total | 1,904      | 1,817  | 87                                                  | 12                     | 11                | 57 + 57 | $5.685032 | 5,705.0 s  |

Labels and sources: every row is measured 2026-11-05 from the committed
record. Drafted: `titles`; the other segments are their pericope's only
segment (MAT 28, MRK 15, LUK 30, JHN 6, ACT 4) or blank in BSB
(`MAT.17.21-21`, `MRK.11.26-26`), which take `BLANK_TITLE`. Agreed: checker
`agree`, all `ai-checked`. Criteria: a title can name more than one. Cost:
OpenRouter's billed `cost` per call, summed; per drafted title MAT $0.0031,
MRK $0.0030, LUK $0.0030, JHN $0.0030, ACT $0.0027. Model time: `ms` per
call, summed. Largest completion: draft 8,359 of 16,384 (51%, ACT); check
25,808 of 32,768 (79%, MAT). No reply was cut off and every reply was
readable (the runs end `done`). Pronoun drafts (as in #209): MAT 6, MRK 1,
LUK 1, JHN 4, ACT 3; 2 of the 15 disputed. `npm run build` puts 1,817
`ai-checked` titles and the 2 `BLANK_TITLE`s in the tC Mobile title tables
(MAT 383 of 439, MRK 253 of 276, LUK 438 of 493, JHN 349 of 371, ACT 396 of
410).

No third check was run and no dispute data is written (ADR 0008); the 87
disagreements stay `unreviewed`. Counts only; the checker's reasons and
suggestions were not read.

Observations from these runs (not trends):

- **Draft calls that did not reason.** 7 of 57 draft calls used 0 reasoning
  tokens (MAT batches 9 and 10, MRK 8, LUK 12, JHN 9, ACT 6 and 11), each
  about 950 to 1,070 completion tokens in 6 to 8 s. 10 of the 11 titles over
  60 are in those batches (Genesis: 3 of 3 in its one such batch). All 11
  are also disputed and the gate holds them. Inference, not tested: as for
  Genesis, the length count happens in the reasoning.
- **The check came closer to its limit.** Matthew's largest check reply
  used 79% of `CHECK_MAX_TOKENS` (Genesis's largest, 37%). None was cut
  off; a longer book with denser batches could be.
- **One empty reply.** Mark's first run (above). Whether running four books
  at once made it likelier is not measured.

OpenRouter spend of this work: $6.376336 (the five records, $5.685032, and
Mark's first run, $0.691304, as its ledger records them).

## Measured: English segment titles, Romans to Philemon (#244)

ADR [0008](../decisions/0008-english-run-before-dispute-verdict.md): the
remaining 60 books are drafted and checked before the #207 verdict, with
disputed titles held as for Genesis. Romans, 1 and 2 Corinthians,
Galatians, Ephesians, 2 Thessalonians, 1 Timothy and Philemon were drafted
on 2026-11-05 the way Genesis was: one plain run of the CLI per book, the
same models, the runner and its library as at `3b4cc37` (unchanged at
`c479756`, the base of this change), and the prompt on main,
`prompts/segment-titles.md` SHA-256 `e3e08e032d32…` (unchanged by this
work). Several books ran at the same time, each in its own `--out`
directory.

```
node scripts/translate/segment-titles.ts --book ROM \
  --draft-model anthropic/claude-sonnet-5.5 \
  --check-model google/gemini-3.8-flash --max-cost 0.81 \
  --out .cache/segment-titles/len-ROM
```

`--max-cost` was 1.5 times the book's estimate (drafted segments × $0.0027,
Genesis's rate), at least $0.30: ROM 0.81, 1CO 0.72, 2CO 0.45, the rest
0.30. Every run exited 0 with outcome `done`, first time. Each record was
copied unchanged to `data/drafts/en/<BOOK>.json` (`cmp`: no difference).
The counts below were made twice from the records, with `jq` and with
Python, which gave the same results (three means and sums differ only in
how a tie rounds at the last digit; the exact values are given).

| Book  | Drafted    | Agreed | Disagreed: criteria                    | Gate failures | Over 60 (longest) | Calls   | Cost       | Model time |
| ----- | ---------- | ------ | -------------------------------------- | ------------- | ----------------- | ------- | ---------- | ---------- |
| ROM   | 199 of 201 | 193    | 6: `accurate` 3, `covers` 3, `plain` 1 | 0             | 0 (60)            | 6 + 6   | $0.610651  | 544.3 s    |
| 1CO   | 176 of 179 | 170    | 6: `plain` 3, `accurate` 2, `covers` 2 | 0             | 0 (59)            | 6 + 6   | $0.564105  | 522.9 s    |
| 2CO   | 110 of 111 | 105    | 5: `accurate` 4, `plain` 1             | 0             | 0 (59)            | 4 + 4   | $0.2723675 | 248.1 s    |
| GAL   | 62 of 62   | 59     | 3: `accurate` 1, `covers` 1, `plain` 1 | 0             | 0 (58)            | 2 + 2   | $0.219338  | 235.1 s    |
| EPH   | 60 of 62   | 59     | 1: `accurate` 1                        | 0             | 0 (58)            | 2 + 2   | $0.1856795 | 166.1 s    |
| 2TH   | 18 of 19   | 18     | 0                                      | 0             | 0 (57)            | 1 + 1   | $0.076324  | 70.05 s    |
| 1TI   | 40 of 46   | 39     | 1: `covers` 1                          | 0             | 0 (57)            | 2 + 2   | $0.126492  | 119.5 s    |
| PHM   | 5 of 8     | 5      | 0                                      | 0             | 0 (58)            | 1 + 1   | $0.018307  | 14.2 s     |
| Total | 670        | 648    | 22                                     | 0             | 0                 | 24 + 24 | $2.0732638 | 1,920.2 s  |

Labels and sources: every row is measured 2026-11-05 from the committed
record. Drafted: `titles`; the other segments are their pericope's only
segment (ROM 1, 1CO 3, 2CO 1, EPH 2, 2TH 1, 1TI 6, PHM 3) or blank in BSB
(`ROM.16.24-24`), which takes `BLANK_TITLE`. Agreed: checker `agree`, all
`ai-checked`. Criteria: a title can name more than one. Cost: OpenRouter's
billed `cost` per call, summed; per drafted title $0.0025 (2CO) to $0.0042
(2TH). Model time: `ms` per call, summed. Largest completion: draft 6,243 of
16,384 (38%, 1CO); check 20,544 of 32,768 (63%, GAL). No reply was cut off
and every reply was readable (the runs end `done`). One draft call used 0
reasoning tokens (2CO batch 3, 773 completion tokens, 5.4 s); no title in
it is over 60. Pronoun drafts (as in #209): ROM 1, 2CO 3, none disputed.
`npm run build` puts 648 `ai-checked` titles and the `BLANK_TITLE` in the
tC Mobile title tables (ROM 194 of 201, 1CO 170 of 179, 2CO 105 of 111, GAL
59 of 62, EPH 59 of 62, 2TH 18 of 19, 1TI 39 of 46, PHM 5 of 8).

No third check was run and no dispute data is written (ADR 0008); the 22
disagreements stay `unreviewed`. Counts only; the checker's reasons and
suggestions were not read.

OpenRouter spend of this work: $2.0732638, the eight records.

## Measured: English segment titles, Exodus to 2 Samuel (#244)

ADR [0008](../decisions/0008-english-run-before-dispute-verdict.md): the
remaining books are drafted and checked before the #207 verdict, with
disputed titles held as for Genesis. Exodus, Leviticus, Numbers,
Deuteronomy, Joshua, Judges, Ruth, 1 Samuel and 2 Samuel were drafted on
2026-11-05 the way Genesis was: one plain run of the CLI per book, the same
models, the runner and its library as at `3b4cc37` (the runs started from
`f27c015`, which does not touch them; unchanged at `238a514`, the base of
this change), and the prompt on main, `prompts/segment-titles.md` SHA-256
`e3e08e032d32…` (unchanged by this work). Several books ran at the same
time, each in its own `--out` directory.

```
node scripts/translate/segment-titles.ts --book EXO \
  --draft-model anthropic/claude-sonnet-5.5 \
  --check-model google/gemini-3.8-flash --max-cost 1.87 \
  --out .cache/segment-titles/len-EXO
```

`--max-cost` was 1.5 times the book's estimate (drafted segments × $0.0027,
Genesis's rate), at least $0.30: EXO 1.87, LEV 1.50, NUM 2.16 (re-run 2.15),
DEU 1.92, JOS 1.26, JDG 1.24, RUT 0.30, 1SA 1.62, 2SA 1.26.

Numbers and Deuteronomy each ended `incomplete` on their first run (exit 2):
the draft replies left out single-verse segments (NUM 4, DEU 7), so no
record was written. Each was run once more, plainly, and that run is the
record. The stopped runs cost $1.32270625 (NUM, 32 calls) and $1.46837300
(DEU, 28 calls), as their ledgers record them; #252 tracks the cause. Every
other run exited 0 with outcome `done`, first time. Each record was copied
unchanged to `data/drafts/en/<BOOK>.json` (`cmp`: no difference). The
counts below were made twice from the records, with `jq` and with Python,
which gave the same values.

| Book  | Drafted    | Agreed | Disagreed: criteria                                  | Gate failures    | Over 60 (longest) | Calls   | Cost        | Model time  |
| ----- | ---------- | ------ | ---------------------------------------------------- | ---------------- | ----------------- | ------- | ----------- | ----------- |
| EXO   | 461 of 473 | 439    | 22: `style` 14, `covers` 4, `accurate` 3, `plain` 1  | 8 (`length` 8)   | 8 (66)            | 14 + 14 | $1.53206525 | 1,509.286 s |
| LEV   | 370 of 372 | 343    | 27: `style` 12, `plain` 8, `accurate` 6, `covers` 6  | 0                | 0 (60)            | 11 + 11 | $1.18626975 | 989.097 s   |
| NUM   | 531 of 544 | 474    | 57: `style` 44, `plain` 17, `accurate` 5, `covers` 5 | 16 (`length` 16) | 16 (70)           | 16 + 16 | $1.38870025 | 1,308.082 s |
| DEU   | 473 of 481 | 452    | 21: `style` 11, `plain` 6, `covers` 4, `accurate` 3  | 9 (`length` 9)   | 9 (66)            | 14 + 14 | $1.34833025 | 1,174.967 s |
| JOS   | 309 of 309 | 286    | 23: `style` 15, `accurate` 4, `covers` 3, `plain` 3  | 9 (`length` 9)   | 9 (69)            | 9 + 9   | $0.88345825 | 789.771 s   |
| JDG   | 304 of 307 | 292    | 12: `accurate` 7, `covers` 4, `style` 1              | 0                | 0 (59)            | 9 + 9   | $0.95488450 | 804.991 s   |
| RUT   | 37 of 38   | 36     | 1: `accurate` 1                                      | 0                | 0 (56)            | 2 + 2   | $0.09813750 | 90.571 s    |
| 1SA   | 398 of 400 | 381    | 17: `covers` 10, `plain` 5, `accurate` 3, `style` 2  | 1 (`length` 1)   | 1 (65)            | 12 + 12 | $1.21150550 | 1,111.467 s |
| 2SA   | 310 of 313 | 300    | 10: `covers` 4, `style` 4, `accurate` 3              | 0                | 0 (60)            | 9 + 9   | $0.74888425 | 666.598 s   |
| Total | 3,193      | 3,003  | 190                                                  | 43               | 43                | 96 + 96 | $9.35223550 | 8,444.830 s |

Labels and sources: every row is measured 2026-11-05 from the committed
record. Drafted: `titles`; the other segments are their pericope's only
segment. Agreed: checker `agree`, all `ai-checked`. Criteria: a title can
name more than one. Cost and model time: OpenRouter's billed `cost` and
`ms` per call, summed, exact. Largest completion: draft 7,588 of 16,384
(46%, JOS); check 23,291 of 32,768 (71%, 1SA). No reply was cut off and
every reply in these records was readable (the runs end `done`). `npm run
build` puts the 3,003 `ai-checked` titles in the tC Mobile title tables
(EXO 439 of 473, LEV 343 of 372, NUM 474 of 544, DEU 452 of 481, JOS 286 of
309, JDG 292 of 307, RUT 36 of 38, 1SA 381 of 400, 2SA 300 of 313).

Observations from these runs (not trends):

- **Every title over 60 is in a draft call that did not reason.** 16 of 96
  draft calls used 0 reasoning tokens; all 43 titles over 60 are in those
  batches, and all 43 are also disputed, so the gate and the checker both
  hold them. In the New Testament groups it was 15 of 18. Inference, not
  tested: the length count happens in the reasoning.
- **Numbers has the most disputes** (57 of 531, 44 naming `style`).

No third check was run and no dispute data is written (ADR 0008); the 190
disagreements stay `unreviewed`. Counts only; the checker's reasons and
suggestions were not read.

OpenRouter spend of this work: $12.14331475 ($9.35223550 in the nine
records and $2.79107925 in the two stopped runs).

## Measured: English segment titles, Hebrews to Revelation (#244)

ADR [0008](../decisions/0008-english-run-before-dispute-verdict.md): the
remaining 60 books are drafted and checked before the #207 verdict, with
disputed titles held as for Genesis. Hebrews, James, 1 and 2 Peter, 1, 2
and 3 John, Jude and Revelation were drafted on 2026-11-05 the way Genesis
was: one plain run of the CLI per book, one book after another, the same
models, the runner and its library as at `3b4cc37` (unchanged at
`c479756`, the base of this change), and the prompt on main,
`prompts/segment-titles.md` SHA-256 `e3e08e032d32…` (unchanged by this
work).

```
node scripts/translate/segment-titles.ts --book REV \
  --draft-model anthropic/claude-sonnet-5.5 \
  --check-model google/gemini-3.8-flash --max-cost 0.77 \
  --out .cache/segment-titles/len-REV
```

`--max-cost` was 1.5 times the book's estimate (drafted segments × $0.0027,
Genesis's rate), at least $0.30: HEB 0.49, REV 0.77, the rest 0.30. Every
run exited 0 with outcome `done`, first time. Each record was copied
unchanged to `data/drafts/en/<BOOK>.json` (`cmp`: no difference). The
counts below were made twice from the records, with `jq` and with Python,
which gave the same values.

| Book  | Drafted    | Agreed | Disagreed: criteria                               | Gate failures  | Over 60 (longest) | Calls   | Cost        | Model time  |
| ----- | ---------- | ------ | ------------------------------------------------- | -------------- | ----------------- | ------- | ----------- | ----------- |
| HEB   | 120 of 124 | 114    | 6: `covers` 2, `plain` 2, `style` 2, `accurate` 1 | 1 (`length`)   | 1 (61)            | 4 + 4   | $0.35171525 | 329.045 s   |
| JAS   | 43 of 45   | 40     | 3: `accurate` 2, `covers` 1, `style` 1            | 1 (`length`)   | 1 (62)            | 2 + 2   | $0.10721825 | 86.560 s    |
| 1PE   | 42 of 44   | 41     | 1: `covers` 1                                     | 0              | 0 (59)            | 2 + 2   | $0.14355650 | 142.949 s   |
| 2PE   | 23 of 24   | 22     | 1: `plain` 1                                      | 0              | 0 (59)            | 1 + 1   | $0.07859475 | 72.218 s    |
| 1JN   | 40 of 41   | 36     | 4: `covers` 2, `accurate` 1, `plain` 1            | 0              | 0 (59)            | 2 + 2   | $0.16523625 | 163.845 s   |
| 2JN   | 2 of 5     | 2      | 0                                                 | 0              | 0 (57)            | 1 + 1   | $0.01141975 | 9.516 s     |
| 3JN   | 2 of 5     | 2      | 0                                                 | 0              | 0 (58)            | 1 + 1   | $0.00736700 | 11.139 s    |
| JUD   | 9 of 11    | 8      | 1: `covers` 1                                     | 0              | 0 (57)            | 1 + 1   | $0.06015625 | 77.927 s    |
| REV   | 189 of 195 | 177    | 12: `accurate` 7, `style` 4, `covers` 2           | 5 (`length` 5) | 5 (62)            | 6 + 6   | $0.55920950 | 518.022 s   |
| Total | 470        | 442    | 28                                                | 7              | 7                 | 20 + 20 | $1.48447350 | 1,411.221 s |

Labels and sources: every row is measured 2026-11-05 from the committed
record. Drafted: `titles`; the other segments are their pericope's only
segment (HEB 4, JAS 2, 1PE 2, 2PE 1, 1JN 1, 2JN 3, 3JN 3, JUD 2, REV 6).
Agreed: checker `agree`; 441 are `ai-checked`, and one, `REV.20.9-10` (61
characters), is agreed but held by the `length` gate. Criteria: a title can
name more than one. Cost: OpenRouter's billed `cost` per call, summed, exact
(the cells add to the total).
Model time: `ms` per call, summed, exact. Largest completion: draft 6,786 of 16,384
(41%, REV); check 17,572 of 32,768 (54%, HEB). No reply was cut off and
every reply was readable (the runs end `done`). Pronoun drafts (as in
#209): HEB 2, JAS 2, REV 3, none disputed. `npm run build` puts 441
`ai-checked` titles in the tC Mobile title tables (HEB 114 of 124, JAS 40 of
45, 1PE 41 of 44, 2PE 22 of 24, 1JN 36 of 41, 2JN 2 of 5, 3JN 2 of 5, JUD 8
of 11, REV 176 of 195).

Five draft calls used 0 reasoning tokens (HEB batch 1, JAS 1, 3JN 1, REV 3
and 4); 5 of the 7 titles over 60 are in them (JAS 1, REV 4), as in the
earlier groups.

The review bench found one `ai-checked` title that misreads its verses:
`JUD.1.9-11`, "Michael did not slander the devil; ungodly men do" (Jude 1:10
says the men slander what they do not understand, not the devil). The
record is AI output, kept unchanged; the fix is a person's review (#254),
and `known-issues.json` lists it.

No third check was run and no dispute data is written (ADR 0008); the 28
disagreements and the gated agreed title stay `unreviewed`. Counts only;
the checker's reasons and suggestions were not read.

OpenRouter spend of this work: $1.48447350, the nine records.

## Measured: English segment titles, 1 Kings to Job (#244)

ADR [0008](../decisions/0008-english-run-before-dispute-verdict.md): the
remaining books are drafted and checked before the #207 verdict, with
disputed titles held as for Genesis. 1 and 2 Kings, 1 and 2 Chronicles,
Ezra, Nehemiah, Esther and Job were drafted on 2026-11-05 the way Genesis
was: one plain run of the CLI per book, the same models, the runner and its
library as at `3b4cc37` (the runs started from `f27c015`, which does not
touch them; unchanged at `238a514`, the base of this change), and the
prompt on main, `prompts/segment-titles.md` SHA-256 `e3e08e032d32…`
(unchanged by this work). Several books ran at the same time, each in its
own `--out` directory.

```
node scripts/translate/segment-titles.ts --book JOB \
  --draft-model anthropic/claude-sonnet-5.5 \
  --check-model google/gemini-3.8-flash --max-cost 1.76 \
  --out .cache/segment-titles/len-JOB
```

`--max-cost` was 1.5 times the book's estimate (drafted segments × $0.0027,
Genesis's rate), at least $0.30: 1KI 1.41 (re-run 1.40), 2KI 1.22, 1CH 1.44
(re-run 1.44), 2CH 1.41, EZR 0.45, NEH 0.68, EST 0.32, JOB 1.76.

Two first runs wrote no record. 1 Kings ended `incomplete` (exit 2): the
draft replies left out three single-verse segments (#252); it cost
$0.83688225 over 20 calls. 1 Chronicles stopped with an error on its 15th
call (`terminated`, the connection closed); it cost $0.57333025 over 14
calls. Each was run once more, plainly, and that run is the record. Every
other run exited 0 with outcome `done`, first time. Each record was copied
unchanged to `data/drafts/en/<BOOK>.json` (`cmp`: no difference). The
counts below were made twice from the records, with `jq` and with Python,
which gave the same values.

| Book  | Drafted    | Agreed | Disagreed: criteria                                | Gate failures  | Over 60 (longest) | Calls   | Cost        | Model time  |
| ----- | ---------- | ------ | -------------------------------------------------- | -------------- | ----------------- | ------- | ----------- | ----------- |
| 1KI   | 348 of 358 | 330    | 18: `style` 9, `accurate` 4, `covers` 3, `plain` 2 | 8 (`length` 8) | 8 (71)            | 10 + 10 | $0.86135200 | 840.876 s   |
| 2KI   | 300 of 316 | 287    | 13: `style` 7, `accurate` 5, `plain` 3, `covers` 1 | 6 (`length` 6) | 6 (78)            | 9 + 9   | $0.79044100 | 678.339 s   |
| 1CH   | 355 of 363 | 320    | 35: `style` 27, `covers` 5, `accurate` 3           | 9 (`length` 9) | 9 (73)            | 11 + 11 | $0.86986250 | 877.843 s   |
| 2CH   | 347 of 366 | 332    | 15: `style` 6, `covers` 5, `accurate` 3, `plain` 2 | 4 (`length` 4) | 4 (64)            | 10 + 10 | $0.98895425 | 875.604 s   |
| EZR   | 111 of 115 | 102    | 9: `style` 8, `covers` 1                           | 1 (`length` 1) | 1 (64)            | 4 + 4   | $0.33080100 | 290.098 s   |
| NEH   | 166 of 167 | 148    | 18: `style` 15, `covers` 2, `plain` 1              | 2 (`length` 2) | 2 (61)            | 5 + 5   | $0.46315425 | 412.104 s   |
| EST   | 78 of 78   | 77     | 1: `plain` 1                                       | 0              | 0 (57)            | 3 + 3   | $0.23308875 | 186.185 s   |
| JOB   | 434 of 435 | 415    | 19: `style` 7, `covers` 6, `accurate` 4, `plain` 2 | 8 (`length` 8) | 8 (69)            | 13 + 13 | $1.10614400 | 983.468 s   |
| Total | 2,139      | 2,011  | 128                                                | 38             | 38                | 65 + 65 | $5.64379775 | 5,144.517 s |

Labels and sources: every row is measured 2026-11-05 from the committed
record. Drafted: `titles`; the other segments are their pericope's only
segment. Agreed: checker `agree`; 2,009 are `ai-checked`, and two,
`1KI.11.11-13` and `JOB.31.19-21`, are agreed but held by the `length`
gate. Criteria: a title can name more than one. Cost and model time:
OpenRouter's billed `cost` and `ms` per call, summed, exact. Largest
completion: draft 7,323 of 16,384 (45%, 2CH); check 30,679 of 32,768 (94%,
1KI). No reply was cut off and every reply in these records was readable
(the runs end `done`). `npm run build` puts the 2,009 `ai-checked` titles in
the tC Mobile title tables (1KI 329 of 358, 2KI 287 of 316, 1CH 320 of 363,
2CH 332 of 366, EZR 102 of 115, NEH 148 of 167, EST 77 of 78, JOB 414 of
435).

Observations from these runs (not trends):

- **A check reply came within 6% of its limit.** 1 Kings' largest check
  reply used 30,679 of `CHECK_MAX_TOKENS` (32,768). It was not cut off; a
  cut-off reply would leave titles unread and stop the run.
- **Long titles and calls that did not reason.** 18 of 65 draft calls used 0
  reasoning tokens; 37 of the 38 titles over 60 are in those batches.
  Inference, not tested: the length count happens in the reasoning.

No third check was run and no dispute data is written (ADR 0008); the 128
disagreements and the two gated agreed titles stay `unreviewed`. Counts
only; the checker's reasons and suggestions were not read.

OpenRouter spend of this work: $7.05401025 ($5.64379775 in the eight
records and $1.41021250 in the two stopped runs).

## Measured: English segment titles, Daniel to Malachi (#244)

ADR [0008](../decisions/0008-english-run-before-dispute-verdict.md): the
remaining books are drafted and checked before the #207 verdict, with
disputed titles held as for Genesis. Daniel and the twelve Minor Prophets
(Hosea to Malachi) were drafted on 2026-11-05 the way Genesis was: one
plain run of the CLI per book, one book after another, the same models, the
runner and its library as at `3b4cc37` (the runs started from `f27c015`,
which does not touch them; unchanged at `3e30817`, the base of this
change), and the prompt on main, `prompts/segment-titles.md` SHA-256
`e3e08e032d32…` (unchanged by this work).

```
node scripts/translate/segment-titles.ts --book DAN \
  --draft-model anthropic/claude-sonnet-5.5 \
  --check-model google/gemini-3.8-flash --max-cost 0.71 \
  --out .cache/segment-titles/len-DAN
```

`--max-cost` was 1.5 times the book's estimate (drafted segments × $0.0027,
Genesis's rate), at least $0.30: DAN 0.71, HOS 0.41, AMO 0.32, ZEC 0.39,
the rest 0.30.

Obadiah's first run ended `incomplete` (exit 2): the draft reply left out
the single-verse segment `OBA.1.19-19` (#252), so no record was written; it
cost $0.03649900 over 2 calls. It was run once more, plainly, and that run
is the record. Every other run exited 0 with outcome `done`, first time.
Each record was copied unchanged to `data/drafts/en/<BOOK>.json` (`cmp`: no
difference). The counts below were made twice from the records, with `jq`
and with Python, which gave the same values.

| Book  | Drafted    | Agreed | Disagreed: criteria                               | Gate failures  | Over 60 (longest) | Calls   | Cost        | Model time  |
| ----- | ---------- | ------ | ------------------------------------------------- | -------------- | ----------------- | ------- | ----------- | ----------- |
| DAN   | 174 of 176 | 170    | 4: `accurate` 3, `plain` 1, `style` 1             | 0              | 0 (58)            | 5 + 5   | $0.52021975 | 491.911 s   |
| HOS   | 101 of 101 | 96     | 5: `covers` 2, `plain` 2, `style` 2, `accurate` 1 | 0              | 0 (60)            | 3 + 3   | $0.36070900 | 307.640 s   |
| JOL   | 37 of 37   | 34     | 3: `accurate` 1, `covers` 1, `style` 1            | 0              | 0 (59)            | 2 + 2   | $0.12568075 | 135.978 s   |
| AMO   | 78 of 78   | 74     | 4: `style` 2, `covers` 1, `plain` 1               | 2 (`length` 2) | 2 (63)            | 3 + 3   | $0.19817825 | 174.256 s   |
| OBA   | 10 of 10   | 10     | 0                                                 | 0              | 0 (58)            | 1 + 1   | $0.03535975 | 31.734 s    |
| JON   | 21 of 22   | 21     | 0                                                 | 0              | 0 (57)            | 1 + 1   | $0.05694675 | 62.410 s    |
| MIC   | 51 of 52   | 50     | 1: `style` 1                                      | 0              | 0 (60)            | 2 + 2   | $0.12910850 | 122.605 s   |
| NAM   | 25 of 25   | 22     | 3: `style` 2, `accurate` 1                        | 0              | 0 (55)            | 1 + 1   | $0.08014375 | 91.382 s    |
| HAB   | 29 of 29   | 29     | 0                                                 | 0              | 0 (58)            | 1 + 1   | $0.07336150 | 44.302 s    |
| ZEP   | 23 of 24   | 21     | 2: `covers` 1, `plain` 1, `style` 1               | 0              | 0 (58)            | 1 + 1   | $0.08964125 | 76.066 s    |
| HAG   | 16 of 16   | 14     | 2: `accurate` 1, `style` 1                        | 1 (`length` 1) | 1 (61)            | 1 + 1   | $0.07941050 | 102.750 s   |
| ZEC   | 94 of 94   | 89     | 5: `covers` 3, `plain` 2, `style` 2               | 0              | 0 (58)            | 3 + 3   | $0.33765400 | 343.345 s   |
| MAL   | 24 of 24   | 22     | 2: `covers` 1, `plain` 1                          | 0              | 0 (56)            | 1 + 1   | $0.06729800 | 53.708 s    |
| Total | 683        | 652    | 31                                                | 3              | 3                 | 25 + 25 | $2.15371175 | 2,038.087 s |

Labels and sources: every row is measured 2026-11-05 from the committed
record. Drafted: `titles`; the other segments are their pericope's only
segment (DAN 2, JON 1, MIC 1, ZEP 1). Agreed: checker `agree`, all
`ai-checked`. Criteria: a title can name more than one. Cost and model
time: OpenRouter's billed `cost` and `ms` per call, summed, exact. Largest
completion: draft 6,827 of 16,384 (42%, DAN); check 22,319 of 32,768 (68%,
ZEC). No reply was cut off and every reply in these records was readable
(the runs end `done`). One draft call used 0 reasoning tokens (AMO batch
3); one of the 3 titles over 60 is in it. `npm run build` puts the 652
`ai-checked` titles in the tC Mobile title tables.

No third check was run and no dispute data is written (ADR 0008); the 31
disagreements stay `unreviewed`. Counts only; the checker's reasons and
suggestions were not read.

OpenRouter spend of this work: $2.19021075 ($2.15371175 in the thirteen
records and $0.03649900 in Obadiah's stopped run).

## Measured: English segment titles, Psalms, Song of Songs, Isaiah, Jeremiah, Lamentations (#244)

ADR [0008](../decisions/0008-english-run-before-dispute-verdict.md): the
remaining books are drafted and checked before the #207 verdict, with
disputed titles held as for Genesis. Psalms, Song of Songs, Isaiah,
Jeremiah and Lamentations were drafted on 2026-11-05 the way Genesis was:
one plain run of the CLI per book, one book after another, the same
models, the runner and its library as at `3b4cc37` (the runs started from
`f27c015`, which does not touch them; unchanged at `3e30817`, the base of
this change), and the prompt on main, `prompts/segment-titles.md` SHA-256
`e3e08e032d32…` (unchanged by this work).

```
node scripts/translate/segment-titles.ts --book PSA \
  --draft-model anthropic/claude-sonnet-5.5 \
  --check-model google/gemini-3.8-flash --max-cost 4.60 \
  --out .cache/segment-titles/len-PSA
```

`--max-cost` was 1.5 times the book's estimate (drafted segments × $0.0027,
Genesis's rate), at least $0.30: PSA 4.60, SNG 0.32, ISA 2.80, JER 2.33, LAM
0.30. Every run exited 0 with outcome `done`, first time. Each record was
copied unchanged to `data/drafts/en/<BOOK>.json` (`cmp`: no difference).
The counts below were made twice from the records, with `jq` and with
Python, which gave the same values.

Three books of this stretch are not here. Proverbs and Ecclesiastes ran to
`done` ($1.28170350 and $0.26111550), but three checker suggestions in them
are over 60 characters and fail the drafts test; #258 asks which way to go.
Ezekiel's run ended `incomplete` (the draft left out five single-verse
segments, #252; $1.55843675 over 32 calls, no record). Its one re-run,
made once the key's limit was raised, ended `incomplete` too (six other
single-verse segments; $1.55040300 over 32 calls, no record), so Ezekiel
is not drafted; #252 has the details.

| Book  | Drafted      | Agreed | Disagreed: criteria                                   | Gate failures              | Over 60 (longest) | Calls   | Cost        | Model time  |
| ----- | ------------ | ------ | ----------------------------------------------------- | -------------------------- | ----------------- | ------- | ----------- | ----------- |
| PSA   | 1134 of 1135 | 1080   | 54: `covers` 31, `accurate` 14, `plain` 10, `style` 6 | 0                          | 0 (60)            | 33 + 33 | $3.16346025 | 3,040.471 s |
| SNG   | 78 of 78     | 74     | 4: `covers` 2, `accurate` 1, `plain` 1                | 0                          | 0 (58)            | 3 + 3   | $0.20470225 | 214.515 s   |
| ISA   | 689 of 693   | 673    | 16: `style` 5, `accurate` 4, `covers` 4, `plain` 4    | 3 (`length` 3)             | 3 (64)            | 20 + 20 | $1.89613875 | 1,676.669 s |
| JER   | 573 of 575   | 559    | 14: `style` 7, `plain` 6, `accurate` 4                | 1 (`length` 1, `quotes` 1) | 1 (61)            | 17 + 17 | $1.63535600 | 1,367.391 s |
| LAM   | 67 of 67     | 64     | 3: `accurate` 1, `covers` 1, `plain` 1                | 0                          | 0 (58)            | 2 + 2   | $0.17476675 | 139.665 s   |
| Total | 2,541        | 2,450  | 91                                                    | 4                          | 4                 | 75 + 75 | $7.07442400 | 6,438.711 s |

Labels and sources: every row is measured 2026-11-05 from the committed
record. Drafted: `titles`; the other segments are their pericope's only
segment (PSA 1, ISA 4, JER 2). Agreed: checker `agree`, all `ai-checked`.
Criteria: a title can name more than one. Cost and model time:
OpenRouter's billed `cost` and `ms` per call, summed, exact. Largest
completion: draft 7,390 of 16,384 (45%, PSA); check 30,983 of 32,768 (95%,
PSA). No reply was cut off and every reply in these records was readable
(the runs end `done`). `npm run build` puts the 2,450 `ai-checked` titles in
the tC Mobile title tables (PSA 1,080 of 1,135, SNG 74 of 78, ISA 673 of
693, JER 559 of 575, LAM 64 of 67).

Observations from these runs (not trends):

- **A check reply came within 6% of its limit.** Psalms' largest check
  reply used 30,983 of `CHECK_MAX_TOKENS` (32,768). It was not cut off; a
  cut-off reply would leave titles unread and stop the run.
- **Long titles and calls that did not reason.** 3 of 75 draft calls used 0
  reasoning tokens (PSA, ISA and JER, one each); 3 of the 4 titles over 60
  are in those batches.

No third check was run and no dispute data is written (ADR 0008); the 91
disagreements stay `unreviewed`. Counts only; the checker's reasons and
suggestions were not read.

OpenRouter spend of this work: $7.07442400, the five records. (Proverbs
and Ecclesiastes, $1.54281900, are counted where they land; Ezekiel's two
stopped runs cost $3.10883975.)

## Measured: English segment titles, Proverbs and Ecclesiastes (#244, #258)

Proverbs and Ecclesiastes were drafted and checked on 2026-11-05 with the
Psalms group above: one plain run of the CLI per book, the same models, the
runner and its library as at `3b4cc37` (the runs started from `f27c015`),
and the prompt on main, `prompts/segment-titles.md` SHA-256
`e3e08e032d32…`. `--max-cost` was PRO 1.80 and ECC 0.49. Both runs exited 0
with outcome `done`, first time. They were held because three checker
suggestions in them are over 60 characters (`PRO.19.26-27` 61, `ECC.1.1-3`
61, `ECC.3.8-8` 62), which the drafts test then rejected. The maintainer
chose to hold only shipped titles to 60 characters (#258); the test now
does that, and the two records are copied unchanged to
`data/drafts/en/<BOOK>.json` (`cmp`: no difference). No book was re-run.
The counts below were made twice from the records, with `jq` and with
Python, which gave the same values.

| Book  | Drafted    | Agreed | Disagreed: criteria                                   | Gate failures    | Over 60 (longest) | Calls   | Cost        | Model time  |
| ----- | ---------- | ------ | ----------------------------------------------------- | ---------------- | ----------------- | ------- | ----------- | ----------- |
| PRO   | 442 of 442 | 319    | 123: `covers` 80, `style` 42, `accurate` 2, `plain` 2 | 6 (`length` 6)   | 6 (67)            | 13 + 13 | $1.28170350 | 1,207.237 s |
| ECC   | 120 of 120 | 94     | 26: `style` 22, `covers` 3, `accurate` 1              | 19 (`length` 19) | 19 (85)           | 4 + 4   | $0.26111550 | 260.254 s   |
| Total | 562        | 413    | 149                                                   | 25               | 25                | 17 + 17 | $1.54281900 | 1,467.491 s |

Labels and sources: measured 2026-11-05 from the committed records. Every
segment of both books shares its pericope, so all are drafted. Agreed:
checker `agree`, all `ai-checked`. Criteria: a title can name more than
one. Cost and model time: OpenRouter's billed `cost` and `ms` per call,
summed, exact. Largest completion: draft 7,291 of 16,384 (45%, PRO); check
22,432 of 32,768 (68%, PRO). No reply was cut off. `npm run build` puts the
413 `ai-checked` titles in the tC Mobile title tables (PRO 319 of 442, ECC
94 of 120).

Observations from these runs (not trends):

- **Proverbs has many disputes.** 123 of 442 (28%), 80 naming `covers`.
  Why is not measured; the checker's reasons were not read.
- **Ecclesiastes has many long titles.** 19 of 120 are over 60 (longest
  85), all in its two draft calls that did not reason, and all disputed.
  In both books, all 25 titles over 60 are in the 5 draft calls (of 17) that
  used 0 reasoning tokens.

No third check was run and no dispute data is written (ADR 0008); the 149
disagreements stay `unreviewed`.

OpenRouter spend of this work: $1.54281900, the two records.

## Not measured yet

| Quantity                                         | Why it matters                       | How it gets measured                                       |
| ------------------------------------------------ | ------------------------------------ | ---------------------------------------------------------- |
| Translation cost and time per title per language | 151,074 strings for v0.1             | the same book, translated into each v0.1 language          |
| Review minutes per title                         | the human-hours on the critical path | timed review of the first book's titles by a real reviewer |

Measured re-runs replace these rows; the estimate they replace stays in git
history.
