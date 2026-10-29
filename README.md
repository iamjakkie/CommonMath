# Common Math

`<common-math>` is an embeddable mathematics editor. You write notation in one field, then name an action such as `calculate` or `differentiate x`. Evaluation runs in a Web Worker with a fresh [Compute Engine](https://cortexjs.io/compute-engine/) on every request. [MathLive](https://mathlive.io/) owns the notation. The expression you typed stays as you typed it.

The demo page hosts three independent editors. It is not the product.

## Run the demo

```sh
npm install
npm run dev
```

Open the URL Vite prints (the tests use `http://127.0.0.1:5173`). The page has a full-width scratchpad, an editor inside an article, and one inside a 320px card. The host page styles `input`, `button`, and `math-field` aggressively so the shadow tree can be checked in isolation. The event log under the editors is ordinary page text.

## Tests

```sh
npm test
npm run test:browser
```

`npm test` runs the command grammar, revision checks, and Compute Engine fixtures in Vitest. `npm run test:browser` builds `dist/` and runs Playwright against the demo and against the built files served from a nested URL. Chromium has to be installed for Playwright (`npx playwright install chromium` once). What those fixtures actually returned is written in [docs/capabilities.md](docs/capabilities.md).

## Embed the build

`npm run build` writes a browser ES module and a worker chunk. Serve the whole `dist/` directory. Paths are relative to the module, so the folder can live anywhere on the host.

```html
<link rel="stylesheet" href="./common-math.css" />
<common-math value="\frac{1}{2}+\frac{1}{3}" action="calculate" aria-label="Example"></common-math>
<script type="module" src="./common-math.js"></script>
```

- `common-math.js` registers the element. It loads the worker with `import.meta.url`, which the build emits as `assets/compute.worker-….js` beside that file. Keep the `assets/` chunk next to the module.
- `common-math.css` is the one document-level stylesheet. It carries MathLive’s `@font-face` rules. Link it from the host page. Component color, type, and layout stay inside the shadow root and do not restyle the page.
- `fonts/` is a copy of MathLive’s font files. Leave it next to the script. MathLive looks there only when the font faces from the stylesheet are not already available.

A check page is generated at `dist/nested/index.html`. It links `../common-math.css` and `../common-math.js`, so the same files work one directory down.

From TypeScript, `import "common-math"` also registers the element and exports `defineCommonMath`, `CommonMathElement`, and the outcome types.

## Element API

Attributes and properties: `value` (LaTeX), `action`, `theme` (`light`, `dark`, or `system`). Setting them does not run a calculation. `aria-label` on the host is copied to the math field. The element does not autofocus.

Methods: `focus()`, `execute(): Promise<CalculationOutcome>`, `clear()`.

Events bubble and are composed, so a listener on `document` hears them from inside the shadow tree:

| Event | Detail |
| --- | --- |
| `common-math:change` | `{ value, action, revision }` |
| `common-math:result` | `{ outcome }` |
| `common-math:error` | `{ message, outcome? }` — dispatched for `invalid` and `timeout` |

`CalculationOutcome` fields: `status`, `sourceLatex`, `action`, `interpretedLatex?`, `resultLatex?`, `approximate?`, `message?`, `restrictions?`, `revision`.

`status` is one of `success`, `incomplete`, `invalid`, `missing-parameters`, `unsupported`, `unevaluated`, `timeout`, `cancelled`.

The host sets `data-state` to `empty`, `editing`, `ready`, `running`, `result`, `stale`, `unsupported`, or `error`. Editing after a result marks that result stale. A late worker reply whose revision or request id is older is dropped.

CSS variables on the host: `--cm-surface`, `--cm-raised`, `--cm-text`, `--cm-muted`, `--cm-accent`, `--cm-accent-soft`, `--cm-line`, `--cm-danger`, `--cm-font`, `--cm-ui`, `--cm-space`, `--cm-radius`.

## Writing and actions

`/` starts a fraction. Leave the fraction with the Right arrow before typing the next term. `sqrt`, `int`, and `lim` insert a structure when typed after a boundary (space, an operator, a fence, a digit), so they do not expand inside a name. Ctrl/Cmd+K, while focus is inside the component, opens a palette for a square root, integral, limit, or matrix. Ctrl/Cmd+Enter runs the action. Enter in the action line runs the typed command. Escape closes the palette and returns focus to where it was. Undo and redo are the field’s own.

The action vocabulary, all covered by fixtures:

`calculate`, `approximate`, `simplify`, `expand`, `differentiate x`, `solve for x`, `integrate x`, `integrate x from 0 to 1`, `limit x to 0`, `determinant`, `inverse`.

A written integral, derivative, or limit is evaluated once. The same action does not wrap it a second time. A missing variable or bound becomes `missing-parameters` and the action line asks for it. Anything outside this grammar is `unsupported`, and the expression stays.
