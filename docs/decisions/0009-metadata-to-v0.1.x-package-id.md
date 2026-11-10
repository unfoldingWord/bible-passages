# 0009: Metadata moves to v0.1.x; the package id is `bible-passages:<BOOK>`

- **Status:** accepted
- **Date:** 2026-11-09
- **Decided by:** the maintainer. Narrows ADR
  [0003](0003-v0.1-scope-and-titles.md) decision 11 for the first tag, and
  settles open decision 5 in [`../schema.md`](../schema.md).

## Decision

1. **Metadata is not in v0.1.0; it follows in v0.1.x.** This covers
   everything ADR 0003 decision 11 put in v0.1: key terms, figures of
   speech, and any other metadata already in the pinned inputs that needs no
   new writing. v0.1.0's `dist/` holds only `dist/tc-mobile/`: one template
   package per book and the English title tables. #44 (sizing) and #174 (the
   metadata build) are in the v0.1.x milestone.
2. **The package id is `bible-passages:<BOOK>`** (`bible-passages:TIT`),
   as `../schema.md` proposed. It is permanent from the v0.1.0 tag: a
   released id is never changed or reused, as for keys
   (ADR [0001](0001-span-keys.md)).

## What changes and what does not

ADR 0003 decision 11 reads: "Key terms and figures of speech, plus any other
metadata already in the pinned inputs that needs no new writing." This
decision changes only when that metadata ships: in v0.1.x, not v0.1.0. What
counts as v0.1 metadata is unchanged, and so is the measurement of it in
[`../scoping/metadata.md`](../scoping/metadata.md) (#44).

Not changed:

- **The glossaries stay in `data/`.** `data/glossaries/` and
  `data/glossary-drafts/` are still built and committed, and title
  translation still reads them. They were never in `dist/` (Evidence).
- **Structure and English.** v0.1.0 ships the structure of all 66 books and
  English titles, as ADRs [0005](0005-go-no-go-1-ai-checked-english.md) and
  [0006](0006-v0.1.0-english-only.md) set them.
- **How packages are built.** The id is the one the build already writes, so
  nothing in `scripts/` or `dist/` changes.

## Evidence

Observed on 10 Nov 2026 at `d68be25` (origin/main).

- **`dist/` holds only tC Mobile packages and English title tables.**
  `find dist -type f` lists 132 files: 66 packages
  (`dist/tc-mobile/<BOOK>.json`), 65 English title tables
  (`dist/tc-mobile/titles/en/<BOOK>.json`) and `dist/tc-mobile/.gitkeep`.
  No book has a title table in another language. The book with a package
  and no English title table is EZK.
- **The build does not put metadata in `dist/`.** `npm run build` runs
  `scripts/data/build.ts`, `scripts/data/glossaries.ts` and
  `scripts/data/dist.ts`. `glossaries.ts` writes to `data/glossaries/`.
  `dist.ts` reads only `data/structure/`, `data/titles/` and
  `data/drafts/en/` (its `read` calls), and writes only under
  `dist/tc-mobile/`.
- **Metadata exists in `data/` today.** `data/glossaries/` holds 532 files:
  59 books in each of nine languages (ar, en, es-419, fr, hi, id, pt-BR, ru,
  sw) and Titus in zh-Hans, built from
  `data/glossary-drafts/zh-Hans/TIT.json`, the one draft file. Counted with
  `find … | wc -l` and again per directory with `ls | wc -l`. `../schema.md`
  already says the glossaries are "Not shipped in `dist/`". No other
  metadata (figures of speech, literary form, parallels, difficulty) is in
  `data/`; `data/metadata/` does not exist.
- **The release does not read metadata.** `scripts/release/assets.ts`
  attaches files from `dist/tc-mobile` only. `scripts/release/notes.ts` and
  `scripts/lib/release-notes.ts` count titles from `data/titles/`,
  `data/drafts/` and `dist/tc-mobile/titles/`; neither mentions glossaries,
  key terms, figures of speech or metadata (`grep -i`).
- **The id is already in every package.** Each of the 66
  `dist/tc-mobile/<BOOK>.json` has `"id": "bible-passages:<BOOK>"` for its
  own book, and each of the 65 English title tables has
  `"packageId": "bible-passages:<BOOK>"` for its book (a shell loop over the
  files, matching the book code from the file name; `grep -l` on the package
  `id` field counts the same 66). `../schema.md`, "`dist/tc-mobile/`",
  marked the id "proposed".

## Why

The decision was given without written reasons. The points below are this
record's reading of the evidence, not the maintainer's words.

- The tC Mobile template package v0 has no metadata field: the
  `TemplatePackage` and title-table types in `vendor/tc-mobile/template.ts`
  carry ids, licences, attribution, chapters, segments and titles, and
  nothing else (read on 10 Nov). So tC Mobile, the main consumer, would not
  read v0.1 metadata at the first tag.
- Figures of speech are measured but not built (#44, #174). Shipping them
  would need a `dist/` format of their own (inference: there is no slot in
  the tc-mobile format, and no other `dist/` target exists). Keeping them on
  the 13 Nov path would add a build and a format to the last days before the
  tag.
- An id is permanent once released, so it has to be settled before the tag,
  not after.

## Consequences

- **v0.1.0's release notes have to say that metadata comes in v0.1.x**,
  as they have to say it is English only (ADR 0006). The generator
  (`scripts/release/notes.ts`) says neither today; #267 tracks it, and
  this record does not change it.
- **`bible-passages:<BOOK>` is permanent from the v0.1.0 tag.** Changing it
  after the tag would be a new package to tC Mobile, not a new version of
  the old one.
- `../schema.md`: the id is no longer "proposed", open decision 5 is
  decided, and the Layout says metadata is v0.1.x.
