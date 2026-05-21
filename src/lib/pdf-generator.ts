// Brand Grenade — Strategic Platform PDF generator (V3)
// Implements the senior-partner design system: A4, two-column grid,
// dedicated cover, full-page section openers, full-bleed proposition
// reveal, running header/footer with section tracking.
//
// Renders with jsPDF using Helvetica / Courier as Inter / JetBrains Mono
// stand-ins (built-in jsPDF fonts — no embed cost).

import { jsPDF } from "jspdf";
import type { Stage16Format } from "./stage16-prompt";
import { getTemplateContent } from "./stage16-content";

export type PdfFormat = Stage16Format;

export interface PdfInput {
  brandName: string;
  category: string;
  smp: string;
  format: PdfFormat;
  /** Raw Stage 16 markdown for the selected format. */
  stage16Output: string;
}

// ─── Palette ────────────────────────────────────────────────────────────
const C_PAGE = "#FAFAF8";
const C_SURFACE_2 = "#F2F0EB";
const C_DARK = "#1A1A18";
const C_TEXT = "#1A1A18";
const C_TEXT_2 = "#6A6560";
const C_TEXT_3 = "#9A9590";
const C_ACCENT = "#C8873A";
const C_RULE = "#E0DDD8";
const C_DARK_FOOT = "#5A5550";
const C_WHITE = "#FAFAF8";

// ─── A4 geometry (pt) ───────────────────────────────────────────────────
const PAGE_W = 595.28;
const PAGE_H = 841.89;
// 28mm vertical, 32mm horizontal
const M_TOP = 79.37;
const M_BOTTOM = 79.37;
const M_SIDE = 90.71;
const CONTENT_W = PAGE_W - M_SIDE * 2;
// Two-column grid: 68% content, 32% margin
const COL_CONTENT_W = CONTENT_W * 0.68;
const COL_MARGIN_X = M_SIDE + CONTENT_W * 0.68 + 12; // small gutter

const DOC_LABEL: Record<PdfFormat, string> = {
  agency: "AGENCY STRATEGY PLATFORM",
  consulting: "BOARD STRATEGY RECOMMENDATION",
  workshop: "BRAND STRATEGY WORKSHOP GUIDE",
};

const FORMAT_FILE: Record<PdfFormat, string> = {
  agency: "AgencyStrategyPlatform",
  consulting: "BoardStrategyRecommendation",
  workshop: "BrandStrategyWorkshopGuide",
};

// ─── Helpers ────────────────────────────────────────────────────────────
function setFont(doc: jsPDF, weight: "normal" | "bold" | "italic" = "normal") {
  doc.setFont("helvetica", weight);
}
function setMono(doc: jsPDF) {
  doc.setFont("courier", "normal");
}
/** Set letter-spacing in em (relative to current font size, pt-based). */
function setTracking(doc: jsPDF, em: number) {
  const size = doc.getFontSize();
  doc.setCharSpace(em * size);
}
function clearTracking(doc: jsPDF) {
  doc.setCharSpace(0);
}
function monthYear(d = new Date()): string {
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}
function stripMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^["“”']+|["“”']+$/g, "")
    .trim();
}
function normaliseForMatch(s: string): string {
  return stripMd(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ─── Cover ──────────────────────────────────────────────────────────────
function drawCover(doc: jsPDF, input: PdfInput) {
  doc.setFillColor(C_DARK);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // Top-left BRAND GRENADE
  doc.setTextColor(C_WHITE);
  setFont(doc, "bold");
  doc.setFontSize(10);
  doc.text(tracked("BRAND GRENADE", 1.2), M_SIDE, M_TOP);

  // Centre stack
  const cy = PAGE_H / 2;

  doc.setTextColor(C_ACCENT);
  setFont(doc, "bold");
  doc.setFontSize(10);
  doc.text(tracked(DOC_LABEL[input.format], 1.1), PAGE_W / 2, cy - 36, {
    align: "center",
  });

  doc.setTextColor(C_TEXT_3);
  setFont(doc, "normal");
  doc.setFontSize(14);
  doc.text(input.category || "Strategic Platform", PAGE_W / 2, cy - 4, {
    align: "center",
  });

  // 40px gap then amber rule 48x2
  doc.setFillColor(C_ACCENT);
  doc.rect(PAGE_W / 2 - 24, cy + 28, 48, 2, "F");

  // 40px gap then month/year
  doc.setTextColor(C_DARK_FOOT);
  setFont(doc, "normal");
  doc.setFontSize(10);
  doc.text(monthYear(), PAGE_W / 2, cy + 86, { align: "center" });

  // Bottom row
  doc.setTextColor(C_DARK_FOOT);
  setFont(doc, "normal");
  doc.setFontSize(9);
  doc.text(tracked("CONFIDENTIAL"), M_SIDE, PAGE_H - M_BOTTOM);
  doc.text(
    "Brand Grenade Strategy Intelligence System",
    PAGE_W - M_SIDE,
    PAGE_H - M_BOTTOM,
    { align: "right" },
  );
}

// ─── Section Opener Page ────────────────────────────────────────────────
function drawSectionOpener(
  doc: jsPDF,
  numberLabel: string,
  title: string,
) {
  doc.addPage();
  doc.setFillColor(C_SURFACE_2);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // Top third — left aligned. Large mono number.
  const numberY = PAGE_H * 0.32;
  doc.setTextColor(C_RULE);
  setMono(doc);
  doc.setFontSize(72);
  doc.text(numberLabel, M_SIDE, numberY);

  // Amber rule below number (16px gap → ~16pt)
  doc.setFillColor(C_ACCENT);
  doc.rect(M_SIDE, numberY + 16, 40, 3, "F");

  // Section title 24px below rule
  doc.setTextColor(C_TEXT);
  setFont(doc, "bold");
  doc.setFontSize(24);
  const titleW = (PAGE_W - M_SIDE * 2) * 0.6;
  const titleLines = doc.splitTextToSize(stripMd(title), titleW) as string[];
  let ty = numberY + 16 + 3 + 28 + 24;
  for (const ln of titleLines) {
    doc.text(ln, M_SIDE, ty);
    ty += 24 * 1.2;
  }

  // Bottom full-width amber rule
  doc.setFillColor(C_ACCENT);
  doc.rect(M_SIDE, PAGE_H - M_BOTTOM, PAGE_W - M_SIDE * 2, 1, "F");
}

// ─── Proposition Reveal Page ────────────────────────────────────────────
function drawPropositionReveal(doc: jsPDF, smp: string) {
  doc.addPage();
  doc.setFillColor(C_DARK);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  doc.setTextColor(C_WHITE);
  setFont(doc, "bold");
  doc.setFontSize(28); // ~36px screen
  const maxW = 460;
  const lines = doc.splitTextToSize(stripMd(smp), maxW) as string[];
  const lh = 28 * 1.3;
  const totalH = lines.length * lh;
  const startY = (PAGE_H - totalH) / 2;
  lines.forEach((ln, i) => {
    doc.text(ln, PAGE_W / 2, startY + i * lh, { align: "center" });
  });

  // 32px gap then amber rule 48x2 centred
  doc.setFillColor(C_ACCENT);
  doc.rect(PAGE_W / 2 - 24, startY + totalH + 26, 48, 2, "F");
}

// ─── Content blocks ─────────────────────────────────────────────────────
type Block =
  | { kind: "part"; numberLabel: string; title: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "callout"; text: string }
  | { kind: "li"; text: string }
  | { kind: "hr" }
  | { kind: "label"; text: string }
  | { kind: "p"; text: string };

function parseContent(raw: string): Block[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let buf: string[] = [];
  let partCounter = 0;
  const flush = () => {
    if (!buf.length) return;
    const text = buf.join(" ").trim();
    if (text) blocks.push({ kind: "p", text });
    buf = [];
  };
  for (const ln of lines) {
    const t = ln.trim();
    if (!t) {
      flush();
      continue;
    }
    if (t.startsWith("# ")) {
      flush();
      partCounter += 1;
      const titleRaw = t.slice(2).trim();
      // Strip leading "PART X — " if author included it; we render the number.
      const m = titleRaw.match(/^PART\s+[A-Z0-9]+\s*[—\-:]\s*(.+)$/i);
      const title = m ? m[1] : titleRaw;
      blocks.push({
        kind: "part",
        numberLabel: String(partCounter).padStart(2, "0"),
        title,
      });
    } else if (t.startsWith("## ")) {
      flush();
      blocks.push({ kind: "h2", text: t.slice(3).trim() });
    } else if (t.startsWith("### ")) {
      flush();
      blocks.push({ kind: "h3", text: t.slice(4).trim() });
    } else if (t.startsWith("> ")) {
      flush();
      blocks.push({ kind: "callout", text: t.slice(2).trim() });
    } else if (/^[-*]\s+/.test(t)) {
      flush();
      blocks.push({ kind: "li", text: t.replace(/^[-*]\s+/, "").trim() });
    } else if (/^---+$/.test(t)) {
      flush();
      blocks.push({ kind: "hr" });
    } else if (/^[A-Z][A-Z0-9 \-]{2,}:$/.test(t)) {
      flush();
      blocks.push({ kind: "label", text: t.replace(/:$/, "") });
    } else {
      buf.push(t);
    }
  }
  flush();
  return blocks;
}

// ─── Content pages ──────────────────────────────────────────────────────
function drawContent(doc: jsPDF, input: PdfInput) {
  const body =
    input.stage16Output && input.stage16Output.trim().length > 0
      ? input.stage16Output
      : getTemplateContent(input.format);
  const blocks = parseContent(body);
  const smpNorm = normaliseForMatch(input.smp);

  let pageNum = 0;
  let y = M_TOP;
  let currentSection = "";
  let onOpenerPage = false; // section opener / cover / reveal — skip header/footer
  let propositionRendered = false;

  const drawChrome = () => {
    if (onOpenerPage) return;
    // Header
    doc.setTextColor(C_TEXT_3);
    setFont(doc, "normal");
    doc.setFontSize(8);
    doc.text(DOC_LABEL[input.format], M_SIDE, M_TOP - 22);
    doc.text(
      currentSection || input.brandName,
      PAGE_W - M_SIDE,
      M_TOP - 22,
      { align: "right" },
    );
    doc.setDrawColor(C_RULE);
    doc.setLineWidth(0.5);
    doc.line(M_SIDE, M_TOP - 14, PAGE_W - M_SIDE, M_TOP - 14);

    // Footer
    doc.setDrawColor(C_RULE);
    doc.setLineWidth(0.5);
    doc.line(
      M_SIDE,
      PAGE_H - M_BOTTOM + 14,
      PAGE_W - M_SIDE,
      PAGE_H - M_BOTTOM + 14,
    );
    setFont(doc, "normal");
    doc.setFontSize(9);
    doc.setTextColor(C_TEXT_3);
    doc.text(String(pageNum), PAGE_W / 2, PAGE_H - M_BOTTOM + 28, {
      align: "center",
    });
    doc.setTextColor(C_ACCENT);
    doc.text(
      "Brand Grenade Confidential",
      PAGE_W - M_SIDE,
      PAGE_H - M_BOTTOM + 28,
      { align: "right" },
    );
  };

  const newContentPage = () => {
    doc.addPage();
    doc.setFillColor(C_PAGE);
    doc.rect(0, 0, PAGE_W, PAGE_H, "F");
    pageNum += 1;
    y = M_TOP;
    onOpenerPage = false;
    drawChrome();
  };

  const ensureSpace = (need: number) => {
    if (y + need > PAGE_H - M_BOTTOM) newContentPage();
  };

  const writeWrapped = (
    text: string,
    sizePt: number,
    color: string,
    weight: "normal" | "bold" | "italic" = "normal",
    lineFactor = 1.85,
    leftPad = 0,
    maxW = COL_CONTENT_W,
  ) => {
    doc.setTextColor(color);
    setFont(doc, weight);
    doc.setFontSize(sizePt);
    const lines = doc.splitTextToSize(
      stripMd(text),
      maxW - leftPad,
    ) as string[];
    const lh = sizePt * lineFactor;
    for (const ln of lines) {
      ensureSpace(lh);
      doc.text(ln, M_SIDE + leftPad, y + sizePt);
      y += lh;
    }
  };

  // Start first content page
  newContentPage();

  for (const b of blocks) {
    switch (b.kind) {
      case "part": {
        currentSection = stripMd(b.title);
        onOpenerPage = true;
        drawSectionOpener(doc, b.numberLabel, b.title);
        pageNum += 1; // opener still counts in pagination
        // Following block will trigger newContentPage on first write via ensureSpace? No — we need an explicit fresh page.
        newContentPage();
        break;
      }
      case "h2": {
        currentSection = stripMd(b.text);
        // Page-break if less than 80pt remains
        if (PAGE_H - M_BOTTOM - y < 80) newContentPage();
        else {
          // Refresh header to show new section name on current page
          doc.setFillColor(C_PAGE);
          doc.rect(0, 0, PAGE_W, M_TOP - 8, "F");
          drawChrome();
        }
        const size = 20;
        const lh = size * 1.25;
        ensureSpace(lh + 24);
        y += 12; // top margin
        // Left amber rule
        doc.setFillColor(C_ACCENT);
        doc.rect(M_SIDE, y + 2, 3, size + 4, "F");
        doc.setTextColor(C_TEXT);
        setFont(doc, "bold");
        doc.setFontSize(size);
        const titleLines = doc.splitTextToSize(
          stripMd(b.text),
          COL_CONTENT_W - 14,
        ) as string[];
        for (const ln of titleLines) {
          ensureSpace(lh);
          doc.text(ln, M_SIDE + 12, y + size);
          y += lh;
        }
        y += 12;
        break;
      }
      case "h3": {
        y += 16;
        writeWrapped(b.text, 14, C_TEXT, "bold", 1.3);
        y += 4;
        break;
      }
      case "label": {
        y += 8;
        doc.setTextColor(C_ACCENT);
        setFont(doc, "bold");
        doc.setFontSize(9);
        ensureSpace(14);
        doc.text(tracked(stripMd(b.text).toUpperCase()), M_SIDE, y + 9);
        y += 16;
        break;
      }
      case "callout": {
        y += 12;
        const text = stripMd(b.text);
        // Spans into right margin column — wider than content column.
        const calloutMaxW = CONTENT_W * 0.85 - 28;
        setFont(doc, "italic");
        doc.setFontSize(15);
        const lines = doc.splitTextToSize(text, calloutMaxW) as string[];
        const lh = 15 * 1.65;
        const blockH = lines.length * lh + 24;
        ensureSpace(blockH);
        // Background
        doc.setFillColor(C_SURFACE_2);
        doc.rect(M_SIDE, y, CONTENT_W * 0.85, blockH, "F");
        // Left amber rule
        doc.setFillColor(C_ACCENT);
        doc.rect(M_SIDE, y, 3, blockH, "F");
        doc.setTextColor(C_TEXT);
        let cy = y + 12;
        for (const ln of lines) {
          doc.text(ln, M_SIDE + 16, cy + 15);
          cy += lh;
        }
        y += blockH + 12;
        break;
      }
      case "li": {
        const text = stripMd(b.text);
        // Bullet dot
        ensureSpace(16);
        doc.setFillColor(C_ACCENT);
        doc.circle(M_SIDE + 6, y + 7, 2, "F");
        writeWrapped(text, 11.5, C_TEXT, "normal", 1.6, 20);
        y += 2;
        break;
      }
      case "hr": {
        y += 12;
        ensureSpace(6);
        doc.setDrawColor(C_RULE);
        doc.setLineWidth(0.5);
        doc.line(M_SIDE, y, M_SIDE + COL_CONTENT_W, y);
        y += 16;
        break;
      }
      case "p": {
        const text = stripMd(b.text);

        // Proposition reveal detection
        if (
          !propositionRendered &&
          smpNorm.length > 0 &&
          normaliseForMatch(text) === smpNorm
        ) {
          onOpenerPage = true;
          drawPropositionReveal(doc, input.smp);
          pageNum += 1;
          propositionRendered = true;
          newContentPage();
          break;
        }

        writeWrapped(text, 11.5, C_TEXT, "normal", 1.85);
        y += 6;
        break;
      }
    }
  }
  // Suppress unused symbol lint
  void COL_MARGIN_X;
}

// ─── Public entry ───────────────────────────────────────────────────────
export async function generateStrategicPlatformPdf(input: PdfInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });

  drawCover(doc, input);
  drawContent(doc, input);

  const date = new Date().toISOString().slice(0, 10);
  const safe = (input.brandName || "Brand").replace(/[^a-zA-Z0-9]+/g, "");
  const filename = `BrandGrenade_${safe}_${FORMAT_FILE[input.format]}_${date}.pdf`;
  doc.save(filename);
}
