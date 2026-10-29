# Scoping: review

## 8. Review

People approve, flag or suggest a change for each title, in their language,
and the result returns to this repo as a versioned change.

The bar (AGENTS.md, "Why, and the bar"): one thing at a time on screen, works
on a phone, right-to-left and non-Latin scripts correct from the start, and a
reviewer never needs git.

Findings marked _(reported)_ come from a read-only survey of unfoldingWord
repos on 2026-10-28 and have not been re-run here.

| Step   | Verdict  | Evidence / justification                                                                                                                                                                                                                                                                                                                      |
| ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Borrow | applied  | The requirements owner's pilot artifact already has a Review tab: comments on any title, Approve / Flag / Suggest, one review record per reviewer in the artifact's database (checked: its stored rules give `reviews/{self}` write access to each viewer). It is the closest working review tool and reviewers have seen it.                 |
| Bend   | applied  | bible-editor's patterns: row history, provenance, review flags, a gate on AI row changes _(reported)_. tc-mobile's right-to-left patterns: `dir="auto"`, logical CSS properties, mirrored icons _(reported)_.                                                                                                                                 |
| Break  | observed | Reviews in the pilot artifact stay in the artifact's database; nothing carries them to the repo. Every uW write-back tool found (tc-create-app, bible-editor) writes to Door43, not GitHub _(reported)_. The pilot covers 3 books; a whole Bible needs filtering by book, language and status.                                                |
| Beget  | skipped  | No uW team owns a GitHub-backed string review tool. If bible-editor's team would take title rows, that changes; to ask.                                                                                                                                                                                                                       |
| Bide   | n/a      |                                                                                                                                                                                                                                                                                                                                               |
| Build  | minimal  | (a) The review screen, borrowed from the pilot artifact and widened to all books, languages and statuses. (b) A sync step: an agent reads the reviews from the artifact database and opens one PR per batch, changing `status` and `source: "reviewer:<handle>"` in `data/titles/`. Never a direct push to `main`. Traced to the Break above. |

Reversibility: forward = low; backward = low. Reviews are data in the repo;
the screen can be replaced without losing them.

## Open

- Who reviews each language, and which titles must be reviewed before v0.1
  ships (schema.md, decisions 1 and 7).
- How long a review takes per title: never timed. The first book's review is
  where it gets measured.
