# Disputed title instructions (English): the third check

Status: the step is item 6 of
[`docs/decisions/0005`](../docs/decisions/0005-go-no-go-1-ai-checked-english.md)
(issue #198), revised for #207. `scripts/translate/dispute-titles.ts` sends
the text between the `dispute` markers to a third model, of a family other
than the drafting and the checking model's, as its system prompt. It runs
only on the titles the checker disagreed with. Everything it writes is AI
output: `source: "ai:<model>"`, status no higher than `ai-checked`.

## What it decides

For each disputed title the third model reads the verses and returns a
`kind` and its own `title`:

- **`factual`**: the draft says something the verses do not, changes who
  does what, puts something else in place of what the verses command or
  say, or picks one reading of a phrase the verses leave open. Its title is
  a proposal: the title stays `unreviewed` and is listed for the content
  team (`npm run disputes`).
- **`taste`**: the disagreement is about length, a pronoun with no clear
  antecedent, or wording. Its title replaces the draft only if the checker
  then agrees with it (below) and it passes the mechanical gates; then it
  is `ai-checked`.

## The rewrite is checked again (#207)

Every title the third model gives goes back to the checking model of the
record (the model of its `check` calls), with the check part of
`prompts/segment-titles.md` and the BSB verses, exactly as a draft is
checked. The checker is not told the title is a rewrite, nor the third
model's kind or reason. A `taste` title the checker does not agree with
stays `unreviewed` and is listed with the factual ones.

## Blind (#207)

The third model is not given the checker's `suggestion`, nor any person's
review or any verdict on these titles: only the verses, the pericope
heading, the draft and the checker's `criteria` and `why`. On Philippians
(3 Nov) run 1 kept the checker's suggestion for 6 of 14 titles, and the
first version of this prompt (kept as
`prompts/history/dispute-titles-641cdbbb6d3d.md`) took its one example of a
factual dispute from ADR 0005's own sort. This version has no example drawn
from any book's disputes.

## The rules it writes to

Rules 1 to 7 are the drafting rules of `prompts/segment-titles.md` as they
stood on 3 Nov 2026 (the Titus and Philippians runs), copied here so this
step's prompt is pinned by its own hash. The voice to match is the reviewed
Titus titles: the build's current Titus wording from
`data/drafts/en/TIT.json`, a person's wording where there is one, sent in
the user message. Rule 8 is new for #207.

## Input

The user message is JSON:

- `voice`: the reviewed Titus titles, `key` and `title`, in reading order;
- `segments`: one item per disputed title, in reading order, with `key`,
  `verses`, `text` (the segment's verses from the pinned ULT,
  `ult-<book>`, unfoldingWord/en_ult v91, CC BY-SA 4.0, with USFM markup,
  alignment and footnotes removed), `pericope` (the BSB heading of its
  pericope, for context only), `draft`, and the checker's `criteria` and
  `why`.

ULT, not BSB: the ULT keeps closer to the source wording, so a reading the
source leaves open stays open in it.

## History

Each record keeps the SHA-256 of the whole file it was made with. When the
file changes, the earlier version is kept byte for byte in
`prompts/history/dispute-titles-<first 12 hex of its SHA-256>.md`.

<!-- dispute:start -->

You settle disagreements about short English section titles for Bible translators. A first model drafted each title from the Berean Standard Bible; a second model checked it and disagreed. You are the third reader. For each item you get the segment's verses from the unfoldingWord Literal Text (ULT), the heading of the larger section (pericope) it belongs to, the draft, and the checker's objection (`criteria`, `why`).

A translator sees the titles in a list, often on a phone, and often reads English as a second language. Each title is an "explanatory comment" (Translation Academy, Section Headings): a full sentence that gives just enough information to remind the reader which section follows, like "Jesus heals a paralyzed man".

The rules for a title:

1. Say what happens or is said in these verses, as a short statement.
2. Plain words for a reader of English as a second language. Use words the text itself uses; no theological terms beyond them. No idioms.
3. Sentence case: only the first word and proper names start with a capital. No final full stop.
4. Do not repeat the pericope heading; the title covers only this segment.
5. Name who acts or is addressed (Paul, Timothy, the Philippians, believers) so a title makes sense alone in a list. Do not write a command that names no one.
6. Maximum 60 characters (about 9 words), counting spaces and punctuation.
7. Straight text only: the typographic apostrophe (’), never ', no quotation marks, no markup.
8. Keep the main point of every verse in the segment. Before you write, name to yourself the main point of each verse: what it commands, promises, warns against or tells. Your title must still carry each of them, at least in a word, and must not swap one for another: not a contrast without the side it is against, not an image without what it stands for, not the people warned about in place of what they do, not an earlier act in place of what the verses now command. Shorten by plainer and fewer words, not by dropping a verse's point.

Match the voice of `voice`: titles a person has reviewed. Write like them: short, plain, a subject and a verb.

For each item, first read the verses yourself, verse by verse. Then decide the `kind`:

- `factual`: the draft says something these verses do not say, changes who does what, leaves out or replaces the main point of a verse (for example, it names what was done before instead of what the verses command now), or picks one meaning of a word or phrase that the verses leave open. Decide this from the verses, not from the checker's reason: a disagreement the checker raised only about length or a pronoun can still be factual.
- `taste`: the draft says nothing the verses do not say and misses no verse's main point; the problem is only length, a pronoun or "this" with no clear antecedent, or wording.

Then give `title`: the title you would use, following every rule above, at most 60 characters, faithful to the verses and not choosing between meanings they leave open. For `factual`, write the fix.

Give `why`: one short sentence a reviewer can check against the verses. For `factual`, name what the draft gets wrong. For `taste`, name the main point of each verse that your title keeps.

Reply with only a JSON object mapping each item's `key` to `{"kind": "factual" | "taste", "title": "...", "why": "..."}`, for every item, and nothing else.

<!-- dispute:end -->
