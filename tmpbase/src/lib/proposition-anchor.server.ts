// The single anchor GATE every proposition-generating path calls through.
//
// One function: enforcePropositionAnchor(). Stage 8 base, the three
// Disruption engines, all 13 LOC engines, and anything added later all
// pass through it. Nothing else implements anchoring.
//
// TWO MODES
//  1. Engine-supplied anchor — validated structurally, and (if thin)
//     re-checked by the post-generation anchoring pass.
//  2. Post-generation anchoring — REQUIRED for the five brief-isolated LOC
//     engines (Inversion, Wrong Room, Delete the Customer, Random
//     Connection, Time Displacement). Those engines receive zero brand,
//     category or capability information at generation time, so they
//     cannot anchor while writing. Their raw proposition is checked against
//     the real capability register AFTER generation: if a real capability
//     defends the line, the anchor is attached; if none does, the line is
//     withheld from human selection.

import {
  ANCHOR_PROMPT_RULE,
  ANCHOR_SEARCH_GUIDANCE,
  REAL_CAPABILITY_REGISTER,
  structuralAnchorCheck,
  type AnchorVerdict,
} from "./proposition-anchor";
import { callClaude } from "./claude.server";

const GATE_SYSTEM_PROMPT = `You are the anchor gate for a brand strategy platform. You do not write propositions and you do not improve them. You decide one thing: is there a REAL, SPECIFIC, NAMED capability that defends this proposition?

${ANCHOR_PROMPT_RULE}

${ANCHOR_SEARCH_GUIDANCE}

You will be given a proposition, whatever context exists about the brand's real capabilities, and (sometimes) an anchor the engine already supplied.

Your job:
- Search the full capability register before deciding. Choose the capability that most specifically defends this exact line, not the first one that could be made to fit.
- If a real, specific capability defends the line, return it and state in one line how it defends it.
- If the engine supplied an anchor that is real and specific, confirm it (you may tighten the wording, never invent). If the supplied anchor is delivery speed but the line is not about time, replace it with the capability that actually defends the line, or fail it.
- If nothing real defends the line, say so. Do NOT invent a capability. Do NOT hedge. Withholding is the correct answer.

Return ONLY valid JSON, no prose, no fence:
{"anchored": true|false, "capability": "<short name of the ONE capability, or empty>", "anchor": "<one line: how that capability defends this exact line, or empty>", "reason": "<one line: why it passed or failed>"}`;

function parseVerdict(raw: string): { anchored: boolean; capability: string; anchor: string; reason: string } | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const p = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    return {
      anchored: p.anchored === true,
      capability: String(p.capability ?? "").trim(),
      anchor: String(p.anchor ?? "").trim(),
      reason: String(p.reason ?? "").trim(),
    };
  } catch {
    return null;
  }
}

export type AnchorGateArgs = {
  sessionId: string;
  proposition: string;
  /** Anchor the engine produced, if it was able to produce one. */
  suppliedAnchor?: string | null;
  /** Optional one-line descriptor / rationale for context. */
  descriptor?: string | null;
  brandName?: string | null;
  category?: string | null;
  /** Real capability evidence: Stage 4B product facts, distinctive assets, etc. */
  capabilityEvidence?: string | null;
  /** Label used in Claude logs, e.g. "LOC inversion" or "Stage 8 BREACH". */
  label: string;
  /**
   * True for generation paths that could not see brand/capability context
   * (the five brief-isolated LOC engines). Forces the post-generation pass.
   */
  postGenerationOnly?: boolean;
};

/**
 * THE GATE. Every proposition in this platform passes through here.
 * Never bypass it, never re-implement it in an engine.
 */
const SPEED_ANCHOR_PATTERN =
  /\b(2\s*[-–—]\s*4\s*hour|hours?\b|speed|fast(er)?|rapid|quick(ly)?|same[- ]day|overnight|turnaround|weeks? (not|instead of)|time to (answer|market))\b/i;
const TIME_THEME_PATTERN =
  /\b(hour|day|week|month|year|now|today|tonight|wait(ing)?|slow|fast|speed|late|soon|deadline|clock|time|delay|already|still)\b/i;

export async function enforcePropositionAnchor(args: AnchorGateArgs): Promise<AnchorVerdict> {
  const proposition = args.proposition?.trim() ?? "";
  if (!proposition) {
    return { anchored: false, capability: "", anchor: "", reason: "No proposition to anchor.", source: "none" };
  }

  const supplied = (args.suppliedAnchor ?? "").trim();
  const structural = structuralAnchorCheck(supplied);

  // Speed is the easiest capability to retrofit onto any line, so a
  // speed-based anchor never takes the fast path — it goes to the gate,
  // which must find a more specific capability or fail it.
  const speedAnchor = SPEED_ANCHOR_PATTERN.test(supplied);
  const propositionAboutTime = TIME_THEME_PATTERN.test(proposition);

  // Fast path: engine supplied a structurally sound, non-retrofittable
  // anchor and was allowed to see capability context. Accept it.
  if (!args.postGenerationOnly && structural.ok && !(speedAnchor && !propositionAboutTime)) {
    return {
      anchored: true,
      capability: supplied.split(/[—–:.]/)[0].trim().slice(0, 120),
      anchor: supplied,
      reason: structural.reason,
      source: "engine",
    };
  }


  // Post-generation anchoring pass — required for brief-isolated engines,
  // and used as recovery whenever an engine's anchor is missing or thin.
  const register = REAL_CAPABILITY_REGISTER.map((c) => `- ${c}`).join("\n");
  const userMessage = `BRAND: ${args.brandName ?? "(withheld at generation time)"}
CATEGORY: ${args.category ?? "(withheld at generation time)"}

PROPOSITION:
${proposition}
${args.descriptor ? `\nDESCRIPTOR: ${args.descriptor}` : ""}
${supplied ? `\nANCHOR SUPPLIED BY THE ENGINE (validate — do not accept on trust):\n${supplied}` : "\nThe engine supplied no anchor. It was generated in deliberate isolation from brand and capability information, so anchoring must happen now, after the fact."}

REAL CAPABILITY EVIDENCE FOR THIS BRAND:
${args.capabilityEvidence?.trim() || "(none supplied — judge against the platform capability register only)"}

PLATFORM CAPABILITY REGISTER (real):
${register}

Decide whether a real capability defends this exact line. Return JSON only.`;

  try {
    const raw = await callClaude({
      systemPrompt: GATE_SYSTEM_PROMPT,
      userMessage,
      maxTokens: 600,
      sessionId: args.sessionId,
      stageLabel: `Anchor gate — ${args.label}`,
      stageNumber: "anchor-gate",
      stageName: "Proposition Anchor Gate",
    });
    const v = parseVerdict(raw);
    if (!v) {
      return {
        anchored: false,
        capability: "",
        anchor: "",
        reason: "Anchor gate returned unreadable output.",
        source: "none",
      };
    }
    const check = structuralAnchorCheck(v.anchor);
    if (!v.anchored || !check.ok) {
      return {
        anchored: false,
        capability: v.capability,
        anchor: v.anchor,
        reason: v.reason || check.reason,
        source: "none",
      };
    }
    return {
      anchored: true,
      capability: v.capability,
      anchor: v.anchor,
      reason: v.reason || check.reason,
      source: supplied ? "engine" : "post",
    };
  } catch (e) {
    return {
      anchored: false,
      capability: "",
      anchor: supplied,
      reason: `Anchor gate failed: ${e instanceof Error ? e.message : String(e)}`,
      source: "none",
    };
  }
}
