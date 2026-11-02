# 0004: Treat the Chinese Union Version as public domain and check zh-Hans names against it

- **Status:** accepted
- **Date:** 2026-11-02
- **Decided by:** the maintainer, on #53, answering the question in
  [`../scoping/zh-names-check.md`](../scoping/zh-names-check.md) (#184)

## Decision

1. **Treat the Chinese Union Version (CUV) as public domain.** The
   simplified New Punctuation text on Door43, `Door43-Catalog/zh_cuv`
   (新标点和合本), may be an input under AGENTS.md ("Data"). It is pinned in
   `sources.json` one book file at a time, as `zh-cuv-<book>`, for each book
   whose zh-Hans key terms are drafted. Titus (`zh-cuv-tit`) is the first.
2. **Build the zh-Hans names check.** A `names/*` key term's headword is
   checked against the CUV wording at the verses the book's Translation Word
   Links (TWL) give for it. A mismatch is flagged and the term goes to the
   Chinese reader; it does not stop the build. The definition of done is in
   the scoping file, "Build".
3. **FIA stays binding.** A term that names an FIA `reference` is skipped by
   the CUV check. FIA and CUV disagree on some names (for example 无酵节 /
   除酵节, measured on Mark in the scoping file), and the maintainer's 30 Oct
   decision on #53 makes the FIA rendering binding.
4. **The hold on book 2 is moot.** The scoping file's Bide kept the next
   book's zh-Hans key terms waiting on a written licence answer. With this
   decision nothing waits on it.

## Licence evidence

Observed again on 2026-11-02 unless a row says otherwise.

| Says                                                                                   | Where observed                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public domain                                                                          | `Door43-Catalog/zh_cuv` at `b993881`: `manifest.yaml` (`rights: 'Public Domain'`), `LICENSE.md` ("Public Domain") and `README.md` ("Public domain, Chinese Union Version … New Punctuation, published in 1989. Sourced from https://ebible.org/find/details.php?id=cmn-cu89s") |
| Public domain                                                                          | eBible: `https://ebible.org/Scriptures/translations.csv`, row `cmn-cu89s` (`Copyright` column "public domain", `Redistributable` "True"); `https://ebible.org/cmn-cu89s/copr.htm` ("Public Domain")                                                                            |
| The Hong Kong Bible Society is the copyright agent of CUNP, published 1988             | YouVersion, `https://www.bible.com/versions/48` (新标点和合本, 神版): "Hong Kong Bible Society is the copyright agent of CUNP"; in Chinese, 和合本的版权由香港圣经公会代理                                                                                                     |
| A licence document from the publisher (the United Bible Societies or a member society) | not found; none was located in the searches recorded in the scoping file                                                                                                                                                                                                       |

Neither Door43 nor eBible is the publisher; YouVersion is not the publisher
either, and it states an agency, not licence terms. The maintainer weighed
the conflict and chose to treat the text as public domain. The pin's
`attribution` names this decision, so the basis travels with the input.

Two points recorded as inference, not verified:

- The 1989 date on Door43 and eBible and YouVersion's 1988 are taken to be
  one revision, 1989 being the simplified printing. Not checked against a
  printed copy.
- YouVersion says the New Punctuation revision uses current names of people
  and places (使用现代通用的人名和地名). That fits the Titus Crete
  difference: the drafted 革哩底 is taken to be the 1919 spelling and
  `zh_cuv`'s 克里特 the revised one. No 1919 copy was inspected.

## Why

- **Names need a checkable source.** The drafting and checking models agreed
  on 革哩底 for Crete; a seeded 克里特 was not caught either
  ([`../scoping/glossaries.md`](../scoping/glossaries.md), calibration).
  Model agreement does not settle a spelling; a pinned Bible text does.
- **The check is small now and large later.** It covers 5 of 93 Titus
  terms, but 352 of the 938 articles the 59 pinned TWL books link (measured,
  scoping file).
- **No Door43 or partner names list exists for zh-Hans** (scoping file,
  Borrow), and `zh_cuv` is the only CUV in the Door43 catalog.

## Scope of the use

- The check reads the CUV text; it copies none of it into `data/` or
  `dist/`. A flagged term carries a gate name, not CUV wording.
- Only the books whose zh-Hans key terms are drafted are pinned.

## What would reopen it

Any of these reopens the decision, and the pins are removed until it is
settled again:

- a written claim of copyright, or a licence statement, from the United
  Bible Societies, the Hong Kong Bible Society or another publisher of the
  New Punctuation text;
- Door43 or eBible changing the edition's rights label from public domain;
- a plan to copy CUV wording (not only check against it) into `data/` or
  `dist/`, which would be a new use and needs its own decision.

The check itself is removable with its pins: the key-term records and titles
do not depend on it.

## Rejected

- **Bide** (the scoping file's earlier recommendation): wait for a written
  licence answer before pinning, and hold book 2's zh-Hans key terms until
  then. Rejected by the maintainer in favour of building now with the
  evidence on record.
- **Leave names to the reader alone.** The reader still reads every term;
  the check makes sure a spelling that differs from CUV is put in front of
  them as such.

## Addendum, 2026-11-02: a reader's third spelling

Decided by the maintainer on #53, after the check was scoped. A reader may
record a spelling for a `cuv`-flagged name that is neither the drafted one
nor one the CUV writes, if they record a reason in the term's review
(`review.reason`, beside `review.text`). The gate then accepts that
spelling, and the built glossary lists the term under `departures`. With no
reason, such a spelling is still refused. Every other gate still holds, and
a reason beside a spelling the gate does not flag is refused, so a reason is
never recorded with nothing to explain.

Why a field in the built glossary rather than a line in the build's printed
report: `data/glossaries/<lang>/<BOOK>.json` is committed and is what title
translation and the reader's tools read, so the list is kept with the terms
and seen in every diff that adds one. A printed line is gone after the run.
The field sits beside `review`, the list of terms the reader looks at first.
