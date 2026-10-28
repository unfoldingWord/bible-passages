# Scoping

One 6B evaluation per component (`.claude/skills/six-b/SKILL.md`), then the
sizing that follows from it ([`sizing.md`](sizing.md)). Borrow and Bend draw
on unfoldingWord and partner work first.

The components follow the requirements owner's 8-step build plan, plus the
pieces around it.

| #   | Component       | What it produces                                          | 6B                                           |
| --- | --------------- | --------------------------------------------------------- | -------------------------------------------- |
| 1   | Pericopes       | spans and English titles from BSB `\s1` headings          | [pipeline.md](pipeline.md#1-pericopes)       |
| 2   | Consensus check | evidence for overriding a BSB title                       | [pipeline.md](pipeline.md#2-consensus-check) |
| 3   | Segments        | UFW chunks nested in pericopes, split at pericope starts  | [pipeline.md](pipeline.md#3-segments)        |
| 4   | Versification   | BSB → ULT verse mapping, so every span is ULT             | [pipeline.md](pipeline.md#4-versification)   |
| 5   | Segment titles  | AI-drafted English titles with an AI check pass           | [ai.md](ai.md#5-segment-titles)              |
| 6   | Metadata        | topics, key terms, figures of speech, form, difficulty    | [pipeline.md](pipeline.md#6-metadata)        |
| 7   | Translation     | titles in each language, with per-language glossaries     | [ai.md](ai.md#7-translation)                 |
| 8   | Review          | people approve, flag or suggest each title                | [review.md](review.md)                       |
| 9   | Publish         | `dist/tc-mobile/` packages and title tables, release tags | [pipeline.md](pipeline.md#9-publish)         |
| 10  | Project site    | live scope, sizing, sprints, decisions, coverage          | [site.md](site.md)                           |

Files not yet written are being scoped.
