export const COMPONENT_CSS = `
:host {
  --cm-surface: #f6f3ee;
  --cm-raised: #fffdfb;
  --cm-text: #1c1917;
  --cm-muted: #6b6560;
  --cm-accent: #0f766e;
  --cm-accent-soft: rgba(15, 118, 110, 0.12);
  --cm-line: #e4ddd2;
  --cm-danger: #9f1239;
  --cm-font: "Iowan Old Style", Palatino, "Palatino Linotype", Georgia, serif;
  --cm-ui: "Segoe UI", system-ui, sans-serif;
  --cm-space: 12px;
  --cm-radius: 14px;
  display: block;
  box-sizing: border-box;
  max-width: 100%;
  color: var(--cm-text);
  background: var(--cm-surface);
  font-family: var(--cm-ui);
  font-size: 15px;
  line-height: 1.4;
  border-radius: var(--cm-radius);
  padding: var(--cm-space);
  color-scheme: light;
}
:host([theme="dark"]) {
  --cm-surface: #1c1917;
  --cm-raised: #292524;
  --cm-text: #f5f0e8;
  --cm-muted: #a8a29e;
  --cm-accent: #2dd4bf;
  --cm-accent-soft: rgba(45, 212, 191, 0.16);
  --cm-line: #44403c;
  --cm-danger: #fb7185;
  color-scheme: dark;
}
@media (prefers-color-scheme: dark) {
  :host([theme="system"]),
  :host(:not([theme])) {
    --cm-surface: #1c1917;
    --cm-raised: #292524;
    --cm-text: #f5f0e8;
    --cm-muted: #a8a29e;
    --cm-accent: #2dd4bf;
    --cm-accent-soft: rgba(45, 212, 191, 0.16);
    --cm-line: #44403c;
    --cm-danger: #fb7185;
    color-scheme: dark;
  }
}
:host([theme="light"]) {
  --cm-surface: #f6f3ee;
  --cm-raised: #fffdfb;
  --cm-text: #1c1917;
  --cm-muted: #6b6560;
  --cm-accent: #0f766e;
  --cm-accent-soft: rgba(15, 118, 110, 0.12);
  --cm-line: #e4ddd2;
  --cm-danger: #9f1239;
  color-scheme: light;
}
*, *::before, *::after { box-sizing: border-box; }
.shell {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  color: var(--cm-text);
  font-family: var(--cm-ui);
  background: var(--cm-surface);
}
.surface {
  background: var(--cm-raised);
  border-radius: calc(var(--cm-radius) - 4px);
  padding: 8px 10px 4px;
  min-width: 0;
}
.surface:focus-within {
  box-shadow: 0 0 0 2px var(--cm-accent);
}
math-field {
  display: block;
  width: 100%;
  min-height: 2.4em;
  font-size: 1.85rem;
  color: var(--cm-text);
  background: transparent;
  border: 0;
  overflow-x: auto;
}
math-field::part(virtual-keyboard-toggle) { display: none; }
math-field:focus { outline: none; }
.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  min-width: 0;
}
.action-label {
  position: relative;
  display: flex;
  flex: 1 1 160px;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--cm-muted);
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.action {
  flex: 1;
  min-width: 0;
  border: 0;
  border-bottom: 1px solid var(--cm-line);
  background: transparent;
  color: var(--cm-text);
  font: 15px/1.4 var(--cm-ui);
  padding: 6px 2px;
  border-radius: 0;
}
.action:focus {
  outline: none;
  border-bottom-color: var(--cm-accent);
}
button {
  font: 13px/1 var(--cm-ui);
  color: var(--cm-text);
  background: transparent;
  border: 1px solid var(--cm-line);
  border-radius: 999px;
  padding: 7px 12px;
  cursor: pointer;
}
button:focus-visible {
  outline: 2px solid var(--cm-accent);
  outline-offset: 2px;
}
button.run {
  color: var(--cm-accent);
  border-color: transparent;
  background: var(--cm-accent-soft);
}
button:disabled { opacity: 0.45; cursor: default; }
.hint, .note, .result-label, .restrictions, .suggest, .palette, .menu {
  color: var(--cm-muted);
  font-size: 12px;
}
.hint { margin: 0; min-height: 1.2em; }
.result {
  border-top: 1px solid var(--cm-line);
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.result[hidden], .suggest[hidden], .palette[hidden], .menu[hidden], .matrix-form[hidden] { display: none; }
.result-label {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 11px;
}
.result-math, .interpreted-math {
  color: var(--cm-text);
  font-size: 1.65rem;
  overflow-x: auto;
  min-width: 0;
}
.result.stale .result-math { opacity: 0.55; }
.note, .restrictions { margin: 0; }
.restrictions { padding-left: 1.1em; }
.note.error { color: var(--cm-danger); }
.suggest, .palette, .menu {
  position: absolute;
  z-index: 2;
  margin: 0;
  padding: 6px;
  list-style: none;
  background: var(--cm-raised);
  color: var(--cm-text);
  border: 1px solid var(--cm-line);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(28, 25, 23, 0.08);
  max-height: 220px;
  overflow: auto;
}
.suggest {
  top: calc(100% + 4px);
  left: 0;
  right: 0;
}
.palette, .menu {
  top: 8px;
  left: 0;
  right: 0;
}
.suggest button, .palette button, .menu button {
  display: flex;
  width: 100%;
  text-align: left;
  border: 0;
  border-radius: 8px;
  padding: 8px;
  gap: 8px;
  align-items: baseline;
  background: transparent;
  color: var(--cm-text);
}
.suggest button[aria-selected="true"],
.palette button[aria-selected="true"],
.suggest button:hover,
.palette button:hover,
.menu button:hover {
  background: var(--cm-accent-soft);
}
.item-hint { color: var(--cm-muted); font-size: 12px; margin-left: auto; }
.palette-filter, .matrix-form input {
  width: 100%;
  border: 0;
  border-bottom: 1px solid var(--cm-line);
  background: transparent;
  color: var(--cm-text);
  font: 14px/1.4 var(--cm-ui);
  padding: 6px 4px;
  margin-bottom: 4px;
}
.matrix-form { display: flex; gap: 8px; align-items: end; padding: 4px; }
.matrix-form label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--cm-muted); flex: 1; }
@container (max-width: 360px) {
  math-field { font-size: 1.35rem; }
  .result-math, .interpreted-math { font-size: 1.25rem; }
}
.shell { container-type: inline-size; }
`;
