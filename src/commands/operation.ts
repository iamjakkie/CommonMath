/** A structured action. The expression itself is not stored here. */
export type Operation =
  | { kind: "calculate" }
  | { kind: "approximate" }
  | { kind: "simplify" }
  | { kind: "expand" }
  | { kind: "differentiate"; variable: string }
  | { kind: "solve"; variable: string }
  | { kind: "integrate"; variable: string; from?: string; to?: string }
  | { kind: "limit"; variable: string; to: string }
  | { kind: "determinant" }
  | { kind: "inverse" };
