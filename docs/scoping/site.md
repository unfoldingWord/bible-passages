# Scoping: project site

## 10. Project site

A live page for the people steering this work: scope, sizing, sprints,
decisions, coverage by book and language, and checks. It updates itself.

| Step   | Verdict  | Evidence / justification                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Borrow | applied  | The tC Mobile project site (a Claude artifact, read 2026-10-28): a one-page app with a menu, a baseline snapshot in the page, and a database holding `live/snapshot` (written by a scheduled cloud routine every 3 hours), `resp/` (reviewers' picks), `final/` (recorded decisions), `lanes/` (agent work) and `cards/` (board). The unfoldingWord brand tokens and layout come with it. |
| Bend   | applied  | Same structure and database layout, pointed at this repo, servant.bible#1 and tc-mobile #1459. Its Review page holds this project's open decisions. The requirements owner's pilot artifact supplies the title-review screen (see [review.md](review.md)).                                                                                                                                |
| Break  | observed | From the tC Mobile site's own record (its Checks page): the page cannot reach github.com, so data has to be pushed in; GitHub's GraphQL API is blocked in cloud routines, so the routine uses REST only.                                                                                                                                                                                  |
| Beget  | n/a      |                                                                                                                                                                                                                                                                                                                                                                                           |
| Bide   | n/a      |                                                                                                                                                                                                                                                                                                                                                                                           |
| Build  | minimal  | This project's pages and a snapshot script, run by hand in work sessions, for its sources: repo commits and PRs, `data/` coverage, milestones as sprints, and the issue threads.                                                                                                                                                                                                          |

Reversibility: forward = low; backward = low. The repo stays the source of
truth; the site only reads it.
