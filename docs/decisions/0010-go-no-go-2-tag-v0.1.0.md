# 0010: Go/no-go 2: tag v0.1.0; versification stays `ufw`, its review deferred

- **Status:** accepted
- **Date:** 2026-11-16
- **Decided by:** the maintainer. Item 1 by pushing the `v0.1.0` tag on
  16 Nov, after the gate check posted on #13 that day. Item 2 on 20 Nov,
  approving the deferral proposed in that session. This records go/no-go 2
  (`../scoping/plan.md`, Fri 13 Nov), three days late, and settles open
  decision 4 (`../schema.md`) for v0.1.0.

## Decision

1. **Go.** v0.1.0 is tagged at `main` `a0c6bbf`. The Release workflow made a
   draft release from that tag. The release is published when the
   maintainer has reviewed the draft.
2. **v0.1.0 checks every span against the `ufw` versification, and its
   segment boundaries come from the UFW chunk files (ADR 0007), not from a
   UTN release.** Whether a later release moves to another scheme or to UTN
   boundaries is deferred to v0.1.x. Open decision 4 stays open for that
   question only. Owner: the maintainer.

## Evidence

All observed on 16 Nov 2026 unless marked otherwise; the gate check is the
comment on #13 that day.

| Gate (`../scoping/plan.md`)        | Result | How it was checked                                                                                                                                                                                                                                                                              |
| ---------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| English through the quality gates  | pass   | `scripts/release/run.sh --dry-run` on `a0c6bbf`, unmodified: exit 0, "Dry run passed". `npm run verify` inside it: 29 test files, 11,819 passed, 2 todo. The rebuild matched the committed files. 132 assets.                                                                                   |
| `dist/` passes tC Mobile's checker | pass   | A separate script ran the checker over all of `dist/tc-mobile/`: 66 packages and 66 title tables, 0 failures, with the vendored copy (tc-mobile `8757e3a`) and with tc-mobile `develop` `dfc7d31`, which includes the hardened checker (tc-mobile #1761). The vendored copy is updated in #287. |
| Release notes list review status   | pass   | `node scripts/release/notes.ts v0.1.0`: 13,770 segments; 12,695 shipped (3 `approved`, 15 `human-reviewed`, 12,677 `ai-checked`); 1,075 held (813 disputes waiting on #207, 262 reusing an `unreviewed` BSB heading). No known issues.                                                          |

After the tag (16 Nov):

- Release workflow run 43958463719 passed and made a draft release with 132
  assets.
- The 66 title tables in the draft are byte for byte the files in
  `dist/tc-mobile/titles/en/`. Each of the 66 packages differs from
  `dist/tc-mobile/` in one field only, `source.revision`: `"unreleased"` in
  `dist/`, `"v0.1.0"` in the release. That is by design
  (`scripts/data/dist.ts`, `RELEASE_TAG`; `../schema.md`, `source.revision`).
- The draft's notes match a local `notes.ts v0.1.0` run except for one
  trailing blank line.

For item 2 (observed 20 Nov on `main` `a0c6bbf`):

- All 66 files in `data/structure/` say `"versification": "ufw"`.
- All 67 `ufw-*` sources in `sources.json` (the scheme and 66 chunk files)
  are pinned to Door43-Catalog/versification `af14923`. No UTN source is
  pinned.

## Why

- All three gates in the plan passed on evidence, so the tag went ahead as
  the plan says.
- Decision 4 had no effect on what v0.1.0 holds: the scheme and the
  boundaries were already fixed by what the build reads. Holding the tag for
  it would have changed nothing in the release.
- Keys are permanent from this tag (`../schema.md`, "Keys"). A later move to
  another scheme or to UTN boundaries can only add new keys and retire old
  ones; it cannot change a released key. So the deferral does not lock in a
  mistake that cannot be corrected later.

## Rejected

- **Slip the tag until decision 4 is settled.** It would delay tC Mobile
  (#1459, Sprint 7 from 16 Nov) with no change to the release.
- **Settle decision 4 now.** No one has compared the schemes or a UTN release
  against the UFW chunks yet; a choice now would have no evidence behind it.

## Consequences

- `../schema.md` lists decision 4 as settled for v0.1.0 and open for
  v0.1.x.
- `../scoping/plan.md` records go/no-go 2 and the tag.
- #13 closes once the draft release is published.
