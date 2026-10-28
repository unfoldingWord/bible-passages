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
  },
});
