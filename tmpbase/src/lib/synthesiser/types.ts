// Research Synthesiser — shared types (client-safe, no server imports).

export type SynthesiserCategory =
  | "input_primary_consumer"
  | "input_brand_health"
  | "input_competitive_audit"
  | "input_cultural_trends"
  | "input_audience_segmentation"
  | "input_bg_intel_pack";

export const SYNTHESISER_CATEGORIES: {
  key: SynthesiserCategory;
  title: string;
  scope: string;
}[] = [
  {
    key: "input_primary_consumer",
    title: "Primary Consumer Research",
    scope:
      "Consumer attitudes, motivations, usage, perception surveys, qualitative consumer verbatims, category usage & attitude findings.",
  },
  {
    key: "input_brand_health",
    title: "Brand Health Tracking Data",
    scope:
      "Awareness, consideration, preference, NPS, brand association strength, longitudinal tracking of the brand itself.",
  },
  {
    key: "input_competitive_audit",
    title: "Competitive Communications Audit",
    scope:
      "What named competitors are saying and doing — advertising, PR, social, owned content, positioning, spend, share of voice.",
  },
  {
    key: "input_cultural_trends",
    title: "Cultural Trend Analysis",
    scope:
      "Cultural signals, social listening, media trends, macro shifts, generational or societal movement relevant to the category.",
  },
  {
    key: "input_audience_segmentation",
    title: "Audience Segmentation Research",
    scope:
      "Defined segments by attitude, behaviour, need state, demographic or cultural identity, and their relative size or value.",
  },
  {
    key: "input_bg_intel_pack",
    title: "Brand Grenade Intelligence Pack",
    scope:
      "Material that reads as a pre-pipeline Brand Grenade intelligence document, or general strategic background that fits no other heading.",
  },
];

export type SourceType = "externally_verifiable" | "client_proprietary";

export type VerificationStatus =
  | "verified"
  | "unverified"
  | "contradicted"
  | "client_supplied"
  | "not_checked";

export interface SynthesisedClaim {
  claim: string;
  categories: SynthesiserCategory[];
  sourceType: SourceType;
  sourceDocument: string;
  status: VerificationStatus;
  note?: string;
}

export interface SynthesiserResult {
  claims: SynthesisedClaim[];
  /** Ready-to-paste text per category field, structured and attributed. */
  fields: Record<SynthesiserCategory, string>;
  stats: {
    totalClaims: number;
    externallyVerifiable: number;
    clientProprietary: number;
    verified: number;
    flagged: number;
    verificationRan: boolean;
  };
  warnings: string[];
}

export interface SynthesiserDocument {
  name: string;
  text: string;
}
