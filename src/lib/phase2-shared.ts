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

  const NAME = "[A-Z][A-Z0-9 '\\-&/.,]{3,79}";
  const cleanName = (s: string) =>
    s.replace(/^#+\s*/, "").replace(/^\*+|\*+$/g, "").replace(/[.,;:\s]+$/g, "").trim();
  const collect = (re: RegExp): Array<{ name: string; start: number }> => {
    const hits: Array<{ name: string; start: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      const name = cleanName(m[1]);
      const start = m.index + m[0].indexOf(m[1]);
      hits.push({ name, start });
    }
    return hits;
  };

  // AUTHORITATIVE BOUNDARY: count "WHY THIS (DETONATION|TERRITORY)" anchors.
  // Stage 17/18 emit exactly one per candidate. Treat that count as truth.
  const anchorRe = /WHY THIS (?:TERRITORY|DETONATION)/g;
  const anchorPositions: number[] = [];
  let am: RegExpExecArray | null;
  while ((am = anchorRe.exec(t)) !== null) anchorPositions.push(am.index);

  // Try ALL boundary patterns universally; use whichever finds matches.
  let matches: Array<{ name: string; start: number }> = [];
  matches = collect(new RegExp(`(?:^|\\n)\\s*(${NAME})\\s*\\n\\s*\\n\\s*WHY THIS TERRITORY`, "gm"));
  if (matches.length === 0) {
    // Stage 18 pattern: "DETONATION ONE: KEEP YOUR OPTIONS OPEN" — name contains a colon.
    matches = collect(/(?:^|\n)\s*(DETONATION\s+[A-Z]+\s*:\s*[^\n]+?)\s*\n\s*\n\s*WHY THIS DETONATION/g);
  }
  if (matches.length === 0) {
    matches = collect(new RegExp(`(?:^|\\n)\\s*(${NAME})\\s*\\n\\s*\\n\\s*WHY THIS DETONATION`, "gm"));
  }
  if (matches.length === 0) {
    matches = collect(/(?:^|\n)##\s+(.+?)\s*\n/g);
  }
  if (matches.length === 0) {
    matches = collect(new RegExp(`(?:^|\\n\\s*\\n)\\s*(${NAME})(?!:)\\s*\\n`, "g"));
  }

  // SAFETY NET: if titled-pattern matches undercount the authoritative anchor
  // count, segment by anchors directly. Card boundaries are non-overlapping:
  // for each anchor, walk back to the blank line ABOVE the title block, so
  // every card spans exactly one title + one body (no duplication, no
  // title-mismatched-to-wrong-body).
  if (matches.length < anchorPositions.length && anchorPositions.length >= 2) {
    // Walk back from each anchor through ALL preamble lines that belong to
    // the next card: candidate header ("DETONATION CANDIDATE TWO"), a
    // "THE DETONATION LINE: <value>" pair, stray "---" or "##" markdown,
    // short ALL-CAPS title lines, and blanks. Stop at the first line that
    // is clearly previous-card body content.
    const cardStartFor = (anchorIdx: number): number => {
      // Build absolute line-start offsets for the slice before the anchor.
      const before = t.slice(0, anchorIdx);
      const lines = before.split("\n");
      const lineStarts: number[] = [];
      let pos = 0;
      for (const ln of lines) {
        lineStarts.push(pos);
        pos += ln.length + 1; // +1 for \n
      }
      const isPreambleLine = (raw: string): boolean => {
        const l = raw.trim();
        if (l === "") return true;
        if (/^-{3,}$/.test(l)) return true;
        if (/^#{1,6}(\s|$)/.test(l)) return true;
        if (/^DETONATION\s+(CANDIDATE\s+)?[A-Z0-9]+\s*:?\s*$/i.test(l)) return true;
        if (/^THE\s+DETONATION\s+LINE\s*:\s*$/i.test(l)) return true;
        if (/^[A-Z][A-Z0-9 '\-&/.,]{2,79}$/.test(l) && !l.endsWith(":")) return true;
        return false;
      };
      let boundary = lineStarts[lines.length - 1] ?? 0;
      // Cap at first non-empty line above the anchor and walk upward.
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        const trimmed = line.trim();
        // Case: short prose line whose line ABOVE is "THE DETONATION LINE:"
        // — it's the value of that label, treat as preamble.
        const above = i > 0 ? lines[i - 1].trim() : "";
        if (
          trimmed.length > 0 &&
          trimmed.length < 200 &&
          /^THE\s+DETONATION\s+LINE\s*:\s*$/i.test(above)
        ) {
          boundary = lineStarts[i];
          continue;
        }
        if (isPreambleLine(line)) {
          boundary = lineStarts[i];
          continue;
        }
        break;
      }
      return boundary;
    };
    const starts = anchorPositions.map((idx, i) => (i === 0 ? 0 : cardStartFor(idx)));
    const stripTail = (s: string): string => {
      // Drop trailing lines that are blank, "---", or stray markdown headers.
      const ls = s.split("\n");
      while (ls.length > 0) {
        const last = ls[ls.length - 1].trim();
        if (last === "" || /^-{3,}$/.test(last) || /^#{1,6}(\s|$)/.test(last)) {
          ls.pop();
        } else break;
      }
      return ls.join("\n").trimEnd();
    };
    const stripHead = (s: string): string => {
      const ls = s.split("\n");
      while (ls.length > 0) {
        const first = ls[0].trim();
        if (first === "" || /^-{3,}$/.test(first) || /^#{1,6}(\s|$)/.test(first)) {
          ls.shift();
        } else break;
      }
      return ls.join("\n").trimStart();
    };
    return starts.map((start, i) => {
      const end = i + 1 < starts.length ? starts[i + 1] : t.length;
      const seg = stripTail(stripHead(t.slice(start, end).trim()));
      const titleMatch = seg.match(new RegExp(`^\\s*(${NAME})\\s*\\n`, "m"));
      const name = titleMatch ? cleanName(titleMatch[1]) : `Detonation ${i + 1}`;
      return { id: `card-${i + 1}`, name: name || `Detonation ${i + 1}`, markdown: seg };
    });
  }

  if (matches.length === 0) {
    return [{ id: "card-1", name: "Territory", markdown: t }];
  }
  return matches.map((mat, i) => {
    const end = i + 1 < matches.length ? matches[i + 1].start : t.length;
    return {
      id: `card-${i + 1}`,
      name: cleanName(mat.name),
      markdown: t.slice(mat.start, end).replace(/\s+$/g, ""),
    };
  });
}

export function joinCards(cards: Card[]): string {
  // Explicit `---` divider so downstream splitters (including the UI's
  // local splitter) can reliably re-segment. Without it, partial-retry
  // merges glued cards together and hid candidates from the UI.
  return cards.map((c) => c.markdown.trim()).join("\n\n---\n\n");
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
 *  final-instruction wrapping) so the rules are the LAST thing the model sees.
 *  `objectiveDirective` is the Strategic Objective branching block (may be "");
 *  it sits after the prompt but before the formatting rules. */
export function withPhase2Formatting(systemPrompt: string, objectiveDirective = ""): string {
  return `${systemPrompt}${objectiveDirective}\n\n---\n\n${PHASE_2_FORMATTING_RULES}`;
}

/** Append a per-card redirect instruction to a system prompt. The redirect
 *  is framed as a mandatory non-negotiable constraint so the model cannot
 *  ignore it and reproduce the previous output. */
export function appendRedirect(systemPrompt: string, redirectText: string): string {
  const t = redirectText.trim();
  if (!t) return systemPrompt;
  return `${systemPrompt}

---

==== MANDATORY HUMAN REDIRECT — NON-NEGOTIABLE ====
The human reviewer has rejected the previous output and given a specific
direction for this regeneration. You MUST follow it precisely. It overrides
any default direction in the prompt where they conflict.

HUMAN DIRECTION (apply to this output only, in full, visibly):
${t}

RULES:
1. Start fresh from the human direction above. Do not start from the
   previous output and edit it.
2. The new output MUST be demonstrably different from the previous output
   in substance, framing, and language.
3. Every directive in the human direction MUST be visibly applied. If a
   directive contradicts the default prompt, the human direction wins.
4. Do not soften, partially apply, or generalise the direction.
==== END MANDATORY HUMAN REDIRECT ====`;
}

/** Append an arbitrary final instruction to a system prompt (used for
 *  COURAGE REDIRECT at Stage 18 and section regeneration at Stage 20). */
export function appendFinalInstruction(systemPrompt: string, instruction: string): string {
  const t = instruction.trim();
  if (!t) return systemPrompt;
  return `${systemPrompt}\n\n---\n\n${t}`;
}

/** Wrap a Phase 2 selective-retry user message with the same mandatory
 *  redirect sandwich the Phase 1 amendment path uses, plus an
 *  "already-taken territory" block built from the cards the human kept.
 *  Brings Phase 2 selective retries to parity with Stage 1/8/10/12:
 *    - rejected card shown verbatim under DO NOT REPRODUCE
 *    - kept cards shown by name + first lines as forbidden territory
 *    - redirect appears at top AND bottom of the user message
 *  Caller should still pass the redirect to `appendRedirect` on the system
 *  prompt as belt-and-braces. */
export async function wrapPhase2SelectiveRetry(args: {
  baseUser: string;
  redirect: string;
  rejectedCard: Card | null;
  keptCards: Card[];
  stageLabel: string;
  cardLabel?: string;
}): Promise<string> {
  const redirect = args.redirect.trim();
  const rejected = args.rejectedCard?.markdown.trim() ?? "";
  const label = args.cardLabel ?? "candidate";

  const keptBlock = args.keptCards.length
    ? `\n\n==== ${label.toUpperCase()}S ALREADY SELECTED — YOURS MUST BE CATEGORICALLY DIFFERENT ====
The human reviewer is keeping the following candidate${args.keptCards.length === 1 ? "" : "s"}.
Your new candidate MUST occupy a categorically different creative space — different
mechanism, different metaphor, different cultural register. Do not echo, paraphrase,
or adjacently restate any of them.

${args.keptCards
  .map(
    (c, i) =>
      `${i + 1}. ${c.name}\n${c.markdown.split("\n").slice(0, 6).join("\n").trim()}`,
  )
  .join("\n\n---\n\n")}
==== END ALREADY SELECTED ====`
    : "";

  if (!redirect) {
    const instruction = `\n\nProduce ONE ${label} (a single card with one heading).`;
    return `${args.baseUser}${keptBlock}${instruction}`;
  }

  const { buildFeedbackInjection } = await import("./feedback-injection");
  const { prefix, suffix } = buildFeedbackInjection({
    feedback: redirect,
    previousOutput: rejected || null,
    stageLabel: args.stageLabel,
  });

  const instruction = `\n\nProduce ONE ${label} (a single card with one heading). It must visibly satisfy every item in the HUMAN DIRECTION above and must not reproduce the rejected previous output.`;

  return `${prefix}${args.baseUser}${keptBlock}${instruction}${suffix}`;
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
    if (sections.find((s) => s.id === cur.id)) continue;
    const next = matches.slice(i + 1).find((hit) => hit.id !== cur.id);
    const end = next ? next.start : briefPart.length;
    const content = briefPart.slice(cur.bodyStart, end).trim();
    // De-duplicate same-section labels without treating them as boundaries.
    // Some briefs contain an inner label like "THE DETONATION:" immediately
    // under the canonical "THE DETONATION" heading; that inner label is body
    // content, not a new empty section.
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
  // Separators accepted between a label and its value: ASCII colon/hyphen,
  // en-dash (U+2013), em-dash (U+2014). Models sometimes substitute dashes
  // for the colon in the prompt template.
  const SEP = "[:\\-\\u2013\\u2014]?";
  const pick = (labelPattern: string): number | null => {
    const re = new RegExp(`${labelPattern}\\s*${SEP}\\s*(\\d{1,2})\\s*/\\s*10`, "i");
    const m = scoreBlock.match(re);
    return m ? parseInt(m[1], 10) : null;
  };
  const compositeMatch = scoreBlock.match(
    new RegExp(`COMPOSITE\\s*${SEP}\\s*(\\d{1,2})\\s*/\\s*50`, "i"),
  );
  const composite = compositeMatch ? parseInt(compositeMatch[1], 10) : null;
  const statusMatch = scoreBlock.match(
    new RegExp(`STATUS\\s*${SEP}\\s*(PASS|REVIEW)`, "i"),
  );
  const status = statusMatch
    ? (statusMatch[1].toUpperCase() as "PASS" | "REVIEW")
    : null;
  return {
    emotional_clarity: pick("Emotional Clarity"),
    fame_invitation: pick("Fame Invitation"),
    // Model occasionally shortens "Distinctive Asset Integration" to
    // "Distinctive Assets" — accept both.
    distinctive_asset_integration: pick("Distinctive Assets?(?:\\s+Integration)?"),
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

// Canonical channel-name validation keyword list. A valid channel name MUST
// contain at least one of these words. Applied universally to every
// candidate line extracted from Stage 19 output.
const CHANNEL_NAME_KEYWORDS = [
  "Television", "TV", "Social", "Film", "Audio", "Search", "Email",
  "CRM", "Outdoor", "Print", "Influencer", "Creator", "Activation",
  "Experiential", "Partnership", "Sponsorship", "LinkedIn", "Digital",
  "Podcast", "Radio", "Cinema", "Press", "Broadcast",
];
const CHANNEL_NAME_KEYWORD_RE = new RegExp(
  `\\b(${CHANNEL_NAME_KEYWORDS.join("|")})\\b`,
  "i",
);
// Lines that start with one of these leading words are sentence fragments,
// not channel names ("The detonation achieves…", "This campaign…").
const SENTENCE_LEADER_RE = /^(the|this|a|an)\s+/i;
// Heuristic: any common English verb form in a sentence-like structure
// (e.g. "achieves", "delivers", "creates", "is", "are"). Channel names
// are noun phrases — they do not contain finite verbs.
const SENTENCE_VERB_RE =
  /\b(is|are|was|were|be|been|being|has|have|had|do|does|did|achieves?|achieved|delivers?|delivered|creates?|created|drives?|drove|builds?|built|generates?|generated|provides?|provided|enables?|enabled|requires?|required|becomes?|became|makes?|made|takes?|took|gives?|gave|brings?|brought|turns?|turned|reaches?|reached|targets?|targeted|amplif(?:y|ies|ied)|activates?|activated)\b/i;

export function isValidChannelName(line: string): boolean {
  if (!line) return false;
  const stripped = line.replace(/[*#:_>\-—•]/g, " ").replace(/\s+/g, " ").trim();
  if (!stripped || stripped.length > 120) return false;
  const wordCount = stripped.split(/\s+/).length;
  if (wordCount < 1 || wordCount > 6) return false;
  if (SENTENCE_LEADER_RE.test(stripped)) return false;
  if (SENTENCE_VERB_RE.test(stripped)) return false;
  return CHANNEL_NAME_KEYWORD_RE.test(stripped);
}

function roleLabelFor(role: ChannelRole): string {
  switch (role) {
    case "PRIMARY": return "Primary Channel";
    case "AMPLIFICATION": return "Amplification Channel";
    case "ACTIVATION": return "Activation Channel";
    case "SUSTAINING": return "Sustaining Channel";
  }
}


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

/** Parse Stage 19 output into channel entries by named channel header.
 *  A channel header is an ALL-CAPS line (>15 chars, no trailing colon)
 *  immediately followed (after one or more newlines) by "WHY THIS CHANNEL".
 *  Role is assigned by position: 1st=PRIMARY, 2nd&3rd=AMPLIFICATION,
 *  4th=ACTIVATION (the "conversion" slot), remainder=SUSTAINING.
 *  Capped at 7. Falls back to DEFAULT_CHANNELS if fewer than 3 detected. */
export function extractStage19ChannelEntries(
  stage19: string
): ChannelEntry[] {
  if (!stage19?.trim())
    return [...DEFAULT_CHANNELS];

  const roleFor = (
    label: string
  ): ChannelRole => {
    const u = label.toUpperCase();
    if (u.includes("PRIMARY"))
      return "PRIMARY";
    if (u.includes("AMPLIFICATION"))
      return "AMPLIFICATION";
    if (
      u.includes("CONVERSION") ||
      u.includes("ACTIVATION")
    ) return "ACTIVATION";
    if (u.includes("SUSTAINING"))
      return "SUSTAINING";
    return "AMPLIFICATION";
  };

  const normalise = (name: string): string => {
    const u = name.toUpperCase();
    if (/TELEVISION|CINEMA|BROADCAST|LONG.?FORM/.test(u))
      return "Film and Long-form";
    if (/SOCIAL|SHORT.?FORM|INSTAGRAM|TIKTOK/.test(u))
      return "Social and Short-form";
    if (/INFLUENCER|CREATOR/.test(u))
      return "Influencer and Creator";
    if (/SEARCH|RETAIL\s+MEDIA|DIGITAL/.test(u))
      return "Digital and Search";
    if (/EMAIL|CRM/.test(u))
      return "Email and CRM";
    if (/OUTDOOR|IN.?STORE|OOH/.test(u))
      return "Outdoor and In-store";
    if (/AUDIO|PODCAST|RADIO/.test(u))
      return "Audio and Podcast";
    if (/\bPR\b|EARNED|PUBLICITY/.test(u))
      return "PR and Earned";
    if (/ACTIVATION|EXPERIENTIAL/.test(u))
      return "Activation and Experiential";
    const words = name.trim().split(/\s+/).slice(0, 6);
    return words
      .map(w => w.charAt(0).toUpperCase() +
        w.slice(1).toLowerCase())
      .join(" ");
  };

  const entries: ChannelEntry[] = [];
  const usedNames = new Set<string>();

  const roleBlockRe =
    /^(PRIMARY CHANNEL|AMPLIFICATION CHANNELS?|CONVERSION CHANNELS?|ACTIVATION CHANNELS?|SUSTAINING CHANNELS?):\s*\n/gim;
  const terminatorRe =
    /^(CHANNEL ECOSYSTEM VIEW|DISTINCTIVE ASSET|COMPOUNDING MEDIA|CREATIVE CONSISTENCY)/im;

  let roleMatch: RegExpExecArray | null;
  const roleBlocks: Array<{
    role: ChannelRole;
    start: number;
    end: number;
  }> = [];

  while (
    (roleMatch = roleBlockRe.exec(stage19)) !== null
  ) {
    if (roleBlocks.length > 0) {
      roleBlocks[roleBlocks.length - 1].end =
        roleMatch.index;
    }
    roleBlocks.push({
      role: roleFor(roleMatch[1]),
      start: roleMatch.index + roleMatch[0].length,
      end: stage19.length,
    });
  }

  if (roleBlocks.length === 0)
    return [...DEFAULT_CHANNELS];

  const termIdx = stage19.search(terminatorRe);
  if (termIdx > 0 && roleBlocks.length > 0) {
    roleBlocks[roleBlocks.length - 1].end = termIdx;
  }

  for (const block of roleBlocks) {
    const blockText = stage19
      .slice(block.start, block.end)
      .trim();
    const channelRe = /(?:^|\n)\s*([^\n:][^\n]{3,119}?)\s*:?\s*\n\s*WHY THIS CHANNEL:?\s*\n/gi;
    const channelMatches: Array<{
      nameLine: string;
      start: number;
      whyEnd: number;
    }> = [];
    let channelMatch: RegExpExecArray | null;
    while ((channelMatch = channelRe.exec(blockText)) !== null) {
      channelMatches.push({
        nameLine: channelMatch[1].trim(),
        start: channelMatch.index,
        whyEnd: channelMatch.index + channelMatch[0].length,
      });
    }
    for (let i = 0; i < channelMatches.length; i += 1) {
      const match = channelMatches[i];
      const contentEnd = i + 1 < channelMatches.length
        ? channelMatches[i + 1].start
        : blockText.length;
      const content = blockText
        .slice(match.whyEnd, contentEnd)
        .trim();

      // Validate the candidate channel name. A valid name must contain at
      // least one canonical channel keyword. If the matched line fails,
      // walk backwards through the preceding lines (in the same role
      // block) until a line passes. If nothing passes, fall back to the
      // role label (e.g. "Primary Channel").
      const blockBefore = blockText.slice(0, match.start);
      const candidates = [
        match.nameLine,
        ...blockBefore.split(/\n/).map((l) => l.trim()).filter(Boolean).reverse(),
      ];
      let validRaw: string | null = null;
      for (const c of candidates) {
        if (isValidChannelName(c)) { validRaw = c; break; }
      }
      const rawName = validRaw ?? roleLabelFor(block.role);
      const name = normalise(rawName);

      if (!usedNames.has(name) && content.length > 50) {
        usedNames.add(name);
        entries.push({
          name,
          role: block.role,
          content: blockText
            .slice(match.start, contentEnd)
            .trim(),
        });
      }
    }

  }

  if (entries.length < 2)
    return [...DEFAULT_CHANNELS];
  return entries.slice(0, 7);
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

// ============================================================================
// Stage 20B channel extraction — the canonical channel list source for Stage 21
// ============================================================================
//
// Parses Section Three of the Stage 20B "Channel Strategy and Audience
// Intelligence" document for named channel headers. A channel header is an
// ALL-CAPS line ending with ":" inside SECTION THREE. The paragraph(s)
// between two headers form that channel's context block.
//
// This drives the Stage 21 loop. The Stage 19 extractor is fallback only.

const STAGE_20B_ACRONYMS = new Set([
  "AFR", "HBR", "WARC", "CMO", "CRM", "AICD", "EY", "CEO", "CFO", "COO",
  "PR", "TV", "OOH", "UK", "US", "USA", "SEO", "SEM", "AI", "B2B", "B2C",
  "ASX", "TVC", "DR", "DM", "PPC", "OTT", "CTV", "FAST", "NYT", "WSJ",
  "BBC", "ABC", "CNN", "FT", "CBS", "NBC", "API",
]);
const STAGE_20B_STOPWORDS = new Set([
  "and", "or", "the", "of", "in", "on", "at", "to", "for", "with",
  "plus", "via", "by", "a", "an", "as", "from",
]);

function titleCaseChannelName(raw: string): string {
  const cased = raw
    .split(/\s+/)
    .map((wRaw, i) => {
      const m = wRaw.match(/^([A-Za-z'’]+)([.,;:!?)\]]*)$/);
      const w = m ? m[1] : wRaw;
      const tail = m ? m[2] : "";
      const upper = w.toUpperCase();
      const lower = w.toLowerCase();
      if (STAGE_20B_ACRONYMS.has(upper)) return upper + tail;
      if (i > 0 && STAGE_20B_STOPWORDS.has(lower)) return lower + tail;
      return lower.charAt(0).toUpperCase() + lower.slice(1) + tail;
    })
    .join(" ");
  // Proper-noun fixups for mixed-case brand names that pure title-casing breaks.
  return cased
    .replace(/\bLinkedin\b/g, "LinkedIn")
    .replace(/\bYoutube\b/g, "YouTube")
    .replace(/\bTiktok\b/g, "TikTok")
    .replace(/\bIdeacast\b/g, "IdeaCast")
    .replace(/\bIphone\b/g, "iPhone")
    .replace(/\bMacbook\b/g, "MacBook");
}

export function extractStage20BChannelEntries(
  stage20b: string | null | undefined,
): ChannelEntry[] {
  if (!stage20b || !stage20b.trim()) return [];
  // Normalise literal "\n" escapes that occasionally survive a copy/paste.
  const text = stage20b.replace(/\\n/g, "\n");

  const startM = text.match(/SECTION\s+THREE[^\n]*\n/i);
  if (!startM) return [];
  const startIdx = (startM.index ?? 0) + startM[0].length;
  const tail = text.slice(startIdx);
  const endM = tail.match(/SECTION\s+FOUR/i);
  const section = endM && typeof endM.index === "number"
    ? tail.slice(0, endM.index)
    : tail;

  // ALL-CAPS header line ending with ":". Allows commas, ampersands, hyphens,
  // slashes, periods, parentheses, apostrophes, and digits inside the name.
  const headerRe = /^([A-Z][A-Z0-9 ,'’\-&/.()]{6,180}):\s*$/gm;
  const hits: Array<{ name: string; start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(section)) !== null) {
    const raw = m[1].trim();
    if (/^SECTION\b/i.test(raw)) continue;
    hits.push({ name: raw, start: m.index, end: m.index + m[0].length });
  }
  if (hits.length === 0) return [];

  const entries: ChannelEntry[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < hits.length; i += 1) {
    const h = hits[i];
    const contentEnd = i + 1 < hits.length ? hits[i + 1].start : section.length;
    const content = section.slice(h.end, contentEnd).trim();
    if (content.length < 40) continue;
    const name = titleCaseChannelName(h.name);
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const role: ChannelRole = i === 0 ? "PRIMARY" : "AMPLIFICATION";
    entries.push({ name, role, content });
  }
  return entries;
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
Regenerate until the SMP is unmistakably present.

VERBATIM CARRIAGE — MANDATORY.
The SMP text above travels through this stage unaltered. Reproduce it at least
once in your output, character for character, on its own line, under the exact
heading:
SMP (VERBATIM):
${smp}
Do not paraphrase it, shorten it, re-punctuate it, re-case it, translate it into
a channel-specific variant, or replace it with the campaign line, the detonation
line, or a sentence of your own. Every channel brief, section, or document you
produce in this stage carries the same SMP string. An output that does not
contain that exact line is a failed output regardless of the quality of
everything else in it.`;
}

