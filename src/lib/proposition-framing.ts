// Proposition-count contract for client-facing documents.
// Multi-candidate stage text may only retain set-comparison framing when the
// same rendered section actually presents more than one proposition.

export type PropositionFramingViolation = {
  sentence: string;
  pattern: string;
};

const SENTENCE_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "plural proposition noun", re: /\b(?:these|the|following|all|both|several|multiple|two|three|four|five|six)\s+propositions\b/i },
  { label: "propositions as subject", re: /\bthe propositions\b/i },
  { label: "set comparison", re: /\b(?:compare|comparison|differ|differentiate|distinguish|choose|select(?:ing)?)\b[^.!?]{0,100}\b(?:propositions|options|routes|territories)\b/i },
  { label: "set comparison", re: /\b(?:propositions|options|routes|territories)\b[^.!?]{0,100}\b(?:differ|different|variations?|theories|assumptions|collectively|each|between)\b/i },
  { label: "plural set pronoun", re: /\b(?:they|these|each one)\b[^.!?]{0,120}\b(?:variations?|theories|truths?|propositions?|options?|routes?|territories?|assumptions?)\b/i },
  { label: "plural set pronoun", re: /\b(?:variations?|theories|truths?|propositions?|options?|routes?|territories?|assumptions?)\b[^.!?]{0,120}\b(?:they|these|each one|each other)\b/i },
  { label: "numbered proposition set", re: /\b(?:two|three|four|five|six|\d+)\s+(?:different\s+)?(?:propositions|options|routes|territories)\b/i },
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
      if (/^\s*#{1,6}\s/.test(line) || !/[.!?]/.test(line)) return line;
      const parts = line.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [line];
      return parts
        .filter((part) => findPropositionFramingViolations(part, propositionCount).length === 0)
        .join("")
        .trimEnd();
    })
    .filter((line, index, all) => line.trim() || index === 0 || (all[index - 1] ?? "").trim())
    .join("\n");
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