# Scoping: review screen and sync to PRs

Component 8 ([review.md](review.md)), first increment, for #11: a reviewer's
approval in the project site's Review page reaches `data/drafts/` through a
reviewed PR. Never a push to `main`.

Findings marked _(reported)_ come from [review.md](review.md) and were not
re-run here. Everything else was observed at `edb9b04` on 2026-10-29.

## 6B

### Review page (project site)

| Step   | Verdict  | Evidence / justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Borrow | applied  | This repo's project site (`site/index.src.html` at `edb9b04`): its frame, brand tokens, menu and routing, and its Decisions page's pattern, where each signed-in viewer writes their own document (`resp/<id>`) and a work session reads the documents and turns them into repo changes. The `review` entry in `data/drafts/en/TIT.json` (`by`, `at`, `status`, `text`) and its merge in `scripts/data/build.ts`, already in use for the six titles decided on 28 Oct.                                                                                                                                 |
| Bend   | applied  | The per-viewer pattern bent to one document per reviewed title, under `review/<id>/items/` (below). The pilot artifact's Review tab _(reported)_: Approve and Suggest kept as Approve and Change the wording; Flag cut (see the UX pass). tc-mobile's right-to-left practice _(reported)_: `lang` and `dir` on every title, logical CSS properties, `dir="auto"` on free text. `scripts/lib/gates.ts` reused to check a reviewer's own wording in a translated language.                                                                                                                               |
| Break  | observed | (1) The Decisions page asks 17 questions written into the page source; titles change with `data/`, so the page needs its titles generated from the repo. (2) `data/` has no verse text, and a title cannot be judged without its passage; `plain()` in `scripts/lib/structure.ts` cannot read aligned verse USFM (run on BSB Titus 1:1 it throws `cannot read heading text`). (3) One document per reviewer would pass the database's 256 KiB document cap (runtime contract 0.2.92, `db.d.ts`) at about 1,000 reviews (estimated at ~250 bytes a record), well short of one language's 16,523 titles. |
| Beget  | skipped  | No uW team owns a GitHub-backed string review tool _(reported)_.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Bide   | n/a      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Build  | minimal  | A Review page on the site (traced to 1 and 3); `scripts/review/queue.ts`, which writes `site/review.json` from `data/drafts/`, the structure and the pinned BSB text (traced to 1 and 2), with `verseText()` in `scripts/lib/review.ts` (traced to 2).                                                                                                                                                                                                                                                                                                                                                 |

Reversibility: forward = low; backward = low. The page only writes its own
database collection; the repo is unchanged until a PR merges.

### Sync to PRs

| Step   | Verdict  | Evidence / justification                                                                                                                                                                                                                                                                                                                        |
| ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Borrow | applied  | The work session that already reads the site's database and opens PRs (the Decisions flow); `writeJson` in `scripts/lib/write.ts`, so applied files pass `prettier --check`; `npm run build` to carry reviews into `data/titles/` and `dist/`.                                                                                                  |
| Bend   | applied  | The session's database read bent into an export file the repo can check (shape below).                                                                                                                                                                                                                                                          |
| Break  | observed | The site cannot reach github.com ([site.md](site.md), Break), and a repo script cannot reach the artifact's database: only the artifact tools can, as the signed-in person. Two reviewers can review the same wording, and wording can change between a review and its PR: applying blindly would overwrite one person's change with another's. |
| Beget  | skipped  | As above.                                                                                                                                                                                                                                                                                                                                       |
| Bide   | n/a      |                                                                                                                                                                                                                                                                                                                                                 |
| Build  | minimal  | `scripts/review/apply.ts` (logic in `scripts/lib/review.ts`): applies an export oldest first, each record against the wording the ones before it left; refuses unknown keys, stale wording and bad records, all or nothing; passes over records an earlier batch applied; prints the PR body's table.                                           |

Reversibility: forward = low; backward = low. A batch is one PR; reverting it
reverts the reviews.

## UX pass

Process: the `uw-dev:ux-then-ui` skill, Pass A. Surface class: product (the
reviewer is already inside and trying to finish something). Design system:
locked (the site's tokens), so Pass B is "where it is spent", with no new
identity. Origin: greenfield on this site.

Premise not verified: the pilot artifact's Review tab was not opened in this
session (it belongs to the requirements owner); what it does is as reported
in [review.md](review.md).

### A0, the sentence

> This will be for a reviewer checking titles in their own language, often on
> a phone and in their second language, and the way it fails is by being
> built as though it has never met one: a table of every title to scan, a
> layout that assumes left to right, and a git step at the end.

Source: AGENTS.md, "Why, and the bar" (one thing at a time; many scripts and
right to left from the start) and [review.md](review.md) (works on a phone; a
reviewer never needs git).

### A1, the job list

1. **Who you are** (first visit only): choose a reviewer name. It is the only
   name stored, and it is public in the repo. Afterwards one line says who you
   are reviewing as, with Change.
2. **What to review**: one choice of language and book; a switch for "only
   titles I have not reviewed" (on by default).
3. **The title, alone**: where it is (book, reference, the passage heading
   around it), the passage itself, then the title in its language and
   direction. A translation also shows the English title.
4. **The one question**: does this title fit its passage? Approve, Change the
   wording, or Skip.
5. **Changing the wording**: the title in an editable field, in its language
   and direction, and why (required: the PR carries it, and a checker needs
   it).
6. **Moving on**: after a save, the next title not yet reviewed; Previous to go
   back. Progress as "title 3 of 25 · 22 left".
7. **The end**: how many are left or skipped, and what happens next (a
   maintainer turns reviews into a PR; after it merges the titles show their
   new status).

### A2, the states

| State                      | What the reviewer sees                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Not signed in, no database | Titles and passages, read-only; "Sign in to claude.ai to review"; buttons disabled.                             |
| Signed in, first visit     | Choose a reviewer name; the buttons stay disabled until it is saved.                                            |
| Returning                  | Starts at the first title they have not reviewed; their name on one line.                                       |
| Already reviewed           | "You approved it on 29 Oct" or "You changed it to …"; marked if the title changed since.                        |
| Saving / save failed       | "Saving…"; on failure "Couldn't save: …" and the title stays.                                                   |
| Bad wording                | One message under the field (empty, unchanged, over 60 characters, a full stop or quotes, markup).              |
| All done / skipped some    | The count, what happens next, "Go back to the ones I skipped", "See every title".                               |
| No titles                  | "There are no titles to review yet."                                                                            |
| Long and short content     | Titles wrap anywhere (`overflow-wrap:anywhere`); a passage of several verses keeps its verse numbers.           |
| Right to left              | Title, field and book name carry the language's `lang` and `dir`; the reference stays left to right in `<bdi>`. |

### A3, the ask, and what was cut

It asks one decision per title, and for a change, the new wording and why.

Cut: **Flag** (the pilot's third action). A flag without wording gives the
next person nothing to act on: a reviewer who knows what is wrong changes the
wording and says why; one who is unsure skips. Also cut: a reason on an
approval (the approval is the reason) and a free comment box.

### Gate 1

Not yet decided by a person. The page is built behind the gate so it can be
looked at: it is not published until the requirements owner approves this job
list and state inventory (the parent session publishes after merge).

### Many scripts and right to left

- Done: `lang` and `dir` on each title and its field from the language tag
  (`direction()` in `scripts/lib/review.ts`; `ar` and other right-to-left
  primary subtags); `<bdi>` and isolate marks around names inside left to
  right text; `dir="auto"` on the reason; logical properties
  (`margin-inline-end`, `text-align: start`). A reviewer's wording in a
  translated language passes the same script, length and leak gates as an AI
  translation before it is applied.
- Checked: in headless Chromium at 390 px wide, a page built with a synthetic
  Arabic set (not committed) shows the Arabic title right-aligned and right
  to left, and the reference `1:1–3` beside an Arabic book name in reading
  order.
- Not yet: the page's own words are English only; Arabic, Devanagari and Han
  fall back to system fonts; the passage is English (BSB) for every language.

## Data flow

1. `npm run build` ends with `node scripts/review/queue.ts`, which writes
   `site/review.json`: every title in `data/drafts/<lang>/<BOOK>.json` as it
   stands now, with its passage. CI fails if a rebuild changes it.
   `scripts/site/build.mjs` inlines it into the page.
2. A reviewer saves. The page writes, under the reviewer's own id:
   - `review/<id>`: `{ "v": 1, "handle": "reader-7", "at": "…" }`
   - `review/<id>/items/<lang>~<BOOK>~<key>`, one per title, replaced if they
     review it again:

     ```json
     {
       "v": 1,
       "handle": "reader-7",
       "lang": "en",
       "book": "TIT",
       "key": "TIT.1.4-4",
       "action": "edit",
       "seen": "Paul greets Titus, his true child in the faith",
       "text": "Paul greets Titus, his true son in the faith",
       "why": "The passage says son",
       "at": "2026-10-29T13:10:37.891Z"
     }
     ```

     `seen` is the wording the reviewer was shown; `text` and `why` are only
     on an edit, and `why` is required there.

3. A work session lists the `review` collection and each
   `review/<id>/items` collection and writes their documents, unchanged,
   to a file outside the repo:
   `{ "schema": "bp.review-export", "v": 1, "records": [ … ] }`. The ids in
   the paths are account identifiers and stay out of the repo and the export.
4. On a new branch: `node scripts/review/apply.ts <export.json>`, then
   `npm run build` and `npm run verify`. The script writes
   `review: { by: "reviewer:<handle>", at: "<date>", status: "human-reviewed", text?, why? }`
   into each title, and prints a table for the PR body. One PR per batch.
5. After review and merge, `data/titles/` and `dist/` carry the status
   `human-reviewed` and, for a change, the reviewer as `source`.

Database rules the page needs (declared when the site is published, as part
of the full rule set, which must restate the rules already declared for
`live`, `resp` and `final`):

```js
{ path: "review", read: "admin", write: "owner" },
{ path: "review/{self}", read: "interact", write: "interact" }
```

Each Contributor reads and writes only their own reviews; Editors and the
owner read all of them (the export needs that); only the owner can correct
another person's.

## Watch items

- **Size at scale** (estimated): the Titus queue is 10,368 bytes inlined for
  25 titles (measured, `site/review.json` at this PR), about 415 bytes a
  title; all 16,523 English titles would be about 6.9 MB, per language. Before
  a second book is queued, the queue moves to one file per book, loaded on
  demand.
- **Handles are not unique**: two reviewers can choose the same handle, and
  the export cannot tell them apart without account ids. The maintainer checks
  new handles in each batch. Untested as a risk; tracked here.
- **Approving someone else's wording** credits the approver as `source` (the
  `review` entry holds one reviewer). Fine for v0.1; revisit if two-person
  review is required.
- **Review minutes per title** are still not measured (plan gate, #3). The
  `at` times of one reviewer's consecutive records give a first measure.
