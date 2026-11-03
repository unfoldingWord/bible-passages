# 0005: Go/no-go 1: ship AI-checked English for the whole Bible in v0.1.0

- **Status:** accepted
- **Date:** 2026-11-03
- **Decided by:** the requirements owner (direction, items 1 to 4, in the
  3 Nov project call) and the maintainer (items 5 and 6, the same day). This
  records go/no-go 1 (`../scoping/plan.md`, Wed 4 Nov) a day early.

## Decision

1. **Go.** v0.1.0 carries English pericope and segment titles for all 66
   books, as ADR 0003 decision 1 already scoped it. A person's review of every
   English title is **not** a release gate for v0.1.0.
2. **Titus is the reviewed sample.** The requirements owner reviewed the
   English Titus titles and found no blockers ("good enough, way better than
   zero"). That is the one-book check AGENTS.md ("Sample before scale")
   requires before the drafting runs on the other books.
3. **The person's review moves to 1.0.** The content team is expected to do a
   full read-through of the English titles in Q1 2027 and set a consistent
   standard. That reviewed English is released as 1.0; later minor versions
   add reviewed languages. Each milestone (for example "Titus human review
   complete") is a tag with release notes.
4. **The dataset stays at `unfoldingWord/bible-passages`, owned by
   unfoldingWord.** A separate organization, and a separate repo for Open
   Bible Stories, may come later; neither blocks v0.1.0.
5. **The first tag stays `v0.1.0`** (#13, ADR 0003, tc-mobile #1459). The
   requirements owner's "0.0.1" in the call meant the first AI-built release,
   not a different number.
6. **Disputed titles are settled by a third check, not held for a person.**
   When the checking model disagrees with a draft, a third model reads the
   verses and sorts the dispute:
   - **Factual**: the title says something the verses do not, or picks one
     reading of a disputed phrase. The third model proposes a fix; the title
     ships `unreviewed` and is listed in the release notes for the content
     team.
   - **Taste** (length, a pronoun with no antecedent, wording): the third
     model picks or rewrites the title to match the voice of the reviewed
     Titus titles (`data/drafts/en/TIT.json`) and the 60-character limit. The
     title stays `ai-checked` at most, with the third model named.

   No AI-written title rises above `ai-checked` (AGENTS.md, "Label AI
   output"). The release notes count titles by status.

## Evidence

### Philippians disputes, sorted by hand on 3 Nov (a sample for item 6)

The Philippians run (`../scoping/sizing.md`, 29 Oct) had 14 disputes out of
37 drafts (Claude Sonnet drafted, Gemini Flash checked). A third model (Claude
Opus) read each against `unfoldingWord/en_ult` (`51-PHP.usfm`) and sorted it.
These are proposals, not yet written to `data/`.

| Key         | Checker's reason | Kind    | Proposed title                                               | Chars |
| ----------- | ---------------- | ------- | ------------------------------------------------------------ | ----- |
| PHP.1.7-8   | length 62        | taste   | Paul loves the Philippians, who share in grace with him      | 55    |
| PHP.1.18-19 | length 61        | factual | Paul rejoices that Christ is preached, expecting deliverance | 60    |
| PHP.2.12-13 | length 61        | factual | Work out your salvation, for God is working in you           | 50    |
| PHP.2.14-16 | length 65        | taste   | Paul tells the Philippians to shine without complaining      | 55    |
| PHP.2.17-18 | unclear "them"   | taste   | Paul rejoices if he dies and asks the Philippians to rejoice | 60    |
| PHP.2.19-21 | unclear "them"   | taste   | Paul hopes to send Timothy, who cares for the Philippians    | 57    |
| PHP.2.25-27 | length 64        | taste   | Paul sends back Epaphroditus, whom God spared from death     | 56    |
| PHP.3.1-3   | length 63        | taste   | Paul warns against those who put confidence in the flesh     | 56    |
| PHP.3.15-16 | unclear "this"   | taste   | Paul urges believers to live up to what they have attained   | 58    |
| PHP.3.17-19 | length 78        | taste   | Paul says to follow his example, not enemies of the cross    | 57    |
| PHP.3.20-21 | length 65        | taste   | Believers await Christ, who will change their bodies         | 52    |
| PHP.4.1-3   | length 68        | taste   | Paul urges believers to stand firm and two women to agree    | 57    |
| PHP.4.8-9   | length 73        | taste   | Paul tells believers to think on good things and follow him  | 59    |
| PHP.4.18-20 | length 66        | taste   | Paul has enough, and God will meet the Philippians’ needs    | 57    |

12 taste, 2 factual. Neither factual one was raised by the checker; the
third read found them:

- **1:18–19**: the draft and the checker both said "to be freed". The verse
  says "deliverance" (ULT), which can mean release from prison or final
  vindication. The title should not choose.
- **2:12–13**: "tells the Philippians to obey" puts the past tense ("as you
  always obeyed") in place of the command, "work out your own salvation".

Character counts measured with Python `len()` on 3 Nov.

### Review time per title (first measurement)

The Hindi blind-review answers for Titus (#64), recovered on 3 Nov from the
reviewer's "Copy my answers" export: 33 of 33 titles (8 pericope, 25
segment), all on 29 Oct between 16:59 and 17:11 UTC. Total recorded time
16.4 minutes; mean 29.9 s per title, median 17.0 s; 4 titles rewritten
("neither"), the slowest 243 s. One reviewer and one language, choosing
between two candidates, so this is a lower bound for a full read-through,
not its rate.

## Why

- Something usable in tC Mobile v2 by the end of the year is worth more than
  a fully reviewed dataset later; tC Mobile's template-library UX cannot be
  tested without real data for the whole Bible.
- Waiting for a person to review 16,523 English titles first would hold the
  release for weeks of a reviewer's time (`../scoping/sizing.md`).
- The length and plain-wording checks are already in the pipeline; item 6
  removes the one step that needed a person before release.
- Meaning is not fully checked. Item 6 runs only when the checker disagrees,
  and the checker can agree with a wrong draft: both Philippians factual
  misses became disputes only because of length. `ai-checked` records "no
  disagreement", not "meaning verified"; misses the models agree on are the
  residual risk until the Q1 read-through.

## Rejected

- **Hold every disputed title for a person.** At the Philippians rate (38%)
  that is about 5,100 English titles across the Bible waiting on one review
  queue (estimated: 13,507 drafted segment titles × 14/37; pericope titles
  are imported from BSB, not drafted, so they are never disputed).
- **Ship disputed titles as drafted.** About 30% of drafts were over the
  60-character limit in the Philippians run.
- **Copy section headings by majority vote across published translations.**
  Copyrighted headings are not inputs (AGENTS.md, "Licences"). Openly
  licensed headings (for example the Hindi IRV) are a separate question for
  a 6B.

## Changes

- AGENTS.md, "Correctness first": checker disagreements on English titles go
  to a third-model check first, per item 6, not straight to a person.
