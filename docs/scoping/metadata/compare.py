#!/usr/bin/env python3
"""Compare script A's and script B's output for bible-passages #44 / #84 (stdlib only).

Usage: python3 -I compare.py <a.json> <b.json>

Prints one line per difference, then the number of values compared and of differences.
Exits 1 if any value differs. The field map below is every measure the two scripts both
compute; anything not listed is computed by script A only and is not compared.
"""
import json, sys

A = json.load(open(sys.argv[1], encoding="utf-8"))
B = json.load(open(sys.argv[2], encoding="utf-8"))

# (A field, B field) per book. A's poetry measures and B's "...Text" measures follow the
# same rule (a bare \q1 line before \v belongs to the next verse); B's unsuffixed
# poeticVerses and segments* use the other rule and are not compared.
TN = [(k, k) for k in ("rows", "verseRows", "supportRefRows", "figsPrefixRows", "strictRows",
                       "imageryRows", "strictDistinct", "fDistinct", "segments", "segmentsWithF",
                       "segmentFPairs", "unparsedRefs")]
TQ = [(k, k) for k in ("rows", "verseRows", "segmentsWithQuestion")]
BSB = [(k, k) for k in ("rMarkers", "rAfterS1", "s1Markers", "dMarkers", "verses")] + [
    ("poeticVerses", "poeticVersesText"),
    ("segmentsPoetry", "segmentsPoetryText"),
    ("segmentsProse", "segmentsProseText"),
    ("segmentsMixed", "segmentsMixedText"),
]
# A drops zero-valued Counter keys (a book with no mixed segment has no segmentsMixed).
ZERO_OK = {"segmentsPoetry", "segmentsProse", "segmentsMixed"}
TA = [(k, k) for k in ("present", "translated", "presentStrict", "translatedStrict",
                       "presentUsed", "translatedUsed")]

compared, diffs = 0, 0


def check(where, a, b):
    global compared, diffs
    compared += 1
    if a != b:
        diffs += 1
        print(f"DIFF {where}: A={a!r} B={b!r}")


def fields(where, a, b, fmap):
    if a is None or b is None:
        check(where + " (file present)", a is not None, b is not None)
        return
    for ka, kb in fmap:
        va = a.get(ka, 0 if ka in ZERO_OK else None)
        check(f"{where} {ka}/{kb}", va, b.get(kb))


check("figures of speech (toc)", sorted(A["F_strict"]), sorted(B["F"]["strict"]))
check("biblical imagery (toc)", sorted(A["F_imagery"]), sorted(B["F"]["imagery"]))
books = [k for k in B["tn"] if k != "totals"]
check("book list", sorted(A["tn"]), sorted(books))
for bk in books:
    fields(f"tn {bk}", A["tn"][bk], B["tn"][bk], TN)
    fields(f"tq {bk}", A["tq"][bk], B["tq"][bk], TQ)
    fields(f"bsb {bk}", A["bsb"][bk], B["bsb"][bk], BSB)
fields("tn totals", A["tnTotals"], B["tn"]["totals"], TN)
fields("tq totals", A["tqTotals"], B["tq"]["totals"], TQ)
fields("bsb totals", A["bsbTotals"], B["bsb"]["totals"], BSB)
for lvl in "12345":
    check(f"difficulty level {lvl}", A["difficulty"].get(lvl, 0), B["difficulty"].get(lvl, 0))
check("taLang languages", sorted(A["taLang"]), sorted(B["taLang"]))
for lang in B["taLang"]:
    fields(f"taLang {lang}", A["taLang"].get(lang), B["taLang"][lang], TA)

print(f"compared {compared}")
print(f"diffs {diffs}")
sys.exit(1 if diffs else 0)
