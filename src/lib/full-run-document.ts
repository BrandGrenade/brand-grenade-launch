// Client-side HTML builder for the Complete Pipeline Run deliverable.
//
// Iterates the canonical STAGE_MANIFEST, stitches every stage's stored
// FINAL output into a cover-to-close document, opens it in a new tab, and
// triggers window.print() so the user can save as PDF via the browser
// print dialog. Same rendering model as phase1-document-builder.
//
// Rules:
//   - Iterate STAGE_MANIFEST in order (single source of truth).
//   - Skip any stage whose columns are all null/empty (e.g. Stage 1B on
//     legacy briefs; Stage 16 formats not yet generated).
//   - Stage 16 has four format columns — each present one is rendered as
//     its own labelled sub-section under the Stage 16 heading.

import { STAGE_MANIFEST, type StageManifestEntry } from "./pipeline-integrity";
import { stripDocumentMetadata } from "./strip-document-metadata";

const ACCENT = "#D4924A";

const STAGE_16_FORMAT_LABELS: Record<string, string> = {
  stage_16_consulting_output: "Consulting Delivery",
  stage_16_agency_output: "Agency Pitch",
  stage_16_workshop_output: "Brand Workshop Guide",
  stage_16_vision_output: "Strategy and Creative Vision",
};

const MULTI_COLUMN_LABELS: Record<string, string> = {
  stage_9_output: "Core Stage 9 Output",
  stage_9_leftofcentre_output: "Left-of-Centre Alternatives",
};

export type FullRunSession = {
  brand_name?: string | null;
  category?: string | null;
  selected_smp?: string | null;
} & Partial<Record<string, unknown>>;

/** Columns required by the full-run builder — used to widen the session
 * SELECT in complete.tsx. Derived from STAGE_MANIFEST + stage_21_outputs
 * JSON handling. */
export const FULL_RUN_SESSION_COLUMNS: string = Array.from(
  new Set(STAGE_MANIFEST.flatMap((e) => e.columns)),
).join(", ");

function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmt(line: string): string {
  let s = escapeHtml(line);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|\s)\*(?!\s)(.+?)\*(?!\w)/g, "$1<em>$2</em>");
  return s;
}

function md(text: string): string {
  if (!text) return "";
  const lines = text.split("\n");
  const out: string[] = [];
  let inUl = false;
  const closeUl = () => { if (inUl) { out.push("</ul>"); inUl = false; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeUl(); continue; }
    if (line.startsWith("> ")) { closeUl(); out.push(`<blockquote>${fmt(line.replace(/^>\s+/, ""))}</blockquote>`); continue; }
    if (/^####\s+/.test(line)) { closeUl(); out.push(`<h4>${fmt(line.replace(/^####\s+/, ""))}</h4>`); continue; }
    if (/^###\s+/.test(line)) { closeUl(); out.push(`<h4>${fmt(line.replace(/^###\s+/, ""))}</h4>`); continue; }
    if (/^##\s+/.test(line)) { closeUl(); out.push(`<h3>${fmt(line.replace(/^##\s+/, ""))}</h3>`); continue; }
    if (/^#\s+/.test(line)) { closeUl(); out.push(`<h3>${fmt(line.replace(/^#\s+/, ""))}</h3>`); continue; }
    if (/^[-—•]\s+/.test(line)) {
      if (!inUl) { out.push("<ul>"); inUl = true; }
      out.push(`<li>${fmt(line.replace(/^[-—•]\s+/, ""))}</li>`);
      continue;
    }
    if (/^[*\\-_]{3,}$/.test(line)) { closeUl(); out.push("<hr>"); continue; }
    closeUl();
    out.push(`<p>${fmt(line)}</p>`);
  }
  closeUl();
  return out.join("\n");
}

function sanitise(t: string | null | undefined): string {
  return stripDocumentMetadata(t ?? "", "full-run-doc")
    .replace(/\u2014/g, "—").replace(/\u2013/g, "–")
    .replace(/\u201C/g, '"').replace(/\u201D/g, '"')
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'")
    .replace(/\u2026/g, "...");
}

function baseStyles(): string {
  return `@page { size: A4; margin: 20mm 22mm 20mm 22mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: #f4f1ec; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.8; color: #1a1a18; padding: 64px 0 64px; }
.page { max-width: 760px; margin: 0 auto; background: white; padding: 56pt 56pt 56pt; box-shadow: 0 6px 24px rgba(0,0,0,0.08); }
#toolbar { position: fixed; top: 0; left: 0; right: 0; background: #1a1a18; padding: 10px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 999; }
#toolbar span { color: #8a8680; font-size: 12px; }
#toolbar .actions button { background: ${ACCENT}; color: #000; border: none; padding: 8px 20px; border-radius: 4px; font-size: 13px; font-weight: bold; cursor: pointer; margin-left: 8px; }
#toolbar .actions button.close { background: transparent; color: #aaa; border: 1px solid #444; }
@media print {
  #toolbar { display: none; }
  body { padding: 0; background: white; }
  .page { box-shadow: none; max-width: none; padding: 0; }
  .cover { page-break-after: always; }
  .stage-block { page-break-before: always; }
  .stage-block:first-of-type { page-break-before: auto; }
  h2, h3 { page-break-after: avoid; }
}
.cover { min-height: 80vh; display: flex; flex-direction: column; justify-content: center; padding: 40pt 0; border-bottom: 2pt solid ${ACCENT}; margin-bottom: 32pt; }
.cover-brand { font-size: 11pt; font-weight: bold; letter-spacing: 0.1em; color: #1a1a18; margin-bottom: 8pt; }
.cover-label { font-size: 9pt; font-weight: bold; letter-spacing: 0.12em; color: ${ACCENT}; text-transform: uppercase; margin-bottom: 24pt; }
.cover-title { font-size: 22pt; font-weight: 700; color: #1a1a18; line-height: 1.2; margin-bottom: 16pt; }
.cover-sub { font-size: 12pt; color: #4a4a48; margin-bottom: 24pt; }
.cover-rule { width: 40pt; height: 2pt; background: ${ACCENT}; margin-bottom: 20pt; }
.cover-date { font-size: 9pt; color: #666; }
.cover-confidential { font-size: 8pt; color: #999; margin-top: 8pt; letter-spacing: 0.06em; }
.toc { margin: 24pt 0 32pt; padding: 16pt; border: 1pt solid #e0d8cc; border-radius: 6pt; background: #faf7f2; }
.toc h3 { margin-top: 0; color: ${ACCENT}; letter-spacing: 0.12em; text-transform: uppercase; font-size: 10pt; margin-bottom: 10pt; }
.toc ol { margin: 0 0 0 20pt; padding: 0; }
.toc li { margin: 4pt 0; font-size: 10pt; padding-left: 0; }
.toc li::before { content: ''; }
.toc .stage-id { color: ${ACCENT}; font-weight: bold; margin-right: 8pt; font-family: 'Courier New', monospace; font-size: 9pt; }
.stage-block { margin-bottom: 32pt; padding-top: 8pt; }
.part-label { font-size: 8pt; font-weight: bold; letter-spacing: 0.12em; color: ${ACCENT}; text-transform: uppercase; margin-bottom: 6pt; }
h2 { font-size: 16pt; font-weight: bold; color: #1a1a18; margin-bottom: 12pt; padding-left: 10pt; border-left: 3pt solid ${ACCENT}; line-height: 1.3; }
h3 { font-size: 12pt; font-weight: bold; color: #1a1a18; margin-top: 16pt; margin-bottom: 8pt; }
h4 { font-size: 10.5pt; font-weight: bold; color: #1a1a18; margin-top: 12pt; margin-bottom: 6pt; }
p { margin-bottom: 10pt; orphans: 3; widows: 3; }
blockquote { border-left: 3pt solid ${ACCENT}; padding: 8pt 12pt; margin: 14pt 0; background: #f9f9f7; font-style: italic; }
ul { margin: 10pt 0; padding: 0; list-style: none; }
li { padding-left: 14pt; position: relative; margin-bottom: 5pt; }
li::before { content: '—'; position: absolute; left: 0; color: ${ACCENT}; }
hr { border: none; border-top: 0.5pt solid #ddd; margin: 16pt 0; }
strong { font-weight: bold; } em { font-style: italic; }
.channel { margin-top: 16pt; padding-top: 8pt; border-top: 0.5pt dashed ${ACCENT}; }
.footer { margin-top: 40pt; padding-top: 16pt; border-top: 0.5pt solid #ddd; font-size: 7.5pt; color: #888; text-align: center; line-height: 1.55; }
`;
}

interface ResolvedStage { entry: StageManifestEntry; body: string; }

/** Extract renderable content for a stage entry. Returns null when nothing
 * usable is stored (all columns null/empty). Stage 16's four format columns
 * become nested sub-blocks; Stage 21's JSON becomes per-channel sub-blocks. */
function resolveStage(entry: StageManifestEntry, session: FullRunSession): ResolvedStage | null {
  // Stage 16 — up to four format outputs
  if (entry.id === "16") {
    const parts: string[] = [];
    for (const col of entry.columns) {
      const raw = session[col];
      if (typeof raw === "string" && raw.trim()) {
        parts.push(
          `<div class="channel"><h3>${escapeHtml(STAGE_16_FORMAT_LABELS[col] ?? col)}</h3>${md(sanitise(raw))}</div>`,
        );
      }
    }
    if (!parts.length) return null;
    return { entry, body: parts.join("\n") };
  }

  // Stage 21 — JSON keyed by channel
  if (entry.id === "21") {
    const raw = session.stage_21_outputs;
    if (!raw || typeof raw !== "object") return null;
    const map = raw as Record<string, unknown>;
    const keys = Object.keys(map).filter((k) => typeof map[k] === "string" && (map[k] as string).trim());
    if (!keys.length) return null;
    const parts = keys.map((k) =>
      `<div class="channel"><h3>${escapeHtml(k.charAt(0).toUpperCase() + k.slice(1))}</h3>${md(sanitise(String(map[k])))}</div>`,
    );
    return { entry, body: parts.join("\n") };
  }

  // Default — single string column
  if (entry.columns.length > 1) {
    const parts: string[] = [];
    for (const col of entry.columns) {
      const raw = session[col];
      if (typeof raw === "string" && raw.trim()) {
        parts.push(`<div class="channel"><h3>${escapeHtml(MULTI_COLUMN_LABELS[col] ?? col)}</h3>${md(sanitise(raw))}</div>`);
      }
    }
    if (!parts.length) return null;
    return { entry, body: parts.join("\n") };
  }

  // Default — single string column
  const col = entry.columns[0];
  const raw = session[col];
  if (typeof raw !== "string" || !raw.trim()) return null;
  return { entry, body: md(sanitise(raw)) };
}

function cover(brand: string, smp: string | null | undefined): string {
  const date = new Date().toLocaleDateString("en-AU", { month: "long", day: "numeric", year: "numeric" });
  const smpBlock = smp && smp.trim()
    ? `<div class="cover-sub"><em>${escapeHtml(smp.trim())}</em></div>`
    : "";
  return `<div class="cover">
  <div class="cover-brand">BRAND GRENADE</div>
  <div class="cover-label">COMPLETE PIPELINE RUN</div>
  <div class="cover-title">${escapeHtml(brand)}</div>
  <div class="cover-sub">Every stage of the run, cover page to Brand Architecture — the full canonical record.</div>
  ${smpBlock}
  <div class="cover-rule"></div>
  <div class="cover-date">${escapeHtml(date)}</div>
  <div class="cover-confidential">CONFIDENTIAL</div>
</div>`;
}

function toc(stages: ResolvedStage[]): string {
  const items = stages
    .map((s) => `<li><span class="stage-id">${escapeHtml(stageIdDisplay(s.entry.id))}</span>${escapeHtml(s.entry.label)}</li>`)
    .join("");
  return `<div class="toc"><h3>Contents</h3><ol>${items}</ol></div>`;
}

function stageIdDisplay(id: string): string {
  // "1" → "01", "1b" → "01B", "13b" → "13B", "20b" → "20B"
  const m = id.match(/^(\d+)([a-z]?)$/i);
  if (!m) return id;
  const [, n, suf] = m;
  return n.padStart(2, "0") + (suf ? suf.toUpperCase() : "");
}

function footer(): string {
  return `<div class="footer">Brand Grenade Strategy Intelligence System — Confidential. Complete Pipeline Run — every stage's final output as recorded in the session data.</div>`;
}

export function buildFullRunDocument(session: FullRunSession): string {
  const brand = session.brand_name ?? "Untitled Brand";
  const smp = session.selected_smp ?? null;

  const resolved: ResolvedStage[] = [];
  for (const entry of STAGE_MANIFEST) {
    const r = resolveStage(entry, session);
    if (r) resolved.push(r);
  }

  const sections = resolved
    .map(
      (s) =>
        `<div class="stage-block"><div class="part-label">STAGE ${escapeHtml(stageIdDisplay(s.entry.id))}</div><h2>${escapeHtml(s.entry.label)}</h2>${s.body}</div>`,
    )
    .join("\n");

  const body = cover(brand, smp) + toc(resolved) + sections + footer();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(brand)} — Complete Pipeline Run</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${baseStyles()}</style>
</head>
<body>
<div id="toolbar">
  <span>Complete Pipeline Run — ${escapeHtml(brand)}</span>
  <div class="actions">
    <button onclick="window.print()">Save as PDF</button>
    <button class="close" onclick="window.close()">Close</button>
  </div>
</div>
<div class="page">${body}</div>
<script>setTimeout(function(){try{window.print();}catch(e){}}, 500);</script>
</body>
</html>`;
}

/** Lightweight helper used by acceptance tests / diagnostics — returns the
 * ordered list of stage entries that WOULD be rendered for a session. */
export function resolveFullRunStages(session: FullRunSession): StageManifestEntry[] {
  const out: StageManifestEntry[] = [];
  for (const entry of STAGE_MANIFEST) {
    if (resolveStage(entry, session)) out.push(entry);
  }
  return out;
}

export function openFullRunDocument(session: FullRunSession): void {
  const html = buildFullRunDocument(session);
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow popups to download your document.");
    return;
  }
  win.document.open("text/html");
  win.document.write(html);
  win.document.close();
}

/** Filename per spec: BrandGrenade_FullRun_{BrandName}_{YYYY-MM-DD}.pdf
 * (Users pick the filename in the print dialog, but the tab title
 * pre-fills the browser's Save-As.) */
export function fullRunFilenameHint(brand: string): string {
  const safe = brand.replace(/[^a-zA-Z0-9]+/g, "");
  const date = new Date().toISOString().split("T")[0];
  return `BrandGrenade_FullRun_${safe}_${date}.pdf`;
}
