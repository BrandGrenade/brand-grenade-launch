// Lexical pre-filter and leak lexicon for LOC randomisation.
//
// Two jobs:
//   1. BANNED ADJACENCY — cheap, deterministic rejection of stimuli that sit in
//      the same semantic neighbourhood as the brand's category. This runs
//      before any embedding call (it is free) and again as the fallback path
//      when the embedding call fails.
//   2. LEAK LEXICON — the vocabulary abstractStrategicOpportunity() must not
//      emit. If the abstracted opportunity still names a material, era,
//      animal, country or sensory register, the randomisation engines are no
//      longer isolated and the "random" stimulus converges on the brand.

/** Category keyword -> semantic neighbourhoods that must not be drawn. */
export const BANNED_ADJACENCY: Record<string, string[]> = {
  automotive: ["machinery", "logistics", "navigation"],
  car: ["machinery", "logistics", "navigation"],
  vehicle: ["machinery", "logistics", "navigation"],
  mobility: ["logistics", "navigation", "infrastructure"],
  transport: ["logistics", "navigation", "infrastructure"],
  airline: ["navigation", "logistics", "weather"],
  freight: ["logistics", "infrastructure"],
  bank: ["finance", "bureaucracy"],
  banking: ["finance", "bureaucracy"],
  finance: ["finance", "bureaucracy"],
  insurance: ["finance", "bureaucracy"],
  fintech: ["finance"],
  payments: ["finance"],
  health: ["medicine", "biology"],
  healthcare: ["medicine", "biology"],
  pharma: ["medicine", "biology"],
  pharmaceutical: ["medicine", "biology"],
  medical: ["medicine", "biology"],
  wellness: ["medicine", "biology", "ritual"],
  food: ["ritual", "biology"],
  beverage: ["ritual", "biology"],
  drinks: ["ritual"],
  alcohol: ["ritual"],
  liquor: ["ritual"],
  grocery: ["logistics", "commerce"],
  retail: ["commerce", "logistics"],
  ecommerce: ["logistics", "commerce"],
  fashion: ["materials", "craft"],
  apparel: ["materials", "craft"],
  luxury: ["materials", "craft", "ritual"],
  construction: ["materials", "infrastructure"],
  property: ["infrastructure", "bureaucracy"],
  energy: ["infrastructure", "machinery"],
  utility: ["infrastructure", "bureaucracy"],
  telecom: ["infrastructure", "systems"],
  technology: ["machinery", "systems"],
  software: ["systems", "archive"],
  saas: ["systems"],
  media: ["archive", "music", "performance"],
  music: ["music", "performance"],
  entertainment: ["performance", "music"],
  gaming: ["performance", "childhood"],
  education: ["childhood", "archive"],
  university: ["archive", "institution"],
  sport: ["sport", "discipline"],
  fitness: ["sport", "medicine", "discipline"],
  government: ["bureaucracy", "institution"],
  defence: ["bureaucracy", "institution", "frontier"],
  security: ["crime", "systems"],
  legal: ["bureaucracy"],
  law: ["bureaucracy", "crime"],
  agriculture: ["biology", "weather"],
  dairy: ["biology", "logistics"],
  farming: ["biology", "weather"],
  travel: ["navigation", "weather"],
  tourism: ["navigation", "ritual"],
  charity: ["service", "institution"],
  childcare: ["childhood", "service"],
  logistics: ["logistics", "infrastructure"],
};

/**
 * Vocabulary the abstracted strategic opportunity must never contain. Any hit
 * means the abstraction failed and the randomisation engines would receive a
 * brand-shaped prompt dressed as an abstract one.
 */
export const LEAK_LEXICON: Record<string, string[]> = {
  material: [
    "leather", "chrome", "steel", "aluminium", "aluminum", "carbon fibre", "carbon fiber",
    "wool", "cotton", "silk", "glass", "timber", "oak", "walnut", "marble", "brass",
    "denim", "porcelain", "ceramic", "plastic", "velvet", "suede", "cashmere",
  ],
  heritage: [
    "heritage", "founded", "since 19", "since 18", "legacy", "century-old", "generations",
    "ancestral", "storied", "provenance", "archive", "founder", "dynasty", "tradition of",
  ],
  era: [
    "1920s", "1930s", "1940s", "1950s", "1960s", "1970s", "1980s", "1990s",
    "post-war", "victorian", "edwardian", "mid-century", "golden age", "belle epoque",
    "industrial revolution", "space age", "jazz age",
  ],
  sensory: [
    "roar", "growl", "purr", "aroma", "scent", "fragrance", "silky", "velvety", "crisp",
    "smooth ride", "tactile", "buttery", "creamy", "rich taste", "sonorous", "throaty",
  ],
  animal: [
    "jaguar", "panther", "falcon", "eagle", "lion", "tiger", "stallion", "horse", "bull",
    "wolf", "shark", "cheetah", "leopard", "hawk", "raven", "swan", "bear", "cobra",
    "predator", "apex", "prowl", "pounce",
  ],
  country: [
    "british", "britain", "england", "english", "german", "germany", "italian", "italy",
    "french", "france", "japanese", "japan", "american", "america", "swiss", "switzerland",
    "swedish", "sweden", "australian", "australia", "scandinavian", "nordic", "bavarian",
    "californian", "milanese", "parisian", "london", "tokyo", "new york",
  ],
  category: [
    "car", "vehicle", "automotive", "sedan", "coupe", "suv", "engine", "drivetrain",
    "dealership", "showroom", "supermarket", "shelf", "bottle", "handset", "policy",
    "premium", "mass market", "shopper", "driver", "patient", "account holder",
  ],
};

const ALL_LEAK_TERMS: Array<{ term: string; band: string }> = Object.entries(LEAK_LEXICON)
  .flatMap(([band, terms]) => terms.map((term) => ({ term, band })));

export type LeakHit = { term: string; band: string };

/** Returns every leak-lexicon term present in the abstracted opportunity. */
export function detectLeaks(text: string): LeakHit[] {
  const hay = ` ${text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ")} `;
  const hits: LeakHit[] = [];
  for (const { term, band } of ALL_LEAK_TERMS) {
    if (hay.includes(` ${term} `) || hay.includes(` ${term}s `) || hay.includes(`${term} `)) {
      if (new RegExp(`(^|[^a-z])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(hay)) {
        hits.push({ term, band });
      }
    }
  }
  return hits;
}

/** Domains that must not be drawn for this brand/category context. */
export function bannedDomains(context: string): Set<string> {
  const hay = context.toLowerCase();
  const banned = new Set<string>();
  for (const [key, domains] of Object.entries(BANNED_ADJACENCY)) {
    if (hay.includes(key)) domains.forEach((d) => banned.add(d));
  }
  return banned;
}

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "for", "on", "with", "is", "are",
  "that", "this", "it", "its", "by", "as", "at", "from", "not", "but", "be", "been",
  "than", "then", "into", "only", "one", "no", "any", "all", "more", "most", "what",
]);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w)),
  );
}

/**
 * Lexical overlap (Jaccard) used as the cheap pre-filter and as the fallback
 * distance measure when the embedding call is unavailable.
 */
export function lexicalOverlap(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}
