# Servant.Bible registry entry

Scoping for #14: the dataset's entry on Servant.Bible, slug `uw/bible-passages`.
Tracking issue: unfoldingWord/servant.bible#1.

Everything about the registry below was read from unfoldingWord/servant.bible
at `main` = `5472c7b` on 2026-10-29. `servers.json` there has the same blob
(`c19f778`) as at `e812227`, the last commit that touched it.

## Status

- **Was.** Until 2026-10-28 the slug was only proposed, in servant.bible
  PR #31 (`pipeline.md` §9 recorded a Bide on that PR).
- **Is** (checked 2026-10-29). PR #31 merged on 2026-10-28 (`c7f2749`). The
  entry exists in `servers.json` as `kind: dataset`, `status: planned`, with
  the eight required fields only. The slug is permanent from that merge
  (`docs/adding-a-server.md`, "Slug rules"). #14's "done when" (the entry is
  merged with `kind: dataset`) is met by that merge, as written.
- **Will be.** A pull request to servant.bible refines the entry (below),
  opened by the maintainer, not from this repo. `status` stays `planned`
  until the first release tag exists and servant.bible says what `available`
  means for a dataset (question 3).

## What the registry is

| Fact                                                                                                                                                                                       | Where observed                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| One registry, `servers.json` at the repo root. The page, the router and `/mcp.json` are built from it. "There is no second place to register it."                                          | `docs/adding-a-server.md`                                 |
| An entry is a `server` or a `dataset`. A dataset may be listed before any server exists, which reserves its slug.                                                                          | `docs/adr/0005-the-list-carries-datasets-and-a-status.md` |
| `status` is `available`, `planned`, `degraded` or `retired`. `planned` is shown as coming and not routed. Only `kind: server` is ever routed.                                              | ADR 0005, decision 2                                      |
| `servers.schema.json` (JSON Schema 2020-12, `additionalProperties: false`) guards every entry; `scripts/validate-servers.mjs` adds three cross-entry rules. Both run in pre-commit and CI. | ADR 0005, decision 5; `servers.schema.json`               |
| A change is a pull request to servant.bible. Its merge rules are that repository's, not ours.                                                                                              | `docs/adding-a-server.md`, "Steps"                        |
| DCS (Door43) is listed under `sources`, not as an entry. `sources` is the only place a relationship between entries is defined; the map draws from it.                                     | ADR 0005, decisions 3 and 6                               |
| An address is earned by being listed and meeting the quality standard. The standard is a draft for MCP servers (servant.bible#20, open) and says nothing yet about datasets.               | `docs/adr/0004-hosting-agnostic-registry.md`; #20         |

## What an entry contains

Required for every entry: `kind`, `status`, `org`, `server`, `name`,
`description`, `purpose`, `operator` (`{ name, url?, contact? }`).

Optional: `shorthand` (the `/s/<name>` alias, unique across every
organization), `sources` (`[{ name, url }]`), `repository` (`https://` URL),
`resources` (from a fixed list of ten: `bible`, `bible-stories`, `dictionary`,
`lexicon`, `media`, `study-notes`, `translation-academy`, `translation-notes`,
`translation-questions`, `translation-words`).

Forbidden on a dataset: `versions` and `current`. There is no other field:
`additionalProperties: false` rejects anything else, including a licence or a
release URL (see "What the entry cannot say").

## The entry today

As merged in PR #31, unchanged since:

```json
{
  "kind": "dataset",
  "status": "planned",
  "org": "uw",
  "server": "bible-passages",
  "name": "Bible Passages (BPd)",
  "description": "Open Bible Stories and every passage in the Bible, organized by book and passage title, with the chapter and verse range as secondary information.",
  "purpose": "The template library in translationCore Mobile v2, starting with the top 10 Strategic Languages, and finding a place in the story without book, chapter, and verse.",
  "operator": {
    "name": "unfoldingWord",
    "url": "https://unfoldingword.org"
  }
}
```

Its description and purpose were taken from servant.bible#1's text, and the
comment there that proposed the slug says they "can be refined later by a
normal pull request to `servers.json`".

## 6B

### Registry entry

| Step   | Verdict  | Evidence / justification                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Borrow | applied  | servant.bible `servers.json` and `servers.schema.json` at `5472c7b`, unchanged: the merged `uw/bible-passages` entry is the starting point, and its slug, `kind`, `status`, `name`, `purpose` and `operator` are kept. The DCS `sources` item is copied verbatim from the `uw/tc-helps` and `uw/bibles` entries, so the map draws one DCS node, not several spellings of it (ADR 0005, decision 6).                        |
| Bend   | applied  | This repo's `sources.json`, read for the entry's `sources`: all 8,085 pinned inputs are on `git.door43.org` (measured below), so one DCS item covers them. `docs/adding-a-server.md` step 2 ("copy the closest existing entry and change every field") used as the procedure.                                                                                                                                              |
| Break  | observed | (1) The description says "Open Bible Stories and every passage"; nothing in this repo's schema, plan or README mentions OBS (`grep -rni 'open bible stories' docs/schema.md docs/scoping/plan.md README.md`: no match). (2) The schema has no field for a licence or a release: an entry with `license` fails validation (output below). (3) No release exists, so there is nothing for a release-dependent field to name. |
| Beget  | skipped  | Changing the entry is a pull request to servant.bible, which this repo's agents do not open; the maintainer submits it (steps below). A licence or release field would be a servant.bible schema change, for its owners to decide (question 2).                                                                                                                                                                            |
| Bide   | waiting  | `status` stays `planned`. Tripwire: the `v0.1.0` tag exists on this repo **and** servant.bible states what `available` means for a dataset. When it fires, inspect whether the release meets that meaning and whether #20's standard applies to datasets.                                                                                                                                                                  |
| Build  | none     | A text edit to one entry in another repository's file; no code in this repo.                                                                                                                                                                                                                                                                                                                                               |

Reversibility: forward = low; backward = low for `description`, `sources`
and `repository` (a later PR); none for `org` and `server`, which are already
permanent.

## Draft entry

Validated against servant.bible's schema (below). Fields not listed under
"Changed" are as merged.

```json
{
  "kind": "dataset",
  "status": "planned",
  "org": "uw",
  "server": "bible-passages",
  "name": "Bible Passages (BPd)",
  "description": "Planned dataset: passage (pericope) and segment (chunk) divisions for every book of the Bible. At v0.1 each division has a short English title; other languages are added as each passes its quality checks. The chapter and verse range is secondary information.",
  "purpose": "The template library in translationCore Mobile v2, starting with the top 10 Strategic Languages, and finding a place in the story without book, chapter, and verse.",
  "operator": {
    "name": "unfoldingWord",
    "url": "https://unfoldingword.org"
  },
  "sources": [
    {
      "name": "Door43 Content Service (DCS)",
      "url": "https://git.door43.org"
    }
  ],
  "repository": "https://github.com/unfoldingWord/bible-passages"
}
```

Changed, and why:

| Field         | Change                                                                        | Evidence                                                                                                                                                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `description` | Planned v0.1 contents: pericope and segment divisions with titles. No OBS.    | `docs/schema.md`; ADR 0003 decision 1 (v0.1 is all structure and English titles, plus the languages that pass the gates). Today titles exist for PHP and TIT only (below). OBS: Break (1), question 1.                                                         |
| `sources`     | Added: DCS.                                                                   | Every pinned input is on `git.door43.org`: BSB headings (`Worldview/en_bsb`), UFW versification and chunks (`Door43-Catalog/versification`), Translation Words and Translation Words Links (`unfoldingWord/en_tw`, `unfoldingWord/en_twl`, nine other `*_tw`). |
| `repository`  | Added.                                                                        | The repository is public (`gh repo view --json visibility`: `PUBLIC`).                                                                                                                                                                                         |

Left out on purpose:

- **`resources`.** None of the ten values describes passage divisions or
  titles. `bible` would say the dataset carries Bible text, which it does not
  (copyrighted Bible text is not an input, `AGENTS.md`). `translation-words`
  is where its key-term glossaries come from, not what it covers. Question 4.
- **`shorthand`.** Optional, and assigning one is "a reviewed list change"
  across every organization. Nothing here needs `/s/bible-passages` before a
  server exists. Question 5.
- **`operator.contact`.** Optional; the other `uw` entries omit it.
- **`versions`, `current`.** Forbidden on a dataset.

## What the entry cannot say

These facts belong with the listing but have no field; they live in this
repository and reach readers through `repository`.

| Fact               | Value                                                                                                                                                     | Where it lives here                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Licence            | Data CC BY-SA 4.0; code MIT                                                                                                                               | `LICENSE`, `LICENSE-CODE`, `README.md` |
| Release            | None. `package.json` version `0.0.0`; `git tag` and `gh release list` empty (2026-10-29). Releases will be `vX.Y.Z` tags with `dist/tc-mobile/` attached. | `docs/schema.md`, "Releases"           |
| Layout             | `dist/tc-mobile/`: 66 book packages (`<BOOK>.json`) and title tables `titles/<lang>/<BOOK>.json`, tC Mobile template package format v0                    | `docs/schema.md`                       |
| Title tables built | English only, for 2 books (PHP, TIT), at `71658d0`                                                                                                        | `dist/tc-mobile/titles/en/`            |
| v0.1 languages     | en plus ar, es-419, fr, hi, id, pt-BR, ru, sw, zh-Hans, each shipping only once it passes the gates                                                       | ADR 0002; ADR 0003 decision 1          |

## Checks run

The draft entry was validated with ajv 8.17.1 and ajv-formats 3.0.1
(`Ajv2020`, `strict: true`, `allErrors: true`, the options
`validate-servers.mjs` uses; servant.bible depends on `ajv ^8.20.0`) against
`servers.schema.json` at `5472c7b`, with the draft substituted for the
merged entry in the full `servers.json`, plus the org+server and shorthand
uniqueness rules. This re-implements the upstream gate; it is not the gate.
The `description` was reworded in review after this run (planned framing),
and the run was not repeated; step 3 below is the check that counts.
The upstream PR runs the real one (`pnpm validate:servers`) in its pre-commit
hook and CI.

```
draft as above:            entries=10 replaced index=5 errors=0
merged entry (sanity):     entries=10 replaced index=5 errors=0
draft + "license":         errors=1  /entries/5 must NOT have additional properties {"additionalProperty":"license"}
draft + versions/current:  errors=3  /entries/5/current boolean schema is false; /entries/5/versions boolean schema is false; must match "then" schema
```

Source hosts in `sources.json` at `71658d0`, counted two ways:

```
python3 (urllib.parse netloc):  Counter({'git.door43.org': 8085})
jq (split("/")[2], group_by):   git.door43.org 8085
```

Every URL in the draft, and the four Door43 repositories named above,
answered HTTP 200 on 2026-10-29 (`curl -L`).

## Blocked or open

Questions for the maintainer, to settle before the upstream PR:

1. **OBS in the description.** Keep "Open Bible Stories" (if tC Mobile's
   template library expects this entry to stand for OBS too) or drop it as
   the draft does? Nothing in this repo builds OBS passages.
2. **Licence and release fields.** The schema has neither. Is a pointer
   through `repository` enough, or should servant.bible be asked for a field?
   That would be a schema change plus a note in `adding-a-server.md` (ADR
   0005, Consequences), decided there.
3. **When `planned` becomes `available` for a dataset.** ADR 0005 defines
   `available` by what the router does, and datasets are never routed; #20's
   draft standard is about MCP servers. Proposed here: flip at the `v0.1.0`
   tag, if servant.bible agrees. Blocked on a release either way.
4. **`resources`.** Omit (draft), or ask servant.bible for a value that fits
   passage divisions? A new value is added "on both sides" with BT Servant
   (ADR 0005, Consequences).
5. **`shorthand`.** None (draft), or reserve `/s/bible-passages` now?

Blocked:

- A release URL, and any change of `status` to `available`: no tag exists.
  The release workflow (`.github/workflows/release.yml`) runs on a pushed
  `v*` tag after a reviewed version bump.
- The MCP address `servant.bible/org/uw/server/bible-passages/mcp`: there is
  no MCP server for this dataset, and a dataset entry cannot carry
  `versions`. A server would be a change to the entry decided upstream.

## Submitting it upstream

The maintainer does this; nothing here opens a PR, issue or comment on
servant.bible.

1. In a clone of unfoldingWord/servant.bible, branch from `main` (it was
   `5472c7b` when this was written; check `servers.json` has not changed
   since).
2. In `servers.json`, replace the `uw/bible-passages` entry with the draft,
   keeping its position in `entries`. Change `description` and add `sources`
   and `repository`; leave `org`, `server`, `kind` and `status` as they are.
3. Run `pnpm install` and `pnpm validate:servers`; it must print no errors.
   The pre-commit hook runs it again.
4. Commit and open a PR. Link servant.bible#1, and say there is no backend
   to verify because this is a dataset with no server; the entry stays
   `planned`. Follow servant.bible's own merge and review rules.
5. After it merges, record the merge commit on #14 here and close #14.
   Revisit `status` when the Bide tripwire above fires.
