import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: resolve("src/index.ts"),
      formats: ["es"],
      fileName: "common-math",
      cssFileName: "common-math",
    },
    rolldownOptions: {
      output: {
        codeSplitting: true,
      },
    },
  },
});
