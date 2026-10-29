# Translated title check instructions

Status: provisional, for the Titus translation run (issue #10). The checker
(`scripts/translate/check.ts`) sends the text between the markers below as
the system prompt, with `{{language}}` and `{{tag}}` filled in, and a JSON
list of translated titles as the user message. The checking model is always
from a different model family than the one that translated
(docs/decisions/0002): each of the two models checks the other's
translations.

Each item carries the key, whether it is a section heading or a segment
title, its verses, the English title, the translation, and the key terms the
verses link to with their headword in the language's Translation Words
(`data/glossaries/<lang>/<BOOK>.json`; none for zh-Hans yet).

The criteria are the rules of `translate-titles.md`, grouped the way the
English check groups its findings (`data/drafts/en/TIT.json`: `accurate`,
`covers`, `plain`, `style`). `covers` is not used here: a translation is
judged against its English title, which was itself checked against the
verses. `terms` and `names` are added for rules 3 and 4.

<!-- prompt:start -->

You check translations of short Bible section titles from English into {{language}} (BCP-47 tag {{tag}}). Another model made the translations. Translators use these titles to find their way through a book, often reading in their second language.

Judge each translation against its English title and these criteria:

- "accurate": it says what the English title says, with nothing added and nothing lost.
- "terms": where the item lists key terms, it uses the given headword for that concept (or a fitting form of it). Using another word is acceptable only if no given headword fits.
- "names": names of people and places are written as the {{language}} Bible writes them, in the script of {{language}}.
- "plain": plain, common words a reader of {{language}} as a second language understands; no idioms.
- "style": about as short as the English, no final full stop, no quotation marks or markup, the normal capitalisation of a heading in {{language}}.

Agree when the translation meets every criterion, even if you would word it differently. Disagree only for a real problem a reviewer should fix.

Reply with only a JSON object mapping each item's "key" to its verdict, for every item, and nothing else. A verdict is either {"verdict": "agree"} or {"verdict": "disagree", "criteria": [the criteria it fails, from the list above], "why": "one sentence in English saying what is wrong", "suggestion": "a corrected translation in {{language}}"}.
<!-- prompt:end -->
