// Briefing Room → Stage 1 handoff builder (Steps 5–6).
// Pure, client-safe. No server imports. Composes the eleven-field BriefFields
// object plus the load-bearing brief_text that ships to Stage 1.
//
// Tension-preservation contract: the human-selected tension from Step 4
// rides into Stage 1 as an explicit "BRIEFING ROOM STRATEGIC ANCHOR"
// fenced block at the top of brief_text AND as the opening paragraph of
// f4_barrier prose. Stage 1's prompt has been amended to recognise this
// block and forbid tension substitution in its Section 2 output.
//
// Honesty contract: gaps flagged in Steps 1–2 (missing truth-types,
// missing generative qualitative fact) travel verbatim into the anchor
// block's OPEN GAPS list, so the pipeline sees them and cannot silently
// paper over what the Briefing Room correctly flagged.

import {
  composeBriefText,
  emptyBriefFields,
  type BriefFields,
} from "./brief-schema";
import type {
  Step1Output,
  Step2Output,
  Step3Output,
  Step4Output,
  Truth,
} from "./briefing-room-prompts";
import type { PrebriefForBriefingRoom } from "./intelligence/prebrief-text";

export type WorkspaceForHandoff = {
  brand_name: string;
  category: string;
  diagnosis: Step1Output | null;
  truths: Step2Output | null;
  relevance: Step3Output | null;
  tensions: Step4Output | null;
  selected_frame: string | null;
  selected_tension_index: number | null;
  /** Structured prebrief signals from the Intelligence Engine handoff, when
   *  the workspace was seeded from the Intelligence Lab. Used to map
   *  must_include/must_avoid/competitive_context/cultural_context into the
   *  correct Step-5 fields instead of leaving them stranded in raw_brief. */
  prebrief?: PrebriefForBriefingRoom | null;
  /** Optional LLM-generated content for fields that Steps 1–4 do not
   *  diagnose (f5 what has been tried, f10 competitive, f11 mandatories).
   *  Drawn from raw research documents. When absent, a specific reason is
   *  emitted instead of a generic placeholder. */
  llm_fields?: {
    f5_tried?: string;
    f5_tried_reason?: string;
    f10_competitive?: string;
    f10_competitive_reason?: string;
    f11_mandatories?: string;
    f11_mandatories_reason?: string;
  } | null;
};

export type HandoffPayload = {
  briefFields: BriefFields;
  briefText: string;
  warnings: string[]; // blocking-or-notable issues the user should acknowledge
  gaps: string[]; // surfaced honestly into the brief itself
  ready: boolean; // true when a live handoff would be safe
  blockers: string[]; // reasons ready=false
};

const TAG = (source: string, tagType?: string): string =>
  tagType ? `[source: ${source} | type: ${tagType}]` : `[source: ${source}]`;

function truthLine(t: Truth): string {
  return `- ${t.text} ${TAG(t.source, t.tag_type)} (role: ${t.role}${t.thorpe_candidate ? "; thorpe-candidate" : ""})`;
}

function pickRelevantTruths(ws: WorkspaceForHandoff): Truth[] {
  if (!ws.truths) return [];
  if (!ws.relevance) return ws.truths.truths;
  const keep = new Set(
    ws.relevance.relevance
      .filter((r) => r.verdict === "relevant")
      .map((r) => r.truth_index),
  );
  return ws.truths.truths.filter((_, i) => keep.has(i));
}

/**
 * Derive the Strategic Objective (f2) from the human-selected frame in
 * Step 1 plus, when available, problem-shape hints from the diagnosis.
 * The value MUST match one of STRATEGIC_OBJECTIVE_OPTIONS so the select
 * in the Step 5 editor renders it as a pre-selected option (not empty).
 *
 * Mapping:
 *  - opportunity → Category Creation (default) | Repositioning (when the
 *    diagnosis reads as an established brand moving territory)
 *  - problem     → Defence (default) | Crisis Recovery (when the
 *    diagnosis reads as post-event / trust rebuild)
 *  - both        → Repositioning
 */
function deriveStrategicObjective(ws: WorkspaceForHandoff): string {
  const frame = (ws.selected_frame ?? "").toLowerCase();
  const shapes = (ws.diagnosis?.problem_shapes ?? []).join(" ").toLowerCase();
  const problemText = (ws.diagnosis?.real_problem.statement ?? "").toLowerCase();
  const oppText = (ws.diagnosis?.real_opportunity.statement ?? "").toLowerCase();
  const blob = `${shapes} ${problemText} ${oppText}`;

  const looksLikeRecovery = /crisis|scandal|trust|reputation|recover|backlash|fail(ed|ure)/.test(
    blob,
  );
  const looksLikeRepositioning = /reposition|shift|move|relevance|dated|established|legacy|lost/.test(
    blob,
  );

  if (frame === "both") return "Repositioning";
  if (frame === "opportunity") {
    return looksLikeRepositioning ? "Repositioning" : "Category Creation";
  }
  if (frame === "problem") {
    return looksLikeRecovery ? "Crisis Recovery" : "Defence";
  }
  return "";
}

function truthsByCategory(
  truths: Truth[],
  cat: Truth["category"],
): Truth[] {
  return truths.filter((t) => t.category === cat);
}

function joinTruths(ts: Truth[], fallback: string): string {
  if (ts.length === 0) return fallback;
  return ts.map(truthLine).join("\n");
}

export function buildHandoffPayload(ws: WorkspaceForHandoff): HandoffPayload {
  const warnings: string[] = [];
  const blockers: string[] = [];
  const gaps: string[] = [];

  if (!ws.diagnosis) blockers.push("Step 1 (Diagnosis) has not been run.");
  if (!ws.truths) blockers.push("Step 2 (Truths) has not been run.");
  if (!ws.relevance) blockers.push("Step 3 (Relevance) has not been run.");
  if (!ws.tensions) blockers.push("Step 4 (Tensions) has not been run.");
  if (ws.diagnosis && !ws.selected_frame)
    blockers.push("A frame (problem / opportunity / both) must be selected in Step 1.");

  const tensionSelected =
    ws.tensions &&
    !ws.tensions.no_tension_flag &&
    typeof ws.selected_tension_index === "number" &&
    ws.tensions.candidate_tensions[ws.selected_tension_index];

  if (ws.tensions && !ws.tensions.no_tension_flag && !tensionSelected)
    blockers.push("A candidate tension must be selected in Step 4.");

  // Honesty gaps — surfaced, not blocking.
  if (ws.truths?.missing_generative_qualitative_fact) {
    gaps.push(
      "No generative qualitative fact of Thorpe-level reframing potential was found in the supplied material.",
    );
  }
  for (const t of ws.truths?.missing_types ?? []) {
    gaps.push(`Missing truth-type: ${t} (no entries captured).`);
  }
  for (const g of ws.diagnosis?.gaps ?? []) gaps.push(`Step 1 gap: ${g}`);
  if (ws.tensions?.no_tension_flag) {
    gaps.push(
      `Step 4 no-tension flag: ${ws.tensions.no_tension_reason || "No genuine tension emerged from the supplied material."}`,
    );
    warnings.push(
      "Step 4 flagged NO GENUINE TENSION. Handing this off means Stage 1 will run without an anchored tension — the honesty flag is preserved in the brief, but the strategic yield will be weaker. Add stronger evidence and re-run before handoff for best results.",
    );
  }

  const relevantTruths = pickRelevantTruths(ws);
  const productTruths = truthsByCategory(relevantTruths, "product");
  const humanTruths = truthsByCategory(relevantTruths, "human");
  const culturalTruths = truthsByCategory(relevantTruths, "cultural");
  const brandTruths = truthsByCategory(relevantTruths, "brand");

  // ─── Anchor block (fenced, load-bearing) ─────────────────────────
  const anchorLines: string[] = [];
  anchorLines.push("=== BRIEFING ROOM STRATEGIC ANCHOR ===");
  anchorLines.push(
    "The following inputs have been diagnosed, filtered, and human-selected upstream. Stage 1 must treat these as fixed priority inputs (see system prompt).",
  );
  anchorLines.push("");
  if (ws.diagnosis) {
    anchorLines.push(`FRAME SELECTED: ${(ws.selected_frame ?? "unspecified").toUpperCase()}`);
    anchorLines.push(
      `REAL PROBLEM: ${ws.diagnosis.real_problem.statement} ${TAG(ws.diagnosis.real_problem.sources.join(", ") || "unspecified")}`,
    );
    anchorLines.push(
      `REAL OPPORTUNITY: ${ws.diagnosis.real_opportunity.statement} ${TAG(ws.diagnosis.real_opportunity.sources.join(", ") || "unspecified")}`,
    );
    anchorLines.push(
      `WHY WE ARE HERE: ${ws.diagnosis.why_are_we_here.statement} ${TAG(ws.diagnosis.why_are_we_here.sources.join(", ") || "unspecified")}`,
    );
    if (ws.diagnosis.problem_shapes.length)
      anchorLines.push(`PROBLEM SHAPE(S): ${ws.diagnosis.problem_shapes.join(", ")}`);
    anchorLines.push("");
  }
  if (tensionSelected) {
    const t = ws.tensions!.candidate_tensions[ws.selected_tension_index!];
    anchorLines.push(
      "ANCHORED TENSION (load-bearing — Stage 1 Section 2 MUST preserve this in a recognisable form; no substitution, no dilution):",
    );
    anchorLines.push(`  ${t.statement}`);
    anchorLines.push(`  Frame: ${t.frame} | Why it matters: ${t.why_it_matters}`);
    anchorLines.push("");
  } else if (ws.tensions?.no_tension_flag) {
    anchorLines.push("ANCHORED TENSION: NONE — Step 4 no-tension flag raised.");
    anchorLines.push(`  Reason: ${ws.tensions.no_tension_reason}`);
    anchorLines.push("");
  }
  if (gaps.length) {
    anchorLines.push("OPEN GAPS (preserve verbatim in Stage 1 assumption/flag block):");
    for (const g of gaps) anchorLines.push(`  - ${g}`);
    anchorLines.push("");
  }
  anchorLines.push("=== END BRIEFING ROOM STRATEGIC ANCHOR ===");
  const anchorBlock = anchorLines.join("\n");

  // ─── Field composition ───────────────────────────────────────────
  const b = emptyBriefFields();
  b.brandName = ws.brand_name;
  b.category = ws.category;
  b.briefTitle = ws.brand_name;
  b.date = new Date().toISOString().slice(0, 10);
  b.submittedBy = "Briefing Room";

  // f1 — Brand and Product/Service
  b.sections.f1_brand = ws.brand_name
    ? `${ws.brand_name} — see anchored context below. Category: ${ws.category || "(unspecified)"}.`
    : "(unspecified — Briefing Room intake missing brand statement)";

  // f2 — Strategic Objective — derived from the Step 1 frame selection.
  // Opportunity frame → new-territory objectives (Category Creation / Repositioning).
  // Problem frame → protective objectives (Crisis Recovery / Defence).
  // Both → Repositioning (moves brand across territories). Problem-shape
  // keywords nudge between the two options within each frame.
  b.sections.f2_objective = deriveStrategicObjective(ws);

  // f3 — Commercial Outcome (frame-anchored)
  if (ws.diagnosis) {
    const frame = ws.selected_frame ?? "unspecified";
    const framedStatement =
      frame === "opportunity"
        ? ws.diagnosis.real_opportunity.statement
        : frame === "both"
          ? `${ws.diagnosis.real_opportunity.statement} (opportunity) / ${ws.diagnosis.real_problem.statement} (problem)`
          : ws.diagnosis.real_problem.statement;
    b.sections.f3_outcome = `Frame: ${frame.toUpperCase()}. ${framedStatement} ${TAG("briefing_room")}\n\nEDIT BEFORE RUN: convert this into a specific twelve-month commercial outcome (revenue, trial rate, retention, reappraisal, share). The Briefing Room diagnoses the real problem/opportunity; you name the commercial test.`;
  }

  // f4 — Primary Barrier (real problem + ANCHORED TENSION preserved inline)
  const barrierParts: string[] = [];
  if (ws.diagnosis) {
    barrierParts.push(
      `REAL PROBLEM (Briefing Room diagnosis): ${ws.diagnosis.real_problem.statement} ${TAG(ws.diagnosis.real_problem.sources.join(", ") || "unspecified")}`,
    );
    if (ws.diagnosis.why_are_we_here.statement) {
      barrierParts.push(
        `CAUSAL READ: ${ws.diagnosis.why_are_we_here.statement} ${TAG(ws.diagnosis.why_are_we_here.sources.join(", ") || "unspecified")}`,
      );
    }
  }
  if (tensionSelected) {
    const t = ws.tensions!.candidate_tensions[ws.selected_tension_index!];
    barrierParts.push("");
    barrierParts.push(
      "LOAD-BEARING TENSION — PRESERVE VERBATIM (Stage 1 Section 2 must retain this tension; do not rewrite it into a different collision):",
    );
    barrierParts.push(`  "${t.statement}"`);
    barrierParts.push(`  Why it matters: ${t.why_it_matters}`);
  } else if (ws.tensions?.no_tension_flag) {
    barrierParts.push("");
    barrierParts.push(
      `NO-TENSION FLAG (from Briefing Room Step 4): ${ws.tensions.no_tension_reason}`,
    );
  }
  b.sections.f4_barrier =
    barrierParts.join("\n") ||
    "(Briefing Room did not diagnose a barrier — Steps 1 and 4 must run before handoff)";

  // f5 — What Has Already Been Tried (Briefing Room does not diagnose this)
  b.sections.f5_tried =
    "Not captured by Briefing Room. Add manually if relevant, or state 'nothing tried' honestly.";

  // f6 — Audience (from human truths)
  b.sections.f6_audience = joinTruths(
    humanTruths,
    "No human/behavioural truth captured — flag: audience section thin.",
  );

  // f7 — Current Belief (cultural + human, defensive read)
  const currentBeliefLines: string[] = [];
  if (culturalTruths.length)
    currentBeliefLines.push(...culturalTruths.map(truthLine));
  if (humanTruths.length && !culturalTruths.length)
    currentBeliefLines.push(...humanTruths.map(truthLine));
  if (currentBeliefLines.length === 0)
    currentBeliefLines.push(
      "No cultural or human truth captured to read as current belief — flag.",
    );
  b.sections.f7_current_belief = currentBeliefLines.join("\n");

  // f8 — Desired Belief (opportunity-anchored)
  if (ws.diagnosis) {
    b.sections.f8_desired_belief = `Anchored by Briefing Room opportunity frame: ${ws.diagnosis.real_opportunity.statement} ${TAG(ws.diagnosis.real_opportunity.sources.join(", ") || "unspecified")}\n\nEDIT BEFORE RUN: express as the belief the audience must hold after the strategy lands.`;
  }

  // f9 — Reason to Believe (product + brand truths)
  const rtb = [...productTruths, ...brandTruths];
  b.sections.f9_rtb = joinTruths(
    rtb,
    "No product or brand truth captured — flag: RTB section thin.",
  );

  // f10 — Competitive Provocation
  b.sections.f10_competitive =
    "Not captured by Briefing Room (Steps 1–4 do not produce competitive intelligence). Add competitor or category dynamic manually before run.";

  // f11 — Mandatories and Never-Says
  b.sections.f11_mandatories = "None captured by Briefing Room.";

  // ─── brief_text: anchor block THEN composed sections ─────────────
  const composed = composeBriefText(b);
  const briefText = `${anchorBlock}\n\n${composed}`;

  const ready = blockers.length === 0;

  return { briefFields: b, briefText, warnings, gaps, ready, blockers };
}
