import { CancellationError, ComputeEngine } from "@cortex-js/compute-engine";
import type { Operation } from "../commands/operation";
import type { OutcomeStatus } from "../types/public";
import {
  containsHead,
  findErrorCode,
  isIndefiniteIntegral,
  isIndeterminate,
  isNothing,
  isNumericJson,
  isRectangularMatrix,
  jsonHead,
} from "./json";

export interface EngineRequest {
  latex: string;
  operation: Operation;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface EngineResult {
  status: OutcomeStatus;
  resultLatex?: string;
  interpretedLatex?: string;
  approximate?: boolean;
  message?: string;
  restrictions?: string[];
}

interface Prepared {
  expr: import("@cortex-js/compute-engine").Expression;
  mode: "evaluate" | "simplify" | "solve";
  interpretedLatex?: string;
  message?: string;
  restrictions?: string[];
  approximate?: boolean;
}

const UNRESOLVED = new Set([
  "Integrate",
  "Limit",
  "D",
  "Derivative",
  "Inverse",
  "Determinant",
  "Expand",
  "ExpandAll",
]);

/**
 * Run one operation on a new Compute Engine.
 * Free functions are not used: they share a process-wide engine.
 * `compile()` is not used: it builds JavaScript functions.
 */
export async function runOperation(request: EngineRequest): Promise<EngineResult> {
  if (request.signal?.aborted) {
    return { status: "cancelled", message: "Cancelled." };
  }
  const latex = request.latex.trim();
  if (!latex) {
    return { status: "incomplete", message: "Enter an expression." };
  }
  if (latex.includes("\\placeholder")) {
    return { status: "incomplete", message: "Fill in the empty boxes before running this action." };
  }

  const ce = new ComputeEngine();
  let parsed: import("@cortex-js/compute-engine").Expression;
  try {
    parsed = ce.parse(latex);
  } catch {
    return { status: "invalid", message: "This expression could not be read." };
  }
  if (isNothing(parsed.json)) {
    return { status: "incomplete", message: "Enter an expression." };
  }
  const early = invalidResult(parsed.json, parsed.isValid);
  if (early) return early;

  let prepared: Prepared;
  try {
    prepared = prepare(ce, parsed, request.operation);
  } catch {
    return { status: "invalid", message: "This action could not be applied to the expression." };
  }
  const preparedProblem = invalidResult(prepared.expr.json, prepared.expr.isValid);
  if (preparedProblem) return { ...preparedProblem, interpretedLatex: prepared.interpretedLatex };

  try {
    const value = await evaluatePrepared(ce, prepared, request);
    return classify(ce, parsed, prepared, value, request.operation);
  } catch (error) {
    return cancellationResult(error);
  }
}

function prepare(
  ce: ComputeEngine,
  parsed: import("@cortex-js/compute-engine").Expression,
  operation: Operation,
): Prepared {
  const head = jsonHead(parsed.json);
  switch (operation.kind) {
    case "calculate":
      return { expr: parsed, mode: "evaluate" };
    case "approximate":
      return { expr: parsed, mode: "evaluate", approximate: true };
    case "simplify":
      return { expr: parsed, mode: "simplify" };
    case "expand": {
      const wrapped = ce.box(["Expand", parsed]);
      return { expr: wrapped, mode: "evaluate", interpretedLatex: wrapped.latex };
    }
    case "differentiate": {
      if (head === "D" || head === "Derivative") {
        return {
          expr: parsed,
          mode: "evaluate",
          message: "This expression is already a derivative, so it is evaluated once.",
        };
      }
      const wrapped = ce.box(["D", parsed, operation.variable]);
      return { expr: wrapped, mode: "evaluate", interpretedLatex: wrapped.latex };
    }
    case "integrate": {
      if (head === "Integrate") {
        return {
          expr: parsed,
          mode: "evaluate",
          message: "This expression is already an integral, so it is evaluated once.",
        };
      }
      const wrapped =
        operation.from !== undefined && operation.to !== undefined
          ? ce.box([
              "Integrate",
              parsed,
              ["Tuple", operation.variable, ce.parse(operation.from), ce.parse(operation.to)],
            ])
          : ce.box(["Integrate", parsed, operation.variable]);
      return {
        expr: wrapped,
        mode: "evaluate",
        interpretedLatex: wrapped.latex,
        restrictions:
          operation.from === undefined
            ? ["An antiderivative is returned without a constant of integration."]
            : undefined,
      };
    }
    case "limit": {
      if (head === "Limit") {
        return {
          expr: parsed,
          mode: "evaluate",
          message: "This expression is already a limit, so it is evaluated once.",
        };
      }
      const wrapped = ce.box(["Limit", parsed, operation.variable, ce.parse(operation.to)]);
      return { expr: wrapped, mode: "evaluate", interpretedLatex: wrapped.latex };
    }
    case "determinant": {
      if (head === "Determinant") {
        return {
          expr: parsed,
          mode: "evaluate",
          message: "This expression is already a determinant, so it is evaluated once.",
        };
      }
      const wrapped = ce.box(["Determinant", parsed]);
      return { expr: wrapped, mode: "evaluate", interpretedLatex: wrapped.latex };
    }
    case "inverse": {
      if (head === "Inverse") {
        return {
          expr: parsed,
          mode: "evaluate",
          message: "This expression is already an inverse, so it is evaluated once.",
        };
      }
      const wrapped = ce.box(["Inverse", parsed]);
      return { expr: wrapped, mode: "evaluate", interpretedLatex: wrapped.latex };
    }
    case "solve":
      return {
        expr: parsed,
        mode: "solve",
        message: parsed.latex.includes("=")
          ? undefined
          : `Solved ${operation.variable} from the equation “expression = 0”.`,
      };
  }
}

async function evaluatePrepared(
  ce: ComputeEngine,
  prepared: Prepared,
  request: EngineRequest,
): Promise<import("@cortex-js/compute-engine").Expression | SolveValue> {
  const limit = { ms: request.timeoutMs, label: "common-math" };
  if (prepared.mode === "simplify") {
    return ce.withTimeLimit(limit, () => prepared.expr.simplify());
  }
  if (prepared.mode === "solve") {
    const variable = request.operation.kind === "solve" ? request.operation.variable : "x";
    return ce.withTimeLimit(limit, () => prepared.expr.solve(variable));
  }
  let pending!: Promise<import("@cortex-js/compute-engine").Expression>;
  ce.withTimeLimit(limit, () => {
    pending = prepared.expr.evaluateAsync({
      signal: request.signal,
      numericApproximation: prepared.approximate === true,
    });
  });
  return pending;
}

type SolveValue = ReturnType<import("@cortex-js/compute-engine").Expression["solve"]>;

function classify(
  ce: ComputeEngine,
  source: import("@cortex-js/compute-engine").Expression,
  prepared: Prepared,
  value: import("@cortex-js/compute-engine").Expression | SolveValue,
  operation: Operation,
): EngineResult {
  if (operation.kind === "solve") {
    return classifySolve(ce, value as SolveValue, prepared);
  }
  const result = value as import("@cortex-js/compute-engine").Expression;
  const problem = invalidResult(result.json, result.isValid);
  if (problem) {
    return { ...problem, interpretedLatex: showInterpreted(prepared, result) };
  }
  if (isIndeterminate(result.json)) {
    return {
      status: "unevaluated",
      interpretedLatex: showInterpreted(prepared, result),
      message: "The engine could not give this a value. The result is indeterminate.",
    };
  }
  const head = jsonHead(result.json);
  if (head && UNRESOLVED.has(head)) {
    return {
      status: "unevaluated",
      resultLatex: present(ce, result),
      interpretedLatex: showInterpreted(prepared, result),
      message: unresolvedMessage(operation, head),
    };
  }
  if (operation.kind === "approximate") {
    return classifyApproximate(ce, result, prepared);
  }
  const restrictions = [...(prepared.restrictions ?? [])];
  if (operation.kind === "simplify") {
    const note = simplificationRestriction(source, result);
    if (note) restrictions.push(note);
  }
  if (
    (operation.kind === "calculate" || operation.kind === "integrate") &&
    isIndefiniteIntegral(source.json) &&
    head !== "Integrate"
  ) {
    restrictions.push("An antiderivative is returned without a constant of integration.");
  }
  return {
    status: "success",
    resultLatex: present(ce, result),
    interpretedLatex: showInterpreted(prepared, result),
    message: prepared.message,
    restrictions: restrictions.length > 0 ? restrictions : undefined,
  };
}

function classifyApproximate(
  ce: ComputeEngine,
  result: import("@cortex-js/compute-engine").Expression,
  prepared: Prepared,
): EngineResult {
  if (result.unknowns.length > 0 || !isNumericJson(result.json)) {
    return {
      status: "unevaluated",
      interpretedLatex: showInterpreted(prepared, result),
      message:
        "This was not approximated. Unknown variables were left as symbols, and no value was substituted for them.",
    };
  }
  const exact = !isInexact(result.json);
  return {
    status: "success",
    resultLatex: present(ce, result),
    interpretedLatex: showInterpreted(prepared, result),
    approximate: !exact,
    message: exact ? "This value is exact, so no decimal was substituted." : prepared.message,
  };
}

function classifySolve(
  ce: ComputeEngine,
  value: SolveValue,
  prepared: Prepared,
): EngineResult {
  if (value === null) {
    return {
      status: "unevaluated",
      message: "The equation was not solved.",
    };
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return {
        status: "success",
        message: joinMessages(prepared.message, "No solution."),
      };
    }
    if (isExpressionArray(value)) {
      const list = ce.box(["List", ...value]);
      return {
        status: "success",
        resultLatex: list.latex,
        message: joinMessages(
          prepared.message,
          "These are the principal solutions returned by the solver.",
        ),
      };
    }
    const lines = value.map((record) =>
      Object.entries(record)
        .map(([symbol, expr]) => `${symbol} = ${expr.latex}`)
        .join(", "),
    );
    return {
      status: "success",
      resultLatex: lines.join(" \\quad "),
      message: prepared.message,
    };
  }
  const entries = Object.entries(value);
  return {
    status: "success",
    resultLatex: entries.map(([symbol, expr]) => `${symbol} = ${expr.latex}`).join(", "),
    message: prepared.message,
  };
}

function isExpressionArray(
  value: readonly unknown[],
): value is import("@cortex-js/compute-engine").Expression[] {
  return value.every((item) => typeof item === "object" && item !== null && "latex" in item && !isRecordOfExpressions(item));
}

function isRecordOfExpressions(value: object): boolean {
  return !("latex" in value);
}

function invalidResult(json: unknown, isValid: boolean): EngineResult | null {
  if (isValid && !containsHead(json, "Error")) return null;
  const code = findErrorCode(json);
  if (code === "missing") {
    return { status: "incomplete", message: "The expression is incomplete." };
  }
  if (code === "expected-square-matrix") {
    return { status: "invalid", message: "This operation needs a square matrix." };
  }
  if (code === "incompatible-type") {
    return { status: "invalid", message: "This operation does not apply to this kind of value." };
  }
  if (code === "unexpected-operator") {
    return { status: "invalid", message: "The expression has a dangling operator." };
  }
  return { status: "invalid", message: "The expression could not be evaluated." };
}

function unresolvedMessage(operation: Operation, head: string): string {
  if (head === "Integrate" || operation.kind === "integrate") {
    return "The integral was not evaluated. The expression is unchanged as an integral.";
  }
  if (head === "Limit" || operation.kind === "limit") {
    return "The limit was not evaluated.";
  }
  if (head === "Inverse" || operation.kind === "inverse") {
    return "No inverse was found. A singular matrix has no inverse.";
  }
  if (head === "D" || head === "Derivative" || operation.kind === "differentiate") {
    return "The derivative was not evaluated.";
  }
  if (head === "Determinant") {
    return "The determinant was not evaluated.";
  }
  return "The expression was left unevaluated.";
}

function simplificationRestriction(
  source: import("@cortex-js/compute-engine").Expression,
  result: import("@cortex-js/compute-engine").Expression,
): string | null {
  if (source.unknowns.length === 0) return null;
  if (!containsHead(source.json, "Divide")) return null;
  if (JSON.stringify(source.json) === JSON.stringify(result.json)) return null;
  return "Equivalent where the original expression is defined. Excluded points are not listed.";
}

function present(
  ce: ComputeEngine,
  expr: import("@cortex-js/compute-engine").Expression,
): string {
  if (isRectangularMatrix(expr.json)) {
    const matrix = ce.box(["Matrix", expr.json]);
    if (matrix.isValid && !containsHead(matrix.json, "Error")) return matrix.latex;
  }
  return expr.latex;
}

function showInterpreted(
  prepared: Prepared,
  result: import("@cortex-js/compute-engine").Expression,
): string | undefined {
  if (!prepared.interpretedLatex) return undefined;
  if (prepared.interpretedLatex === result.latex) return undefined;
  return prepared.interpretedLatex;
}

function isInexact(json: unknown): boolean {
  if (json && typeof json === "object" && !Array.isArray(json) && "num" in json) return true;
  return Array.isArray(json) && json[0] === "Measurement";
}

function cancellationResult(error: unknown): EngineResult {
  if (error instanceof CancellationError) {
    if (error.cause === "timeout" || error.cause === "step-budget") {
      return { status: "timeout", message: "The calculation took too long and was stopped." };
    }
    return { status: "cancelled", message: "Cancelled." };
  }
  if (error instanceof Error && error.name === "AbortError") {
    return { status: "cancelled", message: "Cancelled." };
  }
  return { status: "invalid", message: "The calculation stopped because of an engine error." };
}

function joinMessages(left: string | undefined, right: string): string {
  return left ? `${left} ${right}` : right;
}
