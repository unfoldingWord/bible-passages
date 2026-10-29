# Scoping: glossaries

Part of [7. Translation](ai.md#7-translation). A glossary gives each key term
a book uses one agreed rendering per language, so a name or a key term reads
the same in every title of that language. Tracking issue: #9.

Everything below was measured on 2026-10-28 against git.door43.org unless it
is labelled otherwise. The commands are at the end.

## What exists: Translation Words on Door43

Door43 catalog, subject `Translation Words`, one query per language
(`/api/v1/catalog/search?subject=Translation%20Words&lang=<tag>`). Licence is
the `rights` line of each release's `manifest.yaml`. Articles are the
`bible/{kt,names,other}/*.md` files in the release's git tree. "Titus" is how
many of the 93 articles that `unfoldingWord/en_twl` v91 links from Titus the
release has.

| v0.1 language | Door43 tag | Repo used                          | Release | Commit     | Released   | Licence      | kt / names / other | Titus  |
| ------------- | ---------- | ---------------------------------- | ------- | ---------- | ---------- | ------------ | ------------------ | ------ |
| English       | `en`       | `unfoldingWord/en_tw`              | v91     | `ff5b3852` | 2026-09-26 | CC BY-SA 4.0 | 190 / 355 / 408    | 93/93  |
| Arabic        | `ar`       | `BSOJ/ar_tw`                       | v5      | `7c233628` | 2025-05-21 | CC BY-SA 4.0 | 192 / 355 / 415    | 93/93¹ |
| French        | `fr`       | `Xenizo/fr_tw`                     | v2.0    | `06db7f85` | 2023-12-07 | CC BY-SA 4.0 | 211 / 329 / 466    | 92/93  |
| Hindi         | `hi`       | `translationCore-Create-BCS/hi_tw` | v8      | `5fa7b590` | 2025-12-30 | CC BY-SA 4.0 | 230 / 347 / 471    | 92/93  |
| Indonesian    | `id`       | `bahtraku/id_tw`                   | v26     | `31c26039` | 2025-08-27 | CC BY-SA 4.0 | 161 / 293 / 261    | 93/93  |
| Chinese       | none       | none                               |         |            |            |              |                    | 0/93   |
| Portuguese    | `pt-br`    | `Door43-Catalog/pt-br_tw`          | v6.4    | `879ce384` | 2022-04-22 | CC BY-SA 4.0 | 204 / 343 / 472    | 90/93  |
| Russian       | `ru`       | `ru_gl/ru_tw`                      | v14.2   | `861807f8` | 2024-11-06 | CC BY-SA 4.0 | 211 / 347 / 460    | 92/93  |
| Spanish       | `es-419`   | `es-419_gl/es-419_tw`              | v37     | `7586f4ff` | 2024-07-17 | CC BY-SA 4.0 | 212 / 347 / 496    | 92/93  |
| Swahili       | `sw`       | `Door43-Catalog/sw_tw`             | v7.3    | `82e94cd4` | 2021-02-23 | CC BY-SA 4.0 | 211 / 347 / 494    | 92/93  |

¹ 16 of the 93 Arabic headwords are still English (see Break).

The article every language but English, Arabic and Indonesian lacks is
`other/age-timeperiod`, which is newer than those releases. Portuguese also
lacks `other/strife` and `other/subject`.

Other catalog entries, measured the same way and not used:

| Repo                       | Release | Titus | Why not                                                                                                                       |
| -------------------------- | ------- | ----- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ar_gt/ar_tw`              | v3      | 91/93 | Tagged `ar` but written in Persian: its headwords use U+067E (peh) 18 times and Persian yeh U+06CC 149 times, Arabic yeh none |
| `unfoldingWord/fr_tw`      | v7.3    | 83/93 | Older (2021-02-23) and lacks 10 Titus articles                                                                                |
| `MVHS/fr_tw`               | v0.0.1  | 92/93 | Same counts and the same sampled headwords as `Xenizo/fr_tw`, released earlier (2022-08-11)                                   |
| `es-419_obt/es-419_tw`     | v0.0.6  | 92/93 | Same counts as `es-419_gl/es-419_tw`, released earlier (2023-03-16)                                                           |
| `WycliffeAssociates/en_tw` | v19-10  | n/a   | English already comes from unfoldingWord's own current release                                                                |

Chinese: no catalog entry under `zh`, `zh-Hans`, `zh-hans` or `cmn` for
Translation Words. The only `zh` entries in the catalog are a Bible
(`zh_cuv`) and Open Bible Stories. A repository search for `zh_tw` finds
three personal repositories, each with no Translation Words articles.

## Translation Word Links

TWL rows name a verse, the Greek or Hebrew words, and a link to a tW article
(`rc://*/tw/dict/bible/kt/god`). The links follow the original language, so
one TWL file serves every language. `unfoldingWord/en_twl` v91 (`7cbb3419`,
CC BY-SA 4.0) has 182 rows for Titus linking 93 articles (110 rows to `kt`,
6 to `names`, 66 to `other`).

Language TWLs exist for ar, es-419, fr, hi, id and ru, none for pt-br or sw.
For Titus they have the same columns as `en_twl` and differ from it only by
version: the ar and id files link 3 articles `en_twl` v91 does not, and the
others 19, while each lacks 1 to 3 that it links. Inference: they are
earlier copies of `en_twl`, not language-specific work, so this build uses
`en_twl` for every language.

## 6B

### Glossaries

| Step   | Verdict  | Evidence / justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Borrow | applied  | Translation Words headwords for 8 of the 9 v0.1 languages plus English, at the releases in the table above, all CC BY-SA 4.0 by their manifests. Translation Word Links: `unfoldingWord/en_twl` v91 at `7cbb3419`.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Bend   | applied  | The English TWL is used for every language, because its links are keyed to the Greek and Hebrew, not to English. Each language's article at the same path gives the headword (assumption: a translated article at a given path renders the same concept; spot-checked on `kt/god`, `names/paul`, `kt/grace`, `other/elder`, `kt/faith` in every language).                                                                                                                                                                                                                                                                            |
| Break  | observed | (1) **Chinese has no Translation Words** on Door43 (catalog and repository search above). (2) **`ar_gt/ar_tw` is Persian**, though tagged `ar`; the "final yeh" difference reported in [ai.md](ai.md#7-translation) is this. `BSOJ/ar_tw` uses Arabic yeh only, so no normalising is needed. (3) **16 of 93 Arabic headwords for Titus are English** in `BSOJ/ar_tw` (`kt/faith`, `names/titus`, and 14 more; listed as gaps in `data/glossaries/ar/TIT.json`). (4) Releases lack 1 to 3 of the 93 Titus articles (table). (5) Headings are written in at least four ways (`# x`, `#x`, `## x`, `# x #`), some with byte-order marks. |
| Beget  | skipped  | No owner yet, so nothing is delegated. To ask: Chinese (zh-Hans): a Chinese team that works with unfoldingWord to carry a Translation Words key-term list, starting with Titus's 93 terms. No owner yet. Fallback if no owner by go/no-go 2 in [plan.md](plan.md) (13 Nov): an AI-drafted zh-Hans term list from the English headwords and articles, every entry `source: "ai:<model>"`, checked by a second model and reviewed by a Chinese reader before titles use it. The 16 English Arabic headwords go to the Arabic tW team the same way, with the same fallback.                                                              |
| Bide   | n/a      | Nothing in the field is converging on a Chinese tW that we observed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Build  | minimal  | For Titus: `scripts/data/glossaries.ts` writes `data/glossaries/<lang>/TIT.json` for the 9 languages above from pinned files only; `scripts/data/pin-glossaries.ts` pins them. Traced to Breaks 2 to 5: the repo per language, the gaps and the heading parse are what the code adds. No Chinese glossary is built from tW (Break 1); see "Chinese (zh-Hans)" below.                                                                                                                                                                                                                                                                  |

Reversibility: forward = low; backward = low. Glossaries are generated from
pins; changing a repo is a new pin and a rebuild.

## What the build writes

`data/glossaries/<lang>/<BOOK>.json`, one per language with Translation Words:

```json
{
  "language": "fr",
  "book": "TIT",
  "links": "twl-en-tit",
  "words": { "repo": "Xenizo/fr_tw", "release": "v2.0", "commit": "06db7f85…" },
  "licence": "CC-BY-SA-4.0",
  "attribution": [
    "unfoldingWord Translation Word Links, unfoldingWord/en_twl v91, …",
    "Translation Words (fr), Xenizo/fr_tw v2.0, …",
    "Translation Words (en), unfoldingWord/en_tw v91, …"
  ],
  "terms": {
    "kt/god": {
      "en": "God",
      "headword": "Dieu",
      "source": "tw-fr-kt-god",
      "refs": ["1:1", "1:2", "…"]
    }
  },
  "gaps": { "other/age-timeperiod": "no-article" }
}
```

- `licence` and `attribution`: copied from `sources.json` for every pin the
  file's content comes from (the TWL file, this language's tW, and English
  tW for the `en` headwords), each attribution once. The build refuses a
  glossary whose sources do not share one licence.
- `terms`: every article the book's TWL links that has a headword in this
  language: the English headword, this language's headword (the article's
  first heading, as written), the `sources.json` id it was read from, and the
  verses that link it.
- `gaps`: linked articles with no usable headword. `no-article`: the release
  has no such article (each is listed in `scripts/lib/glossaries.ts` as
  measured, and the build fails if the pins disagree). `english-headword`:
  for Arabic, Hindi and Russian, a headword not mostly in that script: more
  than half of its letters must be in the script (marks such as vowel signs
  are not counted), so a stray letter of the script does not make English a
  term (#22). On Titus this changed nothing: no headword mixes scripts
  (measured, see #22's PR).
- Headwords are the full heading line (`grâce, gracieux`): which form a
  title uses is a translation choice, not the glossary's.

Titus, built: en 93 terms; id 93; es-419, fr, hi, ru, sw 92 each with 1 gap;
pt-BR 90 with 3; ar 77 with 16.

## Chinese (zh-Hans)

Decision 14 ([decisions/0003](../decisions/0003-v0.1-scope-and-titles.md)):
one model drafts a zh-Hans key-term list for the terms a book links, a second
model checks it, and a Chinese reader reviews it. Issue #31. Measured on
2026-10-29 unless labelled otherwise; commands at the end of this section.

### 6B

| Step   | Verdict  | Evidence / justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Borrow | applied  | **FIA Key Terms (zhs)**, `cistern/zhs_fiakt-raw` on Door43 at `e08f9c5f` (a BibleAquifer mirror): 155 Simplified Chinese key terms, all `reviewLevel: Professional`, © SRV Partners 2023, CC BY-SA 4.0 (the file's `licenseInfo` and the repo's `metadata.json`), MD5 matching the metadata. Pinned as `fia-kt-zhs`. 15 of its terms are associated with Titus passages. Also used unchanged: `en_twl` v91 (which articles), `en_tw` v91 (English headwords and definitions), the OpenRouter client from #36.                                                                                                                                                                                |
| Bend   | applied  | FIA is a reference list, not a glossary of tW articles: both models get it and the drafter names the FIA term it follows (24 of 93 do), so the reader sees which renderings rest on a reviewed source. The title runner's record-a-run pattern (ledger, `.cache/` output, spend fuse) is reused for a draft-then-check pair.                                                                                                                                                                                                                                                                                                                                                                 |
| Break  | observed | (1) No Chinese Translation Words or TWL in the Door43 catalog: the production stage for `zh`, `zh-Hans`, `zh-hans`, `zh-CN`, `zh-cn`, `cmn`, `zh-tw`, `zh-Hant` has only `zh_cuv`, OBS and `zh-hant` OBS; the latest stage for `zh`, `zh-hans`, `cmn` adds personal Bible, OBS-notes, Translation Notes and Questions repos, none Translation Words. The three `zh_tw` repositories have no articles (above). (2) FIA covers 155 concepts and none of the tW article ids; it cannot fill 93 tW terms by itself. (3) `cistern/zhs_bsnkt-raw` (Biblica key terms, zhs) holds one term. (4) The build clears and regenerates `data/glossaries/`, so a committed AI file there would be deleted. |
| Beget  | skipped  | Still no Chinese team named to carry a Chinese tW (same as above); decision 14 took the fallback.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Bide   | n/a      | Nothing observed converging on a Chinese tW.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Build  | minimal  | `scripts/lib/key-terms.ts` and `scripts/translate/key-terms.ts` (Breaks 1–3: one draft call, one check call, gates, a ledger), `prompts/key-terms.md`, and a build step that turns the committed record in `data/glossary-drafts/` into `data/glossaries/zh-Hans/` offline (Break 4). The title runner leaves out AI terms until a person has reviewed them.                                                                                                                                                                                                                                                                                                                                 |

Reversibility: forward = low; backward = low. The record is one committed
file; a new run replaces it in a new commit, and nothing in `dist/` reads it.

### Recorded, not rebuilt

A model's answer cannot be reproduced byte for byte, and CI must not call a
model. So the run writes a record (`.cache/key-terms/<run>/zh-Hans/TIT.json`)
that is committed unchanged to `data/glossary-drafts/zh-Hans/TIT.json`, with
both OpenRouter generation ids, tokens, cost and the prompt's SHA-256. `npm
run build` reads only that file and the pins, so the rebuild gate stays
offline apart from Door43 pins and stays clean. The build refuses a record
whose articles differ from the TWL's, whose English headword differs from
the pinned `en_tw` (stale), or whose status breaks the rule; a test holds the
recorded prompt hash to the committed prompt file. Changing the prompt or
the inputs means a new run.

### Models

Drafted by `google/gemini-3.8-flash`, checked by
`anthropic/claude-sonnet-5.5` (the two models the maintainer chose for #10).
Why this way round (a judgement, not measured): the draft is the longer
output (93 terms with notes), and Gemini Flash costs less per output token
($4.125 per million against $10, OpenRouter's model list, read 2026-10-29);
Claude Sonnet is the model this repo already uses for judging wording, and
the check decides the status. Either way the check is cross-family, as ADR
0002 asks.

### Titus run (measured)

| Call  | Model                         | Prompt tokens | Completion tokens (reasoning) | Cost (USD) | Time   |
| ----- | ----------------------------- | ------------- | ----------------------------- | ---------- | ------ |
| draft | `google/gemini-3.8-flash`     | 13,205        | 8,792 (6,270)                 | 0.042874   | 51.1 s |
| check | `anthropic/claude-sonnet-5.5` | 18,546        | 3,410 (1,726)                 | 0.071192   | 18.0 s |
|       | total                         | 31,751        | 12,202                        | 0.114066   |        |

Source: `data/glossary-drafts/zh-Hans/TIT.json`, `calls`. Result: 93 of 93
linked articles drafted, 0 gate failures, the checker agreed with all 93
(so all are `ai-checked` and `review` is empty), 24 follow an FIA term, 1
carries a note (`kt/god`: 神 first, 上帝 named). Re-derived with `jq` over the
record and the TWL file fetched with `curl` (93 articles, the same set).

### Checker calibration (measured)

Agreement on all 93 says little unless the checker can disagree. One more
check call, same prompt and inputs, with six terms of the draft replaced by
seeded errors (not committed; $0.05686, 18,535 + 1,979 tokens):

| Seeded error                                       | Caught |
| -------------------------------------------------- | ------ |
| `kt/glory` 榮耀 (traditional character)            | yes    |
| `other/elder` 老人 (old people, not the office)    | yes    |
| `kt/holyspirit` 圣神 (the Catholic term)           | yes    |
| `kt/savior` 救世军 (the Salvation Army)            | yes    |
| `other/wine` with 烈酒 and 啤酒 added              | yes    |
| `names/crete` 克里特 (meant as not the CUV 革哩底) | no     |

It raised no disagreement on the 87 unchanged terms. The sixth seed turned
out not to be an error: `Door43-Catalog/zh_cuv` (新标点和合本, the revised
punctuation edition of the Chinese Union Version; its manifest says public
domain) writes 克里特 at Titus 1:5 and 1:12; 革哩底 is, as far as known here, the original 1919 spelling (not checked against a copy).
So the checker caught 5 of 5 real errors (wrong sense, wrong tradition,
traditional characters, padding), and the Crete spelling is a real choice
between two editions, which the draft did not note. The other Titus names in
the draft (提多, 保罗, 亚波罗, 推基古) are spelled as `zh_cuv` writes them
(`grep` over its `57-TIT.usfm`). One calibration run of six seeds is a
small sample, so every term still needs the reader: `ai-checked` is not a
review.

### Not done

- A Chinese reader is not yet named (the maintainer names one on #31). Their
  review is recorded as a later change to the record.
- Names are not checked against a pinned Chinese Bible. `zh_cuv` on Door43
  could be pinned for that; it would have flagged 革哩底 against 克里特.
- Traditional characters are not gated mechanically (no reliable offline
  test); the checker caught one in calibration.
- Other books: one run per book, after the reader has seen Titus.

### Commands

```sh
# Catalog and repository search (Break 1, 3)
for l in zh zh-Hans zh-hans zh-CN zh-cn cmn zh-tw zh-Hant; do   # and stage=latest for zh, zh-hans, cmn
  curl -s "https://git.door43.org/api/v1/catalog/search?lang=$l&limit=100" \
    | jq -r '.data[] | [.language,.full_name,.subject] | @tsv'; done
curl -s "https://git.door43.org/api/v1/repos/search?q=zhs&limit=50" | jq -r '.data[].full_name'

# FIA licence, checksum and Titus terms
curl -s https://git.door43.org/cistern/zhs_fiakt-raw/raw/commit/e08f9c5f87a09f78c8c3c5cdfcc4964cdd0965c1/metadata.json \
  | jq '.copyright, .ingredients'
jq -r '.[] | select([.associations[]? | select(.startBookCode=="TIT")] | length > 0) | .name' fia.json

# The run (key from the environment only)
node scripts/translate/key-terms.ts --book TIT --lang zh-Hans \
  --draft-model google/gemini-3.8-flash --check-model anthropic/claude-sonnet-5.5 \
  --max-cost 0.60
```

## Spanish tag (open)

Translation Words for Spanish is published as `es-419` (Latin American
Spanish); the v0.1 list, `ai.md` and the project site say `es`. One tag has
to be chosen for `data/titles/`, `data/glossaries/` and `dist/` so they join.
Until then the glossary uses the source's tag, `es-419`.

**Proposed: `es-419`.**

- It says what the text is. Every Spanish input found is `es-419`: the
  Translation Words and TWL above, published by the `es-419_gl` organisation.
  Titles translated with this glossary would be Latin American Spanish;
  `es` would claim a general Spanish nobody has reviewed for.
- It leaves room. A later Spanish for Spain (`es-ES`) can be added beside it
  without retagging anything.
- Its cost: under BCP 47 lookup (RFC 4647) a reader asking for `es-419`
  falls back to `es`, but one asking for `es` does not reach `es-419`. The
  vendored tc-mobile checker compares title-table languages exactly
  (`vendor/tc-mobile/validate.ts`), so an app on an `es` or `es-ES` device
  would need a fallback to find the table. How tc-mobile picks a table at
  run time was not checked here.

The alternative, `es`, is easier for apps and matches the current list, but
labels Latin American Spanish as Spanish in general. The maintainer decides.

Related, not a decision: the dataset writes BCP 47 tags in their usual case,
`pt-BR`, where Door43 writes `pt-br`. Tags compare case-insensitively.

## Every book (#30)

Measured on 2026-10-29 at the pinned commits above, unless labelled. The
code landed first (#52) with the build still Titus-only; `GLOSSARY_BOOKS`
is now `TWL_BOOKS`, and the 59 books' pins and glossaries are committed.

### What running it over every book broke

1. **`en_twl` v91 has 59 books, not 66.** Its git tree has no
   `twl_NUM.tsv`, `1CH`, `2CH`, `ECC`, `ISA`, `JER` or `EZK` (404 at the
   pinned commit). `en_twl` master (unreleased) has them; so do older
   copies such as `ru_gl/ru_twl` v6 and `BSOJ/ar_twl` v5.1. These seven
   books are `TWL_UNRELEASED`: no glossary until a release that has them is
   pinned. Which source to use for them is open (below).
2. **Psalms references.** 155 Psalms rows use `c:front`, the superscription
   before verse 1. Read as verse 0, written back as `c:front`, sorted
   before verse 1. Refs are in the TWL's versification (the ULT's), not
   necessarily the structure's; untested beyond Titus, a watch item.
3. **Two article names have an underscore**: `other/bear-witness_testify`
   and `other/house-descendants_nation` (en_tw v91 tree; 180 TWL rows).
   `ARTICLE` allows `_`; `twId` writes it as `--`, which no name has.
4. **Absent lists per book did not scale**: 11,957 book-article pairs, and
   2,501 gaps for Indonesian alone. An absent article is a fact about the
   release, so `absent` is one list per language
   (`scripts/lib/glossary-absent.ts`), measured over all 59 books by a
   separate Python script and re-derived by `pin-glossaries.ts`, which
   refuses to pin if they disagree. They agreed.
5. **Nine articles have no heading line** (hi `kt/church`, `names/greek`,
   `names/jamesbrotherofjesus`, `names/marysisterofmartha`,
   `other/shepherd`; id `names/redsea`, `other/partial`, `other/report`,
   `other/rod`): the `#` is missing or has text before it
   (`mendukung# pilih kasih`). They are `no-heading` gaps; guessing the
   headword is not ours to do.
6. **`kt/arcofthecovenant`** is linked once (2 Samuel) and exists in no
   release, English included; `kt/arkofthecovenant` does. Inference: a typo
   in `en_twl`. A `no-article` gap in every language.
7. **The build re-parsed `sources.json` for every read**, fine at 484 KB,
   not at 4.1 MB. It now reads it once.

### Sizes and gaps, all 59 books (measured on a local branch)

| Measure                   | Value                                             |
| ------------------------- | ------------------------------------------------- |
| Distinct articles linked  | 938 (of 953 in `en_tw` v91)                       |
| Glossary pins             | 7,951 (59 TWL + 7,892 tW), up from 830: 7,121 new |
| `sources.json`            | 4,148,228 bytes, up from 484,048                  |
| `data/glossaries/`        | 531 files, 26,632,415 bytes                       |
| `pin-glossaries.ts`, cold | 3 min 37 s; the build with a warm cache 7 s       |

Per language, summed over the 59 books (distinct articles in brackets):

| Language | Terms  | no-article  | no-heading | english-headword |
| -------- | ------ | ----------- | ---------- | ---------------- |
| en       | 11,956 | 1 (1)       | 0          | 0                |
| ar       | 6,542  | 44 (5)      | 0          | 5,371 (638)      |
| es-419   | 11,617 | 340 (39)    | 0          | 0                |
| fr       | 11,393 | 564 (69)    | 0          | 0                |
| hi       | 11,551 | 349 (41)    | 57 (5)     | 0                |
| id       | 9,400  | 2,501 (243) | 56 (4)     | 0                |
| pt-BR    | 11,137 | 820 (70)    | 0          | 0                |
| ru       | 11,608 | 349 (41)    | 0          | 0                |
| sw       | 11,584 | 373 (41)    | 0          | 0                |

Each count was produced twice: by the build, and by a separate Python
script from the TWL files, the release trees and the cached articles. They
agree. Arabic is the large gap: 638 of the 938 articles in `BSOJ/ar_tw` v5
still have an English headword.

### 6B: every book

| Step   | Verdict  | Evidence / justification                                                                                                                       |
| ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Borrow | applied  | The same pins as Titus: `unfoldingWord/en_twl` v91 (59 books) and the nine tW releases in the table at the top.                                |
| Bend   | applied  | Unchanged from Titus: the English TWL for every language.                                                                                      |
| Break  | observed | The seven above, each from running the pin script and the build over all 59 books.                                                             |
| Beget  | skipped  | No owner yet. To ask: the `en_twl` team (seven unreleased books, the `arc` link), the Arabic tW team (638 English headwords), hi and id teams. |
| Bide   | waiting  | The seven books (maintainer's decision): tripwire is an `en_twl` release with them (#57).                                                      |
| Build  | minimal  | `TWL_BOOKS`, `c:front`, `_` in ids, per-release absent lists, the `no-heading` gap, one read of `sources.json`: one per Break, nothing else.   |

Reversibility: forward = low; backward = low. All generated from pins.

### Decided by the maintainer (2026-10-29)

- **The seven books without a released TWL: wait for a release.** No
  glossary for them now; a known gap in the CHANGELOG. #57 asks the content
  team whether an `en_twl` release with them is coming. Not chosen: pinning
  `en_twl` master (unreleased work) or an older full copy
  (`ru_gl/ru_twl` v6).
- **Size: commit it, and cache CI's downloads.** 26.6 MB of glossaries and
  a 4.1 MB `sources.json` go into git. CI caches `.cache/sources/` keyed on
  the hash of `sources.json`, so it fetches from Door43 only when pins
  change. A stale or partial cache cannot change the data: each file is
  named by its id and pinned SHA-256 and hash-checked on every read
  (`scripts/lib/sources.ts`). Checked locally: a cached file overwritten
  with other bytes was refused and deleted, and the next run fetched it
  again, byte-identical.

## Not done

- How complete or reviewed each translation is beyond its headwords was not
  measured.
- How the translation step uses a glossary (prompt, check) is part of
  [7. Translation](ai.md#7-translation).

## Commands

```sh
# Catalog entries per language (tW; TWL with the TWL subject)
curl -s "https://git.door43.org/api/v1/catalog/search?subject=Translation%20Words&lang=$l" \
  | jq -r '.data[] | [.language,.full_name,.branch_or_tag_name,.commit_sha,.released] | @tsv'
curl -s "https://git.door43.org/api/v1/catalog/search?subject=TSV%20Translation%20Words%20Links&lang=$l"

# Article counts at a release commit
curl -s "https://git.door43.org/api/v1/repos/$repo/git/trees/$sha?recursive=1&per_page=99999" \
  | jq '[.tree[].path | select(test("^bible/kt/[^/]+\\.md$"))] | length'

# Licence
curl -s "https://git.door43.org/$repo/raw/commit/$sha/manifest.yaml" | grep rights:

# Titus links
curl -s "https://git.door43.org/unfoldingWord/en_twl/raw/commit/7cbb3419f79780ce84b92ad7d42bd476cc5d8a64/twl_TIT.tsv" \
  | cut -f6 | tail -n +2 | sort -u | wc -l          # 93

# Persian letters in ar_gt/ar_tw headwords (first heading of each Titus article)
grep -o $'ی' headwords.txt | wc -l            # 149
```

The pin script re-derived the per-language article counts with its own code
(Node, from the git tree) and pinned 829 articles plus the TWL file, matching
the shell counts above.
