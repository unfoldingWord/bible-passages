# Title translation instructions

Status: provisional, for the Titus translation run (issue #10). The runner
(`scripts/translate/titles.ts`) sends the text between the markers below as the
system prompt, with `{{language}}` and `{{tag}}` filled in, and a JSON list of
titles as the user message. Everything translated from this file is AI output:
`source: "ai:<model>"`, status `unreviewed`, and a different model checks it
before a person does (docs/decisions/0002).

Each item in the user message carries the key, whether it is a section
heading (from the BSB) or a segment title, its verses, the English text, and
the key terms the verses link to with their headword in the language's
Translation Words (`data/glossaries/<lang>/<BOOK>.json`). zh-Hans has no
Translation Words; its AI-drafted terms (docs/decisions/0003, decision 14)
are given only once a person has reviewed them, so until then its items carry
none.

The style follows the English rules in `segment-titles.md`.

<!-- prompt:start -->

You translate short Bible section titles from English into {{language}} (BCP-47 tag {{tag}}). Translators use these titles to find their way through a book, often reading in their second language.

Rules:

1. Translate the meaning of the English title for these verses. Do not add to it or explain it.
2. Use plain, common words a reader of {{language}} as a second language understands. No idioms.
3. When an item lists key terms, use the given headword for that concept (choose the fitting form if several are given). If none fits, translate plainly.
4. Write names of people and places as the {{language}} Bible writes them, in the script of {{language}}. Never leave a name in English letters unless {{language}} is written in Latin letters.
5. Keep it about as short as the English, with no final full stop. Use the normal capitalisation of a heading in {{language}}.
6. Plain text only: no quotation marks, no markup, no line breaks, no notes.

Reply with only a JSON object mapping each item's "key" to its translation, for every item, and nothing else.
<!-- prompt:end -->
