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
| Fri 13 Nov  | **Go/no-go 2: release** | Every v0.1 language through the quality gates; `dist/` passes tC Mobile's checker; release notes list review status per language                    | Slip the tag, or ship the subset that passes, as a recorded decision                        |
| Mon 16 Nov  | v0.1.0 tag (#13)        | Tagged, read by tC Mobile (#1459)                                                                                                                   | Recorded slip with a new date                                                               |

## If v0.1 must be a subset

The candidate, in order of what to keep:

1. Structure for all 66 books (pericopes and segments, permanent keys).
2. English pericope titles (BSB) and English segment titles.
3. Translations in the languages that pass the gates by 13 Nov.
4. The other languages in v0.1.x as they pass.

Every title ships with its status. The dataset request says the whole
dataset need not be human-reviewed before launch; which titles must be is
decision 1's to settle, and release notes say what was reviewed.

## Review hours

165,230 strings at an assumed 10 seconds each is about 459 hours, or about
46 hours per language _(estimated, recomputed 2026-11-02)_. The strings are
16,523 English titles (decision 12, ADR 0003: 3,016 pericopes + 13,770
segments − 263 single-segment pericopes, whose segment reuses the pericope
title) × 10 languages including English, the per-language count in
[sizing.md](sizing.md). The 16,523 uses the UFW chunk files; decision 8
(chunk source) is still open and would change it. The 10 seconds is an
assumption until a review is timed; no timing is recorded in the repo as of
2026-11-02.

Superseded 2026-11-02 (#148): "167,860 strings at an assumed 10 seconds each
is about 466 hours, or about 47 hours per language." That figure counted
16,786 titles a language, from before decision 12 (recorded 2026-10-29).

Reviewer assignments per language are open (schema.md, decision 7).
