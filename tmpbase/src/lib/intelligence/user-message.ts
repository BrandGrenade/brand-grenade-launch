export interface IntelligenceInputs {
  brand_name: string | null;
  category: string | null;
  brief_type: string | null;
  markets: string | null;
  audience_context_notes: string | null;
  input_primary_consumer: string | null;
  input_brand_health: string | null;
  input_competitive_audit: string | null;
  input_cultural_trends: string | null;
  input_audience_segmentation: string | null;
  input_bg_intel_pack: string | null;
}

function orFallback(v: string | null, fallback: string): string {
  const trimmed = (v ?? "").trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export function buildUserMessage(inputs: IntelligenceInputs): string {
  return `BRAND GRENADE INTELLIGENCE ENGINE — ANALYSIS REQUEST

Brand: ${orFallback(inputs.brand_name, "Not specified")}
Category: ${orFallback(inputs.category, "Not specified")}
Brief Type: ${orFallback(inputs.brief_type, "Not specified")}
Markets: ${orFallback(inputs.markets, "Not specified")}
Audience Context: ${orFallback(inputs.audience_context_notes, "None provided")}

RESEARCH INPUTS PROVIDED:

[01 — PRIMARY CONSUMER RESEARCH]
${orFallback(inputs.input_primary_consumer, "NOT PROVIDED — absence reduces confidence in perceptual and emotional white space mapping")}

[02 — BRAND HEALTH TRACKING DATA]
${orFallback(inputs.input_brand_health, "NOT PROVIDED — absence reduces confidence in hermit crab vulnerability identification")}

[03 — COMPETITIVE COMMUNICATIONS AUDIT]
${orFallback(inputs.input_competitive_audit, "NOT PROVIDED — absence reduces confidence in competitive vulnerability mapping")}

[04 — CULTURAL TREND ANALYSIS]
${orFallback(inputs.input_cultural_trends, "NOT PROVIDED — absence reduces confidence in moment-activated opportunity identification")}

[05 — AUDIENCE SEGMENTATION RESEARCH]
${orFallback(inputs.input_audience_segmentation, "NOT PROVIDED — absence reduces confidence in audience readiness assessment")}

[06 — BRAND GRENADE INTELLIGENCE PACK]
${orFallback(inputs.input_bg_intel_pack, "NOT PROVIDED — using other inputs as primary intelligence source")}

INSTRUCTION: Apply all ten analytical layers to the inputs above. Identify all available strategic territory across the five territory types. Produce the complete ranked intelligence report in the exact JSON format specified. Return only valid JSON — no preamble, no explanation, no markdown.`;
}
