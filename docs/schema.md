# Schema (draft)

Status: proposal for review on
[servant.bible#1](https://github.com/unfoldingWord/servant.bible/issues/1).
Nothing here is decided until that issue says so. Decisions still open are
listed at the end.

## What the dataset holds

For every book of the Bible:

- **Pericopes**: passages a reader would recognise as one story or argument,
  each with a title.
- **Segments** (chunks): the smaller units a translator records or drafts one
  at a time. Each one sits inside a single pericope.
- **Titles** for both, in each language, each with a review status and where it
  came from.

tC Mobile reads segments only. Its template format has book, chapter and
segment, with no slot for pericopes (tc-mobile
`docs/contracts/template-package-v0.md`). Pericopes stay in the dataset because
other tools use them (tc-study's Sections mode, Servant.Bible), and because
segment titles are written within a pericope.

## Layout

```
sources.json                 every input, pinned
data/
  structure/<BOOK>.json      pericopes and segments: keys and spans, no text
  titles/<lang>/<BOOK>.json  titles per key, with status and source
  metadata/<BOOK>.json       later: topics, key terms, difficulty
dist/tc-mobile/              generated, never edited by hand
  <BOOK>.json                one template package per book
  titles/<lang>/<BOOK>.json  one title table per package per language
scripts/                     the build
tests/                       the checks
vendor/tc-mobile/            tc-mobile's checker, copied by commit
```

`<BOOK>` is the USFM book code (`TIT`, `3JN`). `<lang>` is a BCP-47 tag (`en`,
`es-419`).

Structure, titles and app output are kept apart on purpose:

- Structure is checked against the versification once and reused by every
  language.
- Each language moves through review on its own.
- tC Mobile reads only `dist/tc-mobile/`, so `data/` can grow without breaking
  the app.

## Keys

Keys name a span and nothing else. A key never changes meaning and is never
reused (tc-mobile contract, "Keys"). The proposed form follows tc-mobile's own
Bible fixture (`MRK.1.1-8`):

| Unit                    | Form                       | Example        |
| ----------------------- | -------------------------- | -------------- |
| Chapter                 | `<BOOK>.<c>`               | `TIT.1`        |
| Segment                 | `<BOOK>.<c>.<v>-<v>`       | `TIT.1.1-4`    |
| Segment across chapters | `<BOOK>.<c>.<v>-<c>.<v>`   | `GEN.1.31-2.3` |
| Pericope                | `<BOOK>.P.<span as above>` | `TIT.P.1.1-16` |

Because the span is in the key, moving a boundary always produces a new key.
That is the contract's rule ("give the new passage a new key") enforced by the
form of the key rather than by memory. The old key is then retired: it stays in
the record of released keys and is never used again.

This replaces the order-based IDs in the pilot (`TIT.P02`), where inserting one
pericope renumbers every later one.

Every key fits tc-mobile's key rule (`validate.ts`: a letter or digit, then
letters, digits and `. _ : -`, at most 64 characters).

## `data/structure/<BOOK>.json`

```json
{
  "book": "TIT",
  "versification": "ufw",
  "pericopes": [{ "key": "TIT.P.1.1-4", "start": [1, 1], "end": [1, 4] }],
  "segments": [
    {
      "key": "TIT.1.1-4",
      "pericope": "TIT.P.1.1-4",
      "start": [1, 1],
      "end": [1, 4]
    }
  ]
}
```

- `start` and `end` are `[chapter, verse]`, inclusive.
- Pericopes, and the segments within each, are listed in reading order.
- `versification` names the scheme every span is checked against. Which scheme
  is still open (see the end).

## `data/titles/<lang>/<BOOK>.json`

```json
{
  "language": "en",
  "book": "TIT",
  "titles": {
    "TIT.P.1.1-4": {
      "text": "Paul Greets Titus",
      "status": "ai-checked",
      "source": "bsb-headings"
    }
  }
}
```

- `status`, in order: `unreviewed`, `ai-checked`, `human-reviewed`,
  `approved`. A release says what status it ships at; v0.1 could honestly ship
  marked `ai-checked`.
- `source` is a `sources.json` id, `ai:<model id>` or `reviewer:<github-handle>`.
- A key with no title is allowed. A title for a key that is not in the
  structure file is an error.

## `dist/tc-mobile/`

Generated from `data/` by `scripts/`. Never edited by hand. Each package is a
tc-mobile template package v0:

- `id`: `bible-passages:<BOOK>` (proposed; an id is permanent once released).
- `kind`: `bible-book`. `bookCode`: the USFM code.
- `version`: the release tag without the `v`. Title tables carry the same
  version, so every release ships its own tables even when titles did not
  change.
- `dataLicence`: `CC-BY-SA-4.0`. `recordingLicence`: `CC-BY-SA-4.0` (the only
  value v0 allows).
- `source.url`: this repo. `source.revision`: the release tag.
- `attribution`: built from the `sources.json` entries the book used.

## `sources.json`

Every input the build reads, pinned so a build can be repeated:

```json
{
  "sources": [
    {
      "id": "biblelib-pericopes-bsb",
      "url": "https://github.com/Clear-Bible/biblelib/...",
      "revision": "<commit>",
      "sha256": "<hash of the file as read>",
      "licence": "CC-BY-4.0",
      "attribution": "Clear Bible, biblelib, CC BY 4.0"
    }
  ]
}
```

The list is empty until the first data PR picks its inputs.

## Releases

A release is a git tag `vX.Y.Z` with the files in `dist/tc-mobile/` attached,
which is what the tc-mobile contract assumes under "What 'published' means".
Version numbers follow the contract's (assumed) rules: patch for no key
changes, minor for keys added, major for keys dropped.

## Checks

Run on every PR (`npm test`):

| Check                                                                            | Status    |
| -------------------------------------------------------------------------------- | --------- |
| Vendored tc-mobile files match their pinned hashes                               | built     |
| Every package in `dist/tc-mobile/` passes tc-mobile's checker                    | built     |
| Every title table passes against its package and version                         | built     |
| Every `sources.json` entry is pinned (URL, revision, hash, licence, attribution) | built     |
| Every verse in exactly one pericope and one segment                              | not built |
| Every span valid against the versification                                       | not built |
| No released key missing, moved or reused                                         | not built |
| Every key titled in every language marked complete                               | not built |
| Title length and script                                                          | not built |

The unbuilt checks are listed as `it.todo` in `tests/`, so they show up in
every test run until they exist.

## Open decisions

1. **v0.1 scope**: the dataset request asks for pericope titles and segment
   titles (segments from UTN), for the whole Bible, in the Top 10 Strategic
   Languages, by 2026-11-16. servant.bible#1 lists segment titles as later.
   Which one is v0.1?
2. **Pericope source**: Clear Bible's biblelib file (reported as 2,436
   pericopes, CC BY 4.0) or BSB headings rebuilt (reported as 3,016)? Neither
   count is re-verified in this repo yet.
3. **Keys**: the span-based keys above, instead of the pilot's order-based
   ones. An alternative is to embed a Scripture Burrito scope string, which
   tc-mobile already uses for sections (its ADR 0004): `TIT.1:1-4`,
   `GEN.1:31-2:3`. Both fit the key rule.
4. **Versification and UTN release**: which scheme spans are checked against,
   and which UTN release the segment boundaries come from.
5. **Package id**: `bible-passages:<BOOK>`, permanent once released.
6. **Translation**: which model translates titles, and how key-term
   consistency is checked across a book and a language. One suggestion is a
   fast model for translation, with a script that checks key terms and drives
   review.
7. **Review viewer**: the request asks for a visual way to review the dataset
   that can push versioned updates back to this repo. Its form and how it
   writes back (a PR per change, never a push to `main`) are open.
