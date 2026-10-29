import { describe, expect, it } from "vitest";
import { runOperation } from "../src/engine/run";

const timeoutMs = 8000;

describe("Compute Engine adapter", () => {
  it("adds one half and one third as exactly five sixths", async () => {
    const result = await runOperation({
      latex: "\\frac{1}{2}+\\frac{1}{3}",
      operation: { kind: "calculate" },
      timeoutMs,
    });
    expect(result.status).toBe("success");
    expect(result.resultLatex).toBe("\\frac{5}{6}");
    expect(result.approximate).toBeUndefined();
  });

  it("differentiates x^2 with respect to x", async () => {
    const result = await runOperation({
      latex: "x^2",
      operation: { kind: "differentiate", variable: "x" },
      timeoutMs,
    });
    expect(result.status).toBe("success");
    expect(result.resultLatex).toBe("2x");
    expect(result.interpretedLatex).toContain("\\mathrm{d}");
  });

  it("does not differentiate an existing derivative a second time", async () => {
    const result = await runOperation({
      latex: "\\frac{d}{dx} x^2",
      operation: { kind: "differentiate", variable: "x" },
      timeoutMs,
    });
    expect(result.status).toBe("success");
    expect(result.resultLatex).toBe("2x");
  });

  it("evaluates a written definite integral without wrapping it again", async () => {
    const result = await runOperation({
      latex: "\\int_0^1 x \\, dx",
      operation: { kind: "integrate", variable: "x" },
      timeoutMs,
    });
    expect(result.status).toBe("success");
    expect(result.resultLatex).toBe("\\frac{1}{2}");
    expect(result.message).toMatch(/already an integral/i);
  });

  it("integrates x^2 from 0 to 1 when asked", async () => {
    const result = await runOperation({
      latex: "x^2",
      operation: { kind: "integrate", variable: "x", from: "0", to: "1" },
      timeoutMs,
    });
    expect(result.status).toBe("success");
    expect(result.resultLatex).toBe("\\frac{1}{3}");
  });

  it("returns an antiderivative without calling it a definite value", async () => {
    const result = await runOperation({
      latex: "x^2",
      operation: { kind: "integrate", variable: "x" },
      timeoutMs,
    });
    expect(result.status).toBe("success");
    expect(result.resultLatex).toBe("\\frac{x^3}{3}");
    expect(result.restrictions?.join(" ")).toMatch(/constant of integration/i);
  });

  it("evaluates a limit the engine can close, and reports one it cannot", async () => {
    const closed = await runOperation({
      latex: "\\frac{\\sin x}{x}",
      operation: { kind: "limit", variable: "x", to: "0" },
      timeoutMs,
    });
    expect(closed.status).toBe("success");
    expect(closed.resultLatex).toBe("1");

    const open = await runOperation({
      latex: "\\lim_{x\\to 0} \\frac{1}{x}",
      operation: { kind: "calculate" },
      timeoutMs,
    });
    expect(open.status).toBe("unevaluated");
    expect(open.resultLatex).toMatch(/\\lim/);
  });

  it("simplifies an unchanged expression successfully and notes cancelled factors", async () => {
    const same = await runOperation({
      latex: "2x+1",
      operation: { kind: "simplify" },
      timeoutMs,
    });
    expect(same.status).toBe("success");
    expect(same.resultLatex).toBe("2x+1");

    const cancelled = await runOperation({
      latex: "\\frac{x^2-1}{x-1}",
      operation: { kind: "simplify" },
      timeoutMs,
    });
    expect(cancelled.status).toBe("success");
    expect(cancelled.resultLatex).toBe("x+1");
    expect(cancelled.restrictions?.join(" ")).toMatch(/excluded points/i);
  });

  it("expands a square", async () => {
    const result = await runOperation({
      latex: "(a+b)^2",
      operation: { kind: "expand" },
      timeoutMs,
    });
    expect(result.status).toBe("success");
    expect(result.resultLatex).toContain("a^2");
    expect(result.resultLatex).toContain("b^2");
    expect(result.resultLatex).toContain("2ab");
  });

  it("approximates an exact radical and refuses to invent a value for x", async () => {
    const radical = await runOperation({
      latex: "\\sqrt{2}",
      operation: { kind: "approximate" },
      timeoutMs,
    });
    expect(radical.status).toBe("success");
    expect(radical.approximate).toBe(true);
    expect(radical.resultLatex).toMatch(/1\.414/);

    const symbolic = await runOperation({
      latex: "x+1",
      operation: { kind: "approximate" },
      timeoutMs,
    });
    expect(symbolic.status).toBe("unevaluated");
    expect(symbolic.approximate).toBeUndefined();
    expect(symbolic.resultLatex).toBeUndefined();
  });

  it("solves x^2-1=0 and reports an empty solution honestly", async () => {
    const solved = await runOperation({
      latex: "x^2-1=0",
      operation: { kind: "solve", variable: "x" },
      timeoutMs,
    });
    expect(solved.status).toBe("success");
    expect(solved.resultLatex).toContain("1");
    expect(solved.resultLatex).toContain("-1");

    const none = await runOperation({
      latex: "x+1=x",
      operation: { kind: "solve", variable: "x" },
      timeoutMs,
    });
    expect(none.status).toBe("success");
    expect(none.message).toMatch(/no solution/i);
    expect(none.resultLatex).toBeUndefined();
  });

  it("computes a determinant and an exact inverse", async () => {
    const matrix = "\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}";
    const determinant = await runOperation({
      latex: matrix,
      operation: { kind: "determinant" },
      timeoutMs,
    });
    expect(determinant.status).toBe("success");
    expect(determinant.resultLatex).toBe("-2");

    const inverse = await runOperation({
      latex: "\\begin{pmatrix} 2 & 1 \\\\ 1 & 3 \\end{pmatrix}",
      operation: { kind: "inverse" },
      timeoutMs,
    });
    expect(inverse.status).toBe("success");
    expect(inverse.resultLatex).toContain("\\begin{pmatrix}");
    expect(inverse.resultLatex).toContain("\\frac{3}{5}");
  });

  it("rejects a non-square determinant and leaves a singular inverse unevaluated", async () => {
    const rectangular = await runOperation({
      latex: "\\begin{pmatrix} 1 & 2 & 3 \\\\ 4 & 5 & 6 \\end{pmatrix}",
      operation: { kind: "determinant" },
      timeoutMs,
    });
    expect(rectangular.status).toBe("invalid");
    expect(rectangular.resultLatex).toBeUndefined();

    const singular = await runOperation({
      latex: "\\begin{pmatrix} 1 & 2 \\\\ 2 & 4 \\end{pmatrix}",
      operation: { kind: "inverse" },
      timeoutMs,
    });
    expect(singular.status).toBe("unevaluated");
  });

  it("does not answer an incomplete or invalid expression", async () => {
    const incomplete = await runOperation({
      latex: "\\frac{\\placeholder{}}{2}",
      operation: { kind: "calculate" },
      timeoutMs,
    });
    expect(incomplete.status).toBe("incomplete");
    expect(incomplete.resultLatex).toBeUndefined();

    const invalid = await runOperation({
      latex: "\\frac{1}{2}+",
      operation: { kind: "calculate" },
      timeoutMs,
    });
    expect(invalid.status).toBe("invalid");
    expect(invalid.resultLatex).toBeUndefined();
  });

  it("stops a long sum at the time limit", async () => {
    const result = await runOperation({
      latex: "\\sum_{k=1}^{5000000} k",
      operation: { kind: "calculate" },
      timeoutMs: 40,
    });
    expect(result.status).toBe("timeout");
    expect(result.resultLatex).toBeUndefined();
  });

  it("does not start work that has already been cancelled", async () => {
    const signal = new AbortController();
    signal.abort();
    const result = await runOperation({
      latex: "1+1",
      operation: { kind: "calculate" },
      timeoutMs,
      signal: signal.signal,
    });
    expect(result.status).toBe("cancelled");
  });
});
