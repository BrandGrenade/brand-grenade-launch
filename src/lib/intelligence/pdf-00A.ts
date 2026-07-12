// Document 00A — Strategic Territory Intelligence Report PDF.
// Follows the same jsPDF client-side pattern as src/lib/pdf-generator.ts:
// A4 pt units, Helvetica/Courier built-in fonts, shared palette, cover
// page with dark ground, section openers on a light ground, running
// header/footer with page numbers.

import { jsPDF } from "jspdf";

// ─── Types (mirror src/routes/intelligence.$id.tsx) ──────────────────────

type BriefType = "commercial" | "government";
type ResonanceRating = "high" | "moderate" | "low" | "counterproductive";
type RiskClass = "low" | "medium" | "high" | "very_high";

interface WhiteSpaceCell {
  assessment?: string;
  evidence?: string;
  territory_type?: "rational" | "emotional" | "both";
}
interface BrandPermission {
  score?: number;
  rationale?: string;
  permission_sources?: string[];
  permission_gaps?: string[];
}
interface FirstMover {
  score?: number;
  adoption_curve_stage?: string;
  competitive_response_scenario?: string;
  window_duration?: string;
  investment_threshold?: string;
}
interface HermitCrab {
  shell_value?: string;
  vacancy_timeline?: string;
  return_risk?: "low" | "medium" | "high";
  shape_compatibility?: string;
  vacancy_type?: string;
}
interface CulturalAdaptation {
  resonance_overall?: ResonanceRating;
  resonance_by_context?: { context?: string; rating?: ResonanceRating; notes?: string }[];
  adaptation_requirement?: string;
  cultural_risk_flags?: string[];
  cald_mapping?: null | {
    communities?: { community?: string; resonance?: string; adaptation?: string }[];
  };
}
interface HistoricalValidation {
  risk_classification?: RiskClass;
  risk_rationale?: string;
  commercial_precedents?: { case_description?: string; outcome?: string; structural_conditions?: string }[];
  government_precedents?: { case_description?: string; outcome?: string; structural_conditions?: string }[];
}
interface MeasurementFramework {
  brand_associations_to_track?: string[];
  competitive_response_signals?: string[];
  behaviour_change_metrics?: {
    immediate_0_4_weeks?: string[];
    short_term_3_6_months?: string[];
    medium_term_12_24_months?: string[];
  };
  early_warning_signals?: string[];
}
interface Prebrief {
  strategic_anchor?: string;
  tension?: string;
  audience?: string;
  cultural_context?: string;
  creative_territory_direction?: string;
  must_include?: string[];
  must_avoid?: string[];
}
interface Territory {
  id: string;
  name?: string;
  description?: string;
  type?:
    | "category_ownership"
    | "differentiated_positioning"
    | "category_creation"
    | "hermit_crab"
    | "moment_activated";
  white_space?: {
    perceptual?: WhiteSpaceCell;
    emotional?: WhiteSpaceCell;
    cultural?: WhiteSpaceCell;
    motivational?: WhiteSpaceCell;
  };
  brand_permission?: BrandPermission;
  first_mover?: FirstMover;
  hermit_crab?: HermitCrab | null;
  cultural_adaptation?: CulturalAdaptation;
  audience_readiness?: ResonanceRating | "resistant";
  audience_readiness_rationale?: string;
  historical_validation?: HistoricalValidation;
  budget_scale_threshold?: string;
  budget_rationale?: string;
  measurement_framework?: MeasurementFramework;
  strategic_recommendation?: "claim" | "do_not_claim" | "claim_with_conditions";
  recommendation_rationale?: string;
  conditions?: string[];
  prebrief_for_briefing_room?: Prebrief;
}
interface GovernmentAddendum {
  institutional_trust_assessment?: string;
  backlash_risk?: "low" | "medium" | "high";
  backlash_rationale?: string;
  accountability_documentation?: string;
  audience_resistance_mapping?: { segment?: string; resistance_level?: string; rationale?: string }[];
  cald_multicultural_strategy?: string;
}
interface CompletenessAssessment {
  inputs_present?: string[];
  inputs_absent?: string[];
  confidence?: "high" | "moderate" | "low";
  gap_impact_notes?: string[];
}
export interface IntelligenceReport {
  completeness_assessment?: CompletenessAssessment;
  executive_summary?: string;
  territories?: Territory[];
  recommended_primary_territory_id?: string;
  government_addendum?: GovernmentAddendum | null;
}

export interface Document00AInput {
  brandName: string;
  category: string;
  briefType: BriefType;
  completedAt: string | null;
  report: IntelligenceReport;
}

// ─── Palette (shared with pdf-generator.ts) ──────────────────────────────
const C_DARK = "#1A1A18";
const C_TEXT = "#1A1A18";
const C_TEXT_2 = "#6A6560";
const C_TEXT_3 = "#9A9590";
const C_ACCENT = "#D4924A";
const C_RULE = "#E0DDD8";
const C_DARK_FOOT = "#5A5550";
const C_WHITE = "#FAFAF8";
const C_SURFACE_2 = "#F2F0EB";
const C_GREEN = "#4A7C59";
const C_RED = "#B84A3C";

// A4 geometry (pt)
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M_TOP = 79.37;
const M_BOTTOM = 79.37;
const M_SIDE = 90.71;
const CONTENT_W = PAGE_W - M_SIDE * 2;

// ─── Helpers ─────────────────────────────────────────────────────────────
function setFont(doc: jsPDF, weight: "normal" | "bold" | "italic" = "normal") {
  doc.setFont("helvetica", weight);
}
function setMono(doc: jsPDF) {
  doc.setFont("courier", "normal");
}
function setTracking(doc: jsPDF, em: number) {
  const size = doc.getFontSize();
  doc.setCharSpace(em * size);
}
function clearTracking(doc: jsPDF) {
  doc.setCharSpace(0);
}
function stripMd(t: string): string {
  return (t ?? "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}
function fmtDate(iso: string | null): string {
  if (!iso) return new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function slugify(s: string): string {
  return (s || "brand").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function titleCase(s: string): string {
  return s.replace(/(^|[\s_-])(\w)/g, (_, sep, c: string) => sep.replace("_", " ") + c.toUpperCase())
    .replace(/_/g, " ");
}

const TYPE_LABEL: Record<string, string> = {
  category_ownership: "Category Ownership",
  differentiated_positioning: "Differentiated Positioning",
  category_creation: "Category Creation",
  hermit_crab: "Hermit Crab",
  moment_activated: "Moment Activated",
};
const RECO_LABEL: Record<string, string> = {
  claim: "Claim",
  claim_with_conditions: "Claim with Conditions",
  do_not_claim: "Do Not Claim",
};
const RECO_COLOR: Record<string, string> = {
  claim: C_GREEN,
  claim_with_conditions: C_ACCENT,
  do_not_claim: C_RED,
};
const RISK_LABEL: Record<string, string> = {
  low: "Low", medium: "Medium", high: "High", very_high: "Very High",
};

// ─── Flow layout engine ──────────────────────────────────────────────────
type Flow = {
  doc: jsPDF;
  y: number;
  page: number;
  totalPages: number;
  sectionTitle: string;
};

function newFlow(doc: jsPDF): Flow {
  return { doc, y: M_TOP, page: 1, totalPages: 1, sectionTitle: "" };
}
function drawFooter(f: Flow) {
  const { doc } = f;
  doc.setDrawColor(C_RULE);
  doc.setLineWidth(0.5);
  doc.line(M_SIDE, PAGE_H - M_BOTTOM + 24, PAGE_W - M_SIDE, PAGE_H - M_BOTTOM + 24);
  doc.setTextColor(C_DARK_FOOT);
  setFont(doc, "normal");
  doc.setFontSize(8);
  setTracking(doc, 0.06);
  doc.text("BRAND GRENADE  ·  DOCUMENT 00A", M_SIDE, PAGE_H - M_BOTTOM + 38);
  clearTracking(doc);
  doc.text(String(f.page), PAGE_W - M_SIDE, PAGE_H - M_BOTTOM + 38, { align: "right" });
}
function drawHeader(f: Flow) {
  if (!f.sectionTitle) return;
  const { doc } = f;
  doc.setTextColor(C_TEXT_3);
  setFont(doc, "bold");
  doc.setFontSize(8);
  setTracking(doc, 0.1);
  doc.text(f.sectionTitle.toUpperCase(), M_SIDE, M_TOP - 24);
  clearTracking(doc);
}
function newPage(f: Flow) {
  drawFooter(f);
  f.doc.addPage();
  f.page += 1;
  f.y = M_TOP;
  drawHeader(f);
}
function ensureSpace(f: Flow, needed: number) {
  if (f.y + needed > PAGE_H - M_BOTTOM) newPage(f);
}
function setSection(f: Flow, title: string) {
  f.sectionTitle = title;
  drawHeader(f);
}

function drawText(
  f: Flow,
  text: string,
  opts: {
    size?: number;
    weight?: "normal" | "bold" | "italic";
    color?: string;
    lineHeight?: number;
    maxWidth?: number;
    indent?: number;
    gapAfter?: number;
  } = {},
) {
  const { doc } = f;
  const size = opts.size ?? 10;
  const lh = size * (opts.lineHeight ?? 1.35);
  const width = opts.maxWidth ?? CONTENT_W - (opts.indent ?? 0);
  const x = M_SIDE + (opts.indent ?? 0);
  setFont(doc, opts.weight ?? "normal");
  doc.setFontSize(size);
  doc.setTextColor(opts.color ?? C_TEXT);
  const clean = stripMd(text ?? "");
  if (!clean) return;
  const lines = doc.splitTextToSize(clean, width) as string[];
  for (const ln of lines) {
    ensureSpace(f, lh);
    doc.text(ln, x, f.y + size);
    f.y += lh;
  }
  if (opts.gapAfter) f.y += opts.gapAfter;
}

function drawH1(f: Flow, text: string) {
  ensureSpace(f, 60);
  drawText(f, text, { size: 20, weight: "bold", color: C_TEXT, lineHeight: 1.2 });
  // amber rule
  ensureSpace(f, 12);
  f.doc.setFillColor(C_ACCENT);
  f.doc.rect(M_SIDE, f.y + 4, 40, 2, "F");
  f.y += 20;
}
function drawH2(f: Flow, text: string) {
  ensureSpace(f, 34);
  f.y += 8;
  drawText(f, text, { size: 13, weight: "bold", color: C_TEXT, lineHeight: 1.25, gapAfter: 6 });
}
function drawLabel(f: Flow, text: string) {
  ensureSpace(f, 16);
  const { doc } = f;
  setFont(doc, "bold");
  doc.setFontSize(8);
  doc.setTextColor(C_TEXT_2);
  setTracking(doc, 0.1);
  doc.text(text.toUpperCase(), M_SIDE, f.y + 8);
  clearTracking(doc);
  f.y += 14;
}
function drawP(f: Flow, text: string) {
  if (!text?.trim()) return;
  drawText(f, text, { size: 10, color: C_TEXT, gapAfter: 6 });
}
function drawLI(f: Flow, text: string) {
  if (!text?.trim()) return;
  const { doc } = f;
  const bulletX = M_SIDE + 4;
  const textIndent = 14;
  setFont(doc, "normal");
  doc.setFontSize(10);
  doc.setTextColor(C_TEXT);
  const lines = doc.splitTextToSize(stripMd(text), CONTENT_W - textIndent) as string[];
  const lh = 10 * 1.4;
  ensureSpace(f, lh);
  doc.setFillColor(C_ACCENT);
  doc.circle(bulletX, f.y + 6, 1.2, "F");
  for (let i = 0; i < lines.length; i += 1) {
    if (i > 0) ensureSpace(f, lh);
    doc.text(lines[i], M_SIDE + textIndent, f.y + 8);
    f.y += lh;
  }
  f.y += 2;
}
function drawCheck(f: Flow, text: string, present: boolean) {
  const { doc } = f;
  const lh = 10 * 1.4;
  ensureSpace(f, lh);
  const cx = M_SIDE + 6;
  if (present) {
    doc.setDrawColor(C_GREEN);
    doc.setLineWidth(1.3);
    doc.line(cx - 3, f.y + 6, cx - 1, f.y + 8);
    doc.line(cx - 1, f.y + 8, cx + 3, f.y + 4);
  } else {
    doc.setDrawColor(C_TEXT_3);
    doc.setLineWidth(1);
    doc.circle(cx, f.y + 6, 2.5, "S");
  }
  setFont(doc, "normal");
  doc.setFontSize(10);
  doc.setTextColor(present ? C_TEXT : C_TEXT_2);
  const lines = doc.splitTextToSize(text, CONTENT_W - 18) as string[];
  for (let i = 0; i < lines.length; i += 1) {
    if (i > 0) ensureSpace(f, lh);
    doc.text(lines[i], M_SIDE + 18, f.y + 8);
    f.y += lh;
  }
  f.y += 2;
}
function drawBadge(f: Flow, text: string, color: string) {
  const { doc } = f;
  setFont(doc, "bold");
  doc.setFontSize(8);
  setTracking(doc, 0.08);
  const label = text.toUpperCase();
  const w = doc.getTextWidth(label) + 14;
  const h = 16;
  ensureSpace(f, h + 4);
  doc.setFillColor(color);
  doc.roundedRect(M_SIDE, f.y, w, h, 3, 3, "F");
  doc.setTextColor(C_WHITE);
  doc.text(label, M_SIDE + 7, f.y + 11);
  clearTracking(doc);
  f.y += h + 6;
}
function drawRule(f: Flow) {
  ensureSpace(f, 12);
  f.doc.setDrawColor(C_RULE);
  f.doc.setLineWidth(0.5);
  f.doc.line(M_SIDE, f.y + 6, PAGE_W - M_SIDE, f.y + 6);
  f.y += 14;
}

// ─── Cover ───────────────────────────────────────────────────────────────
async function loadIconDataUrl(): Promise<string | null> {
  try {
    const res = await fetch("/brand-grenade-icon.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve((r.result as string) ?? null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawCover(doc: jsPDF, input: Document00AInput, iconDataUrl: string | null) {
  doc.setFillColor(C_DARK);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  const iconSize = 28;
  if (iconDataUrl) {
    try {
      doc.addImage(iconDataUrl, "PNG", M_SIDE, M_TOP - iconSize + 3, iconSize, iconSize);
    } catch {
      /* ignore */
    }
  }
  doc.setTextColor(C_WHITE);
  setFont(doc, "bold");
  doc.setFontSize(11);
  setTracking(doc, 0.06);
  doc.text("BRAND GRENADE", M_SIDE + (iconDataUrl ? iconSize + 10 : 0), M_TOP - 8);
  clearTracking(doc);

  const cy = PAGE_H / 2;

  doc.setTextColor(C_ACCENT);
  setFont(doc, "bold");
  doc.setFontSize(11);
  setTracking(doc, 0.1);
  doc.text("DOCUMENT 00A", PAGE_W / 2, cy - 80, { align: "center" });
  clearTracking(doc);

  doc.setTextColor(C_WHITE);
  setFont(doc, "bold");
  doc.setFontSize(28);
  const titleLines = doc.splitTextToSize(
    "Strategic Territory Intelligence Report",
    PAGE_W - M_SIDE * 2,
  ) as string[];
  let ty = cy - 40;
  for (const ln of titleLines) {
    doc.text(ln, PAGE_W / 2, ty, { align: "center" });
    ty += 32;
  }

  doc.setFillColor(C_ACCENT);
  doc.rect(PAGE_W / 2 - 24, ty + 12, 48, 2, "F");

  doc.setTextColor(C_TEXT_3);
  setFont(doc, "normal");
  doc.setFontSize(14);
  doc.text(input.brandName, PAGE_W / 2, ty + 48, { align: "center" });

  doc.setFontSize(11);
  doc.text(
    [input.category, titleCase(input.briefType) + " brief"].filter(Boolean).join("  ·  "),
    PAGE_W / 2,
    ty + 68,
    { align: "center" },
  );

  const conf = input.report.completeness_assessment?.confidence;
  if (conf) {
    doc.setTextColor(C_ACCENT);
    setFont(doc, "bold");
    doc.setFontSize(9);
    setTracking(doc, 0.1);
    doc.text(`CONFIDENCE — ${conf.toUpperCase()}`, PAGE_W / 2, ty + 92, { align: "center" });
    clearTracking(doc);
  }

  doc.setTextColor(C_DARK_FOOT);
  setFont(doc, "normal");
  doc.setFontSize(9);
  setTracking(doc, 0.08);
  doc.text("CONFIDENTIAL", M_SIDE, PAGE_H - M_BOTTOM);
  doc.text(fmtDate(input.completedAt), PAGE_W - M_SIDE, PAGE_H - M_BOTTOM, { align: "right" });
  clearTracking(doc);
}

// ─── Section opener ──────────────────────────────────────────────────────
function drawSectionOpener(f: Flow, numberLabel: string, title: string) {
  drawFooter(f);
  f.doc.addPage();
  f.page += 1;
  f.doc.setFillColor(C_SURFACE_2);
  f.doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  const numberY = PAGE_H * 0.32;
  f.doc.setTextColor(C_RULE);
  setMono(f.doc);
  f.doc.setFontSize(72);
  f.doc.text(numberLabel, M_SIDE, numberY);

  f.doc.setFillColor(C_ACCENT);
  f.doc.rect(M_SIDE, numberY + 16, 40, 3, "F");

  f.doc.setTextColor(C_TEXT);
  setFont(f.doc, "bold");
  f.doc.setFontSize(24);
  const lines = f.doc.splitTextToSize(stripMd(title), (PAGE_W - M_SIDE * 2) * 0.7) as string[];
  let ty = numberY + 60;
  for (const ln of lines) {
    f.doc.text(ln, M_SIDE, ty);
    ty += 28;
  }

  // page counter footer for the opener too
  f.doc.setTextColor(C_DARK_FOOT);
  setFont(f.doc, "normal");
  f.doc.setFontSize(8);
  setTracking(f.doc, 0.06);
  f.doc.text("BRAND GRENADE  ·  DOCUMENT 00A", M_SIDE, PAGE_H - M_BOTTOM + 38);
  clearTracking(f.doc);
  f.doc.text(String(f.page), PAGE_W - M_SIDE, PAGE_H - M_BOTTOM + 38, { align: "right" });

  // Now start a fresh content page
  f.doc.addPage();
  f.page += 1;
  f.y = M_TOP;
  setSection(f, title);
}

// ─── Sections ────────────────────────────────────────────────────────────
function renderExecutiveSummary(f: Flow, report: IntelligenceReport) {
  drawSectionOpener(f, "01", "Executive Summary");
  const text = report.executive_summary?.trim();
  if (!text) {
    drawP(f, "No executive summary produced.");
    return;
  }
  // Split paragraphs
  const paras = text.split(/\n{2,}/);
  for (const p of paras) drawP(f, p);
}

function renderCompleteness(f: Flow, report: IntelligenceReport) {
  drawSectionOpener(f, "02", "Completeness Assessment");
  const c = report.completeness_assessment;
  if (!c) {
    drawP(f, "No completeness assessment recorded.");
    return;
  }
  if (c.confidence) {
    drawLabel(f, "Confidence Tier");
    drawP(f, c.confidence.charAt(0).toUpperCase() + c.confidence.slice(1));
  }
  if (c.inputs_present?.length) {
    drawLabel(f, "Inputs Present");
    for (const it of c.inputs_present) drawCheck(f, it, true);
  }
  if (c.inputs_absent?.length) {
    drawLabel(f, "Inputs Absent");
    for (const it of c.inputs_absent) drawCheck(f, it, false);
  }
  if (c.gap_impact_notes?.length) {
    drawLabel(f, "Gap Impact Notes");
    for (const it of c.gap_impact_notes) drawLI(f, it);
  }
}

function renderTerritory(
  f: Flow,
  t: Territory,
  rank: number,
  isPrimary: boolean,
) {
  // Territory header
  f.y += 4;
  ensureSpace(f, 50);
  const { doc } = f;
  // Rank + primary chip row
  setFont(doc, "bold");
  doc.setFontSize(9);
  doc.setTextColor(C_ACCENT);
  setTracking(doc, 0.1);
  doc.text(`TERRITORY ${String(rank).padStart(2, "0")}`, M_SIDE, f.y + 8);
  if (isPrimary) {
    const label = "RECOMMENDED PRIMARY";
    clearTracking(doc);
    doc.setFontSize(8);
    const w = doc.getTextWidth(label) + 14;
    doc.setFillColor(C_ACCENT);
    doc.roundedRect(PAGE_W - M_SIDE - w, f.y - 2, w, 14, 3, 3, "F");
    doc.setTextColor(C_WHITE);
    doc.text(label, PAGE_W - M_SIDE - w + 7, f.y + 8);
    doc.setFontSize(9);
    setTracking(doc, 0.1);
  }
  clearTracking(doc);
  f.y += 16;

  drawText(f, t.name || "Untitled territory", {
    size: 16, weight: "bold", color: C_TEXT, gapAfter: 4,
  });
  if (t.type) {
    drawText(f, TYPE_LABEL[t.type] ?? titleCase(t.type), {
      size: 9, weight: "bold", color: C_TEXT_2, gapAfter: 8,
    });
  }
  if (t.description) drawP(f, t.description);

  // Strategic recommendation
  if (t.strategic_recommendation) {
    drawLabel(f, "Strategic Recommendation");
    drawBadge(
      f,
      RECO_LABEL[t.strategic_recommendation] ?? t.strategic_recommendation,
      RECO_COLOR[t.strategic_recommendation] ?? C_TEXT_2,
    );
    if (t.recommendation_rationale) drawP(f, t.recommendation_rationale);
    if (t.conditions?.length) {
      drawLabel(f, "Conditions");
      for (const c of t.conditions) drawLI(f, c);
    }
  }

  // First mover
  if (t.first_mover) {
    drawLabel(f, "First Mover");
    const parts: string[] = [];
    if (typeof t.first_mover.score === "number")
      parts.push(`Score: ${t.first_mover.score}/10`);
    if (t.first_mover.adoption_curve_stage)
      parts.push(`Stage: ${titleCase(t.first_mover.adoption_curve_stage)}`);
    if (t.first_mover.window_duration)
      parts.push(`Window: ${t.first_mover.window_duration}`);
    if (t.first_mover.investment_threshold)
      parts.push(`Investment: ${t.first_mover.investment_threshold}`);
    if (parts.length) drawP(f, parts.join("  ·  "));
    if (t.first_mover.competitive_response_scenario)
      drawP(f, t.first_mover.competitive_response_scenario);
  }

  // White space
  if (t.white_space) {
    drawLabel(f, "White Space Assessment");
    const dims: Array<[string, WhiteSpaceCell | undefined]> = [
      ["Perceptual", t.white_space.perceptual],
      ["Emotional", t.white_space.emotional],
      ["Cultural", t.white_space.cultural],
      ["Motivational", t.white_space.motivational],
    ];
    for (const [name, cell] of dims) {
      if (!cell) continue;
      drawText(f, name, { size: 10, weight: "bold", gapAfter: 2 });
      if (cell.assessment) drawP(f, cell.assessment);
      if (cell.evidence) drawP(f, `Evidence: ${cell.evidence}`);
    }
  }

  // Brand permission
  if (t.brand_permission) {
    drawLabel(f, "Brand Permission");
    if (typeof t.brand_permission.score === "number")
      drawP(f, `Score: ${t.brand_permission.score}/10`);
    if (t.brand_permission.rationale) drawP(f, t.brand_permission.rationale);
    if (t.brand_permission.permission_sources?.length) {
      drawText(f, "Sources", { size: 9, weight: "bold", color: C_TEXT_2, gapAfter: 2 });
      for (const s of t.brand_permission.permission_sources) drawLI(f, s);
    }
    if (t.brand_permission.permission_gaps?.length) {
      drawText(f, "Gaps", { size: 9, weight: "bold", color: C_TEXT_2, gapAfter: 2 });
      for (const s of t.brand_permission.permission_gaps) drawLI(f, s);
    }
  }

  // Hermit crab
  if (t.hermit_crab) {
    drawLabel(f, "Hermit Crab Assessment");
    const hc = t.hermit_crab;
    if (hc.shell_value) drawP(f, `Shell value: ${hc.shell_value}`);
    if (hc.vacancy_type) drawP(f, `Vacancy type: ${titleCase(hc.vacancy_type)}`);
    if (hc.vacancy_timeline) drawP(f, `Vacancy timeline: ${hc.vacancy_timeline}`);
    if (hc.return_risk) drawP(f, `Return risk: ${titleCase(hc.return_risk)}`);
    if (hc.shape_compatibility) drawP(f, `Shape compatibility: ${hc.shape_compatibility}`);
  }

  // Cultural
  if (t.cultural_adaptation) {
    drawLabel(f, "Cultural Adaptation");
    const ca = t.cultural_adaptation;
    if (ca.resonance_overall) drawP(f, `Overall resonance: ${titleCase(ca.resonance_overall)}`);
    if (ca.adaptation_requirement) drawP(f, ca.adaptation_requirement);
    if (ca.cultural_risk_flags?.length) {
      drawText(f, "Risk flags", { size: 9, weight: "bold", color: C_TEXT_2, gapAfter: 2 });
      for (const r of ca.cultural_risk_flags) drawLI(f, r);
    }
  }

  // Audience + budget
  if (t.audience_readiness || t.budget_scale_threshold) {
    drawLabel(f, "Audience & Commercial");
    if (t.audience_readiness) drawP(f, `Audience readiness: ${titleCase(String(t.audience_readiness))}`);
    if (t.audience_readiness_rationale) drawP(f, t.audience_readiness_rationale);
    if (t.budget_scale_threshold) drawP(f, `Budget threshold: ${t.budget_scale_threshold}`);
    if (t.budget_rationale) drawP(f, t.budget_rationale);
  }

  // Historical validation
  if (t.historical_validation) {
    drawLabel(f, "Historical Validation");
    const hv = t.historical_validation;
    if (hv.risk_classification)
      drawP(f, `Risk classification: ${RISK_LABEL[hv.risk_classification] ?? hv.risk_classification}`);
    if (hv.risk_rationale) drawP(f, hv.risk_rationale);
    const cases = [...(hv.commercial_precedents ?? []), ...(hv.government_precedents ?? [])];
    if (cases.length) {
      drawText(f, "Precedents", { size: 9, weight: "bold", color: C_TEXT_2, gapAfter: 2 });
      for (const c of cases) {
        const line = [c.case_description, c.outcome].filter(Boolean).join(" — ");
        if (line) drawLI(f, line);
      }
    }
  }

  // Measurement framework
  if (t.measurement_framework) {
    drawLabel(f, "Measurement Framework");
    const mf = t.measurement_framework;
    if (mf.brand_associations_to_track?.length) {
      drawText(f, "Brand associations to track", { size: 9, weight: "bold", color: C_TEXT_2, gapAfter: 2 });
      for (const s of mf.brand_associations_to_track) drawLI(f, s);
    }
    if (mf.competitive_response_signals?.length) {
      drawText(f, "Competitive response signals", { size: 9, weight: "bold", color: C_TEXT_2, gapAfter: 2 });
      for (const s of mf.competitive_response_signals) drawLI(f, s);
    }
    if (mf.early_warning_signals?.length) {
      drawText(f, "Early warning signals", { size: 9, weight: "bold", color: C_TEXT_2, gapAfter: 2 });
      for (const s of mf.early_warning_signals) drawLI(f, s);
    }
  }

  // Pre-brief
  if (t.prebrief_for_briefing_room) {
    drawLabel(f, "Pre-brief for Briefing Room");
    const pb = t.prebrief_for_briefing_room;
    if (pb.strategic_anchor) {
      drawText(f, "Strategic anchor", { size: 9, weight: "bold", color: C_TEXT_2, gapAfter: 2 });
      drawP(f, pb.strategic_anchor);
    }
    if (pb.tension) {
      drawText(f, "Tension", { size: 9, weight: "bold", color: C_TEXT_2, gapAfter: 2 });
      drawP(f, pb.tension);
    }
    if (pb.audience) {
      drawText(f, "Audience", { size: 9, weight: "bold", color: C_TEXT_2, gapAfter: 2 });
      drawP(f, pb.audience);
    }
    if (pb.cultural_context) {
      drawText(f, "Cultural context", { size: 9, weight: "bold", color: C_TEXT_2, gapAfter: 2 });
      drawP(f, pb.cultural_context);
    }
    if (pb.creative_territory_direction) {
      drawText(f, "Creative territory direction", { size: 9, weight: "bold", color: C_TEXT_2, gapAfter: 2 });
      drawP(f, pb.creative_territory_direction);
    }
    if (pb.must_include?.length) {
      drawText(f, "Must include", { size: 9, weight: "bold", color: C_TEXT_2, gapAfter: 2 });
      for (const s of pb.must_include) drawLI(f, s);
    }
    if (pb.must_avoid?.length) {
      drawText(f, "Must avoid", { size: 9, weight: "bold", color: C_TEXT_2, gapAfter: 2 });
      for (const s of pb.must_avoid) drawLI(f, s);
    }
  }

  drawRule(f);
}

function renderTerritories(f: Flow, report: IntelligenceReport) {
  drawSectionOpener(f, "03", "Territory Recommendations");
  const territories = report.territories ?? [];
  const primaryId = report.recommended_primary_territory_id ?? null;
  const ordered = primaryId
    ? [...territories].sort((a, b) => (a.id === primaryId ? -1 : b.id === primaryId ? 1 : 0))
    : territories;
  if (!ordered.length) {
    drawP(f, "No territories produced.");
    return;
  }
  ordered.forEach((t, i) => {
    if (i > 0) {
      // Start each territory on a fresh page for readability
      drawFooter(f);
      f.doc.addPage();
      f.page += 1;
      f.y = M_TOP;
      drawHeader(f);
    }
    renderTerritory(f, t, i + 1, t.id === primaryId);
  });
}

function renderGovernmentAddendum(f: Flow, addendum: GovernmentAddendum) {
  drawSectionOpener(f, "04", "Government Addendum");
  if (addendum.institutional_trust_assessment) {
    drawLabel(f, "Institutional Trust Assessment");
    drawP(f, addendum.institutional_trust_assessment);
  }
  if (addendum.backlash_risk) {
    drawLabel(f, "Backlash Risk");
    drawBadge(
      f,
      titleCase(addendum.backlash_risk),
      addendum.backlash_risk === "high"
        ? C_RED
        : addendum.backlash_risk === "medium"
          ? C_ACCENT
          : C_GREEN,
    );
    if (addendum.backlash_rationale) drawP(f, addendum.backlash_rationale);
  }
  if (addendum.accountability_documentation) {
    drawLabel(f, "Accountability Documentation");
    drawP(f, addendum.accountability_documentation);
  }
  if (addendum.audience_resistance_mapping?.length) {
    drawLabel(f, "Audience Resistance Mapping");
    for (const seg of addendum.audience_resistance_mapping) {
      const line = [
        seg.segment,
        seg.resistance_level ? `Resistance: ${titleCase(seg.resistance_level)}` : "",
        seg.rationale,
      ]
        .filter(Boolean)
        .join(" — ");
      if (line) drawLI(f, line);
    }
  }
  if (addendum.cald_multicultural_strategy) {
    drawLabel(f, "CALD Multicultural Strategy");
    drawP(f, addendum.cald_multicultural_strategy);
  }
}

// ─── Public entry ────────────────────────────────────────────────────────
export async function generateDocument00APdf(input: Document00AInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: false });
  const iconDataUrl = await loadIconDataUrl();

  drawCover(doc, input, iconDataUrl);

  const f = newFlow(doc);
  // We drew the cover on page 1 without footer; start content flow on new page.
  doc.addPage();
  f.page = 2;
  f.y = M_TOP;

  renderExecutiveSummary(f, input.report);
  renderCompleteness(f, input.report);
  renderTerritories(f, input.report);
  if (input.briefType === "government" && input.report.government_addendum) {
    renderGovernmentAddendum(f, input.report.government_addendum);
  }

  // Final page footer
  drawFooter(f);

  return doc.output("blob");
}

export function document00AFilename(brandName: string, completedAt: string | null): string {
  const date = (completedAt ? new Date(completedAt) : new Date()).toISOString().slice(0, 10);
  return `BrandGrenade_00A_${slugify(brandName)}_${date}.pdf`;
}

export async function downloadDocument00APdf(input: Document00AInput): Promise<number> {
  const blob = await generateDocument00APdf(input);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = document00AFilename(input.brandName, input.completedAt);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return blob.size;
}
