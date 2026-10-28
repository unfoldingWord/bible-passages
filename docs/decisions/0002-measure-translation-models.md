# 0002: Choose the translation model by measuring both on Titus

- **Status:** accepted
- **Date:** 2026-10-28
- **Decided by:** the DRI (open decision 6 in `../schema.md`)

## Decision

Translate the Titus titles into the 9 v0.1 languages twice: once with a
fast Gemini model and once with Claude, each checked by the other. Choose
the model for the remaining books from what is measured on Titus: quality
(checker disagreements and reviewer changes), cost per title and review
minutes per title.

## Why

- Two proposals are on record: a fast Gemini model with Claude checking,
  and Claude for both drafting and translation. Neither has been measured
  on titles.
- AGENTS.md: measure before estimating, and one book before 66. Titus is
  the measured book.
- A check by a different model family is stronger than one within a family,
  and this setup gives each model's output a cross-family check.

## Not yet possible

No Gemini or Anthropic API key is set up for scripts in this environment
(checked 28 Oct). The measurement needs both before translation runs as a
script (#10).

## Rejected

Picking a model before measuring, in either direction.
