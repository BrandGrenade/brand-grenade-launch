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
