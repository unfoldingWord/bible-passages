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
  glossary-drafts/<lang>/<BOOK>.json  committed AI key-term records (zh-Hans)
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
  `title`. In English it is BSB's `\h` (`bsb-<book>`, `unreviewed`), except
  for two books whose BSB name reads wrong ("Psalm", "Song"): Psalms and
  Song of Songs take ULT's `\toc2` (`ult-psa`, `ult-sng`: unfoldingWord/en_ult
  v91), as the maintainer decided on #39. Those two are `approved`, because a
  person chose the exact words; the build stops if the pinned ULT `\toc2` is
  not that text (`NAME_OVERRIDES` in `scripts/data/build.ts`). A package
  whose name is not from BSB credits its source in `attribution` too.
- A key with no title is allowed. A title for a key that is not in the
  structure file is an error.
- Every book with structure has a table, because its package takes `name`
  as its title. A book whose titles are not built yet (all but Philippians
  and Titus so far, `BOOKS` in `scripts/lib/books.ts`) has `name` and an
  empty `titles`.
- A segment that is its pericope's only segment has the pericope's title,
  `text`, `status` and `source` alike, unless a draft gives it its own
  (decision 12, [decisions/0003](decisions/0003-v0.1-scope-and-titles.md);
  Titus 3:9–11 was drafted before that decision). The build fills it in.

## `data/drafts/<lang>/<BOOK>.json`

A committed input, not generated: AI-drafted titles, `titles` keyed by segment
key with `text`, `source` (`ai:<model id>`) and `status`. The build merges them
into `data/titles/<lang>/<BOOK>.json` and never clears this directory, so a
rebuild cannot wipe a draft. A draft for a key that is not a segment in the
structure fails the build. The instructions that produced them are in
`prompts/`. English Titus and Philippians exist so far. A pericope's only
segment has no draft (decision 12): it takes the pericope title in the build.

Titus was drafted by an agent following `prompts/segment-titles.md`, before a
script existed. From Philippians on, the file is a recorded AI output:
`scripts/translate/segment-titles.ts` writes it under `.cache/` and it is
copied here unchanged, as `data/glossary-drafts/` records are. The build
never calls a model. Such a record also has:

- `bible`: the `sources.json` id of the BSB text both models were given.
- `prompt`: the instructions file and its SHA-256; a test holds it equal to
  the committed `prompts/segment-titles.md`.
- `calls`: the draft and the check call, each with its OpenRouter generation
  id, model, tokens and cost in US dollars.
- per title, `gates`: the mechanical rules it breaks (`length` over 60
  characters, `full-stop`, `quotes`, `straight-apostrophe`, `line-break`,
  `markup`), absent when it breaks none. A gated title stays `unreviewed`
  even when the checker agreed.

An English check's `criteria` are `accurate`, `covers`, `plain` and `style`.
A person's review is recorded by a later change as `review` (`by`, `at`,
`status`, and `text` when the reviewer reworded the title).

A translated draft (`<lang>` other than `en`) has the same record, keyed by
every titled key in the English table (pericopes and segments), plus `from`,
the English title it translates, and `gates`, any machine gate problems. Its
`check` is by a model of another family than the translator's
(`prompts/check-translations.md`; criteria `accurate`, `terms`, `names`,
`plain`, `style`), and it is `ai-checked` only when the checker agreed and
every gate passed. None is committed yet: the DRI chooses the model from the
Titus measurement first ([decisions/0002](decisions/0002-measure-translation-models.md),
[scoping/translation-check.md](scoping/translation-check.md)).

Each draft carries `check`: a different model's verdict (`by`, `verdict`, and
for a disagreement `criteria`, `why` and a `suggestion`). A draft is
`ai-checked` only when the checker agreed (and, for a translation, every
gate passed); anything else stays `unreviewed` and goes to a person first. The check's details stay here; the built table
gets `text`, `status` and `source`.

A person's review is `review`: `by` (`reviewer:<handle>`), `at` (a date),
`status`, and `text` only when their wording differs from the draft's, with
`why` when they gave a reason and `saved`, the time the applied record was
saved. A later review replaces the whole entry, its reason included. The build takes the review's status, and its
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

For zh-Hans, which has no Translation Words, the file is built from
`data/glossary-drafts/zh-Hans/<BOOK>.json` (below) instead: each term also
carries `source` (`ai:<model>`), `status` and the check, the file names both
models under `models`, and `review` lists the terms that are `unreviewed`
(the checker disagreed or a gate failed). Title translation uses a term with
a `status` only once it is `human-reviewed` or `approved`.

## `data/glossary-drafts/<lang>/<BOOK>.json`

A committed input, not generated: a recorded AI output, the key terms one
model drafted for a language without Translation Words and a second model
checked (decision 14, [decisions/0003](decisions/0003-v0.1-scope-and-titles.md)).
`scripts/translate/key-terms.ts` writes it under `.cache/`; it is copied here
unchanged. The build never calls a model: it reads this file and the pinned
TWL and English tW, refuses a record that no longer matches them, and writes
`data/glossaries/<lang>/<BOOK>.json`. A new draft is a new run and a new
commit, not a rebuild.

- `prompt`: the instructions file and its SHA-256; a test holds it equal to
  the committed `prompts/key-terms.md`.
- `reference`: the `sources.json` id of the term list both models were given
  (FIA Key Terms, `fia-kt-zhs`).
- `calls`: the draft and the check call, each with its OpenRouter generation
  id, model, tokens and cost in US dollars.
- `terms`, per linked article: `en` (the English headword it was drafted
  from), `headword`, `source`, `status`, and where they apply `reference`
  (the reference term it follows), `note` (for the reader), `gates` and
  `check` (`by`, `verdict`, and for a disagreement `why` and `suggestion`).
  A term is `ai-checked` only when the checker agreed and every gate passed.

A reader's review is recorded here by a later change; until then nothing is
above `ai-checked`.

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

### `dist/tc-mobile/titles/<lang>/<BOOK>.json`

A tc-mobile v0 title table, one per package per language in its
`titleLanguages` whose `data/titles/<lang>/<BOOK>.json` has a title to ship.
Built by `scripts/lib/title-table.ts`. Today that is English Philippians
and Titus.

```json
{
  "packageId": "bible-passages:TIT",
  "version": "0.0.0",
  "language": "en",
  "chapters": {},
  "segments": {
    "TIT.1.1-3": "Paul introduces himself as God’s servant and apostle"
  }
}
```

- `packageId`, `version` and `language` equal the package's `id`, `version`
  and one of its `titleLanguages`.
- `chapters` is `{}`: the dataset has no chapter titles.
- `segments` holds the package's segment keys only, in package order, each
  with its title as a plain string. Pericope keys (`<BOOK>.P.…`) are left out,
  since tC Mobile refuses a key its package lacks.
- A segment with no title is left out; the app then shows no label, which the
  contract allows. A book with no title to ship gets no table.
- **Status floor: `ai-checked`.** Titles at `ai-checked`, `human-reviewed` and
  `approved` are shipped; `unreviewed` titles are left out. The maintainer may
  change this floor.
- **Known limitation: status is dropped.** v0 tables hold plain strings, so a
  phone cannot tell an `ai-checked` title from a `human-reviewed` one. Carrying
  status needs a tc-mobile `formatVersion` change (tc-mobile#1450, open
  question O4).
- An unknown status, or an empty or whitespace-padded title, for a package
  segment key stops the build. The build does not read the entries for other
  keys (pericope keys); `npm run verify` holds every entry in
  `data/titles/<lang>/<BOOK>.json`, pericope keys included, to the same rule
  (`tests/structure.test.ts`).

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
   files exactly, as in CI. On a mismatch the step prints `git diff HEAD` of
   both before it stops, so a dry run's output keeps the difference to a
   tracked file after the files are restored; an untracked file is named,
   not shown.
4. `dist/` is regenerated with `source.revision` set to the tag. The release
   stops unless every top-level `.json` package in `dist/tc-mobile/` has
   `"revision": "<tag>"` (`scripts/lib/release.ts`). The empty `.gitkeep`
   that keeps the directory in git is exempt and is not attached. Any other
   top-level entry stops the release unless it is a regular `.json` file or a
   directory whose name does not end in `.json` (a symlink stops it).
   Title tables `dist/tc-mobile/titles/<lang>/<BOOK>.json` are checked too.
   A table has no `source` block, so it carries no revision; it is tied to
   the release through its package instead: its `packageId` and `version`
   must equal the `id` and `version` of `<BOOK>.json` in the same release
   (whose revision was just checked), and its `language` must be the
   `<lang>` it sits under. Any other nested file, or a nested entry that is
   not a regular file, stops the release.
5. The packages and title tables are attached to a **draft** release,
   published by hand. Release assets are flat and a table shares its
   package's file name, so each table is attached as
   `titles.<lang>.<BOOK>.json` (for example `titles.en.TIT.json`,
   `titles.es-419.TIT.json`); a package keeps its own name (`TIT.json`).
   The script copies each file under its asset name into a temporary
   directory and attaches the copies.

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
6. **Translation**: the selection procedure, the two model IDs and the
   choice rule are decided: measure Gemini and Claude on Titus, then choose
   quality first ([decisions/0002](decisions/0002-measure-translation-models.md)).
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
11. **Metadata in v0.1**: decided: key terms and figures of speech, plus any
    other metadata already in the pinned inputs that needs no new writing
    ([decisions/0003](decisions/0003-v0.1-scope-and-titles.md)).
12. **Single-segment pericopes**: decided: reuse the pericope title, 16,523
    English titles ([decisions/0003](decisions/0003-v0.1-scope-and-titles.md)).
13. **Spanish language tag**: decided: `es-419`
    ([decisions/0003](decisions/0003-v0.1-scope-and-titles.md)).
14. **Chinese key terms**: decided: AI-drafted, checked by a second model,
    reviewed by a Chinese reader
    ([decisions/0003](decisions/0003-v0.1-scope-and-titles.md)). Titus
    drafted and checked (`data/glossary-drafts/zh-Hans/TIT.json`); the
    reader is still to be named on #31.
