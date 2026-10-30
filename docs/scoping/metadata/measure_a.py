#!/usr/bin/env python3
"""Metadata sizing for bible-passages #44, script A (Python, stdlib only).

Usage: python3 -I measure_a.py <src-dir> <bsb-dir> <structure-dir> > a.json
  <src-dir>        holds en_tn, en_tq, en_ta (v91 clones) and ta_<repo> clones
  <bsb-dir>        <BOOK>.usfm, the pinned BSB files (sha256 checked against sources.json)
  <structure-dir>  data/structure/ of this repo
"""
import json, os, re, sys
from collections import Counter

SRC, BSB, STRUCT = sys.argv[1:4]
BOOKS = ("GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG "
         "ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT "
         "ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV").split()


def toc_sections(path):
    """Section title (any depth) -> ids linked anywhere beneath it (YAML read by indentation).
    A link belongs to the item that carries it; it is listed under that item's ancestors."""
    sections, stack = {}, []
    for line in open(path, encoding="utf-8"):
        m = re.match(r"^(\s*)- title:\s*\"?(.*?)\"?\s*$", line)
        if m:
            indent = len(m.group(1))
            while stack and stack[-1][0] >= indent:
                stack.pop()
            stack.append((indent, m.group(2)))
            continue
        m = re.match(r"^\s*link:\s*(\S+)", line)
        if m:
            for _, title in stack[:-1]:
                sections.setdefault(title, []).append(m.group(1))
    return sections


secs = toc_sections(f"{SRC}/en_ta/translate/toc.yaml")
F_STRICT = [x for x in secs["Figures of Speech"] if x != "figs-intro"]
F_IMAGERY = [x for x in secs["Biblical Imagery"] if x != "biblicalimageryta"]
F = set(F_STRICT) | set(F_IMAGERY)
F_WRITING = [x for x in secs["Writing Styles (Discourse)"] if x != "writing-intro"]


def verses_of(ref):
    """'c:v', 'c:v-v', 'c:v-c:v', 'c:v,v-v' -> list of (c, v); None if not a verse reference."""
    m = re.fullmatch(r"(\d+):([\d,\-:]+)", ref)
    if not m:
        return None
    c, out = int(m.group(1)), []
    for part in m.group(2).split(","):
        a = re.fullmatch(r"(\d+)(?:-(?:(\d+):)?(\d+))?", part)
        if not a:
            return "bad"
        v1 = int(a.group(1))
        if a.group(3) is None:
            out.append((c, v1))
        elif a.group(2) is None:
            out += [(c, v) for v in range(v1, int(a.group(3)) + 1)]
        else:
            return "bad"  # cross-chapter ranges: none observed in v91
    return out


def read_tsv(path):
    rows = open(path, encoding="utf-8").read().split("\n")
    head = rows[0].split("\t")
    return [dict(zip(head, r.split("\t"))) for r in rows[1:] if r.strip()]


def segments(book):
    s = json.load(open(f"{STRUCT}/{book}.json", encoding="utf-8"))
    return [(tuple(x["start"]), tuple(x["end"])) for x in s["segments"]]


def seg_index(segs, cv):
    for i, (a, b) in enumerate(segs):
        if a <= cv <= b:
            return i
    return None


def tn_book(book):
    path = f"{SRC}/en_tn/tn_{book}.tsv"
    if not os.path.exists(path):
        return None
    segs = segments(book)
    r = Counter(rows=0, verseRows=0, supportRefRows=0, figsPrefixRows=0, strictRows=0,
                imageryRows=0, unparsedRefs=0, frontRows=0, frontFRows=0, outsideSegments=0)
    used, strict_used, per_seg = Counter(), set(), [set() for _ in segs]
    ws, ws_seg = Counter(), [set() for _ in segs]
    for row in read_tsv(path):
        r["rows"] += 1
        ref, art = row["Reference"], row["SupportReference"].rsplit("/", 1)[-1]
        vs = verses_of(ref)
        if vs is None:
            if re.fullmatch(r"\d+:front", ref):
                r["frontRows"] += 1
                r["frontFRows"] += art in F
            continue
        if vs == "bad":
            r["unparsedRefs"] += 1
            continue
        r["verseRows"] += 1
        if not art:
            continue
        r["supportRefRows"] += 1
        r["figsPrefixRows"] += art.startswith("figs-")
        r["strictRows"] += art in F_STRICT
        r["imageryRows"] += art in F_IMAGERY
        if art in F_WRITING:
            ws[art] += 1
            for cv in vs:
                i = seg_index(segs, cv)
                if i is not None:
                    ws_seg[i].add(art)
        if art in F:
            used[art] += 1
            if art in F_STRICT:
                strict_used.add(art)
            for cv in vs:
                i = seg_index(segs, cv)
                if i is None:
                    r["outsideSegments"] += 1
                else:
                    per_seg[i].add(art)
    out = dict(r)
    out.update(strictDistinct=len(strict_used), fDistinct=len(used), segments=len(segs),
               segmentsWithF=sum(1 for s in per_seg if s), segmentFPairs=sum(len(s) for s in per_seg),
               maxPerSegment=max((len(s) for s in per_seg), default=0), _used=used,
               writingRows=sum(ws.values()), segmentsWithWriting=sum(1 for s in ws_seg if s), _ws=ws)
    return out


def tq_book(book):
    path = f"{SRC}/en_tq/tq_{book}.tsv"
    if not os.path.exists(path):
        return None
    segs, hit = segments(book), set()
    rows = read_tsv(path)
    verse_rows = 0
    for row in rows:
        vs = verses_of(row["Reference"])
        if vs in (None, "bad"):
            continue
        verse_rows += 1
        for cv in vs:
            i = seg_index(segs, cv)
            if i is not None:
                hit.add(i)
    return dict(rows=len(rows), verseRows=verse_rows, segmentsWithQuestion=len(hit), segments=len(segs))


POETIC = {"q1", "q2", "qr"}
NEXT = re.compile(r"\\(?:v|c)\s|\n\\(?:m|q1|q2|qr|qa|li|li1|li2|pmo|pc|d|s1|s2|r|ms|mr|b)\b")


def has_text(text, start):
    """True if words of the current verse follow a marker before the next verse, chapter or
    paragraph: a bare \\q1 line just before \\v belongs to the next verse, not this one."""
    m = NEXT.search(text, start)
    chunk = text[start:m.start() if m else len(text)]
    chunk = re.sub(r"\|[^\\]*", "", chunk)          # word attributes  |x-strong=...
    chunk = re.sub(r"\\[a-z0-9\-]+\*?", "", chunk)  # markers
    return bool(re.search(r"\w", chunk))
PARA = {"m", "q1", "q2", "qr", "qa", "li", "li1", "li2", "pmo", "pc", "d", "s1", "s2", "r", "ms", "mr"}


def is_marker(line, name):
    """The line starts with \\<name> followed by a space, a tab or the end of the line."""
    tag = "\\" + name
    return line.startswith(tag) and line[len(tag):len(tag) + 1] in ("", " ", "\t")


def s1_and_r_after_s1(text):
    """(\\s1 lines, \\r lines whose previous line is an \\s1 line), walking lines and skipping
    blank lines and \\b lines. The same rule, step for step, as measure_b.mjs's
    s1AndRAfterS1: lines split at \\r\\n, \\r or \\n; blank means only spaces and tabs; a
    marker is followed by a space, a tab or the end of the line (so a \\b line may carry
    trailing text and is still skipped)."""
    s1 = r_after = 0
    prev_s1 = False
    for line in re.split(r"\r\n|\r|\n", text):
        if re.fullmatch(r"[ \t]*", line) or is_marker(line, "b"):
            continue
        here_s1 = is_marker(line, "s1")
        s1 += here_s1
        r_after += is_marker(line, "r") and prev_s1
        prev_s1 = here_s1
    return s1, r_after


def bsb_book(book):
    text = open(f"{BSB}/{book}.usfm", encoding="utf-8").read()
    r = Counter(rMarkers=0, dMarkers=0)
    poetic, seen = {}, set()
    chap, verse, style = 0, 0, None
    # tokenise markers in order; a marker is \name followed by space/newline/end
    for m in re.finditer(r"\\([a-z]+\d?)\*?(?:\s+(\d+))?", text):
        name, num = m.group(1), m.group(2)
        if name == "c":
            chap, verse, style = int(num), 0, None  # a chapter starts with no paragraph style
            continue
        if name == "v":
            verse = int(num)
            seen.add((chap, verse))
            poetic.setdefault((chap, verse), False)
            if style in POETIC:
                poetic[(chap, verse)] = True
            continue
        if name in PARA:
            line_start = m.start() == 0 or text[m.start() - 1] == "\n"
            if not line_start:
                continue
            if name == "r":
                r["rMarkers"] += 1
                line = text[m.start():text.find("\n", m.start())]
                r["rRefs"] += len([x for x in re.split(r"[;,]", line[2:].strip(" ()")) if re.search(r"\d", x)])
            if name == "d":
                r["dMarkers"] += 1
            style = name
            if name in POETIC and chap and has_text(text, m.end()):
                if verse == 0:  # chapter text before any \v: implicit verse 1
                    verse = 1
                    seen.add((chap, 1))
                    poetic.setdefault((chap, 1), False)
                poetic[(chap, verse)] = True
    segs = segments(book)
    kinds = Counter()
    for a, b in segs:
        vs = [cv for cv in seen if a <= cv <= b]
        n = sum(poetic.get(cv, False) for cv in vs)
        kinds["segmentsPoetry" if vs and n == len(vs) else "segmentsProse" if n == 0 else "segmentsMixed"] += 1
    r["s1Markers"], r["rAfterS1"] = s1_and_r_after_s1(text)
    out = dict(r)
    out.update(verses=len(seen), poeticVerses=sum(poetic.values()), **kinds)
    return out


def difficulty():
    text = open(f"{SRC}/en_ta/translate/translation-difficulty/01.md", encoding="utf-8").read()
    levels, level = {}, None
    for line in text.split("\n"):
        m = re.match(r"#### Difficulty Level (\d)", line)
        if m:
            level = int(m.group(1))
            levels[level] = 0
            continue
        if line.startswith("### "):
            level = None
        if level and re.match(r"^\s{4}\* ", line) and "(none)" not in line:
            for name in line.strip()[2:].split(","):
                name = name.strip()
                rng = re.match(r"(\d)-(\d) ", name)
                levels[level] += int(rng.group(2)) - int(rng.group(1)) + 1 if rng else 1
    return levels


def ta_lang(repo, used):
    def title(root, i):
        p = f"{root}/translate/{i}/title.md"
        return open(p, encoding="utf-8").read().strip().lstrip("\ufeff") if os.path.exists(p) else None
    out = {}
    # "Used": the figures some note names (20 in v91), as in the doc's language table
    for name, ids in (("", F), ("Strict", set(F_STRICT)), ("Used", set(used))):
        present = [i for i in ids if title(f"{SRC}/{repo}", i) is not None]
        out["present" + name] = len(present)
        out["translated" + name] = sum(title(f"{SRC}/{repo}", i) != title(f"{SRC}/en_ta", i) for i in present)
    return out


def totals(d, distinct_key=None):
    t = Counter()
    for v in d.values():
        if v:
            t.update({k: x for k, x in v.items() if isinstance(x, int) and not k.endswith("Distinct")
                      and k != "maxPerSegment"})
    return dict(t)


tn = {b: tn_book(b) for b in BOOKS}
all_used, all_ws = Counter(), Counter()
for v in tn.values():
    if v:
        all_used.update(v.pop("_used"))
        all_ws.update(v.pop("_ws"))
tn_tot = totals(tn)
tn_tot["fDistinct"] = len(all_used)
tn_tot["strictDistinct"] = len(set(all_used) & set(F_STRICT))
tq = {b: tq_book(b) for b in BOOKS}
bsb = {b: bsb_book(b) for b in BOOKS}
langs = {"en": "en_ta", "ar": "ta_ar_ta", "fr": "ta_fr_ta", "hi": "ta_hi_ta", "id": "ta_id_ta",
         "ru": "ta_ru_ta", "es-419": "ta_es-419_ta"}
json.dump(dict(F_strict=F_STRICT, F_imagery=F_IMAGERY,
               tn=tn, tnTotals=tn_tot, articleRows=dict(all_used.most_common()), F_writing=F_WRITING,
               writingRows=dict(all_ws.most_common()),
               tq=tq, tqTotals=totals(tq), bsb=bsb, bsbTotals=totals(bsb),
               difficulty=difficulty(), taLang={k: ta_lang(v, all_used) for k, v in langs.items()}),
          sys.stdout, indent=1)

# Optional: a per-book TSV beside the JSON (argv[4]).
if len(sys.argv) > 4:
    cols = ["book", "segments", "tn_figure_rows", "tn_figures_distinct", "segments_with_figure",
            "segment_figure_pairs", "bsb_poetry_segments", "bsb_mixed_segments", "bsb_prose_segments",
            "bsb_parallel_ref_lines", "tq_questions"]
    lines = ["\t".join(cols)]
    for b in BOOKS:
        t, q, s = tn[b], tq[b], bsb[b]
        tn_cols = ["", "", "", ""] if t is None else [
            t["strictRows"] + t["imageryRows"], t["fDistinct"], t["segmentsWithF"], t["segmentFPairs"]]
        n = s.get("segmentsPoetry", 0), s.get("segmentsMixed", 0), s.get("segmentsProse", 0)
        lines.append("\t".join(str(x) for x in [b, sum(n), *tn_cols, *n, s["rMarkers"],
                                                 "" if q is None else q["rows"]]))
    open(sys.argv[4], "w", encoding="utf-8").write("\n".join(lines) + "\n")
