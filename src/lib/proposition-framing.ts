// Proposition-count contract for client-facing documents.
// Multi-candidate stage text may only retain set-comparison framing when the
// same rendered section actually presents more than one proposition.

export type PropositionFramingViolation = {
  sentence: string;
  pattern: string;
};

const SENTENCE_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "plural proposition noun", re: /\b(?:these|the|following|all|both|several|multiple|two|three|four|five|six)\s+(?:propositions|options|routes|territories)\b/i },
  { label: "propositions as subject", re: /\bthe propositions\b/i },
  { label: "set comparison", re: /\b(?:compare|comparison|differ|differentiate|choose|select(?:ing)?)\b[^.!?]{0,100}\bpropositions\b/i },
  { label: "set comparison", re: /\b(?:propositions|options|routes|territories)\b[^.!?]{0,100}\b(?:differ|different|variations?|theories|assumptions|collectively|each|between)\b/i },
  { label: "plural set pronoun", re: /\b(?:they|these|each one)\s+(?:are|represent|offer|identify|define|express|lead to)\b[^.!?]{0,120}\b(?:variations?|theories|truths?|propositions?|assumptions?)\b/i },
  { label: "plural set pronoun", re: /\b(?:variations?|theories|truths?|propositions?|assumptions?)\b[^.!?]{0,80}\b(?:they|these|each one|each other)\s+(?:are|represent|offer|identify|define|express|lead to)\b/i },
  { label: "numbered proposition set", re: /\b(?:two|three|four|five|six|\d+)\s+(?:different\s+)?propositions\b/i },
];

function sentences(text: string): string[] {
  return text
    .replace(/^#{1,6}\s+.*$/gm, "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function findPropositionFramingViolations(
  text: string,
  propositionCount: number,
): PropositionFramingViolation[] {
  if (propositionCount > 1 || !text.trim()) return [];
  const violations: PropositionFramingViolation[] = [];
  for (const sentence of sentences(text)) {
    const hit = SENTENCE_PATTERNS.find(({ re }) => re.test(sentence));
    if (hit) violations.push({ sentence, pattern: hit.label });
  }
  return violations;
}

/**
 * Removes whole unsupported set-comparison sentences from inherited stage
 * prose. This is deliberately count-driven: the same source is untouched in
 * Board/workshop comparison views that actually render multiple cards.
 */
export function frameForPropositionCount(text: string, propositionCount: number): string {
  if (propositionCount > 1 || !text.trim()) return text;
  return text
    .split("\n")
    .map((line) => {
      if (/^\s*#{1,6}\s/.test(line)) return line;
      // A bullet or fragment with no terminal punctuation is still a single
      // unit of prose and must be checked. Previously it was skipped entirely,
      // so an offending bullet survived the sanitiser and then blocked the
      // whole document build at the assertion.
      if (!/[.!?]/.test(line)) {
        return findPropositionFramingViolations(line, propositionCount).length === 0
          ? line
          : stripPrefixKeepingMarker(line);
      }
      const parts = line.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [line];
      const kept = parts
        .filter((part) => findPropositionFramingViolations(part, propositionCount).length === 0)
        .join("")
        .trimEnd();
      // Dropping every sentence of a list item would leave a naked bullet, and
      // a sentence split inside a quoted proposition can leave an orphan
      // fragment ("” ranked strongest…"). Neither is publishable, so the whole
      // line goes instead.
      return isPublishableRemainder(line, kept) ? kept : stripPrefixKeepingMarker(line);
    })
    .filter((line, index, all) => line.trim() || index === 0 || (all[index - 1] ?? "").trim())
    .join("\n");
}

/**
 * A repaired line only ships when what survives still reads as prose: it has
 * to start with a list marker or a capital letter, carry some length, and not
 * open on stray closing punctuation left behind by a split mid-quotation.
 */
function isPublishableRemainder(original: string, kept: string): boolean {
  const body = kept.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();
  if (!body) return false;
  if (body === original.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim()) return true;
  if (/^["'”’)\]:;,.–—-]/.test(body)) return false;
  if (!/^[A-Z“"(]/.test(body)) return false;
  return body.length >= 25;
}

/** Removes an offending list item entirely, marker included. */
function stripPrefixKeepingMarker(_line: string): string {
  return "";
}

export function assertPropositionFraming(
  text: string,
  propositionCount: number,
  context: string,
): void {
  const violations = findPropositionFramingViolations(text, propositionCount);
  if (!violations.length) return;
  const evidence = violations
    .slice(0, 4)
    .map((violation) => `“${violation.sentence.slice(0, 180)}”`)
    .join("; ");
  throw new Error(
    `${context} failed proposition-count framing: rendered ${propositionCount} proposition card${propositionCount === 1 ? "" : "s"} but used unsupported plural comparison language: ${evidence}`,
  );
}

/**
 * Self-correcting form used by live document builders. The point of the check
 * is to keep plural set-comparison language out of a single-proposition
 * document — so it repairs the text and reports, rather than failing the whole
 * build over one sentence or an unpunctuated bullet.
 */
export function enforcePropositionFraming(
  text: string,
  propositionCount: number,
  context: string,
): string {
  const violations = findPropositionFramingViolations(text, propositionCount);
  if (!violations.length) return text;
  const repaired = frameForPropositionCount(text, propositionCount);
  const remaining = findPropositionFramingViolations(repaired, propositionCount);
  if (remaining.length) {
    console.warn(
      `[proposition-framing] ${context}: ${remaining.length} sentence(s) could not be repaired automatically`,
      remaining.slice(0, 3).map((v) => v.sentence.slice(0, 180)),
    );
  }
  return repaired;
}