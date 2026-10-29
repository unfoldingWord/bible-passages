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
  with titles and glossaries (`BOOKS`). Both are still Titus only.
- Glossary code for every book (#30): `GLOSSARY_BOOKS` apart from `BOOKS`;
  `TWL_BOOKS`, the 59 books `en_twl` v91 has; Psalms `c:front` references;
  per-release absent lists; a `no-heading` gap. Still Titus only.
