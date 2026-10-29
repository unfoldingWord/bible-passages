/**
 * The 66 books in canonical order, each with the number its file has in
 * `Worldview/en_bsb` (`57-TIT.usfm`; 40 is unused there). Every one has its
 * inputs pinned (`scripts/data/pin-structure.ts`).
 */
export const ALL_BOOKS: readonly (readonly [code: string, file: string])[] = [
  ["GEN", "01"],
  ["EXO", "02"],
  ["LEV", "03"],
  ["NUM", "04"],
  ["DEU", "05"],
  ["JOS", "06"],
  ["JDG", "07"],
  ["RUT", "08"],
  ["1SA", "09"],
  ["2SA", "10"],
  ["1KI", "11"],
  ["2KI", "12"],
  ["1CH", "13"],
  ["2CH", "14"],
  ["EZR", "15"],
  ["NEH", "16"],
  ["EST", "17"],
  ["JOB", "18"],
  ["PSA", "19"],
  ["PRO", "20"],
  ["ECC", "21"],
  ["SNG", "22"],
  ["ISA", "23"],
  ["JER", "24"],
  ["LAM", "25"],
  ["EZK", "26"],
  ["DAN", "27"],
  ["HOS", "28"],
  ["JOL", "29"],
  ["AMO", "30"],
  ["OBA", "31"],
  ["JON", "32"],
  ["MIC", "33"],
  ["NAM", "34"],
  ["HAB", "35"],
  ["ZEP", "36"],
  ["HAG", "37"],
  ["ZEC", "38"],
  ["MAL", "39"],
  ["MAT", "41"],
  ["MRK", "42"],
  ["LUK", "43"],
  ["JHN", "44"],
  ["ACT", "45"],
  ["ROM", "46"],
  ["1CO", "47"],
  ["2CO", "48"],
  ["GAL", "49"],
  ["EPH", "50"],
  ["PHP", "51"],
  ["COL", "52"],
  ["1TH", "53"],
  ["2TH", "54"],
  ["1TI", "55"],
  ["2TI", "56"],
  ["TIT", "57"],
  ["PHM", "58"],
  ["HEB", "59"],
  ["JAS", "60"],
  ["1PE", "61"],
  ["2PE", "62"],
  ["1JN", "63"],
  ["2JN", "64"],
  ["3JN", "65"],
  ["JUD", "66"],
  ["REV", "67"],
];

/**
 * Books whose structure (pericopes and segments) and package are built:
 * every book in ALL_BOOKS.
 */
export const STRUCTURE_BOOKS: readonly string[] = ALL_BOOKS.map(([b]) => b);

/**
 * Books whose titles are built so far: one book end to end before the next
 * (AGENTS.md). Every other book has its structure and its book name only,
 * until its titles are built.
 */
export const BOOKS = ["PHP", "TIT"];
