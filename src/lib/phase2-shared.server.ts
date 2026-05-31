// Shared helpers for Phase 2 stage server functions.
// Card splitting, redirect-instruction formatting, and Three-Truth assembly.

const HEADING = /^##\s+(.+?)\s*$/;

export type Card = { id: string; name: string; markdown: string };

/** Split a Phase 2 output into cards by top-level `## ` headings.
 *  IDs are stable positional slugs: card-1, card-2, card-3, … */
export function splitCards(text: string): Card[] {
  if (!text || !text.trim()) return [];
  const lines = text.split("\n");
  const blocks: Array<{ name: string; lines: string[] }> = [];
  let current: { name: string; lines: string[] } | null = null;
  for (const raw of lines) {
    const m = raw.match(HEADING);
    if (m) {
      if (current) blocks.push(current);
      const name = m[1].replace(/^\*+|\*+$/g, "").trim();
      current = { name, lines: [raw] };
    } else if (current) {
      current.lines.push(raw);
    }
  }
  if (current) blocks.push(current);
  if (blocks.length === 0) {
    return [{ id: "card-1", name: "Output", markdown: text.trim() }];
  }
  return blocks.map((b, i) => ({
    id: `card-${i + 1}`,
    name: b.name,
    markdown: b.lines.join("\n").replace(/\s+$/g, ""),
  }));
}

export function joinCards(cards: Card[]): string {
  return cards.map((c) => c.markdown).join("\n\n");
}

/** Append a per-card redirect instruction to a system prompt. */
export function appendRedirect(systemPrompt: string, redirectText: string): string {
  const t = redirectText.trim();
  if (!t) return systemPrompt;
  return `${systemPrompt}\n\n---\n\nREDIRECT INSTRUCTION: ${t}. Apply this to this output only. It overrides any general direction in the prompt where they conflict. The human has given you a specific direction. Follow it precisely.`;
}

/** Append an arbitrary final instruction to a system prompt (used for
 *  COURAGE REDIRECT at Stage 18 and section regeneration at Stage 20). */
export function appendFinalInstruction(systemPrompt: string, instruction: string): string {
  const t = instruction.trim();
  if (!t) return systemPrompt;
  return `${systemPrompt}\n\n---\n\n${t}`;
}

export type SessionTruths = {
  product: string | null;
  consumer: string | null;
  cultural: string | null;
};

export function formatThreeTruths(t: SessionTruths): string {
  return [
    `Product Truth: ${t.product?.trim() || "—"}`,
    `Consumer Truth: ${t.consumer?.trim() || "—"}`,
    `Cultural Truth: ${t.cultural?.trim() || "—"}`,
  ].join("\n");
}

export type BrandIntelInput = {
  type: string | null;
  values: string | null;
  tone: string | null;
  assets: unknown;
};

export function formatBrandIntelligence(b: BrandIntelInput): string {
  const lines: string[] = [];
  lines.push(`Brand Type: ${b.type || "—"}`);
  lines.push(`Brand Values: ${b.values?.trim() || "—"}`);
  lines.push(`Tone of Voice: ${b.tone?.trim() || "—"}`);
  if (Array.isArray(b.assets) && b.assets.length > 0) {
    lines.push("Distinctive Assets:");
    for (const a of b.assets as Array<{ name?: string; strength?: string }>) {
      if (!a?.name) continue;
      lines.push(`- ${a.name} (${a.strength ?? "unknown"})`);
    }
  } else {
    lines.push("Distinctive Assets: —");
  }
  return lines.join("\n");
}

/** Section labels for the Master Detonation Brief (Stage 20). */
export const STAGE_20_SECTION_DEFS: Array<{ id: string; label: string }> = [
  { id: "smp", label: "THE SMP" },
  { id: "detonation", label: "THE DETONATION" },
  { id: "three_truths", label: "THE THREE TRUTHS" },
  { id: "audience", label: "THE AUDIENCE" },
  { id: "response", label: "THE SINGLE MOST IMPORTANT RESPONSE" },
  { id: "cultural_context", label: "THE CULTURAL CONTEXT" },
  { id: "system_principles", label: "THE DETONATION SYSTEM PRINCIPLES" },
  { id: "courage_requirement", label: "THE COURAGE REQUIREMENT" },
  { id: "compounding_mechanism", label: "THE COMPOUNDING MECHANISM" },
  { id: "ambition", label: "THE CREATIVE SHARE OF VOICE TARGET" },
  { id: "csv_target", label: "THE CREATIVE SHARE OF VOICE TARGET" },
  { id: "never_do", label: "WHAT THE WORK MUST NEVER DO" },
];

/** Parse the Stage 20 brief output into the canonical 12 sections, plus
 *  the Brief Quality Score block. Section content begins after the matching
 *  label and runs until the next label or the score block. */
export type Stage20Parsed = {
  sections: Array<{ id: string; label: string; content: string }>;
  scoreBlock: string;
};

export function parseStage20Output(output: string): Stage20Parsed {
  const text = output ?? "";
  const scoreIdx = text.search(/BRIEF\s+QUALITY\s+SCORE/i);
  const briefPart = scoreIdx >= 0 ? text.slice(0, scoreIdx) : text;
  const scoreBlock = scoreIdx >= 0 ? text.slice(scoreIdx).trim() : "";

  // Build a regex that finds any of the labels as a heading-style anchor.
  // Match labels at the start of a line, optionally preceded by markdown
  // emphasis or heading markers.
  const labels = STAGE_20_SECTION_DEFS.map((s) => s.label);
  const pattern = new RegExp(
    `(^|\\n)\\s*(?:#{1,4}\\s*|\\*+\\s*)?(${labels
      .map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})\\b[^\\n]*`,
    "gi",
  );

  const matches: Array<{ id: string; label: string; start: number; bodyStart: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(briefPart)) !== null) {
    const matchedLabel = m[2].toUpperCase();
    const def = STAGE_20_SECTION_DEFS.find(
      (s) => s.label.toUpperCase() === matchedLabel,
    );
    if (!def) continue;
    matches.push({
      id: def.id,
      label: def.label,
      start: m.index + (m[1]?.length ?? 0),
      bodyStart: m.index + m[0].length,
    });
  }

  const sections: Array<{ id: string; label: string; content: string }> = [];
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    const end = next ? next.start : briefPart.length;
    const content = briefPart.slice(cur.bodyStart, end).trim();
    // De-duplicate: only keep the first hit per id (the CSV_TARGET label
    // appears twice in the defs to tolerate model phrasing).
    if (sections.find((s) => s.id === cur.id)) continue;
    sections.push({ id: cur.id, label: cur.label, content });
  }

  return { sections, scoreBlock };
}

/** Reassemble a Stage 20 brief from sections + score block. */
export function joinStage20(parsed: Stage20Parsed): string {
  const body = parsed.sections
    .map((s) => `${s.label}\n${s.content.trim()}`)
    .join("\n\n");
  return parsed.scoreBlock ? `${body}\n\n${parsed.scoreBlock}` : body;
}

export type BriefQualityScore = {
  emotional_clarity: number | null;
  fame_invitation: number | null;
  distinctive_asset_integration: number | null;
  psychological_leverage: number | null;
  creative_sov_ambition: number | null;
  composite: number | null;
  status: "PASS" | "REVIEW" | null;
};

export function parseBriefQualityScore(scoreBlock: string): BriefQualityScore {
  const pick = (label: string): number | null => {
    const re = new RegExp(`${label}\\s*[:\\-]?\\s*(\\d{1,2})\\s*/\\s*10`, "i");
    const m = scoreBlock.match(re);
    return m ? parseInt(m[1], 10) : null;
  };
  const compositeMatch = scoreBlock.match(/COMPOSITE\s*[:\-]?\s*(\d{1,2})\s*\/\s*50/i);
  const composite = compositeMatch ? parseInt(compositeMatch[1], 10) : null;
  const statusMatch = scoreBlock.match(/STATUS\s*[:\-]?\s*(PASS|REVIEW)/i);
  const status = statusMatch
    ? (statusMatch[1].toUpperCase() as "PASS" | "REVIEW")
    : null;
  return {
    emotional_clarity: pick("Emotional Clarity"),
    fame_invitation: pick("Fame Invitation"),
    distinctive_asset_integration: pick("Distinctive Asset Integration"),
    psychological_leverage: pick("Psychological Leverage"),
    creative_sov_ambition: pick("Creative SoV Ambition"),
    composite,
    status,
  };
}

/** Recompute composite if individual dimensions are present. */
export function recomputeScore(score: BriefQualityScore): BriefQualityScore {
  const parts = [
    score.emotional_clarity,
    score.fame_invitation,
    score.distinctive_asset_integration,
    score.psychological_leverage,
    score.creative_sov_ambition,
  ];
  if (parts.every((v) => typeof v === "number")) {
    const sum = parts.reduce<number>((a, b) => a + (b as number), 0);
    return { ...score, composite: sum, status: sum >= 40 ? "PASS" : "REVIEW" };
  }
  return score;
}

export function formatBriefQualityScore(score: BriefQualityScore): string {
  const fmt = (n: number | null) => (typeof n === "number" ? `${n}/10` : "—/10");
  const composite =
    typeof score.composite === "number" ? `${score.composite}/50` : "—/50";
  const status = score.status ?? "REVIEW";
  return [
    "BRIEF QUALITY SCORE",
    `Emotional Clarity: ${fmt(score.emotional_clarity)}`,
    `Fame Invitation: ${fmt(score.fame_invitation)}`,
    `Distinctive Asset Integration: ${fmt(score.distinctive_asset_integration)}`,
    `Psychological Leverage: ${fmt(score.psychological_leverage)}`,
    `Creative SoV Ambition: ${fmt(score.creative_sov_ambition)}`,
    `COMPOSITE: ${composite}`,
    `STATUS: ${status}`,
  ].join("\n");
}

/** Pull active channel names from the Stage 19 output.
 *  Each channel role section lists channels; we collect every bullet line
 *  under a "ROLE" heading. */
export function extractStage19Channels(stage19: string): string[] {
  if (!stage19) return [];
  const channels = new Set<string>();
  const lines = stage19.split("\n");
  let inHierarchy = false;
  for (const raw of lines) {
    if (/CHANNEL\s+HIERARCHY/i.test(raw)) {
      inHierarchy = true;
      continue;
    }
    if (inHierarchy && /COMPOUNDING\s+MEDIA\s+STRATEGY/i.test(raw)) break;
    if (!inHierarchy) continue;
    const m = raw.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (m) {
      const name = m[1]
        .replace(/^\*+|\*+$/g, "")
        .replace(/\(.*?\)\s*$/, "")
        .trim();
      if (name && name.length < 80) channels.add(name);
    }
  }
  return Array.from(channels);
}

/** Determine each channel's hierarchy role from the Stage 19 output. */
export function extractChannelRoles(stage19: string): Record<string, string> {
  const roles: Record<string, string> = {};
  if (!stage19) return roles;
  const lines = stage19.split("\n");
  let currentRole: string | null = null;
  let inHierarchy = false;
  for (const raw of lines) {
    if (/CHANNEL\s+HIERARCHY/i.test(raw)) {
      inHierarchy = true;
      continue;
    }
    if (inHierarchy && /COMPOUNDING\s+MEDIA\s+STRATEGY/i.test(raw)) break;
    if (!inHierarchy) continue;
    const roleMatch = raw.match(
      /^\s*(?:#{1,4}\s*|\*+\s*)?(FAME\s+DRIVER|MEANING\s+BUILDER|CONVERSION\s+ENGINE|LOYALTY\s+REINFORCER)\b/i,
    );
    if (roleMatch) {
      currentRole = roleMatch[1].toUpperCase().replace(/\s+/g, " ");
      continue;
    }
    const bullet = raw.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (bullet && currentRole) {
      const name = bullet[1]
        .replace(/^\*+|\*+$/g, "")
        .replace(/\(.*?\)\s*$/, "")
        .trim();
      if (name) roles[name] = currentRole;
    }
  }
  return roles;
}
