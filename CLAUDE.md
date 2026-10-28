# bible-passages

Pericope and segment (chunk) divisions for every book of the Bible, with
titles in many languages. Read `docs/schema.md` first.

Tracking issue: unfoldingWord/servant.bible#1. Main consumer: tC Mobile
(unfoldingWord/tc-mobile), which reads `dist/tc-mobile/` as template packages
v0.

## Rules

- **Never merge without explicit permission.** Open a PR from a branch; never
  push to `main`.
- **`dist/` is generated.** Change `data/` or `scripts/` and rebuild. Never
  edit `dist/` by hand.
- **Keys are permanent.** A released key never changes its span and is never
  reused. A moved boundary gets a new key; the old one is retired. See
  `docs/schema.md`, "Keys".
- **A published release is never edited.** A change is a new tag.
- **Every input is pinned in `sources.json`** (URL, revision, SHA-256, licence,
  attribution) before the build reads it. No unpinned downloads.
- **Do not edit `vendor/tc-mobile/`.** Update it by copying from a newer
  tc-mobile commit and updating `VENDOR.md`; the hash test enforces this.
- **Licences:** data is CC BY-SA 4.0 (`LICENSE`); code is MIT
  (`LICENSE-CODE`). Do not add an input whose licence cannot be shared under
  CC BY-SA 4.0 with attribution. Copyrighted Bible text and headings are not
  inputs.
- **Label AI output.** Every AI-written title carries `source: "ai:<model>"`
  and a status no higher than `ai-checked` until a person reviews it.

## Commands

```
npm ci
npm run typecheck
npm test
```
