import { spawn, type ChildProcess } from "node:child_process";
import { expect, test } from "playwright/test";

let server: ChildProcess | undefined;

test.beforeAll(async () => {
  server = spawn("python3", ["-m", "http.server", "4174", "--directory", "dist", "--bind", "127.0.0.1"], {
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:4174/nested/index.html");
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("The packaged nested page did not start.");
});

test.afterAll(() => {
  server?.kill();
});

test("the built module calculates from a nested path", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4174/nested/index.html");
  const component = page.locator("common-math");
  await expect(component).toBeVisible();
  await component.locator(".run").click();
  await expect(component.locator(".result-math")).toHaveAttribute("data-latex", "\\frac{5}{6}", {
    timeout: 30_000,
  });
  expect(errors).toEqual([]);
});
