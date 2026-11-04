# Progress tracker — bible-passages

Newest first. One entry per working session.

---

## 2026-11-03 — go/no-go 1 decided; English pericope titles for all 66 books; drafting and checking ready for the whole Bible

The requirements owner set the direction in the project call, and the maintainer recorded it as ADR 0005. Lanes ran in two waves, each a background agent in its own worktree. Every PR was reviewed by both bench lenses and merged pinned to the reviewed head on clean + green (the maintainer's grant for today). A PR whose base was behind main was first built and verified merged with main. 14 PRs merged, #195 to #224.

### Shipped

| What                                                                                                                                                                                                                                               | Evidence                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Go/no-go 1, a day early: v0.1.0 carries AI-checked English titles for the whole Bible; Titus is the reviewed sample; the content team's Q1 read-through becomes 1.0; the tag stays v0.1.0; disputes go to a third model                            | #195 (ADR 0005), AGENTS.md "Correctness first" |
| English pericope titles for all 66 books from the BSB headings: 3,016, re-derived independently with 0 mismatches                                                                                                                                  | #200                                           |
| Segment drafting stays within 60 characters (Colossians: 0 of 33 over, against 11 of 37 in Philippians) and names the readers instead of an unclear pronoun (Colossians re-drafts: 0 pronoun disputes, 33 and 32 of 33 agreed)                     | #202, #216                                     |
| Drafting and checking for any book: both run in batches of at most 35 titles; the check has 32,768 tokens and no longer cuts off                                                                                                                   | #210, #213                                     |
| Segment titles for Colossians (29 of 33 agreed), 1 Thessalonians (30 of 31) and 2 Timothy (26 of 30), each from one plain run                                                                                                                      | #212, #217, #224                               |
| Third-model dispute check (OpenAI as the third vendor): its input is blind to the first checker's suggestions; rule 8 says a rewrite must keep every verse's main point; the checker rechecks every rewrite. No third-check results are in `data/` | #203, #217, #222                               |
| Six Titus keeps recorded through `apply.ts`; all eight drafting-prompt examples now have a review record                                                                                                                                           | #221                                           |
| 6B for the whole-Bible review navigator: books, then chapters, then keep-or-reword                                                                                                                                                                 | #199                                           |
| Bench follow-ups                                                                                                                                                                                                                                   | #214, #222                                     |

`main` at `26f6857`: `npm run verify` 10,817 passed, 2 todo, 27 test files (run in the main checkout at `26f6857`).

### Measured

- **Review time per title** (first measurement): Hindi blind review of Titus, 33 titles in 16.4 min, mean 29.9 s. One reviewer, choosing between two candidates.
- **Model choice, unblinded on #64:** reviewer changes needed for Gemini against Claude were pt-BR 5 to 12 and Hindi 15 to 16, pooled 20 to 28. One reviewer per language; p ≈ 0.27.
- **Whole-Bible segment titles** (estimated from measured per-title rates, sizing.md): drafting $19–33, draft plus check $38–75.
- **Model spend today:** each lane's cost is in its PR and sizing.md; the lanes' totals were each under their caps.

### Decisions (the maintainer and the requirements owner, 3 Nov)

- ADR 0005: the go/no-go and the dispute rule. The tag stays v0.1.0.
- The repo stays at `unfoldingWord/bible-passages`, owned by unfoldingWord.
- Merge on clean + green, pinned to the reviewed head, for 3 Nov only.
- Model choice (#64): wait for an es-419 or French review.
- #203: merge the third-check code, not its Philippians data (#207).
- #209: the drafting prompt names the readers.
- #219: record the requirements owner's Titus keeps.

### Open

- **#207:** the maintainer's sample check of `docs/scoping/dispute-review.md`: 9 blind disputes, 2 taste and 7 factual. Rule 8 sorted 12 of the 14 Philippians disputes as factual, so it may be too strict. The recheck doesn't catch dropped points.
- **#208:** no long book drafted end to end yet (Genesis is estimated at $0.90–1.60).
- **#64:** the model choice waits on a review in another language.
- **Low follow-ups:** #209, #218, #220, #223.
- **Not re-checked today:** chunk source (#4), `en_twl` for 7 books (#57), Arabic headwords (#21), a Chinese reader (#31), a Philippians reviewer (#32), the #44 questions, OBS O1–O5 (#78). No release tagged.

### Next

- The sample check of the dispute review sheet, then decide on rule 8.
- A first long book end to end (#208), then the rest of the Bible in English.
- Ask for an es-419 or French reviewer for the Titus blind review (#64).

---

## 2026-11-02 — checks tightened across every gate; Chinese names checked against the CUV

Waves of 3–6 lanes, each a background agent in its own worktree. Every PR was reviewed by both bench lenses and merged pinned to the reviewed head on clean + green (the maintainer's grant for today). 27 PRs merged, #146 to #191. 26 issues closed.

### Shipped

| What                                                                                                                                                                                                                                                                                                                                                                                           | Evidence                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| zh-Hans key-term names are checked against the Chinese Union Version (pinned Door43 `zh_cuv` Titus at a full sha). A mismatch is flagged and goes to the reader rather than failing the build. Titus: 4 of 5 names agree; `names/crete` (革哩底 vs 克里特, 1:5, 1:12) is flagged and listed under `review`. A reader's third spelling needs a `review.reason` and is listed under `departures` | #184 (6B), #187 (ADR 0004, pin), #191; count re-derived by a second script |
| One list of the seven mandatory line breaks, shared by every gate. Titles, AI translations and key terms refuse controls and invisible format characters; each language's allowance is explicit (Hindi ZWJ measured 266× in Door43 tW; Hindi ZWNJ and Arabic signs are inference)                                                                                                              | #155, #173, #183, #185, #188, #190                                         |
| Review apply: one line-break list; `printable()` proven load-bearing; a batch stopped between renames is detected, refused and recoverable by re-running                                                                                                                                                                                                                                       | #154, #156, #168                                                           |
| Key terms: `human-reviewed` only for a well-formed review; exact refusal messages; own-key language lookups                                                                                                                                                                                                                                                                                    | #150, #155, #162                                                           |
| Source cache: stale `.tmp` files removed (threshold 163 s covers a whole download with retries); only removed files reported; listing, stat and unlink errors other than ENOENT rethrown, each pinned by a test                                                                                                                                                                                | #149, #157, #164, #170                                                     |
| Site snapshot script reads every page (the one on main failed once issues passed one page), parses Link headers per RFC 8288, refuses redirects and caps paging; CI checks `site/index.html` matches its source                                                                                                                                                                                | #152, #166, #171, #177                                                     |
| Metadata sizing notes: the text-mode CR read is enforced in the recipe; the #75 bench follow-ups closed (5 of 7 already done in #105; item 7 split to #174)                                                                                                                                                                                                                                    | #151, #172, #175, #182                                                     |
| 30 Oct tracker                                                                                                                                                                                                                                                                                                                                                                                 | #146                                                                       |

`main` at `ddcdcbe`: `npm run verify` 10,618 passed, 2 todo, 26 test files (run in the main checkout at `ddcdcbe`).

### Decisions (the maintainer, 2 Nov)

- Merge on clean + green, pinned to the reviewed head, for 2 Nov only.
- #53: treat the Chinese Union Version as public domain and build the names check (ADR 0004). The licence evidence conflicts and is recorded in the ADR: Door43 and eBible say public domain, while YouVersion names the Hong Kong Bible Society as copyright agent for the 1988 New Punctuation edition.
- #53: a reader may record a third spelling for a flagged name with a reason; the build lists those terms.

### Open

- Blind Titus review (#64): still 58 answers, all from the maintainer (en 25, pt-BR 33), checked 2 Nov. No Hindi answers saved.
- Go/no-go 1 is on 4 Nov. Review minutes per title are still not measured.
- Follow-ups: #174 (empty figure set, when metadata is built); #179 item 2 (Arabic and Syriac signs, when an Arabic-script language is drafted). Watch item, inferred and not observed: the `cuv` gate fails closed on a TWL reference to verse 0, which no Titus name has.
- The hourly site refresh runs a session script outside the repo; `scripts/site/snapshot.mjs` is not scheduled anywhere.
- Unchanged since 30 Oct, re-checked 2 Nov: chunk source (#4), `en_twl` for 7 books (#57), Arabic headwords (#21), a Chinese reader (#31), a Philippians reviewer (#32), the #44 questions, OBS O1–O5 (#78). No release tagged.

### Next

- Get the blind review answered in more languages, and read review minutes in time for go/no-go 1 on 4 Nov.
- Name a Chinese reader (#31); Crete is now the first flagged term.
- First real review export through `apply.ts` (dry run, then one PR).

---

## 2026-10-30 — bench follow-ups cleared, human review wired into the data

Four waves of 4–7 lanes, each a background agent in its own worktree; every PR reviewed by both bench lenses and merged pinned to the reviewed head on clean + green (the maintainer's grant for today). 24 PRs merged, #100 to #143.

### Shipped

| What                                                                                                                                                                                                                                 | Evidence                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| A person's review of a key term is recorded in the same record (`human-reviewed`, `review.by`/`at`); a changed headword is recorded like a reworded title (`review.text`, reviewer as built source, model wording kept as `drafted`) | #124, #136                         |
| `apply.ts` turns an export of the review artifact's answers into one change to `data/drafts/`; blind-comparison answers, stale keeps and changes without a reason refuse the whole batch                                             | #137, #141                         |
| Test suite steady under parallel load: downloads retry, cache writes are atomic, missing pins fetched once before tests, 4 workers; 18 concurrent warm runs went from 17/18 failed to 0/18                                           | #121 (measurements in PR body)     |
| A cached input whose bytes do not match its pin is downloaded again; a wrong pin still fails                                                                                                                                         | #142                               |
| Release checks: asset names are an allowlist of the real grammar; each table-body problem named; names quoted; `::error::` data escaped; the same 68 assets attach (counted two ways)                                                | #103, #117, #123, #143             |
| Key-term record invariants each shown to have a test that fails without them (the checks themselves were already in #76)                                                                                                             | #113, #102, #112, #131, #132, #140 |
| `termsFor` contract over every glossary (532 files, 116,025 keys); one verse-1 segment and pericope per chapter in all 66 books (1,189 chapters)                                                                                     | #100, #116, #126                   |
| Metadata sizing scripts share one marker rule; `npm test` stays Node-only, script A's check runs in the recipe; recipe still gives `diffs 0`                                                                                         | #105, #115, #127                   |
| Check ledger stores no absolute paths; `rederive.py` guards                                                                                                                                                                          | #104                               |
| Registry entry wording follow-ups                                                                                                                                                                                                    | #101                               |
| PR #49 split: its site Review tab closed as superseded by the review artifact; `apply.ts` landed in #137. #68 closed with it                                                                                                         | #49, #68 comments                  |
| Project site live snapshot refreshed hourly again, from a script that reads GitHub and the tree at `origin/main` (outside the repo, in the session's handoff folder)                                                                 | site `live/snapshot` v36           |

`main` at `06f0d8d`: `npm run verify` 10,431 passed, 2 todo, 20 test files (run in the main checkout at `06f0d8d`).

### Decisions (the maintainer, 30 Oct)

- Merge on clean + green, pinned to the reviewed head, for 30 Oct only.
- #91: a heading whose span starts at verse 1 also gets the superscription's terms. #92: private-use language tags are not supported in release asset names yet. #86: the README's project-home link stays (the artifact is restricted to the organization).
- #53: a person's review is recorded in the same record; a changed headword is recorded like a title; the FIA rendering stays binding for a linked term; the built glossary keeps `drafted`.
- #49: split; the site Review tab is dropped.
- #127: keep both metadata scripts; `npm test` stays Node-only.

### Open

- Blind Titus review (#64): only the maintainer's answers are saved (en 25/25, pt-BR 33/33). A reviewer reports finishing Hindi, but the review database holds no Hindi answers and no visit record for that reviewer; recovery needs them to reopen the page (answers kept in their browser, or "Copy my answers").
- No real export from the review artifact has gone through `apply.ts` yet; the first needs a reviewer handle and a dry run.
- Low follow-ups from the bench: #56, #109, #129, #130, #134, #135, #138, #144, #145.
- Unchanged from 29 Oct: chunk source (#4), `en_twl` for 7 books (#57), Arabic headwords (#21), a Chinese reader (#31), a Philippians reviewer (#32), the #44 questions, OBS O1–O5 (#78).

### Next

- Recover the Hindi answers; when enough blind answers are in, unblind and decide the translation model (ADR 0002).
- First real review export through `apply.ts` (dry run, then one PR).
- Release v0.1.0 when its gates pass (#13).

---

## 2026-10-29 (evening) — Open Bible Stories questions to the requirements owner

### Shipped

| What                                                                                                                                                                                                                           | Evidence     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| Open Bible Stories questions O1–O5 on the site's Decisions tab, each with a proposed option; site republished (v18)                                                                                                            | #97          |
| Counted for those questions: en_obs v9 has 50 stories and 598 frames (7–18 per story), one image per frame (artwork © Sweet Publishing, CC BY-SA 3.0); the Door43 catalog lists OBS in all 9 v0.1 languages                    | #97 body     |
| Plan and questions posted to the requirements owner on Zulip; two clause-level datasets from the bible-story-builder author recorded on #78 as a watch item for O3 (licences CC BY-SA 4.0 and CC BY 4.0; contents not checked) | #78 comments |

`main` at `4260d91`: `npm run verify` 9,702 passed, 2 todo (run on the #97 branch).

### Open

- O1–O5 answers from the requirements owner (#78); the #44 questions are not yet on the Decisions tab.

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

`main` at `9bfc685`: `npm run verify` 9,702 passed, 2 todo. Model spend today about $1.66 on OpenRouter, summed from the lanes' ledgers: Titus runs $1.37, smoke tests about $0.02, zh-Hans terms $0.17, Philippians $0.08, T1 re-translation $0.02.

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
