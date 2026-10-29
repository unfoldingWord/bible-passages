# Titus translation: Gemini and Claude compared

The one-page comparison ADR 0002 asks for, so the DRI can choose the
translation model for the other 65 books. It reports; it does not choose.
Run 2026-10-29, 14:04 to 14:19 UTC.

**Every number here is measured** unless it says otherwise: read from the
run ledgers (`run.json`) and the per-language files the runs wrote under
`.cache/` (not committed), and re-derived by a second, independent script
that counts from the language files and sums the per-call ledger entries
without reading any summary block. Both agree on every number below.

## The run

| Step                   | Command (key from the environment)                                                                                | Code                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Gemini translates      | `node scripts/translate/titles.ts --book TIT --model google/gemini-3.8-flash --allow-no-glossary --max-cost 1.00` | `4d92376` (#48)                                                        |
| Claude translates      | same, `--model anthropic/claude-sonnet-5.5 --max-cost 1.50`                                                       | `4d92376`                                                              |
| Claude checks Gemini's | `node scripts/translate/check.ts --run <Gemini run> --model anthropic/claude-sonnet-5.5`                          | `4d92376` (ar, es-419, fr, hi); `5982200` (id, pt-BR, ru, sw, zh-Hans) |
| Gemini checks Claude's | `node scripts/translate/check.ts --run <Claude run> --model google/gemini-3.8-flash`                              | `4d92376`                                                              |

All 9 non-English v0.1 languages, all 33 Titus titles (8 pericope headings,
25 segment titles): 297 translations per model. zh-Hans ran without a
glossary (none is committed for it yet). Same translation prompt for both
models (`prompts/translate-titles.md`, SHA-256 `4887f0d8…`), same check
prompt for both checkers (`prompts/check-translations.md`, `3838c35d…`).
Every call was answered by the model ID requested.

The check runs were split by language (`--lang`): OpenRouter refused some calls with
402 because the account's credit was low. A refused call returned no
usage, so it is on no ledger; I have no evidence that it was billed. `5982200` caps each call at 16,384 completion tokens so
the credit reserved per call is smaller; it changes nothing else, and the
largest completion on the run was 5,503 tokens.

## Per model

| Measure                                          | Gemini (`google/gemini-3.8-flash`)    | Claude (`anthropic/claude-sonnet-5.5`)         |
| ------------------------------------------------ | ------------------------------------- | ---------------------------------------------- |
| Titles translated                                | 297 of 297                            | 297 of 297                                     |
| Gate failures                                    | 0                                     | 0                                              |
| **Disagreements by the other model**             | **10**                                | **5**                                          |
| Agreements                                       | 286                                   | 292                                            |
| No verdict (checker left the key out)            | 1 (hi, 3:15)                          | 0                                              |
| Disagreements by criterion¹                      | accurate 3, terms 3, plain 3, names 1 | names 2, plain 2, accurate 1, terms 1, style 1 |
| Translation cost                                 | $0.21382                              | $0.41961                                       |
| **Translation cost per title**                   | **$0.00072**                          | **$0.00141**                                   |
| Translation tokens: prompt / completion          | 118,455 / 33,327                      | 151,948 / 11,571                               |
| of which reasoning                               | 25,572                                | 1,537                                          |
| Titles per hour of model time²                   | 4,343 (246.170 s)                     | 14,253 (75.017 s)                              |
| Checking the other's: cost per title             | $0.00071 (Gemini checking)            | $0.00177 (Claude checking)                     |
| Checking: tokens prompt / completion (reasoning) | 124,678 / 31,335 (23,405)             | 161,685 / 20,187 (12,464)                      |
| **Review minutes per title**                     | **not measured**                      | **not measured**                               |

¹ A disagreement can name more than one criterion. ² Sum of call times, one
call per language, run one after another.

For the choice rule, before review: the disagreement counts differ by
|10 − 5| / 10 = 0.50, above the tie line of 0.10 (ADR 0002, choice-rule
details, decided after this run and before any human review), so on the
early signal alone the cost tie-break would not come into play.
This page does not choose; the DRI does (ADR 0002, rule 4), with the
caveats below.

## Per language: disagreements by the other model

| Language | Gemini's translations (Claude checking) | Claude's translations (Gemini checking) |
| -------- | --------------------------------------- | --------------------------------------- |
| ar       | 0                                       | 0                                       |
| es-419   | 1                                       | 0                                       |
| fr       | 0                                       | 0                                       |
| hi       | 3 (+1 no verdict)                       | 1                                       |
| id       | 4                                       | 1                                       |
| pt-BR    | 0                                       | 0                                       |
| ru       | 0                                       | 1                                       |
| sw       | 2                                       | 0                                       |
| zh-Hans  | 0                                       | 2                                       |
| Total    | 10                                      | 5                                       |

Translation cost per language ranged $0.016 to $0.031 for Gemini and $0.015
to $0.064 for Claude. zh-Hans was the cheapest for both; its prompt carried
no glossary terms (2,448 and 2,924 prompt tokens, against 13,109 to 22,246
for the other languages).

## Examples of disagreements

| Verses  | English                                                   | Translation (model)                                                            | Checker said (criteria)                                                                         | Suggestion                                           |
| ------- | --------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1:10–11 | Rebellious people who mislead households must be silenced | Orang pemberontak yang menyesatkan keluarga harus dibungkam (Gemini, id)       | The headword for "household" is _rumah tangga_, not _keluarga_ (terms)                          | … menyesatkan rumah tangga harus dibungkam           |
| 2:6–8   | Titus instructs younger men                               | Titus menasihati orang-orang muda (Gemini, id)                                 | "Younger men" lost "men"; ambiguous about gender, and women are addressed separately (accurate) | Titus menasihati laki-laki yang lebih muda           |
| 1:4     | Paul greets Titus, his true child in the faith            | Paulo amsalimu Tito, mwanaye wa kweli katika imani (Gemini, sw)                | _amsalimu_ is subjunctive, not the present tense a heading needs (plain)                        | Paulo anamsalimu Tito, mwanawe wa kweli katika imani |
| 1:5     | Paul left Titus in Crete to appoint elders                | 保罗留提多在克里特任命长老 (Claude, zh-Hans)                                   | The Chinese Bible writes Crete as 革哩底 (names)                                                | 保罗留提多在革哩底任命长老                           |
| 1:10–11 | (same as above)                                           | Непокорным, которые вводят в заблуждение семьи, нужно закрыть рот (Claude, ru) | _закрыть рот_ is a colloquial, possibly rude idiom (plain, style)                               | … нужно заставить замолчать                          |
| 1:1–4   | Paul’s Greeting to Titus                                  | पौलुस की तीतुस को शुभकामना (Claude, hi)                                        | _शुभकामना_ means "best wishes", not a letter's greeting (accurate, plain)                       | तीतुस को पौलुस का नमस्कार                            |

Not checked: whether each checker was right. That is the reviewer's job; a
disagreement is a flag, not a finding.

## Read with care

- **Checker strictness is not calibrated.** Each model's count comes from
  the other model, so a stricter checker raises the other model's count. The
  counts are an early signal until a person reviews (ADR 0002, rule 1).
- **Claude drafted the English titles** (`data/drafts/en/TIT.json`), so it
  checked Gemini's translations of its own English.
- **Small numbers.** 10 and 5 disagreements out of 297 each; one title
  (1:10–11, "households") drew 4 of the 15 (es-419, hi and id for Gemini,
  ru for Claude).
- **Reviewer changes and review minutes are not measured**: they need a
  person to review the translations. Until then the comparison rests on
  checker disagreements.
- One run per model at temperature 0; not repeated, so run-to-run variation
  is not measured.

## Style rules (#41), measured on the same run

Neither model ended a title with a full stop or used quotation marks: 0 of
297 each. Both used an apostrophe in 5 French titles (_l’_, _d’_), which is
spelling, not quotation. Largest translation-to-English length ratio: 1.67
for each model, under the 2.2 gate.

## Spend

$1.37962 in all on 2026-10-29 for this lane, summed from every ledger: the
Titus run $1.36968 ($0.21382 + $0.41961 translating, $0.52524 Claude
checking, $0.21101 Gemini checking) and a 4-title smoke test $0.00994. Each
figure is rounded from the unrounded ledger sum. The spending cap was $5.
