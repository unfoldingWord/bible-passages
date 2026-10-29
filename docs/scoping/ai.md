# Scoping: AI drafting and translation

6B evaluations (`.claude/skills/six-b/SKILL.md`). Findings marked
_(reported)_ come from a read-only survey of unfoldingWord repos on
2026-10-28 and have not been re-run here; the rest were checked directly.

## 5. Segment titles

About 13,770 English segment titles, drafted from each segment's ULT text and
Translation Notes, with an AI check pass (see [sizing](sizing.md)).

| Step   | Verdict  | Evidence / justification                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Borrow | applied  | Style: Translation Academy "Section Headings", `unfoldingWord/en_ta` `checking/headings` at `ce9a1bb` (CC BY-SA 4.0). It names five kinds (summary statement, explanatory comment, topical reference, question, "About" comment) and leaves the choice to the community, so the dataset still picks one. Inputs: `unfoldingWord/en_ult` at `04e15203`, Translation Notes. The requirements owner's pilot: 52 segment titles and a style guide. |
| Bend   | applied  | tc-mobile's AI-draft gates (`tests/i18n-draft-quality.test.ts` on `develop`: English leak, script, length, placeholder) ported to English titles as a length and form gate.                                                                                                                                                                                                                                                                    |
| Break  | none-yet | The pilot recorded no time or cost per title, and no book has been drafted end to end by a script.                                                                                                                                                                                                                                                                                                                                             |
| Beget  | skipped  | No uW team runs batch title drafting today. Named in the dataset request as work for this project.                                                                                                                                                                                                                                                                                                                                             |
| Bide   | n/a      | The models exist now; nothing to wait for.                                                                                                                                                                                                                                                                                                                                                                                                     |
| Build  | not-yet  | A batch drafting script: prompt from ULT text, Translation Notes and the chosen tA heading style; plain title plus evocative alternate; AI check pass; every draft stored with `source: "ai:<model>"`. Sized after one book is run.                                                                                                                                                                                                            |

Reversibility: forward = low; backward = low. Titles are data with a status;
a redraft is a new version.

Decision needed: which tA heading kind segment titles use. "Explanatory
comment" fits a short, plain title; this is a proposal, not a decision.

## 7. Translation

16,786 English titles into 9 more languages for v0.1 (ar, fr, hi, id, zh-Hans,
pt-BR, ru, es, sw): 151,074 strings. 26 languages later.

| Step   | Verdict  | Evidence / justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Borrow | applied  | Glossary seeds: translated Translation Words on Door43, CC BY-SA 4.0, for 8 of the 9 languages, measured 2026-10-28 with repos, releases and counts in [glossaries.md](glossaries.md): ar, es-419, fr, hi, id, pt-br, ru, sw. Format of tc-mobile's `docs/i18n/glossary.md` (a term table plus a drafting brief).                                                                                                                                                                                                |
| Bend   | applied  | tc-mobile's four draft gates (checked on `develop`), ported: they are functions inside a test file, not exports. bt-servant-worker's language detector (`src/services/language/detect.ts`) as a "is this the right language" check _(reported)_. tW headwords plus Translation Word Links map key terms to each title's verses.                                                                                                                                                                                  |
| Break  | observed | From reading the code, not from a run: the 2.7× length limit was tuned on French UI text (tc-mobile #1590) and must be re-measured on titles; the script check would flag Latin names or references inside non-Latin titles without an allowlist; **zh-Hans has no Translation Words on Door43** (measured, [glossaries.md](glossaries.md)); the Arabic final-yeh difference is one `ar`-tagged repo being Persian, and the Arabic repo used needs no normalising (measured, same file). No translation run yet. |
| Beget  | skipped  | A Chinese glossary is the piece another team could carry. No owner identified; to ask, with a fallback ([glossaries.md](glossaries.md#6b)).                                                                                                                                                                                                                                                                                                                                                                      |
| Bide   | n/a      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Build  | not-yet  | A batch translation runner with one glossary per language, the ported gates, and every string stored with its model and status. The model is an open decision (schema.md, decision 6); one suggestion is a fast Gemini model for translation with a Claude-built consistency and review script.                                                                                                                                                                                                                  |

Reversibility: forward = low; backward = medium. A change of model after
review has started means re-reviewing what changed.

## Watch items

- **Review hours dominate.** 167,860 strings at v0.1. Even at an assumed 10
  seconds a string that is about 466 hours of reading _(estimated; no review
  has been timed)_. The dataset request says not every title needs human
  review before launch; which ones do is a decision, not a sizing detail.
- Not verified: how complete or reviewed each Translation Words translation
  is.
