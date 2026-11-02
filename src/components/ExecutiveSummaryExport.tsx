import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getExecutiveSummary } from "@/lib/executive-summary.functions";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/_(.+?)_/g, "<em>$1</em>");
/** Minimal renderer for the summary's fixed markdown (headings, bullets, notes, one table). */
export function summaryHtml(md: string): string {
  const out: string[] = []; let table: string[] = [];
  const flush = () => { if (table.length) { const rows = table.filter((r) => !/^\|-/.test(r)).map((r) => r.split("|").slice(1, -1).map((c) => c.trim())); out.push(`<table>${rows.map((r, i) => `<tr>${r.map((c) => (i ? `<td>${inline(c)}</td>` : `<th>${inline(c)}</th>`)).join("")}</tr>`).join("")}</table>`); table = []; } };
  for (const l of md.split("\n")) {
    if (l.startsWith("|")) { table.push(l); continue; } flush();
    if (l.startsWith("# ")) out.push(`<h1>${inline(l.slice(2))}</h1>`);
    else if (l.startsWith("## ")) out.push(`<h2>${inline(l.slice(3))}</h2>`);
    else if (l.startsWith("> ")) out.push(`<p class="note">${inline(l.slice(2))}</p>`);
    else if (l.startsWith("- ")) out.push(`<li>${inline(l.slice(2))}</li>`);
    else if (l.trim()) out.push(`<p>${inline(l)}</p>`);
  }
  flush();
  return out.join("\n");
}

export function ExecutiveSummaryExport({ sessionId, brand }: { sessionId: string; brand: string }) {
  const fetchSummary = useServerFn(getExecutiveSummary);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setBusy(true); setError(null);
    try { return await fetchSummary({ data: { sessionId } }); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); return null; }
    finally { setBusy(false); }
  }
  async function open() {
    const win = window.open("", "_blank");
    const s = await load();
    if (!s) { win?.close(); return; }
    const html = `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><title>${esc(brand)} Executive Summary v${s.version}</title><style>body{font:15px/1.5 Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;color:#1a1a1a}h1{font-size:26px}h2{font-size:17px;margin-top:22px;border-bottom:1px solid #ccc}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:4px 8px;text-align:left}.note{border-left:3px solid #C81E1E;padding-left:10px}em{color:#666;font-size:12px}@media print{body{margin:0}}</style></head><body>${summaryHtml(s.text)}</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    if (win) win.location.href = url; else window.location.href = url;
  }
  async function download() {
    const s = await load(); if (!s) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([s.text], { type: "text/markdown;charset=utf-8" }));
    a.download = `BrandGrenade_${brand.replace(/[^a-zA-Z0-9]/g, "_")}_ExecutiveSummary_v${s.version}.md`;
    document.body.appendChild(a); a.click(); a.remove();
  }
  return (
    <section className="mt-8 rounded-md border border-border p-4" aria-label="Executive Summary">
      <h3 className="text-body font-semibold">Executive Summary</h3>
      <p className="mt-1 text-body-sm text-muted-foreground">Two-page scannable summary assembled from this run's saved outputs. Nothing is regenerated.</p>
      <div className="mt-3 flex gap-4">
        <button type="button" className="text-body-sm font-semibold underline" disabled={busy} onClick={() => void open()}>{busy ? "Preparing…" : "Open Executive Summary ↗"}</button>
        <button type="button" className="text-body-sm underline text-muted-foreground" disabled={busy} onClick={() => void download()}>Download as text</button>
      </div>
      {error && <p role="alert" className="mt-2 text-body-sm text-destructive">{error}</p>}
    </section>
  );
}
