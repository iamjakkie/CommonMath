import { resolve } from "node:path";
import { defineConfig } from "vite";

/** One Node module for `common-math/engine`. The browser build stays separate. */
export default defineConfig({
  build: {
    outDir: "engine-dist",
    emptyOutDir: true,
    ssr: true,
    lib: {
      entry: resolve("src/engine-api.ts"),
      formats: ["es"],
      fileName: "engine",
    },
    rolldownOptions: {
      external: ["@cortex-js/compute-engine"],
    },
  },
});
