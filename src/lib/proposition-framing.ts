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

/** A visible stand-in left wherever a whole line had to be dropped. */
export const REMOVAL_NOTICE =
  "_[Editorial note: a sentence written for a multi-proposition comparison was removed here. This document presents a single proposition.]_";

export type FramingRepair = {
  text: string;
  /** Lines removed in full — never silent; each leaves a visible notice. */
  removedLines: string[];
  /** Lines where only the offending sentence was removed. */
  trimmedLines: string[];
};

/**
 * Repairs unsupported set-comparison prose for a single-proposition document.
 * Order of preference: keep the line and drop only the offending sentence;
 * failing that, drop the line but leave a visible editorial notice so nothing
 * disappears without the reader (and the builder log) seeing it.
 */
export function repairPropositionFraming(
  text: string,
  propositionCount: number,
): FramingRepair {
  if (propositionCount > 1 || !text.trim()) {
    return { text, removedLines: [], trimmedLines: [] };
  }
  const removedLines: string[] = [];
  const trimmedLines: string[] = [];

  const out = text
    .split("\n")
    .map((line) => {
      if (/^\s*#{1,6}\s/.test(line)) return line;
      if (findPropositionFramingViolations(line, propositionCount).length === 0) return line;

      if (/[.!?]/.test(line)) {
        const parts = line.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [line];
        const kept = tidyRemainder(
          parts
            .filter(
              (part) => findPropositionFramingViolations(part, propositionCount).length === 0,
            )
            .join("")
            .trimEnd(),
        );
        if (isPublishableRemainder(line, kept)) {
          if (kept.trim() !== line.trim()) trimmedLines.push(line.trim());
          return kept;
        }
      }
      removedLines.push(line.trim());
      return keepListMarker(line);
    })
    .filter((line, index, all) => line.trim() || index === 0 || (all[index - 1] ?? "").trim())
    .join("\n");

  return { text: out, removedLines, trimmedLines };
}

/**
 * Back-compatible wrapper: returns just the repaired text.
 */
export function frameForPropositionCount(text: string, propositionCount: number): string {
  return repairPropositionFraming(text, propositionCount).text;
}

/**
 * Tidies what survives a sentence removal so a salvageable line is not thrown
 * away over stray punctuation: drops a leading orphan quote/punctuation mark
 * and restores terminal punctuation.
 */
function tidyRemainder(kept: string): string {
  if (!kept.trim()) return kept;
  const marker = kept.match(/^\s*(?:[-*•]|\d+[.)])\s*/)?.[0] ?? "";
  let body = kept.slice(marker.length).trim();
  body = body.replace(/^["'”’)\]:;,–—-]+\s*/, "");
  if (!body) return "";
  if (!/[.!?]["'”’)\]]?$/.test(body)) body = `${body}.`;
  return `${marker}${body}`;
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

/**
 * Replaces an unsalvageable line with a visible notice, preserving any list
 * marker so the surrounding structure still reads correctly.
 */
function keepListMarker(line: string): string {
  const marker = line.match(/^\s*(?:[-*•]|\d+[.)])\s*/)?.[0] ?? "";
  return `${marker}${REMOVAL_NOTICE}`;
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
  const { text: repaired, removedLines, trimmedLines } = repairPropositionFraming(
    text,
    propositionCount,
  );
  if (removedLines.length) {
    console.warn(
      `[proposition-framing] ${context}: ${removedLines.length} line(s) removed in full and replaced with a visible editorial notice`,
      removedLines.slice(0, 3).map((l) => l.slice(0, 180)),
    );
  }
  if (trimmedLines.length) {
    console.warn(
      `[proposition-framing] ${context}: ${trimmedLines.length} line(s) had one comparison sentence removed`,
      trimmedLines.slice(0, 3).map((l) => l.slice(0, 180)),
    );
  }
  const remaining = findPropositionFramingViolations(repaired, propositionCount);
  if (remaining.length) {
    console.warn(
      `[proposition-framing] ${context}: ${remaining.length} sentence(s) could not be repaired automatically`,
      remaining.slice(0, 3).map((v) => v.sentence.slice(0, 180)),
    );
  }

  return repaired;
}