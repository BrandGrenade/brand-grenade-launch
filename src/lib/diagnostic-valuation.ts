import { Stage9Schema, Stage10Schema, Stage11Schema, Stage13Schema, Stage10CurrentPositionSchema, Stage11CurrentPositionSchema, Stage13CurrentPositionSchema } from "./structured-output";
import { VALUATION_DISCLAIMER, VALUATION_READER_GUIDE, DOCUMENT_FOOTER } from "./valuation-front-matter";

type Run = {
  brand_name: string; category: string; selected_smp?: string | null;
  stage_9_structured?: unknown; stage_10_structured?: unknown;
  stage_11_structured?: unknown; stage_13_structured?: unknown;
};
const dimensions = [
  ["fame", "Fame"], ["truth_strength", "Truth Strength"],
  ["competitive_impossibility", "Competitive Impossibility"], ["brand_permission", "Brand Permission"],
  ["clean_air", "Clean Air"], ["commercial_precedent", "Commercial Precedent"],
] as const;
const credibilityNames: Record<string, string> = {
  product_truth_alignment: "Product Truth Alignment", audience_permission: "Audience Permission",
  tonal_compatibility: "Tonal Compatibility", behavioural_capacity: "Behavioural Capacity",
  cultural_authority: "Cultural Authority", historical_consistency: "Historical Consistency",
};
const testNames = ["Factual Falsity", "Logical Incoherence", "Permission Failure", "Forbidden Zone", "Competitive Counter-Vulnerability", "Time Decay", "Interpretation Drift", "Iconic Tier Sustainability"];
const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const baseline = (v: unknown) => object(v).current_position;
function missing(v: unknown): string {
  const cp = object(v);
  return `**Current position: not scored / missing.** ${typeof cp.reason === "string" ? cp.reason : "No valid scored current-position record was produced."}`;
}
const label = (cp: { line: string; evidence_label: string; source: string | null; source_date: string | null }) =>
  `**Current brand position:** ${cp.line}\n\n**Evidence:** ${cp.evidence_label}; source: ${cp.source ?? "not recorded"}; date: ${cp.source_date ?? "not recorded"}.`;
const candidateLabel = "**proposition under test — not current brand strength**";
function scores(row: Record<string, unknown>): string {
  const lines = dimensions.map(([key, name]) => {
    const d = object(row[key]);
    return `- **${name}: ${d.score}/10.** ${d.justification}`;
  });
  if (typeof row.composite === "number") lines.push(`\n**Composite: ${row.composite}/90.** Proposition verdict: ${row.code_verdict ?? "not recorded"}.`);
  return lines.join("\n");
}
function pressure(row: Record<string, unknown>): string {
  const tests = object(row.tests);
  return testNames.flatMap((name, i) => {
    const key = `T${i + 1}`, t = object(tests[key]);
    if (key === "T8" && !row.iconic_tier) return [];
    return [`- **${key} — ${name}: ${t.result ?? "missing"}.** ${t.rationale ?? "Result not recorded."}${key === "T5" ? ` Counter-line: ${t.counter_line}; classification: ${t.classification}.` : ""}${key === "T7" ? ` Misreading: ${t.misreading}; guard-rail: ${t.guard_rail}.` : ""}`];
  }).concat([
    `\n**Proposition verdict (separate): ${row.verdict}.**`,
    `Iconic final status: ${row.iconic_final}.`,
    ...["exposure_note", "strategic_note"].flatMap((k) => typeof row[k] === "string" ? [String(row[k])] : []),
  ]).join("\n");
}
function credibility(row: Record<string, unknown>): string {
  return Object.entries(object(row.credibility)).map(([k, v]) => {
    const d = object(v);
    return `- **${credibilityNames[k] ?? k}: ${d.score}/10.** ${d.justification}`;
  }).concat([`\n**Most vulnerable:** ${credibilityNames[String(row.most_vulnerable)] ?? row.most_vulnerable}.`]).join("\n");
}

/** Pure, structured-only assembly. No model, text-stage fallback, selection or scoring. */
export function buildDiagnosticValuation(run: Run): string {
  const s9 = Stage9Schema.safeParse(run.stage_9_structured);
  const s10 = Stage10Schema.safeParse(run.stage_10_structured);
  const s11 = Stage11Schema.safeParse(run.stage_11_structured);
  const s13 = Stage13Schema.safeParse(run.stage_13_structured);
  const cp10raw = baseline(run.stage_10_structured), cp11raw = baseline(run.stage_11_structured), cp13raw = baseline(run.stage_13_structured);
  const cp10 = Stage10CurrentPositionSchema.safeParse(cp10raw);
  const cp11 = Stage11CurrentPositionSchema.safeParse(cp11raw);
  const cp13 = Stage13CurrentPositionSchema.safeParse(cp13raw);
  const selected = run.selected_smp?.trim();
  const same = (smp: string) => !!selected && smp.trim() === selected;
  const p9 = s9.success ? s9.data.propositions.find((p) => same(p.smp)) : undefined;
  const p10 = s10.success ? s10.data.scores.find((p) => same(p.smp)) : undefined;
  const p10stored = p10 ? object((object(run.stage_10_structured).scores as unknown[]).find((p) => object(p).smp === p10.smp)) : undefined;
  const p11 = s11.success ? s11.data.blocks.find((p) => same(p.smp)) : undefined;
  const candidate = `${candidateLabel}\n\n${selected ?? "No proposition under test recorded."}`;
  const strength = cp10.success ? `${label(cp10.data)}\n\n${scores(cp10.data)}` : missing(cp10raw);
  const defensibility = p9
    ? `${candidate}\n\nTerritory: ${p9.foundation.territory}\n\nTruth: ${p9.foundation.truth}\n\nReinterpretation: ${p9.foundation.reinterpretation}\n\n${p9.impossibility.map((i) => `- **${i.competitor}:** ${i.why_they_cannot}`).join("\n")}\n\n${p9.creative_function.class}: ${p9.creative_function.rationale}`
    : `${candidate}\n\nStructured distinctiveness record for the proposition under test is missing. No current-position defensibility assessment was produced.`;
  const durability = `${cp11.success ? `${label(cp11.data)}\n\n${pressure(cp11.data)}` : missing(cp11raw)}\n\n${candidate}\n\n${p11 ? pressure(p11) : "Structured pressure-test record for the proposition under test is missing."}`;
  const fit = `${cp13.success ? `${label(cp13.data)}\n\n${credibility(cp13.data)}` : missing(cp13raw)}\n\n${candidate}\n\n${s13.success && selected ? `${credibility(s13.data)}\n\n**Proposition verdict: ${s13.data.verdict}.** ${s13.data.verdict_reason}` : "Structured brand-fit record for the proposition under test is missing."}`;
  const exposures = (row: Record<string, unknown>) => dimensions.flatMap(([k, name]) => {
    const d = object(row[k]);
    return typeof d.score === "number" && d.score <= 5 ? [`- ${name}: ${d.score}/10. ${d.justification}`] : [];
  }).join("\n") || "No dimensions at or below 5/10 were recorded.";
  const conditions = `${cp10.success ? `${label(cp10.data)}\n\n${exposures(cp10.data)}` : missing(cp10raw)}\n\n${cp11.success ? pressure(cp11.data) : missing(cp11raw)}\n\n${cp13.success ? credibility(cp13.data) : missing(cp13raw)}\n\n${candidate}\n\n${p10stored ? exposures(p10stored) : "Structured scoring record for the proposition under test is missing."}\n\n${s13.success && selected ? [...s13.data.section5.items.map((i) => `- ${i.text}`), ...s13.data.commitments.map((c) => `- ${c}`)].join("\n") : "Structured operational conditions for the proposition under test are missing."}`;
  const appendix = [
    `## Current brand position — Stage 10, Proposition Scoring\n\n${strength}`,
    `## Current brand position — Stage 11, Integrity Testing\n\n${cp11.success ? `${label(cp11.data)}\n\n${pressure(cp11.data)}` : missing(cp11raw)}`,
    `## Current brand position — Stage 13, Brand Fit Validation\n\n${cp13.success ? `${label(cp13.data)}\n\n${credibility(cp13.data)}` : missing(cp13raw)}`,
    `## Proposition under test — Stage 9, Distinctiveness Check\n\n${defensibility}`,
    `## Proposition under test — Stage 10, Proposition Scoring\n\n${candidate}\n\n${p10stored ? scores(p10stored) : "Structured scoring record is missing."}`,
    `## Proposition under test — Stage 11, Integrity Testing\n\n${candidate}\n\n${p11 ? pressure(p11) : "Structured pressure-test record is missing."}`,
    `## Proposition under test — Stage 13, Brand Fit Validation\n\n${candidate}\n\n${s13.success && selected ? `${credibility(s13.data)}\n\n${s13.data.verdict}: ${s13.data.verdict_reason}\n\n${conditions}` : "Structured brand-fit record is missing."}`,
  ].join("\n\n");
  const sections = [
    ["SECTION ONE — BRAND STRENGTH INDEX SUMMARY", strength],
    ["SECTION TWO — COMPETITIVE DEFENSIBILITY NARRATIVE", defensibility],
    ["SECTION THREE — DURABILITY AND RISK READ", durability],
    ["SECTION FOUR — BRAND FIT CROSS-CHECK", fit],
    ["SECTION FIVE — OPEN CONDITIONS FOR VALUATION PURPOSES", conditions],
    ["SECTION SIX — EVIDENCE APPENDIX", appendix],
  ];
  return `# VALUATION INPUT BRIEF\n## Diagnostic: current brand position\n## ${run.brand_name} — ${run.category}\n\n*Brand Grenade Strategy Intelligence System*\n\n${VALUATION_DISCLAIMER}\n${VALUATION_READER_GUIDE}\n\nCurrent-position records alone describe current brand strength. All candidate analysis below is a proposition under test — not current brand strength.\n\n${sections.map(([title, body]) => `# ${title}\n\n${body}`).join("\n\n")}${DOCUMENT_FOOTER}`;
}