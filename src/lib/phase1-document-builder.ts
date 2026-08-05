// Client-side HTML builder for Phase 1 deliverables.
//
// Stitches the session's stage outputs into a styled HTML document,
// opens it in a new tab, and triggers window.print() so the user can
// save as PDF from the browser's native print dialog.
//
// No AI, no edge function, no auth — pure client rendering.

export type Phase1Format = "consulting" | "agency" | "workshop";

export interface Phase1Session {
  brand_name: string | null;
  category: string | null;
  selected_smp: string | null;
  stage_1_output?: string | null;
  stage_2_output?: string | null;
  stage_3_output?: string | null;
  stage_4_output?: string | null;
  stage_5_output?: string | null;
  stage_6_output?: string | null;
  stage_7_output?: string | null;
  stage_8_output?: string | null;
  stage_9_output?: string | null;
  stage_9_leftofcentre_output?: string | null;
  stage_10_output?: string | null;
  stage_11_output?: string | null;
  stage_12_output?: string | null;
  stage_13_output?: string | null;
  stage_14_output?: string | null;
  stage_15_output?: string | null;
}

const ACCENT = "#C81E1E";

export const PHASE_1_SESSION_COLUMNS =
  "stage_1_output, stage_2_output, stage_3_output, stage_4_output, stage_5_output, stage_6_output, stage_7_output, stage_8_output, stage_9_output, stage_9_leftofcentre_output, stage_10_output, stage_11_output, stage_12_output, stage_13_output, stage_14_output, stage_15_output";

export function escapeHtml(s: string): string {
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

export function md(text: string): string {
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
    if (/^###\s+/.test(line)) { closeUl(); out.push(`<h3>${fmt(line.replace(/^###\s+/, ""))}</h3>`); continue; }
    if (/^##\s+/.test(line)) { closeUl(); out.push(`<h3>${fmt(line.replace(/^##\s+/, ""))}</h3>`); continue; }
    if (/^#\s+/.test(line)) { closeUl(); out.push(`<h2>${fmt(line.replace(/^#\s+/, ""))}</h2>`); continue; }
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

import { stripDocumentMetadata } from "./strip-document-metadata";

export function sanitise(t: string | null | undefined): string {
  return stripDocumentMetadata(t ?? "", "phase1-doc")
    .replace(/\u2014/g, "—").replace(/\u2013/g, "–")
    .replace(/\u201C/g, '"').replace(/\u201D/g, '"')
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'")
    .replace(/\u2026/g, "...");
}

const STAGE1_INTERNAL_LINE = /(PIPELINE DATA HEADER|BRIEF DEPTH LEVEL:|CATEGORY KNOWLEDGE CONFIDENCE:|BRIEF ELEMENTS PRESENT:|ASSUMPTIONS MADE:)/i;

function stripStage1Internals(text: string): string {
  return text.split("\n").filter((l) => !STAGE1_INTERNAL_LINE.test(l)).join("\n");
}

export function baseStyles(): string {
  // Brand Grenade design system — void #0A0908 · ash #1C1A18 · paper #EDE8E0
  // · smoke #8B8680 · detonation #C81E1E. Two paper tints (--surface, --rule)
  // are derived from those values so surfaces and rules stay visible on paper.
  return `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap');
:root { --void: #0A0908; --ash: #1C1A18; --paper: #EDE8E0; --smoke: #8B8680; --detonation: ${ACCENT}; --surface: #E1DCD4; --rule: #C2BCB5; }
@page { size: A4; margin: 20mm 22mm 20mm 22mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: var(--void); }
body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 10.5pt; line-height: 1.8; color: var(--ash); padding: 64px 0 64px; -webkit-font-smoothing: antialiased; }
.page { max-width: 760px; margin: 0 auto; background: var(--paper); padding: 56pt 56pt 56pt; box-shadow: 0 6px 24px rgba(0,0,0,0.45); }
#toolbar { position: fixed; top: 0; left: 0; right: 0; background: var(--ash); border-bottom: 1px solid #2A2724; padding: 10px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 999; }
#toolbar span { color: var(--smoke); font-size: 13px; }
#toolbar .actions button { background: var(--detonation); color: var(--paper); border: none; padding: 8px 20px; border-radius: 3px; font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; margin-left: 8px; }
#toolbar .actions button.close { background: transparent; color: var(--smoke); border: 1px solid #2A2724; }
@media print {
  #toolbar { display: none; }
  html, body { padding: 0; background: var(--paper); }
  .page { box-shadow: none; max-width: none; padding: 0; background: var(--paper); }
  .section { page-break-inside: avoid; }
  .doc-break { page-break-before: always; }
  h2 { page-break-after: avoid; }
  .cover { page-break-after: always; }
}
.cover { min-height: 80vh; display: flex; flex-direction: column; justify-content: center; padding: 40pt 0; border-bottom: 2pt solid var(--detonation); margin-bottom: 32pt; }
.cover-brand { font-family: 'Bebas Neue', Impact, sans-serif; font-size: 15pt; letter-spacing: 0.06em; color: var(--ash); margin-bottom: 10pt; }
.cover-label { font-size: 9pt; font-weight: 600; letter-spacing: 0.12em; color: var(--detonation); text-transform: uppercase; margin-bottom: 24pt; }
.cover-title { font-family: 'Bebas Neue', Impact, sans-serif; font-size: 40pt; font-weight: 400; color: var(--ash); line-height: 1.02; letter-spacing: 0.01em; margin-bottom: 24pt; }
.cover-rule { width: 40pt; height: 2pt; background: var(--detonation); margin-bottom: 20pt; }
.cover-date { font-size: 9.5pt; color: var(--smoke); }
.cover-confidential { font-size: 9pt; color: var(--smoke); margin-top: 8pt; letter-spacing: 0.06em; }
.section { margin-bottom: 32pt; padding-top: 8pt; }
.part-label { font-size: 9pt; font-weight: 600; letter-spacing: 0.12em; color: var(--detonation); text-transform: uppercase; margin-bottom: 6pt; }
h2 { font-size: 15pt; font-weight: 600; letter-spacing: -0.01em; color: var(--ash); margin-bottom: 12pt; padding-left: 10pt; border-left: 3pt solid var(--detonation); line-height: 1.25; }
h3 { font-size: 11pt; font-weight: 600; color: var(--ash); margin-top: 16pt; margin-bottom: 8pt; }
h4 { font-size: 10pt; font-weight: 600; color: var(--ash); margin-top: 12pt; margin-bottom: 6pt; }
p { margin-bottom: 10pt; orphans: 3; widows: 3; }
blockquote { border-left: 3pt solid var(--detonation); padding: 10pt 14pt; margin: 14pt 0; background: var(--surface); font-style: italic; font-size: 11pt; line-height: 1.65; }
ul { margin: 10pt 0; padding: 0; list-style: none; }
li { padding-left: 14pt; position: relative; margin-bottom: 5pt; }
li::before { content: '—'; position: absolute; left: 0; color: var(--detonation); }
hr { border: none; border-top: 0.5pt solid var(--rule); margin: 16pt 0; }
strong { font-weight: 600; } em { font-style: italic; }
.proposition { text-align: center; padding: 36pt 20pt; border-top: 2pt solid var(--detonation); border-bottom: 2pt solid var(--detonation); margin: 0 0 32pt; }
.proposition .label { font-size: 9pt; font-weight: 600; letter-spacing: 0.18em; color: var(--detonation); text-transform: uppercase; margin-bottom: 14pt; }
.proposition .stmt { font-family: 'Bebas Neue', Impact, sans-serif; font-size: 30pt; line-height: 1.06; letter-spacing: 0.01em; color: var(--ash); font-weight: 400; max-width: 480pt; margin: 0 auto; }
.toc { margin: 24pt 0 32pt; padding: 16pt; border: 1pt solid var(--rule); border-radius: 4pt; background: var(--surface); }
.toc h3 { margin-top: 0; color: var(--detonation); letter-spacing: 0.12em; text-transform: uppercase; font-size: 10pt; }
.toc ol { margin: 8pt 0 0 20pt; padding: 0; }
.toc li { margin: 4pt 0; font-size: 10pt; padding-left: 0; }
.toc li::before { content: ''; }
.footer { margin-top: 40pt; padding-top: 16pt; border-top: 0.5pt solid var(--rule); font-size: 9pt; color: var(--smoke); text-align: center; line-height: 1.55; }
`;
}

const FORMAT_META: Record<Phase1Format, { label: string; title: string }> = {
  consulting: { label: "BOARD STRATEGY RECOMMENDATION", title: "Board Strategy Recommendation" },
  agency: { label: "AGENCY STRATEGY PLATFORM", title: "Agency Strategy Platform" },
  workshop: { label: "BRAND WORKSHOP GUIDE", title: "Brand Workshop Guide" },
};

interface SectionDef { label: string; title: string; key: keyof Phase1Session; }

const SECTIONS_CONSULTING: SectionDef[] = [
  { label: "PART 01", title: "Brief & Context", key: "stage_1_output" },
  { label: "PART 02", title: "Category Intelligence", key: "stage_2_output" },
  { label: "PART 03", title: "Strategic Frameworks", key: "stage_3_output" },
  { label: "PART 04", title: "Strategic Universes", key: "stage_4_output" },
  { label: "PART 05", title: "Insight Generation", key: "stage_5_output" },
  { label: "PART 06", title: "Insight Validation", key: "stage_6_output" },
  { label: "PART 07", title: "Territory Synthesis", key: "stage_7_output" },
  { label: "PART 08", title: "Proposition Generation", key: "stage_8_output" },
  { label: "PART 09", title: "Distinctiveness Check", key: "stage_9_output" },
  { label: "PART 10", title: "Proposition Scoring", key: "stage_10_output" },
  { label: "PART 11", title: "Integrity Testing", key: "stage_11_output" },
  { label: "PART 12", title: "Proposition Selection", key: "stage_12_output" },
  { label: "PART 13", title: "Brand Fit Validation", key: "stage_13_output" },
  { label: "PART 14", title: "Territory Mapping", key: "stage_14_output" },
  { label: "PART 15", title: "Coherence Audit", key: "stage_15_output" },
];

const SECTIONS_AGENCY: SectionDef[] = [
  { label: "PART 01", title: "The Proposition", key: "stage_12_output" },
  { label: "PART 02", title: "Territory Mapping", key: "stage_14_output" },
  { label: "PART 03", title: "Distinctiveness", key: "stage_9_output" },
  { label: "PART 04", title: "Insight Foundation", key: "stage_5_output" },
  { label: "PART 05", title: "Strategic Universes", key: "stage_4_output" },
  { label: "PART 06", title: "Category Intelligence", key: "stage_2_output" },
  { label: "PART 07", title: "Brand Fit Validation", key: "stage_13_output" },
  { label: "PART 08", title: "Coherence Audit", key: "stage_15_output" },
  { label: "PART 09", title: "Brief & Context", key: "stage_1_output" },
];

const SECTIONS_WORKSHOP: SectionDef[] = [
  { label: "SESSION 01", title: "Brief & Context", key: "stage_1_output" },
  { label: "SESSION 02", title: "Category Landscape", key: "stage_2_output" },
  { label: "SESSION 03", title: "Strategic Universes", key: "stage_4_output" },
  { label: "SESSION 04", title: "Insights We're Working From", key: "stage_5_output" },
  { label: "SESSION 05", title: "Territory Synthesis", key: "stage_7_output" },
  { label: "SESSION 06", title: "Propositions on the Table", key: "stage_8_output" },
  { label: "SESSION 07", title: "Distinctiveness Check", key: "stage_9_output" },
  { label: "SESSION 08", title: "Scoring & Integrity", key: "stage_10_output" },
  { label: "SESSION 09", title: "Selected Proposition", key: "stage_12_output" },
  { label: "SESSION 10", title: "Territory Mapping", key: "stage_14_output" },
  { label: "SESSION 11", title: "Coherence Audit", key: "stage_15_output" },
];

function sectionsFor(format: Phase1Format): SectionDef[] {
  if (format === "agency") return SECTIONS_AGENCY;
  if (format === "workshop") return SECTIONS_WORKSHOP;
  return SECTIONS_CONSULTING;
}

function sectionOutput(session: Phase1Session, key: keyof Phase1Session): string {
  const primary = (session[key] ?? "").toString();
  if (key !== "stage_9_output") return primary;
  const loc = (session.stage_9_leftofcentre_output ?? "").toString();
  return `${primary}${loc}`;
}

function cover(label: string, title: string, brand: string): string {
  const date = new Date().toLocaleDateString("en-AU", { month: "long", year: "numeric" });
  return `<div class="cover">
  <div class="cover-brand">BRAND GRENADE</div>
  <div class="cover-label">${escapeHtml(label)}</div>
  <div class="cover-title">${escapeHtml(brand)} — ${escapeHtml(title)}</div>
  <div class="cover-rule"></div>
  <div class="cover-date">${escapeHtml(date)}</div>
  <div class="cover-confidential">CONFIDENTIAL</div>
</div>`;
}

function proposition(smp: string | null | undefined): string {
  const s = sanitise(smp);
  if (!s.trim()) return "";
  return `<div class="proposition">
  <div class="label">Strategic Master Proposition</div>
  <div class="stmt">${escapeHtml(s)}</div>
</div>`;
}

function toc(sections: SectionDef[], session: Phase1Session): string {
  const items = sections
    .filter((s) => sectionOutput(session, s.key).trim())
    .map((s) => `<li>${escapeHtml(s.title)}</li>`)
    .join("");
  if (!items) return "";
  return `<div class="toc"><h3>Contents</h3><ol>${items}</ol></div>`;
}

function footer(): string {
  return `<div class="footer">Brand Grenade Strategy Intelligence System — Confidential. This document was assembled from your session data. All outputs should be reviewed before commercial deployment.</div>`;
}

export function buildPhase1Document(session: Phase1Session, format: Phase1Format): string {
  const meta = FORMAT_META[format];
  const brand = session.brand_name ?? "Untitled Brand";
  const sections = sectionsFor(format);

  const body =
    cover(meta.label, meta.title, brand) +
    proposition(session.selected_smp) +
    toc(sections, session) +
    sections
      .map((s) => {
        let raw = sectionOutput(session, s.key);
        if (s.key === "stage_1_output") raw = stripStage1Internals(raw);
        if (!raw.trim()) return "";
        return `<div class="section"><div class="part-label">${escapeHtml(s.label)}</div><h2>${escapeHtml(s.title)}</h2>${md(sanitise(raw))}</div>`;
      })
      .filter(Boolean)
      .join("\n") +
    footer();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(meta.title)} — ${escapeHtml(brand)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${baseStyles()}</style>
</head>
<body>
<div id="toolbar">
  <span>${escapeHtml(meta.title)} — ${escapeHtml(brand)}</span>
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

export function openPhase1Document(session: Phase1Session, format: Phase1Format): void {
  const html = buildPhase1Document(session, format);
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow popups to download your document.");
    return;
  }
  win.document.open("text/html");
  win.document.write(html);
  win.document.close();
}

// ─── Stage 16 Vision document ───────────────────────────────────────
// Renders the AI-generated `stage_16_vision_output` markdown as a styled
// standalone HTML doc using the same Phase 1 visual treatment. Used for
// the "Strategy and Creative Vision" format card on the deliverables
// page — distinct from the raw stage-1..15 stitched Phase 1 documents.
export function buildStage16VisionDocument(
  brand: string,
  smp: string | null | undefined,
  visionOutput: string,
): string {
  const label = "STRATEGY AND CREATIVE VISION";
  const title = "Strategy and Creative Vision";
  // stage_16_vision_output already begins with its own `# ...` heading
  // (documentHeader in stage16.functions.ts). Strip that leading H1/H2 so we
  // don't double up the cover title.
  const cleaned = sanitise(visionOutput).replace(
    /^\s*#\s+[^\n]*\n+(?:##\s+[^\n]*\n+)?(?:\*[^*]+\*\s*\n+)?(?:---\s*\n+)?/,
    "",
  );
  const body =
    cover(label, title, brand) +
    proposition(smp) +
    `<div class="section"><div class="part-label">${escapeHtml(label)}</div>${md(cleaned)}</div>` +
    footer();
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)} — ${escapeHtml(brand)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${baseStyles()}</style>
</head>
<body>
<div id="toolbar">
  <span>${escapeHtml(title)} — ${escapeHtml(brand)}</span>
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

export function openStage16VisionDocument(
  brand: string,
  smp: string | null | undefined,
  visionOutput: string,
): void {
  const html = buildStage16VisionDocument(brand, smp, visionOutput);
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow popups to download your document.");
    return;
  }
  win.document.open("text/html");
  win.document.write(html);
  win.document.close();
}
