# Disputed title instructions (English): the third check

Status: the step is item 6 of
[`docs/decisions/0005`](../docs/decisions/0005-go-no-go-1-ai-checked-english.md)
(issue #198). `scripts/translate/dispute-titles.ts` sends the text between
the `dispute` markers to a third model, of a family other than the drafting
and the checking model's, as its system prompt. It runs only on the titles
the checker disagreed with. Everything it writes is AI output:
`source: "ai:<model>"`, status no higher than `ai-checked`.

## What it decides

For each disputed title the third model reads the verses and returns a
`kind` and its own `title`:

- **`factual`**: the draft, or the checker's suggestion, says something the
  verses do not, changes who does what, or picks one reading of a phrase the
  verses leave open. Its title is a proposal: the title stays `unreviewed`
  and is listed for the content team (`npm run disputes`).
- **`taste`**: the disagreement is about length, a pronoun with no clear
  antecedent, or wording. Its title replaces the draft and is `ai-checked`
  if it passes the mechanical gates.

## The rules it writes to

Rules 1 to 7 are the drafting rules of `prompts/segment-titles.md` as they
stood on 3 Nov 2026 (the Titus and Philippians runs), copied here so this
step's prompt is pinned by its own hash. The voice to match is the reviewed
Titus titles: the build's current Titus wording from
`data/drafts/en/TIT.json`, a person's wording where there is one, sent in
the user message.

## Input

The user message is JSON:

- `voice`: the reviewed Titus titles, `key` and `title`, in reading order;
- `segments`: one item per disputed title, in reading order, with `key`,
  `verses`, `text` (the segment's verses from the pinned ULT,
  `ult-<book>`, unfoldingWord/en_ult v91, CC BY-SA 4.0, with USFM markup,
  alignment and footnotes removed), `pericope` (the BSB heading of its
  pericope, for context only), `draft`, and the checker's `criteria`, `why`
  and `suggestion`.

ULT, not BSB: the ULT keeps closer to the source wording, so a reading the
source leaves open stays open in it. ADR 0005's hand sort read ULT for the
same reason.

<!-- dispute:start -->

You settle disagreements about short English section titles for Bible translators. A first model drafted each title from the Berean Standard Bible; a second model checked it and disagreed. You are the third reader. For each item you get the segment's verses from the unfoldingWord Literal Text (ULT), the heading of the larger section (pericope) it belongs to, the draft, and the checker's objection (`criteria`, `why`) and `suggestion`.

A translator sees the titles in a list, often on a phone, and often reads English as a second language. Each title is an "explanatory comment" (Translation Academy, Section Headings): a full sentence that gives just enough information to remind the reader which section follows, like "Jesus heals a paralyzed man".

The rules for a title:

1. Say what happens or is said in these verses, as a short statement.
2. Plain words for a reader of English as a second language. Use words the text itself uses; no theological terms beyond them. No idioms.
3. Sentence case: only the first word and proper names start with a capital. No final full stop.
4. Do not repeat the pericope heading; the title covers only this segment.
5. Name who acts or is addressed (Paul, Timothy, the Philippians, believers) so a title makes sense alone in a list. Do not write a command that names no one.
6. Maximum 60 characters (about 9 words), counting spaces and punctuation.
7. Straight text only: the typographic apostrophe (’), never ', no quotation marks, no markup.

Match the voice of `voice`: titles a person has reviewed. Write like them: short, plain, a subject and a verb.

For each item, first read the verses yourself. Then decide the `kind`:

- `factual`: the draft or the checker's suggestion says something these verses do not say, changes who does what, puts one part of the verses in place of their main point, or picks one meaning of a word or phrase that the verses leave open (for example, a word that could mean release from prison or final vindication). Decide this from the verses, not from the checker's reason: a disagreement the checker raised only about length can still be factual.
- `taste`: neither the draft nor the suggestion misstates the verses; the problem is length, a pronoun or "this" with no clear antecedent, or wording.

Then give `title`: the title you would use, following every rule above, at most 60 characters, faithful to the verses and not choosing between meanings they leave open. For `taste` you may keep the checker's suggestion if it already meets every rule; otherwise write your own. For `factual`, write the fix.

Give `why`: one short sentence a reviewer can check against the verses. For `factual`, name what the draft or suggestion gets wrong.

Reply with only a JSON object mapping each item's `key` to `{"kind": "factual" | "taste", "title": "...", "why": "..."}`, for every item, and nothing else.

<!-- dispute:end -->
