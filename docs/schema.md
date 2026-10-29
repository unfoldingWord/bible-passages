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
  versification/ufw.json     last verse of each chapter, from ufw.vrs
  glossaries/<lang>/<BOOK>.json  key terms a book links, with headwords per language
  retired-keys.json          append-only log of retired keys, each with its successor
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

| Unit     | Form                       | Example        |
| -------- | -------------------------- | -------------- |
| Chapter  | `<BOOK>.<c>`               | `TIT.1`        |
| Segment  | `<BOOK>.<c>.<v>-<v>`       | `TIT.1.1-4`    |
| Pericope | `<BOOK>.P.<span as above>` | `TIT.P.1.1-16` |

No pericope or segment in this dataset crosses a chapter: BSB opens every one of its 1,189 chapters with a heading at verse 1, and the chunk files are per chapter. So every key is single-chapter. (tc-mobile's format allows cross-chapter spans; this dataset never needs them.)

A one-verse span repeats its verse (`TIT.1.4-4`, not `TIT.1.4`), so every
key has the same shape and a chapter key is never confused with a verse; 9 of
Titus's 25 segments are one verse (measured, `data/structure/TIT.json`).

Because the span is in the key, moving a boundary gives the new span its own
key: a new one, or the same span's earlier key, revived. That is the contract's
rule ("give the new passage a new key") enforced by the form of the key rather
than by memory. The old key is retired by appending a row to
`data/retired-keys.json`. While a key is absent from the live structure, its
latest row there is in force; while it is live, all its rows are history only,
and reviving it appends nothing. A key is never attached to a different span
([decisions/0001](decisions/0001-span-keys.md)).

The record is `data/retired-keys.json`, written by hand, never by the build:

```json
{ "retired": [{ "key": "TIT.1.1-4", "successor": "TIT.1.1-3" }] }
```

A successor is a current key, or a key retired later whose own successor
chain ends in one. Entries are only ever added: a release may not remove or
change one that an earlier release shipped. When a key splits in two, the
successor is the one its titles carry forward to.

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
  "name": { "text": "Titus", "status": "unreviewed", "source": "bsb-tit" },
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
- `source` is a `sources.json` id, `ai:<model id>` or `reviewer:<handle>`, a
  handle the reviewer chose or the maintainer assigned, never a display name.
- `name` is the book's name in this language; it becomes the package
  `title`.
- A key with no title is allowed. A title for a key that is not in the
  structure file is an error.
- Every book with structure has a table, because its package takes `name`
  as its title. A book whose titles are not built yet (all but Titus so far,
  `BOOKS` in `scripts/lib/books.ts`) has `name` and an empty `titles`.

## `data/drafts/<lang>/<BOOK>.json`

A committed input, not generated: AI-drafted titles, `titles` keyed by segment
key with `text`, `source` (`ai:<model id>`) and `status`. The build merges them
into `data/titles/<lang>/<BOOK>.json` and never clears this directory, so a
rebuild cannot wipe a draft. A draft for a key that is not a segment in the
structure fails the build. The instructions that produced them are in
`prompts/`. Only English Titus exists so far.

Each draft carries `check`: a different model's verdict (`by`, `verdict`, and
for a disagreement `criteria`, `why` and a `suggestion`). A draft is
`ai-checked` only when the checker agreed; a disagreement stays `unreviewed`
and goes to a person first. The check's details stay here; the built table
gets `text`, `status` and `source`.

A person's review is `review`: `by` (`reviewer:<handle>`), `at` (a date),
`status`, and `text` only when their wording differs from the draft's, with
`why` when they gave a reason. The build takes the review's status, and its
wording with the reviewer as `source`. Reviews come from the project site's
Review page through `scripts/review/apply.ts`
([scoping/review-screen.md](scoping/review-screen.md)).

## `data/glossaries/<lang>/<BOOK>.json`

The key terms Translation Word Links link from a book, each with its
headword in the language's Translation Words, the verses that link it, and
the `sources.json` id it was read from. Linked terms with no headword in the
language are listed under `gaps`. Shape, sources and gaps:
[scoping/glossaries.md](scoping/glossaries.md). Not shipped in `dist/`;
translation reads it.

## `dist/tc-mobile/`

Generated from `data/` by `scripts/`. Never edited by hand. Each package is a
tc-mobile template package v0:

- `id`: `bible-passages:<BOOK>` (proposed; an id is permanent once released).
- `kind`: `bible-book`. `bookCode`: the USFM code.
- `version`: the release tag without the `v` (`0.0.0`, from `package.json`,
  until the first release). Title tables carry the same
  version, so every release ships its own tables even when titles did not
  change.
- `dataLicence`: `CC-BY-SA-4.0`. `recordingLicence`: `CC-BY-SA-4.0` (the only
  value v0 allows).
- `source.url`: this repo. `source.revision`: the release tag (`unreleased`
  until the first release).
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

`scripts/lib/sources.ts` downloads each input once into `.cache/sources/`
(not committed) and refuses it if its SHA-256 does not match the pin.

## Releases

A release is a git tag `vX.Y.Z` with the files in `dist/tc-mobile/` attached,
which is what the tc-mobile contract assumes under "What 'published' means".
Version numbers follow the contract's (assumed) rules: patch for no key
changes, minor for keys added, major for keys dropped. The workflow does not
check the bump yet.

`.github/workflows/release.yml` runs on a pushed `v*` tag. Its steps are in
`scripts/release/run.sh`:

1. The tag must be `vX.Y.Z`, equal `v` + `package.json`'s `version`, and point
   at a commit on `main`. The committed `dist/` already carries the version,
   so the bump is a reviewed PR and the tag follows its merge.
2. `npm run verify`, with the key-stability check run against every release
   tag except the one being released. Only a tag that passes step 1's rules
   (on `main`, naming its commit's `package.json` version) counts as a
   release there.
3. `data/` and `dist/` rebuilt from the pinned sources must match the tagged
   files exactly, as in CI.
4. `dist/` is regenerated with `source.revision` set to the tag. The release
   stops unless every top-level file in `dist/tc-mobile/` has
   `"revision": "<tag>"` (`scripts/lib/release.ts`). Title tables under
   `dist/tc-mobile/titles/` share their package's file name, so until their
   asset names are decided a nested file stops the release too.
5. The top-level files are attached to a **draft** release, published by
   hand.

**A failed release.** A tag that passes step 1 and then fails a later step
stays in the key check's baseline for every later release (step 2), and its
version cannot be tagged again while it exists.
The recovery is to delete the tag, fix on `main`, and tag again. Deleting a
`v*` tag is a maintainer action: a repository ruleset lets only maintainers
and admins create, move or delete `v*` tags.

**Dry run.** `scripts/release/run.sh --dry-run` runs steps 1 to 4 at `HEAD`
for the tag `v` + `package.json`'s version (or a tag given after
`--dry-run`), prints the `gh release create` it would run, and restores
`data/` and `dist/`, passed or failed. It refuses to start while `data/` or
`dist/` has uncommitted changes, since the build overwrites them. It creates
no tag and no release and needs no token. Run by hand
from the Actions tab (`workflow_dispatch`), the release workflow does the
same, with a read-only token:
`gh workflow run release.yml --repo unfoldingWord/bible-passages --ref main`.
Step 1 still applies, so the commit must be on `main`.

## Checks

Run on every PR (`npm test`):

| Check                                                                            | Status    |
| -------------------------------------------------------------------------------- | --------- |
| Vendored tc-mobile files match their pinned hashes                               | built     |
| Every package in `dist/tc-mobile/` passes tc-mobile's checker                    | built     |
| Every title table passes against its package and version                         | built     |
| Every `sources.json` entry is pinned (URL, revision, hash, licence, attribution) | built     |
| Every verse in exactly one pericope and one segment                              | built     |
| Every span valid against the versification                                       | built     |
| Every key unique, in the key format and naming its own span                      | built     |
| Every segment inside the pericope it names                                       | built     |
| `dist/` segment keys are the same as `data/`'s                                   | built     |
| `data/` and `dist/` match a fresh build from the pinned sources (CI)             | built     |
| No released key missing, moved or reused (against every `vX.Y.Z` release tag)    | built     |
| Every key titled in every language marked complete                               | not built |
| Title length and script                                                          | not built |

The unbuilt checks are listed as `it.todo` in `tests/`, so they show up in
every test run until they exist.

## Open decisions

1. **v0.1 scope**: decided: a gated subset
   ([decisions/0003](decisions/0003-v0.1-scope-and-titles.md)).
2. **Pericope source**: decided: BSB `\s1` headings
   ([decisions/0003](decisions/0003-v0.1-scope-and-titles.md)).
3. **Keys**: decided: span keys. See
   [decisions/0001](decisions/0001-span-keys.md).
4. **Versification and UTN release**: which scheme spans are checked against,
   and which UTN release the segment boundaries come from.
5. **Package id**: `bible-passages:<BOOK>`, permanent once released.
6. **Translation**: the selection procedure is decided: measure Gemini and Claude on
   Titus, then choose ([decisions/0002](decisions/0002-measure-translation-models.md)).
   Still open: how key-term consistency is checked across a book and a
   language.
7. **Review viewer**: the request asks for a visual way to review the dataset
   that can push versioned updates back to this repo. Its form and how it
   writes back (a PR per change, never a push to `main`) are open.
8. **Authoritative chunk source**: the UFW chunk files or ULT's `\ts\*`
   markers. They disagree at 1,184 places
   ([scoping/ts-vs-ufw.tsv](scoping/ts-vs-ufw.tsv)). The content team's call.
9. **Consensus check in v0.1**: decided: out
   ([decisions/0003](decisions/0003-v0.1-scope-and-titles.md)).
10. **Segment title style**: decided: explanatory comment
    ([decisions/0003](decisions/0003-v0.1-scope-and-titles.md)).
11. **Metadata in v0.1**: proposed key terms only; topics, literary form and
    difficulty after v0.1. The requirements owner picked "all of it" on
    28 Oct; being confirmed, since it adds unsized work.

12. **Single-segment pericopes**: decided: reuse the pericope title, 16,523
    English titles ([decisions/0003](decisions/0003-v0.1-scope-and-titles.md)).
13. **Spanish language tag**: decided: `es-419`
    ([decisions/0003](decisions/0003-v0.1-scope-and-titles.md)).
14. **Chinese key terms**: decided: AI-drafted, checked by a second model,
    reviewed by a Chinese reader
    ([decisions/0003](decisions/0003-v0.1-scope-and-titles.md)).
