# 0002: Choose the translation model by measuring both on Titus

- **Status:** accepted
- **Date:** 2026-10-28; amended 2026-10-29 (model IDs, choice rule, the
  rule's three details, and three edge cases of those)
- **Decided by:** the DRI (the model-selection half of open decision 6 in
  `../schema.md`; key-term consistency is still open)

## Decision

Translate the Titus titles into the 9 v0.1 languages twice: once with a
fast Gemini model and once with Claude, each checked by the other. Choose
the model for the remaining books from what is measured on Titus, by the
choice rule below: quality first, cost only on a near tie, review minutes
reported.

The 9 languages are the v0.1 languages other than English in
[ADR 0003](0003-v0.1-scope-and-titles.md): ar, es-419, fr, hi, id, pt-BR,
ru, sw and zh-Hans.

### Models (2026-10-29)

Both are called through OpenRouter, under these model IDs (OpenRouter's
model list, `https://openrouter.ai/api/v1/models`, read 2026-10-29; a
smoke call to each ID returned a reply the same day, #48):

| Role              | Model ID                      |
| ----------------- | ----------------------------- |
| Fast Gemini model | `google/gemini-3.8-flash`     |
| Claude model      | `anthropic/claude-sonnet-5.5` |

Each model translates every Titus title into each v0.1 language other than
English, and the other model checks every one of those translations.

### Choice rule (2026-10-29)

Written down before the Titus run, so the result cannot be argued toward
either model afterwards.

1. **Quality first.** The model whose translations need the fewest reviewer
   changes wins. Until a person has reviewed them, quality is measured by
   the early signal: the number of disagreements the other model raises
   when it checks them.
2. **Cost decides only on a near tie.** If the two models are tied on
   quality, measured as in rule 1 and by the tie test below, the one with
   the lower cost per title wins.
3. **Review minutes are reported** per title for each model, beside quality
   and cost. They do not choose.
4. **The DRI makes the call** from a one-page comparison of the Titus run,
   which may come before the human review (it then uses the early signal).
   The choice is recorded as a new decision that cites the comparison and
   says which measure of quality it used.

### Choice-rule details (2026-10-29)

Decided by the maintainer on 2026-10-29 (#50), before any human-review
results exist (#64), so they cannot be fitted to those results. Here _a_
and _b_ are the two models' counts of reviewer changes (or, before the
human review, of checker disagreements, as in rule 1).

1. **Tie test.** The two models are tied on quality when the relative
   difference |a − b| / max(a, b) is 0.10 or less. This is a hard line,
   not "about 10%": 0.10 is a tie, anything above it is not. Two equal
   counts differ by nothing, so two counts of 0 (where the formula reads
   0 / 0) are a tie too.
2. **Cost per title.** Cost per title covers the whole pipeline, which
   here is two charges only: the cost of a model's translations plus the
   cost of the other model checking them, divided by the number of titles
   the model delivered.
3. **Undelivered titles.** A title a model fails to deliver counts as one
   reviewer change against that model.

Three edge cases of those details, decided by the maintainer on 2026-10-29
(#85), also before any review results:

4. **Undelivered titles before human review.** Before a person has
   reviewed, when quality is measured by checker disagreements (rule 1), a
   title a model fails to deliver counts as one checker disagreement
   against that model.
5. **Spend that delivered nothing.** The cost of calls that delivered no
   title still counts toward cost per title: it is in the sum of charges
   (detail 2), while the divisor stays the titles delivered.
6. **No titles delivered.** A model that delivers 0 titles in a language
   loses that language. Its cost per title there, which would divide by 0,
   is never needed.
7. **Neither model delivers.** If neither model delivers a title in a
   language, neither wins it, and cost is not consulted (decided by the
   maintainer on 2026-10-29, #94).

## Why

- Two proposals are on record: a fast Gemini model with Claude checking,
  and Claude for both drafting and translation. Neither has been measured
  on titles.
- AGENTS.md: measure before estimating, and one book before 66. Titus is
  the measured book.
- A check by a different model family is stronger than one within a family,
  and this setup gives each model's output a cross-family check.
- The model IDs and the rule were asked for before the run (#10), so the
  comparison is read against a rule fixed in advance.

The check is not perfectly symmetric: `anthropic/claude-sonnet-5.5` is the
model that drafted the English titles (`data/drafts/en/TIT.json`), so it
checks Gemini's translations of its own English. The comparison states this
beside the disagreement counts.

## Not yet possible

When this decision was first recorded (28 Oct), no Gemini or Anthropic API
key was set up for scripts in this environment. As of 29 Oct a key for
scripts is set up through OpenRouter, which serves both models. Scripts read
it from the environment at run time; it is never written into the
repository.

Reviewer changes and review minutes need a person to review the Titus
translations. Until that review, quality is compared on checker
disagreements alone.

## Rejected

Picking a model before measuring, in either direction.
