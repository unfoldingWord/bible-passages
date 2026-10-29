# 0002: Choose the translation model by measuring both on Titus

- **Status:** accepted
- **Date:** 2026-10-28; amended 2026-10-29 (model IDs and choice rule)
- **Decided by:** the DRI (the model-selection half of open decision 6 in
  `../schema.md`; key-term consistency is still open)

## Decision

Translate the Titus titles into the 9 v0.1 languages twice: once with a
fast Gemini model and once with Claude, each checked by the other. Choose
the model for the remaining books from what is measured on Titus: quality
(checker disagreements and reviewer changes), cost per title and review
minutes per title.

### Models (2026-10-29)

Both are called through OpenRouter, under these model IDs:

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
   changes wins. Until a person has reviewed them, the early signal is the
   number of disagreements the other model raises when it checks them.
2. **Cost decides only on a near tie.** If the two models are within about
   10% of each other on that count, the one with the lower cost per title
   wins.
3. **Review minutes are reported** per title for each model, beside quality
   and cost.
4. **The DRI makes the call** from a one-page comparison of the Titus run.
   The choice is recorded as a new decision that cites the comparison.

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
