# Scoping: applying reviews from the review artifact

Component 8 ([review.md](review.md)), the sync step, for #11: a reviewer's
answer in the review artifact reaches `data/drafts/` through one reviewed PR
per batch. Never a push to `main`.

On 2026-10-30 the maintainer split PR #49: its site Review tab is dropped,
because human review of titles now runs on a separate review artifact (a
claude.ai page with its own database, not in this repo). #49's applier is
kept and its input changed to the artifact's answer documents. The export
format is in [schema.md](../schema.md#review-exports).

Observed at `892e602` on 2026-10-30 unless marked. Findings marked
_(PR #49)_ were observed there (at `c6df74a`, branch `feat/review-screen`)
and not re-run here.

## 6B

| Step   | Verdict  | Evidence / justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Borrow | applied  | PR #49's applier, `scripts/lib/review.ts` and `scripts/review/apply.ts` at `c6df74a`, and its tests: all or nothing; oldest first, each record against the wording the ones before it left; `review.saved` so a re-run passes over applied records; a status never lowered; a reviewer's wording through the same gates as any title; files staged beside their targets, then renamed. The `review` entry in `data/drafts/en/TIT.json` and its merge in `scripts/data/build.ts`, already in use. `gateProblems` (`scripts/lib/segment-titles.ts`) and `titleProblems` / `leakProblems` (`scripts/lib/gates.ts`) as the wording gates.            |
| Bend   | applied  | #49's record (`handle`, `book`, `action`, `seen`, `why`) bent to the artifact's answer document (`pick`, `changed`, `text`, `note`, `ms`, `shown`; the book read from the key). The reviewer moves from each record to the export envelope (`bp.review-export` v2), named by the work session. #49's English wording rule (60 characters, no full stop or quotes) replaced by the drafting gates, so a person's English title is held to exactly what an AI draft is.                                                                                                                                                                            |
| Break  | observed | (1) An answer document has no `seen`: for a change, `text` is the new wording and nothing records the wording it replaced (the record format given for this work, an English answer from the artifact, 2026-10-29). #49's stale check (`seen` against the title) cannot run on a change. (2) The artifact writes answers from blind-comparison tabs in the same collection, with `pick` a candidate id or `both` and `shown` the candidates; #49's record check would report a list of missing fields rather than say what they are. (3) Records carry no reviewer: the `<uid>` in the path is an account identifier and may not enter the repo. |
| Beget  | skipped  | The artifact belongs to the requirements owner's lane, outside this repo. Asking it to record `seen` on a change is a watch item below, not a dependency.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Bide   | n/a      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Build  | minimal  | The record check and the export envelope for the new format (traced to 2 and 3); the rule for a change without `seen` (traced to 1, below). Nothing else of #49 changes in kind.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

Reversibility: forward = low; backward = low. A batch is one PR; reverting it
reverts the reviews. The export is a file outside the repo.

Not ported from #49: the site's Review page, `scripts/review/queue.ts`,
`site/review.json`, `verseText()` and `direction()` (only the page used them),
and their CI step.

## Decisions in this increment

- **A keep is checked by its `text`.** The artifact shows the title and a
  keep stores what it showed. Observed for one record: the English example
  for `TIT.1.1-3` has the same `text` as `data/drafts/en/TIT.json` at
  `892e602`. A keep whose `text` is not the title as it stands is stale and
  stops the batch.
- **A change applies only to a title still in the draft's own wording.** With
  no `seen`, a change made against a person's earlier wording cannot be told
  from one made against the draft's. Taking the draft's wording would let a
  second change silently overwrite a first one; so a change to a title that
  already carries a person's `review.text`, from an earlier batch or earlier
  in the same batch, is refused. Two reviewers changing one title in a batch
  is therefore a refusal that a person settles (drop one record and re-run).
  Measured at `892e602` (a Node and a Python count of `data/drafts/en/*.json`
  agree): 6 Titus titles carry a `review`, 2 of them with a person's wording;
  Philippians has none. Those 2 are open to a keep but not a change.
- **Blind-comparison answers refuse the batch.** Skipping them would also
  work, but a mixed export means it was assembled from the wrong collection,
  and refusing says so before anything is written.
- **One reviewer per export file**, several files per run, applied as one
  batch in time order.
- **A note is cleaned, not refused.** Line breaks become spaces and control
  and bidi characters are removed; a change whose note is empty after that is
  refused. #49 refused a padded reason; a note typed on a phone may end in a
  space, and refusing the whole batch for it helps no one.
- **`ms` is not stored.** It is validated and summed in the printed table,
  the first measure of review time per title (plan gate #3).

## Watch items

- **`seen` on a change.** If the artifact records the wording it showed on a
  change, the applier can check a change as it checks a keep and stop
  refusing changes to reworded titles. Untested; raised for the artifact's
  owner.
- **Handles are assigned by the session**, not chosen by the reviewer: the
  same person must get the same handle in every export, or the history of
  who reviewed what splits. The session keeps that mapping outside the repo.
- **Clocks**: `at` comes from the reviewer's device. A record more than an
  hour ahead of the applier's clock is refused, since its time would close
  the title to later reviews. A clock running behind can save a new answer
  with a time before one already applied; it is passed over and listed in
  the output. Untested in use.
- **Multi-file atomicity** (#56): the renames still run one file at a time.
  Open, out of scope here.
