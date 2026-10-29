import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: "demo",
  base: "./",
  build: {
    outDir: "../dist-demo",
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    fs: {
      allow: [resolve(".")],
    },
  },
});
