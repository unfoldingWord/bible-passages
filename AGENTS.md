# AGENTS.md — bible-passages

The guide for anyone, human or agent, working in this repo. `CLAUDE.md`
defers to this file.

## What this repo is

The Bible Passages dataset: pericope and segment (chunk) divisions for every
book of the Bible, with titles in many languages. It is data plus the scripts
that build and check it; nothing here is deployed.

- Schema, layout, keys and checks: [`docs/schema.md`](docs/schema.md) (draft).
- Tracking issue: unfoldingWord/servant.bible#1. Servant.Bible slug
  `uw/bible-passages`.
- Main consumer: tC Mobile (unfoldingWord/tc-mobile), which reads
  `dist/tc-mobile/` as template packages v0.
- Decisions with their reasons: [`docs/decisions/`](docs/decisions).
- Session log: [`docs/progress_tracker.md`](docs/progress_tracker.md).

## Why, and the bar

This work serves unfoldingWord's mission: leaders in the global church able
to take the Bible into every language. The dataset exists so translators can
find their way through a book, in their own language.

The bar is software we are proud to ship and tools people love and love to
share:

- **Simple to use.** A title is short, plain and clear to someone reading in
  their second language. A review screen asks one thing at a time.
- **Works across languages.** Every surface handles many scripts and
  right-to-left text from the start, not as a later fix.
- **Excellent, not just finished.** A step is done when it is checked, not
  when it runs.
- **Built with the family.** Reuse unfoldingWord and partner work first, and
  give back what we make (see "6B before Build").

## Stack and commands

Node 22, TypeScript (strict), vitest, prettier.

```
npm ci
npm run verify     # format check, typecheck, tests: what CI runs
npm run format     # rewrite formatting
```

CI (`.github/workflows/ci.yml`) runs a gitleaks scan of full history and
`npm run verify`.

## Rules

### Data

- **`dist/` is generated.** Change `data/` or `scripts/` and rebuild. Never
  edit `dist/` by hand.
- **Keys are permanent.** A released key never changes its span and is never
  reused. A moved boundary gets a new key; the old one is retired. See
  `docs/schema.md`, "Keys".
- **A published release is never edited.** A change is a new tag.
- **Every input is pinned in `sources.json`** (URL, revision, SHA-256, licence,
  attribution) before the build reads it. No unpinned downloads.
- **Licences.** Data is CC BY-SA 4.0 (`LICENSE`); code is MIT
  (`LICENSE-CODE`). Do not add an input whose licence cannot be shared under
  CC BY-SA 4.0 with attribution. Copyrighted Bible text and headings are not
  inputs.
- **Label AI output.** Every AI-written title carries `source: "ai:<model>"`
  and a status no higher than `ai-checked` until a person reviews it.
- **Do not edit `vendor/tc-mobile/`.** Update it by copying from a newer
  tc-mobile commit and updating `VENDOR.md`; the hash test enforces this.

### Branches, commits and PRs

- **Never push to `main`. Never merge without explicit permission** from the
  maintainer, even with green CI.
- Branch names are `<type>/<short-description>` (`feat/tit-structure`,
  `chore/scaffold`).
- Conventional Commits. Say what changed and why in the body.
- **Never `--no-verify`.** Never add a lint or type suppression without asking.
- One change per PR. Link the issue; use `Closes #N` only when the PR closes
  all of it.
- Every agent-authored PR body and comment ends with the session link the
  agent provides.

### Review

External review uses the codex and grok CLIs (Frank and George). A PR that
changes `data/`, `scripts/`, `tests/` or `.github/` gets both before merge is
discussed; a docs-only PR may merge on green CI with the maintainer's OK.

### Evidence

- **Never claim verification you did not perform.** No commit, comment or PR
  body says tested, verified or checked unless it was; put the command and its
  output in the PR.
- Label inference and assumptions as such. A count or claim about a source
  (pericope totals, licence terms) cites where it was observed.

### Privacy

This repository is public. Do not write another person's name, or where a
request came from in chat, into commits, issues, PRs or docs unless they are a
contributor who chose to be named. Use roles: the maintainer, the content
team, a reviewer. No secrets or account identifiers in the tree.

## How we work

Adapted from Klappy's canon (`klappy/klappy.dev` at `b750d7d`, MIT, © 2026
Klappy): the axioms, the 6B method, measure-before-you-object, status in three
tenses, progress over perfection, and ToC sprints. Read here as the rules for
this repo; the canon itself is the longer source.

### Axioms

1. **Reality is sovereign.** Look at the file, the run or the count before
   saying what it is.
2. **A claim is a debt.** Every assertion carries its evidence, or says it has
   none.
3. **Integrity is efficient.** Honest uncertainty costs less than false
   certainty.
4. **You cannot verify what you did not observe.** If you did not look, you do
   not know.

### Modes

Every piece of work is in one mode: **exploration** (gather, no commitments),
**planning** (options, trade-offs, the 6B table, sizing) or **execution**
(build, then validate). Do not skip a mode without saying why. Before moving
from planning to execution, check the gate: the decision is recorded, the
inputs are pinned, the definition of done is written. If the gate fails, stop
and say what is missing.

### 6B before Build

Before scoping, sizing or building any component, produce its 6B evaluation
(Borrow, Bend, Break, Beget, Bide, Build) with the `six-b` skill
(`.claude/skills/six-b/SKILL.md`). Nothing is built that does not trace to an
observed Break.

### Measure before you estimate or object

- An estimate or a concern that a cheap measurement would settle is measured
  first. If about fifteen minutes would answer it, measuring is required.
- Every number on a plan, a sizing table or the project site is labelled
  **measured** (with the command, source and commit) or **estimated** (with
  the method and what would measure it).
- A concern that cannot be measured yet is labelled untested and tracked as a
  watch item, not used as a blocker.

### Status in three tenses

A status says what **was** (and when it was observed), what **is** (and when
it was last checked) and what **will be** (and the gate that decides it). A
claim with no observed time says so: "not re-checked since 2026-10-28".

### Progress over perfection

Ship the smallest increment someone other than its author can verify, then
take the next step from what was verified. For the dataset that increment is
one book end to end, from sources to `dist/tc-mobile/`, before the next book.
Rates measured on that book (titles per hour, model cost per title, review
minutes per title) replace estimates for the rest.

### Sprints

Each sprint names **one constraint** (the single thing limiting progress now)
and one owner, and ends in a delivery someone can verify: a merged commit, a
release tag, a checked count. Choose the constraint again at each sprint
review from what was verified, not from what was reported. Anything only the
maintainer can decide is batched as a single yes or no for the next review.
Each review writes one status line with:

1. current work;
2. verified change since the last review;
3. the one constraint and who owns it;
4. the next milestone, stated as conditional on its gate;
5. release stage.

## Decisions still open

Listed at the end of `docs/schema.md`, to be settled on servant.bible#1 and
then recorded in `docs/decisions/`.
