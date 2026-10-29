import type { Operation } from "./operation";

export interface CommandSpec {
  id: Operation["kind"];
  label: string;
  /** Text placed in the action line when the command is chosen. */
  insert: string;
  hint: string;
  keywords: string[];
  /** Offered in autocomplete only after a fixture has verified the operation. */
  enabled: boolean;
}

/**
 * Commands marked `enabled` are implemented and covered by tests.
 * Disabled entries stay in the grammar so a typed command explains itself
 * instead of being guessed.
 */
export const COMMANDS: readonly CommandSpec[] = [
  {
    id: "calculate",
    label: "calculate",
    insert: "calculate",
    hint: "Exact value",
    keywords: ["calculate", "calc"],
    enabled: true,
  },
  {
    id: "approximate",
    label: "approximate",
    insert: "approximate",
    hint: "Decimal approximation",
    keywords: ["approximate", "approx"],
    enabled: true,
  },
  {
    id: "simplify",
    label: "simplify",
    insert: "simplify",
    hint: "Simplify",
    keywords: ["simplify"],
    enabled: true,
  },
  {
    id: "expand",
    label: "expand",
    insert: "expand",
    hint: "Expand products and powers",
    keywords: ["expand"],
    enabled: true,
  },
  {
    id: "differentiate",
    label: "differentiate x",
    insert: "differentiate x",
    hint: "Derivative. Change x if you need another variable.",
    keywords: ["differentiate", "derivative", "diff"],
    enabled: true,
  },
  {
    id: "solve",
    label: "solve for x",
    insert: "solve for x",
    hint: "Solve an equation. An expression is treated as equal to 0.",
    keywords: ["solve"],
    enabled: true,
  },
  {
    id: "integrate",
    label: "integrate x",
    insert: "integrate x",
    hint: "Antiderivative. Add “from 0 to 1” for a definite integral.",
    keywords: ["integrate"],
    enabled: true,
  },
  {
    id: "integrate",
    label: "integrate x from 0 to 1",
    insert: "integrate x from 0 to 1",
    hint: "Definite integral",
    keywords: ["integrate from"],
    enabled: true,
  },
  {
    id: "limit",
    label: "limit x to 0",
    insert: "limit x to 0",
    hint: "Limit as the variable approaches a value",
    keywords: ["limit"],
    enabled: true,
  },
  {
    id: "determinant",
    label: "determinant",
    insert: "determinant",
    hint: "Determinant of a square matrix",
    keywords: ["determinant", "det"],
    enabled: true,
  },
  {
    id: "inverse",
    label: "inverse",
    insert: "inverse",
    hint: "Inverse of a square matrix",
    keywords: ["inverse", "inv"],
    enabled: true,
  },
];

export function enabledCommands(): CommandSpec[] {
  return COMMANDS.filter((command) => command.enabled);
}

export function commandEnabled(kind: Operation["kind"]): boolean {
  return COMMANDS.some((command) => command.id === kind && command.enabled);
}
