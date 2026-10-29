import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Structure } from "../scripts/lib/structure.ts";
import type { TemplatePackage } from "../vendor/tc-mobile/template";
import {
  parseTemplatePackage,
  parseTemplateTitleTable,
} from "../vendor/tc-mobile/validate";

// dist/tc-mobile/<BOOK>.json are packages; dist/tc-mobile/titles/<lang>/<BOOK>.json
// are title tables. See docs/schema.md.
const dist = fileURLToPath(new URL("../dist/tc-mobile/", import.meta.url));

function jsonFiles(dir: string): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true, recursive: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".json"))
    .map((e) => join(e.parentPath, e.name));
}

const read = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
const titleDir = join(dist, "titles");
const tableFiles = jsonFiles(titleDir);
const packageFiles = jsonFiles(dist).filter((f) => !f.startsWith(titleDir));

describe("dist/tc-mobile", () => {
  const packages = new Map<string, TemplatePackage>();

  it.each(packageFiles)("package %s passes tc-mobile's checker", (file) => {
    const pkg = parseTemplatePackage(read(file));
    expect(packages.has(pkg.id), `duplicate package id ${pkg.id}`).toBe(false);
    packages.set(pkg.id, pkg);
  });

  it.each(tableFiles)("title table %s passes against its package", (file) => {
    const table = read(file) as { packageId?: unknown };
    const pkg = packages.get(String(table.packageId));
    expect(
      pkg,
      `no package for packageId ${String(table.packageId)}`
    ).toBeDefined();
    parseTemplateTitleTable(table, pkg as TemplatePackage);
  });

  // Chapter keys are `<BOOK>.<c>`; segment keys come from data/structure.
  it("every key appears in data/structure and nowhere else in dist", () => {
    const seen = new Map<string, string>();
    for (const file of packageFiles) {
      const pkg = parseTemplatePackage(read(file));
      const book = String(pkg.bookCode);
      const structure = read(
        fileURLToPath(
          new URL(`../data/structure/${book}.json`, import.meta.url)
        )
      ) as Structure;
      const segments = new Set(structure.segments.map((s) => s.key));
      const chapters = new Set(
        structure.segments.map((s) => `${book}.${s.start[0]}`)
      );
      for (const chapter of pkg.chapters) {
        const keys = [chapter.key, ...chapter.segments.map((s) => s.key)];
        expect(chapters.has(chapter.key), `${file}: ${chapter.key}`).toBe(true);
        for (const s of chapter.segments)
          expect(segments.has(s.key), `${file}: ${s.key}`).toBe(true);
        for (const key of keys) {
          expect(seen.get(key), `${key} is in two places`).toBeUndefined();
          seen.set(key, file);
        }
      }
    }
    expect(seen.size).toBeGreaterThan(0);
    // A title table adds no key: each is a segment key from data/structure.
    for (const file of tableFiles) {
      const table = read(file) as { segments: Record<string, string> };
      for (const key of Object.keys(table.segments))
        expect(seen.has(key), `${file}: ${key} is in no package`).toBe(true);
    }
  });

  // Re-derived from data/ here, apart from scripts/data/dist.ts: which tables
  // exist and what each holds. Shipped statuses are ai-checked and above;
  // unreviewed titles stay out (docs/schema.md, dist/tc-mobile/titles/).
  it("title tables are exactly the shippable segment titles in data/titles", () => {
    const shipped = ["ai-checked", "human-reviewed", "approved"];
    const expected = new Map<string, Record<string, string>>();
    for (const file of packageFiles) {
      const pkg = read(file) as {
        bookCode: string;
        titleLanguages: string[];
        chapters: { segments: { key: string }[] }[];
      };
      const keys = pkg.chapters.flatMap((c) => c.segments.map((s) => s.key));
      for (const lang of pkg.titleLanguages) {
        const path = fileURLToPath(
          new URL(
            `../data/titles/${lang}/${pkg.bookCode}.json`,
            import.meta.url
          )
        );
        if (!existsSync(path)) continue;
        const data = read(path) as {
          titles: Record<string, { text: string; status: string }>;
        };
        const segments = Object.fromEntries(
          keys
            .filter((k) => shipped.includes(data.titles[k]?.status ?? ""))
            .map((k) => [k, data.titles[k]!.text])
        );
        if (Object.keys(segments).length > 0)
          expected.set(`${lang}/${pkg.bookCode}.json`, segments);
      }
    }
    const actual = new Map(
      tableFiles.map((f) => {
        const t = read(f) as {
          chapters: object;
          segments: Record<string, string>;
        };
        expect(t.chapters, f).toEqual({});
        expect(
          Object.keys(t.segments).filter((k) => k.includes(".P.")),
          `${f}: pericope keys`
        ).toEqual([]);
        return [relative(titleDir, f), t.segments];
      })
    );
    expect(actual).toEqual(expected);
    // Measured at the commit that added tables: English Titus, all 25
    // segments (19 ai-checked, 6 human-reviewed); 8 unreviewed pericope
    // titles left out.
    expect([...actual.keys()]).toContain("en/TIT.json");
    expect(Object.keys(actual.get("en/TIT.json") ?? {})).toHaveLength(25);
  });
});
