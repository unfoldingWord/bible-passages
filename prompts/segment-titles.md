# Segment title drafting instructions (English)

Status: provisional, for the Titus run (issue #8). The style is the proposal
for decision 10 in `docs/schema.md`, not a decision. Everything drafted from
this file is AI output: `source: "ai:<model>"`, status `unreviewed`, and a
different model checks it before a person does.

## Style: the explanatory comment

Translation Academy, `checking/headings` ("Section Headings"),
`unfoldingWord/en_ta` at commit `ce9a1bb9431317ca888e8c1f9620caa7f5fe45fd`
(read 2026-10-28 from `https://git.door43.org/unfoldingWord/en_ta/raw/branch/master/checking/headings/01.md`;
that file's last change is `703c02547d76ee1087962018a4a6c74d30dd18a2`).
Licence CC BY-SA 4.0, attribution unfoldingWord. The article names five
kinds; the one used here is its "explanatory comment": "a full sentence, but
gives just enough information to remind the reader which section follows"
(its example: "Jesus heals a paralyzed man").

## Rules

1. Say what happens or is said in these verses, as a short statement.
2. Plain words for a reader of English as a second language. Use words the
   text itself uses; no theological terms beyond them. No idioms.
3. Sentence case: only the first word and proper names start with a capital.
   No final full stop.
4. Do not repeat the pericope heading; the title covers only this segment.
5. Name who acts or is addressed (Paul, Titus, elders, believers) so a title
   makes sense alone in a list.
6. Maximum 60 characters (about 9 words). Reason: a title is read in a list
   or on a phone screen, and the 9 later languages (German-like, Russian,
   Arabic and others) often run longer than English, so English needs
   headroom. The number is a starting choice; it is measured against the
   Titus titles and revised on evidence (the tC Mobile limit is not yet
   checked, a watch item).
7. Straight text only: typographic apostrophe (’) as in the pericope titles,
   no quotation marks, no markup.

## Input per segment

- the segment key and its verse range;
- the segment's verses from the pinned BSB source (`bsb-tit`, public domain),
  with USFM markup removed;
- the BSB heading of its pericope, for context only.

No Translation Notes and no ULT text were used for this Titus draft.

## Output

One title per segment key, in reading order, stored in
`data/drafts/en/TIT.json` as `{ text, source: "ai:claude-sonnet-5-5",
status: "unreviewed" }`.
