// Brand Grenade — Strategic Platform Document PDF generator (V2).
// Senior-partner formatting: dedicated cover, dedicated proposition reveal
// page (white text on #0A0A0A), new section starts on a new page, header
// tracks the current section, footer shows page number + document type.
// Uses jsPDF with Helvetica / Courier as Inter / JetBrains Mono stand-ins.

import { jsPDF } from "jspdf";
import type { Stage16Format } from "./stage16-prompt";

export type PdfFormat = Stage16Format;

export interface PdfInput {
  brandName: string;
  category: string;
  /** The selected proposition line, used to detect the reveal page. */
  smp: string;
  format: PdfFormat;
  /** Raw Stage 16 markdown for the selected format. */
  stage16Output: string;
}

// ─── Palette ────────────────────────────────────────────────────────────
const COL_BG_DARK = "#0A0A0A";
const COL_TEXT = "#1A1A1A";
const COL_TEXT_2 = "#6A6A6A";
const COL_TEXT_3 = "#2A2A2A";
const COL_ACCENT = "#C8873A";
const COL_RULE = "#E0E0E0";
const COL_DARK_LABEL = "#8A8680";
const COL_DARK_FOOT = "#5A5652";
const COL_WHITE = "#FFFFFF";

// A4 in points: 595.28 x 841.89
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 70.87; // 25mm
const CONTENT_W = PAGE_W - MARGIN * 2;

const DOCUMENT_TYPE_LABEL: Record<PdfFormat, string> = {
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
function setFont(doc: jsPDF, weight: "normal" | "bold" = "normal") {
  doc.setFont("helvetica", weight);
}

function tracked(text: string): string {
  // Hair-space inter-letter tracking for label/uppercase strings.
  return text.split("").join("\u200A");
}

function monthYear(d = new Date()): string {
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

// ─── Cover ──────────────────────────────────────────────────────────────
function drawCover(doc: jsPDF, input: PdfInput) {
  doc.setFillColor(COL_BG_DARK);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // Top-left: BRAND GRENADE (no client brand name on cover)
  doc.setTextColor(COL_WHITE);
  setFont(doc, "bold");
  doc.setFontSize(11);
  doc.text(tracked("BRAND GRENADE"), MARGIN, MARGIN);

  // Centre block
  const cy = PAGE_H / 2;

  doc.setTextColor(COL_ACCENT);
  setFont(doc, "bold");
  doc.setFontSize(11);
  doc.text(tracked(DOCUMENT_TYPE_LABEL[input.format]), PAGE_W / 2, cy - 40, {
    align: "center",
  });

  doc.setTextColor(COL_DARK_LABEL);
  setFont(doc, "normal");
  doc.setFontSize(14);
  doc.text(input.category, PAGE_W / 2, cy - 8, { align: "center" });

  // Accent rule
  doc.setDrawColor(COL_ACCENT);
  doc.setLineWidth(1);
  doc.line(PAGE_W / 2 - 30, cy + 20, PAGE_W / 2 + 30, cy + 20);

  doc.setTextColor(COL_DARK_FOOT);
  setFont(doc, "normal");
  doc.setFontSize(10);
  doc.text(monthYear(), PAGE_W / 2, cy + 44, { align: "center" });

  // Bottom row
  doc.setTextColor(COL_DARK_FOOT);
  setFont(doc, "normal");
  doc.setFontSize(9);
  doc.text(tracked("CONFIDENTIAL"), MARGIN, PAGE_H - MARGIN);
  doc.text(
    "Brand Grenade Strategy Intelligence System",
    PAGE_W - MARGIN,
    PAGE_H - MARGIN,
    { align: "right" },
  );
}

// ─── Proposition reveal page ────────────────────────────────────────────
function drawPropositionReveal(doc: jsPDF, smp: string, sectionLabel: string) {
  doc.addPage();
  doc.setFillColor(COL_BG_DARK);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // Section label top
  doc.setTextColor(COL_ACCENT);
  setFont(doc, "bold");
  doc.setFontSize(11);
  doc.text(tracked(sectionLabel.toUpperCase()), PAGE_W / 2, MARGIN + 24, {
    align: "center",
  });

  // Proposition line
  doc.setTextColor(COL_WHITE);
  setFont(doc, "bold");
  doc.setFontSize(28); // ~36px screen → 28pt print
  const wrap = doc.splitTextToSize(smp, 460) as string[];
  const lineH = 28 * 1.3;
  const totalH = wrap.length * lineH;
  const startY = (PAGE_H - totalH) / 2;
  wrap.forEach((line, i) => {
    doc.text(line, PAGE_W / 2, startY + i * lineH, { align: "center" });
  });

  // Amber rule beneath
  const ruleY = startY + totalH + 28;
  doc.setDrawColor(COL_ACCENT);
  doc.setLineWidth(0.75);
  doc.line(PAGE_W / 2 - 30, ruleY, PAGE_W / 2 + 30, ruleY);
}

// ─── Content parsing ────────────────────────────────────────────────────
type Block =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "callout"; text: string }
  | { kind: "li"; text: string }
  | { kind: "p"; text: string };

function parseContent(raw: string): Block[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let buf: string[] = [];
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
    if (t.startsWith("## ")) {
      flush();
      blocks.push({ kind: "h2", text: t.slice(3).trim() });
    } else if (t.startsWith("### ")) {
      flush();
      blocks.push({ kind: "h3", text: t.slice(4).trim() });
    } else if (t.startsWith("# ")) {
      // Treat top-level h1 like a section heading too
      flush();
      blocks.push({ kind: "h2", text: t.slice(2).trim() });
    } else if (t.startsWith("> ")) {
      flush();
      blocks.push({ kind: "callout", text: t.slice(2).trim() });
    } else if (/^[-*]\s+/.test(t)) {
      flush();
      blocks.push({ kind: "li", text: t.replace(/^[-*]\s+/, "").trim() });
    } else {
      buf.push(t);
    }
  }
  flush();
  return blocks;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^["“”']+|["“”']+$/g, "")
    .trim();
}

function normaliseForMatch(s: string): string {
  return stripMarkdown(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ─── Content pages ──────────────────────────────────────────────────────
function drawContentPages(doc: jsPDF, input: PdfInput) {
  const blocks = parseContent(input.stage16Output);
  const smpNorm = normaliseForMatch(input.smp);

  // Page state
  let y = MARGIN;
  let pageNum = 0;
  let currentSection = "";
  let propositionRendered = false;

  const drawHeader = () => {
    doc.setTextColor(COL_TEXT_2);
    setFont(doc, "normal");
    doc.setFontSize(9);
    doc.text(currentSection || input.brandName, MARGIN, MARGIN - 24);
    doc.text(
      "Brand Grenade Confidential",
      PAGE_W - MARGIN,
      MARGIN - 24,
      { align: "right" },
    );
    doc.setDrawColor(COL_RULE);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, MARGIN - 16, PAGE_W - MARGIN, MARGIN - 16);
  };

  const drawFooter = () => {
    doc.setDrawColor(COL_RULE);
    doc.setLineWidth(0.5);
    doc.line(
      MARGIN,
      PAGE_H - MARGIN + 16,
      PAGE_W - MARGIN,
      PAGE_H - MARGIN + 16,
    );
    doc.setTextColor(COL_TEXT_2);
    setFont(doc, "normal");
    doc.setFontSize(9);
    doc.text(String(pageNum), PAGE_W / 2, PAGE_H - MARGIN + 32, {
      align: "center",
    });
    doc.text(
      DOCUMENT_TYPE_LABEL[input.format],
      PAGE_W - MARGIN,
      PAGE_H - MARGIN + 32,
      { align: "right" },
    );
  };

  const newPage = () => {
    doc.addPage();
    pageNum += 1;
    y = MARGIN;
    drawHeader();
    drawFooter();
  };

  const ensureSpace = (need: number) => {
    if (y + need > PAGE_H - MARGIN) newPage();
  };

  const writeWrapped = (
    text: string,
    sizePt: number,
    lineFactor = 1.55,
    leftPad = 0,
  ) => {
    const w = CONTENT_W - leftPad;
    const lines = doc.splitTextToSize(stripMarkdown(text), w) as string[];
    const lh = sizePt * lineFactor;
    for (const ln of lines) {
      ensureSpace(lh);
      doc.text(ln, MARGIN + leftPad, y + sizePt);
      y += lh;
    }
  };

  // Start first content page
  newPage();

  for (const b of blocks) {
    switch (b.kind) {
      case "h2": {
        currentSection = stripMarkdown(b.text);
        // New section always starts on a new page (per spec)
        if (y > MARGIN + 1) newPage();
        else {
          // Refresh header on the just-created page with new section label
          // (header was drawn before currentSection was set on the first page)
          // Redraw header band area silently — overwrite with white then
          // re-render to reflect the new section name.
          doc.setFillColor(COL_WHITE);
          doc.rect(0, 0, PAGE_W, MARGIN - 8, "F");
          drawHeader();
        }
        // Section heading: 20pt, with 3pt amber left border
        const headingSize = 18;
        const headingH = headingSize * 1.2;
        ensureSpace(headingH + 8);
        doc.setDrawColor(COL_ACCENT);
        doc.setLineWidth(3);
        doc.line(MARGIN, y + 2, MARGIN, y + headingH + 4);
        doc.setTextColor(COL_TEXT);
        setFont(doc, "bold");
        doc.setFontSize(headingSize);
        const lines = doc.splitTextToSize(
          stripMarkdown(b.text),
          CONTENT_W - 14,
        ) as string[];
        for (const ln of lines) {
          ensureSpace(headingSize * 1.2);
          doc.text(ln, MARGIN + 12, y + headingSize);
          y += headingSize * 1.2;
        }
        y += 14;
        break;
      }
      case "h3": {
        y += 10;
        ensureSpace(20);
        doc.setTextColor(COL_TEXT);
        setFont(doc, "bold");
        doc.setFontSize(13);
        writeWrapped(b.text, 13, 1.25);
        y += 6;
        break;
      }
      case "callout": {
        y += 6;
        const text = stripMarkdown(b.text);
        doc.setTextColor(COL_TEXT_3);
        setFont(doc, "normal");
        doc.setFontSize(12);
        const lines = doc.splitTextToSize(text, CONTENT_W - 18) as string[];
        const blockH = lines.length * 12 * 1.6;
        ensureSpace(blockH);
        doc.setDrawColor(COL_ACCENT);
        doc.setLineWidth(2.5);
        doc.line(MARGIN, y + 2, MARGIN, y + blockH);
        for (const ln of lines) {
          doc.text(ln, MARGIN + 14, y + 12);
          y += 12 * 1.6;
        }
        y += 8;
        break;
      }
      case "li": {
        const text = stripMarkdown(b.text);
        doc.setTextColor(COL_TEXT);
        setFont(doc, "normal");
        doc.setFontSize(11);
        ensureSpace(16);
        doc.text("•", MARGIN, y + 11);
        writeWrapped(text, 11, 1.55, 14);
        break;
      }
      case "p": {
        const text = stripMarkdown(b.text);

        // Proposition reveal detection: if this paragraph IS the SMP line,
        // render it on its own full-page reveal instead of as body text.
        if (
          !propositionRendered &&
          smpNorm.length > 0 &&
          normaliseForMatch(text) === smpNorm
        ) {
          drawPropositionReveal(doc, input.smp, currentSection || "Strategic Proposition");
          propositionRendered = true;
          // The reveal page does not get header/footer; next content starts
          // on a fresh page.
          newPage();
          break;
        }

        doc.setTextColor(COL_TEXT);
        setFont(doc, "normal");
        doc.setFontSize(11);
        writeWrapped(text, 11, 1.75);
        y += 6;
        break;
      }
    }
  }
}

// ─── Public entry ───────────────────────────────────────────────────────
export async function generateStrategicPlatformPdf(input: PdfInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });

  drawCover(doc, input);
  drawContentPages(doc, input);

  const date = new Date().toISOString().slice(0, 10);
  const safe = (input.brandName || "Brand").replace(/[^a-zA-Z0-9]+/g, "");
  const filename = `BrandGrenade_${safe}_${FORMAT_FILE[input.format]}_${date}.pdf`;
  doc.save(filename);
}
