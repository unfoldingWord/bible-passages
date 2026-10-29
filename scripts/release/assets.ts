// Prints the files to attach to release <tag>, one per line, or fails with
// every problem (scripts/lib/release.ts). Called by scripts/release/run.sh.
//
//   node scripts/release/assets.ts <tag> [dir]
import { checkAssets } from "../lib/release.ts";

const [tag, dir = "dist/tc-mobile"] = process.argv.slice(2);
if (!tag) {
  console.error("usage: node scripts/release/assets.ts <tag> [dir]");
  process.exit(2);
}
const { files, problems } = checkAssets(dir, tag);
for (const p of problems) console.error(`::error::${p}`);
if (problems.length > 0) process.exit(1);
for (const f of files) console.log(f);
