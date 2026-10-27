// Lossless, browser-safe recovery from the requested version's saved document.
// Never generates, rescoring is forbidden, and unsupported formats fail closed.
import { z } from "zod";
import { parseStage10Scores, stripEmphasis } from "./stage12-filter";

const nonempty = z.string().min(1);
const dimension = z.object({ score: z.number().int().min(1).max(10), justification: nonempty });
const dimensions = ["fame", "truth_strength", "competitive_impossibility", "brand_permission", "clean_air", "commercial_precedent"] as const;
const labels = ["Fame", "Truth Strength", "Competitive Impossibility", "Brand Permission", "Clean Air", "Commercial Precedent"];
const credibility = ["product_truth_alignment", "audience_permission", "tonal_compatibility", "behavioural_capacity", "cultural_authority", "historical_consistency"] as const;
const credibilityLabels = ["Product Truth Alignment", "Audience Permission", "Tonal Compatibility", "Behavioural Capacity", "Cultural Authority", "Historical Consistency"];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const flat = (s: string) => stripEmphasis(s).replace(/\r\n/g, "\n");
const blocks = (s: string) => flat(s).split(/\n(?=(?:#{1,6}\s*)?SMP:\s*["“])/).filter(s => /^(?:#{1,6}\s*)?SMP:\s*["“]/.test(s.trim()));
const heading = (s: string) => s.match(/SMP:\s*["“]([^"”\n]+)["”]\s*[—–-]\s*FIELD:\s*([^\n]+?)(?:\s*[—–-]\s*ICONIC\b[^\n]*)?(?:\n|$)/i);
const line = (s: string, label: string) => s.match(new RegExp(`^${escape(label)}(?:\\s*\\([^\\n]*?\\))?\\s*:\\s*([^\\n]+)`, "im"))?.[1]?.trim() ?? null;
const list = (s: string | null) => !s || /^NONE$/i.test(s) ? [] : s.replace(/\]$/, "").split(/[,;]/).map(s => s.trim()).filter(Boolean);

export const Stage12PropositionsSchema = z.object({
  propositions: z.array(z.object({
    number: z.number().int().positive(), smp: nonempty, field_name: z.string(),
    owns: nonempty, truth: nonempty, challenge: nonempty, makes_possible: nonempty, requires: nonempty,
    scores: z.object(Object.fromEntries(dimensions.map(k => [k, z.number().int().min(1).max(10)])) as Record<(typeof dimensions)[number], z.ZodNumber>),
    weighted_composite: z.number(), weighted_max: z.literal(90),
    metadata: z.record(z.string(), z.string()),
  })).min(1),
});

export function recoverStage12(text: string): Record<string, unknown> | null {
  const scope = flat(text).split(/(?:SECTION\s+3\b|STRATEGIC LANDSCAPE SUMMARY|={2,}\s*DELIVERABLE\s+[23])/i)[0];
  const cards = Array.from(scope.matchAll(/(?:^|\n)\s*PROPOSITION\s+(\d+)[\s\S]*?(?=\n\s*(?:[═=]{3,}\s*\n)?\s*PROPOSITION\s+\d+|$)/gi));
  const sections = ["WHAT THIS PROPOSITION OWNS", "THE TRUTH IT IS BUILT ON", "WHAT IT CHALLENGES", "WHAT IT MAKES POSSIBLE", "WHAT IT REQUIRES OF THE BRAND", "STRATEGIC QUALITY SCORES", "WHERE IT IS EXPOSED"];
  const result = cards.map(m => {
    const b = m[0];
    const section = (i: number) => b.match(new RegExp(`${sections[i]}[^\\n]*\\n+([\\s\\S]*?)(?=\\n\\s*(?:[─═=]{3,}\\s*\\n\\s*)?(?:${sections.slice(i + 1).join("|")})|\\n\\[METADATA\\]|$)`, "i"))?.[1]?.replace(/^[─═=]{3,}\s*$/gm, "").trim() ?? "";
    const metadata = Object.fromEntries(Array.from((b.match(/\[METADATA\]([\s\S]*?)\[\/METADATA\]/)?.[1] ?? "").matchAll(/^([A-Z0-9_]+):\s*(.*)$/gm), m => [m[1], m[2].trim()]));
    return { number: Number(m[1]), smp: b.split(sections[0])[0].match(/["“]([^"”\n]+)["”]/)?.[1] ?? "", field_name: metadata.FIELD_NAME ?? "",
      owns: section(0), truth: section(1), challenge: section(2), makes_possible: section(3), requires: section(4),
      scores: Object.fromEntries(dimensions.map((k,i) => [k, Number(b.match(new RegExp(`${labels[i]}:\\s*(\\d+)\\/10`))?.[1])])),
      weighted_composite: Number(b.match(/Weighted Composite:\s*(\d+(?:\.\d+)?)\/90/i)?.[1]), weighted_max: 90, metadata };
  });
  const parsed = Stage12PropositionsSchema.safeParse({ propositions: result });
  return parsed.success ? parsed.data : null;
}

export function recoverStage10(text: string): Record<string, unknown> | null {
  const scores = parseStage10Scores(text);
  const bs = blocks(text);
  const expected = Number(line(flat(text), "SMPS SCORED"));
  if (!expected || expected !== scores.length || bs.length !== scores.length) return null;
  const rows = bs.map((b,i) => {
    const values = Object.fromEntries(dimensions.map((k,j) => {
      const m = b.match(new RegExp(`^${labels[j]}:\\s*(\\d+)\\/10[^\\n]*?[—–]\\s*([^\\n]+)`, "im"));
      return [k, { score: Number(m?.[1]), justification: m?.[2] ?? "" }];
    }));
    const parsed = z.object(Object.fromEntries(dimensions.map(k => [k, dimension]))).safeParse(values);
    if (!parsed.success) return null;
    // Named evidence remains verbatim in justification; do not guess entities or dates.
    return { smp: scores[i].smpLine, field_name: scores[i].fieldName, ...parsed.data,
      competitive_impossibility: { ...values.competitive_impossibility, competitor: null, competitor_claim: null },
      brand_permission: { ...values.brand_permission, evidence: values.brand_permission.justification },
      clean_air: { ...values.clean_air, occupier: null, occupying_claim: null },
      commercial_precedent: { ...values.commercial_precedent, precedents: [] },
      composite: Number(b.match(/^CODE COMPOSITE:\s*(\d+(?:\.\d+)?)/im)?.[1]),
      code_verdict: line(b, "CODE VERDICT")?.split(/\s+[—–]/)[0] ?? null,
      code_verdict_reason: line(b, "CODE VERDICT"), source_text: b };
  });
  if (rows.some(r => !r || !Number.isFinite(r.composite) || !r.code_verdict)) return null;
  return { smps_scored: expected, selection_rule: line(flat(text), "SELECTION RULE"), scores: rows, recovery: "saved_text", current_position: null };
}

export function recoverStage11(text: string): Record<string, unknown> | null {
  const bs = blocks(text);
  const testSchema = z.object({ result: z.enum(["HOLDS", "WOBBLES", "CRACKS", "N/A"]), rationale: nonempty });
  const result = bs.map(b => {
    const h = heading(b);
    if (!h) return null;
    const tests: Record<string, unknown> = {};
    for (let i=1; i<=8; i++) {
      const m = b.match(new RegExp(`^T${i}\\s*[—–-][^\\n]*?:\\s*(HOLDS|WOBBLES|CRACKS|N/A)\\s*[—–-]\\s*([^\\n]+)`, "im"));
      if (!m) return null;
      const rationale = m[2].match(/(?:^|[—–]\s*|\.\s*)Rationale:\s*([\s\S]+)/i)?.[1] ?? m[2];
      const parsed = testSchema.safeParse({ result: m[1], rationale });
      if (!parsed.success || (i<8 && m[1]==="N/A")) return null;
      tests[`T${i}`] = { ...parsed.data,
        ...(i===5 ? { counter_line: m[2].match(/Counter:\s*([\s\S]*?)\s*[—–]\s*Classification:/i)?.[1] ?? "", classification: m[2].match(/Classification:\s*(EXPOSES-UNTRUTH|COMPETES-FOR-TERRITORY|UNCERTAIN)/i)?.[1] ?? null } : {}),
        ...(i===7 ? { misreading: m[2].match(/Misreading:\s*([\s\S]*?)\s*[—–]\s*Guard-rail:/i)?.[1] ?? "", guard_rail: m[2].match(/Guard-rail:\s*([\s\S]*?)(?:\.?\s*Rationale:|$)/i)?.[1] ?? "" } : {}) };
    }
    const verdict = line(b, "SMP VERDICT");
    if (!verdict) return null;
    return { smp: h[1], field_name: h[2], iconic_tier: /ICONIC TIER FLAG:\s*YES/i.test(b), tests, verdict,
      fatal: list(b.match(/\[FATAL:\s*([^\]]+)\]/i)?.[1] ?? null), flags: list(b.match(/\[FLAGS:\s*([^\]]+)\]/i)?.[1] ?? null),
      exposure_note: line(b,"EXPOSURE NOTE"), strategic_note: line(b,"STRATEGIC NOTE"),
      rewrite: null, iconic_final: line(b,"ICONIC TIER FINAL STATUS"), source_text: b };
  });
  const expected = Number(line(flat(text), "PROPOSITIONS RECEIVED FROM STAGE 10"));
  if (!expected || result.length !== expected || result.some(b=>!b)) return null;
  // Preserve written verdicts; recovery never applies new judgement rules.
  const surviving = result.filter(b=>b && !/ELIMINATED/.test(b.verdict ?? ""));
  const declared = Number(flat(text).match(/Surviving set size:\s*(\d+)/i)?.[1]);
  if (declared !== surviving.length) return null;
  return { blocks: result, surviving_set: surviving.map(b=>b?.smp), exposed_count: Number(flat(text).match(/Of which EXPOSED:\s*(\d+)/i)?.[1]), divergence_preserved: /Divergence preserved post-rewrite:\s*YES/i.test(text), recovery: "saved_text" };
}

export function recoverStage13(text: string): Record<string, unknown> | null {
  const t = flat(text);
  const section = (n: string) => t.match(new RegExp(`^## Section ${n}[^\\n]*\\n+([\\s\\S]*?)(?=\\n## Section |$)`,"m"))?.[1]?.replace(/^---\s*$/gm, "").trim() ?? "";
  const values = Object.fromEntries(credibility.map((k,i)=> {
    const m = t.match(new RegExp(`^${credibilityLabels[i]}\\s*[—–]\\s*(\\d+)(?:\\/10)?\\.\\s*([^\\n]+)`,"im"));
    return [k,{score:Number(m?.[1]),justification:m?.[2] ?? ""}];
  }));
  if (!z.object(Object.fromEntries(credibility.map(k=>[k,dimension]))).safeParse(values).success) return null;
  const verdict = section("1").match(/^(CONFIRMED WITH ADJUSTMENTS — PROCEED|CONFIRMED — PROCEED|HUMAN REVIEW REQUIRED|RETURN TO STAGE 12 — RESELECT SMP)\.?/m)?.[1];
  const vulnerable = t.match(/most vulnerable credibility dimension is ([^:]+):/i)?.[1]?.trim();
  const most = credibility[credibilityLabels.findIndex(s=>s===vulnerable)];
  const forcing = section("2B");
  const ownership = section("3").split(/### Can the brand (?:own this territory|behave this proposition|sustain this proposition)\?\s*/).slice(1).map(s=>s.trim());
  if (!verdict || !most || ownership.length!==3 || !section("4") || !section("5") || !section("6")) return null;
  if (forcing && !/Verdict:\s*(FORCING PROPOSITION|GENUINE MISMATCH)/.test(forcing)) return null;
  return { verdict, verdict_reason: section("1").split(/\n\n/).slice(1).join("\n\n"), credibility: values, most_vulnerable: most,
    forcing_test: forcing ? { triggered:true, verdict:forcing.match(/Verdict:\s*(FORCING PROPOSITION|GENUINE MISMATCH)/)?.[1], path_or_reason:forcing } : null,
    ownership:{ own:ownership[0],behave:ownership[1],sustain:ownership[2] },
    adjustments: section("4").split(/\n\n/).map(s=>({what:s,why:s,downstream:""})),
    section5:{mode:/Operational Requirements/i.test(t.match(/^## Section 5[^\n]*/m)?.[0] ?? "") ? "OPERATIONAL_REQUIREMENTS" : "GUARDRAILS",items:section("5").split(/\n/).filter(s=>s.startsWith("- ")).map(s=>({text:s.slice(2),dimension:null,horizon:null}))},
    commitments:section("6").split(/\n\n/), recovery:"saved_text" };
}

export function recoverSavedStage(stage: "10" | "11" | "13", text: string) {
  try { return stage==="10" ? recoverStage10(text) : stage==="11" ? recoverStage11(text) : recoverStage13(text); }
  catch { return null; }
}