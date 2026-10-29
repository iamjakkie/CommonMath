import "../src/index.ts";

const log = document.querySelector("#events");
if (log) {
  for (const type of ["common-math:change", "common-math:result", "common-math:error"]) {
    document.addEventListener(type, (event) => {
      const custom = event as CustomEvent<Record<string, unknown>>;
      const host = event.target instanceof Element ? event.target : null;
      const name = host?.getAttribute("aria-label") ?? "component";
      const item = document.createElement("li");
      item.textContent = `${type} · ${name} · ${summarize(custom.detail)}`;
      log.prepend(item);
    });
  }
}

function summarize(detail: Record<string, unknown> | undefined): string {
  if (!detail) return "";
  const outcome = detail.outcome;
  if (outcome && typeof outcome === "object") {
    const record = outcome as { status?: string; resultLatex?: string; message?: string };
    return [record.status, record.resultLatex, record.message].filter(Boolean).join(" ");
  }
  if (typeof detail.message === "string") return detail.message;
  if (typeof detail.value === "string") return detail.value.slice(0, 80);
  return "";
}
