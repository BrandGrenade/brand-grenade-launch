// Locates explicitly-modelled, numbered synthesis findings (e.g. "F5.11") in
// the ingested research corpus for an Intelligence Lab session, verbatim.
//
// These are the findings the research base itself flags as inference rather
// than observation. They carry real operational weight, so the report surfaces
// them in the recommendation and decisive-action sections — but always with the
// modelled label and the stated confidence basis intact, never promoted to
// established fact. Nothing here is generated: if the wording is not present in
// the corpus, no finding is returned.

export interface ModelledFinding {
  /** The finding identifier as written in the research, e.g. "F5.11". */
  code: string;
  /** The finding sentence, verbatim from the corpus. */
  text: string;
  /** Confidence wording as stated in the corpus, e.g. "MED-HIGH". */
  confidence: string;
  /** Named source field the sentence was read from. */
  sourceLabel: string;
  /** Provenance/status line that followed the finding, if the corpus gave one. */
  provenance: string;
}

const CODE_RE = /\bF\d+\.\d+\b/;

/** Splits a research blob into candidate statements without losing wording. */
function statements(text: string): { body: string; trailing: string }[] {
  const lines = text.split(/\r?\n/);
  const out: { body: string; trailing: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";
    if (!line) continue;
    const trailing: string[] = [];
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const next = lines[j] ?? "";
      if (!/^\s+/.test(next)) break;
      const t = next.trim();
      if (t) trailing.push(t);
    }
    out.push({ body: line, trailing: trailing.join(" ") });
  }
  return out;
}

/** Strips a leading enumeration marker ("22. ") without touching the sentence. */
function unnumber(s: string): string {
  return s.replace(/^\s*\d+[.)]\s+/, "").trim();
}

function confidenceOf(s: string): string {
  const m = s.match(
    /\b((?:very\s+)?(?:med(?:ium)?|low|high)(?:[-–](?:med(?:ium)?|low|high))?)\s+confidence\b/i,
  );
  if (!m) return "";
  return m[1]!
    .toLowerCase()
    .replace(/–/g, "-")
    .split("-")
    .map((w) => (w === "med" ? "medium" : w))
    .join("-");
}

/**
 * Returns every explicitly-modelled numbered finding present in the corpus,
 * in corpus order, de-duplicated by code.
 */
export function findModelledFindings(
  research: { label: string; text: string }[] | undefined,
): ModelledFinding[] {
  const seen = new Set<string>();
  const found: ModelledFinding[] = [];
  for (const source of research ?? []) {
    const text = typeof source?.text === "string" ? source.text : "";
    if (!text) continue;
    for (const { body, trailing } of statements(text)) {
      const code = body.match(CODE_RE)?.[0];
      if (!code || seen.has(code)) continue;
      // Only findings the research itself marks as modelled/inferred.
      if (!/\b(modelled|modeled|inference|hypothesis)\b/i.test(body)) continue;
      const sentence = unnumber(body);
      if (sentence.length < 40) continue;
      seen.add(code);
      found.push({
        code,
        text: sentence,
        confidence: confidenceOf(sentence),
        sourceLabel: source.label,
        provenance: trailing.replace(/\s+/g, " ").trim(),
      });
    }
  }
  return found;
}

/** Convenience: the finding with a given code, if the corpus contains it. */
export function findModelledFinding(
  research: { label: string; text: string }[] | undefined,
  code: string,
): ModelledFinding | null {
  return findModelledFindings(research).find((f) => f.code === code) ?? null;
}
