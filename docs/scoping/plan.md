# Plan to v0.1

Sprints are the repo's milestones, aligned with tC Mobile's. Issues: #2–#14.
Correctness outranks the date (AGENTS.md); each gate below either passes on
evidence or becomes a decision, never a quiet shortcut.

## Critical path

| Date (2026) | Gate                    | Passes when                                                                                                                                         | If it fails                                                                                 |
| ----------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Sun 1 Nov   | Titus measured (#3)     | Titus built end to end into `dist/`, with time and cost per title for drafting and translation, and review minutes per title from one real reviewer | Sprint 2 sizing stays an estimate; flag it on the site                                      |
| Sun 1 Nov   | Decisions (#2)          | Decisions 1 (scope), 2 (pericope source), 3 (keys) and 8 (chunk source) answered on servant.bible#1                                                 | Build on the proposals, marked provisional; keys are not released until 3 and 8 are settled |
| Wed 4 Nov   | **Go/no-go 1: scope**   | Titus rates × 66 books × 10 languages fit before 13 Nov, with cross-model checks included                                                           | Choose the v0.1 subset now (below) and say so on servant.bible#1                            |
| Sun 8 Nov   | English complete        | All 66 books: structure, pericope titles, segment titles, cross-model check done, checks green                                                      | Cut to the books done; the rest follow in v0.1.x                                            |
| Fri 13 Nov  | **Go/no-go 2: release** | English through the quality gates (v0.1.0 is English only, ADR 0006); `dist/` passes tC Mobile's checker; release notes list review status          | Slip the tag, or ship the subset that passes, as a recorded decision                        |
| Mon 16 Nov  | v0.1.0 tag (#13)        | Tagged, read by tC Mobile (#1459)                                                                                                                   | Recorded slip with a new date                                                               |

Changes since the table was written (5 Nov 2026, #244; 9 Nov 2026):

- **Decisions (1 Nov).** 1, 2 and 3 were decided (ADRs 0001 and 0003). 8 is
  settled for v0.1.0 by the maintainer: keys are built on the UFW chunk
  files and are not provisional for v0.1.0
  ([ADR 0007](../decisions/0007-v0.1.0-keys-on-ufw-chunks.md)). The content
  team's ruling is still asked for on #4; a ruling for ULT at a place gives
  it new keys in a later release.
- **Go/no-go 1 (4 Nov)** was decided on 3 Nov
  ([ADR 0005](../decisions/0005-go-no-go-1-ai-checked-english.md)).
- **English complete (8 Nov).** The draft and check of the remaining 60
  books run before the #207 verdict; disputed titles stay out of the tC
  Mobile files until the third check is accepted
  ([ADR 0008](../decisions/0008-english-run-before-dispute-verdict.md)).
- **Go/no-go 2 (13 Nov)** no longer waits on other languages: v0.1.0 is
  English only, and the other nine follow in v0.1.x once the model is
  chosen (#64) ([ADR 0006](../decisions/0006-v0.1.0-english-only.md)).
- **Metadata (9 Nov).** Key terms and figures of speech (ADR 0003
  decision 11) move to v0.1.x; v0.1.0's `dist/` is `dist/tc-mobile/` only.
  The package id `bible-passages:<BOOK>` is confirmed and permanent from the
  tag ([ADR 0009](../decisions/0009-metadata-to-v0.1.x-package-id.md)).

## If v0.1 must be a subset

Chosen on 5 Nov: items 1 and 2 are v0.1.0, and 3 and 4 are v0.1.x
([ADR 0006](../decisions/0006-v0.1.0-english-only.md)). Item 5 was added on
9 Nov ([ADR 0009](../decisions/0009-metadata-to-v0.1.x-package-id.md)). The
candidate, in order of what to keep:

1. Structure for all 66 books (pericopes and segments, permanent keys).
2. English pericope titles (BSB) and English segment titles.
3. Translations in the languages that pass the gates by 13 Nov.
4. The other languages in v0.1.x as they pass.
5. Metadata (key terms, figures of speech) in v0.1.x
   ([ADR 0009](../decisions/0009-metadata-to-v0.1.x-package-id.md)).

Every title ships with its status. The dataset request says the whole
dataset need not be human-reviewed before launch; which titles must be is
decision 1's to settle, and release notes say what was reviewed.

## Review hours

165,230 strings at an assumed 10 seconds each is about 459 hours, or about
46 hours per language _(estimated, recomputed 2026-11-02)_. The strings are
16,523 English titles (decision 12, ADR 0003: 3,016 pericopes + 13,770
segments − 263 single-segment pericopes, whose segment reuses the pericope
title) × 10 languages including English, the per-language count in
[sizing.md](sizing.md). The 16,523 uses the UFW chunk files, which v0.1.0's
keys are built on (ADR 0007); a later ruling for ULT on #4 would change it. The 10 seconds is an
assumption until a review is timed; no timing is recorded in the repo as of
2026-11-02.

Superseded 2026-11-02 (#148): "167,860 strings at an assumed 10 seconds each
is about 466 hours, or about 47 hours per language." That figure counted
16,786 titles a language, from before decision 12 (recorded 2026-10-29).

Reviewer assignments per language are open (schema.md, decision 7).
