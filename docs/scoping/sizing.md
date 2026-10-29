# Sizing

Every number is labelled **measured** (source, commit, method) or
**estimated** (method, and what would measure it). See AGENTS.md, "Measure
before you estimate or object".

## Base counts

| Count                                                 | Value  | Label               | Source and method                                                                                                                                                                                                   |
| ----------------------------------------------------- | ------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BSB section headings (`\s1`)                          | 3,016  | measured 2026-10-28 | `git.door43.org/Worldview/en_bsb` at `7abbfafa`; lines starting `\s1` across 66 book files                                                                                                                          |
| BSB subheadings (`\s2`)                               | 80     | measured 2026-10-28 | same files, lines starting `\s2`; not pericope starts in the current plan                                                                                                                                           |
| UFW chunks                                            | 13,608 | measured 2026-10-28 | `git.door43.org/Door43-Catalog/versification` at `af14923`; sum of `first_verses` over `bible/ufw/chunks/*.json` (66 books)                                                                                         |
| Chunks a BSB pericope starts inside                   | 162    | measured 2026-10-28 | BSB `\s1` starts strictly after a chunk's first verse and before the next chunk's. In the 34 Psalms chapters with no `\v 1`, a heading before the first verse starts at verse 1; without that rule the count is 194 |
| Pilot chunks (JON, TIT, 3JN)                          | 51     | measured 2026-10-28 | same chunk files: 22 + 24 + 5                                                                                                                                                                                       |
| Places where ULT `\ts\*` and the chunk files disagree | 1,184  | measured 2026-10-28 | `unfoldingWord/en_ult` at `04e15203`, tC 4.0's section rule; list in [ts-vs-ufw.tsv](ts-vs-ufw.tsv)                                                                                                                 |
| Splits if ULT `\ts\*` is the chunk source             | 165    | measured 2026-10-28 | same BSB starts against tC 4.0's sections on `en_ult` at `04e15203`                                                                                                                                                 |
| Pericopes that are exactly one segment                | 263    | measured 2026-10-28 | pericopes whose span holds one segment (UFW chunks plus splits)                                                                                                                                                     |

Headings, chunks and pilot segments match the requirements owner's build plan
(3,016; 13,608; 52 = 51 chunks + 1 split). Splits do not: the plan has 194,
which is what a parse gives without the Psalms verse-1 rule.

Every count above was re-derived independently (a second model, its own
code, the same pinned sources) on 2026-10-28 and matched.

## Derived counts

ULT has 13,575 `\ts\*` markers across the 66 books (`en_ult` at `04e15203`,
counted with `grep -o`; recounted 2026-10-28, two files checked byte for byte
against the pinned commit). By tC 4.0's rule they give 13,548 sections.

These use the UFW chunk files. With ULT's `\ts\*` markers as the source
(schema.md, decision 8) they become 13,713 segments (13,548 sections plus 165 splits) and 16,729 English
titles.

263 pericopes are exactly one segment, so their pericope title and segment
title describe the same verses. Drafting both is a choice to make (deduped:
16,523 English titles); the counts below draft both.

| Count                                                                                      | Value                | Label                 | Method                               |
| ------------------------------------------------------------------------------------------ | -------------------- | --------------------- | ------------------------------------ |
| Segments                                                                                   | 13,770               | derived from measured | 13,608 chunks + 162 splits           |
| English titles                                                                             | 16,786               | derived from measured | 3,016 pericopes + 13,770 segments    |
| Title strings, 10 Resource Level 4 languages (incl. English)                               | 167,860              | derived from measured | 16,786 × 10                          |
| Translated strings for v0.1                                                                | 151,074              | derived from measured | 16,786 × 9 languages besides English |
| Title strings, 26 languages (RL 3 and 4; the 26 listed in the build plan's language table) | 436,436              | derived from measured | 16,786 × 26                          |
| Evocative alternates, if translated                                                        | +13,770 per language | derived from measured | one per segment                      |

## Not measured yet

| Quantity                                         | Why it matters                                       | How it gets measured                                       |
| ------------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------- |
| AI drafting cost and time per title              | model spend and wall-clock for 13,770 segment titles | one full book end to end, timed and costed                 |
| Translation cost and time per title per language | 151,074 strings for v0.1                             | the same book, translated into each v0.1 language          |
| Review minutes per title                         | the human-hours on the critical path                 | timed review of the first book's titles by a real reviewer |

Measured re-runs replace these rows; the estimate they replace stays in git
history.
