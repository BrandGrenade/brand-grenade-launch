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
import { NO_COMPARATIVE_RATIONALE, SYSTEM_TOKEN_MAP } from "../document-standard";
import { DOCUMENT_SPECS } from "../document-spec";
import { buildCurrentStateSection } from "../current-state";

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

/**
 * Every value read out of the report JSON that could be an internal enum goes
 * through here before it reaches prose. The shared registry owns the wording.
 */
function human(v: unknown): string {
  const s = str(v);
  if (!s) return "";
  if (!/^[a-z0-9]+(?:_[a-z0-9]+)+$/i.test(s)) return s;
  const mapped = SYSTEM_TOKEN_MAP[s.toLowerCase()];
  if (mapped) return mapped;
  const words = s.toLowerCase().split("_").filter(Boolean).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Clamps at a sentence boundary so a detail never ends mid-word. */
function clamp(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "), cut.lastIndexOf("! "));
  if (stop > max * 0.4) return cut.slice(0, stop + 1).trim();
  return cut.replace(/\s+\S*$/, "").trim() + "…";
}

const score = (v: unknown): number | null => (typeof v === "number" ? v : null);


export function buildDocument00AMinto(
  input: Document00AInput,
  opts: { screen?: boolean } = {},
): string {
  const report = (input.report ?? {}) as IntelligenceReport & Loose;
  const territories = Array.isArray(report.territories)
    ? (report.territories as unknown as Loose[])
    : [];
  const primary =
    territories.find((t) => str(t.id) === str(report.recommended_primary_territory_id)) ?? null;
  const others = territories.filter((t) => t !== primary);
  const completeness = obj(report.completeness_assessment);
  const gov = obj(report.government_addendum);

  const primaryName = primary ? str(primary.name) || "Recommended territory" : "";
  const verdict = primary ? (VERDICT_LABEL[str(primary.strategic_recommendation)] ?? "") : "";

  /* 01 — recommendation */
  const recommendation =
    (primaryName
      ? pullQuote(primaryName, {
          label: "Recommended territory",
          variant: "hero",
          // The verdict is a qualifying status, not part of the territory's
          // name — it is demoted to caption type beneath the headline.
          caption: verdict ? `Verdict — ${verdict}` : undefined,
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
      // The window is a modelled estimate, not an observed fact. It is
      // caveated here exactly as it is caveated in the companion documents —
      // stating it with full confidence in one document and as unverified in
      // another is the contradiction this line exists to prevent.
      note: str(firstMover.window_duration)
        ? `${str(firstMover.window_duration)} — modelled estimate, not independently verified.`
        : undefined,
    });
  }

  if (territories.length) {
    headlineStats.push({
      value: territories.length,
      label: "Territories assessed",
      note: `Confidence: ${str(completeness.confidence) || "not stated"}.`,
    });
  }

  /* 02 — background and context */
  const background =
    `<p>This is <strong>Document 00A — Strategic Territory Intelligence Report</strong> for ${escapeHtml(
      input.brandName,
    )}${input.category ? `, ${escapeHtml(input.category)}` : ""}. It was generated by the Brand Grenade Intelligence Lab from research run ${escapeHtml(
      input.sourceRunId?.slice(0, 8) || "not recorded",
    )}${input.completedAt ? `, completed ${escapeHtml(new Date(input.completedAt).toLocaleString("en-AU"))}` : ""}, and reproduces only what that run produced.</p>` +
    `<p>${territories.length} strategic territor${territories.length === 1 ? "y was" : "ies were"} assessed against brand permission, first-mover advantage, historical validation and cultural fit. This is a ${input.briefType === "government" ? "government" : "commercial"} brief and a research snapshot — it is not a live join to a strategy session.</p>` +
    `<p>It serves one decision: which territory, if any, ${escapeHtml(
      input.brandName,
    )} should claim and take into the Briefing Room.</p>`;

  /* 03 — business issue */
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
      detail: clamp(str(permission.rationale), 320),
    });
  }
  if (str(firstMover.competitive_response_scenario) || str(firstMover.window_duration)) {
    const window = str(firstMover.window_duration);
    const scenario = human(firstMover.competitive_response_scenario);
    whyReasons.push({
      title: "First-mover window",
      // The caveat is appended after clamping, never inside it: the window
      // text is often a full sentence, so a caveat placed in the body was the
      // first thing the clamp removed — leaving the estimate stated with
      // full confidence here while the companion documents caveat it.
      detail:
        clamp(
          [
            window ? `Open for an estimated ${window}` : "",
            scenario ? `Likely competitive response: ${scenario.toLowerCase()}.` : "",
          ]
            .filter(Boolean)
            .join(" "),
          300,
        ) + (window ? " The window is a modelled estimate, not independently verified." : ""),
    });

  }
  const hist = obj(primary?.historical_validation);
  if (str(hist.risk_rationale)) {
    whyReasons.push({
      title: `Risk classified ${human(hist.risk_classification).toLowerCase() || "assessed"}`,
      detail: clamp(str(hist.risk_rationale), 320),
    });
  }

  const cult = obj(primary?.cultural_adaptation);
  if (str(cult.resonance_overall)) {
    // Bug fix: this column previously mapped straight to
    // `adaptation_requirement`, which is frequently a bare scale word such as
    // "minor" — a requirement level, not a cultural resonance summary. Build a
    // genuine summary from the per-context ratings, CALD mapping and risk
    // flags, and only fall back to the adaptation requirement when it carries
    // real prose (and then label it as what it is).
    const contexts = Array.isArray(cult.resonance_by_context) ? cult.resonance_by_context : [];
    const contextLine = contexts
      .map((c) => {
        const ctx = str(c?.context);
        const rating = human(c?.rating).toLowerCase();
        const notes = str(c?.notes);
        if (!ctx) return notes;
        const head = rating ? `${ctx}: ${rating}` : ctx;
        return notes ? `${head} — ${notes}` : head;
      })
      .filter(Boolean)
      .join(" ");

    const cald = obj(cult.cald_mapping);
    const caldCommunities = Array.isArray(cald.communities) ? cald.communities : [];
    const caldLine = caldCommunities
      .map((c) => {
        const name = str(c?.community);
        const res = str(c?.resonance);
        if (!name) return res;
        return res ? `${name}: ${res}` : name;
      })
      .filter(Boolean)
      .join("; ");

    const flags = (Array.isArray(cult.cultural_risk_flags) ? cult.cultural_risk_flags : [])
      .map((f) => str(f))
      .filter(Boolean);

    const requirementRaw = str(cult.adaptation_requirement);
    // A requirement value is only usable prose if it reads as a sentence, not
    // as a scale label ("minor", "none", "moderate", "significant").
    const requirementIsProse = requirementRaw.split(/\s+/).length > 4;
    const requirementLine = requirementRaw
      ? requirementIsProse
        ? requirementRaw
        : `Adaptation requirement: ${human(requirementRaw).toLowerCase()}.`
      : "";

    const detail =
      [
        contextLine,
        caldLine ? `Community resonance — ${caldLine}.` : "",
        flags.length ? `Watch-outs: ${flags.join("; ")}.` : "",
        requirementLine,
      ]
        .filter(Boolean)
        .join(" ") || "";

    whyReasons.push({
      title: `Cultural resonance ${human(cult.resonance_overall).toLowerCase()}`,
      detail: clamp(detail, 320) || undefined,
    });
  }

  // Never let this section fall through to the template's "not available"
  // line: if no structured reason survived, state the territory's own
  // rationale instead.
  if (!whyReasons.length) {
    const perm = obj(primary?.brand_permission);
    const detail =
      str(perm.rationale) ||
      str(primary?.strategic_rationale) ||
      str(primary?.description) ||
      str(primary?.why_it_matters);
    if (detail) {
      whyReasons.push({
        title: str(primary?.name) ? `Why ${str(primary?.name)}` : "Why this territory",
        detail: clamp(detail, 360),
      });
    }
  }

  const why_this_wins = whyReasons.length ? reasonGrid(whyReasons) : "";

  /* 07 — current state versus recommended change. Existing activity is quoted
   * from the ingested research corpus for this session and attributed; the
   * asks are the recommendation's own conditions, pre-brief inclusions and
   * immediate behaviour-change measures. Nothing is inferred beyond that. */
  const behaviourNow = obj(obj(primary?.measurement_framework).behaviour_change_metrics);
  const current_state = buildCurrentStateSection({
    brand: input.brandName,
    evidence: (input.research ?? []).filter((r) => r && r.text && r.text.trim()),
    proposedActions: [
      ...arr(primary?.conditions),
      ...arr(obj(primary?.prebrief_for_briefing_room).must_include),
      ...arr(behaviourNow.immediate_0_4_weeks),
    ].slice(0, 10),
  });

  /* 08 — validation summary */
  const validationRows: CmpRow[] = territories.map((t) => {
    const p = obj(t.brand_permission);
    const f = obj(t.first_mover);
    const h = obj(t.historical_validation);
    return {
      win: t === primary,
      cells: {
        name: str(t.name),
        type: human(t.type),
        permission: typeof p.score === "number" ? p.score : null,
        firstMover: typeof f.score === "number" ? f.score : null,
        risk: human(h.risk_classification),

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

  /* 07 — options not carried forward. A territory's own verdict label is
   * never used as the reason it was not chosen: either a real rationale
   * exists, or a genuine comparative line is derived from the scores, or the
   * document says plainly that no rationale was recorded. */
  const primaryPermission = score(obj(primary?.brand_permission).score);
  const primaryFirstMover = score(obj(firstMover).score);
  function notCarriedDetail(t: Loose): string {
    const stated = str(t.recommendation_rationale);
    if (stated) return clamp(stated, 360);
    const p = score(obj(t.brand_permission).score);
    const f = score(obj(t.first_mover).score);
    const parts: string[] = [];
    if (p != null && primaryPermission != null && p < primaryPermission) {
      parts.push(`brand permission ${p}/10 against ${primaryPermission}/10 for the recommendation`);
    }
    if (f != null && primaryFirstMover != null && f < primaryFirstMover) {
      parts.push(`first-mover advantage ${f}/10 against ${primaryFirstMover}/10`);
    }
    if (parts.length) return `Scored lower on ${parts.join(" and ")}.`;
    return NO_COMPARATIVE_RATIONALE;
  }
  const rejected = reasonGrid(
    others.slice(0, 4).map((t) => ({
      title: str(t.name) || "Unnamed territory",
      detail: notCarriedDetail(t),
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

  /* 09 — next step.
   * The conditions on claiming and the required inclusions are stated once,
   * in section 07, where each is classified against what the research shows
   * is already happening. Repeating them verbatim here duplicated five
   * paragraphs and failed content integrity, so this section points to them
   * rather than restating them. */
  const conditions = arr(primary?.conditions);
  const mustInclude = arr(prebrief.must_include);
  const crossRef =
    conditions.length || mustInclude.length
      ? `<p>${
          conditions.length
            ? `${conditions.length} condition${conditions.length === 1 ? "" : "s"} govern${
                conditions.length === 1 ? "s" : ""
              } this claim`
            : ""
        }${conditions.length && mustInclude.length ? ", and " : ""}${
          mustInclude.length
            ? `${mustInclude.length} inclusion${mustInclude.length === 1 ? "" : "s"} ${
                mustInclude.length === 1 ? "is" : "are"
              } required of the work`
            : ""
        }. Each is set out in section 07, alongside whether it is already happening today, currently implicit, or a genuinely new commitment.</p>`
      : "";
  const next_step =
    (primaryName
      ? `<p>The decision requested is to ${verdict === "DO NOT CLAIM" ? "reject" : "adopt"} <strong>${escapeHtml(
          primaryName,
        )}</strong> as the strategic territory for ${escapeHtml(input.brandName)} and release it into the Briefing Room.</p>`
      : "") +
    crossRef +
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
    background,
    business_issue,

    key_insight,
    proposition,
    why_this_wins,
    current_state,
    validation,
    rejected,
    implications,
    next_step,
    appendix,
  };

  return buildMintoDocument({
    title: `Strategic Territory Intelligence Report — ${input.brandName}`,
    screen: opts.screen,
    canonical: DOCUMENT_SPECS.intelligence_00a,
    purpose: {
      what: "Strategic Territory Intelligence Report",
      source: `Intelligence Lab run ${input.sourceRunId?.slice(0, 8) || "not recorded"}`,
      decision: "which strategic territory to claim and take into the Briefing Room",
    },

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
