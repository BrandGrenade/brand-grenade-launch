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
  // v2.1 EDT core — grievance/permission-seeking language
  "apology",
  "guilt",
  "permission",
  // Universal advertising clichés — banned in all Stage 9 output regardless
  // of category, competitor, or engine.
  "transformation",
  "journey",
  "authentic",
  "unleash",
  "elevate",
  "redefine",
] as const;

// CONDITIONAL — banned by default, but may be relaxed by the left-of-centre
// engines IF (a) the word does not appear on the brief's exclusion list AND
// (b) no named competitor in the brief's category already owns the word.
// The core Stage 9 generator treats these as banned. The exemption is
// scoped to the left-of-centre layer only.
export const CONDITIONALLY_BANNED_STAGE9 = [
  "reward",
  "earn",
  "earned",
  "deserve",
  "deserved",
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
