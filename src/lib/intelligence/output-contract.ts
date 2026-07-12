export const OUTPUT_CONTRACT: string = `
OUTPUT CONTRACT

You MUST return a single valid JSON object matching the exact structure below. Return ONLY valid JSON — no preamble, no explanation, no markdown code fences. The entire response must be parseable by JSON.parse().

{
  "completeness_assessment": {
    "inputs_present": ["string array of input types present"],
    "inputs_absent": ["string array of input types absent"],
    "confidence": "high" | "moderate" | "low",
    "gap_impact_notes": ["string array explaining impact of each absent input"]
  },
  "executive_summary": "string — 3-4 sentences capturing the most important strategic finding",
  "territories": [
    {
      "id": "t1",
      "name": "string",
      "description": "string",
      "type": "category_ownership" | "differentiated_positioning" | "category_creation" | "hermit_crab" | "moment_activated",
      "white_space": {
        "perceptual": { "assessment": "string", "evidence": "string", "territory_type": "rational" | "emotional" | "both" },
        "emotional": { "assessment": "string", "evidence": "string", "territory_type": "rational" | "emotional" | "both" },
        "cultural": { "assessment": "string", "evidence": "string", "territory_type": "rational" | "emotional" | "both" },
        "motivational": { "assessment": "string", "evidence": "string", "territory_type": "rational" | "emotional" | "both" }
      },
      "brand_permission": { "score": 1-10, "rationale": "string", "permission_sources": ["string array"], "permission_gaps": ["string array"] },
      "first_mover": {
        "score": 1-10,
        "adoption_curve_stage": "string",
        "competitive_response_scenario": "no_credible_response" | "adjacent_response" | "direct_competition",
        "window_duration": "string",
        "investment_threshold": "low" | "moderate" | "high" | "scale_independent"
      },
      "hermit_crab": null | {
        "shell_value": "string",
        "vacancy_timeline": "string",
        "return_risk": "low" | "medium" | "high",
        "shape_compatibility": "string",
        "vacancy_type": "string"
      },
      "cultural_adaptation": {
        "resonance_overall": "high" | "moderate" | "low" | "counterproductive",
        "resonance_by_context": [{ "context": "string", "rating": "high" | "moderate" | "low" | "counterproductive", "notes": "string" }],
        "adaptation_requirement": "none" | "minor" | "moderate" | "major" | "full_localisation",
        "cultural_risk_flags": ["string array"],
        "cald_mapping": null | { "communities": [{ "community": "string", "resonance": "string", "adaptation": "string" }] }
      },
      "audience_readiness": "high" | "moderate" | "low" | "resistant",
      "audience_readiness_rationale": "string",
      "historical_validation": {
        "risk_classification": "low" | "medium" | "high" | "very_high",
        "risk_rationale": "string",
        "commercial_precedents": [{ "case_description": "string", "outcome": "string", "structural_conditions": "string" }],
        "government_precedents": []
      },
      "budget_scale_threshold": "low" | "moderate" | "high" | "scale_independent",
      "budget_rationale": "string",
      "negative_space_flags": [{ "flag": "string", "reason": "string" }],
      "timing_sequencing": {
        "recommendation": "string",
        "is_gateway_territory": true | false,
        "phase": "year1" | "year2_3" | "long_term"
      },
      "longevity_saturation": {
        "compounding_potential": "string",
        "saturation_timeline": "string",
        "evolution_requirement": "string",
        "exit_signal": "string"
      },
      "measurement_framework": {
        "brand_associations_to_track": ["string array"],
        "competitive_response_signals": ["string array"],
        "behaviour_change_metrics": {
          "immediate_0_4_weeks": ["string array"],
          "short_term_3_6_months": ["string array"],
          "medium_term_12_24_months": ["string array"]
        },
        "early_warning_signals": ["string array"]
      },
      "strategic_recommendation": "claim" | "do_not_claim" | "claim_with_conditions",
      "recommendation_rationale": "string",
      "conditions": ["string array — populated when strategic_recommendation is claim_with_conditions"],
      "prebrief_for_briefing_room": {
        "strategic_anchor": "string",
        "tension": "string",
        "audience": "string",
        "cultural_context": "string",
        "creative_territory_direction": "string",
        "must_include": ["string array"],
        "must_avoid": ["string array"]
      }
    }
  ],
  "recommended_primary_territory_id": "string — the id of the highest-value territory",
  "government_addendum": null | {
    "institutional_trust_assessment": "string",
    "backlash_risk": "low" | "medium" | "high",
    "backlash_rationale": "string",
    "accountability_documentation": "string",
    "audience_resistance_mapping": [{ "segment": "string", "resistance_level": "string", "rationale": "string" }],
    "cald_multicultural_strategy": "string"
  }
}

Return only valid JSON. No preamble. No explanation. No markdown code fences. The entire response must be parseable by JSON.parse().
`;
