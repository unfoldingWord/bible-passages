# Scoping: metadata for v0.1

Part of [6. Metadata](pipeline.md#6-metadata). Tracking issue: #44.

Decision 11 ([ADR 0003](../decisions/0003-v0.1-scope-and-titles.md)) puts
in v0.1: key terms, figures of speech, and any other metadata already in the
data that needs no new writing. Key terms are built (glossaries for 59 books,
#62). This file measures the rest. Nothing here is built and no input is
pinned, because no build reads these files yet.

Everything below was measured on 2026-10-29 at the commits named, unless it
is labelled **estimated**, and the counts were re-run on 2026-10-30 (#84).
The measures both scripts compute (see "How it was measured") were produced
by two scripts written separately, and agree on every one. A few counts come
from script A alone or from one-off commands; that section lists them.

## The answer, in plain words

| Kind                       | Already in the data? | Source                                 | v0.1                                                                            |
| -------------------------- | -------------------- | -------------------------------------- | ------------------------------------------------------------------------------- |
| Key terms                  | yes                  | Translation Word Links and Words       | **in** (built, #62)                                                             |
| Figures of speech          | yes                  | Translation Notes `SupportReference`   | **in**: 59 books; names complete in 4 of 9 languages, partial in 2, absent in 3 |
| Literary form (poetry)     | yes                  | BSB `\q1` `\q2` `\qr` line markers     | **in**, proposed: poetry, prose or mixed per segment                            |
| Parallel passages          | yes                  | BSB `\r` lines under section headings  | **in**, proposed: per pericope                                                  |
| Difficulty                 | book level only      | Translation Academy, one article       | **in**, proposed: one rating per book, as a book field                          |
| Topics                     | no                   | nothing structured found               | out: would need new writing                                                     |
| Difficulty per passage     | no                   | nothing found                          | out: would need new writing                                                     |
| Comprehension questions    | yes, but content     | Translation Questions                  | out: questions and answers, not labels for a passage                            |
| Other translation issues   | yes                  | Translation Notes, non-figure `figs-*` | out: grammar, not figures of speech; later candidate                            |
| Discourse features         | yes, sparse          | Translation Notes, "Writing Styles"    | out: overlaps literary form; later candidate                                    |
| Book and chapter overviews | yes, as prose        | Translation Notes introductions        | out: turning prose into labels is new writing                                   |

"Proposed" rows are this measurement's recommendation; the requirements
owner decides them. Effort is under "Build effort" (estimated).

## Sources looked at

All on git.door43.org, found with the catalog
(`/api/v1/catalog/search?subject=<subject>&lang=<tag>`). Licence is each
release's `manifest.yaml` `rights` line.

| Resource                    | Repo, release          | Commit     | Released   | Licence       | Books |
| --------------------------- | ---------------------- | ---------- | ---------- | ------------- | ----- |
| Translation Notes (TSV)     | `unfoldingWord/en_tn`  | `e586762e` | 2026-09-26 | CC BY-SA 4.0  | 59    |
| Translation Academy         | `unfoldingWord/en_ta`  | `ce9a1bb9` | 2026-09-26 | CC BY-SA 4.0  | n/a   |
| Translation Questions (TSV) | `unfoldingWord/en_tq`  | `8be02772` | 2026-09-26 | CC BY-SA 4.0  | 59    |
| Translation Word Links      | `unfoldingWord/en_twl` | `7cbb3419` | 2026-09-26 | CC BY-SA 4.0  | 59    |
| Berean Standard Bible       | `Worldview/en_bsb`     | `7abbfafa` | (pinned)   | Public domain | 66    |

The notes, questions and word links (all v91) lack the same seven books:
NUM, 1CH, 2CH, ECC, ISA, JER, EZK. `en_tn` master (`05737d30`, 2026-10-29)
has all seven, unreleased, as `en_twl` master does (#57). The BSB files are
the 66 already pinned in `sources.json`, downloaded again and checked against
their SHA-256.

Also in the catalog for `unfoldingWord` in English, and not candidates: ULT
and UST (Bible text), the Hebrew, Greek and Aramaic grammars (reference
works, not keyed to passages), and the Open Bible Stories resources (stories,
not Bible passages). The catalog has no study notes or study questions for
Bible books in English (`TSV Study Notes` and `TSV Study Questions` return
nothing for `en`).

## Figures of speech

### What counts as a figure

A Translation Notes row names a Translation Academy article in
`SupportReference` (`rc://*/ta/man/translate/figs-metaphor`). The `figs-`
prefix is wider than figures of speech: Translation Academy has 66 articles
with it, including grammar (`figs-abstractnouns`, `figs-activepassive`),
pronouns and quotations. So "figure of speech" is taken from Translation
Academy's own table of contents (`translate/toc.yaml`), not from the prefix:

- the 19 articles in its "Figures of Speech" section, without the
  introduction `figs-intro`: apostrophe, aside, doublet, euphemism,
  hendiadys, hyperbole, idiom, irony, litany, litotes, merism, metaphor,
  metonymy, parallelism, personification, predictive past, rhetorical
  question, simile, synecdoche; and
- the 13 articles in its "Biblical Imagery" section, without its
  introduction. Only one of them is named by any note: `figs-exmetaphor`
  (extended metaphor), 128 rows.

So 20 figures occur in the notes.

### Counts

Granularity: one row per occurrence, on a verse (`1:5`) or a verse range in
one chapter (`1:5-7`); three rows list verses (`5:1,3,8,12`). No reference
failed to parse. A segment has a figure if any verse of a row naming it lies
in the segment.

| Measure                                     | Titus | All books with notes (59) |
| ------------------------------------------- | ----- | ------------------------- |
| Note rows                                   | 206   | 87,573                    |
| Rows naming any article                     | 157   | 79,297                    |
| Rows naming a `figs-` article               | 130   | 61,535                    |
| Rows naming a figure of speech              | 39    | 28,239 (28,111 + 128)     |
| Distinct figures                            | 8     | 20                        |
| Segments                                    | 25    | 10,557 of 13,770          |
| Segments with at least one figure           | 20    | 8,940                     |
| Segment–figure pairs (distinct per segment) | 28    | 20,088                    |
| Most figures in one segment                 | 3     | not compared              |
| Books with no notes                         | none  | 7 books, 3,213 segments   |

The other 61,535 − 28,239 = 33,296 `figs-` rows are the grammar and
translation-issue notes above; they are not figures of speech.

Rows per figure, all 59 books: metaphor 8,460; metonymy 5,702; idiom 4,807;
rhetorical question 1,615; synecdoche 1,321; parallelism 1,049; doublet
1,020; personification 1,003; simile 763; hyperbole 619; hendiadys 412;
merism 365; euphemism 346; predictive past 233; litotes 162; extended
metaphor 128; irony 100; apostrophe 91; aside 23; litany 20.

Psalms has 113 rows on `c:front` (a superscription), 12 of them figures.
They are not counted above. Read with the structure's verse-1 rule they
would fall in each psalm's first segment (#54 tracks the same reference form
for glossaries).

Titus, per segment (figure names are the articles' English titles):

| Segment     | Figures                         |
| ----------- | ------------------------------- |
| TIT.1.1-3   | metaphor                        |
| TIT.1.4-4   | metaphor                        |
| TIT.1.5-5   |                                 |
| TIT.1.6-7   | metaphor                        |
| TIT.1.8-9   | doublet, metaphor               |
| TIT.1.10-11 | hendiadys, metaphor, metonymy   |
| TIT.1.12-13 | hyperbole, metaphor, synecdoche |
| TIT.1.14-14 | metaphor                        |
| TIT.1.15-16 | metaphor                        |
| TIT.2.1-2   | doublet, metaphor               |
| TIT.2.3-5   | metaphor, metonymy              |
| TIT.2.6-8   | metaphor                        |
| TIT.2.9-10  |                                 |
| TIT.2.11-13 | hendiadys, personification      |
| TIT.2.14-14 | metaphor                        |
| TIT.2.15-15 |                                 |
| TIT.3.1-2   | doublet                         |
| TIT.3.3-3   | personification                 |
| TIT.3.4-5   | metaphor                        |
| TIT.3.6-7   | metaphor                        |
| TIT.3.8-8   |                                 |
| TIT.3.9-11  | metaphor                        |
| TIT.3.12-13 |                                 |
| TIT.3.14-14 | metaphor                        |
| TIT.3.15-15 | idiom                           |

Per-book counts for every measure in this file:
[`metadata/counts.tsv`](metadata/counts.tsv).

### Figure names in the v0.1 languages

A figure would be stored as its article id (`figs-metaphor`); its name in a
language is that article's `title.md` in the language's Translation Academy.
Catalog search, subject `Translation Academy`:

| Language   | Repo, release                         | Commit     | Licence      | Of the 20 figures used                                 |
| ---------- | ------------------------------------- | ---------- | ------------ | ------------------------------------------------------ |
| Arabic     | `BSOJ/ar_ta` v3                       | `a25e9ac3` | CC BY-SA 4.0 | 20 named                                               |
| French     | `Xenizo/fr_ta` v2.0                   | `358e2942` | CC BY-SA 4.0 | 20 named¹                                              |
| Hindi      | `translationCore-Create-BCS/hi_ta` v7 | `63a00a28` | CC BY-SA 4.0 | 20 named                                               |
| Indonesian | `bahtraku/id_ta` v30                  | `f8020122` | CC BY-SA 4.0 | 17 named; no apostrophe, aside, litany                 |
| Russian    | `ru_gl/ru_ta` v13.3                   | `815b9d95` | CC BY-SA 4.0 | 20 named                                               |
| Spanish    | `es-419_gl/es-419_ta` v4              | `26606b57` | CC BY-SA 4.0 | 17 named; aside, litany, predictive past still English |
| Portuguese | none                                  |            |              | 0: no Translation Academy with content on Door43       |
| Swahili    | none                                  |            |              | 0: none on Door43                                      |
| Chinese    | none                                  |            |              | 0: none on Door43                                      |

¹ Three French titles are the same as the English ("Doublet", "Hendiadys",
"Hyperbole"), and are also French words. One Indonesian title and one
Spanish title are the same as the English ("Litotes"), also a word in each
language. The three other Spanish ones ("Aside", "Litany", "Predictive Past")
are English. This reading is the measurer's, not a native reader's; no name
was checked for accuracy.

Not used: `ar_gt/ar_ta` v3.3 (the same organisation's `ar_tw` is Persian;
see [glossaries.md](glossaries.md)); `unfoldingWord/fr_ta` v10 and
`MVHS/fr_ta` v0.0.2 (older). Portuguese: the catalog's two `pt-br_ta`
entries (`pt-br_gl_brazil`, `es-419_gl`, stage `latest`) hold only a
manifest, a licence and a readme. Swahili and Chinese: no catalog entry;
repository search finds only personal repositories of 19 to 22 KB (`sw_ta`,
`zh_ta`), and `Door43-Catalog` has no `pt-br_ta`, `sw_ta` or `zh_ta`.

Names to write: 20 each for Portuguese, Swahili and Chinese, and 3 each for
Indonesian and Spanish: **66 strings**, done as the Chinese key terms were
(#31: one model drafts, a second checks, a reader reviews).

## Literary form: poetry and prose

BSB marks poetry lines with `\q1`, `\q2` and `\qr`, and prose with `\m`,
`\li*`, `\pmo` and `\pc`. A verse is poetic if a poetry marker is in force at
its `\v`, or a poetry marker inside it is followed by some of the verse's own
words. A bare `\q1` line just before the next `\v` belongs to the next verse;
counting it for the verse before gives 8,336 poetic verses instead of 8,181.
Licence: public domain. Versification: the 66 BSB files have exactly the
31,104 verses of `data/versification/ufw.json`, so BSB verse numbers are read
as the structure's (the assumption the structure build already makes; the
verse sets were compared, not what each verse contains).

| Measure          | Titus | 66 books |
| ---------------- | ----- | -------- |
| Verses           | 46    | 31,104   |
| Poetic verses    | 0     | 8,181    |
| Segments: poetry | 0     | 3,764    |
| Segments: prose  | 25    | 9,699    |
| Segments: mixed  | 0     | 307      |

No book is missing. Psalms: 1,134 poetry segments and 1 mixed. The label is
one of three values, so it needs no translation in the data; a reader app
names them in its own language.

## Parallel passages

BSB prints a line of references under 1,325 of its 3,016 section headings
(`\r (Matthew 5:3–12; Luke 6:20–23)`). Every `\r` line follows an `\s1`
(the previous line, skipping `\b` and blank lines, is the `\s1`: 1,325 of
1,325 `\r` lines), so each belongs to one pericope. The number of `\s1`
headings, 3,016, equals the number of pericopes in `data/structure/`. Titus
has 4; under 1:5–9, for example: 1 Timothy 3:1–7; 1 Peter 5:1–4. The lines
hold about 2,032 references (approximate and not re-derived: split at `;`
and `,`, so a list of verses in one chapter counts more than once). They use English book names, so a build
parses them to book codes and checks each against the versification.
Licence: public domain.

## Difficulty

Translation Academy's "Choosing What to Translate"
(`translate/translation-difficulty/01.md`) rates every book for how hard it
is to translate, citing a rating by Wycliffe Bible Translators: level 5
(hardest) 11 books, level 4 26, level 3 16, level 2 13, level 1 none; 66 in
all. Titus is level 3. Licence: CC BY-SA 4.0 (en_ta). It is one value per
book, not per passage, and it rates translating, not reading. Only the
requirements owner can say whether this is the "difficulty" decision 11
meant.

## Not in v0.1

- **Topics.** No uW or Door43 resource found assigns topics to passages. The
  book and chapter introductions in Translation Notes (59 book, 856 chapter)
  discuss themes in prose; turning them into topics is new writing.
- **Passage difficulty.** Nothing found.
- **Translation Questions.** 12,139 questions for 59 books, 36 for Titus,
  touching 8,711 of 10,557 segments (21 of 25 in Titus). They are questions
  with answers, not labels about a passage; publishing them is a different
  product.
- **Other translation issues.** The 33,296 non-figure `figs-` rows (and other
  `SupportReference` articles) could label segments with translation issues
  such as passive voice or abstract nouns. Decision 11 named figures of
  speech only.
- **Discourse features.** Translation Academy's "Writing Styles (Discourse)"
  articles are named by 2,220 note rows touching 1,788 segments (3 rows in
  Titus): new event 522, background 450, participants 349, poetry 315,
  hypothetical situation 173, end of story 106, oath formula 95, blessing 81,
  parables 75, proverbs 39, symbolic language 15. Poetry is covered better by
  the BSB markers above; the rest are sparse.

## 6B

### Figures of speech

| Step   | Verdict  | Evidence / justification                                                                                                                                                                                                                                                                                            |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Borrow | applied  | `unfoldingWord/en_tn` v91 at `e586762e` (`SupportReference`); `unfoldingWord/en_ta` v91 at `ce9a1bb9` (which articles are figures, English names); the six language Translation Academies in the table above (names). All CC BY-SA 4.0.                                                                             |
| Bend   | applied  | Translation Academy's table of contents decides which `figs-*` articles are figures. Rows map onto our segments by verse, as glossaries map TWL rows (`scripts/lib/glossaries.ts`).                                                                                                                                 |
| Break  | observed | (1) `figs-` is not "figure of speech": 33,296 of 61,535 `figs-` rows are grammar. (2) 7 books have no released notes (3,213 segments). (3) No figure names for Portuguese, Swahili or Chinese; 3 missing in Indonesian, 3 still English in Spanish. (4) 113 Psalms rows on `c:front`. All measured; commands below. |
| Beget  | skipped  | No owner yet. To ask alongside #57: an `en_tn` release with the 7 books.                                                                                                                                                                                                                                            |
| Bide   | waiting  | The 7 books. Tripwire: go/no-go 2 (13 Nov) in [plan.md](plan.md). If no release has them by then, they ship without figures, listed in the release notes. The other 59 books do not wait.                                                                                                                           |
| Build  | not-yet  | A per-book metadata file built from pinned `en_tn` (59 files) and `en_ta` titles, traced to Breaks 1, 2 and 4; 66 figure names AI-drafted, checked by a second model and reviewed, traced to Break 3.                                                                                                               |

Reversibility: forward = low; backward = medium once released. Figure ids are
Translation Academy's, so a later release can add or drop a figure without
renaming one.

### Literary form and parallel passages

| Step   | Verdict  | Evidence / justification                                                                                                                                   |
| ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Borrow | applied  | The 66 BSB files already pinned in `sources.json` (`Worldview/en_bsb` at `7abbfafa`) and already read by the structure build (`scripts/lib/structure.ts`). |
| Bend   | applied  | The parse that finds `\s1` headings also reads `\q*` and `\r` lines.                                                                                       |
| Break  | observed | (1) A bare `\q1` line before a `\v` belongs to the next verse; 155 verses differ if it is not handled. (2) `\r` references use English book names.         |
| Beget  | n/a      | The data is already in a pinned input.                                                                                                                     |
| Bide   | n/a      |                                                                                                                                                            |
| Build  | not-yet  | Poetry, prose or mixed per segment and parallel references per pericope, in the same metadata file, traced to Breaks 1 and 2.                              |

Reversibility: forward = low; backward = medium once released.

### Difficulty

| Step   | Verdict  | Evidence / justification                                                                              |
| ------ | -------- | ----------------------------------------------------------------------------------------------------- |
| Borrow | applied  | `en_ta` v91 `translate/translation-difficulty/01.md`: one rating per book, 66 books.                  |
| Bend   | applied  | A book-level field, copied from the article's lists.                                                  |
| Break  | observed | It is prose, not data, and per book only; nothing rates passages.                                     |
| Beget  | n/a      |                                                                                                       |
| Bide   | n/a      |                                                                                                       |
| Build  | not-yet  | 66 values copied once, with the article cited, if the requirements owner wants book-level difficulty. |

Reversibility: forward = low; backward = low.

## Build effort (estimated)

**Estimated**, by comparison with the glossary work, which had the same
shape: read pinned uW TSVs and per-language articles, map rows to verses,
write per-book files, test. Its pull requests took, open to merge (measured
from GitHub's `createdAt` and `mergedAt`): Titus #20 2.3 h; code for every
book #52 0.7 h; data for 59 books #62 1.0 h.

| Piece                                         | Estimate                        | Method                                                    |
| --------------------------------------------- | ------------------------------- | --------------------------------------------------------- |
| Metadata file shape (schema entry)            | 1 to 2 h                        | one decision, like the glossary shape in `schema.md`      |
| Figures: Titus, then 59 books, pins and tests | 4 to 6 h                        | the glossary PRs above (#20, #52, #62)                    |
| Figure names: 66 strings, draft and check     | 1 to 2 h, plus review           | #31 (Chinese key terms for Titus), scaled to 66 strings   |
| Literary form and parallel passages           | 3 to 5 h                        | the BSB parse exists; new: `\q*`, `\r`, a book-name table |
| Difficulty                                    | under 1 h                       | 66 values, one test                                       |
| **Total build**                               | **about 1.5 to 2 working days** | sum, including review-bench rounds                        |
| Human review                                  | 66 names, 5 languages           | not estimated; each name is a word or a short phrase      |

These are not measured. Building Titus first would measure them, as it did
for the glossaries. None of this blocks tC Mobile, which reads only spans and
titles.

## How it was measured

Two scripts, kept here so the counts can be run again:
[`metadata/measure_a.py`](metadata/measure_a.py) (Python, by the author of
this file) and [`metadata/measure_b.mjs`](metadata/measure_b.mjs) (Node,
written by a second model from a written specification, without seeing
script A). Script A also writes [`metadata/counts.tsv`](metadata/counts.tsv).
[`metadata/compare.py`](metadata/compare.py) compares their output; its field
map is the list of measures both compute.

- **Both scripts, compared: 0 differences in 1,568 values.** Per book and in
  total: note rows, verse rows, rows naming an article, `figs-` rows, figure
  rows, distinct figures, segments, segments with a figure, segment–figure
  pairs, unparsed references; question rows and segments with a question;
  BSB `\r`, `\s1` and `\d` lines, `\r` lines after an `\s1`, verses,
  poetic verses and poetry, prose and mixed segments; the figure lists from
  the table of contents; the difficulty levels; and, per language, the
  figure names present and differing from English. For poetry, A's counts
  are compared with B's `...Text` counts, which follow the same rule (a bare
  `\q1` before `\v` belongs to the next verse); B's other poetry counts use
  the other rule and give the 8,336 above.
- **Script A only:** rows per figure, most figures in one segment, the
  Psalms `c:front` rows, the discourse counts and the approximate count of
  parallel references.
- **One-off commands, neither script:** the 66 `figs-` articles in
  Translation Academy, the 59 book and 856 chapter introductions, the Titus
  segment table, the BSB verse set against `ufw.json`, and the catalog
  results.

The `\r`-after-`\s1`, `\s1` and per-language "used figures" counters were
added to both scripts later (#84) by one author. For those counters the two
scripts are two implementations (a regular expression in A, a line walk in
B), not two independent readings of a specification.

They sit under `docs/`, not `scripts/`, on purpose: no build reads them and
no data is made from them, so they carry no tests. A build of any of this is
new code under `scripts/` with tests.

```sh
set -euo pipefail
W=$(mktemp -d)
# clone <owner/repo> <tag> <commit> <dir>: the tag, then the named commit. If the tag has
# moved, the commit is not in the shallow clone and the checkout fails, which stops the run.
clone() {
  git -c advice.detachedHead=false clone -q --depth 1 --branch "$2" "https://git.door43.org/$1.git" "$4"
  git -C "$4" checkout -q --detach "$3"
  test "$(git -C "$4" rev-parse HEAD)" = "$3"
}
clone unfoldingWord/en_tn v91 e586762e330f482a60c52aedd1c7b3a2f155df8a $W/src/en_tn
clone unfoldingWord/en_tq v91 8be02772584ff5a5fea893a392b4f019e3efcc77 $W/src/en_tq
clone unfoldingWord/en_ta v91 ce9a1bb9431317ca888e8c1f9620caa7f5fe45fd $W/src/en_ta
clone BSOJ/ar_ta v3 a25e9ac3d19bdef1923a758cbcf86154e809d28e $W/src/ta_ar_ta
clone Xenizo/fr_ta v2.0 358e294289264493399638fdbd0025df6397b2bb $W/src/ta_fr_ta
clone translationCore-Create-BCS/hi_ta v7 63a00a283591a7f0e7b2bad52755331207f3d645 $W/src/ta_hi_ta
clone bahtraku/id_ta v30 f80201223ab26f79913e0caa6b7d126dea39924e $W/src/ta_id_ta
clone ru_gl/ru_ta v13.3 815b9d95ca21b3efe6a8a922fea52e9a7cdd2861 $W/src/ta_ru_ta
clone es-419_gl/es-419_ta v4 26606b578c37cc2c0ee09bb7b9a291860ff59444 $W/src/ta_es-419_ta

# The 66 pinned BSB files, each checked against its SHA-256 in sources.json
mkdir -p $W/bsb $W/out
jq -r '.sources[] | select(.id | startswith("bsb-")) | [.id, .url, .sha256] | @tsv' sources.json |
  while IFS=$'\t' read -r id url sha; do
    f=$W/bsb/$(echo "${id#bsb-}" | tr a-z A-Z).usfm
    curl -fsS "$url" -o "$f"
    echo "$sha  $f" | sha256sum -c --quiet
  done
test "$(ls $W/bsb | wc -l)" -eq 66

python3 -I docs/scoping/metadata/measure_a.py $W/src $W/bsb data/structure \
  docs/scoping/metadata/counts.tsv > $W/out/a.json
node docs/scoping/metadata/measure_b.mjs $W data/structure > $W/out/b.txt   # writes $W/out/b.json
python3 -I docs/scoping/metadata/compare.py $W/out/a.json $W/out/b.json    # ends "diffs 0"

# Catalog queries for the language table (released; then unreleased for the three with none)
for l in ar fr hi id ru es-419 pt-br sw zh zh-hans; do
  curl -fsS "https://git.door43.org/api/v1/catalog/search?subject=Translation%20Academy&lang=$l" |
    jq -r '.data[] | [.full_name, .release.tag_name, .commit_sha] | @tsv'
done
for l in pt-br sw zh zh-hans; do
  curl -fsS "https://git.door43.org/api/v1/catalog/search?subject=Translation%20Academy&lang=$l&stage=latest" |
    jq -r '.data[] | [.full_name, .branch_or_tag_name, .stage] | @tsv'
done
```
