// Server-only HTML builders for Phase 2 (Brand Detonation) documents.
//
// Phase 2 source content already lives in the sessions table — no AI
// re-generation is needed. These builders produce a single HTML document
// per type, styled identically to Phase 1 except the accent colour is
// the Phase 2 amber #C81E1E. Open in a new tab; user prints natively.

import { parseStage20Output, parseBriefQualityScore, type BriefQualityScore } from "./phase2-shared";
import { buildMasterDetonationDocument } from "./master-detonation-document";
import type { MintoSession } from "./minto-content";
import { stripDocumentMetadata } from "./strip-document-metadata";

export type Phase2DocType =
  | "detonation_territory"
  | "detonation_intelligence"
  | "the_detonation"
  | "activation_architecture"
  | "master_brief"
  | "channel_brief"
  | "distinctive_assets"
  | "brand_architecture"
  | "all_phase2";

export interface Phase2Session {
  id: string;
  brand_name: string | null;
  selected_smp: string | null;
  stage_17_selected_territory: string | null;
  stage_17b_output: string | null;
  stage_18_selected_detonation: string | null;
  stage_19_output: string | null;
  stage_20_output: string | null;
  stage_21_outputs: Record<string, string> | null;
  stage_22_brand_architecture: string | null;
  stage_22_distinctive_assets: string | null;
  /** Room 04 lock — supersedes any line written into earlier stage outputs. */
  locked_big_idea?: string | null;
  locked_campaign_line?: string | null;
  locked_big_idea_lens?: string | null;
  locked_big_idea_at?: string | null;
  locked_big_idea_run_id?: string | null;
  updated_at?: string | null;
}


export const PHASE_2_AMBER = "#C81E1E";

export const LEGAL_DISCLAIMER =
  "Brand Grenade's Brand Detonation pipeline produces strategic creative platforms. These outputs have not been subject to trademark searches, legal clearance, or market conflict checking. All outputs should be reviewed by appropriate legal counsel before commercial deployment.";

// ── Minimal markdown → HTML ────────────────────────────────────────────────
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

function sanitise(t: string | null | undefined): string {
  return stripDocumentMetadata(t ?? "", "phase2-doc")
    .replace(/\u2014/g, "—").replace(/\u2013/g, "–")
    .replace(/\u201C/g, '"').replace(/\u201D/g, '"')
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'")
    .replace(/\u2026/g, "...");
}

// ── Shared CSS for every Phase 2 document ─────────────────────────────────
function baseStyles(): string {
  // Brand Grenade design system — void #0A0908 · ash #1C1A18 · paper #EDE8E0
  // · smoke #8B8680 · detonation #C81E1E, plus two derived paper tints so
  // rules and surfaces remain visible on a paper page.
  return `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap');
:root { --void: #0A0908; --ash: #1C1A18; --paper: #EDE8E0; --smoke: #8B8680; --detonation: ${PHASE_2_AMBER}; --surface: #E1DCD4; --rule: #C2BCB5; }
@page { size: A4; margin: 20mm 22mm 20mm 22mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: var(--void); }
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  font-size: 10.5pt; line-height: 1.8; color: var(--ash);
  padding: 64px 0 64px; -webkit-font-smoothing: antialiased;
}
.page {
  max-width: 760px; margin: 0 auto; background: var(--paper);
  padding: 56pt 56pt 56pt; box-shadow: 0 6px 24px rgba(0,0,0,0.45);
}
#toolbar {
  position: fixed; top: 0; left: 0; right: 0;
  background: var(--ash); border-bottom: 1px solid #2A2724; padding: 10px 24px;
  display: flex; justify-content: space-between; align-items: center; z-index: 999;
}
#toolbar span { color: var(--smoke); font-size: 13px; }
#toolbar .actions button {
  background: var(--detonation); color: var(--paper); border: none;
  padding: 8px 20px; border-radius: 3px; font-family: inherit;
  font-size: 13px; font-weight: 600; cursor: pointer; margin-left: 8px;
}
#toolbar .actions button.close { background: transparent; color: var(--smoke); border: 1px solid #2A2724; }
@media print {
  #toolbar { display: none; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .arch-grid, .arch-box, .arch-center { page-break-inside: avoid; }
  @page { margin: 0; }
  html, body { padding: 0; background: var(--paper); }
  .page { box-shadow: none; max-width: none; padding: 20mm 22mm; background: var(--paper); }
  .section { page-break-inside: avoid; }
  .doc-break { page-break-before: always; }
  h2 { page-break-after: avoid; }
  .cover { page-break-after: always; }
  .single-page { page-break-inside: avoid; }
}
.cover {
  min-height: 80vh; display: flex; flex-direction: column; justify-content: center;
  padding: 40pt 0; border-bottom: 2pt solid var(--detonation); margin-bottom: 32pt;
}
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
.hero-detonation { text-align: center; padding: 60pt 20pt; border-top: 2pt solid var(--detonation); border-bottom: 2pt solid var(--detonation); margin: 0 0 32pt; }
.hero-detonation .label { font-size: 9pt; font-weight: 600; letter-spacing: 0.18em; color: var(--detonation); text-transform: uppercase; margin-bottom: 18pt; }
.hero-detonation .stmt { font-family: 'Bebas Neue', Impact, sans-serif; font-size: 34pt; line-height: 1.06; color: var(--ash); font-weight: 400; max-width: 480pt; margin: 0 auto; letter-spacing: 0.01em; }
.score-card { margin-top: 24pt; padding: 16pt; border: 1pt solid var(--rule); border-radius: 4pt; background: var(--surface); }
.score-card .score-label { font-size: 9pt; font-weight: 600; letter-spacing: 0.14em; color: var(--detonation); text-transform: uppercase; margin-bottom: 10pt; }
.score-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10pt; margin-bottom: 10pt; }
.score-grid > div { border-top: 0.5pt solid var(--rule); padding-top: 6pt; }
.score-grid .lbl { font-size: 8pt; color: var(--smoke); letter-spacing: 0.1em; text-transform: uppercase; }
.score-grid .val { font-size: 14pt; color: var(--ash); margin-top: 2pt; font-weight: 600; }
.score-total { display: flex; justify-content: space-between; align-items: center; border-top: 1pt solid var(--rule); padding-top: 10pt; }
.score-total .composite { font-family: 'Bebas Neue', Impact, sans-serif; font-size: 24pt; color: var(--detonation); font-weight: 400; }
.score-total .status { font-size: 12pt; font-weight: 600; letter-spacing: 0.16em; color: var(--ash); }
.arch-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10pt; padding: 12pt; border: 1pt solid var(--rule); border-radius: 4pt; background: var(--surface); }
.arch-box { background: var(--paper); border: 0.5pt solid var(--rule); border-radius: 3pt; padding: 10pt; min-height: 110pt; }
.arch-box .lbl { font-size: 9pt; color: var(--detonation); text-transform: uppercase; letter-spacing: 0.16em; margin-bottom: 6pt; font-weight: 600; }
.arch-box .txt { font-size: 9.5pt; line-height: 1.5; white-space: pre-wrap; color: var(--ash); }
.arch-box .txt .empty { color: var(--smoke); }
ul.arch-items { list-style: none; margin: 0; padding: 0; }
ul.arch-items li { padding-left: 10pt; position: relative; margin-bottom: 4pt; }
ul.arch-items li::before { content: '—'; position: absolute; left: 0; color: var(--detonation); }
.arch-center { background: var(--void); color: var(--paper); border-radius: 3pt; padding: 14pt; display: flex; flex-direction: column; justify-content: center; min-height: 110pt; }
.arch-center .lbl { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.18em; color: var(--smoke); font-weight: 600; }
.arch-center .txt { font-family: 'Bebas Neue', Impact, sans-serif; font-size: 18pt; line-height: 1.1; margin-top: 8pt; font-weight: 400; white-space: pre-wrap; color: var(--paper); }
.footer { margin-top: 40pt; padding-top: 16pt; border-top: 0.5pt solid var(--rule); font-size: 9pt; color: var(--smoke); text-align: center; line-height: 1.55; }
.toc { margin: 24pt 0 32pt; padding: 16pt; border: 1pt solid var(--rule); border-radius: 4pt; background: var(--surface); }
.toc h3 { margin-top: 0; color: var(--detonation); letter-spacing: 0.12em; text-transform: uppercase; font-size: 10pt; }
.toc ol { margin: 8pt 0 0 20pt; padding: 0; }
.toc li { margin: 4pt 0; font-size: 10pt; }
`;
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

function footer(includeDisclaimer = true): string {
  if (!includeDisclaimer) {
    return `<div class="footer">Brand Grenade Strategy Intelligence System — Confidential</div>`;
  }
  return `<div class="footer">${escapeHtml(LEGAL_DISCLAIMER)}</div>`;
}

function wrapDoc(title: string, brand: string, body: string): string {
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

// ── Per-document body builders ────────────────────────────────────────────
function plainBody(label: string, title: string, brand: string, content: string, includeDisclaimer = true): string {
  return cover(label, title, brand) +
    `<div class="section"><h2>${escapeHtml(title)}</h2>${md(sanitise(content))}</div>` +
    footer(includeDisclaimer);
}

function detonationBody(brand: string, content: string): string {
  const sanitised = sanitise(content);
  const stmtMatch = sanitised.match(/DETONATION\s+STATEMENT\s*[:\-]?\s*([^\n]+(?:\n(?!\s*[A-Z][A-Z\s]{4,}\s*:?)[^\n]+)*)/i);
  const stmt = stmtMatch ? stmtMatch[1].trim().replace(/^["“”']|["“”']$/g, "") : "";
  const hero = stmt ? `<div class="hero-detonation"><div class="label">THE DETONATION</div><div class="stmt">${escapeHtml(stmt)}</div></div>` : "";
  return cover("BRAND DETONATION", "The Detonation", brand) +
    hero +
    `<div class="section"><h2>The Detonation</h2>${md(sanitised)}</div>` +
    footer(true);
}

function scoreCardHtml(score: BriefQualityScore): string {
  const cell = (lbl: string, v: number | null) => `<div><div class="lbl">${escapeHtml(lbl)}</div><div class="val">${v ?? "—"}/10</div></div>`;
  return `<div class="score-card">
  <div class="score-label">Brief Quality Score</div>
  <div class="score-grid">
    ${cell("Emotional Clarity", score.emotional_clarity)}
    ${cell("Fame Invitation", score.fame_invitation)}
    ${cell("Distinctive Assets", score.distinctive_asset_integration)}
    ${cell("Psychological Leverage", score.psychological_leverage)}
    ${cell("Creative SoV", score.creative_sov_ambition)}
  </div>
  <div class="score-total">
    <div><div class="lbl" style="font-size:7pt;color:#8B8680;text-transform:uppercase;letter-spacing:0.1em">Composite</div><div class="composite">${score.composite ?? "—"}/50</div></div>
    <div class="status" style="color:${score.status === "PASS" ? PHASE_2_AMBER : "#1C1A18"}">${escapeHtml(score.status ?? "REVIEW")}</div>
  </div>
</div>`;
}

function channelBriefBody(brand: string, channel: string, body: string): string {
  const sanitised = sanitise(body);
  const roleMatch = sanitised.match(/CHANNEL\s+ROLE\s*[:\-]?\s*([^\n]+)/i);
  const role = roleMatch ? roleMatch[1].trim() : "";
  return cover("CHANNEL BRIEF", `${channel} — Detonation Brief`, brand) +
    `<div class="single-page">
      <h2>${escapeHtml(channel)} — Detonation Brief</h2>
      ${role ? `<p style="color:#8B8680;font-style:italic;margin-bottom:14pt">${escapeHtml(role)}</p>` : ""}
      <div class="section">${md(sanitised)}</div>
    </div>` +
    footer(true);
}

const ARCH_LABELS = ["REFLECTION", "DOMAIN", "HERITAGE", "VALUES", "ASSETS", "PERSONALITY"];

/** Stage 22 stores each component as `LABEL: value` on one line ("DOMAIN: Electric
 * performance automotive"). Older/looser outputs put the value on the following
 * line(s) under a bare or markdown-headed label. Handle both. */
function extractArch(arch: string, label: string): string {
  const inline = arch.match(
    new RegExp(`(?:^|\\n)\\s*(?:#{1,4}\\s*)?\\**\\s*${label}\\s*\\**\\s*:\\s*([^\\n]+)`, "i"),
  );
  if (inline?.[1]?.trim()) return inline[1].trim().replace(/^\*+|\*+$/g, "").trim();

  const block = arch.match(
    new RegExp(
      `(?:^|\\n)\\s*(?:#{1,4}\\s*|\\*+\\s*)?${label}\\b[^\\n]*\\n([\\s\\S]*?)(?=\\n\\s*(?:#{1,4}\\s*|\\*+\\s*)?(?:${ARCH_LABELS.join("|")})\\b|$)`,
      "i",
    ),
  );
  return block?.[1]?.trim() ?? "";
}

/** Slash-delimited component values ("A / B / C") read as a stacked list. */
function archItems(txt: string): string {
  if (!txt) return `<span class="empty">—</span>`;
  const parts = txt.split(/\s+\/\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return escapeHtml(txt);
  return `<ul class="arch-items">${parts.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>`;
}

function architectureGrid(sanitised: string, currentLine = ""): { grid: string; complete: boolean } {
  const storedReflection = extractArch(sanitised, "REFLECTION");
  const reflection = currentLine.trim() || storedReflection;
  const peripherals = ["DOMAIN", "HERITAGE", "VALUES", "ASSETS", "PERSONALITY"]
    .map((l) => ({ lbl: l, txt: extractArch(sanitised, l) }));

  const box = (lbl: string, txt: string) =>
    `<div class="arch-box"><div class="lbl">${escapeHtml(lbl)}</div><div class="txt">${archItems(txt)}</div></div>`;
  const grid = `<div class="arch-grid">
    ${box(peripherals[0].lbl, peripherals[0].txt)}
    ${box(peripherals[1].lbl, peripherals[1].txt)}
    ${box(peripherals[2].lbl, peripherals[2].txt)}
    ${box(peripherals[3].lbl, peripherals[3].txt)}
    <div class="arch-center"><div class="lbl">REFLECTION</div><div class="txt">${escapeHtml(reflection || "—")}</div></div>
    ${box(peripherals[4].lbl, peripherals[4].txt)}
  </div>`;

  const complete = Boolean(reflection) && peripherals.every((p) => Boolean(p.txt));
  return { grid, complete };
}

function brandArchitectureBody(
  brand: string,
  arch: string,
  lock: { line?: string | null; idea?: string | null; lens?: string | null } = {},
): string {
  const sanitised = sanitise(arch);
  const line = (lock.line ?? "").trim();
  const { grid, complete } = architectureGrid(sanitised, line);

  // Stage 22 is written before a creative idea is locked in Room 04. Where a
  // lock exists it is authoritative and is stated ahead of the grid, so the
  // architecture's reflection line can never read as the campaign line.
  const idea = (lock.idea ?? "").trim();
  const lens = (lock.lens ?? "").trim();
  const lockBlock =
    line || idea
      ? `<div class="section"><h3>Locked campaign line${lens ? ` — ${escapeHtml(lens)}` : ""}</h3>${
          line ? `<blockquote>${escapeHtml(line)}</blockquote>` : ""
        }${idea ? `<p>${escapeHtml(idea.slice(0, 900))}</p>` : ""}</div>`
      : "";

  return cover("BRAND ARCHITECTURE", "Brand Architecture", brand) +
    lockBlock +
    `<div class="section"><h2>Brand Architecture</h2>${grid}</div>` +
    // The grid IS the document when every component resolved; the raw dump is a
    // fallback for outputs the extractor could not fully parse.
    (complete ? "" : `<div class="section"><h3>Full Architecture Detail</h3>${md(sanitised)}</div>`) +
    footer(false);
}


// ── Public: build a single document ──────────────────────────────────────
export function buildPhase2Document(
  session: Phase2Session,
  docType: Phase2DocType,
  channelKey?: string,
): string {
  const brand = session.brand_name ?? "Untitled Brand";
  let body = "";
  let title = "";

  switch (docType) {
    case "detonation_territory":
      title = "Detonation Territory";
      body = plainBody("BRAND DETONATION", title, brand, session.stage_17_selected_territory ?? "");
      break;
    case "detonation_intelligence":
      title = "Detonation Intelligence";
      body = plainBody("BRAND DETONATION", title, brand, session.stage_17b_output ?? "");
      break;
    case "the_detonation":
      title = "The Detonation";
      body = detonationBody(brand, session.stage_18_selected_detonation ?? "");
      break;
    case "activation_architecture":
      title = "Activation Architecture";
      body = plainBody("BRAND DETONATION", title, brand, session.stage_19_output ?? "");
      break;
    case "master_brief":
      // Canonical ten-section Minto template (shared with the other primary
      // deliverables) — returns a complete document, not a body fragment.
      return buildMasterDetonationDocument(session as unknown as MintoSession);
    case "channel_brief": {
      const ch = channelKey ?? "";
      const content = session.stage_21_outputs?.[ch] ?? "";
      title = `${ch} — Detonation Brief`;
      body = channelBriefBody(brand, ch, content);
      break;
    }
    case "distinctive_assets":
      title = "Conceptual Assets";
      body = plainBody("BRAND DETONATION", title, brand, session.stage_22_distinctive_assets ?? "");
      break;
    case "brand_architecture":
      title = "Brand Architecture";
      body = brandArchitectureBody(brand, session.stage_22_brand_architecture ?? "", {
        line: session.locked_campaign_line,
        idea: session.locked_big_idea,
        lens: session.locked_big_idea_lens,
      });

      break;
    case "all_phase2":
      return buildAllPhase2(session);
  }

  return wrapDoc(title, brand, body);
}

// ── Combined "All Brand Detonation" document ─────────────────────────────
export function buildAllPhase2(session: Phase2Session): string {
  const brand = session.brand_name ?? "Untitled Brand";
  const channelKeys = session.stage_21_outputs ? Object.keys(session.stage_21_outputs) : [];

  const tocItems = [
    "Detonation Territory",
    "Detonation Intelligence",
    "The Detonation",
    "Activation Architecture",
    "Master Detonation Brief",
    ...channelKeys.map((c) => `${c} — Detonation Brief`),
    "Conceptual Assets",
    "Brand Architecture",
  ];

  const sections: string[] = [];

  sections.push(`<div class="section"><h2>Detonation Territory</h2>${md(sanitise(session.stage_17_selected_territory ?? ""))}</div>`);
  sections.push(`<div class="doc-break"></div><div class="section"><h2>Detonation Intelligence</h2>${md(sanitise(session.stage_17b_output ?? ""))}</div>`);
  {
    const c = sanitise(session.stage_18_selected_detonation ?? "");
    const m = c.match(/DETONATION\s+STATEMENT\s*[:\-]?\s*([^\n]+)/i);
    const stmt = m ? m[1].trim().replace(/^["“”']|["“”']$/g, "") : "";
    sections.push(`<div class="doc-break"></div>${stmt ? `<div class="hero-detonation"><div class="label">THE DETONATION</div><div class="stmt">${escapeHtml(stmt)}</div></div>` : ""}<div class="section"><h2>The Detonation</h2>${md(c)}</div>`);
  }
  sections.push(`<div class="doc-break"></div><div class="section"><h2>Activation Architecture</h2>${md(sanitise(session.stage_19_output ?? ""))}</div>`);
  {
    const parsed = parseStage20Output(sanitise(session.stage_20_output ?? ""));
    const score = parseBriefQualityScore(parsed.scoreBlock);
    const inner = parsed.sections.length > 0
      ? parsed.sections.map((s) => `<div class="section"><div class="part-label">${escapeHtml(s.label)}</div>${md(s.content)}</div>`).join("")
      : `<div class="section">${md(sanitise(session.stage_20_output ?? ""))}</div>`;
    sections.push(`<div class="doc-break"></div><h2>Master Detonation Brief</h2>${inner}${scoreCardHtml(score)}`);
  }
  for (const ch of channelKeys) {
    const body = sanitise(session.stage_21_outputs?.[ch] ?? "");
    const roleMatch = body.match(/CHANNEL\s+ROLE\s*[:\-]?\s*([^\n]+)/i);
    const role = roleMatch ? roleMatch[1].trim() : "";
    sections.push(`<div class="doc-break"></div><h2>${escapeHtml(ch)} — Detonation Brief</h2>${role ? `<p style="color:#8B8680;font-style:italic;margin-bottom:14pt">${escapeHtml(role)}</p>` : ""}<div class="section">${md(body)}</div>`);
  }
  sections.push(`<div class="doc-break"></div><div class="section"><h2>Conceptual Assets</h2>${md(sanitise(session.stage_22_distinctive_assets ?? ""))}</div>`);
  {
    const arch = sanitise(session.stage_22_brand_architecture ?? "");
    const line = (session.locked_campaign_line ?? "").trim();
    const { grid, complete } = architectureGrid(arch, line);
    const lens = (session.locked_big_idea_lens ?? "").trim();
    sections.push(
      `<div class="doc-break"></div><h2>Brand Architecture</h2>` +
        (line
          ? `<div class="section"><h3>Locked campaign line${lens ? ` — ${escapeHtml(lens)}` : ""}</h3><blockquote>${escapeHtml(line)}</blockquote></div>`
          : "") +
        grid +
        (complete ? "" : `<div class="section"><h3>Full Architecture Detail</h3>${md(arch)}</div>`),
    );
  }


  const tocHtml = `<div class="toc"><h3>Contents</h3><ol>${tocItems.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ol></div>`;

  const body = cover("BRAND DETONATION", "Complete Brand Detonation", brand) + tocHtml + sections.join("\n") + footer(true);
  return wrapDoc("Brand Detonation", brand, body);
}

function extractBodyContent(html: string): string {
  const m = html.match(/<div class="page">([\s\S]*?)<\/div>\s*<script>/);
  return m ? m[1] : html;
}

export async function buildCompleteBundle(
  session: Phase2Session,
  phase1ConsultingUrl: string | null,
): Promise<string> {
  const brand = session.brand_name ?? "Untitled Brand";
  let phase1Html = "";
  if (phase1ConsultingUrl) {
    try {
      const resp = await fetch(phase1ConsultingUrl);
      if (resp.ok) phase1Html = await resp.text();
    } catch (e) {
      console.error("[buildCompleteBundle] fetch Phase 1 failed:", e);
    }
  }
  const phase1Body = phase1Html ? extractBodyContent(phase1Html) : `<div class="section"><h2>Phase 1: Brand Strategy</h2><p>Phase 1 document could not be loaded. Please regenerate from the Deliverables screen.</p></div>`;
  const phase2Html = buildAllPhase2(session);
  const phase2Body = extractBodyContent(phase2Html);

  const tocHtml = `<div class="toc"><h3>Contents</h3>
    <ol>
      <li>Phase 1 — Brand Strategy Platform</li>
      <li>Phase 2 — Brand Detonation</li>
    </ol>
  </div>`;

  const body = cover("COMPLETE BRAND GRENADE", "The Complete Strategic Platform", brand) +
    tocHtml +
    `<div class="doc-break"></div><div class="part-label">PHASE 1</div>` + phase1Body +
    `<div class="doc-break"></div><div class="part-label">PHASE 2</div>` + phase2Body +
    footer(true);

  return wrapDoc("Complete Brand Grenade", brand, body);
}
