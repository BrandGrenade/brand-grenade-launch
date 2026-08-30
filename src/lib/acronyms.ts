// BRAND GRENADE — ACRONYM EXPANSION (shared)
// ============================================================================
// Internal acronyms are expanded the first time a reader meets them, once per
// document, in document order. An unexplained acronym is a defect in a client
// deliverable; expanding every instance would be noise.
//
// Shared so every document path — the summary document and the canonical Minto
// builder alike — expands the same terms the same way. Expanding in only one
// path is how "CMM" shipped unexplained inside a Minto appendix.

export const ACRONYMS: Array<{ short: string; long: string }> = [
  { short: "SMP", long: "Single-Minded Proposition" },
  { short: "STRL", long: "Strategic Territory Reference Layer" },
  { short: "CMM", long: "Category Convention Map" },
  { short: "LOC", long: "Left-of-Centre" },
];

/**
 * Expands each acronym on its first visible-text occurrence. `seen` carries
 * state across the sections of one document so the expansion happens once.
 */
export function expandAcronymsFirstUse(html: string, seen: Set<string>): string {
  let out = html;
  for (const { short, long } of ACRONYMS) {
    if (seen.has(short)) continue;
    const re = new RegExp(`(^|[^A-Za-z0-9>/-])(${short})\\b`);
    if (!re.test(out)) continue;
    // Never rewrite inside a tag or an attribute: the match is on visible text.
    out = out.replace(re, (_m, pre: string, tok: string) => `${pre}${tok} (${long})`);
    seen.add(short);
  }
  return out;
}
