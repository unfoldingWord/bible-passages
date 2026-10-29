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
| Build  | minimal  | For Titus: `scripts/data/glossaries.ts` writes `data/glossaries/<lang>/TIT.json` for the 9 languages above from pinned files only; `scripts/data/pin-glossaries.ts` pins them. Traced to Breaks 2 to 5: the repo per language, the gaps and the heading parse are what the code adds. No Chinese glossary is built (Break 1).                                                                                                                                                                                                                                                                                                         |

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

## Not done

- The other 65 books: each needs its TWL pinned and its absent lists measured
  (`node scripts/data/pin-glossaries.ts` after adding the book to `BOOKS`).
  Titus pins 830 files. A pin is per language and article, shared by every
  book, so the whole Bible needs at most about 8,600 _(estimated: 953
  articles in `en_tw` v91 × 9 languages, plus 66 TWL files; an upper bound,
  since releases lack some articles)_. Pinning whole releases instead of
  files is a choice to make before the second book.
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
