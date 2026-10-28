# 0001: Keys name their span

- **Status:** accepted
- **Date:** 2026-10-28
- **Decided by:** the DRI (open decision 3 in `../schema.md`)

## Decision

Pericope and segment keys carry their span: `TIT.1.1-4` for a segment,
`TIT.P.1.1-4` for a pericope, and `TIT.1.4-4` for a one-verse segment. A
moved boundary always produces a new key; the old key is retired with its
successor in `data/retired-keys.json` and is never reused.

## Why

- tC Mobile's own Bible fixture uses this form (`MRK.1.1-8`), and its
  contract says a moved passage gets a new key. Here the format enforces
  that rule instead of memory.
- The key-stability check (#12) can then refuse a released key whose span
  changed, or a retired key used again.
- Titus is already built this way (`data/structure/TIT.json`, #15), and a
  second model re-derived the same 25 keys from the raw sources.

## Cost, accepted

Any boundary change retires a key and orphans the reviewed titles attached
to it. Carried-forward titles always become `unreviewed`
drafts. Each retired key names one successor in `data/retired-keys.json`
(accepted on #17), and the DRI set the rule for each kind of change on
28 Oct:

- **Resize** (one key becomes one key): the old titles carry to the
  successor.
- **Split** (one key becomes several): the old titles carry to the one
  successor the record names; every other new key gets a fresh draft.
- **Merge** (several keys become one): each old key names the merged key,
  but no title carries automatically. The merged key gets a fresh draft,
  and the reviewer sees all the old titles as reference.

So no reviewed title is silently dropped or silently chosen over another.

The chunk source (open decision 8) must be settled before the first release, because changing it
later retires thousands of keys.

## Rejected

- **Scripture Burrito scope strings** (`TIT.1:1-4`): they match tC Mobile's
  section addressing (its ADR 0004) but not its template fixture. Nothing
  here needs the colon form.
- **Order keys** (`TIT.P02`, the pilot's form): inserting one pericope
  renumbers every later key.
