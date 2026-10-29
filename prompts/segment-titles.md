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
5. Name who acts or is addressed (Paul, Timothy, the Philippians, believers) so a title makes sense alone in a list. Do not write a command that names no one.
6. Maximum 60 characters (about 9 words).
7. Straight text only: the typographic apostrophe (’), never ', no quotation marks, no markup.

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
