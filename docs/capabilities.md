# Capabilities

Recorded from the fixture run in `tests/engine.test.ts` against the pinned libraries. A command is offered in the action line only when that fixture passed.

- `mathlive` 0.111.1
- `@cortex-js/compute-engine` 0.173.0

Each request builds a new `ComputeEngine`. The free functions (`evaluate`, `N`, `simplify`, `expand`) are unused because they share one engine. `compile()` and `@cortex-js/compute-engine/kernel-worker` are unused because they construct functions with `new Function`.

## Verified operations

| Action | Input | Result |
| --- | --- | --- |
| `calculate` | `\frac{1}{2}+\frac{1}{3}` | success, `\frac{5}{6}`, exact |
| `differentiate x` | `x^2` | success, `2x` |
| `differentiate x` | `\frac{d}{dx} x^2` | success, `2x` (evaluated once, not differentiated again) |
| `integrate x` on a written integral | `\int_0^1 x \, dx` | success, `\frac{1}{2}` |
| `integrate x from 0 to 1` | `x^2` | success, `\frac{1}{3}` |
| `integrate x` | `x^2` | success, `\frac{x^3}{3}`, with the antiderivative restriction below |
| `limit x to 0` | `\frac{\sin x}{x}` | success, `1` |
| `calculate` | `\lim_{x\to 0} \frac{1}{x}` | unevaluated, the limit expression is kept |
| `simplify` | `2x+1` | success, `2x+1` (unchanged is still success) |
| `simplify` | `\frac{x^2-1}{x-1}` | success, `x+1`, with the exclusion restriction below |
| `expand` | `(a+b)^2` | success, a result containing `a^2`, `b^2`, and `2ab` |
| `approximate` | `\sqrt{2}` | success, a decimal beginning `1.414`, marked approximate |
| `approximate` | `x+1` | unevaluated, no result (the unknown stays a symbol) |
| `solve for x` | `x^2-1=0` | success, a list containing `1` and `-1` |
| `solve for x` | `x+1=x` | success, message “No solution.”, no result latex |
| `determinant` | `\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}` | success, `-2` |
| `inverse` | `\begin{pmatrix} 2 & 1 \\ 1 & 3 \end{pmatrix}` | success, a matrix containing `\frac{3}{5}` |
| `determinant` | a 2×3 matrix | invalid, no result latex |
| `inverse` | `\begin{pmatrix} 1 & 2 \\ 2 & 4 \end{pmatrix}` | unevaluated |
| `calculate` | a placeholder, or an empty field | incomplete, no result |
| `calculate` | `\frac{1}{2}+` | invalid, no result |
| `calculate` with a 40ms limit | `\sum_{k=1}^{5000000} k` | timeout, no result |
| already-aborted signal | `1+1` | cancelled |

## Restrictions the fixtures exposed

- Exact arithmetic stays rational. `calculate` of one half plus one third is `\frac{5}{6}`. A decimal comes only from `approximate`, and that outcome sets `approximate: true`.
- `approximate` leaves unknown symbols alone. It does not substitute a number for `x`.
- An antiderivative is returned without a constant of integration. The outcome says so in `restrictions`. The latex is `\frac{x^3}{3}` for `x^2`, with no `+C` appended.
- Simplifying `\frac{x^2-1}{x-1}` yields `x+1`. The restriction text is “Equivalent where the original expression is defined. Excluded points are not listed.” A rational number with no unknowns, such as a cancelled `2/4`, does not get that note.
- A numeric definite integral can come back as a `Measurement` (a value with an error bound). That form is marked approximate. The definite fixtures above closed exactly, so they are not marked approximate.
- Solver output is the principal solutions the engine returns. The message on a list of roots says so. An empty list is “No solution.” and does not invent a latex value. `null` from the solver is `unevaluated`.
- An expression with no `=` is solved as `expression = 0`. The outcome message says that.
- A singular inverse stays an `Inverse` expression and is `unevaluated`. A non-square determinant is `invalid` (“This operation needs a square matrix.”).
- A limit or integral the engine cannot close stays that expression and is `unevaluated`. It is not reported as a solved value.
- Action-line variables are one letter, `a` through `z`. `pi` in a bound is sent to the engine as `\pi`. A word such as `theta` is `missing-parameters`.

## Editor assets

MathLive’s `fonts.css` is the one document-level stylesheet. The component’s own rules stay in the shadow root. The library build places that font stylesheet in `dist/common-math.css` and copies MathLive’s font files to `dist/fonts` for the directory MathLive uses when fonts are not already declared.
