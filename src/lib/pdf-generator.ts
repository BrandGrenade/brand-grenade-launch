// Brand Grenade — Strategic Platform Document PDF generator.
// Client-side. Uses jsPDF (Helvetica/Courier as Inter / JetBrains Mono
// stand-ins — embedding TTF VFS fonts would balloon bundle size; the
// visual hierarchy, spacing, and palette match the spec).

import { jsPDF } from "jspdf";

export type PdfFormat = "pitch" | "consulting" | "workshop";

export interface PdfInput {
  brandName: string;
  category: string;
  smp: string;
  format: PdfFormat;
  /** Raw Stage 16 output for the selected format. Parsed for headings. */
  stage16Output: string;
}

// ─── Palette ────────────────────────────────────────────────────────────
const COL_BG_DARK = "#0A0A0A";
const COL_TEXT = "#1A1A1A";
const COL_TEXT_2 = "#6A6A6A";
const COL_TEXT_3 = "#4A4A4A";
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

const FORMAT_LABEL: Record<PdfFormat, string> = {
  pitch: "AGENCY PITCH",
  consulting: "CONSULTING DELIVERY",
  workshop: "BRAND WORKSHOP",
};

const FORMAT_FILE: Record<PdfFormat, string> = {
  pitch: "AgencyPitch",
  consulting: "ConsultingDelivery",
  workshop: "BrandWorkshop",
};

// ─── Helpers ────────────────────────────────────────────────────────────
function setFont(
  doc: jsPDF,
  weight: "normal" | "bold" = "normal",
  family: "sans" | "mono" = "sans",
) {
  doc.setFont(family === "mono" ? "courier" : "helvetica", weight);
}

function spaceLetters(text: string, em: number, sizePt: number): string {
  // jsPDF has no letter-spacing API for setFontSize. Approximate by
  // injecting thin spaces between characters for label text only.
  if (em <= 0) return text;
  const gap = " ".repeat(Math.max(1, Math.round(em * sizePt * 0.5)));
  // Use a hair space (\u200A) for tighter tracking visually.
  void gap;
  return text.split("").join("\u200A");
}

function drawHeader(doc: jsPDF, brand: string) {
  doc.setTextColor(COL_TEXT_2);
  setFont(doc, "normal");
  doc.setFontSize(9);
  doc.text(brand, MARGIN, MARGIN - 24);
  doc.text(
    "Brand Grenade Strategic Platform",
    PAGE_W - MARGIN,
    MARGIN - 24,
    { align: "right" },
  );
  doc.setDrawColor(COL_RULE);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, MARGIN - 16, PAGE_W - MARGIN, MARGIN - 16);
}

function drawFooter(doc: jsPDF, pageNum: number) {
  doc.setDrawColor(COL_RULE);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, PAGE_H - MARGIN + 16, PAGE_W - MARGIN, PAGE_H - MARGIN + 16);
  doc.setTextColor(COL_TEXT_2);
  setFont(doc, "normal");
  doc.setFontSize(9);
  doc.text(String(pageNum), PAGE_W / 2, PAGE_H - MARGIN + 32, {
    align: "center",
  });
  doc.text(
    spaceLetters("CONFIDENTIAL", 0.1, 9),
    PAGE_W - MARGIN,
    PAGE_H - MARGIN + 32,
    { align: "right" },
  );
}

// ─── Cover ──────────────────────────────────────────────────────────────
function drawCover(doc: jsPDF, input: PdfInput) {
  doc.setFillColor(COL_BG_DARK);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // Top-left: BRAND GRENADE
  doc.setTextColor(COL_WHITE);
  setFont(doc, "bold");
  doc.setFontSize(11);
  doc.text(spaceLetters("BRAND GRENADE", 0.12, 11), MARGIN, MARGIN);

  // Centre block
  const cy = PAGE_H / 2;

  doc.setTextColor(COL_ACCENT);
  setFont(doc, "bold");
  doc.setFontSize(11);
  doc.text(
    spaceLetters("STRATEGIC PLATFORM DOCUMENT", 0.1, 11),
    PAGE_W / 2,
    cy - 80,
    { align: "center" },
  );

  doc.setTextColor(COL_WHITE);
  setFont(doc, "bold");
  doc.setFontSize(42);
  doc.text(input.brandName, PAGE_W / 2, cy - 40, { align: "center" });

  doc.setTextColor(COL_DARK_LABEL);
  setFont(doc, "normal");
  doc.setFontSize(18);
  doc.text(input.category, PAGE_W / 2, cy - 12, { align: "center" });

  // Accent rule
  doc.setDrawColor(COL_ACCENT);
  doc.setLineWidth(1);
  doc.line(PAGE_W / 2 - 40, cy + 16, PAGE_W / 2 + 40, cy + 16);

  doc.setTextColor(COL_DARK_LABEL);
  setFont(doc, "bold");
  doc.setFontSize(11);
  doc.text(
    spaceLetters(FORMAT_LABEL[input.format], 0.1, 11),
    PAGE_W / 2,
    cy + 44,
    { align: "center" },
  );

  // Bottom
  doc.setTextColor(COL_DARK_FOOT);
  setFont(doc, "normal");
  doc.setFontSize(10);
  doc.text(
    spaceLetters("CONFIDENTIAL", 0.1, 10),
    MARGIN,
    PAGE_H - MARGIN,
  );
  const date = new Date().toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.text(date, PAGE_W - MARGIN, PAGE_H - MARGIN, { align: "right" });
}

// ─── Proposition page ───────────────────────────────────────────────────
function drawPropositionPage(doc: jsPDF, input: PdfInput) {
  doc.addPage();
  doc.setFillColor(COL_BG_DARK);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  const cy = PAGE_H / 2;
  doc.setTextColor(COL_ACCENT);
  setFont(doc, "bold");
  doc.setFontSize(11);
  doc.text(
    spaceLetters("STRATEGIC PROPOSITION", 0.1, 11),
    PAGE_W / 2,
    cy - 80,
    { align: "center" },
  );

  // SMP — 32px, wrap to 500pt
  doc.setTextColor(COL_WHITE);
  setFont(doc, "bold");
  doc.setFontSize(28); // 32px → trim slightly to fit print scale
  const wrap = doc.splitTextToSize(input.smp, 460) as string[];
  const lineH = 28 * 1.3 * 0.75; // approx pt line height
  const startY = cy - (wrap.length * lineH) / 2 + 6;
  wrap.forEach((line, i) => {
    doc.text(line, PAGE_W / 2, startY + i * lineH, { align: "center" });
  });

  const ruleY = startY + wrap.length * lineH + 24;
  doc.setDrawColor(COL_ACCENT);
  doc.setLineWidth(0.75);
  doc.line(PAGE_W / 2 - 30, ruleY, PAGE_W / 2 + 30, ruleY);

  doc.setTextColor(COL_DARK_LABEL);
  setFont(doc, "normal");
  doc.setFontSize(13);
  doc.text(input.brandName, PAGE_W / 2, ruleY + 24, { align: "center" });
}

// ─── Content parsing ────────────────────────────────────────────────────
type Block =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "label"; text: string }
  | { kind: "callout"; text: string }
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
    if (t.startsWith("# ")) {
      flush();
      blocks.push({ kind: "h1", text: t.slice(2).trim() });
    } else if (t.startsWith("## ")) {
      flush();
      blocks.push({ kind: "h2", text: t.slice(3).trim() });
    } else if (t.startsWith("### ")) {
      flush();
      blocks.push({ kind: "h3", text: t.slice(4).trim() });
    } else if (/^[A-Z0-9 \-—()/]+:$/.test(t) && t.length < 60) {
      flush();
      blocks.push({ kind: "label", text: t.replace(/:$/, "") });
    } else if (t.startsWith("> ")) {
      flush();
      blocks.push({ kind: "callout", text: t.slice(2).trim() });
    } else {
      buf.push(t);
    }
  }
  flush();
  return blocks;
}

// ─── Content pages ──────────────────────────────────────────────────────
function drawContentPages(doc: jsPDF, input: PdfInput) {
  const blocks = parseContent(input.stage16Output);
  doc.addPage();
  let y = MARGIN;
  let pageNum = 1;
  drawHeader(doc, input.brandName);
  drawFooter(doc, pageNum);

  const ensureSpace = (need: number) => {
    if (y + need > PAGE_H - MARGIN) {
      doc.addPage();
      pageNum += 1;
      y = MARGIN;
      drawHeader(doc, input.brandName);
      drawFooter(doc, pageNum);
    }
  };

  const writeWrapped = (text: string, sizePt: number, lineFactor = 1.5) => {
    const lines = doc.splitTextToSize(text, CONTENT_W) as string[];
    const lh = sizePt * lineFactor;
    for (const ln of lines) {
      ensureSpace(lh);
      doc.text(ln, MARGIN, y + sizePt);
      y += lh;
    }
  };

  for (const b of blocks) {
    switch (b.kind) {
      case "h1": {
        ensureSpace(40);
        y += 4;
        doc.setTextColor(COL_TEXT);
        setFont(doc, "bold");
        doc.setFontSize(24);
        writeWrapped(b.text, 24, 1.2);
        y += 6;
        break;
      }
      case "h2": {
        y += 18;
        ensureSpace(28);
        doc.setTextColor(COL_TEXT);
        setFont(doc, "bold");
        doc.setFontSize(16);
        writeWrapped(b.text, 16, 1.2);
        y += 6;
        break;
      }
      case "h3": {
        y += 10;
        ensureSpace(22);
        doc.setTextColor(COL_TEXT);
        setFont(doc, "bold");
        doc.setFontSize(13);
        writeWrapped(b.text, 13, 1.2);
        y += 4;
        break;
      }
      case "label": {
        y += 8;
        ensureSpace(16);
        doc.setTextColor(COL_ACCENT);
        setFont(doc, "bold");
        doc.setFontSize(9);
        doc.text(spaceLetters(b.text.toUpperCase(), 0.1, 9), MARGIN, y + 9);
        y += 16;
        break;
      }
      case "callout": {
        y += 6;
        doc.setTextColor(COL_TEXT_3);
        setFont(doc, "normal");
        doc.setFontSize(11);
        const lines = doc.splitTextToSize(b.text, CONTENT_W - 18) as string[];
        const blockH = lines.length * 11 * 1.55;
        ensureSpace(blockH);
        doc.setDrawColor(COL_ACCENT);
        doc.setLineWidth(2.5);
        doc.line(MARGIN, y + 2, MARGIN, y + blockH);
        for (const ln of lines) {
          doc.text(ln, MARGIN + 12, y + 11);
          y += 11 * 1.55;
        }
        y += 6;
        break;
      }
      case "p": {
        doc.setTextColor(COL_TEXT);
        setFont(doc, "normal");
        doc.setFontSize(11);
        writeWrapped(b.text, 11, 1.55);
        y += 4;
        break;
      }
    }
  }
}

// ─── Public entry ───────────────────────────────────────────────────────
export async function generateStrategicPlatformPdf(input: PdfInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });

  drawCover(doc, input);
  drawPropositionPage(doc, input);
  drawContentPages(doc, input);

  const date = new Date().toISOString().slice(0, 10);
  const safe = input.brandName.replace(/[^a-zA-Z0-9]+/g, "");
  const filename = `BrandGrenade_${safe}_${FORMAT_FILE[input.format]}_${date}.pdf`;
  doc.save(filename);
}
