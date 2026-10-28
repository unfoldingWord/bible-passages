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
to it. Titles carry forward to the successor as `unreviewed` drafts. The
chunk source (open decision 8) must be settled before the first release,
because changing it later retires thousands of keys.

## Rejected

- **Scripture Burrito scope strings** (`TIT.1:1-4`): they match tC Mobile's
  section addressing (its ADR 0004) but not its template fixture. Nothing
  here needs the colon form.
- **Order keys** (`TIT.P02`, the pilot's form): inserting one pericope
  renumbers every later key.
