# Progress tracker — bible-passages

Newest first. One entry per working session.

---

## 2026-10-29 (day) — 66 books of structure, translation measured on Titus, release path ready

Four waves of 3–5 lanes, each a background agent in its own worktree; every PR reviewed by both bench lenses and merged pinned to the reviewed head on clean + green (the maintainer's grant for today). 34 PRs merged, #29 to #95.

### Shipped

| What                                                                                                                                                                                                 | Evidence                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Structure for all 66 books: 3,016 pericopes, 13,770 segments, re-derived key by key by a second script; Titus byte-identical                                                                         | #40 (code + 130 pins), #37; `npm run verify` on main |
| Glossaries for the 59 books with a released TWL; the 7 without (NUM, 1CH, 2CH, ECC, ISA, JER, EZK) wait for a release (#57); CI caches downloads by `sources.json` hash                              | #52, #62                                             |
| Chinese (zh-Hans) key terms for Titus: 93 terms drafted by one model, checked by another, `ai-checked`; FIA key terms pinned as reference                                                            | #51, #76                                             |
| Translation runner, its gates, and the cross-model check; full-stop and quotation-mark gates in 9 languages                                                                                          | #36, #48, #74, #81                                   |
| Titus translated by both models (297 titles each): 10 checker disagreements for Gemini 3.8 Flash, 5 for Sonnet 5.5; run ledgers committed, translated texts withheld until the blind review ends     | #58, #77                                             |
| Model choice rule and its details recorded before any review results                                                                                                                                 | ADR 0002 via #47, #79, #93, #95                      |
| English title tables for tC Mobile (`dist/tc-mobile/titles/en/`), attached to releases as `titles.<lang>.<BOOK>.json`; dry-run release passed on GitHub                                              | #60, #87, #35 (run 40871047613)                      |
| Philippians English segment titles drafted (Sonnet) and checked (Gemini): 23 agree, 14 disagree (11 over 60 characters)                                                                              | #67                                                  |
| Psalms and Song of Songs book names from ULT v91                                                                                                                                                     | #80                                                  |
| Metadata sized for decision 11: figures of speech from Translation Notes v91 (20 kinds; names missing in pt-BR, sw, zh-Hans), literary form, parallels and book-level difficulty already in the data | #75                                                  |
| Decision 11 and T1 recorded; ADR 0001 move-back record; Servant.Bible entry scoped (already listed upstream as planned)                                                                              | #45, #33, #71                                        |
| Bench follow-ups closed: #22, #23, #38, #39, #41, #42, #43, #46, #50, #54, #55, #61, #66, #85, #89, #94                                                                                              | merged PRs above                                     |

`main` at `9bfc685`: `npm run verify` 9,702 passed, 2 todo. Model spend today about $1.55 on OpenRouter (Titus runs $1.38, zh-Hans terms $0.17, Philippians $0.08, T1 re-translation $0.02).

### Decisions (the maintainer, 29 Oct)

- Models `google/gemini-3.8-flash` and `anthropic/claude-sonnet-5.5`, each checked by the other; quality first, cost only within 0.10.
- A sample human review, blind, before choosing the model (#64), on a review page with per-reviewer answers.
- Release asset names for title tables; psalm superscription terms; Psalms and Song of Songs names; the two new gates.
- OBS template dataset goes in this repo, after v0.1 (#78).

### Open

- Reviewers for the blind Titus review (#64); a Philippians reviewer (#32); a Chinese reader (#31) and where a person's review of a key term is recorded (#53).
- Chunk source (#4, content team); `en_twl` release for 7 books (#57); Arabic headwords (#21).
- The review-screen PR #49 is parked as a draft after the 5-round cap.
- Servant.Bible description update upstream; five questions in `docs/scoping/servant-bible-entry.md`.
- The requirements owner's questions on #44 (book-level difficulty; literary form and parallels in v0.1).

### Next

- Collect the blind review answers and decide the translation model (ADR).
- Review Philippians and record minutes per title (#32), then scale English titles.
- Release v0.1.0 when its gates pass (#13).

---

## 2026-10-29 (late) — the requirements owner's decisions recorded; key check merged

### Shipped

| What                                                                                                                                                                                                                                       | Evidence                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| The requirements owner's answers recorded: v0.1 a gated subset, BSB pericopes, consensus check out, explanatory-comment titles, single-segment pericopes reuse their title (16,523 English titles), `es-419`, AI-drafted Chinese key terms | ADR 0003; PR #26, merge `20ac202`; `final/` on the project site             |
| T1–T6 Titus titles settled: 4 drafts kept, 2 in the requirements owner's wording, all `human-reviewed`; the AI draft and its check are kept beside the review                                                                              | `data/drafts/en/TIT.json` `review` entries; `build.ts` applies them; PR #26 |
| Key-stability check against every release tag, retired keys as an append-only log, release workflow; CI and release fetch tags before the check                                                                                            | PR #17, merge `7ac93e9`; both lenses clean at `e2af010`                     |
| Project site brought up to date on every page; snapshot refreshed                                                                                                                                                                          | PR #27; site version 14; `live/snapshot` version 11                         |
| #5 (site) and #9 (glossaries) closed against their Done-when                                                                                                                                                                               | issue comments with evidence                                                |

`main` at `7ac93e9`: `npm run verify` 931 passed, 3 todo; a cold `npm run build` left `data/` and `dist/` unchanged.

### Decisions

- Recording the requirements owner's picks (DRI, 29 Oct): picks are recorded as decisions, except a pick that adds unsized scope (11, all metadata), which is confirmed first, and 8, which is the content team's.
- Reviewed titles are a `review` entry on the draft, not an edit of the AI record; the build uses the review's status and wording.

### Open

- Decision 11 (metadata in v0.1): asked on Zulip 29 Oct; no reply yet.
- Decision 8 (chunk source): the content team (#4).
- #12: the key check is merged; a dry-run release has not been run.
- #2: ADRs for 8 and 11; moving decided items out of the schema's open list; #24.
- #21 (Door43 post, needs the maintainer's account); #22, #23 follow-ups.
- One correction made in the open: an evidence comment on #17 first said a YAML parse passed; no YAML parser is installed here, and the comment now says so.

### Next

- Translate Titus with both models and measure titles per hour, cost per title and review minutes (#10, #3, ADR 0002). This is the constraint.
- A dry-run release to close #12.

---

## 2026-10-29 — first Titus data on main; key rules decided

### Shipped

| What                                                                                                                                                         | Evidence                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Scaffold, rules, site source and scoping merged (on one bench lens: George failed 3 times on the head, the maintainer chose to merge on Frank's clean round) | PR #1, merge `52ed344`; exception recorded on the PR                            |
| Titus structure: 8 pericopes, 25 segments, pinned sources, CI rebuild gate                                                                                   | PR #15, merge `6b62feb`                                                         |
| 25 English segment-title drafts (Sonnet), checked by Opus: 19 `ai-checked`, 6 `unreviewed`                                                                   | PR #16, merge `9a74632`                                                         |
| Site: the 6 disputed titles (T1–T6) and decisions 13–14 on the Decisions tab                                                                                 | PR #19, merge `657a708`                                                         |
| Titus glossaries in 9 languages from pinned Door43 Translation Words                                                                                         | PR #20, merge `507dcab`                                                         |
| ADR 0001 (span keys; resize, split, merge, move-back; retired keys as an append-only log) and ADR 0002 (measure both translation models on Titus)            | PR #18, merge `2cda75f`; merged past the bench cap by the maintainer's decision |
| `v*` tag ruleset: only maintainers create, move or delete release tags                                                                                       | ruleset `release tags` (id 26084543), read back via the API; #23                |
| Follow-ups filed                                                                                                                                             | #22 (glossaries), #23 (release workflow), #24 (move-back title record)          |

`main` at `657a708` (before #20 and #18): `npm run verify` 42 passed, 4 todo; a cold `npm run build` left `data/` and `dist/` unchanged; CI green on each merge commit.

### Decisions

- Keys (DRI, 28 Oct): a key is always its span. A span that comes back revives its key; a key is never attached to a different span. This matches the tC Mobile contract ("A key is not reused for different content", `template-package-v0.md` at tc-mobile `373d42b4`).
- Split and merge: the named successor carries the titles; others get fresh drafts; nothing is deleted.
- Release defaults: one successor per retired key, draft releases, tags on `main` only; the tag ruleset is in place.

### Open

- PR #17 (key check against every release tag, release workflow): `main` merged in at `162ba91`, 930 tests pass; the bench is re-reviewing. The gate held the earlier clean rounds on a merge conflict.
- The requirements owner's answers on T1–T6 and decisions 1, 2, 9–14 (Decisions tab; Zulip pinged 28 Oct, no reply seen).
- #21: post the Arabic headwords request on Door43 (needs the maintainer's account).
- The bench treated a triage comment that quoted the grant phrase as a grant (#18, 00:55 UTC). Triage comments no longer quote it.
- Not measured yet: titles per hour, cost per title, review minutes per title (#3).

### Next

- Merge #17 once both lenses are clean at its head, with the maintainer's OK.
- #24: name the one publishable title record after a move-back (docs only).
- Translation runner on Titus (#10), measuring both models per ADR 0002.

---

## 2026-10-28 (evening) — scoping, sizing, sprints, project site

### Shipped

| What                                                                                                                                    | Evidence                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 6B scoping for every component, drawing on uW and partner work                                                                          | `docs/scoping/`; PR #1                                                                                                           |
| Sizing measured and independently re-derived: 3,016 pericopes, 13,608 chunks, 162 splits (194 naive), 1,184 ULT/UFW chunk disagreements | `docs/scoping/sizing.md`; second-model re-derivation matched every count                                                         |
| Sprint 1–3 milestones (renamed from 5–7 on 28 Oct) and issues #2–#14                                                                    | GitHub milestones 1–3                                                                                                            |
| Project site, with a database for picks and recorded decisions                                                                          | https://claude.ai/artifact/RiDFC57H2UCyKHe4ZwhvDT; `live/snapshot` written and read back at view level                           |
| Snapshot refreshed by hand; the scheduled routine is paused                                                                             | routine `trig_017eKbHFv181tiMyt76reL2T`: 2 runs on 28 Oct wrote nothing (401 with the sandbox token, 429 without); paused 28 Oct |
| Verified comment on servant.bible#1 with decisions and the 162 split chunks                                                             | issuecomment-6480617648                                                                                                          |
| Correctness-first practice and Klappy's canon in AGENTS.md; `six-b` skill                                                               | AGENTS.md "How we work"                                                                                                          |

### Open

- Review bench (`uwreview`) requested on PR #1 at `52d4616`; no verdict yet.
- The bench has not posted on any bible-passages PR (checked 28 Oct, 21:55 UTC); it posted on tc-mobile the same evening. Whether this repo is enrolled on the review VM is not visible from here. Review is never run locally (AGENTS.md, "Review").
- Decisions on servant.bible#1; the issue has no assignee.

### Next

- Titus end to end by 1 Nov (#3), with measured rates.

---

## 2026-10-28 — repo created and scaffolded

### Shipped

| What                                                                                                                 | Evidence                                                        |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Repo `unfoldingWord/bible-passages` created, public, `main`, CC BY-SA 4.0 data licence                               | initial commit `61abcd0`; GitHub reports licence `CC-BY-SA-4.0` |
| Scaffold PR: layout, draft schema, pinned sources, tc-mobile validator vendored at `8757e3a8`, checks, CI, repo docs | PR #1; CI green on first push; local `npm run verify`           |

### Decisions

- Name `bible-passages`, matching the Servant.Bible slug `uw/bible-passages`.
- Public. Data CC BY-SA 4.0, code MIT.

### Open

- The decisions listed at the end of `docs/schema.md`, for servant.bible#1.
- servant.bible#1 has no assignee.
- Branch protection on `main` and CODEOWNERS: not set.

### Next

- Post the open decisions to servant.bible#1 (draft first, maintainer posts or
  approves).
- First data PR once scope, pericope source and keys are settled.
