import { cp, mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const typecheck = spawnSync("npx", ["tsc", "-p", "tsconfig.build.json"], {
  stdio: "inherit",
  shell: false,
});
if (typecheck.status !== 0) process.exit(typecheck.status ?? 1);

await cp("node_modules/mathlive/fonts", "dist/fonts", { recursive: true });
await mkdir("dist/nested", { recursive: true });
await writeFile(
  "dist/nested/index.html",
  `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Nested package embed</title>
    <link rel="stylesheet" href="../common-math.css" />
  </head>
  <body>
    <p>Built component, served from a nested path.</p>
    <common-math value="\\frac{1}{2}+\\frac{1}{3}" action="calculate" aria-label="Packaged"></common-math>
    <script type="module" src="../common-math.js"></script>
  </body>
</html>
`,
);
