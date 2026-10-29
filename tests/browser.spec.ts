import { expect, test, type Locator, type Page } from "playwright/test";

async function focusMath(field: Locator): Promise<void> {
  await field.click();
  await expect
    .poll(() =>
      field.evaluate((element) => {
        const sink = element.shadowRoot?.querySelector(".ML__keyboard-sink");
        let active: Element | null = document.activeElement;
        while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
        return Boolean(sink && active === sink);
      }),
    )
    .toBe(true);
}

async function typeMath(page: Page, field: Locator, text: string): Promise<void> {
  await focusMath(field);
  await page.keyboard.type(text, { delay: 60 });
}

async function latexOf(field: Locator): Promise<string> {
  return field.evaluate((element) => (element as HTMLElement & { value: string }).value);
}

function contrastRatio(foreground: string, background: string): number {
  const parse = (value: string) => {
    const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) throw new Error(`Unparsed color ${value}`);
    const channels = [match[1], match[2], match[3]].map((part) => Number(part) / 255);
    const linear = channels.map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
  };
  const first = parse(foreground);
  const second = parse(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => customElements.get("common-math"));
});

test("typed half plus third calculates to five sixths", async ({ page }) => {
  const scratch = page.locator("common-math.scratchpad");
  const field = scratch.locator("math-field");
  await typeMath(page, field, "1/2");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.type("+1/3", { delay: 60 });
  expect(await latexOf(field)).toContain("\\frac");
  await scratch.locator(".action").fill("calculate");
  await scratch.locator(".action").press("Enter");
  await expect(scratch.locator(".result-math")).toHaveAttribute("data-latex", "\\frac{5}{6}");
  await expect(scratch).toHaveAttribute("data-state", "result");
  await expect(page.locator("#events")).toContainText("common-math:result");
  await expect(page.locator("#events")).toContainText("Scratchpad");
});

test("slash creates a fraction and nested structure stays editable", async ({ page }) => {
  const field = page.locator("common-math.scratchpad math-field");
  await typeMath(page, field, "1/2");
  const fraction = await latexOf(field);
  expect(fraction).toContain("\\frac");
  expect(fraction).toContain("1");
  expect(fraction).toContain("2");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.type("^2", { delay: 40 });
  const nested = await latexOf(field);
  expect(nested).toContain("\\frac");
  expect(nested).toContain("^");
  expect(nested).toContain("2");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Backspace");
  expect(await latexOf(field)).not.toBe(nested);
});

test("a supported derivative returns the verified result", async ({ page }) => {
  const exercise = page.locator("common-math.exercise");
  await exercise.locator(".run").click();
  await expect(exercise.locator(".result-math")).toHaveAttribute("data-latex", "2x");
});

test("palette inserts an integral, a limit, and a matrix", async ({ page }) => {
  const scratch = page.locator("common-math.scratchpad");
  const field = scratch.locator("math-field");
  await focusMath(field);
  await page.keyboard.press("Control+k");
  await scratch.getByRole("option", { name: /Integral/ }).click();
  expect(await latexOf(field)).toContain("\\int");
  expect(await latexOf(field)).toContain("\\placeholder");
  await scratch.locator(".action").fill("calculate");
  await scratch.locator(".run").click();
  await expect(scratch).toHaveAttribute("data-status", "incomplete");

  await field.evaluate((element) => {
    const mathfield = element as HTMLElement & { executeCommand(command: string): boolean };
    mathfield.executeCommand("selectAll");
    mathfield.executeCommand("deleteBackward");
  });
  await page.keyboard.press("Control+k");
  await scratch.getByRole("option", { name: /Limit/ }).click();
  expect(await latexOf(field)).toContain("\\lim");

  await field.evaluate((element) => {
    const mathfield = element as HTMLElement & { executeCommand(command: string): boolean };
    mathfield.executeCommand("selectAll");
    mathfield.executeCommand("deleteBackward");
  });
  await page.keyboard.press("Control+k");
  await scratch.getByRole("option", { name: /Matrix 2×2/ }).click();
  const matrix = await latexOf(field);
  expect(matrix).toContain("pmatrix");
  const before = await field.evaluate((element) => (element as HTMLElement & { position: number }).position);
  await page.keyboard.press("ArrowRight");
  const after = await field.evaluate((element) => (element as HTMLElement & { position: number }).position);
  expect(after).not.toBe(before);
});

test("an unknown action is unsupported and keeps the expression", async ({ page }) => {
  const scratch = page.locator("common-math.scratchpad");
  const field = scratch.locator("math-field");
  await typeMath(page, field, "x+1");
  const before = await latexOf(field);
  await scratch.locator(".action").fill("plot the graph");
  await scratch.locator(".action").press("Enter");
  await expect(scratch).toHaveAttribute("data-state", "unsupported");
  expect(await latexOf(field)).toBe(before);
  await expect(scratch.locator(".note")).toContainText("not an action");
});

test("editing after a result marks that result stale", async ({ page }) => {
  const article = page.locator("common-math.article-math");
  await article.locator(".run").click();
  await expect(article.locator(".result-math")).toHaveAttribute("data-latex", "\\frac{5}{6}");
  const before = await latexOf(article.locator("math-field"));
  await focusMath(article.locator("math-field"));
  await page.keyboard.press("End");
  await page.keyboard.type("+1", { delay: 60 });
  await expect.poll(() => latexOf(article.locator("math-field"))).not.toBe(before);
  await expect(article).toHaveAttribute("data-state", "stale");
  await expect(article.locator(".result-math")).toHaveAttribute("data-latex", "\\frac{5}{6}");
});

test("a late calculation cannot replace a newer result", async ({ page }) => {
  const scratch = page.locator("common-math.scratchpad");
  await scratch.evaluate((element) => {
    const component = element as HTMLElement & { value: string; action: string };
    component.value = "\\sum_{k=1}^{5000000} k";
    component.action = "calculate";
  });
  const slow = scratch.evaluate((element) =>
    (element as HTMLElement & { execute(): Promise<unknown> }).execute(),
  );
  await scratch.evaluate((element) => {
    (element as HTMLElement & { value: string }).value = "1+1";
  });
  await scratch.evaluate((element) =>
    (element as HTMLElement & { execute(): Promise<unknown> }).execute(),
  );
  await expect(scratch.locator(".result-math")).toHaveAttribute("data-latex", "2");
  await slow;
  await page.waitForTimeout(1200);
  await expect(scratch.locator(".result-math")).toHaveAttribute("data-latex", "2");
});

test("two instances stay independent", async ({ page }) => {
  const scratch = page.locator("common-math.scratchpad");
  const article = page.locator("common-math.article-math");
  await typeMath(page, scratch.locator("math-field"), "7");
  expect(await latexOf(article.locator("math-field"))).not.toContain("7");
  await scratch.locator(".action").fill("calculate");
  await scratch.locator(".run").click();
  await expect(scratch.locator(".result-math")).toHaveAttribute("data-latex", "7");
  await expect(article.locator(".result-math")).toBeHidden();
});

test("removing and reinserting does not duplicate change events", async ({ page }) => {
  await page.evaluate(() => {
    const record = window as Window & { __changes?: number };
    record.__changes = 0;
    document.addEventListener("common-math:change", (event) => {
      const target = event.target;
      if (target instanceof Element && target.getAttribute("aria-label") === "Scratchpad") {
        record.__changes = (record.__changes ?? 0) + 1;
      }
    });
  });
  const scratch = page.locator("common-math.scratchpad");
  await scratch.evaluate((element) => {
    const parent = element.parentElement;
    element.remove();
    parent?.append(element);
  });
  await typeMath(page, scratch.locator("math-field"), "q");
  await expect.poll(async () => page.evaluate(() => (window as Window & { __changes?: number }).__changes)).toBe(1);
});

test("shortcuts inside the component do not affect an outside input", async ({ page }) => {
  const outside = page.locator("#outside");
  await outside.click();
  await page.keyboard.press("Control+k");
  await expect(outside).toBeFocused();
  await expect(page.locator("common-math .palette:not([hidden])")).toHaveCount(0);
  await page.keyboard.type("/");
  await expect(outside).toHaveValue("/");
});

test("the exercise card fits a 320px column", async ({ page }) => {
  const card = page.locator(".card");
  const box = await card.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(340);
  const fits = await page.locator("common-math.exercise").evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
  expect(fits).toBe(true);
});

test("light and dark themes stay readable", async ({ page }) => {
  for (const selector of ["common-math.scratchpad", "common-math.exercise"]) {
    const colors = await page.locator(selector).evaluate((element) => {
      const shell = element.shadowRoot?.querySelector(".shell");
      if (!shell) throw new Error("missing shell");
      const style = getComputedStyle(shell);
      return { color: style.color, background: style.backgroundColor };
    });
    expect(contrastRatio(colors.color, colors.background)).toBeGreaterThanOrEqual(4.5);
  }
});

test("undo restores typed mathematics and escape restores focus", async ({ page }) => {
  const scratch = page.locator("common-math.scratchpad");
  const field = scratch.locator("math-field");
  await typeMath(page, field, "ab");
  const typed = await latexOf(field);
  await page.keyboard.press("Control+z");
  expect(await latexOf(field)).not.toBe(typed);
  await page.keyboard.press("Control+k");
  await expect(scratch.locator(".palette")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(scratch.locator(".palette")).toBeHidden();
  await expect
    .poll(() => scratch.evaluate((element) => element.shadowRoot?.activeElement?.tagName.toLowerCase() ?? ""))
    .toBe("math-field");
});

test("tab can leave the component", async ({ page }) => {
  const more = page.locator("common-math.exercise .more");
  await more.focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#outside")).toBeFocused();
});
