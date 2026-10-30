#!/usr/bin/env node
// Metadata sizing for bible-passages #44, script B: an independent re-derivation of
// measure_a.py, written by a second model from a written spec without seeing script A.
// Node 22 ESM, no dependencies.
// Usage: node measure_b.mjs <work-dir> <structure-dir>
//   <work-dir> holds src/ (en_tn, en_tq, en_ta, ta_<lang>_ta clones), bsb/<BOOK>.usfm and out/
import fs from "node:fs";

const ROOT = process.argv[2];
const SRC = `${ROOT}/src`;
const BSB = `${ROOT}/bsb`;
const STRUCT = process.argv[3];
const OUT = `${ROOT}/out/b.json`;

const read = (p) => fs.readFileSync(p, "utf8");
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1];

// ---------- books ----------
const books = fs
  .readdirSync(STRUCT)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.slice(0, -5))
  .sort();
if (books.length !== 66)
  throw new Error("expected 66 books, got " + books.length);
const structure = {};
for (const b of books)
  structure[b] = JSON.parse(read(`${STRUCT}/${b}.json`)).segments;

// ---------- toc.yaml (hand parse) ----------
function parseToc(file) {
  const lines = read(file).split("\n");
  const items = []; // {indent,title,link,hasSections}
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)-\s+title:\s*(.*?)\s*$/);
    if (m) {
      const it = {
        line: i,
        indent: m[1].length,
        title: unq(m[2]),
        link: null,
        hasSections: false,
        end: lines.length,
      };
      // look at following lines belonging to this item (indent > m[1].length)
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j];
        if (/^\s*$/.test(l)) continue;
        const ind = l.match(/^(\s*)/)[1].length;
        if (/^\s*-\s+title:/.test(l) && ind <= it.indent) break;
        if (ind <= it.indent && !/^\s*-/.test(l)) break;
        const lm = l.match(/^\s*link:\s*(.*?)\s*$/);
        if (lm && ind === it.indent + 2 && it.link === null)
          it.link = unq(lm[1]);
        if (/^\s*sections:\s*$/.test(l) && ind === it.indent + 2)
          it.hasSections = true;
      }
      items.push(it);
    }
  }
  return { lines, items };
}
function unq(s) {
  s = s.trim();
  const m = s.match(/^"(.*)"$/) || s.match(/^'(.*)'$/);
  return m ? m[1] : s;
}
function sectionLinks(toc, title) {
  const cands = toc.items.filter(
    (it) => it.title === title && it.hasSections && it.link === null
  );
  if (cands.length !== 1)
    throw new Error(`section "${title}": ${cands.length} candidates`);
  const sec = cands[0];
  const links = [];
  for (let j = sec.line + 1; j < toc.lines.length; j++) {
    const l = toc.lines[j];
    if (/^\s*$/.test(l)) continue;
    const ind = l.match(/^(\s*)/)[1].length;
    if (ind <= sec.indent) break;
    const lm = l.match(/^\s*(?:-\s+)?link:\s*(.*?)\s*$/);
    if (lm) links.push(unq(lm[1]));
  }
  return links;
}
const toc = parseToc(`${SRC}/en_ta/translate/toc.yaml`);
const strictLinks = sectionLinks(toc, "Figures of Speech");
const imageryLinks = sectionLinks(toc, "Biblical Imagery");
const F_strict = new Set(strictLinks.filter((x) => x !== "figs-intro"));
const F_imagery = new Set(
  imageryLinks.filter((x) => x !== "biblicalimageryta")
);
const F = new Set([...F_strict, ...F_imagery]);

// ---------- reference parsing ----------
// returns {kind:'nonverse'} | {kind:'verse', ivs:[[[c,v],[c,v]],...]} | {kind:'unparsed'}
function parseRef(ref) {
  ref = ref.trim();
  if (/^(?:\d+|front):(?:intro|front)$/.test(ref)) return { kind: "nonverse" };
  const m = ref.match(/^(\d+):(.+)$/);
  if (!m) return { kind: "unparsed" };
  const c = +m[1];
  const ivs = [];
  for (const part of m[2].split(",")) {
    let x;
    if ((x = part.match(/^(\d+)$/)))
      ivs.push([
        [c, +x[1]],
        [c, +x[1]],
      ]);
    else if ((x = part.match(/^(\d+)-(\d+)$/)))
      ivs.push([
        [c, +x[1]],
        [c, +x[2]],
      ]);
    else if ((x = part.match(/^(\d+)-(\d+):(\d+)$/)))
      ivs.push([
        [c, +x[1]],
        [+x[2], +x[3]],
      ]);
    else return { kind: "unparsed" };
  }
  for (const [a, b] of ivs)
    if (cmp(a, b) > 0 || a[0] < 1 || a[1] < 1) return { kind: "unparsed" };
  return { kind: "verse", ivs };
}
const overlaps = (iv, seg) =>
  cmp(iv[0], seg.end) <= 0 && cmp(iv[1], seg.start) >= 0;

function tsvRows(file) {
  const lines = read(file)
    .split("\n")
    .map((l) => l.replace(/\r$/, ""));
  const hdr = lines[0].split("\t");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "") continue;
    const f = lines[i].split("\t");
    const o = {};
    hdr.forEach((h, k) => (o[h] = f[k] ?? ""));
    rows.push(o);
  }
  return rows;
}

// ---------- TN ----------
const tn = {};
const tnNumeric = [
  "rows",
  "verseRows",
  "supportRefRows",
  "figsPrefixRows",
  "strictRows",
  "imageryRows",
  "strictDistinct",
  "fDistinct",
  "segments",
  "segmentsWithF",
  "segmentFPairs",
  "unparsedRefs",
];
const allStrict = new Set(),
  allF = new Set();
for (const b of books) {
  const file = `${SRC}/en_tn/tn_${b}.tsv`;
  if (!fs.existsSync(file)) {
    tn[b] = null;
    continue;
  }
  const rows = tsvRows(file);
  const segs = structure[b];
  const r = {
    rows: rows.length,
    verseRows: 0,
    supportRefRows: 0,
    figsPrefixRows: 0,
    strictRows: 0,
    imageryRows: 0,
    strictDistinct: 0,
    fDistinct: 0,
    segments: segs.length,
    segmentsWithF: 0,
    segmentFPairs: 0,
    unparsedRefs: 0,
  };
  const sD = new Set(),
    fD = new Set();
  const segArts = segs.map(() => new Set());
  for (const row of rows) {
    const p = parseRef(row.Reference);
    if (p.kind === "nonverse") continue;
    if (p.kind === "unparsed") {
      r.unparsedRefs++;
      continue;
    }
    r.verseRows++;
    const sr = (row.SupportReference || "").trim();
    if (sr === "") continue;
    r.supportRefRows++;
    const art = sr
      .split("/")
      .filter((s) => s !== "")
      .pop();
    if (art.startsWith("figs-")) r.figsPrefixRows++;
    const isS = F_strict.has(art),
      isI = F_imagery.has(art);
    if (isS) {
      r.strictRows++;
      sD.add(art);
    }
    if (isI) r.imageryRows++;
    if (isS || isI) {
      fD.add(art);
      segs.forEach((s, i) => {
        if (p.ivs.some((iv) => overlaps(iv, s))) segArts[i].add(art);
      });
    }
  }
  r.strictDistinct = sD.size;
  r.fDistinct = fD.size;
  for (const s of segArts) {
    if (s.size > 0) r.segmentsWithF++;
    r.segmentFPairs += s.size;
  }
  sD.forEach((x) => allStrict.add(x));
  fD.forEach((x) => allF.add(x));
  tn[b] = r;
}
const tnTotals = Object.fromEntries(tnNumeric.map((k) => [k, 0]));
for (const b of books)
  if (tn[b]) for (const k of tnNumeric) tnTotals[k] += tn[b][k];
tnTotals.strictDistinct = allStrict.size;
tnTotals.fDistinct = allF.size;
tnTotals.booksWithFile = books.filter((b) => tn[b]).length;
tn.totals = tnTotals;

// ---------- TQ ----------
const tq = {};
const tqNumeric = ["rows", "verseRows", "segmentsWithQuestion", "unparsedRefs"];
for (const b of books) {
  const file = `${SRC}/en_tq/tq_${b}.tsv`;
  if (!fs.existsSync(file)) {
    tq[b] = null;
    continue;
  }
  const rows = tsvRows(file);
  const segs = structure[b];
  const r = {
    rows: rows.length,
    verseRows: 0,
    segmentsWithQuestion: 0,
    unparsedRefs: 0,
  };
  const has = segs.map(() => false);
  for (const row of rows) {
    const p = parseRef(row.Reference);
    if (p.kind === "nonverse") continue;
    if (p.kind === "unparsed") {
      r.unparsedRefs++;
      continue;
    }
    r.verseRows++;
    segs.forEach((s, i) => {
      if (!has[i] && p.ivs.some((iv) => overlaps(iv, s))) has[i] = true;
    });
  }
  r.segmentsWithQuestion = has.filter(Boolean).length;
  tq[b] = r;
}
const tqTotals = Object.fromEntries(tqNumeric.map((k) => [k, 0]));
for (const b of books)
  if (tq[b]) for (const k of tqNumeric) tqTotals[k] += tq[b][k];
tqTotals.booksWithFile = books.filter((b) => tq[b]).length;
tq.totals = tqTotals;

// ---------- BSB ----------
const PARA = new Set([
  "m",
  "q1",
  "q2",
  "qr",
  "qa",
  "li",
  "li1",
  "li2",
  "pmo",
  "pc",
  "d",
  "s1",
  "s2",
  "r",
  "ms",
  "mr",
]);
const POETIC = new Set(["q1", "q2", "qr"]);
const NONTEXT = new Set(["s1", "s2", "r", "ms", "mr", "d", "qa"]); // heading-type markers: text under them is not verse text
const TOK =
  /\\(c|v|m|q1|q2|qr|qa|li1|li2|li|pmo|pc|d|s1|s2|r|ms|mr|b)(?![a-z0-9])(?:[ \t]+(\d+))?/g;
const bsb = {};
const bsbNumeric = [
  "rMarkers",
  "rAfterS1",
  "s1Markers",
  "dMarkers",
  "verses",
  "poeticVerses",
  "poeticVersesStartOnly",
  "poeticVersesText",
  "segmentsPoetryText",
  "segmentsProseText",
  "segmentsMixedText",
  "segmentsPoetry",
  "segmentsProse",
  "segmentsMixed",
  "segmentsNoBsbVerses",
  "implicitVerse1Chapters",
  "implicitButFirstVIs1",
];
for (const b of books) {
  const lines = read(`${BSB}/${b}.usfm`)
    .split("\n")
    .map((l) => l.replace(/\r$/, ""));
  const r = Object.fromEntries(bsbNumeric.map((k) => [k, 0]));
  const verses = new Map(); // "c:v" -> {c,v,poetic,start}
  let chap = 0,
    cur = null,
    curV = null,
    pre = null,
    pendQ = null;
  const hasWords = (t) =>
    /[\p{L}\p{N}]/u.test(
      t.replace(/\|[^\\]*/g, "").replace(/\\[a-z0-9+-]*\*?/g, "")
    );
  const textSeen = (t) => {
    if (pendQ && hasWords(t)) {
      pendQ.poeticText = true;
      pendQ = null;
    }
  }; // pre = provisional implicit verse
  const finishChapterStart = (firstVNum) => {
    if (pre) {
      pre.poeticText = pre.poetic;
      if (pre.content) {
        if (firstVNum !== 1) {
          verses.set(`${pre.c}:1`, pre);
          r.implicitVerse1Chapters++;
        } else r.implicitButFirstVIs1++;
      }
      pre = null;
    }
  };
  // \r lines whose previous line, skipping \b and blank lines, is \s1
  let prevMarker = null;
  for (const line of lines) {
    if (/^\\s1(\s|$)/.test(line)) r.s1Markers++;
    if (/^\\r(\s|$)/.test(line) && prevMarker === "s1") r.rAfterS1++;
    if (line.trim() !== "" && !/^\\b(\s|$)/.test(line))
      prevMarker = (line.match(/^\\([a-z]+\d?)/) || [])[1] ?? null;
  }
  for (const line of lines) {
    if (/^\\r(\s|$)/.test(line)) r.rMarkers++;
    if (/^\\d(\s|$)/.test(line)) r.dMarkers++;
    let rest = line,
      textStart = 0;
    let m;
    TOK.lastIndex = 0;
    let sawTok = false;
    const toks = [];
    while ((m = TOK.exec(line)))
      toks.push({ name: m[1], num: m[2], idx: m.index, end: TOK.lastIndex });
    // content before first token on a line (continuation text)
    let contentHere = false;
    const markContent = (txt) => {
      if (txt.trim() !== "" && pre && cur !== null && !NONTEXT.has(cur))
        pre.content = true;
    };
    if (toks.length === 0) {
      markContent(line);
      textSeen(line);
      continue;
    }
    markContent(line.slice(0, toks[0].idx));
    textSeen(line.slice(0, toks[0].idx));
    for (let t = 0; t < toks.length; t++) {
      const tk = toks[t];
      const seg = line.slice(
        tk.end,
        t + 1 < toks.length ? toks[t + 1].idx : line.length
      );
      if (tk.name === "c") {
        finishChapterStart(Infinity);
        chap = +tk.num;
        cur = null;
        curV = null;
        pendQ = null;
        pre = {
          c: chap,
          v: 1,
          poetic: false,
          startPoetic: false,
          content: false,
        };
        curV = pre;
      } else if (tk.name === "v") {
        const n = +tk.num;
        if (pre) {
          finishChapterStart(n);
        }
        const key = `${chap}:${n}`;
        pendQ = null;
        const v = verses.get(key) || {
          c: chap,
          v: n,
          poetic: false,
          startPoetic: false,
          poeticText: false,
        };
        const startP = cur !== null && POETIC.has(cur);
        if (startP) {
          v.poetic = true;
          v.startPoetic = true;
          v.poeticText = true;
        }
        verses.set(key, v);
        curV = v;
      } else if (tk.name === "b") {
        // changes nothing
      } else if (PARA.has(tk.name)) {
        cur = tk.name;
        pendQ = POETIC.has(cur) && curV && curV !== pre ? curV : null;
        if (POETIC.has(cur) && curV) curV.poetic = true;
      }
      if (tk.name !== "c" && tk.name !== "v") {
        markContent(seg);
        textSeen(seg);
      } else if (tk.name === "v") {
        /* text after \v belongs to verse */
      }
    }
  }
  finishChapterStart(Infinity);
  const vlist = [...verses.values()];
  r.verses = vlist.length;
  r.poeticVerses = vlist.filter((v) => v.poetic).length;
  r.poeticVersesText = vlist.filter((v) => v.poeticText).length;
  r.poeticVersesStartOnly = vlist.filter((v) => v.startPoetic).length;
  for (const s of structure[b]) {
    const inSpan = vlist.filter(
      (v) => cmp([v.c, v.v], s.start) >= 0 && cmp([v.c, v.v], s.end) <= 0
    );
    if (inSpan.length === 0) {
      r.segmentsNoBsbVerses++;
      continue;
    }
    const p = inSpan.filter((v) => v.poetic).length;
    if (p === inSpan.length) r.segmentsPoetry++;
    else if (p === 0) r.segmentsProse++;
    else r.segmentsMixed++;
    const pt = inSpan.filter((v) => v.poeticText).length;
    if (pt === inSpan.length) r.segmentsPoetryText++;
    else if (pt === 0) r.segmentsProseText++;
    else r.segmentsMixedText++;
  }
  bsb[b] = r;
}
const bsbTotals = Object.fromEntries(bsbNumeric.map((k) => [k, 0]));
for (const b of books) for (const k of bsbNumeric) bsbTotals[k] += bsb[b][k];
bsb.totals = bsbTotals;

// ---------- difficulty ----------
const difficulty = {};
{
  const lines = read(
    `${SRC}/en_ta/translate/translation-difficulty/01.md`
  ).split("\n");
  let level = null;
  for (let l of lines) {
    const h = l.match(/^#{1,6}\s+Difficulty Level (\d)/);
    if (h) {
      level = h[1];
      difficulty[level] = 0;
      continue;
    }
    if (/^#{1,6}\s/.test(l)) {
      level = null;
      continue;
    }
    if (level === null) continue;
    const m = l.match(/^\s+\*\s+(.+?)\s*$/); // nested bullet = book list (top-level bullets are OT / NT)
    if (!m || m[1] === "(none)") continue;
    for (const item of m[1]
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)) {
      const r = item.match(/^(\d)-(\d)\s+\S/);
      difficulty[level] += r ? +r[2] - +r[1] + 1 : 1;
    }
  }
  for (let i = 1; i <= 5; i++) difficulty[i] ??= 0;
}

// ---------- TA languages ----------
const taLang = {};
// "Used": the figures some note names (allF), as in the doc's language table
const readTitle = (dir, id) => {
  const f = `${dir}/translate/${id}/title.md`;
  return fs.existsSync(f) ? read(f).trim() : null;
};
const enDir = `${SRC}/en_ta`;
for (const lang of ["en", "ar", "fr", "hi", "id", "ru", "es-419"]) {
  const dir = lang === "en" ? enDir : `${SRC}/ta_${lang}_ta`;
  const o = {
    present: 0,
    translated: 0,
    presentStrict: 0,
    translatedStrict: 0,
    of: F.size,
    ofStrict: F_strict.size,
    presentUsed: 0,
    translatedUsed: 0,
    ofUsed: allF.size,
  };
  for (const id of F) {
    const t = readTitle(dir, id);
    if (t === null) continue;
    const tr = t !== readTitle(enDir, id);
    o.present++;
    if (tr) o.translated++;
    if (F_strict.has(id)) {
      o.presentStrict++;
      if (tr) o.translatedStrict++;
    }
    if (allF.has(id)) {
      o.presentUsed++;
      if (tr) o.translatedUsed++;
    }
  }
  taLang[lang] = o;
}

const out = {
  F: {
    strict: [...F_strict],
    imagery: [...F_imagery],
    strictCount: F_strict.size,
    imageryCount: F_imagery.size,
    unionCount: F.size,
    overlap: [...F_strict].filter((x) => F_imagery.has(x)),
  },
  tn,
  tq,
  bsb,
  difficulty,
  taLang,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

// ---------- summary ----------
console.log(
  `F_strict=${F_strict.size} F_imagery=${F_imagery.size} |F|=${F.size} overlap=${out.F.overlap.length}`
);
console.log(
  "book  tnRows verseRows strictRows imgRows segs segF pairs | tqRows segQ | bsbV poetic segPo/Pr/Mx"
);
for (const b of books) {
  const t = tn[b],
    q = tq[b],
    s = bsb[b];
  console.log(
    [
      b.padEnd(4),
      t
        ? `${t.rows} ${t.verseRows} ${t.strictRows} ${t.imageryRows} ${t.segments} ${t.segmentsWithF} ${t.segmentFPairs}`
        : "null",
      "|",
      q ? `${q.rows} ${q.segmentsWithQuestion}` : "null",
      "|",
      `${s.verses} ${s.poeticVerses} ${s.segmentsPoetry}/${s.segmentsProse}/${s.segmentsMixed}`,
    ].join(" ")
  );
}
console.log("tn totals", JSON.stringify(tn.totals));
console.log("tq totals", JSON.stringify(tq.totals));
console.log("bsb totals", JSON.stringify(bsb.totals));
console.log("difficulty", JSON.stringify(difficulty));
for (const [l, o] of Object.entries(taLang))
  console.log("taLang", l, JSON.stringify(o));
