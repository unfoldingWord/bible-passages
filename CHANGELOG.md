# Changelog

All notable changes to this dataset are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions
are the release tags (`vX.Y.Z`); see `docs/schema.md`, "Releases".

## [Unreleased]

### Added

- Repository scaffold: layout, draft schema (`docs/schema.md`), pinned-source
  list, and checks that run tC Mobile's own template validator over
  `dist/tc-mobile/`. No data yet.
- Structure for all 66 books: 3,016 pericopes from BSB `\s1` headings and
  13,770 segments (the 13,608 UFW chunks, 162 of them split at a pericope
  start), and a `dist/tc-mobile/` package per book. Titles and glossaries
  are still Titus only; other books carry their book name only. The segment
  count depends on the chunk source, which is still open (#4).
