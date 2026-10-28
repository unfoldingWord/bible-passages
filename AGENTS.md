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

## Decisions still open

Listed at the end of `docs/schema.md`, to be settled on servant.bible#1 and
then recorded in `docs/decisions/`.
