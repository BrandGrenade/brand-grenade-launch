// Strategy Executive Summary — synthesis document.
//
// No AI, no new reasoning. Every line is assembled from data already stored
// on the session (and, where one exists, the Intelligence Lab run for the
// same brand). Rendered as HTML through the same document design system as
// every other deliverable.

import { baseStyles, escapeHtml, sanitise } from "./phase1-document-builder";
import {
  NOT_AVAILABLE,
  PROOF_UNAVAILABLE,
  extractBrandWorld,
  extractProofAtAGlance,
  extractShortlist,
  extractWhyThisWins,
  firstSentences,
} from "./exec-summary-extract";

export interface ExecSummarySession {
  brand_name?: string | null;
  category?: string | null;
  selected_smp?: string | null;
  stage_10_output?: string | null;
  stage_11_output?: string | null;
  stage_12_output?: string | null;
  stage_13_output?: string | null;
  stage_22_output?: string | null;
  stage_22_distinctive_assets?: string | null;
}

export interface ExecSummaryIntel {
  /** Briefing Room governing tension carried in the Intelligence handoff. */
  tension?: string | null;
  /** Intelligence Lab executive summary (report_metadata.executive_summary). */
  executiveSummary?: string | null;
}

const PROCESS_LINE =
  "Research → 50+ methodologies & lateral engines → propositions generated → six-dimension validation → one recommendation";

const ACCENT = "#C81E1E";

function extraStyles(): string {
  return `
.es-process { margin: 6pt 0 0; padding: 12pt 14pt; border: 1pt solid #EDE8E0; border-radius: 6pt; background: #EDE8E0; font-size: 10pt; font-weight: bold; letter-spacing: 0.01em; color: #1C1A18; }
.es-list { margin: 0; padding: 0; list-style: none; }
.es-item { padding: 10pt 0; border-bottom: 0.5pt solid #EDE8E0; }
.es-item:last-child { border-bottom: none; }
.es-item .es-status { display: inline-block; font-size: 8pt; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; color: ${ACCENT}; margin-bottom: 4pt; }
.es-item .es-status.muted { color: #8B8680; }
.es-item .es-prop { font-size: 11pt; font-weight: bold; color: #1C1A18; }
.es-item .es-note { font-size: 9.5pt; color: #8B868024e; margin-top: 3pt; }
.es-kv { font-size: 10pt; margin-bottom: 8pt; }
.es-kv .es-label { font-weight: bold; color: #1C1A18; }
table.es-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
table.es-table th, table.es-table td { text-align: left; vertical-align: top; padding: 8pt 10pt; border-bottom: 0.5pt solid #EDE8E0; }
table.es-table th { width: 34%; font-weight: bold; color: #1C1A18; background: #EDE8E0; }
.es-missing { font-size: 9.5pt; color: #8B868036e; font-style: italic; }
`;
}

function section(label: string, title: string, body: string): string {
  if (!body) return "";
  return `<div class="section"><div class="part-label">${escapeHtml(label)}</div><h2>${escapeHtml(title)}</h2>${body}</div>`;
}

function p(text: string): string {
  return `<p>${escapeHtml(text)}</p>`;
}

function missing(): string {
  return `<p class="es-missing">${escapeHtml(NOT_AVAILABLE)}</p>`;
}

export function buildExecSummaryDocument(
  session: ExecSummarySession,
  intel: ExecSummaryIntel = {},
): string {
  const brand = session.brand_name ?? "Untitled Brand";
  const date = new Date().toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
  });

  // 1 — The Challenge
  const challenge = firstSentences(sanitise(intel.tension ?? ""), 3);

  // 2 — What We Found (omitted entirely when no Intelligence Lab run)
  const found = firstSentences(sanitise(intel.executiveSummary ?? ""), 3);

  // 4 — The Shortlist
  const shortlist = extractShortlist(session.stage_12_output, {
    selectedSmp: session.selected_smp,
    stage11: session.stage_11_output,
  }).slice(0, 5);

  // 5 — The Recommendation
  const smp = sanitise(session.selected_smp ?? "").trim();

  // 6 — Why This Wins
  const why = extractWhyThisWins({
    stage11: session.stage_11_output,
    stage13: session.stage_13_output,
    selectedSmp: session.selected_smp,
  });

  // 7 — The Proof, At A Glance
  const proof = extractProofAtAGlance({
    stage10: session.stage_10_output,
    stage22: session.stage_22_output,
    distinctiveAssets: session.stage_22_distinctive_assets,
    selectedSmp: session.selected_smp,
  });

  // 8 — The Brand World It Builds
  const brandWorld = extractBrandWorld(session.stage_22_output);

  const cover = `<div class="cover">
  <div class="cover-brand">BRAND GRENADE</div>
  <div class="cover-label">STRATEGY EXECUTIVE SUMMARY</div>
  <div class="cover-title">${escapeHtml(brand)} — Strategy Executive Summary</div>
  <div class="cover-rule"></div>
  <div class="cover-date">${escapeHtml(date)}</div>
  <div class="cover-confidential">CONFIDENTIAL</div>
</div>`;

  const shortlistBody = shortlist.length
    ? `<ul class="es-list">${shortlist
        .map((item) => {
          const prop = item.proposition ?? item.owns ?? NOT_AVAILABLE;
          const note = item.selected
            ? "Carried forward as the recommendation."
            : item.setAsideReason ?? "";
          return `<li class="es-item"><span class="es-status${item.selected ? "" : " muted"}">${escapeHtml(item.status)}</span><div class="es-prop">${escapeHtml(prop)}</div>${note ? `<div class="es-note">${escapeHtml(note)}</div>` : ""}</li>`;
        })
        .join("")}</ul>`
    : missing();

  const whyBody = why.formatted.length
    ? why.formatted
        .map(
          (f) =>
            `<div class="es-kv"><span class="es-label">${escapeHtml(f.label)}:</span> ${escapeHtml(f.body)}</div>`,
        )
        .join("")
    : missing();

  const proofBody = proof
    ? `<table class="es-table">
  <tr><th>Overall composite score</th><td>${escapeHtml(proof.composite)}</td></tr>
  <tr><th>Distinctive asset in play</th><td>${escapeHtml(proof.distinctiveAsset)}</td></tr>
  <tr><th>Competitive impossibility</th><td>${escapeHtml(proof.impossibility)}</td></tr>
  <tr><th>Clean air</th><td>${escapeHtml(proof.cleanAir)}</td></tr>
</table>`
    : `<p class="es-missing">${escapeHtml(PROOF_UNAVAILABLE)}</p>`;

  const body =
    cover +
    section("SECTION 01", "The Challenge", challenge ? p(challenge) : missing()) +
    (found ? section("SECTION 02", "What We Found", p(found)) : "") +
    section(
      "SECTION 03",
      "The Process, In Brief",
      `<div class="es-process">${escapeHtml(PROCESS_LINE)}</div>`,
    ) +
    section("SECTION 04", "The Shortlist", shortlistBody) +
    section(
      "SECTION 05",
      "The Recommendation",
      smp
        ? `<div class="proposition"><div class="label">Strategic Master Proposition</div><div class="stmt">${escapeHtml(smp)}</div></div>`
        : missing(),
    ) +
    section("SECTION 06", "Why This Wins", whyBody) +
    section("SECTION 07", "The Proof, At A Glance", proofBody) +
    section(
      "SECTION 08",
      "The Brand World It Builds",
      brandWorld ? `<blockquote>${escapeHtml(brandWorld)}</blockquote>` : missing(),
    ) +
    section(
      "SECTION 09",
      "What Sits Behind This / Next Step",
      `${p(
        "Full reasoning, stage by stage, sits in the Complete Pipeline Record; the full argument sits in the Board Strategy Recommendation — both available in this session's Deliverables.",
      )}${p(
        "Recommended next step: confirm the recommendation with the decision-making group, then move into creative territory development and activation.",
      )}`,
    ) +
    `<div class="footer">Brand Grenade Strategy Intelligence System — Confidential. This summary was assembled from stored session data only; no content was generated for it. All outputs should be reviewed before commercial deployment.</div>`;

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
