// Strategy Executive Summary — compressed companion to Consulting Delivery.
//
// No AI, no new reasoning. Every line is assembled from data already stored
// on the session (and, where one exists, the Intelligence Lab run for the
// same brand). Mixed format by design: visual process block, bullet audit
// trails for the countable sections, real prose for the argued ones.

import { baseStyles, escapeHtml, sanitise } from "./phase1-document-builder";
import { NOT_AVAILABLE } from "./exec-summary-extract";
import {
  buildLeadParagraph,
  extractBusinessIssue,
  extractBrandWorldSection,
  extractFindings,
  extractFrameworks,
  extractProcess,
  extractPropositionsField,
  extractRecommendations,
  extractResearch,
  extractScoring,
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
.es-chain { display: flex; flex-wrap: wrap; align-items: center; gap: 8pt; margin: 4pt 0 16pt; }
.es-chain .node { font-size: 9.5pt; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--ash); border: 1pt solid var(--rule); border-radius: 3pt; padding: 6pt 10pt; background: var(--surface); }
.es-chain .arrow { font-size: 11pt; color: ${ACCENT}; font-weight: 700; }
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
table.es-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
table.es-table th, table.es-table td { text-align: left; vertical-align: top; padding: 7pt 10pt; border-bottom: 0.5pt solid var(--rule); }
table.es-table th { width: 32%; font-weight: 600; color: var(--ash); background: var(--surface); }
table.es-table td.score { width: 12%; font-weight: 700; color: ${ACCENT}; white-space: nowrap; }
.es-missing { font-size: 9.5pt; color: var(--smoke); font-style: italic; }
`;
}

function section(label: string, title: string, body: string): string {
  return `<div class="section"><div class="part-label">${escapeHtml(label)}</div><h2>${escapeHtml(title)}</h2>${body}</div>`;
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
  const brandWorld = extractBrandWorldSection(row);
  const recs = extractRecommendations(row);

  const process = extractProcess(
    row,
    { propositions: field.length, dimensions: scoring.rows.length, frameworks },
    Boolean(intel.executiveSummary || intel.tension),
  );

  const lead = buildLeadParagraph({
    businessIssue,
    smp: winning.smp,
    reason: winning.alignment,
    verdict: verification.verdict,
  });

  const cover = `<div class="cover">
  <div class="cover-brand">BRAND GRENADE</div>
  <div class="cover-label">STRATEGY EXECUTIVE SUMMARY</div>
  <div class="cover-title">${escapeHtml(brand)} — Strategy Executive Summary</div>
  <div class="cover-rule"></div>
  <div class="cover-date">${escapeHtml(date)}</div>
  <div class="cover-confidential">CONFIDENTIAL</div>
</div>`;

  const leadBlock = lead ? `<div class="es-lead">${escapeHtml(lead)}</div>` : "";

  // 01 — The Process (visual)
  const chainHtml = process.chain.length
    ? `<div class="es-chain">${process.chain
        .map((n) => `<span class="node">${escapeHtml(n)}</span>`)
        .join('<span class="arrow">→</span>')}</div>`
    : "";
  const statsHtml = `<div class="es-stats">${process.stats
    .map(
      (s) =>
        `<div class="stat"><span class="num">${escapeHtml(s.value)}</span><span class="cap">${escapeHtml(s.label)}</span></div>`,
    )
    .join("")}</div>`;

  // 03 — Research
  const researchHtml = bullets(
    research.map((r) => ({ head: r.label, sub: r.body, tag: undefined })),
  );

  // 05 — Frameworks
  const frameworksHtml = bullets([
    ...frameworks.stages.map((s) => ({ head: s })),
    ...frameworks.engines.map((e) => ({
      head: `Lateral engine — ${e}`,
      tag: "LOC",
    })),
  ]);

  // 06 — The Propositions Field
  const fieldHtml = field.length
    ? bullets(
        field.map((f) => ({
          head: f.proposition,
          sub: f.selected
            ? `${f.origin}. Carried forward as the recommendation.`
            : f.reason
              ? `${f.origin}. Not the lead: ${f.reason}`
              : `${f.origin}. Considered, not carried forward.`,
          tag: f.selected ? "Selected" : "Considered",
          muted: !f.selected,
        })),
      )
    : missing();

  // 07 — Winning Proposition
  const winningHtml = winning.smp
    ? `<div class="proposition"><div class="label">Strategic Master Proposition</div><div class="stmt">${escapeHtml(
        winning.smp,
      )}</div></div>${winning.owns ? p(winning.owns) : ""}${winning.alignment ? p(winning.alignment) : ""}`
    : missing();

  // 08 — Verification
  const verificationHtml =
    verification.verdict || verification.tests.length
      ? `${verification.verdict ? p(verification.verdict) : ""}${bullets(
          verification.tests.map((t) => ({
            head: t.name,
            sub: t.note,
            tag: t.verdict ?? undefined,
            muted: !!t.verdict && !/HOLDS/i.test(t.verdict),
          })),
        )}`
      : missing();

  // 09 — Scoring and Validation
  const scoringHtml = scoring.rows.length
    ? `<table class="es-table">${scoring.rows
        .map(
          (r) =>
            `<tr><th>${escapeHtml(r.dimension)}</th><td class="score">${escapeHtml(r.score)}</td><td>${escapeHtml(
              r.note ?? "",
            )}</td></tr>`,
        )
        .join("")}${
        scoring.composite
          ? `<tr><th>Composite</th><td class="score">${escapeHtml(scoring.composite)}</td><td>${escapeHtml(
              scoring.weighted ? `Weighted ranking composite ${scoring.weighted}.` : "",
            )}</td></tr>`
          : ""
      }</table>`
    : missing();

  // 10 — Brand World Opportunity
  const brandWorldHtml = brandWorld.line
    ? `<blockquote>${escapeHtml(brandWorld.line)}</blockquote>${
        brandWorld.explanation ? p(brandWorld.explanation) : ""
      }`
    : missing();

  // 11 — Recommendations, including channel strategy
  const recsHtml = `${recs.condition ? p(`Condition on activation: ${recs.condition}`) : ""}${
    recs.nextStep ? p(`Next step: ${recs.nextStep}`) : ""
  }${
    recs.channels.length
      ? `<div class="part-label" style="margin-top:10pt">CHANNELS THIS STRATEGY ACTIVATES THROUGH</div>${bullets(
          recs.channels.map((c) => ({ head: c })),
        )}`
      : ""
  }${!recs.condition && !recs.nextStep && !recs.channels.length ? missing() : ""}`;

  const body =
    cover +
    leadBlock +
    section("SECTION 01", "The Process", `${chainHtml}${statsHtml}`) +
    section("SECTION 02", "The Business Issue", businessIssue ? p(businessIssue) : missing()) +
    section("SECTION 03", "Research", researchHtml) +
    section("SECTION 04", "Findings", findings ? p(findings) : missing()) +
    section("SECTION 05", "Frameworks", frameworksHtml) +
    section("SECTION 06", "The Propositions Field", fieldHtml) +
    section("SECTION 07", "Winning Proposition", winningHtml) +
    section("SECTION 08", "Verification", verificationHtml) +
    section("SECTION 09", "Scoring and Validation", scoringHtml) +
    section("SECTION 10", "Brand World Opportunity", brandWorldHtml) +
    section("SECTION 11", "Recommendations, Including Channel Strategy", recsHtml) +
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
