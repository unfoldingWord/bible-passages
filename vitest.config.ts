import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // The vendored validator imports its types by tc-mobile's own path, so
      // the vendored files stay byte-identical to the pinned commit.
      "@/types/template": fileURLToPath(
        new URL("./vendor/tc-mobile/template.ts", import.meta.url)
      ),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // Fills .cache/sources/ before any test, so no test downloads.
    globalSetup: ["tests/global-setup.ts"],
    // At most four test files at once, as on a CI runner, rather than one
    // per core. With several suites on one host, a worker per core each
    // left every test a sliver of CPU and tests timed out; four kept the
    // slowest test under 2 s with eighteen suites at once, at no cost to a
    // lone run (issue #111).
    maxWorkers: 4,
  },
});
