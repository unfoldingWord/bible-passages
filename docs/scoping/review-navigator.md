# Scoping: whole-Bible review navigator

Component 8 ([review.md](review.md)), the review screen, widened to the
whole Bible for the content team's read-through of the English titles
(ADR 0005 #3, #11). The apply step that brings answers back to the repo is
already built ([review-apply.md](review-apply.md)).

The layout the maintainer asked for (3 Nov):

- Books in a column on the far left.
- Clicking a book lists its chapters, in columns just to the right.
- Clicking a chapter opens a pick-or-edit view like the current review page:
  accept or reword a title, and move on with as little effort as possible.

The bar (AGENTS.md): one thing at a time; works on a phone; right-to-left
and non-Latin scripts correct from the start; a reviewer never needs git.

Observed on 2026-11-03 unless marked.

## 6B

| Step   | Verdict  | Evidence / justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Borrow | applied  | (a) The Titus review artifact's answer record and storage (`reviews/<uid>/answers`: `key`, `lang`, `pick`, `changed`, `text`, `note`, `ms`, `shown`), which `scripts/review/apply.ts` already reads as `bp.review-export` v2. Reviewers have used it in three languages. (b) The data as built: `data/structure/<BOOK>.json` for books, chapters and keys, and `data/titles/en/` plus `data/drafts/en/` for the wording.                                                                                                  |
| Bend   | applied  | (a) tc-mobile's books screen (`unfoldingWord/tc-mobile` `src/components/books-screen.tsx` at `96141483`) has a book/chapter tree, collapsed by default so a long shelf stays short. Its pattern is bent to columns (book → chapters → titles) and not copied, because it is app code (1,916 lines). (b) The Titus page's pick-or-edit card is bent from "choose between two candidates" to "keep or reword one title". (c) Artifact comment mode, suggested by the requirements owner, as a second way to reword a title. |
| Break  | observed | (1) **Saving needed edit access.** A reviewer whose access was view-only (the maintainer's account, 3 Nov) answered all 33 Hindi Titus titles; nothing reached the database, and the answers were recovered only from their "Copy my answers" export on 3 Nov (#64). (2) **One book, no navigation.** The Titus page shows Titus only, in a fixed order, with no way to jump to a book or chapter (noted 30 Oct; not re-read today). [review.md](review.md) recorded the same Break for the pilot artifact (3 books).     |
| Beget  | skipped  | No uW team owns a title-review screen (review.md, Beget). The tc-mobile team owns the books-screen pattern, but not a review tool.                                                                                                                                                                                                                                                                                                                                                                                        |
| Bide   | n/a      | Nothing in the field is converging on this.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Build  | minimal  | A new artifact page: the book column, chapter columns and keep-or-reword card, writing the same answer documents as the Titus page (so `apply.ts` needs no change). Traced to Break 2. Its database rules let any signed-in viewer write their own `reviews/<uid>`, and a save is confirmed on screen. Traced to Break 1. Comment mode is not built in; see below.                                                                                                                                                        |

Reversibility: forward = low; backward = low. Answers are the same documents
`apply.ts` already reads; the page can be replaced without losing them.

## Comment mode: none-yet, measure first

The idea: reviewers highlight a title in a shared artifact and reword it in a
comment, and Claude picks the comments up. No Claude-side build would be
needed. Nothing has been run, so there is no Break yet.

The cheapest experiment, about 15 minutes:

1. Comment on three titles in a test page.
2. Read them back with the artifact comment tools.
3. Check that each comment can be tied to its title key without guessing.

Until that passes, comments are a second channel for notes, not the answer
record.

## Watch items (untested)

- **Size.** The whole Bible has 16,523 English titles (ADR 0003 #12). The
  page should load one book at a time, not all 66 at once. The page size has
  not been measured.
- **Review rate.** One measurement so far: Hindi Titus, mean 29.9 s per
  title, choosing between two candidates (ADR 0005). Keeping or rewording a
  single title may be faster; the first book reviewed in the new page
  measures it.
