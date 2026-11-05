import { CancellationError, ComputeEngine } from "@cortex-js/compute-engine";
// src/commands/vocabulary.ts
/**
* Commands marked `enabled` are implemented and covered by tests.
* Disabled entries stay in the grammar so a typed command explains itself
* instead of being guessed.
*/
var COMMANDS = [
	{
		id: "calculate",
		label: "calculate",
		insert: "calculate",
		hint: "Exact value",
		keywords: ["calculate", "calc"],
		enabled: true
	},
	{
		id: "approximate",
		label: "approximate",
		insert: "approximate",
		hint: "Decimal approximation",
		keywords: ["approximate", "approx"],
		enabled: true
	},
	{
		id: "simplify",
		label: "simplify",
		insert: "simplify",
		hint: "Simplify",
		keywords: ["simplify"],
		enabled: true
	},
	{
		id: "expand",
		label: "expand",
		insert: "expand",
		hint: "Expand products and powers",
		keywords: ["expand"],
		enabled: true
	},
	{
		id: "differentiate",
		label: "differentiate x",
		insert: "differentiate x",
		hint: "Derivative. Change x if you need another variable.",
		keywords: [
			"differentiate",
			"derivative",
			"diff"
		],
		enabled: true
	},
	{
		id: "solve",
		label: "solve for x",
		insert: "solve for x",
		hint: "Solve an equation. An expression is treated as equal to 0.",
		keywords: ["solve"],
		enabled: true
	},
	{
		id: "integrate",
		label: "integrate x",
		insert: "integrate x",
		hint: "Antiderivative. Add “from 0 to 1” for a definite integral.",
		keywords: ["integrate"],
		enabled: true
	},
	{
		id: "integrate",
		label: "integrate x from 0 to 1",
		insert: "integrate x from 0 to 1",
		hint: "Definite integral",
		keywords: ["integrate from"],
		enabled: true
	},
	{
		id: "limit",
		label: "limit x to 0",
		insert: "limit x to 0",
		hint: "Limit as the variable approaches a value",
		keywords: ["limit"],
		enabled: true
	},
	{
		id: "determinant",
		label: "determinant",
		insert: "determinant",
		hint: "Determinant of a square matrix",
		keywords: ["determinant", "det"],
		enabled: true
	},
	{
		id: "inverse",
		label: "inverse",
		insert: "inverse",
		hint: "Inverse of a square matrix",
		keywords: ["inverse", "inv"],
		enabled: true
	}
];
function commandEnabled(kind) {
	return COMMANDS.some((command) => command.id === kind && command.enabled);
}
// src/commands/parse-action.ts
var VARIABLE = /^[a-z]$/;
var NUMBER = /^-?\d+(\.\d+)?$/;
function tokensOf(input) {
	return input.trim().toLowerCase().split(/\s+/).filter((token) => token.length > 0);
}
function isVariable(token) {
	return typeof token === "string" && VARIABLE.test(token);
}
/** Action-line bounds are numbers, `pi`, or one letter. Not nested mathematics. */
function boundLatex(token) {
	if (!token) return null;
	if (NUMBER.test(token)) return token;
	if (token === "pi" || token === "\\pi") return "\\pi";
	if (VARIABLE.test(token)) return token;
	return null;
}
function missing(message, resume) {
	return {
		ok: false,
		status: "missing-parameters",
		message,
		resume
	};
}
function unsupported(message) {
	return {
		ok: false,
		status: "unsupported",
		message
	};
}
function ready(operation, label) {
	if (!commandEnabled(operation.kind)) return unsupported(`${label} is not available. The engine path for this operation is not enabled.`);
	return {
		ok: true,
		operation,
		label
	};
}
/**
* Parse the action line. This grammar covers commands only.
* The mathematical expression is parsed later by the Compute Engine.
*/
function parseAction(input) {
	const tokens = tokensOf(input);
	if (tokens.length === 0) return missing("Enter an action. Try calculate.", "calculate");
	const [head, ...rest] = tokens;
	switch (head) {
		case "calculate":
		case "calc": return rest.length === 0 ? ready({ kind: "calculate" }, "calculate") : unsupported("calculate does not take extra words.");
		case "approximate":
		case "approx": return rest.length === 0 ? ready({ kind: "approximate" }, "approximate") : unsupported("approximate does not take extra words.");
		case "simplify": return rest.length === 0 ? ready({ kind: "simplify" }, "simplify") : unsupported("simplify does not take extra words.");
		case "expand": return rest.length === 0 ? ready({ kind: "expand" }, "expand") : unsupported("expand does not take extra words.");
		case "differentiate":
		case "derivative":
		case "diff": return parseVariableCommand(rest, "differentiate", (variable) => ({
			kind: "differentiate",
			variable
		}));
		case "solve": return parseSolve(rest);
		case "integrate": return parseIntegrate(rest);
		case "limit": return parseLimit(rest);
		case "determinant":
		case "det": return rest.length === 0 ? ready({ kind: "determinant" }, "determinant") : unsupported("determinant does not take extra words.");
		case "inverse":
		case "inv": return rest.length === 0 ? ready({ kind: "inverse" }, "inverse") : unsupported("inverse does not take extra words.");
		default: return unsupported(`"${input.trim()}" is not an action. Try calculate, approximate, simplify, expand, differentiate x, integrate x, limit x to 0, solve for x, determinant, or inverse.`);
	}
}
function parseVariableCommand(rest, name, build) {
	if (rest.length === 0) return missing(`Name the variable. For example, ${name} x.`, `${name} `);
	if (rest.length !== 1 || !isVariable(rest[0])) return missing("Use one letter for the variable, such as x.", `${name} `);
	const variable = rest[0];
	return ready(build(variable), `${name} ${variable}`);
}
function parseSolve(rest) {
	if (rest.length === 0 || rest[0] === "for" && rest.length === 1) return missing("Name the unknown. For example, solve for x.", "solve for ");
	if (rest[0] === "for" && rest.length === 2 && isVariable(rest[1])) {
		const variable = rest[1];
		return ready({
			kind: "solve",
			variable
		}, `solve for ${variable}`);
	}
	return missing("Write solve for x, using one letter for the unknown.", "solve for ");
}
function parseIntegrate(rest) {
	if (rest.length === 0) return missing("Name the variable. For example, integrate x.", "integrate ");
	if (!isVariable(rest[0])) return missing("Use one letter for the variable of integration.", "integrate ");
	const variable = rest[0];
	if (rest.length === 1) return ready({
		kind: "integrate",
		variable
	}, `integrate ${variable}`);
	if (rest[1] !== "from") return unsupported("Write integrate x, or integrate x from 0 to 1.");
	if (rest.length < 5 || rest[3] !== "to") return missing("A definite integral needs both bounds. For example, integrate x from 0 to 1.", `integrate ${variable} from `);
	if (rest.length !== 5) return unsupported("Write integrate x from 0 to 1, with nothing after the upper bound.");
	const from = boundLatex(rest[2]);
	const to = boundLatex(rest[4]);
	if (!from || !to) return missing("Bounds should be a number, pi, or a single letter.", `integrate ${variable} from `);
	return ready({
		kind: "integrate",
		variable,
		from,
		to
	}, `integrate ${variable} from ${rest[2]} to ${rest[4]}`);
}
function parseLimit(rest) {
	if (rest.length === 0) return missing("Write limit x to 0.", "limit ");
	if (!isVariable(rest[0])) return missing("Use one letter for the variable. For example, limit x to 0.", "limit ");
	const variable = rest[0];
	if (rest.length < 3 || rest[1] !== "to") return missing("Name the value being approached. For example, limit x to 0.", `limit ${variable} to `);
	if (rest.length !== 3) return unsupported("Write limit x to 0, with nothing after the value.");
	const to = boundLatex(rest[2]);
	if (!to) return missing("The approach value should be a number, pi, or a single letter.", `limit ${variable} to `);
	return ready({
		kind: "limit",
		variable,
		to
	}, `limit ${variable} to ${rest[2]}`);
}
// src/engine/json.ts
function jsonHead(json) {
	return Array.isArray(json) && typeof json[0] === "string" ? json[0] : null;
}
function containsHead(json, head) {
	if (!Array.isArray(json)) return false;
	if (json[0] === head) return true;
	return json.some((child) => containsHead(child, head));
}
function findErrorCode(json) {
	if (!Array.isArray(json)) return null;
	if (json[0] === "ErrorCode" && typeof json[1] === "string") return json[1].replace(/'/g, "");
	if (json[0] === "Error" && typeof json[1] === "string") return json[1].replace(/'/g, "");
	for (const child of json) {
		const found = findErrorCode(child);
		if (found) return found;
	}
	return null;
}
function isNothing(json) {
	return json === "Nothing";
}
function isIndeterminate(json) {
	return json === "Indeterminate" || json === "Undefined" || json === "NaN" || json === "ComplexInfinity";
}
function isNumericJson(json) {
	if (typeof json === "number") return true;
	if (json && typeof json === "object" && !Array.isArray(json) && "num" in json) return true;
	if (!Array.isArray(json)) return false;
	return json[0] === "Rational" || json[0] === "Complex" || json[0] === "Measurement";
}
function isRectangularMatrix(json) {
	if (!Array.isArray(json) || json[0] !== "List" || json.length < 2) return false;
	const rows = json.slice(1);
	const width = Array.isArray(rows[0]) ? rows[0].length : 0;
	if (width < 2) return false;
	return rows.every((row) => Array.isArray(row) && row[0] === "List" && row.length === width && row.length > 1);
}
/** True when an Integrate/Limits node has no numeric bounds. */
function isIndefiniteIntegral(json) {
	if (!Array.isArray(json)) return false;
	if (json[0] === "Limits" && json.length >= 4 && json[2] === "Nothing" && json[3] === "Nothing") return true;
	return json.some((child) => isIndefiniteIntegral(child));
}
// src/engine/run.ts
var UNRESOLVED = /* @__PURE__ */ new Set([
	"Integrate",
	"Limit",
	"D",
	"Derivative",
	"Inverse",
	"Determinant",
	"Expand",
	"ExpandAll"
]);
/**
* Run one operation on a new Compute Engine.
* Free functions are not used: they share a process-wide engine.
* `compile()` is not used: it builds JavaScript functions.
*/
async function runOperation(request) {
	if (request.signal?.aborted) return {
		status: "cancelled",
		message: "Cancelled."
	};
	const latex = request.latex.trim();
	if (!latex) return {
		status: "incomplete",
		message: "Enter an expression."
	};
	if (latex.includes("\\placeholder")) return {
		status: "incomplete",
		message: "Fill in the empty boxes before running this action."
	};
	const ce = new ComputeEngine();
	let parsed;
	try {
		parsed = ce.parse(latex);
	} catch {
		return {
			status: "invalid",
			message: "This expression could not be read."
		};
	}
	if (isNothing(parsed.json)) return {
		status: "incomplete",
		message: "Enter an expression."
	};
	const early = invalidResult(parsed.json, parsed.isValid);
	if (early) return early;
	let prepared;
	try {
		prepared = prepare(ce, parsed, request.operation);
	} catch {
		return {
			status: "invalid",
			message: "This action could not be applied to the expression."
		};
	}
	const preparedProblem = invalidResult(prepared.expr.json, prepared.expr.isValid);
	if (preparedProblem) return {
		...preparedProblem,
		interpretedLatex: prepared.interpretedLatex
	};
	try {
		const value = await evaluatePrepared(ce, prepared, request);
		return classify(ce, parsed, prepared, value, request.operation);
	} catch (error) {
		return cancellationResult(error);
	}
}
function prepare(ce, parsed, operation) {
	const head = jsonHead(parsed.json);
	switch (operation.kind) {
		case "calculate": return {
			expr: parsed,
			mode: "evaluate"
		};
		case "approximate": return {
			expr: parsed,
			mode: "evaluate",
			approximate: true
		};
		case "simplify": return {
			expr: parsed,
			mode: "simplify"
		};
		case "expand": {
			const wrapped = ce.box(["Expand", parsed]);
			return {
				expr: wrapped,
				mode: "evaluate",
				interpretedLatex: wrapped.latex
			};
		}
		case "differentiate": {
			if (head === "D" || head === "Derivative") return {
				expr: parsed,
				mode: "evaluate",
				message: "This expression is already a derivative, so it is evaluated once."
			};
			const wrapped = ce.box([
				"D",
				parsed,
				operation.variable
			]);
			return {
				expr: wrapped,
				mode: "evaluate",
				interpretedLatex: wrapped.latex
			};
		}
		case "integrate": {
			if (head === "Integrate") return {
				expr: parsed,
				mode: "evaluate",
				message: "This expression is already an integral, so it is evaluated once."
			};
			const wrapped = operation.from !== void 0 && operation.to !== void 0 ? ce.box([
				"Integrate",
				parsed,
				[
					"Tuple",
					operation.variable,
					ce.parse(operation.from),
					ce.parse(operation.to)
				]
			]) : ce.box([
				"Integrate",
				parsed,
				operation.variable
			]);
			return {
				expr: wrapped,
				mode: "evaluate",
				interpretedLatex: wrapped.latex,
				restrictions: operation.from === void 0 ? ["An antiderivative is returned without a constant of integration."] : void 0
			};
		}
		case "limit": {
			if (head === "Limit") return {
				expr: parsed,
				mode: "evaluate",
				message: "This expression is already a limit, so it is evaluated once."
			};
			const wrapped = ce.box([
				"Limit",
				parsed,
				operation.variable,
				ce.parse(operation.to)
			]);
			return {
				expr: wrapped,
				mode: "evaluate",
				interpretedLatex: wrapped.latex
			};
		}
		case "determinant": {
			if (head === "Determinant") return {
				expr: parsed,
				mode: "evaluate",
				message: "This expression is already a determinant, so it is evaluated once."
			};
			const wrapped = ce.box(["Determinant", parsed]);
			return {
				expr: wrapped,
				mode: "evaluate",
				interpretedLatex: wrapped.latex
			};
		}
		case "inverse": {
			if (head === "Inverse") return {
				expr: parsed,
				mode: "evaluate",
				message: "This expression is already an inverse, so it is evaluated once."
			};
			const wrapped = ce.box(["Inverse", parsed]);
			return {
				expr: wrapped,
				mode: "evaluate",
				interpretedLatex: wrapped.latex
			};
		}
		case "solve": return {
			expr: parsed,
			mode: "solve",
			message: parsed.latex.includes("=") ? void 0 : `Solved ${operation.variable} from the equation “expression = 0”.`
		};
	}
}
async function evaluatePrepared(ce, prepared, request) {
	const limit = {
		ms: request.timeoutMs,
		label: "common-math"
	};
	if (prepared.mode === "simplify") return ce.withTimeLimit(limit, () => prepared.expr.simplify());
	if (prepared.mode === "solve") {
		const variable = request.operation.kind === "solve" ? request.operation.variable : "x";
		return ce.withTimeLimit(limit, () => prepared.expr.solve(variable));
	}
	let pending;
	ce.withTimeLimit(limit, () => {
		pending = prepared.expr.evaluateAsync({
			signal: request.signal,
			numericApproximation: prepared.approximate === true
		});
	});
	return pending;
}
function classify(ce, source, prepared, value, operation) {
	if (operation.kind === "solve") return classifySolve(ce, value, prepared);
	const result = value;
	const problem = invalidResult(result.json, result.isValid);
	if (problem) return {
		...problem,
		interpretedLatex: showInterpreted(prepared, result)
	};
	if (isIndeterminate(result.json)) return {
		status: "unevaluated",
		interpretedLatex: showInterpreted(prepared, result),
		message: "The engine could not give this a value. The result is indeterminate."
	};
	const head = jsonHead(result.json);
	if (head && UNRESOLVED.has(head)) return {
		status: "unevaluated",
		resultLatex: present(ce, result),
		interpretedLatex: showInterpreted(prepared, result),
		message: unresolvedMessage(operation, head)
	};
	if (operation.kind === "approximate") return classifyApproximate(ce, result, prepared);
	const restrictions = [...prepared.restrictions ?? []];
	if (operation.kind === "simplify") {
		const note = simplificationRestriction(source, result);
		if (note) restrictions.push(note);
	}
	if ((operation.kind === "calculate" || operation.kind === "integrate") && isIndefiniteIntegral(source.json) && head !== "Integrate") restrictions.push("An antiderivative is returned without a constant of integration.");
	return {
		status: "success",
		resultLatex: present(ce, result),
		interpretedLatex: showInterpreted(prepared, result),
		message: prepared.message,
		restrictions: restrictions.length > 0 ? restrictions : void 0
	};
}
function classifyApproximate(ce, result, prepared) {
	if (result.unknowns.length > 0 || !isNumericJson(result.json)) return {
		status: "unevaluated",
		interpretedLatex: showInterpreted(prepared, result),
		message: "This was not approximated. Unknown variables were left as symbols, and no value was substituted for them."
	};
	const exact = !isInexact(result.json);
	return {
		status: "success",
		resultLatex: present(ce, result),
		interpretedLatex: showInterpreted(prepared, result),
		approximate: !exact,
		message: exact ? "This value is exact, so no decimal was substituted." : prepared.message
	};
}
function classifySolve(ce, value, prepared) {
	if (value === null) return {
		status: "unevaluated",
		message: "The equation was not solved."
	};
	if (Array.isArray(value)) {
		if (value.length === 0) return {
			status: "success",
			message: joinMessages(prepared.message, "No solution.")
		};
		if (isExpressionArray(value)) return {
			status: "success",
			resultLatex: ce.box(["List", ...value]).latex,
			message: joinMessages(prepared.message, "These are the principal solutions returned by the solver.")
		};
		return {
			status: "success",
			resultLatex: value.map((record) => Object.entries(record).map(([symbol, expr]) => `${symbol} = ${expr.latex}`).join(", ")).join(" \\quad "),
			message: prepared.message
		};
	}
	return {
		status: "success",
		resultLatex: Object.entries(value).map(([symbol, expr]) => `${symbol} = ${expr.latex}`).join(", "),
		message: prepared.message
	};
}
function isExpressionArray(value) {
	return value.every((item) => typeof item === "object" && item !== null && "latex" in item && !isRecordOfExpressions(item));
}
function isRecordOfExpressions(value) {
	return !("latex" in value);
}
function invalidResult(json, isValid) {
	if (isValid && !containsHead(json, "Error")) return null;
	const code = findErrorCode(json);
	if (code === "missing") return {
		status: "incomplete",
		message: "The expression is incomplete."
	};
	if (code === "expected-square-matrix") return {
		status: "invalid",
		message: "This operation needs a square matrix."
	};
	if (code === "incompatible-type") return {
		status: "invalid",
		message: "This operation does not apply to this kind of value."
	};
	if (code === "unexpected-operator") return {
		status: "invalid",
		message: "The expression has a dangling operator."
	};
	return {
		status: "invalid",
		message: "The expression could not be evaluated."
	};
}
function unresolvedMessage(operation, head) {
	if (head === "Integrate" || operation.kind === "integrate") return "The integral was not evaluated. The expression is unchanged as an integral.";
	if (head === "Limit" || operation.kind === "limit") return "The limit was not evaluated.";
	if (head === "Inverse" || operation.kind === "inverse") return "No inverse was found. A singular matrix has no inverse.";
	if (head === "D" || head === "Derivative" || operation.kind === "differentiate") return "The derivative was not evaluated.";
	if (head === "Determinant") return "The determinant was not evaluated.";
	return "The expression was left unevaluated.";
}
function simplificationRestriction(source, result) {
	if (source.unknowns.length === 0) return null;
	if (!containsHead(source.json, "Divide")) return null;
	if (JSON.stringify(source.json) === JSON.stringify(result.json)) return null;
	return "Equivalent where the original expression is defined. Excluded points are not listed.";
}
function present(ce, expr) {
	if (isRectangularMatrix(expr.json)) {
		const matrix = ce.box(["Matrix", expr.json]);
		if (matrix.isValid && !containsHead(matrix.json, "Error")) return matrix.latex;
	}
	return expr.latex;
}
function showInterpreted(prepared, result) {
	if (!prepared.interpretedLatex) return void 0;
	if (prepared.interpretedLatex === result.latex) return void 0;
	return prepared.interpretedLatex;
}
function isInexact(json) {
	if (json && typeof json === "object" && !Array.isArray(json) && "num" in json) return true;
	return Array.isArray(json) && json[0] === "Measurement";
}
function cancellationResult(error) {
	if (error instanceof CancellationError) {
		if (error.cause === "timeout" || error.cause === "step-budget") return {
			status: "timeout",
			message: "The calculation took too long and was stopped."
		};
		return {
			status: "cancelled",
			message: "Cancelled."
		};
	}
	if (error instanceof Error && error.name === "AbortError") return {
		status: "cancelled",
		message: "Cancelled."
	};
	return {
		status: "invalid",
		message: "The calculation stopped because of an engine error."
	};
}
function joinMessages(left, right) {
	return left ? `${left} ${right}` : right;
}
export { parseAction, runOperation };
