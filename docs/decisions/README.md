# Decisions

One file per decision, numbered in order: `0001-short-name.md`. Each records
the status, the date, what was decided, why, and what was rejected. Same shape
as tc-mobile's `docs/decisions/`.

A decision is recorded here once it is made, normally on
[servant.bible#1](https://github.com/unfoldingWord/servant.bible/issues/1).
Until then it stays in the "Open decisions" list at the end of
[`../schema.md`](../schema.md).

| #                                                  | Decision                                                                   | Status   |
| -------------------------------------------------- | -------------------------------------------------------------------------- | -------- |
| [0001](0001-span-keys.md)                          | Keys name their span                                                       | accepted |
| [0002](0002-measure-translation-models.md)         | Choose the translation model by measuring both on Titus                    | accepted |
| [0003](0003-v0.1-scope-and-titles.md)              | v0.1 scope, sources and title rules                                        | accepted |
| [0004](0004-cuv-names-check.md)                    | Treat CUV as public domain; check zh-Hans names against it                 | accepted |
| [0005](0005-go-no-go-1-ai-checked-english.md)      | Go/no-go 1: AI-checked English for the whole Bible in v0.1.0               | accepted |
| [0006](0006-v0.1.0-english-only.md)                | v0.1.0 ships in English only                                               | accepted |
| [0007](0007-v0.1.0-keys-on-ufw-chunks.md)          | v0.1.0 keys are built on the UFW chunk files                               | accepted |
| [0008](0008-english-run-before-dispute-verdict.md) | Draft and check the remaining English books before the third-check verdict | accepted |
| [0009](0009-metadata-to-v0.1.x-package-id.md)      | Metadata moves to v0.1.x; the package id is `bible-passages:<BOOK>`        | accepted |
