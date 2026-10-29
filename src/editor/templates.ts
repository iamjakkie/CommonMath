export interface StructureTemplate {
  id: string;
  label: string;
  hint: string;
  latex: string | null;
}

export const STRUCTURES: readonly StructureTemplate[] = [
  {
    id: "sqrt",
    label: "Square root",
    hint: "sqrt",
    latex: "\\sqrt{#?}",
  },
  {
    id: "integral",
    label: "Integral",
    hint: "Bounds and a differential",
    latex: "\\int_{#?}^{#?} #? \\, dx",
  },
  {
    id: "limit",
    label: "Limit",
    hint: "Variable, approach, expression",
    latex: "\\lim_{#? \\to #?} #?",
  },
  {
    id: "matrix-2",
    label: "Matrix 2×2",
    hint: "Four editable cells",
    latex: "\\begin{pmatrix} #? & #? \\\\ #? & #? \\end{pmatrix}",
  },
  {
    id: "matrix-n",
    label: "Matrix size…",
    hint: "Choose rows and columns",
    latex: null,
  },
];

const SHORTCUT_AFTER = "nothing|space|binop|relop|openfence|punct|closefence|digit|surd|frac|operator";

/** Inline aliases that must not fire after a letter, so they stay out of names. */
export const INLINE_ALIASES: Record<string, { after: string; value: string }> = {
  sqrt: { after: SHORTCUT_AFTER, value: "\\sqrt{#?}" },
  int: { after: SHORTCUT_AFTER, value: "\\int_{#?}^{#?} #? \\, dx" },
  lim: { after: SHORTCUT_AFTER, value: "\\lim_{#? \\to #?} #?" },
};

export function matrixLatex(rows: number, columns: number): string {
  const safeRows = clampDimension(rows);
  const safeColumns = clampDimension(columns);
  const row = Array.from({ length: safeColumns }, () => "#?").join(" & ");
  const body = Array.from({ length: safeRows }, () => row).join(" \\\\ ");
  return `\\begin{pmatrix} ${body} \\end{pmatrix}`;
}

function clampDimension(value: number): number {
  if (!Number.isFinite(value)) return 2;
  return Math.min(8, Math.max(1, Math.floor(value)));
}
