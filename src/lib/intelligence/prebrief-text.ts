// Pure helpers for building the Briefing Room handoff text.
//
// These MUST live outside src/lib/intelligence.functions.ts. The TanStack
// server-fn split transform removes module-scope siblings from a
// createServerFn handler's bundle, so referencing them from inside a
// handler produces a runtime ReferenceError. Importing from a separate
// module is safe.

export const INTELLIGENCE_SENTINEL = "[FROM_INTELLIGENCE_ENGINE";

export interface PrebriefForBriefingRoom {
  strategic_anchor?: string;
  tension?: string;
  audience?: string;
  cultural_context?: string;
  creative_territory_direction?: string;
  must_include?: string[];
  must_avoid?: string[];
}

export function formatList(items: string[] | undefined): string {
  if (!items || items.length === 0) return "(none)";
  return items.map((s) => `- ${s}`).join("\n");
}

export function buildPreBriefText(args: {
  intelligenceSessionId: string;
  brandName: string;
  category: string;
  territoryName: string;
  territoryDescription: string;
  prebrief: PrebriefForBriefingRoom;
  executiveSummary: string | null;
}): string {
  const p = args.prebrief;
  return `${INTELLIGENCE_SENTINEL} session=${args.intelligenceSessionId}]
This brief has been pre-diagnosed by the Strategic Territory Intelligence Engine.
The strategic anchor, tension, audience, cultural context, and creative territory
direction below are AUTHORITATIVE inputs — not claims to interrogate away. Use them
as fixed priority inputs; do NOT re-frame or discard them. You may still surface
gaps in supporting evidence.

BRAND: ${args.brandName}
CATEGORY: ${args.category}

RECOMMENDED PRIMARY TERRITORY:
${args.territoryName}

TERRITORY DESCRIPTION:
${args.territoryDescription || "(not provided)"}

${args.executiveSummary ? `EXECUTIVE SUMMARY:\n${args.executiveSummary}\n` : ""}
STRATEGIC ANCHOR:
${p.strategic_anchor || "(not provided)"}

TENSION:
${p.tension || "(not provided)"}

AUDIENCE:
${p.audience || "(not provided)"}

CULTURAL CONTEXT:
${p.cultural_context || "(not provided)"}

CREATIVE TERRITORY DIRECTION:
${p.creative_territory_direction || "(not provided)"}

MUST INCLUDE:
${formatList(p.must_include)}

MUST AVOID:
${formatList(p.must_avoid)}
`;
}
