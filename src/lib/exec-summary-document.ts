// Strategy Executive Summary — compressed companion to Consulting Delivery.
//
// No AI, no new reasoning. Every line is assembled from data already stored
// on the session (and, where one exists, the Intelligence Lab run for the
// same brand). Mixed format by design: stat row, bullet audit trails for the
// countable sections, real prose for the argued ones.
//
// Structure is the original eleven sections, channel strategy included.
// The only corrections layered on top are the ones actually requested:
//   • zero repetition, enforced by a single shared deduper
//   • no explanation of Brand Grenade's own phases or stages
//   • distinctive asset read from stage_22_distinctive_assets
//   • proof stated as one short highlight, not a second scoring table
//   • pipeline stage count hard-set to 28
//   • the deprecated /110 weighted composite never rendered

import { baseStyles, escapeHtml, sanitise } from "./phase1-document-builder";
import { NOT_AVAILABLE } from "./exec-summary-extract";
import {
  buildLeadParagraph,
  createDeduper,
  extractBusinessIssue,
  extractBrandWorldSection,
  extractFindings,
  extractFrameworks,
  extractProcess,
  extractProof,
  extractPropositionsField,
  extractRecommendations,
  extractResearch,
  extractScoring,
  extractSituationFact,
  extractVerification,
  extractWinning,
  type ExecSessionRow,
} from "./exec-summary-sections";

export type ExecSummarySession = {
  brand_name?: string | null;
  category?: string | null;
  selected_smp?: string | null;
} & ExecSessionRow;

export interface ExecSummaryIntel {
  /** Briefing Room governing tension carried in the Intelligence handoff. */
  tension?: string | null;
  /** Intelligence Lab executive summary (report_metadata.executive_summary). */
  executiveSummary?: string | null;
}

const ACCENT = "#C81E1E";

function extraStyles(): string {
  return `
.es-lead { font-size: 12pt; line-height: 1.55; color: var(--ash); border-left: 2pt solid ${ACCENT}; padding: 2pt 0 2pt 14pt; margin: 0 0 26pt; }
.es-open { page-break-inside: auto; }
.es-open .section { page-break-inside: auto; }
.footer { page-break-before: avoid; }
.es-stats { display: flex; flex-wrap: wrap; gap: 26pt; padding: 12pt 0 2pt; border-top: 0.5pt solid var(--rule); }
.es-stats .stat { min-width: 90pt; }
.es-stats .num { display: block; font-size: 24pt; font-weight: 700; line-height: 1.1; color: ${ACCENT}; }
.es-stats .cap { display: block; font-size: 8.5pt; letter-spacing: 0.1em; text-transform: uppercase; color: var(--smoke); margin-top: 3pt; }
.es-bullets { margin: 0; padding: 0; list-style: none; }
.es-bullets li { padding: 7pt 0 7pt 14pt; border-bottom: 0.5pt solid var(--rule); position: relative; font-size: 10pt; color: var(--ash); }
.es-bullets li:last-child { border-bottom: none; }
.es-bullets li:before { content: "—"; position: absolute; left: 0; color: ${ACCENT}; }
.es-bullets .k { font-weight: 600; }
.es-bullets .sub { display: block; font-size: 9.5pt; color: var(--smoke); margin-top: 2pt; }
.es-tag { display: inline-block; font-size: 8pt; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: ${ACCENT}; margin-right: 6pt; }
.es-tag.muted { color: var(--smoke); }
.es-proof { font-size: 10pt; color: var(--ash); border-left: 2pt solid ${ACCENT}; padding: 2pt 0 2pt 12pt; margin: 0 0 12pt; }
table.es-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
table.es-table th, table.es-table td { text-align: left; vertical-align: top; padding: 7pt 10pt; border-bottom: 0.5pt solid var(--rule); }
table.es-table th { width: 32%; font-weight: 600; color: var(--ash); background: var(--surface); }
table.es-table td.score { width: 12%; font-weight: 700; color: ${ACCENT}; white-space: nowrap; }
.es-missing { font-size: 9.5pt; color: var(--smoke); font-style: italic; }
`;
}

function section(label: string, title: string, body: string, cls = ""): string {
  return `<div class="section${cls ? ` ${cls}` : ""}"><div class="part-label">${escapeHtml(label)}</div><h2>${escapeHtml(title)}</h2>${body}</div>`;
}

function p(text: string): string {
  return `<p>${escapeHtml(text)}</p>`;
}

function missing(): string {
  return `<p class="es-missing">${escapeHtml(NOT_AVAILABLE)}</p>`;
}

function bullets(items: Array<{ head: string; sub?: string | null; tag?: string; muted?: boolean }>): string {
  if (!items.length) return missing();
  return `<ul class="es-bullets">${items
    .map(
      (i) =>
        `<li>${i.tag ? `<span class="es-tag${i.muted ? " muted" : ""}">${escapeHtml(i.tag)}</span>` : ""}<span class="k">${escapeHtml(i.head)}</span>${
          i.sub ? `<span class="sub">${escapeHtml(i.sub)}</span>` : ""
        }</li>`,
    )
    .join("")}</ul>`;
}

const NUMBER_WORD: Record<number, string> = {
  1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six",
  7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten", 11: "Eleven", 12: "Twelve",
};

export function buildExecSummaryDocument(
  session: ExecSummarySession,
  intel: ExecSummaryIntel = {},
): string {
  const brand = session.brand_name ?? "Untitled Brand";
  const date = new Date().toLocaleDateString("en-AU", { month: "long", year: "numeric" });

  const row = session as ExecSessionRow;

  const businessIssue = extractBusinessIssue(row, intel.tension);
  const findings = extractFindings(row, intel);
  const research = extractResearch(row, intel);
  const frameworks = extractFrameworks(row);
  const field = extractPropositionsField(row);
  const winning = extractWinning(row);
  const verification = extractVerification(row);
  const scoring = extractScoring(row);
  const proof = extractProof(row, scoring);
  const brandWorld = extractBrandWorldSection(row);
  const recs = extractRecommendations(row);

  const process = extractProcess(
    row,
    { propositions: field.length, dimensions: scoring.rows.length, frameworks },
    Boolean(intel.executiveSummary || intel.tension),
  );

  // Single source of truth for "has this already been said?". Every section
  // below draws through it, so no sentence, quote or figure appears twice.
  const dedupe = createDeduper();

  const lead = buildLeadParagraph(
    {
      fact: extractSituationFact(row, intel),
      businessIssue,
      smp: winning.smp,
      reason: winning.alignment,
      verdict: verification.verdict,
    },
    dedupe,
  );

  const cover = `<div class="cover">
  <div class="cover-brand">BRAND GRENADE</div>
  <div class="cover-label">STRATEGY EXECUTIVE SUMMARY</div>
  <div class="cover-title">${escapeHtml(brand)} — Strategy Executive Summary</div>
  <div class="cover-rule"></div>
  <div class="cover-date">${escapeHtml(date)}</div>
  <div class="cover-confidential">CONFIDENTIAL</div>
</div>`;

  const leadBlock = lead ? `<div class="es-lead">${escapeHtml(lead)}</div>` : "";

  // 01 — Scale of the work: numbers only, no narration of platform phases.
  const statsHtml = `<div class="es-stats">${process.stats
    .map(
      (s) =>
        `<div class="stat"><span class="num">${escapeHtml(s.value)}</span><span class="cap">${escapeHtml(s.label)}</span></div>`,
    )
    .join("")}</div>`;

  // 02 — The Business Issue
  const issueHtml = (() => {
    const t = dedupe.take(businessIssue);
    return t ? p(t) : missing();
  })();

  // 03 — Research
  const researchHtml = bullets(
    research
      .map((r) => ({ head: r.label, sub: dedupe.fresh(r.body) ? r.body : null }))
      .filter((r) => !!r.sub) as Array<{ head: string; sub: string }>,
  );

  // 04 — Findings
  const findingsHtml = (() => {
    const t = dedupe.take(findings);
    return t ? p(t) : missing();
  })();

  // 05 — The Propositions Field
  const fieldHtml = field.length
    ? bullets(
        field.map((f) => {
          const reason = f.reason && dedupe.fresh(f.reason) ? f.reason : null;
          return {
            head: f.proposition,
            sub: f.selected
              ? `${f.origin}. Carried forward as the recommendation.`
              : reason
                ? `${f.origin}. Not the lead: ${reason}`
                : `${f.origin}. Considered, not carried forward.`,
            tag: f.selected ? "Selected" : "Considered",
            muted: !f.selected,
          };
        }),
      )
    : missing();

  // 06 — Winning Proposition, with the proof highlight: one strongest
  // dimension, the live composite and the distinctive asset. Deliberately
  // not a second copy of the Section 08 table.
  const owns = dedupe.take(winning.owns, 2);
  const alignment = dedupe.take(winning.alignment, 2);
  const proofBits: string[] = [];
  if (proof.strongest) {
    proofBits.push(`Strongest dimension — ${proof.strongest.dimension} ${proof.strongest.score}`);
  }
  if (proof.composite) proofBits.push(`Composite score — ${proof.composite}`);
  if (proof.asset) proofBits.push(`Distinctive asset in play — ${proof.asset}`);
  const proofHtml = proofBits.length
    ? `<div class="es-proof">${escapeHtml(proofBits.join(". "))}.</div>`
    : "";
  const winningHtml = winning.smp
    ? `<div class="proposition"><div class="label">Strategic Master Proposition</div><div class="stmt">${escapeHtml(
        winning.smp,
      )}</div></div>${proofHtml}${owns ? p(owns) : ""}${alignment ? p(alignment) : ""}`
    : missing();

  // 07 — Verification
  const verdict = dedupe.take(verification.verdict, 2);
  const testItems = verification.tests
    .map((t) => ({
      head: t.name,
      sub: t.note && dedupe.fresh(t.note) ? t.note : null,
      tag: t.verdict ?? undefined,
      muted: !!t.verdict && !/HOLDS/i.test(t.verdict),
    }))
    .filter((t) => !!t.sub || !!t.tag);
  const verificationHtml =
    verdict || testItems.length
      ? `${verdict ? p(verdict) : ""}${testItems.length ? bullets(testItems) : ""}`
      : missing();

  // 08 — Scoring
  const scoringHtml = scoring.rows.length
    ? `<table class="es-table">${scoring.rows
        .map((r) => {
          const note = r.note && dedupe.fresh(r.note) ? r.note : "";
          return `<tr><th>${escapeHtml(r.dimension)}</th><td class="score">${escapeHtml(
            r.score,
          )}</td><td>${escapeHtml(note)}</td></tr>`;
        })
        .join("")}${
        scoring.composite
          ? `<tr><th>Composite</th><td class="score">${escapeHtml(scoring.composite)}</td><td></td></tr>`
          : ""
      }</table>`
    : missing();
  const scoringTitle = `${NUMBER_WORD[scoring.rows.length] ?? String(scoring.rows.length)}-dimension proposition scoring (Stage 10)`;

  // 09 — Brand World Opportunity
  const bwLine = brandWorld.line && dedupe.fresh(brandWorld.line) ? brandWorld.line : null;
  const bwExplain = dedupe.take(brandWorld.explanation, 1);
  const brandWorldHtml =
    bwLine || bwExplain
      ? `${bwLine ? `<blockquote>${escapeHtml(bwLine)}</blockquote>` : ""}${bwExplain ? p(bwExplain) : ""}`
      : missing();

  // 10 — Recommendations, including channel strategy
  const condition = dedupe.take(recs.condition, 2);
  const nextStep = dedupe.take(recs.nextStep, 2);
  const recsHtml = `${condition ? p(`Condition on activation: ${condition}`) : ""}${
    nextStep ? p(`Next step: ${nextStep}`) : ""
  }${
    recs.channels.length
      ? `<div class="part-label" style="margin-top:10pt">CHANNELS THIS STRATEGY ACTIVATES THROUGH</div>${bullets(
          recs.channels.map((c) => ({ head: c })),
        )}`
      : ""
  }${!condition && !nextStep && !recs.channels.length ? missing() : ""}`;

  const body =
    cover +
    leadBlock +
    `<div class="es-open">` +
    section("SECTION 01", "Scale of the Work", statsHtml) +
    section("SECTION 02", "The Business Issue", issueHtml) +
    section("SECTION 03", "Research", researchHtml) +
    section("SECTION 04", "Findings", findingsHtml) +
    section("SECTION 05", "The Propositions Field", fieldHtml) +
    section("SECTION 06", "Winning Proposition", winningHtml) +
    section("SECTION 07", "Verification", verificationHtml) +
    section("SECTION 08", scoringTitle, scoringHtml, "es-open") +
    section("SECTION 09", "Brand World Opportunity", brandWorldHtml) +
    section("SECTION 10", "Recommendations, Including Channel Strategy", recsHtml, "es-open") +
    `</div>` +
    `<div class="footer">Brand Grenade Strategy Intelligence System — Confidential. This summary was assembled from stored session data only; no content was generated for it. Full reasoning sits in the Consulting Delivery document and the Complete Pipeline Record.</div>`;


  const title = `Strategy Executive Summary — ${brand}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${baseStyles()}${extraStyles()}</style>
</head>
<body>
<div id="toolbar">
  <span>${escapeHtml(title)}</span>
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

export function openExecSummaryDocument(
  session: ExecSummarySession,
  intel: ExecSummaryIntel = {},
): void {
  const html = buildExecSummaryDocument(session, intel);
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow popups to open your document.");
    return;
  }
  win.document.open("text/html");
  win.document.write(html);
  win.document.close();
}

// `sanitise` retained for callers passing raw text through this module.
export { sanitise };
