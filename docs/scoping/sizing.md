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
#226.

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
falls inside the Colossians range above ($0.0014 to $0.0025), so batches of
35 did not cost more per title on a long book. The checking rate ($0.0010
per title) gives less than the #201 estimate ($19 to $42 for all books); with the run-to-run spread of the
check, one book does not move that range.

Total OpenRouter spend of this work: $1.725863 (the second run; the first
made no call).

## Not measured yet

| Quantity                                         | Why it matters                       | How it gets measured                                       |
| ------------------------------------------------ | ------------------------------------ | ---------------------------------------------------------- |
| Translation cost and time per title per language | 151,074 strings for v0.1             | the same book, translated into each v0.1 language          |
| Review minutes per title                         | the human-hours on the critical path | timed review of the first book's titles by a real reviewer |

Measured re-runs replace these rows; the estimate they replace stays in git
history.
