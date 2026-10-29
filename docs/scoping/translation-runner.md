# Scoping: title translation runner

The runner behind component 7 ([ai.md](ai.md#7-translation)): it translates
one book's English titles into the v0.1 languages with one model, gates every
result and records what each call cost. Issue #10. 6B per
`.claude/skills/six-b/SKILL.md`, written before the code.

## 6B

| Step   | Verdict  | Evidence / justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Borrow | applied  | tc-mobile's four AI-draft gates (`tests/i18n-draft-quality.test.ts`, `develop` at `292611b6`, MIT), copied with attribution into `scripts/lib/gates.ts`. This repo's glossaries (`data/glossaries/`, from Door43 Translation Words) and the English style rules (`prompts/segment-titles.md`). OpenRouter's chat completions API, called with plain `fetch`: ADR 0002 needs a Gemini and a Claude model, and one API serves both. No uW repo in this workspace has a batch translation client to reuse (searched baruch, bt-servant-worker, translation-helps-mcp, tc-mobile for "openrouter": one type declaration, no client). |
| Bend   | applied  | The gates, from UI strings to titles: English leak compared on letters and digits only, case folded (so a trailing full stop does not hide it); scripture references (`TIT 1:4`, one of the 66 USFM book codes) and a reasoned per-language allowlist exempted from the script gate in place of brand words; length ratio re-tuned (below). tc-mobile's own AI-drafted UI tables reused as the length measurement. Not bent yet: bt-servant-worker's language detector (reported in [ai.md](ai.md#7-translation)); the smoke run returned every title in its language, so there is no Break to trace it to.                      |
| Break  | observed | 1. The gates are functions inside a test file, not exports (read at `292611b6`), so they cannot be imported. 2. Their 2.7 length ratio was set by two 5- and 6-character captions; on title-length text the measured maximum is 1.96 (below). 3. The script gate splits on spaces, and Chinese has none: `保罗问候テトス` was reported as one stray word, not as the kana `テトス` (this PR's first test run). 4. zh-Hans has no Translation Words, so no glossary ([glossaries.md](glossaries.md)). 5. ADR 0002 needs cost per title, which no existing step records.                                                           |
| Beget  | skipped  | No uW team translates dataset titles; ADR 0002 places the measurement in this repo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Bide   | n/a      | The models and the API exist now.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Build  | minimal  | `scripts/lib/gates.ts` (Breaks 1 to 3), `scripts/lib/openrouter.ts` and `scripts/lib/translate.ts` (Break 5: every call's model, tokens, cost and time), `scripts/translate/titles.ts` (the command; runs zh-Hans without a glossary only when told to, Break 4), `prompts/translate-titles.md`. No retry, no check pass, no write into `data/`: none has a Break yet.                                                                                                                                                                                                                                                           |

Reversibility: forward = low; backward = low. The runner writes under
`.cache/` (not committed); nothing in `data/` or `dist/` changes.

## Length ratio (estimated)

`LENGTH_RATIO_MAX = 2.2`, **estimated**: no title has been translated at
scale. Method: tc-mobile's AI-drafted UI tables (`src/lib/i18n/*.ts` at
`292611b6`), single-line string entries whose English is 20 to 80 characters
(Titus titles are 14 to 57, measured on `data/titles/en/TIT.json`), n = 124
per language. Largest draft-to-English ratio: id 1.96, pt 1.91, fr 1.83,
sw 1.74, ru 1.70, es 1.65, hi 1.62, zh-Hans 0.74; medians 1.06 to 1.27
(zh-Hans 0.33). Arabic has no drafted entries. A second, independent script
re-derived the same counts and maxima. 2.2 is the largest with about 10% room.
It is replaced by the ratio measured on the Titus run.

## Models

Proposed, as OpenRouter names them (its model list, read 2026-10-29):
`google/gemini-3.8-flash` (the newest fast Gemini model) and
`anthropic/claude-sonnet-5.5` (the model that drafted the English titles).
To be confirmed on #10, with the comparison rule, before the Titus run.

## Output

`<out>/<lang>/<BOOK>.json`: per key `text`, `source: "ai:<model>"`, status
`unreviewed`, `from` (the English it translates) and `gates` (problems, if
any). `<out>/run.json`, the ledger: the prompt's and inputs' SHA-256, every
call (model, OpenRouter generation id, prompt, completion and reasoning
tokens, cost in US dollars, milliseconds), keys missing, not text or
unreadable per language, why the run stopped, and totals (cost per title
delivered, titles per hour of model time). It is rewritten after every call
and on any failure, so money spent is always on record.

The spend limit (`--max-cost`, default 1.00 USD) fails closed: a call whose
cost OpenRouter does not report as a usable dollar amount stops the run
before the next call, and the run stops before a call once the limit is
spent (the call in flight can go over it). Exit 0 when every requested
title came back, 2 when the run stopped early or titles are missing, 1 on an
error.
