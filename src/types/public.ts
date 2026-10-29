export type OutcomeStatus =
  | "success"
  | "incomplete"
  | "invalid"
  | "missing-parameters"
  | "unsupported"
  | "unevaluated"
  | "timeout"
  | "cancelled";

export type ThemeName = "light" | "dark" | "system";

/**
 * Result of one `execute()` call.
 * `sourceLatex` is the expression as written. It is never replaced by a
 * canonical form. `resultLatex` is present only when the engine produced a
 * mathematical value worth showing.
 */
export interface CalculationOutcome {
  status: OutcomeStatus;
  sourceLatex: string;
  action: string;
  interpretedLatex?: string;
  resultLatex?: string;
  approximate?: boolean;
  message?: string;
  restrictions?: string[];
  revision: number;
}

export interface CommonMathChangeDetail {
  value: string;
  action: string;
  revision: number;
}

export interface CommonMathResultDetail {
  outcome: CalculationOutcome;
}

export interface CommonMathErrorDetail {
  message: string;
  outcome?: CalculationOutcome;
}
