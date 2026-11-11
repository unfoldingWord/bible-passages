# Scoping: metadata for v0.1

Part of [6. Metadata](pipeline.md#6-metadata). Tracking issue: #44.

Decision 11 ([ADR 0003](../decisions/0003-v0.1-scope-and-titles.md)) puts
in v0.1: key terms, figures of speech, and any other metadata already in the
data that needs no new writing. On 9 Nov the maintainer moved all of it from
v0.1.0 to v0.1.x ([ADR 0009](../decisions/0009-metadata-to-v0.1.x-package-id.md));
what qualifies is unchanged. Key terms are built (glossaries for 59 books,
#62). This file measures the rest. Nothing here is built and no input is
pinned, because no build reads these files yet. The sizing and plan for
v0.1.x, re-measured on 2026-11-11, are in
[v0.1.x: sizing and plan](#v01x-sizing-and-plan).

Everything below was measured on 2026-10-29 at the commits named, unless it
is labelled **estimated**, and the counts were re-run on 2026-10-30 (#84).
The measures both scripts compute (see "How it was measured") were produced
by two scripts, and agree on every one. The scripts were written separately,
except for later changes one author made to both: the `\s1`, `\r`-after-`\s1`
and per-language "used figures" counters were added (#84), and the `\r` and
`\d` counters were rewritten to one rule (#119). A few counts come from script
A alone or from one-off commands; that section lists them.

## The answer, in plain words

| Kind                       | Already in the data? | Source                                 | v0.1                                                                                                                                                                     |
| -------------------------- | -------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Key terms                  | yes                  | Translation Word Links and Words       | **in** (built, #62)                                                                                                                                                      |
| Figures of speech          | yes                  | Translation Notes `SupportReference`   | **in**: 59 books; figure names complete (all 20 named) in 4 of 9 languages, partial (some missing or still English) in 2, absent (no Translation Academy on Door43) in 3 |
| Literary form (poetry)     | yes                  | BSB `\q1` `\q2` `\qr` line markers     | **in**, proposed: poetry, prose or mixed per segment                                                                                                                     |
| Parallel passages          | yes                  | BSB `\r` lines under section headings  | **in**, proposed: per pericope                                                                                                                                           |
| Difficulty                 | book level only      | Translation Academy, one article       | **in**, proposed: one rating per book, as a book field                                                                                                                   |
| Topics                     | no                   | nothing structured found               | out: would need new writing                                                                                                                                              |
| Difficulty per passage     | no                   | nothing found                          | out: would need new writing                                                                                                                                              |
| Comprehension questions    | yes, but content     | Translation Questions                  | out: questions and answers, not labels for a passage                                                                                                                     |
| Other translation issues   | yes                  | Translation Notes, non-figure `figs-*` | out: grammar, not figures of speech; later candidate                                                                                                                     |
| Discourse features         | yes, sparse          | Translation Notes, "Writing Styles"    | out: overlaps literary form; later candidate                                                                                                                             |
| Book and chapter overviews | yes, as prose        | Translation Notes introductions        | out: turning prose into labels is new writing                                                                                                                            |

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
one chapter (`1:5-7`); one row lists verses (Psalm `5:1,3,8,12`, a
`writing-poetry` note, not a figure). This sentence said "three rows" until
2026-11-11; re-measured then, the 59 files hold one such row in all (see
[v0.1.x: sizing and plan](#v01x-sizing-and-plan)). No reference failed to
parse. A segment has a figure if any verse of a row naming it lies
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

| Step   | Verdict  | Evidence / justification                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Borrow | applied  | `unfoldingWord/en_tn` v91 at `e586762e` (`SupportReference`); `unfoldingWord/en_ta` v91 at `ce9a1bb9` (which articles are figures, English names); the six language Translation Academies in the table above (names). All CC BY-SA 4.0.                                                                                                                                                          |
| Bend   | applied  | Translation Academy's table of contents decides which `figs-*` articles are figures. Rows map onto our segments by verse, as glossaries map TWL rows (`scripts/lib/glossaries.ts`).                                                                                                                                                                                                              |
| Break  | observed | (1) `figs-` is not "figure of speech": 33,296 of 61,535 `figs-` rows are grammar. (2) 7 books have no released notes (3,213 segments). (3) No figure names for Portuguese, Swahili or Chinese; 3 missing in Indonesian, 3 still English in Spanish. (4) 113 Psalms rows on `c:front`. All measured; commands below.                                                                              |
| Beget  | skipped  | No owner yet. Asked for the same seven books in `en_twl` on #57 (open). `en_tn` master `fdde7f08` (2026-11-11) has them, unreleased.                                                                                                                                                                                                                                                             |
| Bide   | waiting  | The 7 books. The first tripwire, go/no-go 2 (13 Nov), was for v0.1.0, which no longer carries metadata (ADR 0009). Proposed tripwire: the first v0.1.x release with metadata. If no `en_tn` release has the seven by then, they ship with an explicit empty figure set (#174), listed in the release notes. Checked 2026-11-11: the latest release is still v91. The other 59 books do not wait. |
| Build  | not-yet  | A per-book metadata file built from pinned `en_tn` (59 files) and `en_ta` titles, traced to Breaks 1, 2 and 4; the 7 books without notes get an explicit empty figure set, not a missing file (#174); 66 figure names AI-drafted, checked by a second model and reviewed, traced to Break 3.                                                                                                     |

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

## v0.1.x: sizing and plan

Re-measured on 2026-11-11 at `6b28076` (origin/main) for #44, after ADR 0009
moved metadata to v0.1.x. Nothing new is built. Every number here is
**measured** (command and source given, recipe at the end of this section)
unless it says **estimated**.

### What is the same, and what moved

| What                                  | Was (observed)                     | Is (checked 2026-11-11)                                                                                                                         | Will be (gate)                                               |
| ------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Latest `en_tn` release                | v91 `e586762e` (2026-10-29)        | still v91 (Door43 releases API; `en_ta`, `en_tq`, `en_twl` also still v91)                                                                      | a release with the seven books; see the Bide row             |
| `en_tn` master, seven books           | all seven, unreleased (`05737d30`) | all seven, unreleased (`fdde7f08`, 2026-11-11): 22,230 note rows, 8,576 naming a figure of speech                                               | not used: only released inputs are pinned                    |
| Figure rows per book, 59 books        | 28,239 (two scripts)               | 28,239, and all 59 books agree with `counts.tsv` (a third reader, below)                                                                        | the build's own test                                         |
| Where tC Mobile could carry metadata  | no field (vendored `8757e3a8`)     | no field at tc-mobile `develop` `0b7f37f6` (2026-11-11): `src/types/template.ts` has no metadata, figure or term field                          | a maintainer decision on the `dist/` format (question 1)     |
| Release guard                         | none (29 Oct)                      | `distProblems` in `scripts/lib/release-notes.ts` stops the notes if `dist/` holds anything but `tc-mobile/` (#269, merged 10 Nov; #275, 11 Nov) | changed in the same PR that first writes metadata to `dist/` |
| Requirements owner's questions on #44 | asked 2026-10-29                   | no answer on #44 (1 comment, the question)                                                                                                      | question 3 below                                             |

The seven books on master, rows naming one of the 32 figure articles, any
reference form (`awk` over `tn_<BOOK>.tsv` at `fdde7f08`): NUM 1,005; 1CH
611; 2CH 679; ECC 313; ISA 2,190; JER 2,198; EZK 1,580. If a release carries
them unchanged (an assumption), figures would cover about 30% more rows than
v91's 28,252.

### Figure rows, re-derived three ways

The per-book figure counts were produced again by two readers that share no
code with `measure_a.py` or `measure_b.mjs`:

1. **door43-preview-renderers** (`@unfoldingword/door43-preview-renderers`
   1.7.0, MIT, git `8dba9971`), the uW tool that reads Door43 releases into
   JSON: its `getResourceData` command on `en_tn` at `v91`, once per book
   for all 59 books, then `jq` over the rows.
2. **`awk`** over the raw `tn_<BOOK>.tsv` files of a clone of `en_tn` v91,
   checked to be at `e586762e`.

Both readers count the same rows: 87,573 note rows and 28,252 rows whose
`SupportReference` is one of the 32 figure articles, with every one of the
59 books equal between them. 28,252 is 28,239 plus 13 rows the counts above
leave out on purpose: 12 on Psalm superscriptions (`c:front`) and 1 on a
chapter introduction (`JOS 21:intro`, `figs-metaphor`). Counting only verse
and verse-range rows, `awk` gives the `tn_figure_rows` of `counts.tsv` for
all 59 books (59 of 59 equal). Titus through the renderer: 206 rows, 157
naming an article, 39 naming a figure, 8 figures, as in "Counts" above.

The reference forms in the 59 files: 86,325 `c:v`, 219 `c:v-v`, 856
`c:intro`, 113 `c:front`, 59 `front:intro` and 1 verse list
(`PSA 5:1,3,8,12`). Sum 87,573.

### Key terms already in `data/glossaries/`

Built for 59 books (#62); Chinese for Titus only (#31). Counted with a
Python pass and again with `jq` over `data/glossaries/<lang>/*.json` at
`6b28076`; the two agree. A "term" is one article linked from one book;
"verses" is the sum of each term's `refs`; "dropped" is the book's `gaps`
(a term with no article, no heading, or a headword still in English, left
out for that language).

| Language | Books | Terms  | Verses | Dropped | Distinct articles |
| -------- | ----- | ------ | ------ | ------- | ----------------- |
| en       | 59    | 11,956 | 77,286 | 1       | 937               |
| es-419   | 59    | 11,617 | 75,433 | 340     | 899               |
| ru       | 59    | 11,608 | 75,404 | 349     | 897               |
| sw       | 59    | 11,584 | 75,294 | 373     | 897               |
| hi       | 59    | 11,551 | 75,162 | 406     | 892               |
| fr       | 59    | 11,393 | 74,764 | 564     | 869               |
| pt-BR    | 59    | 11,137 | 73,161 | 820     | 868               |
| id       | 59    | 9,400  | 66,388 | 2,557   | 691               |
| ar       | 59    | 6,542  | 46,114 | 5,415   | 295               |
| zh-Hans  | 1     | 93     | 174    | 0       | 93                |

So key terms need no new writing for v0.1.x except the zh-Hans books
after Titus (#31, decided as AI-drafted in ADR 0003 decision 14) and the
seven books, which wait on an `en_twl` release (#57). What they lack is a
place in `dist/` (question 1).

### 6B: reading Translation Notes

| Step   | Verdict             | Evidence / justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Borrow | applied, as a check | `@unfoldingword/door43-preview-renderers` 1.7.0 read all 59 `en_tn` v91 books and gave the same rows as the raw TSV (above). It is the uW reader of Door43 TSV, so it is the second reader for the build's tests. As the build's own reader it is rejected for improper authority over inputs (Break 1: it reads a tag, not a pinned, hashed file).                                                                                                                                                                                                   |
| Bend   | applied             | The raw `tn_<BOOK>.tsv` files at a commit URL, pinned per file in `sources.json` with SHA-256 as the 59 `twl-en-*` files are, read the way `scripts/lib/glossaries.ts` reads TWL. Figure ids and names from `en_ta` `translate/toc.yaml` and each article's `title.md`, pinned the same way.                                                                                                                                                                                                                                                          |
| Break  | observed            | (1) The renderer fetches a release by tag over the network and cannot be pinned per file with a SHA-256 as `sources.json` requires; it also adds ULT and UST quotes to every row: 318 MB of JSON for 59 books against 33 MB of TSV (`du`). (2) It keeps each row under its reference as written (`6-7`, `1,3,8,12`, `front`, `intro`), so a range is not spread to its verses. (3) `parseTwl` in `scripts/lib/glossaries.ts` accepts only `c:v` and `c:front` (its `REF`), and Translation Notes also have ranges, intros and one verse list (above). |
| Beget  | n/a                 | The parse is a few lines; nobody else needs to carry it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Bide   | n/a                 | Nothing to wait for: the released notes are enough for 59 books.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Build  | not-yet             | A Translation Notes row reader that takes `c:v`, `c:v-v` and verse lists, puts `c:front` in the segment that starts at the chapter's verse 1, as title translation does for glossary refs (`scripts/lib/translate.ts`, #54), skips intros, and fails on any other form; traced to Breaks 2 and 3.                                                                                                                                                                                                                                                     |

The reader's rule for each form in the census above, used by both the build
and its tests: `c:v` goes on that verse; `c:v-v` and the verse list are
spread to each of their verses; `c:front` goes on the chapter's verse 1;
`c:intro` and `front:intro` are skipped, which drops the one `JOS 21:intro`
figure row. `counts.tsv` counts verse and range rows only, so a check
against it leaves out the 12 Psalm `c:front` figure rows on purpose.

Reversibility: forward = low; backward = low. The reader changes no data
format.

### 6B: metadata in `dist/`

| Step   | Verdict  | Evidence / justification                                                                                                                                                                                                                                                                                  |
| ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Borrow | skipped  | tC Mobile template package v0 is the only `dist/` format, and it has no metadata field (vendored `8757e3a8`; `develop` `0b7f37f6` read 2026-11-11).                                                                                                                                                       |
| Bend   | applied  | The package id `bible-passages:<BOOK>` (ADR 0009) and the span keys (ADR 0001) already name every book and segment, so a metadata file can point at them without copying spans.                                                                                                                           |
| Break  | observed | (1) No field for metadata in the tC Mobile type. (2) `distProblems` and `scopeLines` (`scripts/lib/release-notes.ts`) fail the notes if `dist/` holds anything but `tc-mobile/`; `scripts/release/assets.ts` attaches only `dist/tc-mobile`.                                                              |
| Beget  | skipped  | A metadata field in tC Mobile's format is the tC Mobile team's to add; to ask only if the maintainer wants metadata inside the packages (question 1).                                                                                                                                                     |
| Bide   | n/a      |                                                                                                                                                                                                                                                                                                           |
| Build  | not-yet  | After question 1: one file per book (proposed `dist/metadata/<BOOK>.json`), keyed by package id and span keys, carrying figure ids per segment, and the other kinds the requirements owner accepts; `scopeLines`, `distProblems` and the release assets changed in the same PR; traced to Breaks 1 and 2. |

Reversibility: forward = medium; backward = high once released. A released
`dist/` path and field names are a contract, like keys.

### Effort for v0.1.x (estimated)

The table under "Build effort" still holds; two rows are new, from the
Breaks above. **Estimated** by the same method (open-to-merge time of
similar pull requests, measured from GitHub's `createdAt` and `mergedAt`:
the glossary PRs #20 2.3 h, #52 0.7 h, #62 1.0 h; recent build PRs of one
book or one check, #240 0.9 h, #260 1.2 h, #281 1.1 h).

| Piece                                             | Estimate                      | Method                                              |
| ------------------------------------------------- | ----------------------------- | --------------------------------------------------- |
| Translation Notes reader and pins (59 + `en_ta`)  | 2 to 3 h                      | #52 (glossary code), plus the reference forms above |
| `dist/metadata/` writer, release guard and assets | 2 to 4 h                      | #245, #269, #275 (release notes and guard)          |
| Everything else                                   | as under "Build effort"       | unchanged                                           |
| **Total build**                                   | **about 2 to 3 working days** | sum, with review-bench rounds                       |

Building Titus first replaces these with measured times.

### Proposed plan for v0.1.x

**Smallest increment someone else can verify: Titus, end to end.**

1. A schema entry for `data/metadata/<BOOK>.json` and the `dist/` file
   (after question 1).
2. Pins: `tn_TIT.tsv` at `e586762e`; `en_ta` `toc.yaml` and the 20 used
   figures' `title.md` at `ce9a1bb9`; the difficulty article. BSB is
   already pinned.
3. `data/metadata/TIT.json` built from them by `npm run build`: figure ids
   per segment, and, if question 3 says yes, literary form, parallels and
   difficulty.
4. The same in `dist/`, and the release notes' scope line changed.

**Definition of done for Titus:**

- `npm run verify` and `npm run build` pass, and a rebuild leaves `data/`
  and `dist/` clean.
- The 25 segments' figure sets equal the Titus table under "Counts" (20
  segments with a figure, 28 pairs, 8 figures), checked by a test, and by a
  second reader (door43-preview-renderers or `awk`) in the PR body.
- Every input is in `sources.json` with its SHA-256; the file names the
  licence and attribution of `en_tn` and `en_ta` (CC BY-SA 4.0).
- Both bench lenses clean at the PR's head.

**Then:** the other 58 books with notes, re-derived the same way against
`counts.tsv`, leaving out the 12 Psalm `c:front` figure rows (see the
reader's rule under "6B: reading Translation Notes"); the seven books
with an empty figure set (#174) until an `en_tn` release carries them;
figure names per language after question 4.

### Questions for the maintainer

1. **Where does metadata ship?** Proposed: its own file per book,
   `dist/metadata/<BOOK>.json`, keyed by package id and span keys, not
   inside the tC Mobile packages (which have no field for it). Yes or no?
2. **Do the key terms in `data/glossaries/` ship in that file in v0.1.x**,
   for the ten languages built (zh-Hans for Titus only), with each
   language's dropped terms left out as now?
3. **For the requirements owner, unanswered on #44 since 29 Oct:** are
   literary form (poetry, prose or mixed per segment), parallel passages
   (per pericope) and book-level translation difficulty in v0.1.x?
4. **Figure names:** ship figure ids with names from each language's
   Translation Academy only where it has them (English, Arabic, French,
   Hindi, Russian complete; Indonesian and Spanish partial), or also write
   the 66 missing names (AI-drafted, checked, reviewed)? Writing them is new
   writing, which decision 11 left out.
5. **Seven books:** confirm they ship with an empty figure set at the first
   v0.1.x metadata release if `en_tn` has not released them (the proposed
   Bide tripwire), rather than pinning an unreleased master commit.

### Recipe for this section

```sh
set -euo pipefail
W=$(mktemp -d)
git -c advice.detachedHead=false clone -q --depth 1 --branch v91 https://git.door43.org/unfoldingWord/en_tn.git $W/en_tn
test "$(git -C $W/en_tn rev-parse HEAD)" = e586762e330f482a60c52aedd1c7b3a2f155df8a
git -c advice.detachedHead=false clone -q --depth 1 --branch v91 https://git.door43.org/unfoldingWord/en_ta.git $W/en_ta
test "$(git -C $W/en_ta rev-parse HEAD)" = ce9a1bb9431317ca888e8c1f9620caa7f5fe45fd
# The 32 figure articles: the "Figures of Speech" and "Biblical Imagery" sections, without their introductions
awk '/title: "Figures of Speech"$/ && !s {s=1} s && /link:/ {print $2} /link: bita-part3/ {exit}' \
  $W/en_ta/translate/toc.yaml | grep -vx 'figs-intro\|biblicalimageryta' > $W/figs.txt
test "$(wc -l < $W/figs.txt)" -eq 32
# Reader 1, awk: per book, note rows and figure rows
for f in $W/en_tn/tn_*.tsv; do b=$(basename $f .tsv); awk -F'\t' -v b=${b#tn_} \
  'NR==FNR{fig["rc://*/ta/man/translate/"$1]=1;next} FNR==1{for(i=1;i<=NF;i++) if($i=="SupportReference") c=i; next}
   {n++; if($c in fig) k++} END{print b"\t"n"\t"k+0}' $W/figs.txt $f; done | sort > $W/awk.tsv
# Reader 2, door43-preview-renderers 1.7.0 (installed in its own directory, not this repo)
mkdir $W/r && (cd $W/r && npm i -q --no-audit --no-fund @unfoldingword/door43-preview-renderers@1.7.0)
figs=$(jq -R -s 'split("\n")|map(select(length>0)|"rc://*/ta/man/translate/"+.)' $W/figs.txt)
for f in $W/en_tn/tn_*.tsv; do b=$(basename $f .tsv); b=${b#tn_}
  (cd $W/r && npx door43-renderers getResourceData --owner unfoldingWord --repo en_tn --ref v91 \
     --book $(echo $b | tr A-Z a-z) --output $W/r/$b.json --quiet)
  jq -r --arg b $b --argjson figs "$figs" '[.books[].chapters[].verses[] | (if type=="array" then .[] else . end)] as $r
    | [$b, ($r|length), ($r|map(select(.SupportReference as $s | $figs|index($s)))|length)] | @tsv' $W/r/$b.json
done | sort > $W/rend.tsv
diff $W/awk.tsv $W/rend.tsv && awk -F'\t' '{n+=$2; k+=$3} END{print NR, n, k}' $W/awk.tsv   # 59 87573 28252
# Verse and range rows only, against counts.tsv: prints "59 59"
for f in $W/en_tn/tn_*.tsv; do b=$(basename $f .tsv); awk -F'\t' -v b=${b#tn_} \
  'NR==FNR{fig["rc://*/ta/man/translate/"$1]=1;next} FNR>1 && ($4 in fig) && $1 ~ /^[0-9]+:[0-9]+(-[0-9]+)?$/ {k++}
   END{print b"\t"k+0}' $W/figs.txt $f; done | sort > $W/verse.tsv
join -t$'\t' <(awk -F'\t' 'NR>1{print $1"\t"$3}' docs/scoping/metadata/counts.tsv | sort) $W/verse.tsv |
  awk -F'\t' '{n++; if ($2==$3) s++} END{print n, s}'
# Key terms: terms, verses, dropped, distinct articles per language (the Python pass is not kept)
for l in $(ls data/glossaries); do printf '%s\t' $l; cat data/glossaries/$l/*.json | jq -rs \
  '[(map(.terms|length)|add), (map(.terms[]|.refs|length)|add), (map(.gaps|length)|add), (map(.terms|keys[])|unique|length)] | @tsv'; done
# Releases, and tc-mobile's template type
curl -fsS 'https://git.door43.org/api/v1/repos/unfoldingWord/en_tn/releases?limit=1' | jq -r '.[0].tag_name'   # v91
gh api 'repos/unfoldingWord/tc-mobile/contents/src/types/template.ts?ref=develop' --jq .content | base64 -d |
  { grep -ci 'metadata\|figure\|term' || true; }   # 0
```

The seven books' master counts came from the same `awk` over a clone of
`en_tn` master at `fdde7f08`; master moves, so that count is not repeatable
by this recipe.

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
  the table of contents; the difficulty levels; and, per language, six
  counts of figure names: how many are present and how many differ from
  English, among all 32 figure articles, among the 19 figures of speech, and
  among the 20 figures the notes use. For poetry, A's counts
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

One author later made the same changes to both scripts: the `\s1`,
`\r`-after-`\s1` and per-language "used figures" counters were added to both
(#84), and the `\r` and `\d` counters were rewritten in both to one rule
(#119). For those counters the two
scripts are two implementations, not two independent readings of a
specification:

- **`\s1`, `\r` and `\d` lines, and `\r` after `\s1`** (#110, #119): both
  scripts count all four with the same line walk (`line_markers` in A,
  `lineMarkers` in B). Lines are split at `\r\n`, `\r` or `\n` (A reads
  in text mode, which turns `\r\n` and a lone `\r` into `\n` before the
  split; B's `readFileSync` keeps the CR bytes; the lines come out the
  same); a line of
  only spaces and tabs is blank; a marker line starts with the marker
  followed by a space, a tab or the end of the line, so `\s1x`, `\r-` and
  `\d` followed by a no-break space are not marker lines. Blank lines and
  `\b` lines (with or without text after `\b`) are skipped, and an `\r`
  line counts as after an `\s1` if the line before it is an `\s1` line. So
  CRLF line ends, a lone `\r`, other whitespace (a no-break space line is
  not blank) and text after `\b` are read the same way by both. None of
  these occurs in the 66 pinned BSB files: they hold no `\r` character, no
  `\b` line with text after it (of 17,466 `\b` lines) and no line of only
  whitespace other than spaces and tabs (measured on 2026-10-30 with `tr`,
  `grep -P` and a short Python check). So a corpus run cannot tell whether
  the rule holds. A synthetic file of those cases,
  `tests/fixtures/metadata/line-markers.usfm`, has a count made by hand:
  6 `\s1`, 7 `\r`, 4 `\r` after `\s1`, 2 `\d`. Each script's
  `--line-markers` mode prints its helper's counts for one file. For B,
  `tests/metadata-markers.test.ts` checks them in `npm test`, which stays
  Node-only; for A, the first command of the recipe below checks them and
  stops the run on a mismatch. The second command checks that A's
  `read_usfm` returns the file's text with no CR (`--read-usfm` mode), so
  a change to its text-mode read stops the run too (#159). The
  counts were re-run with the recipe below after the change (#119): 3,016
  `\s1`, 1,325 `\r`, 1,325 `\r` after `\s1`, 117 `\d` in both scripts,
  `compare.py` "compared 1568, diffs 0", and every value both scripts
  output is the same as before the change.
- **Used figures per language:** A counts over the set of figures the notes
  use; B counts over the figures in the table of contents that the notes
  use. These are the same set, because both scripts count a note's figure
  only if it is in the table of contents.

They sit under `docs/`, not `scripts/`, on purpose: no build reads them and
no data is made from them, so they carry no tests beyond the marker-line
checks above. A build of any of this is new code under `scripts/` with tests.

```sh
set -euo pipefail
# Script A's marker-line helper on the synthetic edge cases, against the hand count
# (npm test checks script B on the same file; see "How it was measured"). A mismatch stops the run.
test "$(python3 -I docs/scoping/metadata/measure_a.py --line-markers tests/fixtures/metadata/line-markers.usfm)" \
  = '{"dMarkers": 2, "rAfterS1": 4, "rMarkers": 7, "s1Markers": 6}'
# Script A's read_usfm on the same file: the file holds 5 CRs and the text it returns holds
# none, because bsb_book's tokeniser needs the text-mode read. A mismatch stops the run.
test "$(python3 -I docs/scoping/metadata/measure_a.py --read-usfm tests/fixtures/metadata/line-markers.usfm)" \
  = '{"crInFile": 5, "crInText": 0}'
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
