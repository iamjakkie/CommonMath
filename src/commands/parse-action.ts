import { commandEnabled } from "./vocabulary";
import type { Operation } from "./operation";

export type ParsedAction =
  | { ok: true; operation: Operation; label: string }
  | {
      ok: false;
      status: "missing-parameters";
      message: string;
      resume: string;
    }
  | { ok: false; status: "unsupported"; message: string };

const VARIABLE = /^[a-z]$/;
const NUMBER = /^-?\d+(\.\d+)?$/;

function tokensOf(input: string): string[] {
  return input.trim().toLowerCase().split(/\s+/).filter((token) => token.length > 0);
}

function isVariable(token: string | undefined): token is string {
  return typeof token === "string" && VARIABLE.test(token);
}

/** Action-line bounds are numbers, `pi`, or one letter. Not nested mathematics. */
export function boundLatex(token: string | undefined): string | null {
  if (!token) return null;
  if (NUMBER.test(token)) return token;
  if (token === "pi" || token === "\\pi") return "\\pi";
  if (VARIABLE.test(token)) return token;
  return null;
}

function missing(message: string, resume: string): ParsedAction {
  return { ok: false, status: "missing-parameters", message, resume };
}

function unsupported(message: string): ParsedAction {
  return { ok: false, status: "unsupported", message };
}

function ready(operation: Operation, label: string): ParsedAction {
  if (!commandEnabled(operation.kind)) {
    return unsupported(
      `${label} is not available. The engine path for this operation is not enabled.`,
    );
  }
  return { ok: true, operation, label };
}

/**
 * Parse the action line. This grammar covers commands only.
 * The mathematical expression is parsed later by the Compute Engine.
 */
export function parseAction(input: string): ParsedAction {
  const tokens = tokensOf(input);
  if (tokens.length === 0) {
    return missing("Enter an action. Try calculate.", "calculate");
  }
  const [head, ...rest] = tokens;
  switch (head) {
    case "calculate":
    case "calc":
      return rest.length === 0
        ? ready({ kind: "calculate" }, "calculate")
        : unsupported("calculate does not take extra words.");
    case "approximate":
    case "approx":
      return rest.length === 0
        ? ready({ kind: "approximate" }, "approximate")
        : unsupported("approximate does not take extra words.");
    case "simplify":
      return rest.length === 0
        ? ready({ kind: "simplify" }, "simplify")
        : unsupported("simplify does not take extra words.");
    case "expand":
      return rest.length === 0
        ? ready({ kind: "expand" }, "expand")
        : unsupported("expand does not take extra words.");
    case "differentiate":
    case "derivative":
    case "diff":
      return parseVariableCommand(rest, "differentiate", (variable) => ({
        kind: "differentiate",
        variable,
      }));
    case "solve":
      return parseSolve(rest);
    case "integrate":
      return parseIntegrate(rest);
    case "limit":
      return parseLimit(rest);
    case "determinant":
    case "det":
      return rest.length === 0
        ? ready({ kind: "determinant" }, "determinant")
        : unsupported("determinant does not take extra words.");
    case "inverse":
    case "inv":
      return rest.length === 0
        ? ready({ kind: "inverse" }, "inverse")
        : unsupported("inverse does not take extra words.");
    default:
      return unsupported(
        `"${input.trim()}" is not an action. Try calculate, approximate, simplify, expand, differentiate x, integrate x, limit x to 0, solve for x, determinant, or inverse.`,
      );
  }
}

function parseVariableCommand(
  rest: string[],
  name: string,
  build: (variable: string) => Operation,
): ParsedAction {
  if (rest.length === 0) {
    return missing(`Name the variable. For example, ${name} x.`, `${name} `);
  }
  if (rest.length !== 1 || !isVariable(rest[0])) {
    return missing(
      "Use one letter for the variable, such as x.",
      `${name} `,
    );
  }
  const variable = rest[0];
  return ready(build(variable), `${name} ${variable}`);
}

function parseSolve(rest: string[]): ParsedAction {
  if (rest.length === 0 || (rest[0] === "for" && rest.length === 1)) {
    return missing("Name the unknown. For example, solve for x.", "solve for ");
  }
  if (rest[0] === "for" && rest.length === 2 && isVariable(rest[1])) {
    const variable = rest[1];
    return ready({ kind: "solve", variable }, `solve for ${variable}`);
  }
  return missing("Write solve for x, using one letter for the unknown.", "solve for ");
}

function parseIntegrate(rest: string[]): ParsedAction {
  if (rest.length === 0) {
    return missing("Name the variable. For example, integrate x.", "integrate ");
  }
  if (!isVariable(rest[0])) {
    return missing("Use one letter for the variable of integration.", "integrate ");
  }
  const variable = rest[0];
  if (rest.length === 1) {
    return ready({ kind: "integrate", variable }, `integrate ${variable}`);
  }
  if (rest[1] !== "from") {
    return unsupported(
      "Write integrate x, or integrate x from 0 to 1.",
    );
  }
  if (rest.length < 5 || rest[3] !== "to") {
    return missing(
      "A definite integral needs both bounds. For example, integrate x from 0 to 1.",
      `integrate ${variable} from `,
    );
  }
  if (rest.length !== 5) {
    return unsupported("Write integrate x from 0 to 1, with nothing after the upper bound.");
  }
  const from = boundLatex(rest[2]);
  const to = boundLatex(rest[4]);
  if (!from || !to) {
    return missing(
      "Bounds should be a number, pi, or a single letter.",
      `integrate ${variable} from `,
    );
  }
  return ready(
    { kind: "integrate", variable, from, to },
    `integrate ${variable} from ${rest[2]} to ${rest[4]}`,
  );
}

function parseLimit(rest: string[]): ParsedAction {
  if (rest.length === 0) {
    return missing("Write limit x to 0.", "limit ");
  }
  if (!isVariable(rest[0])) {
    return missing("Use one letter for the variable. For example, limit x to 0.", "limit ");
  }
  const variable = rest[0];
  if (rest.length < 3 || rest[1] !== "to") {
    return missing(
      "Name the value being approached. For example, limit x to 0.",
      `limit ${variable} to `,
    );
  }
  if (rest.length !== 3) {
    return unsupported("Write limit x to 0, with nothing after the value.");
  }
  const to = boundLatex(rest[2]);
  if (!to) {
    return missing(
      "The approach value should be a number, pi, or a single letter.",
      `limit ${variable} to `,
    );
  }
  return ready({ kind: "limit", variable, to }, `limit ${variable} to ${rest[2]}`);
}
