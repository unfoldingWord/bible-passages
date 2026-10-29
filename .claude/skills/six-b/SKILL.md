---
name: six-b
description: Produce a 6B evaluation (Borrow, Bend, Break, Beget, Bide, Build) before planning, scoping, sizing or implementing any component of the Bible Passages dataset — a data source, a pipeline step, a check, a tool, a viewer, a translation or review process. Use it whenever someone asks how to do a piece of the work, what to build, what it will take, or proposes writing new code or a new process, even if they don't say "6B". The table goes in the plan, the issue or docs/scoping/ before any Build.
---

# 6B evaluation

Adapted from Klappy's canon (`klappy/klappy.dev` at `b750d7d`,
`canon/methods/borrow-bend-break-beget-build.md` and
`canon/constraints/borrow-evaluation-before-implementation.md`), MIT,
© 2026 Klappy. Adopted for unfoldingWord work under pm#463.

The aim is the most work not done. Each step narrows what this repo must
build itself. Nothing is built until the five steps before Build have a
recorded verdict.

**Where to look.** Borrow and Bend draw on unfoldingWord and partner projects:
the unfoldingWord GitHub org (tc-mobile, tc-study, translation-helps-mcp,
translationCore, servant.bible, baruch, fia-mcp, the `*-rcl` component
libraries, the Door43 tools), Door43 content (ULT, Translation Notes,
Translation Words, Translation Academy, versification) and partners' open
work. Commercial vendors are not candidates. Beget means a uW or partner team
carries the piece. What we Build is built to be borrowed by the next uW
project.

**The bar a candidate must meet:** it helps ship software we are proud of,
with simple UX that works across many languages and scripts. A candidate that
fits technically but makes the result harder for translators to use fails
Borrow.

## The steps

| Step       | Meaning here                                                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Borrow** | Use what exists, unchanged: a named dataset, file, library or tool at a named version or commit.                                                                 |
| **Bend**   | Use an existing thing in a new way without changing it: compose, repurpose, run it over our inputs.                                                              |
| **Break**  | Run it until it actually fails. Only observed failures count; they are the real constraints. Record the command, input and result.                               |
| **Beget**  | Hand the missing piece to a named person or team to build in parallel, with a fallback if it stalls.                                                             |
| **Bide**   | Wait, only if the field is converging on it, with a reason the wait is acceptable, a tripwire (date or condition) and the inspection criteria for when it fires. |
| **Build**  | Build only what is left, minimal, traced to a specific Break.                                                                                                    |

## What to produce

For each component, this table plus one Reversibility line:

```markdown
### <Component>

| Step   | Verdict                                                                  | Evidence / justification                                           |
| ------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Borrow | applied / skipped / n/a                                                  | named artifact + version or commit; or why skipped                 |
| Bend   | applied / skipped / n/a                                                  | what was bent and how                                              |
| Break  | observed / none-yet / n/a                                                | the command or run, input, and what failed                         |
| Beget  | delegated / skipped / n/a                                                | who carries it, by when, the fallback                              |
| Bide   | waiting / inspected-and-adopted / inspected-and-rejected / skipped / n/a | tripwire; or what was inspected and the criterion that rejected it |
| Build  | none / minimal / not-yet                                                 | what is built, traced to the Break above                           |

Reversibility: forward = low|medium|high; backward = low|medium|high. <one clause>
```

## Rules

- **Name the artifact.** "Considered the chunk files" is not a Borrow; "Door43-Catalog/versification `bible/ufw/chunks/*.json` at `af14923`" is.
- **A Break is observed, not imagined.** If nothing has been run, the verdict is `none-yet`, and Build is `not-yet`. Run the cheapest experiment first: if fifteen minutes of measuring would settle it, measuring is required before the concern counts.
- **A skip needs a named reason.** "I want to understand it" is not one.
- **A Bide without a tripwire is dropped scope.** Drop it explicitly or set the tripwire.
- **Rejecting what surfaced needs a named criterion:** vision conflict, foundational gap, gross overcomplication, opinionated stack imposition, improper authority, or a persistent gap after several iterations. "Didn't fit" is not a verdict.
- **Build traces to a Break.** If the Build is bigger than the Break demands, cut it.
- **Licences are part of Borrow.** An input whose licence cannot be shared under CC BY-SA 4.0 with attribution is not borrowable here, however useful (see AGENTS.md, "Data").
- **The table is falsifiable.** Anyone may challenge a row; a challenged row is re-run or re-justified, not defended.

## Where it goes

- Scoping: `docs/scoping/<component>.md`, one file per component.
- A decision that follows from it: `docs/decisions/NNNN-*.md`, linking the table.
- A PR that builds something: link the table in the PR body.

## Example (from this repo's scaffold)

### Template package checker

| Step   | Verdict  | Evidence / justification                                                                                               |
| ------ | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| Borrow | applied  | tc-mobile `src/lib/templates/validate.ts` at `8757e3a8`, copied byte for byte                                          |
| Bend   | applied  | run over `dist/tc-mobile/` in this repo's tests instead of inside the app                                              |
| Break  | observed | the validator checks one package at a time, so it cannot see a key moved between releases (tc-mobile contract, "Keys") |
| Beget  | skipped  | tc-mobile's contract says the source owns key stability; nobody else can carry it                                      |
| Bide   | n/a      | nothing in the field is converging on this                                                                             |
| Build  | not-yet  | a key-stability check against the last release tag, traced to the Break above                                          |

Reversibility: forward = low; backward = low. The copy is replaceable by a newer copy.
