# Changelog

All notable changes to this dataset are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions
are the release tags (`vX.Y.Z`); see `docs/schema.md`, "Releases".

## [Unreleased]

### Added

- Repository scaffold: layout, draft schema (`docs/schema.md`), pinned-source
  list, and checks that run tC Mobile's own template validator over
  `dist/tc-mobile/`. No data yet.
- Inputs for all 66 books pinned in `sources.json` (`scripts/data/pin-structure.ts`),
  and the build split into books with structure (`STRUCTURE_BOOKS`) and books
  with titles and glossaries (`BOOKS`).
- Glossary code for every book (#30): `GLOSSARY_BOOKS` apart from `BOOKS`;
  `TWL_BOOKS`, the 59 books `en_twl` v91 has; Psalms `c:front` references;
  per-release absent lists; a `no-heading` gap. Still Titus only.
- Title tables in `dist/tc-mobile/titles/<lang>/<BOOK>.json` (#59), the
  tc-mobile v0 shape: package segment keys only, plain-string titles,
  `chapters: {}`. Titles below `ai-checked` are left out, and review status
  does not travel (tc-mobile#1450, O4). English Titus: 25 of 25 segments.
- Structure for all 66 books: 3,016 pericopes from BSB `\s1` headings and
  13,770 segments (the 13,608 UFW chunks, 162 of them split at a pericope
  start), and a `dist/tc-mobile/` package per book. Titles are still Titus
  only; other books carry their book name only. The segment
  count depends on the chunk source, which is still open (#4).
- Glossaries for the 59 books `en_twl` v91 has, in the nine languages with
  Translation Words (#30): 531 files, 7,951 pinned inputs. CI caches the
  pinned downloads, keyed on `sources.json`.
- English Philippians segment titles (#32), the second sample book: 37
  drafted by Claude Sonnet and checked by Gemini Flash in one scripted run,
  recorded with its calls (`scripts/translate/segment-titles.ts`); 23 `ai-checked`,
  14 disputed and `unreviewed` until a person reviews them. The 2 segments
  that are their pericope's only segment reuse its title (decision 12).

### Changed

- Book names for Psalms and Song of Songs (#39): "Psalms" and "Song of
  Songs", from unfoldingWord's ULT `\toc2` (`unfoldingWord/en_ult` v91,
  pinned as `ult-psa` and `ult-sng`), instead of BSB's "Psalm" and "Song".
  Decided by the maintainer, so marked `approved`; the two packages also
  credit ULT in `attribution`. The other 64 books keep BSB's names.

### Known issues

- No glossary for Numbers, 1 and 2 Chronicles, Ecclesiastes, Isaiah,
  Jeremiah or Ezekiel: the pinned `en_twl` v91 has no Translation Word
  Links for them. Waiting for a release (#57).
- Glossary gaps (`gaps` in each file), summed over 59 books: Arabic 5,371
  headwords still in English (638 articles); Indonesian 2,501 linked
  articles missing (243); smaller counts per language in
  `docs/scoping/glossaries.md`, "Every book".
