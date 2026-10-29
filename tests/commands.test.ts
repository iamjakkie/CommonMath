import { describe, expect, it } from "vitest";
import { parseAction } from "../src/commands/parse-action";
import { suggestCommands } from "../src/commands/suggest";

describe("parseAction", () => {
  it("parses the exact commands", () => {
    expect(parseAction("calculate")).toMatchObject({ ok: true, operation: { kind: "calculate" } });
    expect(parseAction("Approximate")).toMatchObject({ ok: true, operation: { kind: "approximate" } });
    expect(parseAction("simplify")).toMatchObject({ ok: true, operation: { kind: "simplify" } });
    expect(parseAction("expand")).toMatchObject({ ok: true, operation: { kind: "expand" } });
    expect(parseAction("differentiate x")).toMatchObject({
      ok: true,
      operation: { kind: "differentiate", variable: "x" },
    });
    expect(parseAction("solve for y")).toMatchObject({
      ok: true,
      operation: { kind: "solve", variable: "y" },
    });
    expect(parseAction("integrate x")).toMatchObject({
      ok: true,
      operation: { kind: "integrate", variable: "x" },
    });
    expect(parseAction("integrate x from 0 to 1")).toMatchObject({
      ok: true,
      operation: { kind: "integrate", variable: "x", from: "0", to: "1" },
    });
    expect(parseAction("integrate t from -1 to pi")).toMatchObject({
      ok: true,
      operation: { kind: "integrate", variable: "t", from: "-1", to: "\\pi" },
    });
    expect(parseAction("limit x to 0")).toMatchObject({
      ok: true,
      operation: { kind: "limit", variable: "x", to: "0" },
    });
    expect(parseAction("determinant")).toMatchObject({ ok: true, operation: { kind: "determinant" } });
    expect(parseAction("inverse")).toMatchObject({ ok: true, operation: { kind: "inverse" } });
  });

  it("asks for missing parameters instead of guessing", () => {
    expect(parseAction("")).toMatchObject({ ok: false, status: "missing-parameters" });
    expect(parseAction("differentiate")).toMatchObject({ ok: false, status: "missing-parameters" });
    expect(parseAction("integrate")).toMatchObject({ ok: false, status: "missing-parameters" });
    expect(parseAction("integrate x from 0")).toMatchObject({ ok: false, status: "missing-parameters" });
    expect(parseAction("limit x")).toMatchObject({ ok: false, status: "missing-parameters" });
    expect(parseAction("solve")).toMatchObject({ ok: false, status: "missing-parameters" });
  });

  it("rejects unknown text and extra words", () => {
    expect(parseAction("please calculate")).toMatchObject({ ok: false, status: "unsupported" });
    expect(parseAction("calculate now")).toMatchObject({ ok: false, status: "unsupported" });
    expect(parseAction("differentiate theta")).toMatchObject({ ok: false, status: "missing-parameters" });
  });
});

describe("suggestCommands", () => {
  it("filters by the typed prefix and keeps disabled commands hidden", () => {
    const labels = suggestCommands("diff").map((command) => command.label);
    expect(labels).toContain("differentiate x");
    expect(labels.every((label) => label.includes("diff") || label.startsWith("d"))).toBe(true);
    expect(suggestCommands("").every((command) => command.enabled)).toBe(true);
  });
});
