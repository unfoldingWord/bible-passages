# 0008: Draft and check the remaining English books before the third-check verdict

- **Status:** accepted
- **Date:** 2026-11-05
- **Decided by:** the maintainer, on #244 (decision 3 there). Replaces the
  maintainer's 4 Nov decision that the whole-Bible English run starts after
  the #207 verdict.

## Decision

1. **The English segment-title draft and check for the remaining 60 books
   starts now**, before the verdict on #207 (the person's sample check of
   the third check, rule 8).
2. **Disputed titles are held back until the third check is accepted.**
   A title the checker disagrees with stays as drafted, `unreviewed`, with
   no third-check answer (`dispute`) written to `data/`, and so is left out
   of the tC Mobile title tables. This is how the 5 books drafted after
   Titus stand; Titus's 6 disputes were settled by a person's review
   (ADR [0003](0003-v0.1-scope-and-titles.md)).
3. **The third check runs on them only after #207 accepts it**, under ADR
   [0005](0005-go-no-go-1-ai-checked-english.md) item 6 as revised for #207
   ([`../scoping/dispute-check.md`](../scoping/dispute-check.md)).

## What it replaces

The 4 Nov decision, recorded in the session log
([`../progress_tracker.md`](../progress_tracker.md), 2026-11-04,
"Decisions"): "The whole-Bible English run starts after the #207 verdict and
#226 (now done)." #226 is closed; the #207 condition is what this decision
drops. Nothing else in ADR 0005 changes.

## Evidence

- **Rule 8 is only in the third-check prompt.** It is rule 8 of
  `prompts/dispute-titles.md`. The draft and check read
  `prompts/segment-titles.md`, which has no such rule (both read on 5 Nov,
  base `3b4cc37`). So the verdict on rule 8 does not change what the draft
  and check produce.
- **6 books are drafted and their disputes are held.** `data/drafts/en/`
  has 1TH, 2TI, COL, GEN, PHP and TIT. In each, every title the checker
  disagreed with has draft status `unreviewed` and none has a `dispute`
  (counted with a Node script on 5 Nov): GEN 40 of 642, PHP 14 of 37,
  COL 4 of 33, 2TI 4 of 30, 1TH 1 of 31, and TIT 6 of 25, each of which
  has a person's `review` (`human-reviewed`). 66 − 6 = 60 books remain.
- **Unreviewed titles do not reach tC Mobile.** `../schema.md`,
  "`dist/tc-mobile/`": the status floor is `ai-checked`; `unreviewed` titles
  are left out. Observed: `PHP.1.7-8` (disputed, `unreviewed`) is in
  `data/titles/en/PHP.json` and not in `dist/tc-mobile/titles/en/PHP.json`.
- **The run is measured.** About $36 and 8 hours of model time for every
  segment title, estimated from Genesis's per-title rates
  (`../progress_tracker.md`, 2026-11-04).

## Why

- The 8 Nov gate (English complete, `../scoping/plan.md`) cannot be met if
  about 8 hours of model time waits for a person's sample check that has no
  date. The site's Health view rated it At risk unless #207 landed by
  5 Nov (`../progress_tracker.md`, 2026-11-04).
- The draft and check do not depend on the verdict (Evidence), so running
  them first loses nothing. Only the step the verdict is about, the third
  check, waits for it.
- No title is shipped on a check that has not been accepted: disputed
  titles stay out of the tC Mobile files until then.

## Risk, accepted

If the #207 verdict leads to a change in `prompts/segment-titles.md` (not
only in the third-check prompt), the books drafted before it were drafted
under the old prompt. Whether to re-run them would be a new decision. This
is inference: no such change is proposed as of 5 Nov.

If v0.1.0 is tagged before the third check is accepted, it ships without
the disputed titles. Those segments have no English title in the package,
which the tc-mobile contract allows (`../schema.md`), and the release notes
list them (AGENTS.md, "A known error is never shipped silently").

## Why an ADR, not an amendment

The decision it replaces is in the session log only, not in an ADR, so
there was no ADR text to amend. ADR 0005 records what v0.1.0 ships; this is
about the order of the work, and it is cited from the plan and #207. A short
numbered record is easier to cite than a note inside 0005 or
`dispute-check.md`.

## Rejected

- **Wait for the #207 verdict** (the 4 Nov decision). Replaced, for the
  reasons above.
- **Write the third check's answers now and revisit them after the
  verdict.** That is what #207's gate forbids: no third-check results in
  `data/` before a person accepts the step.
