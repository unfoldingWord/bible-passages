# The third check on disputed titles

Status: the step is built in #198 (part of #8), from ADR
[0005](../decisions/0005-go-no-go-1-ai-checked-english.md) item 6. **No
third-check results are in `data/` yet** (checked 3 Nov 2026):
`data/drafts/en/PHP.json` is the 29 Oct record, with no `dispute` and no
`disputeCheck`. A trial run on Philippians on 3 Nov is recorded below as a
measurement only, and kept as a test fixture
(`tests/fixtures/disputes/PHP-run1.json`). The maintainer decided on #203
to merge the code without the data.

**Gate before any results are written to `data/`** (#207): a rewrite must
keep each verse's main point, and agreement must be measured blind. The
trial run failed the first (below) and was not blind. The step was revised
for #207 on 3 Nov (rule 8, the recheck, a blind input) and run blind on
Colossians and 1 Thessalonians ([below](#revised-step-measured-3-nov-2026));
its answers wait on a person's sample check in
[dispute-review.md](dispute-review.md), and are not in `data/`.

## What it does

After the checker, every English segment title it disagreed with goes to a
third model, of a family other than the drafting model's (Anthropic) and
the checking model's (Google). The third model reads the segment in ULT and
returns `{kind, title, why}`:

- `taste`: its title replaces the draft and is `ai-checked` when it passes
  the gates and the recheck agrees with it (#207);
- `factual`: its title is a proposal; the title stays `unreviewed` and is
  listed by `npm run disputes` for the content team and the release notes.

Since #207, every title the third model gives goes back to the record's
checker in a second call (the **recheck**): the check part of the very
segment-title prompt the drafts were checked with (matched by SHA-256, in
`prompts/` or `prompts/history/`), the BSB verses, and the title as the
draft, with nothing else the third model said. Its verdict is kept as
`dispute.recheck`. A taste title the checker does not agree with stays
`unreviewed` and is listed with the factual ones. The third model is not
sent the checker's suggestion (blind); a test builds the message for every
disputed title of COL, 1TH and the PHP fixture and finds no suggestion, no
ADR 0005 proposed title and no person's review in it.

The drafted and checked record is never rewritten: the answer is added as
`dispute` beside it, as a person's `review` is (`docs/schema.md`). A
person's review still decides over it.

```
OPENROUTER_API_KEY=... node scripts/translate/dispute-titles.ts \
  --book PHP --model openai/gpt-6.1-sol --out .cache/dispute-titles/<run>
```

It writes the record, the ledger of both calls, and `review.md`, the sheet
for a person.

It is a separate step after `scripts/translate/segment-titles.ts`, not a
third call inside it, so the drafting prompt and runner can change without
touching it, and it can be re-run on a committed record alone.

## The third model: `openai/gpt-6.1-sol`

- **A third vendor.** The draft is Claude (Anthropic) and the check Gemini
  (Google); OpenAI is neither. The runner refuses a model of either family,
  both as requested and as OpenRouter reports it answered, and the build
  refuses a committed `dispute` by either family.
- **Measured on Philippians**, against one other third-vendor model
  (`x-ai/grok-4.7`), on the same prompt and inputs (below). GPT-6.1 Sol
  agreed with ADR 0005's hand sort on 12 of 14 kinds, gave the same kinds on
  a second run, and cost $0.014 to $0.023 a book. Grok 4.7 agreed on 9 of
  14, sorted 7 as factual, mostly where the BSB-based draft's wording
  differs from ULT's ("loves" for "have you in my heart", "mature" for
  "perfect"), and cost $0.225 and 7 minutes for the one run.
- Not chosen on general reputation: on this measurement only. One book,
  14 titles; the choice is revisited if a second book's sample disagrees.

## Philippians trial, first prompt (measured, 3 Nov 2026)

Input: the 14 titles the checker disagreed with in
`data/drafts/en/PHP.json` (the 29 Oct run), ULT `ult-php`
(unfoldingWord/en_ult v91, `35d2159`), BSB headings `bsb-php`, the Titus
voice from `data/drafts/en/TIT.json` (SHA-256 `091e772f…`), prompt
`prompts/dispute-titles.md` (SHA-256 `641cdbbb…`, kept since #207 as `prompts/history/dispute-titles-641cdbbb6d3d.md`). The prompt was written
before any run and was not changed after seeing results.

**Not a blind test.** The prompt was written after reading ADR 0005, and
its example of a factual dispute ("a word that could mean release from
prison or final vindication") is the ADR's own reason for 1:18–19. So
1:18–19's agreement is not independent evidence: on the other 13 titles,
runs 1 and 2 agree with the ADR on 11. Only kinds are compared. A taste
title can agree on kind and still lose part of the segment: run 1's 3:17–19
("Paul tells the Philippians to follow his example") and 2:14–16 drop the
"enemies of the cross" and the lights, which the ADR's proposed titles keep.

| Run            | Model              | Kinds               | Agrees with ADR 0005 | Tokens (reasoning)      | Cost      |
| -------------- | ------------------ | ------------------- | -------------------- | ----------------------- | --------- |
| 1 (fixture)    | openai/gpt-6.1-sol | 12 taste, 2 factual | 12 of 14             | 4,153 + 1,270 (481)     | $0.023081 |
| 2 (stability)  | openai/gpt-6.1-sol | 12 taste, 2 factual | 12 of 14             | 4,153 + 1,316 (495)     | $0.013581 |
| 3 (comparison) | x-ai/grok-4.7      | 7 taste, 7 factual  | 9 of 14              | 5,535 + 36,020 (35,256) | $0.225462 |

Lane spend: $0.262124, the sum of the three calls' billed cost in their
ledgers (`.cache/dispute-titles/*/run.json`, not committed).

Runs 1 and 2 gave the same kind for all 14 titles and the same wording for
8 of 14. Run 1's title equals the ADR's proposed title for 6 of 14 and the
checker's suggestion for 6 of 14. Every title in both runs passes the gates
(0 gate failures). Agreement was counted by a script comparing each run's
`dispute.kind` with the ADR table's Kind column, key by key.

### Where run 1 differs from the ADR 0005 table

| Key         | ADR     | Run 1       | Run 1 title                                                 | Why they differ                                                                                                                                                                                                                                                                                                                                       |
| ----------- | ------- | ----------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PHP.1.18-19 | factual | factual     | Paul rejoices that Christ is proclaimed                     | Agrees on kind. Run 1 drops "deliverance" altogether rather than keep the verse's word; the ADR kept it. Both avoid "freed".                                                                                                                                                                                                                          |
| PHP.2.12-13 | factual | **taste**   | Paul tells the Philippians to obey, for God works in them   | The disagreement that matters. Run 1 (and run 2) read "work out your own salvation" after "as you always obeyed" as a call to keep obeying, and kept the checker's suggestion. The ADR's sort reads it as putting the past tense in place of the command. A reading of the verse, not a wording question; written, the title would ship `ai-checked`. |
| PHP.2.17-18 | taste   | **factual** | Paul rejoices and urges the Philippians to rejoice with him | Run 1 (and run 2) say "if he dies" turns the drink-offering image ("poured out as a drink offering", ULT) into a plain statement about death. The ADR's sort accepted "if he dies". The cautious direction: the title is held `unreviewed`, not shipped.                                                                                              |

Two errors of different weight. 2:17–18 errs safe: a title would be held
back for the content team. 2:12–13 errs the other way: a title the hand
sort calls factual would ship `ai-checked`.

### Not written to the dataset

Run 1 was first committed to `data/drafts/en/PHP.json` in this PR (35 of 39
Philippians segments would have been `ai-checked`, up from 23). The
maintainer decided to merge the code without it. The reasons, filed as
#207:

- **Meaning lost in taste rewrites.** Kinds agreed, but titles dropped part
  of the segment's point: 3:17–19 drops "enemies of the cross", 2:14–16
  drops the lights, and 3:1–3 ("Paul warns the Philippians against evil
  workers") moves from confidence in the flesh to the evil workers.
- **The 2:12–13 miss** (above): a title the hand sort calls factual would
  have shipped `ai-checked`.
- **Not blind**: the prompt's factual example came from the ADR's reason
  for 1:18–19.

The run 1 record is kept unchanged as `tests/fixtures/disputes/PHP-run1.json`,
where the tests hold it to every rule the build applies.

### Known issues for the release notes

- None: nothing from the third check ships. Had run 1 been written,
  PHP.2.12-13 ("Paul tells the Philippians to obey, for God works in
  them") would have shipped `ai-checked` though ADR 0005's sort calls it
  factual.

## Revised step (measured, 3 Nov 2026)

The step as revised for #207: rule 8 in `prompts/dispute-titles.md` (keep
the main point of every verse), a factual definition that names leaving out
or replacing a verse's main point, no checker suggestion in the input, and
the recheck. Prompt SHA-256 `4ef5bbc9…`, committed in `9711b49`
(19:20:34 UTC) before any run below; ULT `ult-col` and `ult-1th` pinned in
the same commit (en_ult v91, `35d2159`); voice `data/drafts/en/TIT.json`
(`091e772f…`, as it stood before #221 recorded the Titus keeps; a rerun now
reads `c7d207ae…`). Third model `openai/gpt-6.1-sol`; recheck by each record's
checker, `google/gemini-3.8-flash`.

```
node scripts/translate/dispute-titles.ts --book COL --model openai/gpt-6.1-sol --out .cache/dispute-titles/l207-COL
node scripts/translate/dispute-titles.ts --book 1TH --model openai/gpt-6.1-sol --out .cache/dispute-titles/l207-1TH
node scripts/translate/dispute-titles.ts --book PHP --model openai/gpt-6.1-sol \
  --record .cache/l207/PHP-before-dispute.json --out .cache/dispute-titles/l207-PHP
```

All three exited 0. The PHP record is the fixture
`tests/fixtures/disputes/PHP-run1.json` with its `dispute` answers, its
`disputeCheck` and its dispute call removed; `jq -S` showed it equal to
`data/drafts/en/PHP.json`. Its recheck used the prompt PHP was checked
with, `prompts/history/segment-titles-f132f2195f80.md`, found by its hash. COL and 1TH were drafted, checked and rechecked with the
segment-title prompt `cc76a816…`, then `prompts/segment-titles.md`; since
#216 it is kept as `prompts/history/segment-titles-cc76a816652a.md`, and
a rerun finds it there by hash.

**Blind, and what that covers.** Colossians and 1 Thessalonians are blind:
the prompt was committed before either ran, by an author who had read
neither book's checker suggestions (the four in `COL.json` were never
opened; `1TH.json` did not exist until after the commit). After the commit
and before the run, the author saw 1 Thessalonians' one disputed key and
its criteria (`accurate`, `style`), fields the third model is sent anyway;
never a suggestion. The blind runs have no hand sort to agree with: a
person's answers on [dispute-review.md](dispute-review.md) are the
measure, and they are not in yet. Philippians is **not blind**: rule 8 was
written from #207's four losses.

| Book                  | Blind | Disputes | Kinds               | Recheck agreed | `ai-checked` | Dispute call: tokens (reasoning), time, id                           | Recheck call: tokens (reasoning), time, id                           | Cost      |
| --------------------- | ----- | -------- | ------------------- | -------------- | ------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------- | --------- |
| Colossians            | yes   | 4        | 2 taste, 2 factual  | 3 of 4         | 2            | 2,246 + 1,712 (1,437), 43.5 s, `gen-1793733912-0P1ufXMNoLcZDpM2mLig` | 1,007 + 6,758 (6,593), 44.9 s, `gen-1793733955-X8BPc7z9jz5dEMglg1er` | $0.048831 |
| 1 Thessalonians       | yes   | 1        | 0 taste, 1 factual  | 0 of 1         | 0            | 1,850 + 834 (759), 21.5 s, `gen-1793734000-UO8lZRa11GuXnu8qakxO`     | 671 + 831 (739), 8.2 s, `gen-1793734022-njfL9QALTmq4g3CQjUOt`        | $0.016583 |
| Philippians (fixture) | no    | 14       | 2 taste, 12 factual | 14 of 14       | 2            | 4,010 + 3,996 (3,106), 99.3 s, `gen-1793734038-korznxG3yjKsuOeSb1w9` | 2,469 + 1,683 (1,319), 12.8 s, `gen-1793734137-ch9B22IuJ3KeJFJgct7D` | $0.058147 |
| 2 Timothy             | yes   | 4        | 0 taste, 4 factual  | 3 of 4         | 0            | 2,250 + 2,218 (1,941), 51.7 s, `gen-1793741936-dnsgQnvQDk6Eb8eQQsI2` | 978 + 4,899 (4,729), 33.5 s, `gen-1793741988-Ja89oYMFPVLcRpQCP3Ko`   | $0.046908 |

Costs are OpenRouter's billed `cost` per call, summed. Counts were made by
the runner's summary and again by a Python script over each run's record,
which agreed. Lane spend, all measured: $0.123561 for these six calls and
$0.126988 for drafting and checking 1 Thessalonians
([sizing.md](sizing.md)), $0.250549 in all.

**2 Timothy (blind, measured 3 Nov 2026).** Added to enlarge the blind
sample, on the maintainer's decision of 3 Nov. Drafted and checked with the
current prompt (`838516080c8f…`, #216's readers rule) and the code at
`e383b1d` ([sizing.md](sizing.md)); ULT `ult-2ti` (en_ult v91, `35d2159`)
pinned in `14ee5f7` and the record committed in `40360b7`, both before the
run. Same third-check prompt (`4ef5bbc9…`, unchanged since `9711b49`),
voice `data/drafts/en/TIT.json` at `c7d207ae…`, recheck with the record's
own prompt (`prompts/segment-titles.md`, found by its hash) and checker
`google/gemini-3.8-flash`. Run 21:38:55 to 21:40:21 UTC, exit 0:

```
node scripts/translate/dispute-titles.ts --book 2TI --model openai/gpt-6.1-sol \
  --out .cache/dispute-titles/l2ti-2TI
```

Blind: before the run, the author saw the record's counts, its criteria
counts (`accurate` 2, `covers` 1, `plain` 1, `style` 1) and the call
ledger; never a checker suggestion or reason, a disputed key, or a title.
The third model's answers were first read after these numbers were
committed. Counts by the runner's summary and again by `jq` and Python
over the record, which agreed. Lane spend, measured: $0.078034 drafting
and checking, $0.046908 for the two calls above, $0.124942 in all.

### Philippians: the #207 cases under the revised step (NOT blind)

| Key         | #207 case                                                     | Run 1 (first prompt)                                             | Revised kind | Revised title                                                | Point kept? (inference, not a person's check)                                 | Ships `ai-checked`? |
| ----------- | ------------------------------------------------------------- | ---------------------------------------------------------------- | ------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------- | ------------------- |
| PHP.3.17-19 | drops "enemies of the cross"                                  | taste: Paul tells the Philippians to follow his example          | factual      | Believers follow Paul, not Christ’s enemies who face ruin    | kept, as "Christ’s enemies"                                                   | no                  |
| PHP.2.14-16 | drops "as lights"                                             | taste: Paul tells the Philippians not to complain or argue       | factual      | Believers live in peace and purity, holding the word of life | **not kept**: the lights are gone again ("the purity represented by shining") | no                  |
| PHP.3.1-3   | "trust in the flesh" → "evil workers"                         | taste: Paul warns the Philippians against evil workers           | factual      | Believers rejoice and avoid evil, trusting Christ, not flesh | kept ("not flesh"); the three warnings become "avoid evil"                    | no                  |
| PHP.2.12-13 | keeps "obey" for "work out your salvation" (the factual miss) | taste: Paul tells the Philippians to obey, for God works in them | **factual**  | Believers must work out salvation in fear; God works in them | caught: sorted factual, the command kept                                      | no                  |

So the 2:12–13 miss is caught, and none of the four would ship
`ai-checked`. But not for the reason #207 asked: all four are held because
they are now sorted factual, not because a taste rewrite kept the point or
the recheck refused it. The recheck agreed with every Philippians title,
including 2:14–16 without its lights.

### Findings

1. **Rule 8 moves most disputes to factual.** Philippians went from 2
   factual (run 1) to 12 of 14; most of the twelve name an omitted verse
   detail (4:18–20, "omits verse 20’s praise"), which ADR 0005's sort
   calls taste. It errs safe (held for the content team) but leaves 2 of
   14 Philippians titles `ai-checked` where run 1 had 12. On the blind
   books, 3 of 5 disputes are factual.
2. **The recheck checks accuracy and style, not completeness.** It refused
   COL.1.21-23 (accurate: "God reconciled …, not … Christ") and
   1TH.4.13-15 (plain, style), and agreed with everything else (17 of 19
   over the three runs). The check prompt it reuses tells the checker not to
   disagree because a detail is left out, so it cannot catch a lost verse
   point. A person's sample remains the only check of meaning.
3. **The blind sample is small**: 5 disputes over two books (Colossians 4,
   1 Thessalonians 1 of 31; its checker disagreed less than on any book so
   far). Both blind taste titles, the only ones that would ship, are
   COL.1.7-8 and COL.2.4-5.

Nothing from these runs is written to `data/`. #207's done-when needs the
maintainer's yes/no on [dispute-review.md](dispute-review.md).

## 6B

### Third check on disputed English titles

| Step   | Verdict  | Evidence / justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Borrow | applied  | `scripts/lib/segment-titles.ts` (`verseTexts`, `segmentInputs`, `gateProblems`, `family`), `scripts/lib/openrouter.ts` (`complete`), `scripts/lib/key-terms.ts` (`callRecord`), the ledger and `--out` pattern of `scripts/translate/segment-titles.ts`, at `b12ddb6`, unchanged. ULT Philippians, unfoldingWord/en_ult v91 at `35d2159` (`51-PHP.usfm`, CC BY-SA 4.0, manifest `rights: CC BY-SA 4.0`), the same release the Psalms and Song of Songs names are pinned from.                                                                                                                 |
| Bend   | applied  | `verseTexts`, written for BSB, read over ULT after removing ULT's `\ts\*` section markers (all 104 verses of Philippians read). The `review` pattern of `data/drafts/` (answer added beside the draft, build takes it) bent to the third model's answer as `dispute`. Review apply's "current wording" made to read it (`scripts/lib/review.ts`).                                                                                                                                                                                                                                             |
| Break  | observed | (1) No step settles a checker's disagreement: on 29 Oct, 14 of 37 Philippians titles were `unreviewed` with nothing to move them but a person (`data/drafts/en/PHP.json`). (4) The trial run's taste rewrites lose part of a segment's point (3:17–19, 2:14–16, 3:1–3) and miss one factual dispute (2:12–13): not yet fit to write (#207). (2) `verseTexts` on ULT as is: the `\ts\*` markers fail its "no USFM left" rule (37 in `51-PHP.usfm`, counted with `grep -o`). (3) `review.ts` took `text` as the title's wording, so a keep of a settled title would have been refused as stale. |
| Beget  | skipped  | ADR 0005 item 6 puts the step in this pipeline; no uW or partner team runs title disputes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Bide   | n/a      | Nothing in the field is converging on this; v0.1.0 needs it now (ADR 0005).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Build  | minimal  | `scripts/lib/dispute-titles.ts` (read, settle, validate, list), `scripts/translate/dispute-titles.ts` (runner), `scripts/review/disputes.ts` (list), `prompts/dispute-titles.md`, traced to Breaks 1 to 3. For #207 (Break 4): rule 8, the recheck call in `settleDisputes` (borrowing `checkMessage`, `readCheck`, `promptPart`, `CHECK_MAX_TOKENS` and the check part of `prompts/segment-titles.md` unchanged), and `reviewSheet` for the person's sample.                                                                                                                                 |

Reversibility: forward = low; backward = low. Answers are an added
`dispute` field and a call; removing them restores the drafted record byte
for byte.

## Watch items

- **ULT pins per book.** `ult-php`, `ult-col` and `ult-1th` are pinned. Each later book needs
  its `ult-<book>` pin before its third check runs; `pin-structure.ts` pins
  BSB and the chunks, not ULT.
- **Wording varies run to run** (8 of 14 the same on Philippians). Once
  results are written, the run written is a record; a re-run is a new
  record, not a correction.
- **A blind measure of agreement** (#207). The 12 of 14 is one book, one
  hand sort by another model, not a person, and not blind. The revised
  step's blind runs (5 disputes) wait on a person's answers in
  [dispute-review.md](dispute-review.md).
- **Factual over-sorting under rule 8** (finding 1 above): measured on
  Philippians only, not blind. Whether it holds on the blind books is the
  person's "factual call correct" column.
- **Known issues the list cannot show** (#206). `npm run disputes` lists
  the disputes that left a title `unreviewed` (every factual one, and a
  taste one the recheck did not agree with or that failed a gate), so an
  `ai-checked` taste title later found wrong (as PHP 2:12–13 would have
  been) is not on it. Nothing from the third check is in
  `data/` (checked 3 Nov 2026), so there is no such title to list yet. When
  results are written (#207), a title shipped with a known error goes in
  `CHANGELOG.md`, "Known issues", as AGENTS.md requires of every release.
