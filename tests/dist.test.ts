import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
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

  it.todo("every key appears in data/structure and nowhere else in dist");
});
