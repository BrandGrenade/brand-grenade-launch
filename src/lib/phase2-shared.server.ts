// Shared helpers for Phase 2 stage server functions.
// Card splitting, redirect-instruction formatting, and Three-Truth assembly.



export type Card = { id: string; name: string; markdown: string };

/** Split a Phase 2 output into cards.
 *  Phase 2 outputs are plain text (no markdown). Card titles are short
 *  all-caps lines (no trailing colon). Stage 17 follows the strong pattern
 *  "<NAME>\n\nWHY THIS TERRITORY SERVES THE SMP:". For other stages we
 *  fall back to detecting any all-caps title line that isn't a section
 *  label, and finally to the legacy `## heading` markdown format.
 *  IDs are stable positional slugs: card-1, card-2, card-3, … */
export function splitCards(text: string): Card[] {
  if (!text || !text.trim()) return [];
  const t = text.trim();

  const NAME = "[A-Z][A-Z0-9 '\\-&/]{3,79}";
  const collect = (re: RegExp): Array<{ name: string; start: number }> => {
    const hits: Array<{ name: string; start: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      const name = m[1].trim();
      const start = m.index + m[0].indexOf(m[1]);
      hits.push({ name, start });
    }
    return hits;
  };

  let matches = collect(new RegExp(`(?:^|\\n)\\s*(${NAME})\\s*\\n\\s*\\n\\s*WHY THIS TERRITORY`, "gm"));
  if (matches.length === 0) {
    matches = collect(new RegExp(`(?:^|\\n\\s*\\n)\\s*(${NAME})(?!:)\\s*\\n`, "g"));
  }
  if (matches.length === 0) {
    matches = collect(/(?:^|\n)##\s+(.+?)\s*\n/g);
  }
  if (matches.length === 0) {
    return [{ id: "card-1", name: "Territory", markdown: t }];
  }
  return matches.map((mat, i) => {
    const end = i + 1 < matches.length ? matches[i + 1].start : t.length;
    return {
      id: `card-${i + 1}`,
      name: mat.name.replace(/^#+\s*/, "").replace(/^\*+|\*+$/g, "").trim(),
      markdown: t.slice(mat.start, end).replace(/\s+$/g, ""),
    };
  });
}

export function joinCards(cards: Card[]): string {
  return cards.map((c) => c.markdown).join("\n\n");
}

/** Absolute formatting rules appended to every Phase 2 system prompt.
 *  The UI renders plain text with uppercase section labels — any markdown
 *  output from the model breaks the designed presentation. */
export const PHASE_2_FORMATTING_RULES = `FORMATTING RULES — ABSOLUTE:

Never use markdown formatting of any kind in your output.
No asterisks for bold or italic.
No hash symbols for headings.
No horizontal rules using dashes or underscores.
No bullet points using asterisks or hyphens.
No backticks.
No markdown of any kind.

Section labels must be written as plain uppercase text followed by a colon and a line break.

Example:
TERRITORY NAME:
content here

Body text is plain prose.
Section labels are plain uppercase text.
Nothing else.

The output will be rendered in a designed UI that handles all visual formatting.
Your job is clean plain text with uppercase section labels.
Markdown will break the UI. Do not use it under any circumstances.`;

/** Wrap any Phase 2 system prompt with the absolute formatting rules.
 *  Always call this at the system-prompt call site (after any redirect /
 *  final-instruction wrapping) so the rules are the LAST thing the model sees. */
export function withPhase2Formatting(systemPrompt: string): string {
  return `${systemPrompt}\n\n---\n\n${PHASE_2_FORMATTING_RULES}`;
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

export type ChannelRole = "PRIMARY" | "AMPLIFICATION" | "ACTIVATION" | "SUSTAINING";
export type ChannelEntry = { name: string; role: ChannelRole; content: string };

const CHANNEL_NAME_MAP: Array<{ keywords: RegExp; name: string }> = [
  { keywords: /\b(tool|transaction analysis|interactive|analyse|transaction data|itemised|merchant analysis)\b/i, name: "Transaction Analysis Tool" },
  { keywords: /\b(industry media|business publication|journalism|trade media|press|editorial|publication)\b/i, name: "Industry and Trade Media" },
  { keywords: /\b(email|crm|sequence|weekly|educational email|ongoing|literacy)\b/i, name: "Email and CRM" },
  { keywords: /\b(film|video|television|broadcast|long[-\s]?form|tvc)\b/i, name: "Film and Long-form" },
  { keywords: /\b(social|instagram|facebook|tiktok|linkedin|short[-\s]?form)\b/i, name: "Social and Short-form" },
  { keywords: /\b(outdoor|ooh|billboard|transit|street)\b/i, name: "Outdoor" },
  { keywords: /\b(digital|search|google|display|programmatic|online advertising)\b/i, name: "Digital and Search" },
  { keywords: /\b(audio|podcast|radio|spotify|sound)\b/i, name: "Audio and Podcast" },
  { keywords: /\b(activation|experiential|event|sponsorship|in[-\s]?person|live)\b/i, name: "Activation and Experiential" },
  { keywords: /\b(pr|earned|media relations|journalist|publicity)\b/i, name: "PR and Earned" },
];

function deriveChannelName(prose: string): string {
  for (const m of CHANNEL_NAME_MAP) {
    if (m.keywords.test(prose)) return m.name;
  }
  const words = prose.trim().split(/\s+/).slice(0, 5).join(" ");
  return words || "Channel";
}

const DEFAULT_CHANNELS: ChannelEntry[] = [
  { name: "Film and Long-form", role: "PRIMARY", content: "" },
  { name: "Social and Short-form", role: "AMPLIFICATION", content: "" },
  { name: "Outdoor", role: "AMPLIFICATION", content: "" },
  { name: "Digital and Search", role: "ACTIVATION", content: "" },
  { name: "PR and Earned", role: "AMPLIFICATION", content: "" },
];

/** Parse Stage 19 output into channel entries by section header. */
export function extractStage19ChannelEntries(stage19: string): ChannelEntry[] {
  if (!stage19 || !stage19.trim()) return [...DEFAULT_CHANNELS];

  const sectionRegex = /^(PRIMARY\s+CHANNELS?|AMPLIFICATION\s+CHANNELS?|ACTIVATION\s+CHANNELS?|SUSTAINING\s+CHANNELS?)\b[^\n]*/gim;
  const terminatorRegex = /^(THE\s+)?(DISTINCTIVE\s+ASSET\s+ACTIVATION\s+MAP|COMPOUNDING\s+MEDIA\s+STRATEGY|EMOTIONAL\s+TO\s+RATIONAL\s+CALIBRATION)\b/im;

  type Match = { role: ChannelRole; start: number; bodyStart: number };
  const matches: Match[] = [];
  let m: RegExpExecArray | null;
  while ((m = sectionRegex.exec(stage19)) !== null) {
    const header = m[1].toUpperCase();
    let role: ChannelRole = "PRIMARY";
    if (header.startsWith("AMPLIFICATION")) role = "AMPLIFICATION";
    else if (header.startsWith("ACTIVATION")) role = "ACTIVATION";
    else if (header.startsWith("SUSTAINING")) role = "SUSTAINING";
    matches.push({ role, start: m.index, bodyStart: m.index + m[0].length });
  }

  const isGarbage = (p: string) =>
    !p ||
    p.length < 80 ||
    /^[-=*_\s]+$/.test(p) ||
    /^---/.test(p) ||
    !p.trim();

  const entries: ChannelEntry[] = [];
  const usedRoles = new Set<ChannelRole>();
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    let end = next ? next.start : stage19.length;
    const tail = stage19.slice(cur.bodyStart, end);
    const term = tail.search(terminatorRegex);
    if (term >= 0) end = cur.bodyStart + term;
    const body = stage19.slice(cur.bodyStart, end).trim();
    if (!body) continue;

    // Split body into paragraph blocks and filter garbage.
    const cleanParas = body
      .split(/\n\s*\n+/)
      .map((p) => p.trim())
      .filter((p) => !isGarbage(p));
    if (cleanParas.length === 0) continue;

    if (cur.role === "AMPLIFICATION") {
      // AMPLIFICATION can contain multiple channels — each block > 200 chars
      // becomes its own channel entry. Shorter blocks attach to the previous.
      const blocks: string[] = [];
      for (const p of cleanParas) {
        if (p.length > 200) {
          blocks.push(p);
        } else if (blocks.length > 0) {
          blocks[blocks.length - 1] += `\n\n${p}`;
        }
      }
      const finalBlocks = blocks.length > 0 ? blocks : [cleanParas.join("\n\n")];
      const usedNames = new Set<string>();
      for (const block of finalBlocks) {
        const name = deriveChannelName(block);
        if (usedNames.has(name)) continue;
        usedNames.add(name);
        entries.push({ name, role: "AMPLIFICATION", content: block });
      }
      continue;
    }

    const content = cleanParas.join("\n\n");
    const name = deriveChannelName(content);
    if (usedRoles.has(cur.role)) continue;
    usedRoles.add(cur.role);
    entries.push({ name, role: cur.role, content });
  }

  if (entries.length === 0) return [...DEFAULT_CHANNELS];
  return entries;
}

/** Backward-compatible: list of channel names from Stage 19. */
export function extractStage19Channels(stage19: string): string[] {
  return extractStage19ChannelEntries(stage19).map((e) => e.name);
}

/** Backward-compatible: name → role map. */
export function extractChannelRoles(stage19: string): Record<string, ChannelRole> {
  const roles: Record<string, ChannelRole> = {};
  for (const e of extractStage19ChannelEntries(stage19)) {
    roles[e.name] = e.role;
  }
  return roles;
}

/** SMP-first governing block. Prepended to every Phase 2 stage user message
 *  so the model is anchored to the validated SMP before any other context. */
export function smpGoverningBlock(selectedSmp: string | null | undefined): string {
  const smp = (selectedSmp ?? "").trim() || "—";
  return `THE SMP — THIS GOVERNS EVERYTHING:
"${smp}"

Read this SMP three times before generating anything.
Every output you produce must be an expression of this specific SMP.
Not generic strategy. Not interesting territory. A specific answer to:
What does "${smp}" look and feel like when humans experience it in the world?

If your output could exist without this specific SMP — it is wrong.
Regenerate until the SMP is unmistakably present.`;
}
