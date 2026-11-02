# zh-Hans names check

A check that zh-Hans key-term headwords for proper names (`names/*`) agree
with the Chinese Union Version (CUV). Raised on #53 from the bench review of
PR #51; [glossaries.md](glossaries.md), "Not done", lists it. Exploration and
planning only: nothing here is built.

Observed 2026-11-02 at `main` `fdcbac4`.

## What is measured

The 4 of 5 was derived twice (a Python script over TWL verses, and a
separate `grep`/`awk` pass over the USFM); so was the 37 (`jq`, then
Python). The other rows are single `jq` or `cut` counts, each cheap to
repeat.

| Count                                                         | Value         | Source                                                                                                 |
| ------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------ |
| zh-Hans Titus key terms                                       | 93            | `jq '.terms\|length' data/glossary-drafts/zh-Hans/TIT.json`                                            |
| of them `names/*`                                             | 5             | same record: apollos, crete, paul, titus, tychicus                                                     |
| `names/*` that name an FIA `reference`                        | 0 of 5        | same record; none has `reference`                                                                      |
| all terms that name an FIA `reference`                        | 24 of 93      | same record                                                                                            |
| FIA zh-Hans entries with a capitalised English name           | 37            | pinned `fia-kt-zhs` (`e08f9c5`); none of Titus's 5; most are Gospel names (Bethsaida, Capernaum, Tyre) |
| `names/*` whose headword is in `zh_cuv` at every TWL verse    | 4 of 5        | `zh_cuv` `57-TIT.usfm` at `b993881`, verses from `twl-en-tit` (6 names rows)                           |
| the one that differs                                          | `names/crete` | record 革哩底、革哩底人; `zh_cuv` writes 克里特 at 1:5 and 1:12                                        |
| distinct `names/*` articles linked by the 59 pinned TWL books | 352 of 938    | `cut -f6` over the cached `twl-en-*` files                                                             |

So the check would touch 5 terms in Titus, but over a third of the linked
articles once every book is drafted.

## Candidate inputs and their licences

| Candidate                                                             | Licence as observed                                                                                                                                                                                                                                                                                                                                                                                                                          | Reachable from the sandbox     |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `Door43-Catalog/zh_cuv` at `b993881` (新标点和合本, 1989, simplified) | **Conflicting.** Its `manifest.yaml` (`rights: 'Public Domain'`), `LICENSE.md` and `README.md` say public domain, sourced from eBible `cmn-cu89s`; eBible's `translations.csv` and its `copr.htm` say public domain. YouVersion's page for the edition (bible.com/versions/48) says the Hong Kong Bible Society is the copyright agent of CUNP, the 1988 New Punctuation revision. No primary licence document from the publisher was found. | yes (`curl` fetched the files) |
| CUV 1919 (the original, unrevised text)                               | public domain by age (inference, not observed). No copy in the Door43 catalog; not inspected. Whether 革哩底 is its spelling is unverified.                                                                                                                                                                                                                                                                                                  | no source found                |
| eBible `cmncbs`, Biblica Open Contemporary Bible (simplified)         | CC BY-SA 4.0 (eBible details page). Not CUV: its names are its own, so it answers a different question.                                                                                                                                                                                                                                                                                                                                      | yes (ebible.org)               |
| Door43 Chinese resources (`cistern/zhs_*`)                            | FIA key terms (already pinned), Biblica key terms (1 term), translation guide, video dictionary and one more (`zhs_ubsi`, not opened). None of the opened ones is a names list.                                                                                                                                                                                                                                                              | yes                            |
| Chinese Translation Words                                             | none exists ([glossaries.md](glossaries.md), Break 1)                                                                                                                                                                                                                                                                                                                                                                                        | n/a                            |

AGENTS.md: "Copyrighted Bible text and headings are not inputs." Until the
New Punctuation edition's status is settled, `zh_cuv` cannot be pinned. It
also carries `\s1` section headings, which a check would have to ignore.

## 6B

### zh-Hans names check against CUV

| Step   | Verdict                           | Evidence / justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Borrow | skipped                           | The only CUV on Door43 is `Door43-Catalog/zh_cuv` at `b993881`. Its licence is conflicting (table above); improper authority: no source here can grant CC BY-SA 4.0 sharing while a copyright agent is named for the edition. No uW or partner names list for zh-Hans exists.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Bend   | applied (measured, not committed) | TWL gives each `names/*` term its verses; `zh_cuv` marks names with `\pn`. Checking that a headword occurs in the CUV verse at every TWL reference found 4 of 5 Titus names agree and flagged Crete. Run from scratch scripts outside the tree; nothing pinned.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Break  | observed                          | (1) Licence: see Borrow. (2) Edition: the record's 革哩底 and `zh_cuv`'s 克里特 are two spellings of one place; which edition the glossary follows is a content decision, not a check. (3) FIA versus CUV: run over CUV Mark, 7 of the 37 capitalised FIA names have no hit for any form. 3 are real wording differences (无酵节 / 除酵节, 希律党人 / 希律一党的人, 叙利亚腓尼基 / 叙利腓尼基), 2 are form differences (U+2022 in 凯撒利亚•腓立比 against U+00B7; 加利利的海 against 加利利海), 1 is absent from Mark's wording (弥赛亚), and 1 is a parse artefact of the annotated Judea entry. FIA is binding (maintainer decision on #53), so a CUV check would have to exempt every term that names an FIA `reference`. |
| Beget  | skipped                           | The licence question can only be answered by the maintainer (or by the copyright agent through them); no team carries a zh-Hans names list.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Bide   | waiting                           | Reason: in Titus the check covers 5 terms, and the Chinese reader (#31) reads all 93 anyway. Tripwire: before the zh-Hans key terms of a second book are drafted (#53's own gate). Inspect then: (a) has the maintainer settled the New Punctuation licence in writing, and (b) has the content team chosen the edition (1919 or 1988 spellings)? Both yes: Build. Either no: drop the check explicitly and leave names to the reader.                                                                                                                                                                                                                                                                                       |
| Build  | not-yet                           | If the tripwire passes: pin one `zh_cuv` book file per drafted book; for each `names/*` term with no FIA `reference`, require one headword form in the CUV verse at every TWL reference (markers stripped, `·`/`•` normalised); record a mismatch as a gate the reader sees, not a hard failure. Traced to Breaks (2) and (3).                                                                                                                                                                                                                                                                                                                                                                                               |

Reversibility: forward = low; backward = low. Nothing is pinned or built; a
later check is one source entry and one gate.

## Recommendation

Bide. Do not pin `zh_cuv` now. For Titus, put the Crete spelling in front of
the Chinese reader as a question (革哩底 or 克里特), and let the reader's
review cover the other four names, which already agree with `zh_cuv`.

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
```
