export function jsonHead(json: unknown): string | null {
  return Array.isArray(json) && typeof json[0] === "string" ? json[0] : null;
}

export function containsHead(json: unknown, head: string): boolean {
  if (!Array.isArray(json)) return false;
  if (json[0] === head) return true;
  return json.some((child) => containsHead(child, head));
}

export function findErrorCode(json: unknown): string | null {
  if (!Array.isArray(json)) return null;
  if (json[0] === "ErrorCode" && typeof json[1] === "string") {
    return json[1].replace(/'/g, "");
  }
  if (json[0] === "Error" && typeof json[1] === "string") {
    return json[1].replace(/'/g, "");
  }
  for (const child of json) {
    const found = findErrorCode(child);
    if (found) return found;
  }
  return null;
}

export function isNothing(json: unknown): boolean {
  return json === "Nothing";
}

export function isIndeterminate(json: unknown): boolean {
  return json === "Indeterminate" || json === "Undefined" || json === "NaN" || json === "ComplexInfinity";
}

export function isNumericJson(json: unknown): boolean {
  if (typeof json === "number") return true;
  if (json && typeof json === "object" && !Array.isArray(json) && "num" in json) return true;
  if (!Array.isArray(json)) return false;
  return json[0] === "Rational" || json[0] === "Complex" || json[0] === "Measurement";
}

export function isRectangularMatrix(json: unknown): boolean {
  if (!Array.isArray(json) || json[0] !== "List" || json.length < 2) return false;
  const rows = json.slice(1);
  const width = Array.isArray(rows[0]) ? rows[0].length : 0;
  if (width < 2) return false;
  return rows.every(
    (row) => Array.isArray(row) && row[0] === "List" && row.length === width && row.length > 1,
  );
}

/** True when an Integrate/Limits node has no numeric bounds. */
export function isIndefiniteIntegral(json: unknown): boolean {
  if (!Array.isArray(json)) return false;
  if (json[0] === "Limits" && json.length >= 4 && json[2] === "Nothing" && json[3] === "Nothing") {
    return true;
  }
  return json.some((child) => isIndefiniteIntegral(child));
}
