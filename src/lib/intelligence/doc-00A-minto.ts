// BRAND GRENADE — DOCUMENT 00A (canonical Minto template, HTML/PDF)
// ============================================================================
// Strategic Territory Intelligence Report rendered against the same ten-section
// structure as every other primary deliverable. Source is the stored
// Intelligence Lab report JSON — nothing is generated here.
//
// This is the only 00A renderer. The legacy jsPDF path has been retired so a
// non-canonical render can never be served again.

import {
  callout,
  comparisonTable,
  escapeHtml,
  inlineMd,
  pullQuote,
  reasonGrid,
  type CmpRow,
  type Reason,
  type Stat,
} from "../doc-system";
import { buildMintoDocument, type MintoContent } from "../minto";
import type { Document00AInput, IntelligenceReport } from "./doc-00A-types";
export type { Document00AInput, IntelligenceReport } from "./doc-00A-types";

type Loose = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : [];
const obj = (v: unknown): Loose => (v && typeof v === "object" ? (v as Loose) : {});

function paras(text: string): string {
  if (!text) return "";
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${inlineMd(p)}</p>`)
    .join("");
}

function list(items: string[]): string {
  if (!items.length) return "";
  return `<ul>${items.map((i) => `<li>${inlineMd(i)}</li>`).join("")}</ul>`;
}

const VERDICT_LABEL: Record<string, string> = {
  claim: "CLAIM",
  do_not_claim: "DO NOT CLAIM",
  claim_with_conditions: "CLAIM WITH CONDITIONS",
};

export function buildDocument00AMinto(
  input: Document00AInput,
  opts: { screen?: boolean } = {},
): string {
  const report = (input.report ?? {}) as IntelligenceReport & Loose;
  const territories = Array.isArray(report.territories)
    ? (report.territories as unknown as Loose[])
    : [];
  const primary =
    territories.find((t) => str(t.id) === str(report.recommended_primary_territory_id)) ??
    territories[0] ??
    null;
  const others = territories.filter((t) => t !== primary);
  const completeness = obj(report.completeness_assessment);
  const gov = obj(report.government_addendum);

  const primaryName = primary ? str(primary.name) || "Recommended territory" : "";
  const verdict = primary ? (VERDICT_LABEL[str(primary.strategic_recommendation)] ?? "") : "";

  /* 01 — recommendation */
  const recommendation =
    (primaryName
      ? pullQuote(verdict ? `${primaryName} — ${verdict}` : primaryName, {
          label: "Recommended territory",
          variant: "hero",
        })
      : "") + paras(str(primary?.recommendation_rationale));

  const permission = obj(primary?.brand_permission);
  const firstMover = obj(primary?.first_mover);
  const headlineStats: Stat[] = [];
  if (typeof permission.score === "number") {
    headlineStats.push({
      value: permission.score,
      suffix: "/10",
      label: "Brand permission",
      note: "Right to occupy the territory.",
    });
  }
  if (typeof firstMover.score === "number") {
    headlineStats.push({
      value: firstMover.score,
      suffix: "/10",
      label: "First-mover advantage",
      note: str(firstMover.window_duration) || undefined,
    });
  }
  if (territories.length) {
    headlineStats.push({
      value: territories.length,
      label: "Territories assessed",
      note: `Confidence: ${str(completeness.confidence) || "not stated"}.`,
    });
  }

  /* 02 — business issue */
  const business_issue =
    paras(str(report.executive_summary)) ||
    paras(str(obj(primary?.prebrief_for_briefing_room).tension));

  /* 03 — key insight */
  const whiteSpace = obj(primary?.white_space);
  const wsRows: CmpRow[] = (["perceptual", "emotional", "cultural", "motivational"] as const)
    .map((k) => ({ k, cell: obj(whiteSpace[k]) }))
    .filter((r) => str(r.cell.assessment))
    .map((r) => ({
      cells: {
        dimension: r.k.charAt(0).toUpperCase() + r.k.slice(1),
        assessment: str(r.cell.assessment),
        evidence: str(r.cell.evidence),
      },
    }));
  const tension = str(obj(primary?.prebrief_for_briefing_room).tension);
  const key_insight =
    (tension ? pullQuote(tension, { label: "The governing tension", variant: "quiet" }) : "") +
    comparisonTable(
      [
        { key: "dimension", label: "White space" },
        { key: "assessment", label: "Assessment" },
        { key: "evidence", label: "Evidence" },
      ],
      wsRows,
      wsRows.length ? "White space assessment for the recommended territory" : undefined,
    );

  /* 04 — proposition (the territory itself) */
  const prebrief = obj(primary?.prebrief_for_briefing_room);
  const proposition =
    (primaryName ? pullQuote(primaryName, { label: "Strategic territory" }) : "") +
    paras(str(primary?.description)) +
    (str(prebrief.strategic_anchor)
      ? callout("Strategic anchor", paras(str(prebrief.strategic_anchor)))
      : "") +
    (str(prebrief.creative_territory_direction)
      ? callout("Creative direction", paras(str(prebrief.creative_territory_direction)))
      : "");

  /* 05 — why this wins */
  const whyReasons: Reason[] = [];
  if (str(permission.rationale)) {
    whyReasons.push({
      title: "Brand has permission",
      detail: str(permission.rationale).slice(0, 260),
    });
  }
  if (str(firstMover.competitive_response_scenario)) {
    whyReasons.push({
      title: "First-mover window",
      detail: `${str(firstMover.window_duration)} ${str(firstMover.competitive_response_scenario)}`
        .trim()
        .slice(0, 260),
    });
  }
  const hist = obj(primary?.historical_validation);
  if (str(hist.risk_rationale)) {
    whyReasons.push({
      title: `Risk classified ${str(hist.risk_classification) || "assessed"}`,
      detail: str(hist.risk_rationale).slice(0, 260),
    });
  }
  const cult = obj(primary?.cultural_adaptation);
  if (str(cult.resonance_overall)) {
    whyReasons.push({
      title: `Cultural resonance ${str(cult.resonance_overall)}`,
      detail: str(cult.adaptation_requirement).slice(0, 260) || undefined,
    });
  }
  const why_this_wins = reasonGrid(whyReasons);

  /* 06 — validation summary */
  const validationRows: CmpRow[] = territories.map((t) => {
    const p = obj(t.brand_permission);
    const f = obj(t.first_mover);
    const h = obj(t.historical_validation);
    return {
      win: t === primary,
      cells: {
        name: str(t.name),
        type: str(t.type).replace(/_/g, " "),
        permission: typeof p.score === "number" ? p.score : null,
        firstMover: typeof f.score === "number" ? f.score : null,
        risk: str(h.risk_classification).replace(/_/g, " "),
        verdict: VERDICT_LABEL[str(t.strategic_recommendation)] ?? "",
      },
    };
  });
  const precedents = [
    ...arr(
      (obj(primary?.historical_validation).commercial_precedents as unknown[] | undefined)?.map(
        (c) => `${str(obj(c).case_description)} — ${str(obj(c).outcome)}`,
      ) ?? [],
    ),
  ].slice(0, 4);
  const validation =
    comparisonTable(
      [
        { key: "name", label: "Territory" },
        { key: "type", label: "Type" },
        { key: "permission", label: "Permission", numeric: true },
        { key: "firstMover", label: "First mover", numeric: true },
        { key: "risk", label: "Risk" },
        { key: "verdict", label: "Verdict" },
      ],
      validationRows,
      "Territories assessed — highlighted row is the recommendation",
    ) + (precedents.length ? callout("Historical precedent", list(precedents)) : "");

  /* 07 — rejected */
  const rejected = reasonGrid(
    others.slice(0, 4).map((t) => ({
      title: str(t.name) || "Unnamed territory",
      detail:
        str(t.recommendation_rationale).slice(0, 240) ||
        `${VERDICT_LABEL[str(t.strategic_recommendation)] ?? "Not carried forward"}.`,
    })),
  );

  /* 08 — implications */
  const measurement = obj(primary?.measurement_framework);
  const behaviour = obj(measurement.behaviour_change_metrics);
  const implications =
    list(arr(measurement.brand_associations_to_track).slice(0, 5)) +
    (arr(behaviour.immediate_0_4_weeks).length
      ? callout("Immediate (0–4 weeks)", list(arr(behaviour.immediate_0_4_weeks)))
      : "") +
    (arr(behaviour.medium_term_12_24_months).length
      ? callout("Medium term (12–24 months)", list(arr(behaviour.medium_term_12_24_months)))
      : "") +
    (arr(measurement.early_warning_signals).length
      ? callout("Early warning signals", list(arr(measurement.early_warning_signals)))
      : "") +
    (str(gov.institutional_trust_assessment)
      ? callout("Institutional trust", paras(str(gov.institutional_trust_assessment)))
      : "");

  /* 09 — next step */
  const conditions = arr(primary?.conditions);
  const next_step =
    (primaryName
      ? `<p>The decision requested is to ${verdict === "DO NOT CLAIM" ? "reject" : "adopt"} <strong>${escapeHtml(
          primaryName,
        )}</strong> as the strategic territory for ${escapeHtml(input.brandName)} and release it into the Briefing Room.</p>`
      : "") +
    (conditions.length ? callout("Conditions on claiming", list(conditions)) : "") +
    (arr(prebrief.must_include).length
      ? callout("Must include", list(arr(prebrief.must_include)))
      : "") +
    (arr(prebrief.must_avoid).length ? callout("Must avoid", list(arr(prebrief.must_avoid))) : "");

  /* 10 — appendix */
  const appendix =
    callout(
      "Intelligence source snapshot",
      `<p>Generated from Intelligence run ${escapeHtml(input.sourceRunId?.slice(0, 8) || "not recorded")}${input.completedAt ? `, completed ${escapeHtml(new Date(input.completedAt).toLocaleString("en-AU"))}` : ""}. This report is a historical research snapshot, not a live join to a strategy session.</p>`,
    ) +
    (arr(completeness.inputs_present).length
      ? callout("Inputs present", list(arr(completeness.inputs_present)))
      : "") +
    (arr(completeness.inputs_absent).length
      ? callout("Inputs absent", list(arr(completeness.inputs_absent)))
      : "") +
    (arr(completeness.gap_impact_notes).length
      ? callout("Gap impact", list(arr(completeness.gap_impact_notes)))
      : "") +
    others
      .map((t) => {
        const body = paras(str(t.description)) + paras(str(t.recommendation_rationale));
        if (!body) return "";
        return `<div class="section keep-together"><p class="kicker">${escapeHtml(
          str(t.name) || "Territory",
        )}</p>${body}</div>`;
      })
      .join("");

  const content: MintoContent = {
    recommendation,
    business_issue,
    key_insight,
    proposition,
    why_this_wins,
    validation,
    rejected,
    implications,
    next_step,
    appendix,
  };

  return buildMintoDocument({
    title: `Strategic Territory Intelligence Report — ${input.brandName}`,
    screen: opts.screen,
    cover: {
      brand: "BRAND GRENADE",
      label: "Document 00A — Strategic Territory Intelligence",
      title: `${input.brandName} — Strategic Territory Intelligence Report`,
      subtitle: input.category || undefined,
      confidential: true,
    },
    headlineStats,
    content,
    footerHtml:
      `Brand Grenade Intelligence Lab — Confidential. ` +
      `${input.briefType === "government" ? "Government" : "Commercial"} brief for ${escapeHtml(
        input.brandName,
      )}. Review before commercial deployment.`,
  });
}


/** Opens Document 00A in a new tab using the shared canonical template. */
export function openDocument00AMinto(input: Document00AInput): void {
  const html = buildDocument00AMinto(input);
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow popups to open your document.");
    return;
  }
  win.document.open("text/html");
  win.document.write(html);
  win.document.close();
}
