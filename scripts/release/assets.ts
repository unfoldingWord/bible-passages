// Prints the files to attach to release <tag>, one per line as
// "<asset name><TAB><file>", or fails with every problem
// (scripts/lib/release.ts). Called by scripts/release/run.sh, which attaches
// each file under its asset name.
//
//   node scripts/release/assets.ts <tag> [dir]
import { checkAssets, escapeCommandData } from "../lib/release.ts";

const [tag, dir = "dist/tc-mobile"] = process.argv.slice(2);
if (!tag) {
  console.error("usage: node scripts/release/assets.ts <tag> [dir]");
  process.exit(2);
}
const { assets, problems } = checkAssets(dir, tag);
// One "::error::" line per problem, encoded so the runner decodes it back
// to the problem rather than splitting it.
for (const p of problems) console.error(`::error::${escapeCommandData(p)}`);
if (problems.length > 0) process.exit(1);
for (const { name, file } of assets) console.log(`${name}\t${file}`);
