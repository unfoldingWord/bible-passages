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
trial run failed the first (below) and was not blind.

## What it does

After the checker, every English segment title it disagreed with goes to a
third model, of a family other than the drafting model's (Anthropic) and
the checking model's (Google). The third model reads the segment in ULT and
returns `{kind, title, why}`:

- `taste`: its title replaces the draft and is `ai-checked` when it passes
  the gates;
- `factual`: its title is a proposal; the title stays `unreviewed` and is
  listed by `npm run disputes` for the content team and the release notes.

The drafted and checked record is never rewritten: the answer is added as
`dispute` beside it, as a person's `review` is (`docs/schema.md`). A
person's review still decides over it.

```
OPENROUTER_API_KEY=... node scripts/translate/dispute-titles.ts \
  --book PHP --model openai/gpt-6.1-sol --out .cache/dispute-titles/<run>
```

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

## Philippians (measured, 3 Nov 2026)

Input: the 14 titles the checker disagreed with in
`data/drafts/en/PHP.json` (the 29 Oct run), ULT `ult-php`
(unfoldingWord/en_ult v91, `35d2159`), BSB headings `bsb-php`, the Titus
voice from `data/drafts/en/TIT.json` (SHA-256 `091e772f…`), prompt
`prompts/dispute-titles.md` (SHA-256 `641cdbbb…`). The prompt was written
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

## 6B

### Third check on disputed English titles

| Step   | Verdict  | Evidence / justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Borrow | applied  | `scripts/lib/segment-titles.ts` (`verseTexts`, `segmentInputs`, `gateProblems`, `family`), `scripts/lib/openrouter.ts` (`complete`), `scripts/lib/key-terms.ts` (`callRecord`), the ledger and `--out` pattern of `scripts/translate/segment-titles.ts`, at `b12ddb6`, unchanged. ULT Philippians, unfoldingWord/en_ult v91 at `35d2159` (`51-PHP.usfm`, CC BY-SA 4.0, manifest `rights: CC BY-SA 4.0`), the same release the Psalms and Song of Songs names are pinned from.                                                                                                                 |
| Bend   | applied  | `verseTexts`, written for BSB, read over ULT after removing ULT's `\ts\*` section markers (all 104 verses of Philippians read). The `review` pattern of `data/drafts/` (answer added beside the draft, build takes it) bent to the third model's answer as `dispute`. Review apply's "current wording" made to read it (`scripts/lib/review.ts`).                                                                                                                                                                                                                                             |
| Break  | observed | (1) No step settles a checker's disagreement: on 29 Oct, 14 of 37 Philippians titles were `unreviewed` with nothing to move them but a person (`data/drafts/en/PHP.json`). (4) The trial run's taste rewrites lose part of a segment's point (3:17–19, 2:14–16, 3:1–3) and miss one factual dispute (2:12–13): not yet fit to write (#207). (2) `verseTexts` on ULT as is: the `\ts\*` markers fail its "no USFM left" rule (37 in `51-PHP.usfm`, counted with `grep -o`). (3) `review.ts` took `text` as the title's wording, so a keep of a settled title would have been refused as stale. |
| Beget  | skipped  | ADR 0005 item 6 puts the step in this pipeline; no uW or partner team runs title disputes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Bide   | n/a      | Nothing in the field is converging on this; v0.1.0 needs it now (ADR 0005).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Build  | minimal  | `scripts/lib/dispute-titles.ts` (read, settle, validate, list), `scripts/translate/dispute-titles.ts` (runner), `scripts/review/disputes.ts` (list), `prompts/dispute-titles.md`, traced to Breaks 1 to 3.                                                                                                                                                                                                                                                                                                                                                                                    |

Reversibility: forward = low; backward = low. Answers are an added
`dispute` field and a call; removing them restores the drafted record byte
for byte.

## Watch items

- **ULT pins per book.** Only `ult-php` is pinned. Each later book needs
  its `ult-<book>` pin before its third check runs; `pin-structure.ts` pins
  BSB and the chunks, not ULT.
- **Wording varies run to run** (8 of 14 the same on Philippians). Once
  results are written, the run written is a record; a re-run is a new
  record, not a correction.
- **A blind measure of agreement** (#207). The 12 of 14 is one book, one
  hand sort by another model, not a person, and not blind.
- **Bench follow-ups** (#206): the `disputeCheck` guard before the empty
  return, the ledger message on a pre-spend failure, and holding
  `disputeCheck.verses` to `ult-<book>`.
