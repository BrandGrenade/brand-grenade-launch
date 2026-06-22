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
import { stripDocumentMetadata } from "./strip-document-metadata";

export type PdfFormat = Stage16Format;

export interface AppendixData {
  stage1Output?: string | null;
  stage8Output?: string | null;
  stage10Output?: string | null;
  stage11Output?: string | null;
  stage12Output?: string | null;
  stage13Output?: string | null;
}

export interface PdfInput {
  brandName: string;
  category: string;
  smp: string;
  format: PdfFormat;
  /** Raw Stage 16 markdown for the selected format. */
  stage16Output: string;
  /** Optional pipeline outputs used to render the appendix (consulting/workshop only). */
  appendix?: AppendixData;
  /** Optional progress callback fired during the main render loop. */
  onProgress?: (current: number, total: number) => void;
}

// ─── splitTextToSize cache ──────────────────────────────────────────────
// jsPDF's splitTextToSize is pure-JS text shaping and is the dominant cost
// of PDF generation. Many blocks repeat identical text at the same width
// and font (labels, list bullets, recurring headings), so caching results
// avoids re-shaping the same string. The cache is cleared at the start of
// each generateStrategicPlatformPdf() call.
const splitCache = new Map<string, string[]>();
function cachedSplitText(doc: jsPDF, text: string, maxWidth: number): string[] {
  const size = doc.getFontSize();
  const f = doc.getFont() as { fontName?: string; fontStyle?: string };
  const key = `${f.fontName ?? ""}|${f.fontStyle ?? ""}|${size}|${maxWidth}|${text}`;
  const hit = splitCache.get(key);
  if (hit) return hit;
  const result = doc.splitTextToSize(text, maxWidth) as string[];
  splitCache.set(key, result);
  return result;
}


// ─── Palette ────────────────────────────────────────────────────────────
const C_PAGE = "#FAFAF8";
const C_SURFACE_2 = "#F2F0EB";
const C_DARK = "#1A1A18";
const C_TEXT = "#1A1A18";
const C_TEXT_2 = "#6A6560";
const C_TEXT_3 = "#9A9590";
const C_ACCENT = "#D4924A";
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
  vision: "STRATEGY AND CREATIVE VISION",
};

const FORMAT_FILE: Record<PdfFormat, string> = {
  agency: "AgencyStrategyPlatform",
  consulting: "BoardStrategyRecommendation",
  workshop: "BrandStrategyWorkshopGuide",
  vision: "StrategyAndCreativeVision",
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

// ─── PDF-safe sanitiser ─────────────────────────────────────────────────
// Strips characters and patterns that the built-in jsPDF fonts (Helvetica /
// Courier) cannot render correctly — box-drawing chars, %P encoded
// separators, spaced-out heading treatments, raw === / ═══ dividers, etc.
export function sanitiseForPdf(text: string): string {
  if (!text) return text;
  let t = stripDocumentMetadata(text, "pdf").replace(/\r\n/g, "\n");

  // Strip box-drawing characters (Unicode 2500–257F) up front so divider
  // lines collapse to whitespace and the separator rule catches them.
  t = t.replace(/[\u2500-\u257F]/g, "");

  // STEP 1 — Remove separator-only lines
  t = t.replace(/^[=%P\-_*~#\s]{3,}$/gm, "");

  // STEP 2 — Remove encoded separators
  t = t.replace(/(%P){3,}/g, "");
  t = t.replace(/%{3,}/g, "");

  // STEP 3 — De-space heading lines like "W H A T  T H I S" → "WHAT THIS"
  t = t.replace(/^(?:[A-Z]\s){4,}[A-Z]$/gm, (m) => m.replace(/\s+/g, ""));
  t = t.replace(
    /^(?:[A-Z](?:\s[A-Z])+)(?:\s{2,}[A-Z](?:\s[A-Z])+)+$/gm,
    (m) =>
      m
        .split(/\s{2,}/)
        .map((w) => w.replace(/\s+/g, ""))
        .join(" "),
  );

  // STEP 4 — Proposition divider lines → blank separator
  t = t.replace(/^={3,}$/gm, "");

  // STEP 5 — Remove "PROPOSITION N" label lines
  t = t.replace(/^\*{0,2}PROPOSITION\s+\d+\*{0,2}$/gim, "");

  // STEP 6 — Collapse blank lines
  t = t.replace(/\n{3,}/g, "\n\n");

  return t.trim();
}

// ─── Lightweight proposition extractor for Appendix C ───────────────────
interface ParsedProposition {
  line: string;
  owns: string;
  composite?: number;
}

function extractCompositeScore(block: string): number | undefined {
  const m = block.match(/Composite[:\s]+(\d+(?:\.\d+)?)\s*\/\s*60/i);
  return m ? parseFloat(m[1]) : undefined;
}

function extractPropositions(rawOutput: string): ParsedProposition[] {
  if (!rawOutput) return [];

  const dividerPattern = /[═=]{3,}/g;
  const blocksA = rawOutput.split(dividerPattern).filter((b) => b.trim().length > 50);
  const propPattern = /\*{0,2}PROPOSITION\s+\d+\*{0,2}/gi;
  const blocksB = rawOutput.split(propPattern).filter((b) => b.trim().length > 50);
  const contentBlocks = blocksB.length > blocksA.length ? blocksB : blocksA;

  const out: ParsedProposition[] = [];
  for (const block of contentBlocks) {
    if (
      !block.includes("**") &&
      !block.includes("Composite") &&
      !block.includes("Differentiation")
    ) {
      continue;
    }
    if (
      block.includes("[METADATA]") ||
      block.includes("SELF-AUDIT") ||
      block.includes("PRESENTATION ORDER") ||
      block.includes("SELECTION FRAMEWORK") ||
      block.includes("DELIVERABLE 2") ||
      block.includes("DELIVERABLE 3")
    ) {
      continue;
    }

    let line = "";
    const blockquoteBold = block.match(/>\s*\*\*([^*\n]+)\*\*/);
    if (blockquoteBold) line = blockquoteBold[1].trim();
    if (!line) {
      const boldMatches = block.match(/\*\*([^*\n]{10,80})\*\*/g);
      if (boldMatches && boldMatches.length > 0) {
        line = boldMatches[0].replace(/\*\*/g, "").trim();
      }
    }
    if (!line) continue;
    if (
      line.includes("PROPOSITION") ||
      line.includes("WHAT THIS") ||
      line.includes("THE TRUTH") ||
      line.length > 100
    ) {
      continue;
    }

    const ownsMatch = block.match(
      /WHAT THIS PROPOSITION OWNS[\s\S]*?\n\n([\s\S]*?)(?:\n---|\n═|\n===|$)/i,
    );
    const owns = ownsMatch ? stripMd(ownsMatch[1].trim()) : "";

    out.push({
      line: stripMd(line),
      owns,
      composite: extractCompositeScore(block),
    });
  }
  return out;
}

function firstSentence(text: string, maxWords = 50): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  const sentenceMatch = clean.match(/^[^.!?]*[.!?]/);
  const sentence = (sentenceMatch ? sentenceMatch[0] : clean).trim();
  const words = sentence.split(/\s+/);
  if (words.length <= maxWords) return sentence;
  return words.slice(0, maxWords).join(" ") + "…";
}

// ─── Cover ──────────────────────────────────────────────────────────────
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

function drawCover(doc: jsPDF, input: PdfInput, iconDataUrl: string | null) {
  doc.setFillColor(C_DARK);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // Top-left lockup: [icon 28pt] [BRAND GRENADE]
  const iconSize = 28;
  const wordmarkBaseline = M_TOP;
  if (iconDataUrl) {
    try {
      doc.addImage(
        iconDataUrl,
        "PNG",
        M_SIDE,
        wordmarkBaseline - iconSize + 3,
        iconSize,
        iconSize,
      );
    } catch {
      /* ignore */
    }
  }
  doc.setTextColor(C_WHITE);
  setFont(doc, "bold");
  doc.setFontSize(11);
  setTracking(doc, 0.06);
  const wordmarkX = M_SIDE + (iconDataUrl ? iconSize + 10 : 0);
  doc.text("BRAND GRENADE", wordmarkX, wordmarkBaseline - 8);
  clearTracking(doc);

  // Centre stack
  const cy = PAGE_H / 2;

  doc.setTextColor(C_ACCENT);
  setFont(doc, "bold");
  doc.setFontSize(11);
  setTracking(doc, 0.08);
  doc.text(DOC_LABEL[input.format], PAGE_W / 2, cy - 36, { align: "center" });
  clearTracking(doc);

  doc.setTextColor(C_TEXT_3);
  setFont(doc, "normal");
  doc.setFontSize(13);
  doc.text(input.category || "Strategic Platform", PAGE_W / 2, cy - 4, {
    align: "center",
  });

  // amber rule 48x2 centred
  doc.setFillColor(C_ACCENT);
  doc.rect(PAGE_W / 2 - 24, cy + 28, 48, 2, "F");

  // month/year
  doc.setTextColor(C_DARK_FOOT);
  setFont(doc, "normal");
  doc.setFontSize(10);
  doc.text(monthYear(), PAGE_W / 2, cy + 86, { align: "center" });

  // Bottom row
  doc.setTextColor(C_DARK_FOOT);
  setFont(doc, "normal");
  doc.setFontSize(9);
  setTracking(doc, 0.08);
  doc.text("CONFIDENTIAL", M_SIDE, PAGE_H - M_BOTTOM);
  clearTracking(doc);
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
  const titleLines = cachedSplitText(doc, stripMd(title), titleW);
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
  doc.setFontSize(36); // 48px screen ≈ 36pt
  const maxW = 420; // ~560px screen
  const lines = cachedSplitText(doc, stripMd(smp), maxW);
  const lh = 36 * 1.25;
  const totalH = lines.length * lh;
  const startY = (PAGE_H - totalH) / 2;
  lines.forEach((ln, i) => {
    doc.text(ln, PAGE_W / 2, startY + i * lh, { align: "center" });
  });

  // 40px gap then amber rule 60x2 centred
  doc.setFillColor(C_ACCENT);
  doc.rect(PAGE_W / 2 - 30, startY + totalH + 30, 60, 2, "F");
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
async function drawContent(doc: jsPDF, input: PdfInput) {
  const rawBody =
    input.stage16Output && input.stage16Output.trim().length > 0
      ? input.stage16Output
      : getTemplateContent(input.format);
  const body = sanitiseForPdf(rawBody);
  // Sanitise all appendix stage outputs once, upfront, so every renderer
  // (raw-as-appendix, proposition cards, etc.) sees clean text.
  const appendix: AppendixData | undefined = input.appendix
    ? {
        stage1Output: sanitiseForPdf(input.appendix.stage1Output ?? ""),
        stage8Output: sanitiseForPdf(input.appendix.stage8Output ?? ""),
        stage10Output: sanitiseForPdf(input.appendix.stage10Output ?? ""),
        stage11Output: sanitiseForPdf(input.appendix.stage11Output ?? ""),
        stage12Output: sanitiseForPdf(input.appendix.stage12Output ?? ""),
        stage13Output: sanitiseForPdf(input.appendix.stage13Output ?? ""),
      }
    : undefined;
  input = { ...input, appendix };
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
  /** Reserve `need` pts on the current page (start a new page if it won't fit
   * AND would fit on a fresh page). Call BEFORE drawing decoration so
   * bullets / bars / backgrounds never get orphaned from their text. */
  const keepTogether = (need: number) => {
    const avail = PAGE_H - M_BOTTOM - y;
    const fullPage = PAGE_H - M_TOP - M_BOTTOM;
    if (need > avail && need <= fullPage) newContentPage();
  };

  const wrapLines = (text: string, sizePt: number, weight: "normal" | "bold" | "italic", maxW: number) => {
    setFont(doc, weight);
    doc.setFontSize(sizePt);
    return cachedSplitText(doc, stripMd(text), maxW);
  };

  const writeWrapped = (
    text: string,
    sizePt: number,
    color: string,
    weight: "normal" | "bold" | "italic" = "normal",
    lineFactor = 1.5,
    leftPad = 0,
    maxW = COL_CONTENT_W,
  ) => {
    doc.setTextColor(color);
    setFont(doc, weight);
    doc.setFontSize(sizePt);
    const lines = cachedSplitText(doc, stripMd(text), maxW - leftPad);
    const lh = sizePt * lineFactor;
    for (const ln of lines) {
      ensureSpace(lh);
      doc.text(ln, M_SIDE + leftPad, y + sizePt);
      y += lh;
    }
  };
  /** Same as writeWrapped, but never inserts a page break. Caller must have
   * already reserved enough vertical space via keepTogether(). */
  const writeWrappedNoBreak = (
    text: string,
    sizePt: number,
    color: string,
    weight: "normal" | "bold" | "italic" = "normal",
    lineFactor = 1.5,
    leftPad = 0,
    maxW = COL_CONTENT_W,
  ) => {
    doc.setTextColor(color);
    setFont(doc, weight);
    doc.setFontSize(sizePt);
    const lines = cachedSplitText(doc, stripMd(text), maxW - leftPad);
    const lh = sizePt * lineFactor;
    for (const ln of lines) {
      doc.text(ln, M_SIDE + leftPad, y + sizePt);
      y += lh;
    }
  };

  // Start first content page
  newContentPage();

  const renderBlock = (b: Block, opts: { appendix?: boolean } = {}) => {
    switch (b.kind) {
      case "part": {
        if (opts.appendix) {
          // In appendix mode treat # as a sub-heading rather than a new Part opener.
          renderBlock({ kind: "h3", text: b.title }, opts);
          return;
        }
        currentSection = stripMd(b.title);
        onOpenerPage = true;
        drawSectionOpener(doc, b.numberLabel, b.title);
        pageNum += 1;
        newContentPage();
        break;
      }
      case "h2": {
        if (!opts.appendix) currentSection = stripMd(b.text);
        const size = 18;
        const lh = size * 1.25;
        const titleLines = wrapLines(b.text, size, "bold", COL_CONTENT_W - 14);
        const blockH = 12 + titleLines.length * lh + 12;
        keepTogether(blockH + 24);
        // Repaint header band if we stayed on the same page (clears any prior
        // chrome residue around the new heading).
        doc.setFillColor(C_PAGE);
        doc.rect(0, 0, PAGE_W, M_TOP - 8, "F");
        drawChrome();
        y += 12;
        doc.setFillColor(C_ACCENT);
        doc.rect(M_SIDE, y + 2, 3, titleLines.length * lh + 4, "F");
        doc.setTextColor(C_TEXT);
        setFont(doc, "bold");
        doc.setFontSize(size);
        for (const ln of titleLines) {
          doc.text(ln, M_SIDE + 12, y + size);
          y += lh;
        }
        y += 12;
        break;
      }
      case "h3": {
        const size = 14;
        const lh = size * 1.3;
        const lines = wrapLines(b.text, size, "bold", COL_CONTENT_W);
        // Reserve heading + ~2 lines of following body to prevent widow headings.
        keepTogether(16 + lines.length * lh + 4 + 11.5 * 1.5 * 2);
        y += 16;
        writeWrappedNoBreak(b.text, size, C_TEXT, "bold", 1.3);
        y += 4;
        break;
      }
      case "label": {
        keepTogether(8 + 16 + 11.5 * 1.5);
        y += 8;
        doc.setTextColor(C_ACCENT);
        setFont(doc, "bold");
        doc.setFontSize(9);
        setTracking(doc, 0.12);
        doc.text(stripMd(b.text).toUpperCase(), M_SIDE, y + 9);
        clearTracking(doc);
        y += 16;
        break;
      }
      case "callout": {
        const text = stripMd(b.text);
        const calloutMaxW = CONTENT_W * 0.85 - 28;
        const lines = wrapLines(text, 14, "italic", calloutMaxW);
        const lh = 14 * 1.55;
        const blockH = lines.length * lh + 24;
        const fullPage = PAGE_H - M_TOP - M_BOTTOM;
        y += 12;
        if (blockH > fullPage - 40) {
          // Too tall to box — render as a plain italic pull-quote instead so
          // it can flow across pages without overflowing the page bottom.
          writeWrapped(text, 13, C_TEXT, "italic", 1.55);
          y += 12;
          break;
        }
        keepTogether(blockH + 12);
        doc.setFillColor(C_SURFACE_2);
        doc.rect(M_SIDE, y, CONTENT_W * 0.85, blockH, "F");
        doc.setFillColor(C_ACCENT);
        doc.rect(M_SIDE, y, 3, blockH, "F");
        doc.setTextColor(C_TEXT);
        setFont(doc, "italic");
        doc.setFontSize(14);
        let cy = y + 12;
        for (const ln of lines) {
          doc.text(ln, M_SIDE + 16, cy + 14);
          cy += lh;
        }
        y += blockH + 12;
        break;
      }
      case "li": {
        const text = stripMd(b.text);
        const size = 11.5;
        const lh = size * 1.5;
        const lines = wrapLines(text, size, "normal", COL_CONTENT_W - 20);
        // Reserve bullet + at least the first line on the same page.
        keepTogether(lh);
        doc.setFillColor(C_ACCENT);
        doc.circle(M_SIDE + 6, y + 7, 2, "F");
        writeWrapped(text, size, C_TEXT, "normal", 1.5, 20);
        void lines;
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
        if (
          !opts.appendix &&
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
        writeWrapped(text, 11.5, C_TEXT, "normal", 1.5);
        y += 6;
        break;
      }

    }
  };

  // Main document
  console.log("PDF: blocks loop start", Date.now(), "blocks:", blocks.length);
  for (let i = 0; i < blocks.length; i++) {
    if (i === 0) console.log("PDF: first block processed", Date.now());
    if (i % 100 === 0) console.log("PDF: block", i, "of", blocks.length, Date.now());
    renderBlock(blocks[i]);
    // Yield to the browser every 20 blocks so the progress bar can paint
    // and the main thread does not freeze during text shaping.
    if (i % 20 === 0 && i > 0) {
      input.onProgress?.(i, blocks.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  input.onProgress?.(blocks.length, blocks.length);
  console.log("PDF: blocks loop end", Date.now());

  // ─── Appendix (consulting + workshop) ─────────────────────────────────
  const writeAppendixLabel = (text: string) => {
    y += 18;
    doc.setTextColor(C_ACCENT);
    setFont(doc, "bold");
    doc.setFontSize(10);
    ensureSpace(16);
    setTracking(doc, 0.14);
    doc.text(text.toUpperCase(), M_SIDE, y + 10);
    clearTracking(doc);
    y += 20;
  };

  const writeAppendixHeading = (text: string) => {
    const size = 22;
    const lh = size * 1.2;
    ensureSpace(lh + 18);
    doc.setTextColor(C_TEXT);
    setFont(doc, "bold");
    doc.setFontSize(size);
    const lines = cachedSplitText(doc, text, COL_CONTENT_W);
    for (const ln of lines) {
      ensureSpace(lh);
      doc.text(ln, M_SIDE, y + size);
      y += lh;
    }
    y += 14;
  };

  const writeAppendixIntro = (text: string) => {
    writeWrapped(text, 11.5, C_TEXT_2, "italic", 1.7);
    y += 10;
  };

  const renderRawAsAppendix = (raw: string | null | undefined) => {
    if (!raw || !raw.trim()) {
      writeWrapped(
        "Source data unavailable for this section.",
        11.5,
        C_TEXT_3,
        "italic",
        1.7,
      );
      return;
    }
    const subBlocks = parseContent(raw);
    for (const sb of subBlocks) renderBlock(sb, { appendix: true });
  };

  const startAppendixSection = (label: string, heading: string, intro?: string) => {
    newContentPage();
    currentSection = "Appendix";
    writeAppendixLabel(label);
    writeAppendixHeading(heading);
    if (intro) writeAppendixIntro(intro);
  };

  // ─── Appendix C — proposition cards ─────────────────────────────────
  const renderPropositionCards = (
    rawStage8: string | null | undefined,
    selectedSmp: string,
  ) => {
    const props = extractPropositions(rawStage8 ?? "");
    if (!props.length) {
      writeWrapped(
        "Proposition data unavailable for this section.",
        11.5,
        C_TEXT_3,
        "italic",
        1.7,
      );
      return;
    }
    const selectedNorm = normaliseForMatch(selectedSmp);
    props.forEach((p, idx) => {
      const isSelected =
        selectedNorm.length > 0 && normaliseForMatch(p.line) === selectedNorm;

      // PROPOSITION N label
      y += 14;
      doc.setTextColor(C_ACCENT);
      setFont(doc, "bold");
      doc.setFontSize(9);
      ensureSpace(14);
      setTracking(doc, 0.12);
      doc.text(`PROPOSITION ${idx + 1}`, M_SIDE, y + 9);
      clearTracking(doc);
      y += 16;

      // Proposition line — sub-heading
      writeWrapped(p.line, 14, C_TEXT, "bold", 1.35);
      y += 4;

      // Composite score + status badge row
      ensureSpace(22);
      doc.setTextColor(C_ACCENT);
      setFont(doc, "bold");
      doc.setFontSize(9);
      setTracking(doc, 0.12);
      const scoreLabel =
        p.composite !== undefined
          ? `COMPOSITE ${p.composite}/60`
          : "COMPOSITE —";
      doc.text(scoreLabel, M_SIDE, y + 9);
      const scoreW = doc.getTextWidth(scoreLabel);
      clearTracking(doc);

      // Status badge
      const badgeText = isSelected ? "SELECTED" : "NOT SELECTED";
      setFont(doc, "bold");
      doc.setFontSize(8);
      setTracking(doc, 0.14);
      const padX = 6;
      const badgeTextW = doc.getTextWidth(badgeText);
      const badgeW = badgeTextW + padX * 2;
      const badgeH = 14;
      const badgeX = M_SIDE + scoreW + 18;
      const badgeY = y - 2;
      if (isSelected) {
        // green tint background + border
        doc.setFillColor(234, 240, 233); // #4A7C59 @ ~15%
        doc.rect(badgeX, badgeY, badgeW, badgeH, "F");
        doc.setDrawColor("#4A7C59");
        doc.setLineWidth(0.6);
        doc.rect(badgeX, badgeY, badgeW, badgeH, "S");
        doc.setTextColor("#4A7C59");
      } else {
        doc.setFillColor("#3A3A3A");
        doc.rect(badgeX, badgeY, badgeW, badgeH, "F");
        doc.setTextColor("#FAFAF8");
      }
      doc.text(badgeText, badgeX + padX, badgeY + 10);
      clearTracking(doc);
      y += 18;

      // One-sentence strategic rationale from "what it owns"
      const rationale = firstSentence(p.owns, 50);
      if (rationale) {
        writeWrapped(rationale, 11, C_TEXT_2, "normal", 1.6);
      }

      // Divider rule between propositions (not after last)
      if (idx < props.length - 1) {
        y += 8;
        ensureSpace(20);
        doc.setDrawColor(C_RULE);
        doc.setLineWidth(0.5);
        doc.line(M_SIDE, y, M_SIDE + COL_CONTENT_W, y);
        y += 12;
      }
    });
  };


  if (input.format === "consulting" && input.appendix) {
    onOpenerPage = true;
    drawSectionOpener(doc, "A", "Strategic Process and Evidence Base");
    pageNum += 1;

    startAppendixSection(
      "Appendix A",
      "The Strategic Brief",
      "The following brief was submitted as the foundation for this strategic engagement. Every recommendation in this document is traceable to the commercial context, audience insight, and strategic constraints defined here.",
    );
    renderRawAsAppendix(input.appendix.stage1Output);

    startAppendixSection("Appendix B", "The Strategic Methodology");
    const methodology = [
      "This strategic recommendation was produced using the Brand Grenade Strategy Intelligence System — a 20-stage methodology designed to generate genuinely distinct strategic positions from competitive intelligence, human insight, and brand reality.",
      "The methodology operates across four phases. The first phase builds competitive intelligence — mapping what every competitor in the category owns, what territories are overcrowded, and where genuine strategic whitespace exists.",
      "The second phase generates strategic directions — producing multiple genuinely distinct universes, each built on a different type of truth about the brand and its audience. A minimum of three directions are developed before any evaluation begins.",
      "The third phase validates and selects — scoring each direction across six dimensions, pressure testing the strongest candidates against five integrity tests, and assessing brand fit across five credibility dimensions. The proposition that emerges from this phase has survived rigorous comparison with genuine alternatives.",
      "The fourth phase packages — synthesising the complete strategic intelligence into professional deliverables calibrated for the specific audience receiving them.",
      "The methodology is designed to prevent the most common failure in brand strategy — the gravitational pull toward safe, familiar territories that produces category sameness. Every stage is constructed to enforce divergence, validate distinctiveness, and reject outputs that drift toward what competitors already own.",
    ];
    for (const para of methodology) {
      writeWrapped(para, 11.5, C_TEXT, "normal", 1.85);
      y += 8;
    }

    startAppendixSection(
      "Appendix C",
      "Strategic Propositions Evaluated",
      "The following propositions were developed and evaluated before the recommended position was selected. Each represents a genuinely distinct strategic direction. The recommended proposition survived direct comparison with all alternatives.",
    );
    renderPropositionCards(input.appendix.stage8Output, input.smp);


    startAppendixSection(
      "Appendix D",
      "Brand Fit Assessment",
      "The recommended proposition was assessed across five credibility dimensions to confirm the brand can credibly occupy the recommended territory.",
    );
    renderRawAsAppendix(input.appendix.stage13Output);

    startAppendixSection(
      "Appendix E",
      "Proposition Integrity Testing",
      "The recommended proposition was subjected to five integrity tests before being presented as the strategic recommendation.",
    );
    renderRawAsAppendix(input.appendix.stage11Output);
  } else if (input.format === "workshop" && input.appendix) {
    onOpenerPage = true;
    drawSectionOpener(doc, "A", "Facilitator Reference");
    pageNum += 1;

    startAppendixSection(
      "Facilitator Reference",
      "The Original Brief",
      "This section is for facilitator reference only. It is not distributed to workshop participants. The brief content informs the facilitator's preparation but is revealed to participants only through the structured session content.",
    );
    renderRawAsAppendix(input.appendix.stage1Output);
  }

  // Suppress unused symbol lint
  void COL_MARGIN_X;
}

// ─── Public entry ───────────────────────────────────────────────────────
export async function generateStrategicPlatformPdf(input: PdfInput) {
  console.log("PDF: start", Date.now());
  // Hard cap on stage 16 length to prevent runaway page counts.
  const MAX_CHARS = 32000;
  if (input.stage16Output && input.stage16Output.length > MAX_CHARS) {
    input = { ...input, stage16Output: input.stage16Output.substring(0, MAX_CHARS) };
  }
  // Reset the per-run splitTextToSize cache.
  splitCache.clear();
  // NOTE: compress:false is intentional. jsPDF's `compress: true` runs pako
  // gzip synchronously over every content stream inside doc.save() and was
  // the cause of the multi-second "Finalising PDF…" stall. Uncompressed
  // PDFs are larger on disk but generate in a fraction of the time.
  const tInit = Date.now();
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: false });
  const iconDataUrl = await loadIconDataUrl();
  console.log("PDF: render start", Date.now(), "(init+icon ms:", Date.now() - tInit, ")");

  drawCover(doc, input, iconDataUrl);
  await drawContent(doc, input);
  const tRenderEnd = Date.now();
  console.log("PDF: render complete", tRenderEnd, "(render ms:", tRenderEnd - tInit, ")");

  // Yield to the browser so the "Building PDF…" label can paint before the
  // synchronous serialise/save pass runs.
  await new Promise((r) => setTimeout(r, 0));

  const date = new Date().toISOString().slice(0, 10);
  const safe = (input.brandName || "Brand").replace(/[^a-zA-Z0-9]+/g, "");
  const filename = `BrandGrenade_${safe}_${FORMAT_FILE[input.format]}_${date}.pdf`;
  console.log("PDF: before save", Date.now());
  doc.save(filename);
  console.log("PDF: save complete", Date.now(), "(save ms:", Date.now() - tRenderEnd, ")");
  console.log("PDF: complete", Date.now());
}
