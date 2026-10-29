import "mathlive";
import { convertLatexToMarkup, type MathfieldElement } from "mathlive";
import staticCss from "mathlive/static.css?raw";
import { parseAction } from "../commands/parse-action";
import { suggestCommands } from "../commands/suggest";
import { configureMathfield } from "../editor/configure-field";
import { STRUCTURES, matrixLatex } from "../editor/templates";
import { responseIsCurrent } from "../engine/revision";
import type {
  CalculationOutcome,
  CommonMathChangeDetail,
  CommonMathErrorDetail,
  CommonMathResultDetail,
  ThemeName,
} from "../types/public";
import { ComputeClient } from "../worker/client";
import { COMPONENT_CSS } from "./styles";

const TIMEOUT_MS = 8000;

type ViewState =
  | "empty"
  | "editing"
  | "ready"
  | "running"
  | "result"
  | "stale"
  | "unsupported"
  | "error";

const layoutCss = staticCss.replace(/@font-face\{[^}]*\}/g, "");

function sharedSheets(): CSSStyleSheet[] {
  const layout = new CSSStyleSheet();
  layout.replaceSync(layoutCss);
  const component = new CSSStyleSheet();
  component.replaceSync(COMPONENT_CSS);
  return [layout, component];
}

let sheets: CSSStyleSheet[] | null = null;

function markup(latex: string): string {
  try {
    return convertLatexToMarkup(latex, { defaultMode: "math" });
  } catch {
    return "";
  }
}

function setMath(element: HTMLElement, latex: string): void {
  const html = markup(latex);
  if (html) element.innerHTML = html;
  else element.textContent = latex;
}

export class CommonMathElement extends HTMLElement {
  private client = new ComputeClient();
  private latex = "";
  private actionText = "";
  private revision = 0;
  private requestSeq = 0;
  private acceptedRequestId: string | null = null;
  private runningId: string | null = null;
  private displayed: CalculationOutcome | null = null;
  private booted = false;
  private reflecting = false;
  private paletteOpen = false;
  private menuOpen = false;
  private suggestionsOpen = false;
  private suggestionIndex = 0;
  private suggestionMoved = false;
  private paletteIndex = 0;
  private paletteMode: "list" | "size" = "list";
  private focusBeforePalette: HTMLElement | null = null;
  private transient = "";

  private field!: MathfieldElement;
  private actionInput!: HTMLInputElement;
  private suggestEl!: HTMLElement;
  private hintEl!: HTMLElement;
  private resultEl!: HTMLElement;
  private resultLabel!: HTMLElement;
  private interpretedEl!: HTMLElement;
  private interpretedMath!: HTMLElement;
  private resultMath!: HTMLElement;
  private noteEl!: HTMLElement;
  private restrictionsEl!: HTMLElement;
  private runButton!: HTMLButtonElement;
  private moreButton!: HTMLButtonElement;
  private menuEl!: HTMLElement;
  private paletteEl!: HTMLElement;
  private paletteFilter!: HTMLInputElement;
  private paletteList!: HTMLElement;
  private matrixForm!: HTMLFormElement;
  private rowsInput!: HTMLInputElement;
  private colsInput!: HTMLInputElement;

  static get observedAttributes(): string[] {
    return ["value", "action", "theme", "aria-label"];
  }

  get value(): string {
    return this.latex;
  }

  set value(next: string) {
    this.writeLatex(next ?? "", false);
  }

  get action(): string {
    return this.actionText;
  }

  set action(next: string) {
    this.writeAction(next ?? "", true);
  }

  get theme(): ThemeName {
    const value = this.getAttribute("theme");
    return value === "light" || value === "dark" || value === "system" ? value : "system";
  }

  set theme(next: ThemeName) {
    this.setAttribute("theme", next);
  }

  connectedCallback(): void {
    if (!this.shadowRoot) {
      const shadow = this.attachShadow({ mode: "open" });
      sheets ??= sharedSheets();
      shadow.adoptedStyleSheets = sheets;
      shadow.innerHTML = TEMPLATE;
      this.cache(shadow);
      configureMathfield(this.field);
      shadow.addEventListener("keydown", this.onKeyDown, true);
      this.field.addEventListener("input", this.onFieldInput);
      this.actionInput.addEventListener("input", this.onActionInput);
      this.actionInput.addEventListener("focus", this.onActionFocus);
      this.actionInput.addEventListener("blur", this.onActionBlur);
      this.runButton.addEventListener("click", this.onRunClick);
      this.moreButton.addEventListener("click", this.onMoreClick);
      this.paletteFilter.addEventListener("input", () => this.renderPalette());
      this.matrixForm.addEventListener("submit", this.onMatrixSubmit);
      shadow.addEventListener("click", this.onShadowClick);
    }
    this.applyAttribute("value", this.getAttribute("value") ?? this.latex, false);
    this.applyAttribute("action", this.getAttribute("action") ?? this.actionText, false);
    this.applyAttribute("aria-label", this.getAttribute("aria-label"), false);
    this.booted = true;
    this.renderChrome();
  }

  disconnectedCallback(): void {
    this.client.dispose();
    this.client = new ComputeClient();
    this.runningId = null;
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (!this.shadowRoot || this.reflecting || !this.booted) return;
    this.applyAttribute(name, value, true);
  }

  focus(): void {
    const sink = this.field?.shadowRoot?.querySelector(".ML__keyboard-sink");
    if (sink instanceof HTMLElement) sink.focus({ preventScroll: true });
    else this.field?.focus();
  }

  clear(): void {
    this.writeLatex("", false);
    this.displayed = null;
    this.transient = "";
    this.renderChrome();
  }

  async execute(): Promise<CalculationOutcome> {
    const revision = this.revision;
    const id = String(++this.requestSeq);
    this.acceptedRequestId = id;
    const sourceLatex = this.latex;
    const action = this.actionText;
    const parsed = parseAction(action);
    if (!parsed.ok) {
      if (parsed.status === "missing-parameters") this.writeAction(parsed.resume, true);
      const outcome: CalculationOutcome = {
        status: parsed.status === "unsupported" ? "unsupported" : "missing-parameters",
        sourceLatex,
        action,
        revision,
        message: parsed.message,
      };
      this.publish(id, revision, outcome);
      return outcome;
    }
    if (this.runningId) this.client.abort(this.runningId);
    this.runningId = id;
    this.transient = "";
    this.renderChrome();
    const result = await this.client.run({
      id,
      revision,
      latex: sourceLatex,
      operation: parsed.operation,
      timeoutMs: TIMEOUT_MS,
    });
    const outcome: CalculationOutcome = {
      ...result,
      sourceLatex,
      action,
      revision,
    };
    this.publish(id, revision, outcome);
    return outcome;
  }

  private publish(id: string, revision: number, outcome: CalculationOutcome): void {
    if (this.runningId === id) this.runningId = null;
    const currentId = this.acceptedRequestId ?? "";
    if (!responseIsCurrent({ id, revision }, { id: currentId, revision: this.revision })) return;
    this.displayed = outcome;
    this.dispatch("common-math:result", { outcome } satisfies CommonMathResultDetail);
    if (outcome.status === "invalid" || outcome.status === "timeout") {
      this.dispatch("common-math:error", {
        message: outcome.message ?? "The calculation could not be completed.",
        outcome,
      } satisfies CommonMathErrorDetail);
    }
    this.renderChrome();
  }

  private writeLatex(latex: string, fromField: boolean): void {
    if (fromField && latex === this.latex) return;
    const changed = latex !== this.latex;
    this.latex = latex;
    if (!fromField && this.field && this.field.value !== latex) {
      this.reflecting = true;
      this.field.value = latex;
      this.reflecting = false;
    }
    this.reflectAttribute("value", latex);
    if (changed && this.booted) {
      this.revision += 1;
      if (this.runningId) this.client.abort(this.runningId);
      this.emitChange();
      this.renderChrome();
    }
  }

  private writeAction(action: string, emit: boolean): void {
    if (action === this.actionText && this.actionInput?.value === action) return;
    this.actionText = action;
    if (this.actionInput && this.actionInput.value !== action) this.actionInput.value = action;
    this.reflectAttribute("action", action);
    if (emit && this.booted) this.emitChange();
  }

  private applyAttribute(name: string, value: string | null, emit: boolean): void {
    if (name === "value") this.writeLatex(value ?? "", false);
    if (name === "action") this.writeAction(value ?? "", emit);
    if (name === "aria-label" && this.field) {
      this.field.setAttribute("aria-label", value || "Mathematical expression");
    }
  }

  private reflectAttribute(name: string, value: string): void {
    if (this.getAttribute(name) === value) return;
    this.reflecting = true;
    if (value) this.setAttribute(name, value);
    else this.removeAttribute(name);
    this.reflecting = false;
  }

  private emitChange(): void {
    this.dispatch("common-math:change", {
      value: this.latex,
      action: this.actionText,
      revision: this.revision,
    } satisfies CommonMathChangeDetail);
  }

  private dispatch(name: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private cache(shadow: ShadowRoot): void {
    this.field = shadow.querySelector("math-field") as MathfieldElement;
    this.actionInput = shadow.querySelector(".action") as HTMLInputElement;
    this.suggestEl = shadow.querySelector(".suggest") as HTMLElement;
    this.hintEl = shadow.querySelector(".hint") as HTMLElement;
    this.resultEl = shadow.querySelector(".result") as HTMLElement;
    this.resultLabel = shadow.querySelector(".result-label") as HTMLElement;
    this.interpretedEl = shadow.querySelector(".interpreted") as HTMLElement;
    this.interpretedMath = shadow.querySelector(".interpreted-math") as HTMLElement;
    this.resultMath = shadow.querySelector(".result-math") as HTMLElement;
    this.noteEl = shadow.querySelector(".note") as HTMLElement;
    this.restrictionsEl = shadow.querySelector(".restrictions") as HTMLElement;
    this.runButton = shadow.querySelector(".run") as HTMLButtonElement;
    this.moreButton = shadow.querySelector(".more") as HTMLButtonElement;
    this.menuEl = shadow.querySelector(".menu") as HTMLElement;
    this.paletteEl = shadow.querySelector(".palette") as HTMLElement;
    this.paletteFilter = shadow.querySelector(".palette-filter") as HTMLInputElement;
    this.paletteList = shadow.querySelector(".palette-list") as HTMLElement;
    this.matrixForm = shadow.querySelector(".matrix-form") as HTMLFormElement;
    this.rowsInput = shadow.querySelector(".rows") as HTMLInputElement;
    this.colsInput = shadow.querySelector(".cols") as HTMLInputElement;
    this.field.setAttribute("aria-label", this.getAttribute("aria-label") || "Mathematical expression");
  }

  private onFieldInput = (): void => {
    if (this.reflecting || !this.booted) return;
    this.writeLatex(this.field.value, true);
  };

  private onActionInput = (): void => {
    this.actionText = this.actionInput.value;
    this.reflectAttribute("action", this.actionText);
    this.suggestionsOpen = true;
    this.suggestionIndex = 0;
    this.suggestionMoved = false;
    this.emitChange();
    this.renderSuggestions();
  };

  private onActionFocus = (): void => {
    this.suggestionsOpen = true;
    this.suggestionIndex = 0;
    this.renderSuggestions();
  };

  private onActionBlur = (): void => {
    window.setTimeout(() => {
      if (this.shadowRoot?.activeElement === this.actionInput) return;
      this.suggestionsOpen = false;
      this.renderSuggestions();
    }, 120);
  };

  private onRunClick = (): void => {
    if (this.runningId) {
      this.client.abort(this.runningId);
      return;
    }
    void this.execute();
  };

  private onMoreClick = (): void => {
    this.menuOpen = !this.menuOpen;
    this.renderMenu();
  };

  private onShadowClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest(".menu") || target.closest(".more")) return;
    if (this.menuOpen) {
      this.menuOpen = false;
      this.renderMenu();
    }
  };

  private onMatrixSubmit = (event: Event): void => {
    event.preventDefault();
    const rows = Number(this.rowsInput.value);
    const columns = Number(this.colsInput.value);
    this.insertLatex(matrixLatex(rows, columns));
  };

  private onKeyDown = (event: Event): void => {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.isComposing || event.keyCode === 229) return;
    const key = event.key;
    const mod = event.ctrlKey || event.metaKey;
    if (mod && key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      void this.execute();
      return;
    }
    if (mod && key.toLowerCase() === "k" && !event.altKey) {
      event.preventDefault();
      event.stopPropagation();
      this.togglePalette();
      return;
    }
    if (key === "Escape") {
      if (this.suggestionsOpen) {
        this.suggestionsOpen = false;
        this.renderSuggestions();
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (this.paletteOpen) {
        event.preventDefault();
        event.stopPropagation();
        this.closePalette();
        return;
      }
      if (this.menuOpen) {
        event.preventDefault();
        event.stopPropagation();
        this.menuOpen = false;
        this.renderMenu();
        this.moreButton.focus();
        return;
      }
      event.stopPropagation();
      return;
    }
    if (this.paletteOpen && this.paletteEl.contains(event.target as Node)) {
      this.onPaletteKey(event);
      return;
    }
    if (event.target === this.field && key === "Tab") {
      this.onFieldTab(event);
      return;
    }
    if (event.target === this.actionInput) {
      this.onActionKey(event);
    }
  };

  private onFieldTab(event: KeyboardEvent): void {
    if (event.shiftKey) {
      event.stopPropagation();
      return;
    }
    if (this.field.value.includes("\\placeholder")) {
      const moved = this.field.executeCommand("moveToNextPlaceholder");
      if (moved) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }
    event.preventDefault();
    event.stopPropagation();
    this.actionInput.focus();
  }

  private onActionKey(event: KeyboardEvent): void {
    const suggestions = suggestCommands(this.actionInput.value);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!this.suggestionsOpen) this.suggestionsOpen = true;
      if (suggestions.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      this.suggestionIndex = (this.suggestionIndex + delta + suggestions.length) % suggestions.length;
      this.suggestionMoved = true;
      this.renderSuggestions();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      const selected = suggestions[this.suggestionIndex];
      if (this.suggestionMoved && this.suggestionsOpen && selected) {
        this.writeAction(selected.insert, true);
      }
      this.suggestionsOpen = false;
      this.suggestionMoved = false;
      this.renderSuggestions();
      void this.execute();
    }
  }

  private onPaletteKey(event: KeyboardEvent): void {
    if (this.paletteMode === "size") return;
    const items = this.visibleStructures();
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (items.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      this.paletteIndex = (this.paletteIndex + delta + items.length) % items.length;
      this.renderPalette();
    } else if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      const item = items[this.paletteIndex];
      if (item) this.chooseStructure(item.id);
    }
  }

  private togglePalette(): void {
    if (this.paletteOpen) this.closePalette();
    else this.openPalette();
  }

  private openPalette(): void {
    this.focusBeforePalette = (this.shadowRoot?.activeElement as HTMLElement | null) ?? this.field;
    this.paletteOpen = true;
    this.paletteMode = "list";
    this.paletteIndex = 0;
    this.paletteFilter.value = "";
    this.menuOpen = false;
    this.renderMenu();
    this.renderPalette();
    this.paletteFilter.focus();
  }

  private closePalette(): void {
    const previous = this.focusBeforePalette;
    this.focusBeforePalette = null;
    this.paletteOpen = false;
    this.paletteMode = "list";
    this.renderPalette();
    if (previous && previous !== this.field && previous !== this.paletteFilter && this.shadowRoot?.contains(previous)) {
      previous.focus();
      return;
    }
    this.focus();
  }

  private visibleStructures() {
    const query = this.paletteFilter.value.trim().toLowerCase();
    if (!query) return [...STRUCTURES];
    return STRUCTURES.filter((item) => item.label.toLowerCase().includes(query) || item.hint.toLowerCase().includes(query));
  }

  private chooseStructure(id: string): void {
    if (id === "matrix-n") {
      this.paletteMode = "size";
      this.renderPalette();
      this.rowsInput.focus();
      return;
    }
    const item = STRUCTURES.find((entry) => entry.id === id);
    if (item?.latex) this.insertLatex(item.latex);
  }

  private insertLatex(latex: string): void {
    this.field.insert(latex, {
      selectionMode: "placeholder",
      focus: true,
      format: "latex",
      feedback: false,
    });
    this.writeLatex(this.field.value, true);
    this.closePalette();
  }

  private viewState(): ViewState {
    if (this.runningId) return "running";
    const latex = this.latex.trim();
    if (this.displayed && this.displayed.revision !== this.revision) return "stale";
    if (this.displayed) {
      switch (this.displayed.status) {
        case "unsupported":
          return "unsupported";
        case "invalid":
        case "timeout":
          return "error";
        case "success":
        case "unevaluated":
          return "result";
        case "incomplete":
        case "missing-parameters":
          return latex ? "editing" : "empty";
        case "cancelled":
          return latex ? "ready" : "empty";
        default:
          break;
      }
    }
    if (!latex) return "empty";
    if (latex.includes("\\placeholder")) return "editing";
    return "ready";
  }

  private renderChrome(): void {
    const state = this.viewState();
    this.dataset.state = state;
    if (this.displayed) this.dataset.status = this.displayed.status;
    else delete this.dataset.status;
    this.setAttribute("aria-busy", state === "running" ? "true" : "false");
    this.runButton.textContent = state === "running" ? "Cancel" : "Run";
    this.hintEl.textContent = this.transient || hintFor(state, this.latex);
    this.renderResult(state);
    this.renderSuggestions();
    this.renderPalette();
    this.renderMenu();
  }

  private renderResult(state: ViewState): void {
    const outcome = this.displayed;
    const show = Boolean(outcome && (outcome.resultLatex || outcome.message || outcome.interpretedLatex));
    this.resultEl.hidden = !show;
    this.resultEl.classList.toggle("stale", state === "stale");
    if (!outcome || !show) return;
    this.resultLabel.textContent = resultLabel(state, outcome);
    if (outcome.interpretedLatex) {
      this.interpretedEl.hidden = false;
      setMath(this.interpretedMath, outcome.interpretedLatex);
    } else {
      this.interpretedEl.hidden = true;
      this.interpretedMath.replaceChildren();
    }
    if (outcome.resultLatex) {
      this.resultMath.hidden = false;
      setMath(this.resultMath, outcome.resultLatex);
      this.resultMath.dataset.latex = outcome.resultLatex;
    } else {
      this.resultMath.hidden = true;
      this.resultMath.replaceChildren();
      delete this.resultMath.dataset.latex;
    }
    this.noteEl.textContent = outcome.message ?? "";
    this.noteEl.classList.toggle("error", outcome.status === "invalid" || outcome.status === "timeout");
    this.restrictionsEl.replaceChildren();
    for (const restriction of outcome.restrictions ?? []) {
      const item = document.createElement("li");
      item.textContent = restriction;
      this.restrictionsEl.append(item);
    }
  }

  private renderSuggestions(): void {
    const commands = suggestCommands(this.actionInput.value);
    this.suggestEl.hidden = !this.suggestionsOpen || commands.length === 0;
    this.suggestEl.replaceChildren();
    if (this.suggestEl.hidden) return;
    commands.forEach((command, index) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", index === this.suggestionIndex ? "true" : "false");
      button.textContent = command.label;
      const hint = document.createElement("span");
      hint.className = "item-hint";
      hint.textContent = command.hint;
      button.append(hint);
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        this.writeAction(command.insert, true);
        this.suggestionsOpen = false;
        this.renderSuggestions();
        this.actionInput.focus();
      });
      item.append(button);
      this.suggestEl.append(item);
    });
  }

  private renderPalette(): void {
    this.paletteEl.hidden = !this.paletteOpen;
    this.paletteEl.setAttribute("aria-hidden", this.paletteOpen ? "false" : "true");
    const items = this.visibleStructures();
    if (this.paletteIndex >= items.length) this.paletteIndex = 0;
    this.paletteList.replaceChildren();
    this.matrixForm.hidden = this.paletteMode !== "size";
    items.forEach((item, index) => {
      const row = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", index === this.paletteIndex ? "true" : "false");
      button.textContent = item.label;
      const hint = document.createElement("span");
      hint.className = "item-hint";
      hint.textContent = item.hint;
      button.append(hint);
      button.addEventListener("click", () => this.chooseStructure(item.id));
      row.append(button);
      this.paletteList.append(row);
    });
  }

  private renderMenu(): void {
    this.menuEl.hidden = !this.menuOpen;
    this.moreButton.setAttribute("aria-expanded", this.menuOpen ? "true" : "false");
    if (!this.menuOpen || this.menuEl.childElementCount > 0) return;
    this.menuEl.replaceChildren();
    this.menuEl.append(
      menuButton("Copy expression LaTeX", () => {
        void this.copyText(this.latex, "Expression LaTeX copied.");
      }),
      menuButton("Copy result LaTeX", () => {
        const latex = this.displayed?.resultLatex;
        if (!latex) {
          this.transient = "There is no result to copy.";
          this.renderChrome();
          return;
        }
        void this.copyText(latex, "Result LaTeX copied.");
      }),
      menuButton("Add matrix row", () => this.editMatrix("addRowAfter")),
      menuButton("Add matrix column", () => this.editMatrix("addColumnAfter")),
    );
  }

  private editMatrix(command: "addRowAfter" | "addColumnAfter"): void {
    const changed = this.field.executeCommand(command);
    this.menuOpen = false;
    this.renderMenu();
    if (!changed) {
      this.transient = "Move into a matrix cell, then add a row or column.";
      this.renderChrome();
      return;
    }
    this.writeLatex(this.field.value, true);
    this.field.focus();
  }

  private async copyText(value: string, success: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.transient = success;
    } catch {
      this.transient = "Copying was blocked by the browser.";
    }
    this.menuOpen = false;
    this.renderChrome();
  }
}

function hintFor(state: ViewState, latex: string): string {
  if (latex.includes("\\begin{pmatrix}") || latex.includes("\\begin{bmatrix}")) {
    return "Arrow keys move between matrix cells. Add a row or column from the menu.";
  }
  switch (state) {
    case "empty":
      return "Type mathematics. / makes a fraction. Ctrl/Cmd+K inserts a structure.";
    case "editing":
      return "Fill the boxes, or choose an action below.";
    case "ready":
      return "Choose an action, then press Enter.";
    case "running":
      return "Calculating. Cancel stops this run.";
    case "stale":
      return "The expression changed. Run the action again.";
    case "unsupported":
      return "The expression is still here.";
    case "error":
      return "The expression is still here.";
    default:
      return "";
  }
}

function resultLabel(state: ViewState, outcome: CalculationOutcome): string {
  if (state === "stale") return "Previous result";
  if (outcome.approximate) return "Approximate";
  if (outcome.status === "unevaluated") return "Unevaluated";
  if (outcome.status === "unsupported") return "Unsupported";
  if (outcome.status === "invalid" || outcome.status === "timeout") return "Not evaluated";
  if (outcome.status === "success") return "Result";
  return "Note";
}

function menuButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.role = "menuitem";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

const TEMPLATE = `
<div class="shell">
  <div class="surface">
    <math-field part="expression"></math-field>
  </div>
  <div class="action-row">
    <label class="action-label">Action
      <input class="action" part="action" type="text" autocomplete="off" spellcheck="false" aria-autocomplete="list" />
      <ul class="suggest" role="listbox" hidden></ul>
    </label>
    <button class="run" type="button">Run</button>
    <button class="more" type="button" aria-haspopup="menu" aria-expanded="false">More</button>
  </div>
  <p class="hint"></p>
  <div class="result" part="result" hidden>
    <p class="interpreted">Interpreted as</p>
    <div class="interpreted-math"></div>
    <p class="result-label"></p>
    <div class="result-math" aria-live="polite"></div>
    <p class="note"></p>
    <ul class="restrictions"></ul>
  </div>
  <div class="palette" role="dialog" aria-label="Insert a structure" hidden>
    <input class="palette-filter" type="text" aria-label="Filter structures" autocomplete="off" />
    <ul class="palette-list" role="listbox"></ul>
    <form class="matrix-form" hidden>
      <label>Rows <input class="rows" type="number" min="1" max="8" value="2" /></label>
      <label>Columns <input class="cols" type="number" min="1" max="8" value="2" /></label>
      <button type="submit">Insert</button>
    </form>
  </div>
  <div class="menu" role="menu" hidden></div>
</div>
`;
