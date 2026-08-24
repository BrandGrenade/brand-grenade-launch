// BRAND GRENADE — MASTER DETONATION BRIEF (canonical Minto template)
// ============================================================================
// Same ten-section structure as every other primary deliverable. Strategy
// slots come from the shared derivation; the creative slots come from the
// Stage 20 brief and its quality score.

import {
  callout,
  comparisonTable,
  renderMarkdown,
  pullQuote,
  reasonGrid,
  type CmpRow,
  type Reason,
} from "./doc-system";
import { buildMintoDocument } from "./minto";
import { DOCUMENT_SPECS } from "./document-spec";
import {
  buildAppendix,
  clean,
  deriveMintoContent,
  DETONATION_APPENDIX,
  type MintoSession,
} from "./minto-content";
import { parseBriefQualityScore, parseStage20Output } from "./phase2-shared";

const SCORE_DIMENSIONS: Array<[keyof ReturnType<typeof parseBriefQualityScore>, string]> = [
  ["emotional_clarity", "Emotional clarity"],
  ["fame_invitation", "Fame invitation"],
  ["distinctive_asset_integration", "Distinctive assets"],
  ["psychological_leverage", "Psychological leverage"],
  ["creative_sov_ambition", "Creative share of voice"],
];

export function buildMasterDetonationDocument(
  session: MintoSession,
  opts: { screen?: boolean } = {},
): string {
  const derived = deriveMintoContent(session, { appendix: { mode: "brief" } });
  const stage20 = clean(session.stage_20_output);
  const parsed = parseStage20Output(stage20);
  const score = parseBriefQualityScore(parsed.scoreBlock);
  const pick = (id: string) => parsed.sections.find((s) => s.id === id)?.content ?? "";

  const detonation = pick("detonation").trim();
  const smp = derived.smp || pick("smp").trim();

  /* 01 — the recommendation is the detonation itself. */
  const recommendation = detonation
    ? pullQuote(detonation.split("\n")[0].slice(0, 240), {
        label: "The detonation",
        variant: "hero",
      }) + renderMarkdown(detonation)
    : (derived.content.recommendation ?? "");

  /* 04 — proposition: SMP the brief is written against. */
  const proposition =
    (smp ? pullQuote(smp, { label: "Single-Minded Proposition" }) : "") +
    renderMarkdown(pick("smp")) +
    renderMarkdown(pick("response"));

  /* 05 — why this wins: three truths + compounding mechanism + courage. */
  const whyReasons: Reason[] = [];
  const truths = pick("three_truths").trim();
  if (truths) whyReasons.push({ title: "Built on the three truths", detail: truths.slice(0, 260) });
  const compounding = pick("compounding_mechanism").trim();
  if (compounding) whyReasons.push({ title: "It compounds", detail: compounding.slice(0, 260) });
  const courage = pick("courage_requirement").trim();
  if (courage) whyReasons.push({ title: "It requires courage", detail: courage.slice(0, 260) });
  const csv = (pick("csv_target") || pick("ambition")).trim();
  if (csv) whyReasons.push({ title: "Creative share of voice", detail: csv.slice(0, 260) });
  const why_this_wins = whyReasons.length
    ? reasonGrid(whyReasons)
    : (derived.content.why_this_wins ?? "");

  /* 06 — validation: brief quality score, as a table. */
  const scoreRows: CmpRow[] = SCORE_DIMENSIONS.filter(([k]) => score[k] != null).map(
    ([k, label]) => ({
      cells: { dimension: label, score: `${score[k]}/10` },
    }),
  );
  if (score.composite != null) {
    scoreRows.push({
      win: true,
      cells: { dimension: "Composite", score: `${score.composite}/50` },
    });
  }
  const validation =
    (scoreRows.length
      ? comparisonTable(
          [
            { key: "dimension", label: "Dimension" },
            { key: "score", label: "Score", numeric: true },
          ],
          scoreRows,
          `Brief quality score — ${score.status ?? "REVIEW"}`,
        )
      : "") + (derived.content.validation ?? "");

  /* 07 — rejected: what the work must never do, plus the strategy rejections. */
  const neverDo = pick("never_do").trim();
  const rejected =
    (neverDo ? callout("What the work must never do", renderMarkdown(neverDo)) : "") +
    (derived.content.rejected ?? "");

  /* 08 — implications: audience, cultural context, system principles. */
  const implications =
    derived.lockedIdeaHtml +
    ([pick("audience"), pick("cultural_context"), pick("system_principles")]
      .filter((s) => s.trim())
      .map((s) => renderMarkdown(s))
      .join("") ||
      (derived.content.implications ?? "")) +
    ((session.stage_22_brand_architecture ?? "").trim()
      ? callout(
          "Current brand architecture",
          renderMarkdown((session.stage_22_brand_architecture ?? "").slice(0, 1400)),
        )
      : "") +
    ((session.stage_22_distinctive_assets ?? "").trim()
      ? callout(
          "Current distinctive assets",
          renderMarkdown((session.stage_22_distinctive_assets ?? "").slice(0, 1000)),
        )
      : "");

  /* 10 — appendix: the Phase 2 record, then the strategy evidence. */
  const appendix =
    buildAppendix(session, { sections: DETONATION_APPENDIX, mode: "condensed" }) +
    (derived.content.appendix ?? "");

  return buildMintoDocument({
    canonical: DOCUMENT_SPECS.master_detonation,
    title: `Master Detonation Brief — ${derived.brand}`,
    screen: opts.screen,
    cover: {
      brand: "BRAND GRENADE",
      label: "Master Detonation Brief",
      title: `${derived.brand} — Master Detonation Brief`,
      subtitle: derived.category || undefined,
      confidential: true,
    },
    headlineStats: [
      ...(score.composite != null
        ? [
            {
              value: score.composite,
              suffix: "/50",
              label: "Brief quality score",
              note: `Status: ${score.status ?? "REVIEW"}.`,
            },
          ]
        : []),
      ...derived.headlineStats.slice(0, 2),
    ],
    content: {
      recommendation,
      business_issue: derived.content.business_issue,
      key_insight: derived.content.key_insight,
      proposition,
      why_this_wins,
      validation,
      rejected,
      implications,
      next_step: derived.content.next_step,
      appendix,
    },
    footerHtml:
      `Brand Grenade Strategy Intelligence System — Confidential. ` +
      `Master Detonation Brief for ${derived.brand}. Review before commercial deployment.`,
  });
}
