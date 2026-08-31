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
  // Split into tags and text nodes so a match is only ever made on visible
  // text — never inside a tag name, attribute or URL. Matching on the raw
  // string previously skipped any acronym that opened a heading, because the
  // character before it was the closing ">" of the tag.
  const parts = html.split(/(<[^>]*>)/);
  for (const { short, long } of ACRONYMS) {
    if (seen.has(short)) continue;
    // Never expand inside an identifier token such as "LOC-1" or a range
    // like "LOC-1–LOC-12": expanding the first half produced the unreadable
    // "LOC (Left-of-Centre)-1-LOC-12". Only a standalone acronym is expanded.
    const re = new RegExp(`(^|[^A-Za-z0-9/-])(${short})\\b(?![-–—]?\\d)`);
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith("<")) continue;
      if (!re.test(parts[i])) continue;
      parts[i] = parts[i].replace(re, (_m, pre: string, tok: string) => `${pre}${tok} (${long})`);
      seen.add(short);
      break;
    }
  }
  return parts.join("");
}
