// Shared types for the Strategic Territory Intelligence Report (Document 00A).
// Extracted from the retired jsPDF renderer so the canonical Minto builder
// and its callers share one source of truth.


type BriefType = "commercial" | "government";
type ResonanceRating = "high" | "moderate" | "low" | "counterproductive";
type RiskClass = "low" | "medium" | "high" | "very_high";

interface WhiteSpaceCell {
  assessment?: string;
  evidence?: string;
  territory_type?: "rational" | "emotional" | "both";
}
interface BrandPermission {
  score?: number;
  rationale?: string;
  permission_sources?: string[];
  permission_gaps?: string[];
}
interface FirstMover {
  score?: number;
  adoption_curve_stage?: string;
  competitive_response_scenario?: string;
  window_duration?: string;
  investment_threshold?: string;
}
interface HermitCrab {
  shell_value?: string;
  vacancy_timeline?: string;
  return_risk?: "low" | "medium" | "high";
  shape_compatibility?: string;
  vacancy_type?: string;
}
interface CulturalAdaptation {
  resonance_overall?: ResonanceRating;
  resonance_by_context?: { context?: string; rating?: ResonanceRating; notes?: string }[];
  adaptation_requirement?: string;
  cultural_risk_flags?: string[];
  cald_mapping?: null | {
    communities?: { community?: string; resonance?: string; adaptation?: string }[];
  };
}
interface HistoricalValidation {
  risk_classification?: RiskClass;
  risk_rationale?: string;
  commercial_precedents?: { case_description?: string; outcome?: string; structural_conditions?: string }[];
  government_precedents?: { case_description?: string; outcome?: string; structural_conditions?: string }[];
}
interface MeasurementFramework {
  brand_associations_to_track?: string[];
  competitive_response_signals?: string[];
  behaviour_change_metrics?: {
    immediate_0_4_weeks?: string[];
    short_term_3_6_months?: string[];
    medium_term_12_24_months?: string[];
  };
  early_warning_signals?: string[];
}
interface Prebrief {
  strategic_anchor?: string;
  tension?: string;
  audience?: string;
  cultural_context?: string;
  creative_territory_direction?: string;
  must_include?: string[];
  must_avoid?: string[];
}
interface Territory {
  id: string;
  name?: string;
  description?: string;
  type?:
    | "category_ownership"
    | "differentiated_positioning"
    | "category_creation"
    | "hermit_crab"
    | "moment_activated";
  white_space?: {
    perceptual?: WhiteSpaceCell;
    emotional?: WhiteSpaceCell;
    cultural?: WhiteSpaceCell;
    motivational?: WhiteSpaceCell;
  };
  brand_permission?: BrandPermission;
  first_mover?: FirstMover;
  hermit_crab?: HermitCrab | null;
  cultural_adaptation?: CulturalAdaptation;
  audience_readiness?: ResonanceRating | "resistant";
  audience_readiness_rationale?: string;
  historical_validation?: HistoricalValidation;
  budget_scale_threshold?: string;
  budget_rationale?: string;
  measurement_framework?: MeasurementFramework;
  strategic_recommendation?: "claim" | "do_not_claim" | "claim_with_conditions";
  recommendation_rationale?: string;
  conditions?: string[];
  prebrief_for_briefing_room?: Prebrief;
}
interface GovernmentAddendum {
  institutional_trust_assessment?: string;
  backlash_risk?: "low" | "medium" | "high";
  backlash_rationale?: string;
  accountability_documentation?: string;
  audience_resistance_mapping?: { segment?: string; resistance_level?: string; rationale?: string }[];
  cald_multicultural_strategy?: string;
}
interface CompletenessAssessment {
  inputs_present?: string[];
  inputs_absent?: string[];
  confidence?: "high" | "moderate" | "low";
  gap_impact_notes?: string[];
}
export interface IntelligenceReport {
  completeness_assessment?: CompletenessAssessment;
  executive_summary?: string;
  territories?: Territory[];
  recommended_primary_territory_id?: string;
  government_addendum?: GovernmentAddendum | null;
}

export interface Document00AInput {
  sourceRunId?: string | null;
  brandName: string;
  category: string;
  briefType: BriefType;
  completedAt: string | null;
  report: IntelligenceReport;
}
