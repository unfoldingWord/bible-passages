# Progress tracker — bible-passages

Newest first. One entry per working session.

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
