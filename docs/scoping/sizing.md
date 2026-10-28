# Sizing

Every number is labelled **measured** (source, commit, method) or
**estimated** (method, and what would measure it). See AGENTS.md, "Measure
before you estimate or object".

## Base counts

| Count                               | Value  | Label               | Source and method                                                                                                                                                                 |
| ----------------------------------- | ------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BSB section headings (`\s1`)        | 3,016  | measured 2026-10-28 | `git.door43.org/Worldview/en_bsb` at `7abbfafa`; count of lines starting `\s1` across 66 book files                                                                               |
| BSB subheadings (`\s2`)             | 80     | measured 2026-10-28 | same files, lines starting `\s2`; not used as pericope starts in the current plan                                                                                                 |
| UFW chunks                          | 13,608 | measured 2026-10-28 | `git.door43.org/Door43-Catalog/versification` at `af14923`; sum of `first_verses` over `bible/ufw/chunks/*.json` (66 books)                                                       |
| Chunks a BSB pericope starts inside | 194    | measured 2026-10-28 | for each chunk, BSB `\s1` starts (chapter and first verse after the heading) strictly after its first verse and before the next chunk's; BSB versification, not yet mapped to ULT |
| Pilot chunks (JON, TIT, 3JN)        | 51     | measured 2026-10-28 | same chunk files: 22 + 24 + 5                                                                                                                                                     |

These match the figures in the requirements owner's build plan (3,016
headings, 13,608 chunks, 194 splits, 52 pilot segments = 51 chunks + 1 split).

## Derived counts

| Count                                                        | Value                | Label                 | Method                            |
| ------------------------------------------------------------ | -------------------- | --------------------- | --------------------------------- |
| Segments                                                     | 13,802               | derived from measured | 13,608 chunks + 194 splits        |
| English titles                                               | 16,818               | derived from measured | 3,016 pericopes + 13,802 segments |
| Title strings, 10 Resource Level 4 languages (incl. English) | 168,180              | derived from measured | 16,818 × 10                       |
| Title strings, 26 languages (RL 3 and 4)                     | 437,268              | derived from measured | 16,818 × 26                       |
| Evocative alternates, if translated                          | +13,802 per language | derived from measured | one per segment                   |

## Not measured yet

| Quantity                                         | Why it matters                                                       | How it gets measured                                       |
| ------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| Splits after mapping BSB versification to ULT    | the 194 is in BSB versification; the build uses ULT                  | run the split count after the versification map exists     |
| AI drafting cost and time per title              | model spend and wall-clock for 16,818 English titles                 | one full book end to end, timed and costed                 |
| Translation cost and time per title per language | 151,362 strings for v0.1 (9 languages × 16,818)                      | the same book, translated into each v0.1 language          |
| Review minutes per title                         | the human-hours on the critical path                                 | timed review of the pilot book's titles by a real reviewer |
| Consensus-check source                           | the plan reads other English Bibles' headings, which are copyrighted | open: see the 6B evaluation for that step                  |

Measured re-runs replace these rows; the estimate they replace stays in git
history.
