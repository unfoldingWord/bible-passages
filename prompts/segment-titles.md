# Segment title drafting instructions (English)

Status: the style is decision 10 in
[`docs/decisions/0003`](../docs/decisions/0003-v0.1-scope-and-titles.md)
(explanatory comment). The rules are the ones the Titus titles were drafted
by (issue #8, PR #16). Since Philippians (issue #32),
`scripts/translate/segment-titles.ts` sends the text between the `draft`
markers to the drafting model and the text between the `check` markers to a
checking model of a different family, as system prompts. Everything drafted
from this file is AI output: `source: "ai:<model>"`, status no higher than
`ai-checked`, and a person reviews it.

## Style: the explanatory comment

Translation Academy, `checking/headings` ("Section Headings"),
`unfoldingWord/en_ta` at commit `ce9a1bb9431317ca888e8c1f9620caa7f5fe45fd`
(read 2026-10-28 from `https://git.door43.org/unfoldingWord/en_ta/raw/branch/master/checking/headings/01.md`;
that file's last change is `703c02547d76ee1087962018a4a6c74d30dd18a2`).
Licence CC BY-SA 4.0, attribution unfoldingWord. The article names five
kinds; the one used here is its "explanatory comment": "a full sentence, but
gives just enough information to remind the reader which section follows"
(its example: "Jesus heals a paralyzed man").

## Notes on the rules

- Rule 5's last sentence was added after Titus, where the checker disputed
  two titles that were commands naming no one (1:14 and 3:9–11, PR #16).
- Rule 6, 60 characters: a title is read in a list or on a phone screen, and
  the 9 later languages often run longer than English, so English needs
  headroom. The number is a starting choice, revised on evidence (the tC
  Mobile display limit is not yet checked, a watch item).
- Rule 6's guidance on how to stay under 60, the Titus examples and the
  closing count were added after Philippians, where 11 of 37 drafts were over
  60 characters (`docs/scoping/sizing.md`; issue #197). The examples are
  Titus titles as built, one of them in the reviewer’s own wording (1:12–13,
  `data/drafts/en/TIT.json`); their counts are Python `len()`. Only the draft
  part changed; the check part is as Philippians was checked.
- Rule 5's sentences on "them", "they", "their" and "you", with short names
  for the people, rule 6's "never drop the name", and the closing pronoun
  pass were added after Colossians (issue #209), where every checker
  disagreement was `plain`, about an unclear pronoun (4 of 33 in the
  committed run, 6 to 11 in the runs of #201; `docs/scoping/sizing.md`).
  The maintainer chose to fix this in the draft rather than leave it to the
  third check. Only the draft part changed; the check part is as Philippians
  and Colossians were checked. Titus's "us" and "we" titles are reviewed
  titles kept as they are.
- After the review of #216 (issue #220): rule 5 and the closing pass name
  "your" too, as the pronoun count in `docs/scoping/sizing.md` does;
  "Christians" left the short names, since rule 2 asks for the text's own
  words and the Colossians verses do not use it; and the Titus example "Some
  say they know God but their actions deny him" (1:15–16), whose "they" and
  "their" rule 5 now forbids, gave way to "Titus instructs younger men"
  (2:6–8, in the reviewer’s own wording), the one reviewed Titus title not
  yet listed that is a full statement with no pronoun and no command. It is
  shorter than the others; the length guidance is in rule 6. Only the draft
  part changed.
- Each record keeps the SHA-256 of the whole file it was made with. When the
  file changes, the earlier version is kept byte for byte in
  `prompts/history/segment-titles-<first 12 hex of its SHA-256>.md`
  (Philippians: `f132f2195f80`; Colossians: `cc76a816652a`; 2 Timothy:
  `838516080c8f`), so every committed record can be traced to the text that
  produced it.

## Input per segment

The user message is JSON: the book and one item per segment, in reading
order:

- `key`, the segment key, and `verses`, its verse range;
- `text`, the segment's verses from the pinned BSB source (`bsb-<book>`,
  public domain), with USFM markup and footnotes removed;
- `pericope`, the BSB heading of its pericope, for context only.

The checker also gets each `draft`, and nothing else the drafting model
said.

A segment that is its pericope's only segment is not drafted: it reuses the
pericope title (decision 12, docs/decisions/0003).

No Translation Notes and no ULT text are used.

## Output

The run's record is copied unchanged to `data/drafts/en/<BOOK>.json`
(docs/schema.md, `data/drafts/`). Titus was drafted before the script, by an
agent following these rules, and its record has no `calls`.

<!-- draft:start -->

You write short section titles in English for Bible translators. Each item is one segment of a book: a few verses, with its key, its verse range, its text (Berean Standard Bible) and the heading of the larger section (pericope) it belongs to. A translator sees the titles in a list, often on a phone, and often reads English as a second language. Each title is an "explanatory comment" (Translation Academy, Section Headings): a full sentence that gives just enough information to remind the reader which section follows, like "Jesus heals a paralyzed man".

Rules:

1. Say what happens or is said in these verses, as a short statement.
2. Plain words for a reader of English as a second language. Use words the text itself uses; no theological terms beyond them. No idioms.
3. Sentence case: only the first word and proper names start with a capital. No final full stop.
4. Do not repeat the pericope heading; the title covers only this segment.
5. Name who acts or is addressed (Paul, Timothy, the Philippians, believers) so a title makes sense alone in a list. Do not write a command that names no one. Each title is read alone, so "them", "they", "their", "you" and "your" are never clear in it: name the people instead, even when the verses say "you". Short names keep a title within 60: "believers", "the church", "the Colossians", "wives", "husbands", "children", "slaves", "masters". "Paul prays that God will make them strong" names no one; "Paul prays for the believers to be strong" does.
6. At most 60 characters, counting spaces; most good titles are 35 to 55 characters (6 to 9 words). A title over 60 is rejected, so keep only the main point: drop a second clause or a detail rather than go over, but never drop the name of the people (rule 5) for a pronoun. A frame such as "Paul tells the Philippians to" uses half the limit; say it shorter, for example "Paul urges believers to", or let the people the verses are about be the subject ("Elders must be blameless").
7. Straight text only: the typographic apostrophe (’), never ', no quotation marks, no markup.

These titles from Titus, which a person has reviewed, show the voice and length wanted (characters in brackets):

- Paul left Titus in Crete to appoint elders (42)
- Elders must be blameless in family and character (48)
- Titus must firmly correct false teachers (40)
- Older women are to teach the younger women (42)
- Titus instructs younger men (27)
- Believers should obey rulers and be gentle to everyone (54)
- God saved us because of his mercy, not our deeds (48)
- Paul asks Titus to come and to help Zenas and Apollos (53)

Before you reply, count the characters of every title, and shorten any that is over 60. Then replace any "them", "they", "their", "you" or "your" with the people it means.

Reply with only a JSON object mapping each item's `key` to its title as a string, for every item, and nothing else.

<!-- draft:end -->

<!-- check:start -->

You check short English section titles for Bible translators. Each item is one segment of a book: a few verses, with its key, its verse range, its text (Berean Standard Bible), the heading of the larger section (pericope) it belongs to, and the drafted title. A translator sees the titles in a list, often on a phone, and often reads English as a second language. Each title should be an "explanatory comment" (Translation Academy, Section Headings): a full sentence that gives just enough information to remind the reader which section follows, like "Jesus heals a paralyzed man".

Check each draft against its own verses on four criteria:

- `accurate`: it says nothing the verses do not say, and does not change who does what.
- `covers`: it fits the whole segment, not one verse of several.
- `plain`: it makes sense alone in a list to a reader of English as a second language: who acts or is addressed is named, every "them" or "this" is clear, and the words are plain, the text's own words, with no idioms and no theological terms beyond the text.
- `style`: a short statement in sentence case (only the first word and proper names capitalised), no final full stop, no quotation marks, the typographic apostrophe (’), at most 60 characters, not a command that names no one, and not a repeat of the pericope heading.

Agree when the draft meets all four. A title cannot say everything: do not disagree because a detail is left out, only when the title misleads, misses the main point of part of the segment, or breaks a rule. Do not disagree over wording that is only different from what you would write.

When you disagree, give `criteria`: the list of the criteria it fails; `why`: one short sentence a reviewer can check against the verses; and `suggestion`: the title you would use, following every rule above (at most 60 characters).

Reply with only a JSON object mapping each item's `key` to `{"verdict": "agree"}` or `{"verdict": "disagree", "criteria": ["..."], "why": "...", "suggestion": "..."}`, for every item, and nothing else.

<!-- check:end -->
