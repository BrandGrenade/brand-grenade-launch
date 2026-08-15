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
import { buildMintoDocument } from "./minto";
import { deriveMintoContent, type MintoSession } from "./minto-content";
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
  sourceRunId?: string | null;
  sourceCompletedAt?: string | null;
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
                ? `${f.origin}. Not carried forward. Pressure-test read: ${reason}`
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
  // Section 04 always states the composite position, but only ever the score
  // belonging to the actual selected SMP. A parent or sibling proposition's
  // number is never substituted.
  if (proof.composite && scoring.matched) {
    proofBits.push(`Composite score — ${proof.composite}`);
  } else {
    proofBits.push(
      "Composite score — not independently scored (this proposition was finalised after Stage 10 scoring)",
    );
  }
  if (proof.asset) proofBits.push(`Distinctive asset in play — ${proof.asset}`);
  const proofHtml = proofBits.length
    ? `<div class="es-proof">${escapeHtml(proofBits.join(". "))}.</div>`
    : "";
  const winningHtml = winning.smp
    ? `<div class="proposition"><div class="label">Strategic Master Proposition</div><div class="stmt">${escapeHtml(
        winning.smp,
      )}</div></div>${proofHtml}${owns ? p(owns) : ""}${alignment ? p(alignment) : ""}`
    : missing();

  const derived = deriveMintoContent(session as MintoSession, {
    appendix: { mode: "brief" },
  });

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
  // The verdict headline is often already spent in the lead paragraph; the
  // per-test read is the substance, so fall back to the raw verdict rather
  // than printing the "not available" placeholder over real data.
  const verdictFallback = verdict ?? verification.verdict;
  const verificationHtml =
    verdictFallback || testItems.length
      ? `${verdict ? p(verdict) : ""}${
          testItems.length
            ? bullets(testItems)
            : verdictFallback && !verdict
              ? p(`Verification verdict: ${verdictFallback}`)
              : ""
        }`
      : derived.content.why_this_wins || missing();


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
      }${
        scoring.verdict
          ? `<tr><th>Verdict</th><td class="score">${escapeHtml(scoring.verdict)}</td><td>${escapeHtml(
              scoring.verdict === "PASS"
                ? "Clears both Stage 10 hard floors (Truth Strength ≥ 5, Competitive Impossibility ≥ 6)."
                : "Does not clear the Stage 10 hard floors.",
            )}</td></tr>`
          : ""
      }</table>`
    : `<p>The recommended proposition was not independently scored at Stage 10 — it was finalised after the scoring pass. No other proposition's score is substituted here.</p>`;
  const scoringTitle = scoring.rows.length
    ? `${NUMBER_WORD[scoring.rows.length] ?? String(scoring.rows.length)}-dimension proposition scoring (Stage 10)`
    : "Proposition scoring (Stage 10) — not independently scored";

  // 09 — Brand World Opportunity
  // The Room 04 lock supersedes any line carried in Stage 22's brand world
  // reflection, which is written before a creative idea is locked.
  const lockedLine = ((session as MintoSession).locked_campaign_line ?? "").trim();
  const lockedLens = ((session as MintoSession).locked_big_idea_lens ?? "").trim();
  const rawBwLine = brandWorld.line && dedupe.fresh(brandWorld.line) ? brandWorld.line : null;
  const bwLine = lockedLine || rawBwLine;
  const bwLabel = lockedLine
    ? `Locked campaign line${lockedLens ? ` — ${lockedLens}` : ""}`
    : null;
  const bwExplain = dedupe.take(brandWorld.explanation, 1);
  const brandWorldHtml =
    bwLine || bwExplain
      ? `${bwLine ? `${bwLabel ? `<div class="part-label">${escapeHtml(bwLabel)}</div>` : ""}<blockquote>${escapeHtml(bwLine)}</blockquote>` : ""}${bwExplain ? p(bwExplain) : ""}`
      : missing();


  // 10 — Recommendations. Channels are rendered once, in the implications
  // section below; they are deliberately not repeated here.
  const condition = dedupe.take(recs.condition, 2);
  const nextStep = dedupe.take(recs.nextStep, 2);
  const recsHtml = `${condition ? p(`Condition on activation: ${condition}`) : ""}${
    nextStep ? p(`Next step: ${nextStep}`) : ""
  }${!condition && !nextStep ? missing() : ""}`;


  // Assembled against the canonical ten-section Minto structure. The rich
  // exec-summary extraction above feeds the canonical slots; ordering,
  // numbering and completeness belong to `minto.ts`, not to this file.
  const rejectedField = field.filter((f) => !f.selected);

  return buildMintoDocument({
    title: `Strategy Executive Summary — ${brand}`,
    extraCss: extraStyles(),
    cover: {
      brand: "BRAND GRENADE",
      label: "Strategy Executive Summary",
      title: `${brand} — Strategy Executive Summary`,
      subtitle: session.category ?? undefined,
      confidential: true,
    },
    headlineStats: process.stats.map((s) => ({ value: s.value, label: s.label })),
    content: {
      recommendation:
        (leadBlock || "") +
        (winning.smp
          ? `<div class="proposition"><div class="label">Strategic Master Proposition</div><div class="stmt">${escapeHtml(
              winning.smp,
            )}</div></div>`
          : derived.content.recommendation ?? ""),
      business_issue: issueHtml,
      key_insight: findingsHtml,
      proposition: winningHtml,
      why_this_wins: `${proofHtml}${
        verificationHtml === missing()
          ? derived.content.why_this_wins || verificationHtml
          : verificationHtml
      }`,
      validation: `<h3>${escapeHtml(scoringTitle)}</h3>${scoringHtml}`,
      rejected: rejectedField.length
        ? bullets(
            rejectedField.map((f) => ({
              head: f.proposition,
              sub: f.reason ? `${f.origin}. Not the lead: ${f.reason}` : `${f.origin}. Considered, not carried forward.`,
              tag: "Considered",
              muted: true,
            })),
          )
        : derived.content.rejected ?? "",
      implications: `${brandWorldHtml}${
        recs.channels.length
          ? `<h3>Channels this strategy activates through</h3>${bullets(
              recs.channels.map((c) => ({ head: c })),
            )}`
          : ""
      }`,
      next_step: recsHtml,
      appendix: `<h3>Research the summary draws on</h3>${researchHtml}${
        intel.sourceRunId
          ? `<div class="callout"><div class="callout-title">Intelligence source snapshot</div><p>Run ${escapeHtml(intel.sourceRunId.slice(0, 8))}${intel.sourceCompletedAt ? `, completed ${escapeHtml(new Date(intel.sourceCompletedAt).toLocaleString("en-AU"))}` : ""}. Resolved from the exact Intelligence source ID carried in this strategy session's brief.</p></div>`
          : ""
      }${
        derived.content.appendix ?? ""
      }`,
    },
    footerHtml:
      "Brand Grenade Strategy Intelligence System — Confidential. This summary was assembled from stored session data only; no content was generated for it. Full reasoning sits in the Consulting Delivery document and the Complete Pipeline Record.",
  });
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
