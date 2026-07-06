// Stage 9 — Banned-word policy (two structurally independent lists)
//
// Restored after the June 2026 conditional-poison-word change over-applied
// its exemption and swept universal bans into the relaxed set (Tier 2
// Check 5 caught "apology" leaking through the Stage 9 output).
//
// The two lists MUST remain physically separate arrays. The
// competitor-ownership exemption used by the left-of-centre engines is
// wired to CONDITIONALLY_BANNED_STAGE9 ONLY. It cannot reach the
// UNIVERSAL_BANNED_STAGE9 set — that collision is prevented structurally,
// not by a conditional toggle inside a merged list.

// UNIVERSAL — nothing relaxes these. Apply to the ENTIRE Stage 9 output,
// including the left-of-centre Breach / Fuse / Flashpoint block.
export const UNIVERSAL_BANNED_STAGE9 = [
  // v2.1 EDT core — grievance language.
  // "permission" moved to CONDITIONAL (July 2026): the word is legitimate
  // strategic territory for challenger, autonomy, and unlock briefs and
  // must not be blanket-banned; competitor-owned / brief-excluded cases
  // are still blocked by the conditional path.
  "apology",
  "guilt",
  // Universal advertising clichés — banned in all Stage 9 output regardless
  // of category, competitor, or engine.
  "transformation",
  "journey",
  "authentic",
  "unleash",
  "elevate",
  "redefine",
] as const;

// CONDITIONAL — allowed by default, blocked only when a named competitor
// in the brief owns the word or the brief's exclusion list forbids it.
export const CONDITIONALLY_BANNED_STAGE9 = [
  "reward",
  "earn",
  "earned",
  "deserve",
  "deserved",
  "permission",
] as const;

export const UNIVERSAL_BANNED_STAGE9_LIST = UNIVERSAL_BANNED_STAGE9.join(", ");
export const CONDITIONALLY_BANNED_STAGE9_LIST =
  CONDITIONALLY_BANNED_STAGE9.join(", ");

const CONDITIONAL_STEMS: Record<string, readonly string[]> = {
  reward: ["reward", "rewards", "rewarded", "rewarding"],
  earn: ["earn", "earned", "earning", "earns"],
  earned: ["earn", "earned", "earning", "earns"],
  deserve: ["deserve", "deserved", "deserves", "deserving"],
  deserved: ["deserve", "deserved", "deserves", "deserving"],
};

function sentenceSplit(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function competitorNames(briefText: string, brandName: string): string[] {
  const names = new Set<string>();
  const competitorBlock = briefText.match(/competitors?\s*[:\-]\s*([^\n.]+(?:\.[^\n.]+){0,2})/i)?.[1] ?? briefText;
  for (const m of competitorBlock.matchAll(/\b[A-Z][A-Za-z0-9&'’\-]*(?:\s+[A-Z][A-Za-z0-9&'’\-]*){0,2}\b/g)) {
    const name = m[0].trim();
    if (name.length < 2) continue;
    if (/^(Brand|Category|Challenge|Product|Target|Business|Objective|Competitors?|None|No)$/i.test(name)) continue;
    if (brandName && name.toLowerCase() === brandName.toLowerCase()) continue;
    names.add(name);
  }
  return Array.from(names);
}

function wordInSentence(sentence: string, word: string): boolean {
  const variants = CONDITIONAL_STEMS[word.toLowerCase()] ?? [word];
  return variants.some((variant) => new RegExp(`\\b${variant}\\b`, "i").test(sentence));
}

export function conditionalStage9WordAllowedInLeftOfCentre(args: {
  word: string;
  brandName: string;
  briefText: string;
  stage2Output: string;
}): boolean {
  const context = `${args.briefText}\n\n${args.stage2Output}`;
  const names = competitorNames(args.briefText, args.brandName);
  const sentences = sentenceSplit(context);

  for (const sentence of sentences) {
    if (!wordInSentence(sentence, args.word)) continue;
    if (/\b(never[-\s]?say|must not say|exclusion|excluded|banned|forbidden)\b/i.test(sentence)) return false;
    if (/\b(no|none|not|never)\b[^.?!\n]{0,50}\bown(?:s|ed|ing)?\b/i.test(sentence)) continue;
    if (!/\bown(?:s|ed|ing)?\b/i.test(sentence)) continue;
    if (names.some((name) => sentence.toLowerCase().includes(name.toLowerCase()))) return false;
  }

  return true;
}

/**
 * Returns the conditionally-banned words that are NOT permitted in the
 * left-of-centre layer for this brief — i.e. either the brief's exclusion
 * list forbids them, or a named competitor already owns them. Injected
 * into the Fuse/Breach/Flashpoint prompt so the generator avoids them
 * at generation time rather than being rejected post-hoc.
 */
export function competitorOwnedConditionalStage9Words(args: {
  brandName: string;
  briefText: string;
  stage2Output: string;
}): string[] {
  const banned: string[] = [];
  const canonical = ["reward", "earn", "deserve"];
  for (const word of canonical) {
    const allowed = conditionalStage9WordAllowedInLeftOfCentre({
      word,
      brandName: args.brandName,
      briefText: args.briefText,
      stage2Output: args.stage2Output,
    });
    if (!allowed) {
      for (const stem of CONDITIONAL_STEMS[word] ?? [word]) banned.push(stem);
    }
  }
  return Array.from(new Set(banned));
}


function activeLeftOfCentreEngine(output: string, index: number): "BREACH" | "FUSE" | "FLASHPOINT" | null {
  const before = output.slice(0, Math.max(0, index));
  const engines: Array<"BREACH" | "FUSE" | "FLASHPOINT"> = ["BREACH", "FUSE", "FLASHPOINT"];
  let active: "BREACH" | "FUSE" | "FLASHPOINT" | null = null;
  let activeAt = -1;
  for (const engine of engines) {
    const rx = new RegExp(`(^|\\n)\\s*${engine}\\b`, "gi");
    let m: RegExpExecArray | null;
    while ((m = rx.exec(before)) !== null) {
      if (m.index > activeAt) {
        active = engine;
        activeAt = m.index;
      }
    }
  }
  return active;
}

export function conditionalStage9HitAllowedInLeftOfCentre(args: {
  word: string;
  index: number;
  output: string;
  brandName: string;
  briefText: string;
  stage2Output: string;
}): boolean {
  // Gate must match the LOC prompt's stated policy: LIST B is relaxable
  // across the entire left-of-centre layer (Breach / Fuse / Flashpoint) so
  // long as no named competitor owns the word and the brief's exclusion
  // list does not forbid it. The prior Fuse-only restriction was stricter
  // than the prompt, so category-native verbs (earn / reward / deserve on
  // performance-discipline briefs) hit the gate in Breach/Flashpoint even
  // when the content rule permitted them, exhausting retries. Alignment
  // here removes that prompt/gate mismatch. The `index`/`output` args are
  // retained for signature stability with callers.
  void args.index;
  void args.output;
  return conditionalStage9WordAllowedInLeftOfCentre(args);
}


/**
 * Core Stage 9 conditional-word policy.
 *
 * Design intent: conditional words (reward / earn / deserve) are the natural
 * verb-space for training / performance / discipline briefs. Blanket-banning
 * them in core starves category-relevant briefs of their native territory,
 * which is why Stage 11 then eliminates the resulting weak SMPs.
 *
 * Rule: a conditional word is BLOCKED in core Stage 9 output ONLY IF a
 * named competitor in the brief already owns it (avoids mimicking a
 * competitor's proposition), OR the brief's exclusion list forbids it.
 * Otherwise it is ALLOWED. This mirrors the left-of-centre rule but with
 * no per-engine gate — the whole core generator gets the same treatment.
 */
export function conditionalStage9HitAllowedInCore(args: {
  word: string;
  brandName: string;
  briefText: string;
  stage2Output: string;
}): boolean {
  return conditionalStage9WordAllowedInLeftOfCentre(args);
}
