# Scoping: cross-model check of translated titles

The check ADR 0002 asks for: each model's Titus translations are judged by
the other model, so the two can be compared on checker disagreements before
a person reviews them. Issue #10. 6B per `.claude/skills/six-b/SKILL.md`,
written before the code.

## 6B

| Step   | Verdict  | Evidence / justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Borrow | applied  | The English check's record, unchanged: `check` with `by`, `verdict`, and for a disagreement `criteria`, `why` and `suggestion` (`data/drafts/en/TIT.json`, `docs/schema.md`), and its status rule (`ai-checked` only on agreement). The runner's OpenRouter client, prompt filling, glossary lookup (`termsFor`), reply parser and `Call` ledger entry (`scripts/lib/openrouter.ts`, `scripts/lib/translate.ts`, #36). The rules a translation must meet: `prompts/translate-titles.md`, rules 1 to 6.                  |
| Bend   | applied  | The runner's per-language loop, ledger and spend fuse, lifted out of `runBook` into `runLanguages` so the check runs under the same fail-closed fuse; the runner's tests pass unchanged against it. The English criteria names (`accurate`, `plain`, `style`) reused for the same rules; `covers` dropped (a translation is judged against its English, which was checked against the verses); `terms` and `names` added for rules 3 and 4.                                                                             |
| Break  | observed | 1. The English check was done by an agent, not a script (#16: "drafting was done by an agent following a saved prompt, not by a scripted runner"); `prompts/` has no check prompt and no code in `scripts/` reads or writes a verdict (`grep -rl verdict scripts prompts`: none, on `edb9b04`). 2. Every translation the runner writes is `unreviewed` with no `check` (`scripts/lib/translate.ts`), so the Titus comparison has no disagreement count. 3. Nothing stops a model from checking its own family's output. |
| Beget  | skipped  | No uW team checks dataset titles; ADR 0002 places the measurement in this repo. Searched baruch (`5b39128`), bt-servant-worker, translation-helps-mcp and tc-mobile (`96141483`) for a model-as-checker or verdict format: none (a model-recommendation doc in translation-helps-mcp uses the word "verdict" for something else).                                                                                                                                                                                       |
| Bide   | n/a      | The models and the API exist now.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Build  | minimal  | `prompts/check-translations.md` and `scripts/lib/check.ts` (Breaks 1 and 2); the refusal of a same-family check, by provider, before the call and again on the answering model (Break 3); `scripts/translate/check.ts`, the command over a translation run. No retry and no write into `data/`: neither has a Break yet.                                                                                                                                                                                                |

Reversibility: forward = low; backward = low. The check writes under
`.cache/` (not committed) by default and refuses an `--out` inside `data/`
or `dist/` or one that already exists.

## What it does

`node scripts/translate/check.ts --run <translation run> --model <checker>`
reads the translation run's ledger and language files, and refuses to start
if the checker is of the translator's family (`google/…` against
`anthropic/…`), or if the English titles or a glossary have changed since
the run (SHA-256 against the run's ledger). The family is read leniently
(trimmed, case-folded, any repeated `ai:` prefix dropped), so a hand-edited
`source` cannot pass for another family, and a family ADR 0002 does not name
is refused. Every language file is checked (shape, family, English) before
the first call, so no language is billed before a later one is refused. It then sends each language's
translations in one call with the English title, the verses and the key
terms with their headwords, under `prompts/check-translations.md`.

Each verdict is `agree`, or `disagree` with the failed `criteria`
(`accurate`, `terms`, `names`, `plain`, `style`), `why` (one English
sentence, for the reviewer) and a `suggestion` (a corrected translation). A
verdict that is not well formed is recorded as invalid, not guessed at.

**Status.** A translation becomes `ai-checked` only when the checker agreed
**and** every gate passed; a disagreement, a gate failure or a missing or
invalid verdict leaves it `unreviewed`, for a person first. Nothing goes
above `ai-checked`.

Output: `<out>/<lang>/<BOOK>.json`, the checked titles, and `<out>/run.json`,
the ledger (the translation run it checked and that run's ledger hash, every
call with tokens including reasoning, cost and time; totals: agree,
disagree, disagreements per criterion, cost per check, checks per hour).
Same spend fuse as the runner (`--max-cost`, default 1.00 USD).

## Where translations live in `data/`

**`data/drafts/<lang>/<BOOK>.json`**, the file the checker writes, as is.

- `docs/schema.md` already defines `data/drafts/<lang>/<BOOK>.json` as the
  committed home of AI-drafted titles, which the build never clears, so a
  rebuild cannot wipe them; English Titus and Philippians are there now.
- A translation is the same kind of thing: AI output that a person reviews,
  with its check beside it. Keeping it next to the English drafts means one
  record shape (`text`, `source: "ai:<model>"`, `status` no higher than
  `ai-checked`, `check`, later `review`) and one status rule for every
  language.
- It carries two fields the English drafts do not: `from`, the English it
  translates, so a later change to the English shows; and `gates`, the
  machine gate problems, if any.
- Its keys are every titled key in the English table, pericopes as well as
  segments, since both are translated.
- `data/titles/<lang>/<BOOK>.json` stays the built table: the build will
  merge each draft's `text`, `status` and `source` there, as it does for
  English. That merge, and committing any translation, come after the DRI
  chooses the model (ADR 0002); this change commits no translation.

Rejected: committing translations into `data/titles/<lang>/` directly (the
build owns that file and would lose the check), and keeping them only in
`.cache/` (not reviewable or reproducible from the repo once chosen).
