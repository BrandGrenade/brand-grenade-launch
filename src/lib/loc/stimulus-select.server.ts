// Code-side stimulus selection for the LOC randomisation engines.
//
// The model never chooses the stimulus. Selection happens here, before any
// engine prompt is built:
//
//   1. Domain adjacency pre-filter (free, deterministic) — drops whole domains
//      that sit next to the brand's category.
//   2. Lexical overlap pre-filter (free) — drops individual stimuli sharing
//      vocabulary with the brand context.
//   3. Semantic-distance rejection (embeddings) — drops stimuli whose vector
//      is too close to the brand-context vector. Corpus vectors are
//      precomputed at build time (stimulus-vectors.json); only the brand
//      context is embedded at run time, so this is one call per LOC run.
//   4. Seeded, domain-first draw — uniform over surviving domains, then over
//      items in the drawn domain, using a PRNG seeded from the session so a
//      run is reproducible and auditable.
//
// If the embedding call fails, step 3 is skipped and the lexical filter from
// step 2 is tightened as the fallback. Selection never blocks a LOC run.

import {
  OBJECT_STIMULI,
  WORLD_STIMULI,
  STIMULUS_CORPUS_VERSION,
  stimulusText,
  type ObjectStimulus,
  type WorldStimulus,
} from "./stimulus-corpus";
import { bannedDomains, lexicalOverlap } from "./stimulus-adjacency";
import vectorData from "./stimulus-vectors.json";

/**
 * Reject a stimulus whose cosine distance to the brand context is below this.
 * (distance = 1 - cosine similarity, so this rejects near neighbours.)
 */
export const MIN_COSINE_DISTANCE = 0.25;
/**
 * Additionally reject the closest slice of the surviving pool. Absolute
 * thresholds alone are weak with normalised embeddings; dropping the nearest
 * quantile guarantees the draw comes from genuinely distant material.
 */
const NEAREST_QUANTILE_REJECTED = 0.2;
/** Lexical Jaccard overlap above which a stimulus is rejected outright. */
const MAX_LEXICAL_OVERLAP = 0.08;
const MAX_LEXICAL_OVERLAP_FALLBACK = 0.04;

const VECTORS = vectorData as {
  model: string;
  dimensions: number;
  corpusVersion: number;
  vectors: Record<string, number[]>;
};

export type StimulusKind = "object" | "world";

export type AssignedStimulus = {
  kind: StimulusKind;
  id: string;
  name: string;
  domain: string;
  /** Properties (object) or success-logic (world). */
  detail: string[];
  /** Cosine distance from the brand context, when embeddings were available. */
  distance: number | null;
  method: "embedding" | "lexical";
  corpusVersion: number;
};

// ---------------------------------------------------------------- seeded PRNG

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ embedding

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function embedText(text: string): Promise<number[] | null> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: VECTORS.model,
        input: text.slice(0, 6000),
        dimensions: VECTORS.dimensions,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
    const v = json.data?.[0]?.embedding;
    return Array.isArray(v) && v.length ? v : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ selection

type AnyStimulus = ObjectStimulus | WorldStimulus;

function detailOf(s: AnyStimulus): string[] {
  return "properties" in s ? s.properties : s.logic;
}

export async function drawStimuli(args: {
  kind: StimulusKind;
  count: number;
  /** Brand name + category + abstracted opportunity — whatever defines "too close". */
  brandContext: string;
  /** Stable seed (session id + engine name) so a run is reproducible. */
  seed: string;
  /** Precomputed context vector, when the caller already made the call. */
  contextVector?: number[] | null;
}): Promise<{ stimuli: AssignedStimulus[]; method: "embedding" | "lexical" }> {
  const corpus: AnyStimulus[] = args.kind === "object" ? OBJECT_STIMULI : WORLD_STIMULI;
  const banned = bannedDomains(args.brandContext);

  // 1 + 2 — adjacency and lexical pre-filter.
  let pool = corpus.filter((s) => !banned.has(s.domain));
  if (pool.length < args.count * 3) pool = corpus.slice();

  const contextVector =
    args.contextVector !== undefined ? args.contextVector : await embedText(args.brandContext);
  const method: "embedding" | "lexical" = contextVector ? "embedding" : "lexical";
  const lexCap = method === "embedding" ? MAX_LEXICAL_OVERLAP : MAX_LEXICAL_OVERLAP_FALLBACK;

  let scored = pool
    .map((s) => ({
      s,
      lex: lexicalOverlap(stimulusText(s), args.brandContext),
      distance: contextVector
        ? 1 - cosine(VECTORS.vectors[s.id] ?? [], contextVector)
        : null,
    }))
    .filter((x) => x.lex <= lexCap)
    .filter((x) => x.distance === null || x.distance >= MIN_COSINE_DISTANCE);

  // 3b — relative rejection of the nearest slice.
  if (contextVector && scored.length > args.count * 4) {
    scored.sort((a, b) => (b.distance ?? 0) - (a.distance ?? 0));
    const keep = Math.max(args.count * 3, Math.floor(scored.length * (1 - NEAREST_QUANTILE_REJECTED)));
    scored = scored.slice(0, keep);
  }

  if (scored.length === 0) {
    scored = pool.map((s) => ({ s, lex: 0, distance: null }));
  }

  // 4 — seeded, domain-first draw without replacement.
  const rand = mulberry32(hashSeed(`${args.seed}|${STIMULUS_CORPUS_VERSION}`));
  const byDomain = new Map<string, typeof scored>();
  for (const x of scored) {
    const arr = byDomain.get(x.s.domain) ?? [];
    arr.push(x);
    byDomain.set(x.s.domain, arr);
  }

  const picked: AssignedStimulus[] = [];
  const domains = Array.from(byDomain.keys());
  while (picked.length < args.count && domains.length > 0) {
    const di = Math.floor(rand() * domains.length);
    const domain = domains[di]!;
    const items = byDomain.get(domain)!;
    const ii = Math.floor(rand() * items.length);
    const chosen = items[ii]!;
    items.splice(ii, 1);
    // One draw per domain per engine — force spread across the corpus.
    domains.splice(di, 1);
    picked.push({
      kind: args.kind,
      id: chosen.s.id,
      name: chosen.s.name,
      domain: chosen.s.domain,
      detail: detailOf(chosen.s),
      distance: chosen.distance,
      method,
      corpusVersion: STIMULUS_CORPUS_VERSION,
    });
  }

  return { stimuli: picked, method };
}
