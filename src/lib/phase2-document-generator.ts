// Server-only HTML builders for Phase 2 (Brand Detonation) documents.
//
// Phase 2 source content already lives in the sessions table — no AI
// re-generation is needed. These builders produce a single HTML document
// per type, styled identically to Phase 1 except the accent colour is
// the Phase 2 amber #D4924A. Open in a new tab; user prints natively.

import { parseStage20Output, parseBriefQualityScore, type BriefQualityScore } from "./phase2-shared";

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
}

export const PHASE_2_AMBER = "#D4924A";

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
  return (t ?? "")
    .replace(/\u2014/g, "—").replace(/\u2013/g, "–")
    .replace(/\u201C/g, '"').replace(/\u201D/g, '"')
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'")
    .replace(/\u2026/g, "...");
}

// ── Shared CSS for every Phase 2 document ─────────────────────────────────
function baseStyles(): string {
  return `@page { size: A4; margin: 20mm 22mm 20mm 22mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: #f4f1ec; }
body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10.5pt; line-height: 1.8; color: #1a1a18;
  padding: 64px 0 64px;
}
.page {
  max-width: 760px; margin: 0 auto; background: white;
  padding: 56pt 56pt 56pt; box-shadow: 0 6px 24px rgba(0,0,0,0.08);
}
#toolbar {
  position: fixed; top: 0; left: 0; right: 0;
  background: #1a1a18; padding: 10px 24px;
  display: flex; justify-content: space-between; align-items: center; z-index: 999;
}
#toolbar span { color: #8a8680; font-size: 12px; }
#toolbar .actions button {
  background: ${PHASE_2_AMBER}; color: #000; border: none;
  padding: 8px 20px; border-radius: 4px;
  font-size: 13px; font-weight: bold; cursor: pointer; margin-left: 8px;
}
#toolbar .actions button.close { background: transparent; color: #aaa; border: 1px solid #444; }
@media print {
  #toolbar { display: none; }
  body { padding: 0; background: white; }
  .page { box-shadow: none; max-width: none; padding: 0; }
  .section { page-break-inside: avoid; }
  .doc-break { page-break-before: always; }
  h2 { page-break-after: avoid; }
  .cover { page-break-after: always; }
  .single-page { page-break-inside: avoid; }
}
.cover {
  min-height: 80vh; display: flex; flex-direction: column; justify-content: center;
  padding: 40pt 0; border-bottom: 2pt solid ${PHASE_2_AMBER}; margin-bottom: 32pt;
}
.cover-brand { font-size: 11pt; font-weight: bold; letter-spacing: 0.1em; color: #1a1a18; margin-bottom: 8pt; }
.cover-label { font-size: 9pt; font-weight: bold; letter-spacing: 0.12em; color: ${PHASE_2_AMBER}; text-transform: uppercase; margin-bottom: 24pt; }
.cover-title { font-size: 22pt; font-weight: 700; color: #1a1a18; line-height: 1.2; margin-bottom: 24pt; }
.cover-rule { width: 40pt; height: 2pt; background: ${PHASE_2_AMBER}; margin-bottom: 20pt; }
.cover-date { font-size: 9pt; color: #666; }
.cover-confidential { font-size: 8pt; color: #999; margin-top: 8pt; letter-spacing: 0.06em; }
.section { margin-bottom: 32pt; padding-top: 8pt; }
.part-label { font-size: 8pt; font-weight: bold; letter-spacing: 0.12em; color: ${PHASE_2_AMBER}; text-transform: uppercase; margin-bottom: 6pt; }
h2 { font-size: 14pt; font-weight: bold; color: #1a1a18; margin-bottom: 12pt; padding-left: 10pt; border-left: 3pt solid ${PHASE_2_AMBER}; line-height: 1.3; }
h3 { font-size: 11pt; font-weight: bold; color: #1a1a18; margin-top: 16pt; margin-bottom: 8pt; }
h4 { font-size: 10pt; font-weight: bold; color: #1a1a18; margin-top: 12pt; margin-bottom: 6pt; }
p { margin-bottom: 10pt; orphans: 3; widows: 3; }
blockquote { border-left: 3pt solid ${PHASE_2_AMBER}; padding: 8pt 12pt; margin: 14pt 0; background: #f9f9f7; font-style: italic; font-size: 11pt; line-height: 1.65; }
ul { margin: 10pt 0; padding: 0; list-style: none; }
li { padding-left: 14pt; position: relative; margin-bottom: 5pt; }
li::before { content: '—'; position: absolute; left: 0; color: ${PHASE_2_AMBER}; }
hr { border: none; border-top: 0.5pt solid #ddd; margin: 16pt 0; }
strong { font-weight: bold; } em { font-style: italic; }
.hero-detonation { text-align: center; padding: 60pt 20pt; border-top: 2pt solid ${PHASE_2_AMBER}; border-bottom: 2pt solid ${PHASE_2_AMBER}; margin: 0 0 32pt; }
.hero-detonation .label { font-size: 9pt; font-weight: bold; letter-spacing: 0.18em; color: ${PHASE_2_AMBER}; text-transform: uppercase; margin-bottom: 18pt; }
.hero-detonation .stmt { font-family: 'Courier New', Courier, monospace; font-size: 22pt; line-height: 1.35; color: ${PHASE_2_AMBER}; font-weight: 700; max-width: 480pt; margin: 0 auto; letter-spacing: -0.01em; }
.score-card { margin-top: 24pt; padding: 16pt; border: 1pt solid ${PHASE_2_AMBER}40; border-radius: 6pt; background: #faf7f2; }
.score-card .score-label { font-size: 8pt; font-weight: bold; letter-spacing: 0.14em; color: ${PHASE_2_AMBER}; text-transform: uppercase; margin-bottom: 10pt; }
.score-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10pt; margin-bottom: 10pt; }
.score-grid > div { border-top: 0.5pt solid ${PHASE_2_AMBER}40; padding-top: 6pt; }
.score-grid .lbl { font-size: 7pt; color: #888; letter-spacing: 0.1em; text-transform: uppercase; }
.score-grid .val { font-size: 13pt; color: #1a1a18; margin-top: 2pt; }
.score-total { display: flex; justify-content: space-between; align-items: center; border-top: 1pt solid ${PHASE_2_AMBER}40; padding-top: 10pt; }
.score-total .composite { font-size: 18pt; color: ${PHASE_2_AMBER}; font-weight: 700; }
.score-total .status { font-size: 12pt; font-weight: 700; letter-spacing: 0.16em; }
.arch-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10pt; padding: 12pt; border: 1pt solid #e0d8cc; border-radius: 6pt; background: #faf7f2; }
.arch-box { background: #fff; border: 0.5pt solid ${PHASE_2_AMBER}40; border-radius: 4pt; padding: 10pt; min-height: 110pt; }
.arch-box .lbl { font-family: 'Courier New', Courier, monospace; font-size: 8pt; color: ${PHASE_2_AMBER}; text-transform: uppercase; letter-spacing: 0.16em; margin-bottom: 6pt; font-weight: 700; }
.arch-box .txt { font-size: 9pt; line-height: 1.5; white-space: pre-wrap; color: #1a1a18; }
.arch-center { background: ${PHASE_2_AMBER}; color: #0a0a0a; border-radius: 4pt; padding: 14pt; display: flex; flex-direction: column; justify-content: center; min-height: 110pt; }
.arch-center .lbl { font-family: 'Courier New', Courier, monospace; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.18em; opacity: 0.75; }
.arch-center .txt { font-family: 'Courier New', Courier, monospace; font-size: 13pt; line-height: 1.4; margin-top: 6pt; font-weight: 700; white-space: pre-wrap; }
.footer { margin-top: 40pt; padding-top: 16pt; border-top: 0.5pt solid #ddd; font-size: 7.5pt; color: #888; text-align: center; line-height: 1.55; }
.toc { margin: 24pt 0 32pt; padding: 16pt; border: 1pt solid #e0d8cc; border-radius: 6pt; background: #faf7f2; }
.toc h3 { margin-top: 0; color: ${PHASE_2_AMBER}; letter-spacing: 0.12em; text-transform: uppercase; font-size: 10pt; }
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

function masterBriefBody(brand: string, output: string): string {
  const parsed = parseStage20Output(sanitise(output));
  const score = parseBriefQualityScore(parsed.scoreBlock);
  const sections = parsed.sections.length > 0
    ? parsed.sections.map((s) => `<div class="section"><div class="part-label">${escapeHtml(s.label)}</div>${md(s.content)}</div>`).join("")
    : `<div class="section">${md(sanitise(output))}</div>`;
  return cover("BRAND DETONATION", "Master Detonation Brief", brand) +
    `<div class="single-page"><h2>Master Detonation Brief</h2>${sections}${scoreCardHtml(score)}</div>` +
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
    <div><div class="lbl" style="font-size:7pt;color:#888;text-transform:uppercase;letter-spacing:0.1em">Composite</div><div class="composite">${score.composite ?? "—"}/50</div></div>
    <div class="status" style="color:${score.status === "PASS" ? PHASE_2_AMBER : "#1a1a18"}">${escapeHtml(score.status ?? "REVIEW")}</div>
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
      ${role ? `<p style="color:#666;font-style:italic;margin-bottom:14pt">${escapeHtml(role)}</p>` : ""}
      <div class="section">${md(sanitised)}</div>
    </div>` +
    footer(true);
}

function extractArch(arch: string, label: string): string {
  const labels = ["REFLECTION", "DOMAIN", "HERITAGE", "VALUES", "ASSETS", "PERSONALITY"];
  const re = new RegExp(`(?:^|\\n)\\s*(?:#{1,4}\\s*|\\*+\\s*)?${label}\\b[^\\n]*\\n([\\s\\S]*?)(?=\\n\\s*(?:#{1,4}\\s*|\\*+\\s*)?(?:${labels.join("|")})\\b|$)`, "i");
  const m = arch.match(re);
  return m ? m[1].trim() : "";
}

function brandArchitectureBody(brand: string, arch: string): string {
  const sanitised = sanitise(arch);
  const reflection = extractArch(sanitised, "REFLECTION");
  const peripherals = ["DOMAIN", "HERITAGE", "VALUES", "ASSETS", "PERSONALITY"]
    .map((l) => ({ lbl: l, txt: extractArch(sanitised, l) }));

  const box = (lbl: string, txt: string) => `<div class="arch-box"><div class="lbl">${escapeHtml(lbl)}</div><div class="txt">${escapeHtml(txt || "—")}</div></div>`;
  const grid = `<div class="arch-grid">
    ${box(peripherals[0].lbl, peripherals[0].txt)}
    ${box(peripherals[1].lbl, peripherals[1].txt)}
    ${box(peripherals[2].lbl, peripherals[2].txt)}
    ${box(peripherals[3].lbl, peripherals[3].txt)}
    <div class="arch-center"><div class="lbl">REFLECTION</div><div class="txt">${escapeHtml(reflection || "—")}</div></div>
    ${box(peripherals[4].lbl, peripherals[4].txt)}
  </div>`;

  return cover("BRAND ARCHITECTURE", "Brand Architecture", brand) +
    `<div class="section"><h2>Brand Architecture</h2>${grid}</div>` +
    `<div class="section"><h3>Full Architecture Detail</h3>${md(sanitised)}</div>` +
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
      title = "Master Detonation Brief";
      body = masterBriefBody(brand, session.stage_20_output ?? "");
      break;
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
      body = brandArchitectureBody(brand, session.stage_22_brand_architecture ?? "");
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
    sections.push(`<div class="doc-break"></div><h2>${escapeHtml(ch)} — Detonation Brief</h2>${role ? `<p style="color:#666;font-style:italic;margin-bottom:14pt">${escapeHtml(role)}</p>` : ""}<div class="section">${md(body)}</div>`);
  }
  sections.push(`<div class="doc-break"></div><div class="section"><h2>Conceptual Assets</h2>${md(sanitise(session.stage_22_distinctive_assets ?? ""))}</div>`);
  {
    const arch = sanitise(session.stage_22_brand_architecture ?? "");
    const reflection = extractArch(arch, "REFLECTION");
    const peripherals = ["DOMAIN", "HERITAGE", "VALUES", "ASSETS", "PERSONALITY"]
      .map((l) => ({ lbl: l, txt: extractArch(arch, l) }));
    const box = (lbl: string, txt: string) => `<div class="arch-box"><div class="lbl">${escapeHtml(lbl)}</div><div class="txt">${escapeHtml(txt || "—")}</div></div>`;
    const grid = `<div class="arch-grid">
      ${box(peripherals[0].lbl, peripherals[0].txt)}
      ${box(peripherals[1].lbl, peripherals[1].txt)}
      ${box(peripherals[2].lbl, peripherals[2].txt)}
      ${box(peripherals[3].lbl, peripherals[3].txt)}
      <div class="arch-center"><div class="lbl">REFLECTION</div><div class="txt">${escapeHtml(reflection || "—")}</div></div>
      ${box(peripherals[4].lbl, peripherals[4].txt)}
    </div>`;
    sections.push(`<div class="doc-break"></div><h2>Brand Architecture</h2>${grid}<div class="section"><h3>Full Architecture Detail</h3>${md(arch)}</div>`);
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
