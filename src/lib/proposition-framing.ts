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
 * Client-facing documents never carry housekeeping language. A line that
 * cannot be repaired is dropped from the rendered prose and reported through
 * `FramingRepair.removedLines` instead, so the removal is visible to review
 * tooling (and, past a materiality threshold, stops the build) without a
 * reader ever seeing internal editorial text.
 */

export type FramingRepair = {
  text: string;
  /** Lines removed in full — reported to the caller, never left in the prose. */
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
      return "";

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

/** A repair that a reviewer should be able to see after the fact. */
export type FramingRepairRecord = {
  context: string;
  removedLines: string[];
  trimmedLines: string[];
  unrepairedSentences: string[];
};

/**
 * More full-line removals than this in one section is treated as material
 * content loss: the build stops for human review rather than shipping a
 * quietly shortened section.
 */
export const MAX_REMOVED_LINES = 2;

/**
 * Self-correcting form used by live document builders.
 *
 * Contract:
 *  - the returned prose NEVER contains editorial/housekeeping language; a
 *    client reading the exported document sees only strategy prose;
 *  - every repair is reported through `onRepair` (and the server log) so the
 *    removal is reviewable rather than silent;
 *  - material loss — more than MAX_REMOVED_LINES removed lines, a section
 *    emptied by the repair, or prose the repair could not fix — throws, so a
 *    human sees it instead of a client receiving a shortened document.
 */
export function enforcePropositionFraming(
  text: string,
  propositionCount: number,
  context: string,
  onRepair?: (record: FramingRepairRecord) => void,
): string {
  const violations = findPropositionFramingViolations(text, propositionCount);
  if (!violations.length) return text;
  const { text: repaired, removedLines, trimmedLines } = repairPropositionFraming(
    text,
    propositionCount,
  );
  const remaining = findPropositionFramingViolations(repaired, propositionCount);

  if (removedLines.length || trimmedLines.length || remaining.length) {
    const record: FramingRepairRecord = {
      context,
      removedLines,
      trimmedLines,
      unrepairedSentences: remaining.map((v) => v.sentence),
    };
    onRepair?.(record);
    console.warn(
      `[proposition-framing] ${context}: ${removedLines.length} line(s) removed, ${trimmedLines.length} line(s) trimmed, ${remaining.length} unrepaired`,
      removedLines.slice(0, 3).map((l) => l.slice(0, 180)),
    );
  }

  const emptied = Boolean(text.replace(/[\s#>*-]/g, "")) && !repaired.replace(/[\s#>*-]/g, "");
  if (remaining.length || removedLines.length > MAX_REMOVED_LINES || emptied) {
    throw new Error(
      `${context}: proposition framing could not be repaired safely for a client-facing document — ` +
        `${removedLines.length} line(s) would be removed, ${remaining.length} sentence(s) unrepaired` +
        (emptied ? ", and the section would be left empty" : "") +
        `. Halting for human review rather than shipping altered prose.`,
    );
  }

  return repaired;

}