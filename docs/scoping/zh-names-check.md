# zh-Hans names check

A check that zh-Hans key-term headwords for proper names (`names/*`) agree
with the Chinese Union Version (CUV). Raised on #53 from the bench review of
PR #51; [glossaries.md](glossaries.md), "Not done", lists it.

Observed 2026-11-02 at `main` `fdcbac4`. Updated 2026-11-02 at `aae7226`:
the maintainer decided on #53 to treat the CUV as public domain
([ADR 0004](../decisions/0004-cuv-names-check.md)), so the 6B moves from
Bide to Build and `zh_cuv` Titus is pinned (`zh-cuv-tit`). The check itself
is not built yet; its definition of done is under "Build" below.

## What is measured

The 4 of 5 was derived twice (a Python script over TWL verses, and a
separate `grep`/`awk` pass over the USFM); so was the 37 (`jq`, then
Python). The other rows are single `jq` or `cut` counts, each cheap to
repeat.

| Count                                                         | Value                                      | Source                                                                                                                                                                             |
| ------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| zh-Hans Titus key terms                                       | 93                                         | `jq '.terms\|length' data/glossary-drafts/zh-Hans/TIT.json`                                                                                                                        |
| of them `names/*`                                             | 5                                          | same record: apollos, crete, paul, titus, tychicus                                                                                                                                 |
| `names/*` that name an FIA `reference`                        | 0 of 5                                     | same record; none has `reference`                                                                                                                                                  |
| all terms that name an FIA `reference`                        | 24 of 93                                   | same record                                                                                                                                                                        |
| distinct capitalised English names in FIA zh-Hans             | 37 (38 entries: `Lord` has two renderings) | pinned `fia-kt-zhs` (`e08f9c5`); none of Titus's 5; most are Gospel names (Bethsaida, Capernaum, Tyre)                                                                             |
| `names/*` whose headword is in `zh_cuv` at every TWL verse    | 4 of 5                                     | 提多 (1:4), 保罗 (1:1), 亚波罗 (3:13), 推基古 (3:12): a substring of the verse, not a parse of names; `zh_cuv` `57-TIT.usfm` at `b993881`, verses from `twl-en-tit` (6 names rows) |
| the one that differs                                          | `names/crete`                              | record 革哩底、革哩底人; `zh_cuv` writes 克里特 at 1:5 and 1:12                                                                                                                    |
| distinct `names/*` articles linked by the 59 pinned TWL books | 352 of 938                                 | `sort -u` over column 6 of the cached `twl-en-*` files (command below)                                                                                                             |

So the check would touch 5 terms in Titus, but over a third of the linked
articles once every book is drafted.

## Candidate inputs and their licences

| Candidate                                                                                    | Licence as observed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Reachable from the sandbox     |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| `Door43-Catalog/zh_cuv` at `b993881` (新标点和合本, the New Punctuation edition, simplified) | **Conflicting.** Its `manifest.yaml` (`rights: 'Public Domain'`), `LICENSE.md` and `README.md` say public domain, sourced from eBible `cmn-cu89s`; eBible's `translations.csv` and its `copr.htm` say public domain. YouVersion's page for the edition (bible.com/versions/48) says the Hong Kong Bible Society is the copyright agent of CUNP, the New Punctuation revision. No primary licence document from the publisher was found. Dates: the file's `\id` line and manifest say 1989; YouVersion says CUNP was published in 1988. Whether these are one text is not verified (inference: the same revision, 1989 being the simplified printing). | yes (`curl` fetched the files) |
| CUV 1919 (the original, unrevised text)                                                      | public domain by age (inference, not observed). No copy in the Door43 catalog; not inspected. Whether 革哩底 is its spelling is unverified.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | no source found                |
| eBible `cmncbs`, Biblica Open Contemporary Bible (simplified)                                | CC BY-SA 4.0 (eBible details page). Not CUV: its names are its own, so it answers a different question.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | yes (ebible.org)               |
| Door43 Chinese resources (`cistern/zhs_*`)                                                   | FIA key terms (already pinned), Biblica key terms (1 term), translation guide, video dictionary and one more (`zhs_ubsi`, not opened). None of the opened ones is a names list.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | yes                            |
| Chinese Translation Words                                                                    | none exists ([glossaries.md](glossaries.md), Break 1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | n/a                            |

AGENTS.md: "Copyrighted Bible text and headings are not inputs." ~~Until the
New Punctuation edition's status is settled, `zh_cuv` cannot be pinned.~~
**Superseded 2026-11-02:** the maintainer settled it by treating the text as
public domain ([ADR 0004](../decisions/0004-cuv-names-check.md), which
records the evidence above on each side). `zh_cuv` also carries `\s1`
section headings, which the check ignores.

## 6B

### zh-Hans names check against CUV

| Step   | Verdict                           | Evidence / justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Borrow | applied                           | `Door43-Catalog/zh_cuv` at `b993881`, `57-TIT.usfm`, pinned as `zh-cuv-tit` under [ADR 0004](../decisions/0004-cuv-names-check.md). It is the one CUV in the Door43 catalog (the `lang=zh` search returned 3 results, under its limit of 50; `STR/zh_cuv` is a fork with the same manifest). No uW or partner names list for zh-Hans exists. **Superseded 2026-11-02**, was: skipped, because whether the edition is copyrighted was unresolved (improper authority: neither Door43 nor eBible is the publisher).                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Bend   | applied (measured, not committed) | TWL gives each `names/*` term its verses; `zh_cuv` marks names with `\pn`. Checking that a headword occurs in the CUV verse at every TWL reference found 4 of 5 Titus names agree and flagged Crete. Run from scratch scripts outside the tree, before the pin; the committed check is the Build.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Break  | observed                          | (1) Licence: see Borrow; settled by ADR 0004, so it no longer constrains the Build. (2) Edition: the record's 革哩底 and `zh_cuv`'s 克里特 are two spellings of one place; which spellings the glossary follows (1919 original or New Punctuation) is a content decision, not a check. (3) FIA versus CUV: run over CUV Mark, 7 of the 37 capitalised FIA names have no hit for any form. 3 are real wording differences (无酵节 / 除酵节, 希律党人 / 希律一党的人, 叙利亚腓尼基 / 叙利腓尼基), 2 are form differences (U+2022 in 凯撒利亚•腓立比 against U+00B7; 加利利的海 against 加利利海), 1 is absent from Mark's wording (弥赛亚), and 1 is a parse artefact of the annotated Judea entry. FIA is binding (maintainer decision on #53), so a CUV check would have to exempt every term that names an FIA `reference`.                                                                                                              |
| Beget  | skipped                           | No uW or partner team carries a zh-Hans names list or a CUV check. The licence question, the one piece only the maintainer could carry, is answered (ADR 0004).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Bide   | inspected-and-rejected            | **Superseded 2026-11-02 by [ADR 0004](../decisions/0004-cuv-names-check.md):** the maintainer chose to build now rather than wait for a written licence answer, and the hold on the next book's zh-Hans key terms is moot. The earlier row, kept for the record: ~~Reason: in Titus the check covers 5 terms, and the Chinese reader (#31, not yet named) is to read all 93 ([glossaries.md](glossaries.md), "Not done"). Tripwire: before the zh-Hans key terms of a second book are drafted (#53's own gate). Outcomes then: (1) a written answer says the New Punctuation text is public domain or otherwise usable as an input under AGENTS.md, and the content team has chosen its spellings over the 1919 ones: Build. (2) A written answer says it may not be used: drop the check and leave names to the reader. (3) No written answer yet: keep biding, and do not draft the next book's zh-Hans key terms until there is one.~~ |
| Build  | minimal                           | Not built yet: this PR pins Titus and sets the bar. The check under "Build" below: one `zh-cuv-<book>` pin per drafted book, and a `cuv` gate on each `names/*` term with no FIA `reference`, recorded so the term goes to the reader, not a hard failure. Traced to Breaks (2) and (3): (2) is why a mismatch is a flag for the reader, not an error; (3) is why FIA terms are skipped.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

Reversibility: forward = low; backward = low. One pin per drafted book and
one gate; removing them (ADR 0004, "What would reopen it") leaves the records
and titles as they were, less the `cuv` gates.

## Recommendation

**Superseded 2026-11-02 by [ADR 0004](../decisions/0004-cuv-names-check.md):
build the check.** The earlier recommendation, kept for the record: ~~Bide.
Do not pin `zh_cuv` now. For Titus, put the Crete spelling in front of the
Chinese reader as a question (革哩底 or 克里特), and let the reader's review
cover the other four names, which already agree with `zh_cuv`.~~

## Build: definition of done

For the PR that builds the check (#53). Each item is checked in that PR by a
test or a recorded command, not by reading the code.

**Where it runs: a flag, not a refusal.** ADR 0004 says a mismatch is
flagged and the term goes to the Chinese reader; the build does not stop on
it. The repo already has that mechanism: the `reference` gate records a
headword that does not use its FIA rendering, so the term is `unreviewed`
and listed under the built file's `review` (`docs/schema.md`,
`data/glossary-drafts/`). The CUV check is one more gate of that kind,
named `cuv`.

1. **Input.** `DRAFT_LANGUAGES["zh-Hans"]` names the CUV pin prefix
   (`zh-cuv`). The build, and the drafting run before any model call, read
   `zh-cuv-<book>` through `readSource`; a zh-Hans record or run for a book
   with no such pin is refused with a message naming the missing id.
2. **Which terms.** Every `names/*` term with no `reference`. A term that
   names an FIA `reference` is skipped, whatever CUV writes (FIA is binding,
   ADR 0004). No other term is touched.
3. **The rule.** For each of the term's TWL verses (its `refs`), take that
   verse's text from the CUV file: the plain verse body only. That is the
   words after `\v N` up to the next `\v` or `\c`, with notes discarded
   whole (footnotes `\f`…`\f*`, cross-references `\x`…`\x*`, and their
   `\fr`, `\ft` and other parts: Titus has 5 footnotes, at 2:13, 3:3, 3:7,
   3:8 and 3:14), word attributes discarded (`\w word|attrs\w*` keeps
   `word`), every other USFM marker removed with its text kept (`\pn`,
   `\pn*`, `\add`, `\add*` and any other `\name` or `\name*`), section
   headings (`\s1`, `\s5` and the like) and other lines outside verses
   ignored, and whitespace (U+3000 included) removed. Renderings are the
   headword split on 、, as `usesReference` splits them. Both sides map
   U+2022 (•) to U+00B7 (·). The term passes when, at every verse, at least
   one rendering is a substring of that verse's text. Otherwise its gates
   include `cuv`. Two accepted limits, as for `usesReference`: one rendering
   found clears the others (保罗、扫罗 passes at 1:1 on 保罗 alone), and a
   substring hit can sit inside a longer name. The check catches a spelling
   CUV does not use at all; the reader still reads every term.
4. **A missing verse is an error,** not a pass: a TWL verse the CUV file
   does not have stops the build (and the run) naming the term and verse.
5. **Same gate everywhere.** `cuv` is computed by the drafting run and
   written into new records, recomputed by `buildDraftGlossary`, which
   refuses a record whose recorded gates differ (as it does today), and
   applied to a reader's `review.text`, since a reader who changes a
   headword is held to the gates the model was (maintainer, 30 Oct, #53). A
   reader may still accept a flagged headword as drafted (a review with no
   `text`), which records their choice of spelling.
6. **The Titus record.** `names/crete` in
   `data/glossary-drafts/zh-Hans/TIT.json` gains `"gates": ["cuv"]` and
   `"status": "unreviewed"`, which is what the gate pass gives it; its
   headword, source, check and the calls are unchanged. The rebuilt
   `data/glossaries/zh-Hans/TIT.json` has Crete `unreviewed`, with
   `"review": ["names/crete"]`. Both are committed, so a fresh
   `npm run build` leaves `data/` and `dist/` clean; nothing in `dist/`
   changes.
7. **Credits.** The CUV pin is not added to the built glossary's
   `attribution`, and its licence is not mixed into the glossary's: no CUV
   text is copied into the output, only the gate name (ADR 0004, "Scope of
   the use"). `sources.json` carries its attribution.
8. **Tests that fail on `main`:** Crete flagged and the other four Titus
   names passing, on the pinned inputs; a term with a `reference` skipped
   even when CUV differs; marker stripping, headings ignored, a name that
   occurs only in a footnote or cross-reference flagged, and `·`/`•`;
   a name found at one of two verses flagged; a missing verse refused; a
   missing `zh-cuv-<book>` pin refused; a `review.text` that fails `cuv`
   refused; a record whose Crete term lacks the gate refused.
9. **Measured on Titus, re-derived.** All 93 terms: how many are checked,
   skipped for a `reference`, not names; how many pass; which are flagged and
   at which verses. Expected from the measurement above: 5 checked, 0
   skipped, 4 pass, Crete flagged at 1:5 and 1:12. The count is produced a
   second time by an independent script (not the check's code) and both
   outputs go in the PR.
10. **Docs.** `docs/schema.md` lists the `cuv` gate with the others;
    [glossaries.md](glossaries.md), "Not done", no longer lists the names
    check; this file's Build row says built.

## Commands

Scratch scripts lived outside the tree; downloads went to their own empty
directories.

```sh
S=b993881167d730846cf2efcc1e0a1f58a3cd8b65
curl -s "https://git.door43.org/api/v1/catalog/search?lang=zh&limit=50" | jq -r '.data[]|[.full_name,.subject]|@tsv'
curl -s "https://git.door43.org/Door43-Catalog/zh_cuv/raw/commit/$S/manifest.yaml"   # rights: 'Public Domain'
curl -s "https://git.door43.org/Door43-Catalog/zh_cuv/raw/commit/$S/57-TIT.usfm"     # sha256 a78a9a3e…dde2
curl -s "https://git.door43.org/Door43-Catalog/zh_cuv/raw/commit/$S/42-MRK.usfm"     # sha256 4e2c8611…0d4
curl -s https://ebible.org/Scriptures/translations.csv | grep cmn                   # cmn-cu89s: public domain
jq -r '.terms|to_entries[]|select(.key|startswith("names/"))|[.key,.value.headword,(.value.reference//"-")]|@tsv' \
  data/glossary-drafts/zh-Hans/TIT.json
grep "/names/" .cache/sources/twl-en-tit.* | cut -f1,6
cat .cache/sources/twl-en-* | cut -f6 | grep -o '/names/[a-z0-9-]*' | sort -u | wc -l                # 352
cat .cache/sources/twl-en-* | cut -f6 | grep -o '/\(kt\|other\|names\)/[a-z0-9-]*' | sort -u | wc -l  # 938
```
