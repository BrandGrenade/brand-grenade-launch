// Stage 16 reference content & demo-mode pre-formatted documents.
//
// Three exported constants. Paste full document markdown into each.
// These are used:
//   1. As a quality reference / structural model for live Stage 16 generation.
//   2. As fallback body content if the session's stage_16_*_output is missing.
//   3. As the source for Demo Mode downloads (DEMO_* constants below).
//
// Markdown conventions consumed by pdf-generator.ts:
//   # PART ONE — Title        → full section-opener page
//   ## Section Heading        → H2 (amber left rule, may page-break)
//   ### Sub-heading           → H3
//   > Pull quote text         → blockquote / pull quote
//   - / *  bullet             → bullet list item
//   ---                       → horizontal rule
//   **bold**  *italic*        → inline emphasis
//   `LABEL:` (line starts ALL CAPS + colon) → amber label
//   The line that exactly matches the session's selected SMP
//   triggers the full-page proposition reveal.

export const AGENCY_PLATFORM_CONTENT = ``;

export const CONSULTING_DELIVERY_CONTENT = ``;

export const WORKSHOP_GUIDE_CONTENT = ``;

export const VISION_CONTENT = ``;

// ─── Demo Mode pre-formatted documents ──────────────────────────────────
// Used directly (no live Stage 16 call) for demo sessions.

export const DEMO_AGENCY_PDF_CONTENT = ``;

export const DEMO_CONSULTING_PDF_CONTENT = ``;

export const DEMO_WORKSHOP_PDF_CONTENT = ``;

export const DEMO_VISION_PDF_CONTENT = ``;

import type { Stage16Format } from "./stage16-prompt";

export function getTemplateContent(format: Stage16Format): string {
  switch (format) {
    case "agency":
      return AGENCY_PLATFORM_CONTENT;
    case "consulting":
      return CONSULTING_DELIVERY_CONTENT;
    case "workshop":
      return WORKSHOP_GUIDE_CONTENT;
    case "vision":
      return VISION_CONTENT;
  }
}

export function getDemoContent(format: Stage16Format): string {
  switch (format) {
    case "agency":
      return DEMO_AGENCY_PDF_CONTENT;
    case "consulting":
      return DEMO_CONSULTING_PDF_CONTENT;
    case "workshop":
      return DEMO_WORKSHOP_PDF_CONTENT;
    case "vision":
      return DEMO_VISION_PDF_CONTENT;
  }
}
