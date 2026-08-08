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
  createDeduper,
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
  // below draws through it, so no sentence, quote or figure can appear twice.
  const dedupe = createDeduper();

  // The Minto précis speaks first, so it claims the strongest lines and every
  // later section renders only what the précis did not already say.
  const precis = buildPrecis(
    { businessIssue, findings, smp: winning.smp, brand },
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

  const precisRow = (label: string, value: string | null) =>
    value ? `<div class="es-precis-row"><span class="lab">${escapeHtml(label)}</span><span class="val">${escapeHtml(value)}</span></div>` : "";

  const precisBlock =
    precis.situation || precis.complication || precis.answer
      ? `<div class="es-precis">${precisRow("Situation", precis.situation)}${precisRow(
          "Complication",
          precis.complication,
        )}${precisRow("Question", precis.question)}${precisRow("Answer", precis.answer)}</div>`
      : "";

  // 01 — Scale of the work: numbers only, no process narration.
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

  // 05 — The Shortlist: 3–5 alternatives considered and set aside, one line
  // each. The winner has its own section and is never repeated here.
  const setAside = field.filter((f) => !f.selected).slice(0, 5);
  const shortlistHtml = setAside.length
    ? bullets(
        setAside.map((f) => {
          const reason = f.reason && dedupe.fresh(f.reason) ? f.reason : null;
          return {
            head: f.proposition,
            sub: reason ? firstLine(reason) : null,
            tag: "Considered",
            muted: true,
          };
        }),
      )
    : missing();

  // 06 — The Recommendation
  const owns = dedupe.take(winning.owns, 2);
  const winningHtml = winning.smp
    ? `<div class="proposition"><div class="label">Strategic Master Proposition</div><div class="stmt">${escapeHtml(
        winning.smp,
      )}</div></div>${owns ? p(owns) : ""}`
    : missing();

  // 07 — Why This Wins: two or three lines, no test-by-test breakdown.
  const whyLines = [dedupe.take(winning.alignment, 1), dedupe.take(verification.verdict, 1)]
    .filter((x): x is string => !!x)
    .slice(0, 2);
  const whyHtml = whyLines.length ? whyLines.map((l) => p(l)).join("") : missing();

  // 08 — The Proof, At A Glance: one highlight only. Section 09 carries the
  // full table, so nothing here restates a row's reasoning.
  const proofItems: Array<{ head: string; sub?: string | null }> = [];
  if (proof.strongest) {
    proofItems.push({
      head: `Strongest dimension — ${proof.strongest.dimension} ${proof.strongest.score}`,
    });
  }
  if (proof.composite) proofItems.push({ head: `Composite score — ${proof.composite}` });
  if (proof.asset) proofItems.push({ head: `Distinctive asset in play — ${proof.asset}` });
  const proofHtml = proofItems.length ? bullets(proofItems) : missing();

  // 09 — Scoring
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

  // Coda — the brand world it builds, plus the single operating condition.
  const bwLine = brandWorld.line && dedupe.fresh(brandWorld.line) ? brandWorld.line : null;
  const bwExplain = dedupe.take(brandWorld.explanation, 1);
  const condition = dedupe.take(recs.condition, 1);
  const nextStep = dedupe.take(recs.nextStep, 1);
  const codaHtml = `${bwLine ? `<blockquote>${escapeHtml(bwLine)}</blockquote>` : ""}${
    bwExplain ? p(bwExplain) : ""
  }${condition ? p(`Condition on activation: ${condition}`) : ""}${
    nextStep ? p(`Next step: ${nextStep}`) : ""
  }`;

  const body =
    cover +
    precisBlock +
    `<div class="es-open">` +
    section("SECTION 01", "Scale of the Work", statsHtml) +
    section("SECTION 02", "The Business Issue", issueHtml) +
    section("SECTION 03", "Research", researchHtml) +
    section("SECTION 04", "Findings", findingsHtml) +
    section("SECTION 05", "The Shortlist", shortlistHtml) +
    section("SECTION 06", "The Recommendation", winningHtml) +
    section("SECTION 07", "Why This Wins", whyHtml) +
    section("SECTION 08", "The Proof, At A Glance", proofHtml) +
    section("SECTION 09", scoringTitle, scoringHtml, "es-open") +
    (codaHtml ? section("", "The Brand World It Builds", codaHtml, "es-open") : "") +
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
